# Releases and Decky distribution

This project uses the official [Decky plugin template](https://github.com/SteamDeckHomebrew/decky-plugin-template) layout: main.py backend, plugin.json metadata, package.json version and dist/index.js frontend. The release ZIP wraps only runtime files in agent-remote/. Private settings live outside that directory.

Release checklist:

1. Update package.json version, bridge health version, CHANGELOG and validation evidence.
2. Run the documented checks with Node 24, inspect the staged diff and scan candidate source and packaged contents. Review every public image for personal information.
3. Push main and wait for verification CI. Tag the reviewed commit vVERSION. The tag workflow builds a draft Release with ZIP and SHA256.
4. Download the ZIP, verify its checksum and root layout, test installation and DSH voice/read/history, then publish the draft with honest validation notes.
5. Retain the previous Release for rollback. Never add a user's hosts.json, bridge.json, recordings or model weights to assets.

A public GitHub release can be sideloaded. Listing in the [Decky plugin database](https://github.com/SteamDeckHomebrew/decky-plugin-database) is a separate maintainer review: follow its current submission checklist and add/update the plugin submodule through a PR. This project does not claim store approval or inclusion. Recheck upstream requirements at submission time.
