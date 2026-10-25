# Changelog

## 0.5.0 — 2026-10-25

- Ship real English and Simplified Chinese UI, including settings, notifications and owned errors; preserve chat text.
- Independently save UI and speech languages; choose Mandarin, English or auto-detect. Snapshot the speech language when recording starts.
- Remove the forced Mandarin prompt and Chinese normalization for English / automatic speech.
- Identify DeepSeek Harness by its full name in the plugin and public introduction.
- Replace preview-only translation shims with the shipped product translations.
- Verify Chinese, English and auto-detect audio from a real Deck through local Whisper and real DSH replies; see validation details.

## 0.4.1 — 2026-10-25

First public release. Includes bundled dependency licenses and attribution.

### Changes since the local prototype

- Open directly into the remembered conversation; latest replies, history and voice share one page.
- Hold a configurable rear button to talk; release to transcribe and send. Short press opens the conversation. Optional preview before sending.
- Start recording without waiting for a network round trip. Preserve recognized text when sending fails.
- Add, test, edit and remove machine profiles from the plugin. Tokens stay in the backend.
- DSH remains required; Codex is an optional adapter. LAN, HTTPS, tunnels and Tailscale are configurable transports.
- Cross-platform bridge command defaults, private configuration generator, allowlisted Decky ZIP packaging, security docs and CI.

## 0.3.0

Local prototype: unified transcript and push-to-talk, full history, ordinary Mandarin ASR and reply notifications.
