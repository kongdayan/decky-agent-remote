#!/usr/bin/env python3
"""Rebuild and deploy this plugin. Invoke after leaving the running game."""
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile

root = Path(__file__).resolve().parent.parent
host = os.environ.get('DECK_SSH', '')
if not host or host.startswith('-') or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@._-' for c in host):
    raise SystemExit('Set DECK_SSH to your existing SSH alias or user@host')
subprocess.run(['pnpm', 'run', 'typecheck'], cwd=root, check=True)
subprocess.run(['pnpm', 'run', 'build'], cwd=root, check=True)
# Protect recording data and settings: only replace the plugin program directory.
with tempfile.TemporaryDirectory() as tmp:
    archive = Path(tmp) / 'agent-remote.tar.gz'
    with tarfile.open(archive, 'w:gz', format=tarfile.GNU_FORMAT) as tar:
        for name in ['main.py', 'plugin.json', 'package.json', 'dist', 'LICENSE', 'LICENSES', 'THIRD_PARTY_NOTICES.md']:
            tar.add(root / name, arcname=name)
    subprocess.run(['scp', '-q', str(archive), host + ':/tmp/agent-remote-update.tar.gz'], check=True)
    command = '''sudo -n mkdir -p /home/deck/homebrew/plugins/agent-remote && sudo -n chown deck:deck /home/deck/homebrew/plugins/agent-remote && tar -xzf /tmp/agent-remote-update.tar.gz -C /home/deck/homebrew/plugins/agent-remote && rm /tmp/agent-remote-update.tar.gz && sudo -n systemctl restart plugin_loader.service'''
    subprocess.run(['ssh', '-o', 'BatchMode=yes', host, command], check=True)
print('Plugin deployed. Open … → Decky → Agent Remote.')
