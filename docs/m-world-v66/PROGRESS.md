# M V66 — Coherent expressive presence

Status: implementation reviewed; 781 Node tests and 31 native Chrome checks passed.
Hosted checks/publication remain pending.
Base: V65 a32d3494fd41e31ccb3fa4334fe4d931e34dcaf6.
Branch: feat/m-expressive-presence-v66.

## Observable changes

- Physical energy now comes from M's existing fatigue/recovery, independent of visitor scroll pace. The decider, renderer and movement speed share it.
- Accepted activities produce one continuous intention, arousal, focus and valence. Short reflection/wake carry requires an acknowledged real successful outcome. Failure, cancellation and memory reset cannot invent progress.
- Seven existing secondary pose sources now feed one critically damped joint compositor with a total per-joint movement budget. Authored gestures, the preserved Swim clip and verified spatial contact retain ownership.
- The original ten-joint tail receives the same physical context. Tempo is integrated continuously; changing mood no longer multiplies absolute time. Focus, play and sleep use different restrained shapes and relaxation.
- Head attention dwells and follows moving targets smoothly, with rare bounded seeded glances. Contextual bilateral HAT blinks close quickly and reopen more slowly, respect target settling and explicit gestures, and use no new eye geometry or iris transforms.
- Existing happy/curious/surprised morph targets are mixed within one total weight budget, including during crossfades. Authored affect/expressions, sleep and reduced motion take priority.
- Autonomous scene look/rest holds respond to physical context within bounded durations. Manual/default scene timing and inspect-without-travel stay intact.

## Preservation

Original GLB chunks, detail maps, geometry, UVs, skin, 31 bones, 14 influences,
four skin sets, six clips, shoulder correctives and HAT eyes are unchanged.
No new network calls, provider/model/key/quota changes, Worker, Cron or service.
Portfolio content/design/navigation, Ask M, question-language rules and LinkedIn
privacy stay intact. Runtime cache revision advances together to 66.

## Validation and evidence

Immutable native V65 baseline: desktop 60.06 FPS / CPU p95 2.9 ms;
mobile emulation 60.05 FPS / CPU p95 4.3 ms. This does not show CPU saturation;
the compositor change addresses interpretation and joint safety, not a claimed
CPU bottleneck. GPU durations and physical-device Safari are not measured.

Workspace evidence: work/M_NextGen_V66 (outside the public repository).
Initial focused integration and complete-suite failures are preserved, including
old VM dependency/static-layer assertions. Updated contracts verify the shared
compositor ownership; no spatial pixel tolerance was relaxed.

Native capture review confirms preserved original facial detail/full silhouette
in the sampled rest/hop/thinking states. See VALIDATION.md for exact scope and
limits. No publication or production deployment is confirmed yet.
