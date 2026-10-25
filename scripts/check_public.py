#!/usr/bin/env python3
"""Conservative publication guard, supplementing human review and GitHub secret scanning."""
from pathlib import Path
import re
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
patterns = {
    'personal home path': re.compile(r'/(?:Users|home)/[a-zA-Z][\w.-]+/(?!homebrew/)'),
    'private IPv4 address': re.compile(r'\b(?:192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)\b'),
    'private key': re.compile(r'-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----'),
    'provider token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,})\b'),
    'long literal secret': re.compile(r'''["'](?:token|password|apiKey|api_key)["']\s*:\s*["'][A-Za-z0-9_./+=-]{32,}["']'''),
    'tailnet identity': re.compile(r'\b[a-z0-9-]+\.[a-z0-9-]+\.ts\.net\b'),
}
failures=[]
for name in files:
    if not name:continue
    p=root/name
    if not p.is_file():continue
    if p.name in ('hosts.json','bridge.json') or p.suffix in ('.wav','.bin','.pem','.key') or name.startswith(('.private/','.codex-schema/')):
        failures.append((name,'private runtime file'));continue
    try:text=p.read_text()
    except UnicodeDecodeError:continue
    text=text.replace('/home/deck/', '/DECK_HOME/')
    for label,pattern in patterns.items():
        if pattern.search(text):failures.append((name,label))
for archive in (root/'release').glob('*.zip'):
    with zipfile.ZipFile(archive) as package:
        for item in package.infolist():
            if not item.filename.startswith('agent-remote/') or '..' in Path(item.filename).parts:
                failures.append((archive.name, 'unsafe archive layout'))
            try:text=package.read(item).decode().replace('/home/deck/', '/DECK_HOME/')
            except UnicodeDecodeError:continue
            for label,pattern in patterns.items():
                if pattern.search(text):failures.append((archive.name+':'+item.filename,label))
for name,label in failures:print(f'{name}: {label}', file=sys.stderr)
if failures:raise SystemExit(1)
print(f'Publication guard passed: {len(files)-1} candidate files; no matched secret or personal endpoint patterns. Review images and diff separately.')
