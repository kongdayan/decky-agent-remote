"""The Deck records and forwards; execution stays on the selected host."""
import asyncio
import json
import os
from pathlib import Path
import signal
import tempfile
import time
import urllib.parse
import urllib.request
import urllib.error
import uuid
import hashlib
import decky


_ENGLISH = json.loads((Path(__file__).parent / 'locales/en.json').read_text())


class Plugin:
    def _t(self, text):
        return _ENGLISH.get(text, text) if getattr(self, 'config', {}).get('uiLanguage') == 'en' else text

    def _save(self):
        p = self.settings / 'hosts.json'
        tmp = p.with_suffix('.tmp')
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(self.config, stream, ensure_ascii=False, indent=2)
        tmp.chmod(0o600)
        tmp.replace(p)

    def _host(self, host_id=None):
        host = next((h for h in self.config['hosts'] if h['id'] == (host_id or self.config['host'])), None)
        if not host:
            raise ValueError(self._t('请先添加执行机器'))
        return host

    async def save_host(self, host_id: str, name: str, url: str, token: str):
        """Tokens stay in the backend; a blank token preserves an existing one."""
        async with self.lock:
            if self.phase != 'idle':
                raise RuntimeError(self._t('请先结束录音或发送'))
            parsed = urllib.parse.urlsplit(url.strip())
            if (parsed.scheme not in ('http', 'https') or not parsed.hostname or
                    parsed.username or parsed.password or parsed.query or parsed.fragment or
                    parsed.path not in ('', '/')):
                raise ValueError(self._t('地址应为 http(s)://主机:端口，不包含路径或密码'))
            try:
                parsed.port
            except ValueError:
                raise ValueError(self._t('端口无效')) from None
            if not name.strip() or len(name) > 60:
                raise ValueError(self._t('请输入机器名称，最多 60 字'))
            existing = self._host(host_id) if host_id else None
            secret = token.strip() or (existing['token'] if existing else '')
            if len(secret) < 32 or len(secret) > 512 or any(c.isspace() for c in secret):
                raise ValueError(self._t('请输入 bridge 生成的连接令牌，至少 32 字符'))
            host = {'id': host_id or str(uuid.uuid4()), 'name': name.strip(),
                    'url': url.strip().rstrip('/'), 'token': secret}
            health = await self._request(host, '/v1/health')
            if 'dsh' not in health.get('agents', ['dsh']):
                raise ValueError(self._t('该 bridge 未启用 DSH'))
            if existing:
                existing.update(host)
            else:
                self.config['hosts'].append(host)
            if self.config['host'] != host['id']:
                self.config.update(host=host['id'], agent='dsh', session='')
                self.draft = ''
                self.draft_target = self.draft_request_id = None
                self.last_reply_key = self.previous_status = None
            self._save()
        return await self.get_state()

    async def remove_host(self, host_id: str):
        async with self.lock:
            if self.phase != 'idle':
                raise RuntimeError(self._t('请先结束录音或发送'))
            self._host(host_id)
            self.config['hosts'] = [h for h in self.config['hosts'] if h['id'] != host_id]
            if self.config['host'] == host_id:
                self.config.update(host=self.config['hosts'][0]['id'] if self.config['hosts'] else '', agent='dsh', session='')
                self.draft = ''
                self.draft_target = self.draft_request_id = None
                self.last_reply_key = self.previous_status = None
            self._save()
        return await self.get_state()

    async def capabilities(self, host: str):
        return await self._request(self._host(host), '/v1/health')

    def _request_sync(self, host, path, data=None, audio=False):
        if not path.startswith('/v1/'):
            raise ValueError(self._t('无效接口'))
        url = host['url'].rstrip('/') + path
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ('http', 'https') or parsed.username or parsed.password:
            raise ValueError(self._t('无效主机地址'))
        headers = {'Authorization': 'Bearer ' + host['token'],
                   'X-Agent-Language': getattr(self, 'config', {}).get('uiLanguage', 'zh-CN')}
        if data is not None:
            headers['Content-Type'] = 'audio/wav' if audio else 'application/json'
            if not audio:
                data = json.dumps(data).encode()
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        request = urllib.request.Request(url, data=data, headers=headers)
        try:
            with opener.open(request, timeout=210 if audio else 25) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            try:
                message = json.loads(error.read()).get('error', self._t('连接失败'))
            except Exception:
                message = self._t('远端 HTTP ') + str(error.code)
            raise RuntimeError(message) from None

    async def _request(self, host, path, data=None, audio=False):
        return await asyncio.to_thread(self._request_sync, host, path, data, audio)

    async def _emit(self, title, body):
        await decky.emit('agent_notice', title, body)

    async def get_state(self):
        return {'hosts': [{'id': h['id'], 'name': h['name'], 'url': h['url']} for h in self.config['hosts']],
                'host': self.config['host'], 'agent': self.config['agent'],
                'session': self.config.get('session', ''), 'hotkey': self.config.get('hotkey', 33),
                'autoSend': self.config.get('autoSend', True), 'phase': self.phase,
                'draft': self.draft, 'last': self.last, 'lastKind': getattr(self, 'last_kind', ''),
                'uiLanguage': self.config.get('uiLanguage', 'zh-CN'),
                'speechLanguage': self.config.get('speechLanguage', 'zh')}

    async def select(self, host: str, agent: str, session: str):
        async with self.lock:
            if self.phase != 'idle':
                raise RuntimeError(self._t('请先结束当前录音或识别'))
            self._host(host)
            if agent not in ('dsh', 'codex'):
                raise ValueError(self._t('未知 Agent'))
            if (host, agent, session) != self._target():
                self.draft = self.last = ''
                self.last_kind = ''
                self.draft_target = None
                self.draft_request_id = None
            self.config.update(host=host, agent=agent, session=session)
            self._save()
            self.previous_status = None
            self.last_reply_key = None
        return await self.get_state()

    def _target(self):
        return (self.config['host'], self.config['agent'], self.config.get('session', ''))

    async def preferences(self, hotkey: int, autoSend: bool):
        async with self.lock:
            if self.phase != 'idle':
                raise RuntimeError(self._t('请先结束录音或发送'))
            if hotkey not in (-1, 32, 33, 44, 45) or type(autoSend) is not bool:
                raise ValueError(self._t('无效快捷键'))
            self.config.update(hotkey=hotkey, autoSend=autoSend)
            self._save()
        return await self.get_state()

    async def language_preferences(self, uiLanguage: str, speechLanguage: str):
        async with self.lock:
            if self.phase != 'idle':
                raise RuntimeError(self._t('请先结束录音或发送'))
            if uiLanguage not in ('zh-CN', 'en') or speechLanguage not in ('zh', 'en', 'auto'):
                raise ValueError(self._t('语言选项无效'))
            self.config.update(uiLanguage=uiLanguage, speechLanguage=speechLanguage)
            self._save()
        return await self.get_state()

    async def sessions(self, host: str, agent: str):
        if agent not in ('dsh', 'codex'):
            raise ValueError(self._t('未知 Agent'))
        return await self._request(self._host(host), '/v1/sessions?agent=' + agent)

    async def detail(self, host: str, agent: str, session: str):
        return await self._request(self._host(host), '/v1/session?' + urllib.parse.urlencode({'agent': agent, 'id': session}))

    async def history(self, host: str, agent: str, session: str, cursor: str = ''):
        query = {'agent': agent, 'id': session}
        if cursor:
            query['cursor'] = cursor
        return await self._request(self._host(host), '/v1/history?' + urllib.parse.urlencode(query))

    def _reply_key(self, detail):
        messages = [m for m in detail.get('messages', []) if m.get('role') == 'assistant']
        if not messages:
            return ''
        message = messages[-1]
        return str(message.get('id', '')) + ':' + hashlib.sha256(message['text'].encode()).hexdigest()

    async def new_session(self):
        async with self.lock:
            if self.phase != 'idle':
                raise RuntimeError(self._t('请先结束录音或发送'))
            self.phase = 'creating'
            try:
                result = await self._request(self._host(), '/v1/new', {'agent': self.config['agent']})
                self.config['session'] = result['id']
                self.draft = self.last = ''
                self.last_kind = ''
                self.draft_target = self.draft_request_id = None
                self.previous_status = None
                self.last_reply_key = None
                self._save()
            finally:
                self.phase = 'idle'
        return await self.get_state()

    async def send_text(self, text: str):
        async with self.lock:
            if self.phase != 'idle':
                raise RuntimeError(self._t('正在录音、识别或发送'))
            if not text.strip():
                raise ValueError(self._t('消息不能为空'))
            target = self._target()
            if not target[2]:
                raise ValueError(self._t('请先选择会话'))
            if self.draft_target and self.draft_target != target:
                raise ValueError(self._t('录音目标已切换，请重新录音'))
            if text != self.draft or not self.draft_request_id:
                self.draft_request_id = str(uuid.uuid4())
            self.draft = text
            self.draft_target = target
            self.phase = 'sending'
        try:
            return await self._dispatch(target, text, self.draft_request_id)
        finally:
            self.phase = 'idle'

    async def discard_draft(self):
        async with self.lock:
            if self.phase != 'idle':
                raise RuntimeError(self._t('请先结束录音或发送'))
            self.draft = self.last = ''
            self.last_kind = ''
            self.draft_target = self.draft_request_id = None
        return await self.get_state()

    async def _dispatch(self, target, text, request_id=None):
        self.phase = 'sending'
        await self._emit(self._t('正在发送'), self._t('发送到 ') + self._host(target[0])['name'])
        try:
            baseline = await self.detail(*target)
            self.last_reply_key = self._reply_key(baseline)
        except Exception:
            self.last_reply_key = ''
        result = await self._request(self._host(target[0]), '/v1/messages', {
            'agent': target[1], 'session': target[2], 'text': text,
            'requestId': request_id or str(uuid.uuid4())})
        self.last = self._t('已发送：') + text
        self.last_kind = 'sent'
        self.draft = ''
        self.draft_target = self.draft_request_id = None
        await self._emit(self._t('任务已派发 · ') + self._host(target[0])['name'], text[:150])
        return result

    async def record_start(self):
        async with self.lock:
            if self.phase != 'idle':
                return await self.get_state()
            if self.draft:
                raise ValueError(self._t('有待发送文字，请先发送或放弃文字'))
            target = self._target()
            if not target[2]:
                raise ValueError(self._t('请先在 Agent Remote 中选择会话'))
            self._host(target[0])
            fd, filename = tempfile.mkstemp(prefix='agent-voice-', suffix='.wav', dir=self.runtime)
            os.close(fd)
            self.audio = Path(filename)
            self.record_target = target
            self.record_language = self.config.get('speechLanguage', 'zh')
            self.last = ''
            self.last_kind = ''
            self.started = time.monotonic()
            env = dict(os.environ, XDG_RUNTIME_DIR=f'/run/user/{os.getuid()}')
            self.recorder = await asyncio.create_subprocess_exec(
                '/usr/bin/pw-record', '--rate=16000', '--channels=1', '--format=s16', str(self.audio),
                env=env, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
            await asyncio.sleep(0.15)
            if self.recorder.returncode is not None:
                self.audio.unlink(missing_ok=True)
                raise RuntimeError(self._t('麦克风录音失败，请检查 PipeWire 输入设备'))
            self.phase = 'recording'
            self.limit_task = asyncio.create_task(self._record_limit())
            await self._emit(self._t('正在录音 · ') + self._host(target[0])['name'], self._t('松开背键结束；面板按钮再次点击结束。最长 90 秒。'))
            return await self.get_state()

    async def _record_limit(self):
        await asyncio.sleep(90)
        await self.record_stop(False)

    async def record_stop(self, send: bool = True):
        async with self.lock:
            if self.phase != 'recording':
                return await self.get_state()
            if self.limit_task != asyncio.current_task():
                self.limit_task.cancel()
            self.recorder.send_signal(signal.SIGINT)
            try:
                await asyncio.wait_for(self.recorder.wait(), 3)
            except asyncio.TimeoutError:
                self.recorder.kill()
                await self.recorder.wait()
            self.phase = 'transcribing'
            target = self.record_target
        try:
            if time.monotonic() - self.started < 0.65:
                raise ValueError(self._t('录音太短，请按住背键说话'))
            await self._emit(self._t('正在识别'), self._t('执行机器正在将录音转成文字'))
            result = await self._request(self._host(target[0]), '/v1/transcribe?language=' + self.record_language, self.audio.read_bytes(), True)
            self.draft = result['text']
            self.draft_target = target
            self.draft_request_id = str(uuid.uuid4())
            if send and self.config.get('autoSend', True) and not self.closing:
                await self._dispatch(target, self.draft, self.draft_request_id)
            else:
                self.last = self._t('识别完成，待发送：') + self.draft
                self.last_kind = 'draft'
                await self._emit(self._t('识别完成，待发送'), self.draft[:150])
        except Exception as error:
            self.last = str(error)
            self.last_kind = 'error'
            await self._emit(self._t('语音未发送'), str(error)[:220])
        finally:
            self.audio.unlink(missing_ok=True)
            self.phase = 'idle'
        return await self.get_state()

    async def cancel_recording(self):
        async with self.lock:
            if self.phase == 'recording':
                self.limit_task.cancel()
                self.recorder.terminate()
                await self.recorder.wait()
                self.audio.unlink(missing_ok=True)
                self.phase = 'idle'
        return await self.get_state()

    async def _monitor(self):
        while True:
            await asyncio.sleep(4)
            try:
                target = self._target()
                if not target[2] or self.phase != 'idle':
                    continue
                detail = await self.detail(*target)
                state = (detail['state'], tuple(detail.get('flags', [])))
                if target != self._target():
                    continue
                reply_key = self._reply_key(detail)
                if detail['state'] == 'idle' and reply_key:
                    if self.last_reply_key is not None and reply_key != self.last_reply_key:
                        messages = [m for m in detail.get('messages', []) if m.get('role') == 'assistant']
                        await decky.emit('agent_reply', target[0], target[1], target[2], detail['title'], messages[-1]['text'][:220])
                    self.last_reply_key = reply_key
                if self.previous_status and state != self.previous_status:
                    if state[0] in ('idle', 'waiting', 'systemError') or state[1]:
                        await self._emit(detail['title'], self._t('状态：') + self._t({'idle':'已连接', 'waiting':'等待回复', 'systemError':'执行异常'}.get(state[0], state[0])) + (self._t(' · 需要在执行机器处理') if state[1] else ''))
                self.previous_status = state
            except asyncio.CancelledError:
                raise
            except Exception:
                pass

    async def _main(self):
        self.settings = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
        self.runtime = Path(decky.DECKY_PLUGIN_RUNTIME_DIR)
        self.settings.mkdir(parents=True, exist_ok=True)
        self.runtime.mkdir(parents=True, exist_ok=True)
        self.settings.chmod(0o700)
        self.runtime.chmod(0o700)
        for abandoned in self.runtime.glob('agent-voice-*.wav'):
            abandoned.unlink(missing_ok=True)
        config_file = self.settings / 'hosts.json'
        self.config = json.loads(config_file.read_text()) if config_file.exists() else {'hosts': [], 'host': '', 'agent': 'dsh', 'session': '', 'hotkey': 33, 'autoSend': True}
        self.lock = asyncio.Lock()
        self.phase = 'idle'
        self.closing = False
        self.draft = self.last = ''
        self.last_kind = ''
        self.draft_target = self.draft_request_id = None
        self.previous_status = None
        self.last_reply_key = None
        self.monitor_task = asyncio.create_task(self._monitor())

    async def _unload(self):
        self.closing = True
        self.monitor_task.cancel()
        await self.cancel_recording()
        await asyncio.gather(self.monitor_task, return_exceptions=True)
