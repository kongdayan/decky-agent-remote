# Agent Remote for Decky

Talk to **[DeepSeek Harness (DSH)](https://www.deepseek.com/en/harness/) agents on your computer** without leaving Steam Deck Gaming Mode. Open one panel to read replies, hold a rear button to speak, release to send. Execution and speech recognition run on your computer.

[中文说明](README.zh-CN.md) · [Install & configure](docs/SETUP.md) · [Security](SECURITY.md) · [Contribute](CONTRIBUTING.md) · [Releases](https://github.com/kongdayan/decky-agent-remote/releases)

![English UI running on a real Steam Deck, captured through its inspector](docs/media/steamdeck-conversation-en.png)

[中文实机界面](docs/media/steamdeck-conversation-zh.png) · [English language settings on Deck](docs/media/steamdeck-settings-en.png)

These are real Deck Steam/Decky renderer captures through remote inspection, with a dedicated public demo conversation. [Media provenance](docs/media/README.md).

## The interaction

**Open → latest reply. Hold → talk. Release → send.** Chat history and the microphone stay on the same page. The panel remembers the selected machine and session; background notifications lead back to the full conversation. No terminal runs on Deck.

- DSH session list, full replies, paginated history and new sessions.
- Multiple execution machines, configured directly in the plugin.
- R4 / L4 / R5 / L5 push-to-talk, X / touch controls, optional review before sending.
- English and Simplified Chinese UI, switched instantly in settings.
- Local whisper.cpp speech: Chinese (Mandarin), English, or automatic language detection. UI and speech languages are independent. Chinese mode outputs simplified Chinese.
- Optional Codex app-server adapter. DSH is always enabled.
- LAN, HTTPS, SSH tunnels or a VPN. **Tailscale is optional.**

## Get started

1. Run the bridge on your DSH machine: Node 24 LTS, DSH Web, and optional ffmpeg + whisper.cpp for voice.
2. Install the release ZIP through Decky's developer install option.
3. Add the machine URL and generated token in Agent Remote. Choose a DSH session and talk.

Follow the [complete setup guide](docs/SETUP.md) for actual commands, network choices and troubleshooting. Credentials and models are configured locally and are never bundled. Use an encrypted/private transport; the bridge has remote agent access. Read [the security boundary](SECURITY.md).

Language settings: open the conversation header, choose **Interface language → English / 简体中文**, then **Speech language → Chinese (Mandarin) / English / Auto-detect**. No restart is needed. Chat messages remain in their original language. Use a multilingual Whisper model for both languages; English-only `.en` models cannot recognize Chinese.

## Status and limits

Public preview, version 0.5.0. Built from the official Decky plugin template under BSD-3-Clause. GitHub sideload distribution; no Decky Store approval is claimed. DSH adapter tested against 0.2.0-rc.2; its prerelease RPC can change. Codex desktop chats owned by another app-server may be read-only. Approval prompts must be handled on the execution machine. The shipped UI supports English and Simplified Chinese. Upgrades preserve the previous Chinese / Mandarin defaults; choose English explicitly in settings.

See [validation](docs/VALIDATION.md) for measured checks and untested cases, and [UX audit](docs/UX-AUDIT.md) for interaction decisions. The new Steam Deck captures use dedicated demo conversations. Historical browser previews and device-frame artwork are labeled separately in the media notes.

## Development

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
python3 scripts/check_public.py
python3 scripts/package.py
```

[Changelog](CHANGELOG.md). Steam Deck, Decky, DSH, DeepSeek and Codex belong to their respective owners. This is an independent community project.
