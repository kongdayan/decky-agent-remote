# Public media

- conversation.png, recording.png, pairing.png: screenshots of the actual compiled plugin frontend rendered in the repository's browser preview, with synthetic messages and Decky UI/API shims. No personal chats, hosts or tokens. These are not photographs or native Steam client screenshots.
- hero.png: generated promotional illustration of a cased Steam Deck, invented display illustration; not a hardware photograph.
- steam-deck-case.png: generated device-frame illustration using conversation.png as a screen reference; not a physical-device photograph. Image generation can alter small text; conversation.png is the UI reference.

Generation used the built-in image_gen tool, not an API/CLI key. Prompts:

1. ads-marketing: landscape dark slate studio, subtle teal light, accurately proportioned Steam Deck in a matte fitted protective grip shell. Exact headline “Agent Remote”, subheadline “Hold to talk. Release to send.” Labels “DSH on your computer”, “LAN / VPN / optional Tailscale”, footer “Community project · Device illustration”. Dark right-side conversation panel over an original abstract low-poly game landscape. No personal data, provider logos, endorsements or metrics.
2. compositing / product-mockup: use conversation.png as the screen insert on a full cased Steam Deck, slight front perspective, slate studio background. Preserve the chat panel, Chinese text and blue button; fit excess empty space to the device aspect ratio. Outside text “Agent Remote” and “Screen preview · Device illustration”. No people, extra claims or personal information.

Reproduce the browser preview: `pnpm preview`, then open http://127.0.0.1:4177. F8 simulates the rear button in the demo only; no microphone is accessed. Do not point the demo at a real bridge.

## Historical v0.4.1 English outreach previews

conversation-en.png and recording-en.png are screenshots of the isolated browser preview at `?lang=en`, using the same compiled frontend with English translations applied by preview shims and synthetic conversation data. They are explicitly labeled English-localized previews. The v0.4.1 plugin used a Chinese UI and Mandarin ASR; these historical images did not demonstrate English-language product or speech support. Version 0.5.0 now ships actual product translations and per-request speech languages; the preview shim no longer translates UI strings.

conversation-en-social.png and recording-en-social.png use `?lang=en&layout=social` to center the panel so X gallery thumbnails keep the actual controls visible. The same preview/language disclosures apply.

## v0.5.0 Steam Deck captures

`steamdeck-conversation-en.png`, `steamdeck-conversation-zh.png`, `steamdeck-settings-en.png`, and `steamdeck-settings-zh.png` capture the real Steam Deck Steam/Decky renderer through its remote inspector screencast. The inspector frame remains visible. These are real on-device UI captures, not browser-preview translations or photographs of the hardware. The Steam shell remains in its own language; plugin language changes do not translate Steam controls or existing messages.

The conversations were created specifically for public screenshots. The latest assistant text is intentionally scripted demo copy, returned by the actual DSH session. It illustrates the interaction; the separate synthetic-WAV round trips in `../VALIDATION.md` verify ASR and real agent replies. No personal chats, private endpoints, home paths or pairing tokens are included.
