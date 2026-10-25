# Third-party notices

Agent Remote's own code is BSD-3-Clause (LICENSE). Components retain their original licenses:

- `@decky/api` 1.1.3 — LGPL-2.1, copyright Decky Loader contributors. The frontend bundles this adapter. Full license: LICENSES/decky-api-LGPL-2.1.txt. Matching source: https://github.com/SteamDeckHomebrew/decky-frontend-lib and the npm package's src/; the exact version is locked in pnpm-lock.yaml. Build the frontend from published source with pnpm install --frozen-lockfile && pnpm build. You may rebuild/replace the adapter; this project imposes no restriction on reverse engineering for debugging modifications to it.
- `@decky/ui` — LGPL-2.1, supplied by Decky at runtime rather than bundled. Its source is in the same upstream repository.
- `react-icons` 5.7.0 — MIT, copyright Goran Gajic and contributors. Full wrapper license: LICENSES/react-icons-MIT.txt. The used FaSatelliteDish glyph is Font Awesome Free by Fonticons, Inc., licensed CC BY 4.0: https://fontawesome.com/license/free and https://creativecommons.org/licenses/by/4.0/. It is used unchanged through react-icons.
- `tslib` — 0BSD, copyright Microsoft Corporation. Full license: LICENSES/tslib-0BSD.txt.
- `ws` — MIT; `opencc-js` — Apache-2.0, with its own dictionary notices. These bridge dependencies are installed through npm and are not vendored in the plugin ZIP. Retain their packaged LICENSE and THIRD_PARTY_LICENSES files when redistributing them.
- React / ReactDOM are supplied by Steam/Decky in the plugin and MIT-licensed development dependencies for the browser preview.

The project is based on the official Steam Deck Homebrew Decky plugin template; its original BSD notice is retained in LICENSE. No affiliation or endorsement is implied. Generated promotional device artwork is identified separately in docs/media/README.md.
