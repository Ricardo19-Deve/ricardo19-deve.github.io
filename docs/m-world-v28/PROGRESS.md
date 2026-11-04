# M World V28 — Presence, focus and adaptive performance

## Branch checkpoint
- Branch: `feat/m-world-v28-presence-performance`
- Base: published V27 merge `2d9a994b4c72d632cda078d12ea75fd78602bb3b`.
- Integration: code committed to isolated feature branch, pending PR, CI and visual review.
- Publication: **not authorized**. No live site merge, Cloudflare Worker modification, secrets access or paid API calls.

## Implemented
1. **Original-rig continuity.** `m-world-dynamics.mjs` filters gaze, velocity and connected-tail drive with half-life smoothing, so rapid hover/scroll and stop/start transitions do not snap head/body signals. A calm mode and immediate reduced-motion neutral reset are authoritative. No new bones, meshes, GLB, textures or facial morphs.
2. **Facial continuity.** `m-world-face-continuity.mjs` crossfades only the original V6 happy/curious/surprised morphs and HAT eyelids between autonomous affects. Manual gestures immediately take precedence; reduced motion instantly neutralizes stored blends.
3. **Adaptive rendering.** `m-world-quality.mjs` starts at the original V27 high-quality pixel ratio, uses a sustained slow-frame threshold and large recovery hysteresis to step resolution down on constrained devices and back up when frame pacing stabilizes. The same original high-quality assets, PMREM and 31-bone skin are kept; no device fingerprinting, telemetry or new dependency.
4. **Context-aware curiosity.** The local autonomy scheduler can gently prefer a safely available visible card receiving real mouse or keyboard focus. Reading, typing, reduced motion, explicit interaction, spatial protection, ongoing intentions and card/action quotas continue to outrank autonomous choice.
5. **Cache revision.** Main entry points load V28 modules with `v=32` to prevent clients from retaining the old runtime after a future approved merge.
6. **Automated regression tests.** New Node tests cover 30/60/120 Hz smoothing, finite bounds, reduced-motion and gesture resets, facial crossfades, quality hysteresis, attention weighting and integration invariants. GitHub Actions confirmed **493/493 passing, zero failures** on code head `5562eee7d574a13bb0b4f0f4fbf9f0235ac1facc`.

## Preserved contracts
- Original 16,899,868-byte V6 model and 19 asset chunks, all 31 bones, 14 skin influences and textures unchanged.
- Existing real WebGL depth masks, spatial plans and protected text/control rectangles unchanged.
- Existing local character journal and optional OpenAI director; same Worker/model/key/limits. V28 adds no remote calls.
- Explicit visitor gestures and keyboard access retain priority.

## Validation and limitations
- Hosted CI on the V28 implementation head passed 493/493 Node tests (including production integration); a documentation-only update does not replace visual QA.
- The local connector can inspect source, commit and CI, but does **not** provide a native Chrome WebGL rendering environment in this chat. New V28 animations must be watched in desktop Chrome and physical iPhone/Safari before artwork is declared final.
- GPU measurements, pixel-level clipping, real keyboard, browser background/resume, real AI text and live Worker deployment were **not** independently retested here.
- The original V27 action library, authored story, perception and card-depth algorithms remain in place. V28 improves their motion continuity and prioritization; it is **not** a physics engine or unconstrained general intelligence.

## Before any publication
Review feature diff and all hosted checks, run native visual QA for slow/fast devices and both depth directions, then request explicit owner approval to merge. No Worker deployment is required for the new purely client-side V28 code; do not alter the Worker unless a separate approved fix is needed.
