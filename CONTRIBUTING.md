# Contributing

Use Node.js 24.12+ (24 LTS), pnpm 10, Python 3.10+. `pnpm install --frozen-lockfile`, then `pnpm typecheck`, `pnpm test`, `pnpm build`, `python3 scripts/package.py`.

Keep DSH support first-class and network transports optional. Do not add real addresses, credentials, machine names, home paths or transcripts to fixtures. Use reserved example IP ranges and synthetic messages. Never commit local config or model files.

For UI changes, preserve one-page reading and recording, test controller focus and overflow at a narrow Quick Access width, and update the UX audit. Document actual hardware verification separately from browser previews. Include loading, offline, permission/error and retry behavior. A successful build is not hardware verification.

Before release, run `python3 scripts/check_public.py`, inspect the staged diff and ZIP, test a real DSH round trip, and update CHANGELOG plus the validation report. Tags `v*` build a draft GitHub Release; review its assets before publishing. A GitHub release is not approval by the Decky Store.
