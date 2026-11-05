# M World V34 — lived world discoveries

## Goal
Turn one source-verified Wikipedia topic into a **truthful, autonomous, three-beat experience**: M notices it, explores her surroundings, then reflects. Progress is **not** driven by elapsed time or page load; only actions confirmed by the original V6 movement controller can advance it.

## Implemented
- `m-world-lived-stories.mjs`: a fully local state machine with three phases (**notice → explore → reflect → complete**). Each phase only accepts whitelisted, genuinely successful autonomous action families. Failed/aborted/cancelled actions cannot be rewritten as achievements. Date changes cannot complete yesterday's story.
- Bounded thematic motivation: source-verified topic and current story phase gently influence scoring in `m-world-world-rhythm.mjs`. The original safety checks for reading, scrolling, hidden page, reduced motion and action availability still own the final decision. The character is not assigned mandatory tasks or a deterministic route.
- The existing, collapsed **M's discovery today** area in Ask M now shows one short narrative sentence that changes only after completed actions. The article title and attribution still come from V33; narrative sentences are original, accurately describing M's activity, not Wikipedia facts invented by the AI.
- Persistent journal holds **only dates and whitelisted topic categories** for up to 10 completed days. No visitor identifiers, URLs, messages, page text, Wikipedia prose, location or remote storage. Disabling **Remember M** or using Reset immediately clears the V34 key. With Remember disabled, the story can still progress during the current tab session without being saved.
- Retains M's original 31-bone rig, physical V32 sleep, V30 card depth, V33 daily feed, existing AI Worker, D1 analytics Worker, and API budgets.
- Cache revision 39 and dedicated tests cover source validation, real completion, consent revocation, stale feed, corrupted storage and non-coercive decisions.

## What this is — and isn't
M is developing an **experience-based local narrative and habits**, with an externally sourced theme. This is meaningful character continuity but **not** independent model weight training, independent unrestricted browsing, or collective memory across visitors. The Wiki article is an attributed third-party source, not independently fact checked.

## How to verify
1. Confirm today's `data/m-world-daily.json` exists (V33 daily job).
2. Open the portfolio with `?m-debug=1` and inspect `MWorld.snapshot().character.worldStory` for `phase`, `step` and `adventures`.
3. Let M complete autonomous actions. A story moves through three stages only on compatible, successful actions; a cancelled animation must never advance it.
4. In **Ask M → M's discovery today**, inspect the source and small evolving narrative.
5. Disable Remember M → verify the `m-world-lived-stories-v34` key is gone and no saved journal is shown.
6. Check original M movements and card text masking visually on desktop/mobile. Automated checks don't prove real 3D motion quality.

No Cloudflare-side action or secret configuration is required.
