import asyncio
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest
import tempfile
from unittest.mock import AsyncMock, patch

stub = types.SimpleNamespace(emit=AsyncMock())
sys.modules['decky'] = stub
spec = importlib.util.spec_from_file_location('agent_remote_test', Path(__file__).resolve().parents[1] / 'main.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReplyNotifications(unittest.IsolatedAsyncioTestCase):
    async def test_reply_notifies_when_fast_turn_stays_idle_between_polls(self):
        plugin = module.Plugin()
        plugin.config = {'host': 'host', 'agent': 'dsh', 'session': 'fixture'}
        plugin.phase = 'idle'
        plugin.previous_status = ('idle', ())
        plugin.last_reply_key = plugin._reply_key({'messages': [{'role': 'assistant', 'id': 'old', 'text': 'old'}]})
        result = {'state': 'idle', 'flags': [], 'title': 'fixture', 'messages': [{'role': 'assistant', 'id': 'new', 'text': '新回复'}]}
        plugin.detail = AsyncMock(side_effect=[result, result, asyncio.CancelledError()])
        stub.emit.reset_mock()
        with patch.object(module.asyncio, 'sleep', new=AsyncMock()):
            with self.assertRaises(asyncio.CancelledError):
                await plugin._monitor()
        stub.emit.assert_awaited_once_with('agent_reply', 'host', 'dsh', 'fixture', 'fixture', '新回复')

    async def test_first_poll_does_not_notify_old_saved_reply(self):
        plugin = module.Plugin()
        plugin.config = {'host': 'host', 'agent': 'dsh', 'session': 'fixture'}
        plugin.phase = 'idle'
        plugin.previous_status = None
        plugin.last_reply_key = None
        result = {'state': 'idle', 'flags': [], 'title': 'fixture', 'messages': [{'role': 'assistant', 'id': 'old', 'text': '保存的旧回复'}]}
        plugin.detail = AsyncMock(side_effect=[result, asyncio.CancelledError()])
        stub.emit.reset_mock()
        with patch.object(module.asyncio, 'sleep', new=AsyncMock()):
            with self.assertRaises(asyncio.CancelledError):
                await plugin._monitor()
        stub.emit.assert_not_awaited()


class PairingPrivacy(unittest.IsolatedAsyncioTestCase):
    async def test_pairing_checks_connection_and_never_returns_token(self):
        with tempfile.TemporaryDirectory() as directory:
            p = module.Plugin()
            p.settings = Path(directory)
            p.config = {'hosts': [], 'host': '', 'agent': 'dsh', 'session': ''}
            p.phase = 'idle'
            p.lock = asyncio.Lock()
            p.draft = p.last = ''
            p._request = AsyncMock(return_value={'agents': ['dsh']})
            secret = 'fixture-secret-' * 4
            state = await p.save_host('', 'Workstation', 'http://192.0.2.10:18765', secret)
            self.assertNotIn(secret, json.dumps(state))
            self.assertEqual((p.settings / 'hosts.json').stat().st_mode & 0o777, 0o600)
            host = state['host']
            await p.save_host(host, 'Renamed', 'https://example.com', '')
            self.assertEqual(p.config['hosts'][0]['token'], secret)
            p._request = AsyncMock(side_effect=RuntimeError('unreachable'))
            with self.assertRaises(RuntimeError):
                await p.save_host('', 'Offline', 'https://example.org', secret)
            self.assertEqual(len(p.config['hosts']), 1)

    async def test_pairing_rejects_embedded_credentials_and_locks_target_during_recording(self):
        p = module.Plugin()
        p.lock = asyncio.Lock()
        p.phase = 'idle'
        with self.assertRaises(ValueError):
            await p.save_host('', 'Unsafe', 'http://user:pass@example.com', 'x' * 48)
        p.phase = 'recording'
        with self.assertRaises(RuntimeError):
            await p.remove_host('anything')

    async def test_failed_send_preserves_draft_and_request_identity_for_retry(self):
        p = module.Plugin()
        p.config = {'hosts': [{'id': 'fixture', 'name': 'Test'}], 'host': 'fixture', 'agent': 'dsh', 'session': 'test'}
        p.lock = asyncio.Lock()
        p.phase = 'idle'
        p.draft = '请继续检查'
        p.draft_target = ('fixture', 'dsh', 'test')
        p.draft_request_id = 'retry-fixture-1234'
        p.detail = AsyncMock(return_value={'messages': []})
        p._request = AsyncMock(side_effect=RuntimeError('offline'))
        with self.assertRaises(RuntimeError):
            await p.send_text(p.draft)
        self.assertEqual(p.draft, '请继续检查')
        self.assertEqual(p.draft_request_id, 'retry-fixture-1234')
        self.assertEqual(p.phase, 'idle')
