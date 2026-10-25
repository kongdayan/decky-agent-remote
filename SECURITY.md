# Security

The bridge can send instructions to an agent that has your account's filesystem and tool access. Pair only devices and networks you trust. DSH is required; Codex is optional. Neither adapter grants approvals automatically or bypasses the agent's permission settings.

- Keep DSH and Codex listening locally. Expose only this authenticated bridge.
- The default bridge bind is loopback. For another device, explicitly choose a LAN or VPN interface, or use an SSH tunnel / HTTPS reverse proxy. Tailscale is optional. Plain HTTP on a LAN does not encrypt tokens, voice or chat; use a trusted network or encrypted transport. Do not forward the bridge directly from the public internet.
- Every API request needs a random bearer token of at least 32 characters. Browser Origin requests and redirects are rejected. No CORS access is enabled.
- Bridge credentials live outside this repository. Deck pairing credentials stay in the Python backend's settings, mode 0600; they are never returned to the UI. Remove a lost Deck's token from the bridge config and restart it; re-pair trusted devices.
- Voice is recorded only after an explicit action, capped at 90 seconds, forwarded to your configured bridge, and deleted from temporary storage after processing. ASR runs locally on the bridge. The selected agent can send recognized text to its model provider under your existing DSH/Codex configuration.
- Recordings are cancelled on plugin unload. Interrupted temporary recordings are cleared on the next startup. Failed transcription cannot be recovered after deletion.
- Message retries with the same ID are deduplicated for the lifetime of the bridge process, up to 24 hours after completion. This is not a durable exactly-once guarantee across bridge restarts.
- Do not attach hosts.json, bridge.json, launch tokens, logs containing login URLs, personal chat screenshots, or model credentials to issues.

Report a vulnerability privately through GitHub's private vulnerability reporting if enabled, or contact the maintainer before publishing reproduction details. There is no hosted service or telemetry in this project.
