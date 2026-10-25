# Setup and operation

## Requirements

- Steam Deck / SteamOS with Decky Loader. Tested baseline: Decky 3.3.0. `pw-record` must be available with a working PipeWire microphone.
- A separate macOS or Linux execution machine with Node 24.12+ (24 LTS), pnpm 10, a running DSH Web service, and your own DSH model credentials. Tested DSH adapter: `@deepseek-ai/dsh` 0.2.0-rc.2. It uses DSH's local Web RPC, which can change between prereleases.
- Voice: ffmpeg, whisper.cpp's `whisper-cli`, and a compatible local ggml model. Install from their official projects / your package manager. Models are not included. Mandarin transcription and simplified Chinese are currently the supported voice defaults.

## 1. Execution machine

```sh
git clone https://github.com/kongdayan/decky-agent-remote.git
cd decky-agent-remote
corepack enable
pnpm install --frozen-lockfile
node bridge/configure.mjs --bind 192.0.2.10 --model /path/to/ggml-model.bin --workspace /path/to/workspace
pnpm bridge
```

`192.0.2.10` is a documentation address: replace it with the machine's actual reachable LAN or VPN IP. Default bind without `--bind` is loopback, suitable for a tunnel or reverse proxy. The generator creates `~/.config/decky-agent-remote/bridge.json` with a random token and mode 0600. It refuses to overwrite an existing file. Read the token locally and paste it directly into the Deck plugin, never an issue or screenshot.

DSH must already be installed, logged in and serving its Web RPC. The bridge does not install DSH, alter its credentials, or require Pocket. By default it connects to `http://127.0.0.1:3080`, discovers the current launch token from the local `~/.dsh/logs/web*.log`, and reads the local archive registry. Override `dshUrl`, `dshHome` and `dshTokenFile` in the private bridge config, or set `DSH_LAUNCH_TOKEN` in the service environment. `dshTokenFile` contains only the DSH launch token. Keep it mode 0600. The launch token is exchanged for a local session cookie; none of it is returned to Deck.

Optional config fields: `ffmpeg` and `whisper` for executable paths (default PATH lookup), `model`, `workspace`, `codexSocket`. A missing model permits reading and text sending, but voice transcription will fail until configured. Optional Codex requires an existing shared app-server Unix socket; it is not started by the bridge. Saved desktop chats can be read but cannot always be sent to when held by a different server. Use a new remote chat or load it on the shared server. Approvals stay on the execution machine.

## 2. Install Deck plugin

Download `agent-remote-vVERSION.zip` from [Releases](https://github.com/kongdayan/decky-agent-remote/releases), verify the accompanying SHA256, and install through Decky's developer ZIP install option. Menu wording varies by Decky version. The ZIP has one root folder `agent-remote/`. Restart Decky if the new plugin does not appear. This is a GitHub sideload release; it is not yet listed in the Decky Store.

For development, `pnpm build && python3 scripts/package.py` creates the same allowlisted ZIP. `DECK_SSH=your-alias python3 scripts/deploy.py` builds and deploys over SSH, requiring an already configured key and noninteractive sudo. It restarts all Decky plugins; do this after leaving games and recordings.

## 3. Pair and use

Open **… → Decky → Agent Remote → 添加执行机器**. Enter a name, bridge URL and its token, then **连接并保存**. The connection is checked before saving. Select DSH, select or create a session. It remembers this selection.

- Open the panel: see the latest reply immediately, with the conversation above it.
- Hold R4 (default) for at least 300 ms: start talking. Release: recognize and send to the selected session. A short press opens the panel without recording.
- In the panel, use X or the bottom button to start / stop. No second chat page.
- Scroll up for history; **有新回复 · 回到最新** returns to new content without interrupting reading.
- Switch rear buttons, disable the shortcut, or turn off automatic sending in settings. Preview mode lets you edit recognized text before sending.
- A toast announces a completed reply in the background. Open the panel to read the full reply.

Reserve the chosen rear button in your Steam Input layout to avoid also triggering a game action. Game-specific mapping and firmware can affect rear-button input; test it before relying on it in a game. The plugin never changes a game's controls automatically.

## Network choices

| Connection | Bridge bind / URL | Notes |
| --- | --- | --- |
| LAN | Machine's LAN IP / `http://LAN_IP:18765` | Same trusted network; HTTP is unencrypted |
| Tailscale (optional) | Machine's Tailscale IP / its reachable URL | Both devices in your tailnet; limit access with ACLs |
| Other VPN | VPN interface IP | No Tailscale-specific dependency |
| SSH tunnel | Loopback bind; Deck forwards a local port | Keep the tunnel alive; use loopback URL on Deck |
| HTTPS reverse proxy | Loopback bind behind your proxy | Valid TLS certificate, pass Authorization, allow 10 MiB audio and 210s requests; no browser CORS needed |

## Updates, recovery and removal

Install a new ZIP over the existing plugin. Settings are outside the plugin directory and remain. SteamOS / Decky updates can change controller/UI APIs; keep a known working release ZIP to reinstall. Back up private settings yourself if desired; do not upload them publicly.

For errors: confirm DSH works locally first; verify bridge process, bind and firewall; re-copy the token after 401; configure model/PATH after voice failure; check PipeWire input after mic failure. Reading old messages is cached in memory during transient disconnection. Recognized text is retained after a send error; retry only once you understand the remote result (bridge restarts reset deduplication). An app/Decky restart clears unsent text.

Remove the plugin through Decky. Stop the bridge process/service on the execution machine. Delete private bridge config / Deck settings only if you intend to revoke and remove pairing. No system service is installed by the repository itself; use your normal systemd user service or macOS LaunchAgent process supervision, with absolute Node and script paths and a private environment.
