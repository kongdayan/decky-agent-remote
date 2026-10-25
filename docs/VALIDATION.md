# Validation — 0.4.0

Measured on 2026-10-25. This is a public preview, not a claim of certification across SteamOS releases.

| Layer | Evidence | Result |
| --- | --- | --- |
| Frontend | TypeScript strict typecheck and Rollup build, Node 24.21.0 / pnpm 10.19.0 | Passed |
| Behavioral tests | Node tests: history filtering/cursors, full replies, simplified output, bearer auth, browser-Origin rejection, concurrent message deduplication, PTT races | Passed |
| Backend tests | Python async tests: reply detection when polls miss active state, no stale-reply toast, pairing privacy / mode 0600 / failed-connection persistence / target lock | Passed |
| Real Deck → bridge → DSH | Synthetic Mandarin WAV sent from Steam Deck over a temporary LAN listener; whisper.cpp local ASR; recognized instruction dispatched to a new real DSH session; reply read through history | ASR 2.24 s; round trip 4.4 s; reply “连接正常”; 2 history messages; test session archived and temporary listener closed |
| Transport independence | Same hardware round trip used LAN HTTP, not Tailscale | Passed; HTTP trust/encryption limits documented |
| Browser UI | Compiled plugin rendered with isolated Decky UI/API shims and synthetic messages; recording, transcription, reply in same view; fixed footer; settings and masked token field | Passed in preview; screenshots labeled synthetic |
| Publication | Allowlisted runtime ZIP, pattern-based source guard, manual image review | See release checksums and CI |

Previous local prototype verification included physical Deck microphone input and Mandarin ASR. This release's measured voice test uses a synthetic WAV: it verifies transport, ASR and DSH, not microphone acoustics. Final physical rear-button interaction and in-game focus on every mapping have not been re-certified after this release. The shims do not prove Steam's exact CSS or controller behavior.

Not verified: all SteamOS/Decky versions; every Steam Input layout; screen-reader support; Windows bridge; public reverse-proxy deployment; agent permission approval from Deck. Mandarin ASR can misrecognize short phrases. Tailscale is an optional transport, not a prerequisite. DSH prerelease RPC compatibility requires rechecking on DSH updates. Deduplication is memory-only and resets on bridge restart.
