# Interaction audit

Applied skill: mobile-app-ux-auditor. Target is Decky Quick Access on Steam Deck: controller-first, narrow, used while playing. Primary job: check what the remote DSH is doing and speak a new instruction with minimal navigation. Maturity: public preview. Risk: accidental recording, sending to the wrong host/session, missing replies, unreadable history.

| Priority | Flow / evidence | Impact | Implemented change |
| --- | --- | --- | --- |
| P1 | Prior voice controls and history opened different surfaces | Users cannot find the reply | One conversation home; fixed voice control; latest-reply anchor |
| P1 | First setup depended on a private hosts.json | New users cannot connect | Add/edit/test profiles in the Deck UI, password field, tokens backend-only |
| P1 | Recording waited for remote health | Held key feels unresponsive on slow links | Capture immediately after local validation; network work after release |
| P1 | Target changes during ASR can misroute a prompt | Wrong agent receives instructions | Lock target during capture, ASR and sending; bind draft to target |
| P1 | Release before start RPC resolves | Recording can continue unexpectedly | Push-to-talk state machine waits for start and stops exactly once |
| P2 | Every poll moved the transcript | Reading older replies interrupted | Follow latest only until the user scrolls up; visible new-reply button |
| P2 | Fixed MBA wording and truncated selectors | Confusing multi-machine experience | Generic execution-machine wording and below-label full-width selectors |
| P2 | Send errors lost the recognized instruction | User must repeat speech | Keep editable draft on failed dispatch; inline error and retry |

Before: open plugin → voice outside → another chat surface → find result. After: open → latest reply; hold / release → same transcript → result. Settings are only for changing machines, session, shortcuts or pairing.

Flow map: first open → add machine → verify/save → select/create DSH chat → conversation. Re-entry → remembered conversation and cached recent text → refresh. Voice → recording → ASR → dispatch (or preview) → remote active → reply. Offline → inline error → retry; recognized text retained on failed dispatch. Removal only removes the Deck profile after a confirmation.

Implementation uses @decky/ui Focusable / Button / TextField / DropdownItem and native Decky modals; no custom navigation stack. Conversation has a bounded scrolling region and a fixed footer. Critical errors are visible text and role=alert; state is expressed in words, not only color. Rear buttons are configurable because game mappings differ. Timestamps use the device timezone. There is no onboarding carousel, account signup, or required Tailscale installation.

Static skill scanner detected no known mobile framework signals; it cannot validate Decky controller behavior. Typechecking, state-machine tests, backend tests and a browser fixture supplement manual hardware checks. See VALIDATION.md for current evidence and limits. Screen-reader support, all Steam Input layouts and all SteamOS/Decky versions are not certified.
