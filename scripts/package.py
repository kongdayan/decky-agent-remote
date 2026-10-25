#!/usr/bin/env python3
"""Package only runtime files. No settings, recordings, models or bridge credentials."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
files = [root / n for n in ('main.py', 'plugin.json', 'package.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md')]
files += sorted((root / 'dist').glob('**/*'))
files += sorted((root / 'LICENSES').glob('**/*'))
files = [p for p in files if p.is_file()]
if not (root / 'dist/index.js').is_file():
    raise SystemExit('Run pnpm build first')
output = root / 'release'
output.mkdir(exist_ok=True)
archive = output / f'agent-remote-v{version}.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for file in files:
        entry = zipfile.ZipInfo('agent-remote/' + file.relative_to(root).as_posix(), (1980, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        z.writestr(entry, file.read_bytes())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(archive.with_suffix('.zip.sha256')).write_text(f'{digest}  {archive.name}\n')
print(archive)
print(f'SHA256 {digest}')
