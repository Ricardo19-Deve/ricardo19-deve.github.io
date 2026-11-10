# V66 validation

Repository: Ricardo19-Deve/ricardo19-deve.github.io.
Branch: feat/m-expressive-presence-v66. Base: a32d349 (V65).
Target: original M in desktop/mobile web; Godot is not applicable.

## Executed checks

- 781/781 Node regression tests passed after independent integration review.
- 31/31 isolated native Chrome checks passed on Intel Arc 140T / D3D11.
- All 19 original GLB chunks and 10 detail maps match immutable V65 SHA256.
- 199 source files had the same manifest at native capture start/end:
  b474646a2037970bd75330bf745af6ad7a1cf40f255a9e629634bdd1c68fdcbb.
- Original 31 bones / 10 tail joints / 14 influences / 4 skin sets / 10 maps / 6 clips verified.
- Original sleep/hop/think actually entered their action phase and completed;
  rendered alpha was positive and canvas-edge alpha zero in those samples.
- Desktop 120 seconds and mobile 35 seconds were observed without inputs. Desktop
  completed 10 actions with 0 failures; reflection followed actual completion and
  wake followed completed sleep. Mobile completed 4 actions with 0 failures.
- No rejected facial blend, JS/asset error or real paid provider request.
- Single launcher, Enter submission, readable long response, click hit tests and
  reduced-motion visible neutral actor passed on desktop/mobile emulation.

## Performance comparison

Six-second warm native RAF windows, same original model and hardware. No video
or profiler ran during measurement. These short windows do not prove a lasting
CPU speedup, a GPU time reduction or absence of a memory leak.

| Profile | V65 FPS | V66 FPS | V65 CPU p95 | V66 CPU p95 |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 60.06 | 60.07 | 2.9ms | 2.6ms |
| Mobile emulation | 60.05 | 60.09 | 4.3ms | 2.7ms |

Both: 11 draw calls / 155022 triangles per frame. Desktop 544px and mobile 416px canvas.

## Depth and visual evidence limits

Labelled frozen production-plan/behind samples were fully hidden at the tested
card point, with protected alpha 0. The forced-front diagnostic had 22358 visible
pixels; its deliberate depth override is not a safe autonomous route proof.
Blank alpha 0 and 4 project-link hit tests passed. This does not claim every route,
layout or compositor is identical or that screenshot RGB is raw-buffer fidelity.

Workspace evidence (outside the public repository):
work/M_NextGen_V66/validation-initial/report.json; original-model desktop/mobile
PNG captures; desktop-natural-trace.json and mobile-natural-trace.json;
desktop-diagnostic.webm (25.1s / 696 frames, explicit sleep/hop/think, separate from
zero-input evidence). Baseline evidence is in the adjacent baseline directory.

The small cyan rectangle beside Send in the immediate mobile screenshot
disappeared after 1500ms with the same DOM styles and focus. A separate bounded
UI follow-up supports a transient Chrome tap highlight, not a persistent panel
or renderer element; settled/blurred captures are clean. No source change needed.
Physical iPhone/Safari, real keyboard/IME/background/resume, weak hardware,
GPU durations, long-term resource trends and live provider behavior are unverified.
No backend, model, key, quota, Worker or deployment workflow change is required.

## Changed systems

Controller and renderer integration; new pure character-state/attention/secondary-
pose modules; original motion-v8/tail-v15 and backward-compatible relative HAT
blink API; bounded scene holds; normalized face crossfades; regression fixtures.
Remaining import/entry changes advance the canonical runtime cache to 66.
The GLB, detail maps, site content/design/navigation and backend are unchanged.

## Next highest-value work

1. Author additional original-rig contact/locomotion performances and transitions,
   judged in real motion rather than independent maximum poses.
2. Extend actual episodic preferences/goals across adventures with explicit
   completed-outcome receipts, preserving privacy and narrative grounding.
3. Profile physical Safari and weaker mobile GPUs over longer sessions before
   adding visual complexity; measure GPU time and resource trends separately.

Suggested commit: feat(m): coordinate autonomous intent and original-rig presence.
Publication: not confirmed; inspect the concrete PR and all required hosted checks.
