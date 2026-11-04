# M V27 — Current implementation checkpoint

Repository: Ricardo19-Deve/ricardo19-deve.github.io
Remote: https://github.com/Ricardo19-Deve/ricardo19-deve.github.io.git
Branch: feat/m-living-routines-v27
Base: published V26 main d66774831a5777cb366c05c5b7381dace78ae46a.
Target: original M on desktop/mobile web; Godot not applicable.
Owner authorized implementation. New merge/publication/Worker update not yet approved.

## User priorities

First fix the response box collapsing to a single line and the horizontal scrollbar.
Then give M more autonomous life, expressions, thinking, sleep, hopping and ballplay.
Preserve original model/rig/materials, portfolio design/content/navigation and API model/key/quotas.

## Completed implementation

- Readable conversation first in a scrollable panel body, fixed header/composer,
  long-word wrapping, start-of-answer focus and bounded visualViewport keyboard layout.
  Existing Enter/Shift+Enter, optional gestures/story, drafts, motion and reset kept.
- Original-rig sleep12.4 s, hop3.5 s, think4.2 s and paw3.2 s; new pondering/dozing/joyful
  blends use original morphs. Sleep closes original HAT lids and wakes progressively.
  Hop has a bounded lift included in actual pose/camera bounds and resets to neutral.
- Opt-in utility candidates use energy, play/curiosity needs and a 90s nap urge.
  Only actual successful sleep resets the need; failures/proposals/reset do not.
  Manual/reading/typing/scroll/reduced-motion/ownership guards remain authoritative.
- Three actual paw cycles drive a small shaded floating-ball prop. Contact is anchored
  to the projected original Hand bone; curved return, gaze, side and inter-rally holds
  stay coordinated. The conservative flight planner protects text, header and viewport.
  Layout changes or unavailable space cancel cleanly; no input is needed for autonomous play.
- Strict event interpretation and Portuguese wording guide AI narration. The active
  card is never evidence of a past discovery location. Explicit navigation intent is
  required for section suggestions in both schema and validated output. Reply text
  quality still needs representative real-provider review after an approved deployment.
- Frontend cache31. Original binary/model/textures/skinning/correctives unchanged.

## Executed checks

- Full Node suite 481/481 passed after integration and the two identified ball fixes.
- Companion unit checks 31/31; isolated production CSS/companion native layout 42/42.
  Long700-character ordinary/unbroken replies have no horizontal overflow.
  Visible log: desktop280 px, mobile240 px,320 x 568 small mobile192 px, simulated keyboard160 px.
  Composer/Send remain hit-testable and replies begin at their first line.
- New acting/affect 23/23 focused tests; autonomy 29/29; pure ball 12/12 with25,005
  safe-arc samples; actual ball/controller 31/31 after held-prop/lease fixes.
- Backend targeted68/68 offline checks; no paid provider calls.
- Wrangler 4.135.0 dry-run succeeded45.28KiB/gzip13.07KiB; no deployment or secret read.
- Whole-app native evidence is complete. First run 35/37 (desktop 19/19); the
  mobile helper omitted expressionHold from its waiting condition. Fixed only
  that harness predicate; affected mobile interactions 10/10 passed in a separate
  run. Natural desktop recorded 1594 samples/zero inputs, actual ball3taps,
  bilateral sleeping lids and hoplift 0.1599. Thinking verified diagnostically.
- Original331 video frames encoded successfully and decoded in Chrome; no repeat
  capture. All screenshots reviewed. VALIDATION.md and NATIVE_SUMMARY.json contain
  exact scopes, separate-run counts and limits.

## Current ownership / resume

Root owns scroll-buddy.js, m-world-3d.mjs, full integration/review/docs/cache and
existing controller fixtures. All agents have completed/stopped edits. Root finalized the mobile harness
wait and video encoding using existing frames. Keep
current uncommitted work. No PR yet; do not create a duplicate or implement on main.
If native defects appear, identify cause and repeat only the affected diagnostic.
Do not claim artistic completion until screenshots/video are viewed.

## Pending

Native review and evidence packaging are complete. Inspect final diff, commit/push
feature branch, create PR and await all hosted checks.
Only then request explicit approval for that concrete new publication. Preserve
live autoplay=true on any approved Worker rollout (source historical default=false).
Physical phones/Safari/real keyboard/OS background transitions remain untested.
The ball is an authored floating prop, not a general rigid-body physics engine.
