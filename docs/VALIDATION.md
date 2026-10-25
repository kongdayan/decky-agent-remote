# Validation — 0.5.0

Measured on 2026-10-25. This is a public preview, not a claim of certification across SteamOS releases.

| Layer | Evidence | Result |
| --- | --- | --- |
| Frontend | TypeScript strict typecheck and Rollup build, Node 24.21.0 / pnpm 10.19.0 | Passed |
| Behavioral tests | Node tests: history filtering/cursors, full replies, simplified output, bearer auth, browser-Origin rejection, concurrent message deduplication, PTT races | Passed |
| Backend tests | Python async tests: reply detection when polls miss active state, no stale-reply toast, pairing privacy / mode 0600 / failed-connection persistence / target lock | Passed |
| Real Deck → bridge → DSH | Synthetic Mandarin and English WAVs sent from Steam Deck over a temporary LAN listener; whisper.cpp local ASR; recognized instruction dispatched to a new real DSH session; reply read through history | Mandarin: ASR 2.08 s / round trip 4.21 s / reply “连接正常。”; English: 2.32 s / 4.42 s / “connection verified”; auto-detect English: 2.88 s / 4.98 s / “connection verified”. Each produced 2 history messages; all 3 test sessions archived and temporary listener closed |
| Transport independence | Same hardware round trip used LAN HTTP, not Tailscale | Passed; HTTP trust/encryption limits documented |
| Native Deck UI | Real Steam/Decky renderer through inspector screencast: Chinese ↔ English switch immediately; speech choice saves independently; English survives Decky restart; all 4 rear-button choices remain; conversation switch and reply/history display work; dialog footer fits above Steam hints | Passed; dedicated public demo chats only; captures include the inspector frame |
| Browser UI | Compiled plugin rendered with isolated Decky UI/API shims and synthetic messages; recording, transcription, reply in same view; fixed footer; settings and masked token field | Passed in preview; screenshots labeled synthetic |
| Internationalization | 14 Node + 7 Python tests, including catalog coverage, instant locale switching, preserved message text, safe upgrade defaults, persisted language preferences, busy-state locks, recording-language snapshot, per-request ASR language validation and English API errors | Passed |
| Publication | Allowlisted runtime ZIP, pattern-based source guard, manual image review | See release checksums and CI |

Previous local prototype verification included physical Deck microphone input and Mandarin ASR. This release's measured voice test uses a synthetic WAV: it verifies transport, ASR and DSH, not microphone acoustics. Final physical rear-button interaction and in-game focus on every mapping have not been re-certified after this release. The shims do not prove Steam's exact CSS or controller behavior.

Not verified: all SteamOS/Decky versions; every Steam Input layout; screen-reader support; Windows bridge; public reverse-proxy deployment; agent permission approval from Deck. Speech recognition can misrecognize short phrases; automatic language detection needs enough audio. Tailscale is an optional transport, not a prerequisite. DSH prerelease RPC compatibility requires rechecking on DSH updates. Deduplication is memory-only and resets on bridge restart.
