# M World V21 — Validation

Validated on 31 October 2026, against the local feature branch. The public website has not been deployed by this work.

## Executed checks

- 128 Node regressions passed, with no skipped tests.
- 29 actual Chrome checks passed, including original-model loading, all ten detail maps, full skinning, real touch and keyboard navigation, CSS geometry alignment, pause/resume without model downloads, autonomous routes, live perching during scroll, GPU depth occlusion and protected reading areas.
- Chrome 156.0.8078.73 used the desktop Intel Arc GPU. Desktop: 1280 x 900 at DPR 2. Mobile: a separate 390 x 844 context at DPR 2 with isMobile and touch enabled.
- Screenshots were visually inspected. The mobile intro shows the whole actor, including toes and tail. The desktop perch places the feet on the component edge; the behind view reveals the actor at the real photo border.

| Measurement | Desktop | Mobile emulation |
| --- | ---: | ---: |
| Warm browser cadence | 60 FPS | about 60 FPS |
| Canvas framebuffer | 544 x 544 | 416 x 416 |
| Render calls in measured hero frame | 12 | 12 |
| Resident renderer textures | 32 | 32 |
| Chrome JavaScript heap, excluding GPU/system memory | 90.7 MB | 92.1 MB |
| Mascot encoded payload, including detail maps | 19,373,678 bytes | 19,373,678 bytes |
| Card-interior pixels changed by front/behind depth | 17,900 | 6,103 |
| Residual actor pixels in occluded card interior | 0 | 0 |

An additional real mobile production trace used an external viewport corridor: its depth target changed with zero card overlaps before returning to reveal the face. Card masks also follow finite CSS transform transitions; the settled card alignment error was zero in both profiles.

The pixel comparison freezes the same real pose/camera and changes the actual WebGL depth group. Rounded card interiors are measured separately from edge antialiasing. The desktop text fixture compared 98,076 protected interior pixels: none changed. The live production perch remained attached during a 55px scroll, with maximum measured support error of approximately 0.77 CSS pixels after settling.

Performance is a short warm sample on a desktop GPU. Mobile emulation validates layout and touch delivery; it is not evidence of phone GPU speed, battery use, memory pressure or thermal behavior. One pre-existing favicon 404 remains recorded separately; no mascot JavaScript, shader or asset-loading errors occurred.

## Visual evidence

[Desktop intro](desktop-hero.png) · [Mobile intro](mobile-hero.png) · [Live perch](perch.png) · [Mobile facial peek](mobile-peek.png)

| In front of the photograph | Behind the photograph |
| --- | --- |
| ![M in front](depth-front.png) | ![M behind](depth-behind.png) |

[Motion recording](motion.webm): actual production routes directed to a component, then a perch, a 55px scroll and a behind-card movement. Body, face and tail continue through the normal animation pipeline. No manually keyed test poses or diagnostic depth switching are used in the recording.

## Preservation

The public GLB chunks and ten detail-map files are unchanged. All 320 numeric accessors were compared with the original V6 source: positions, normals, UVs, joints/weights, morphs and animation data match. The original 31 bones, ten tail bones, shoulder correctives and six clips remain. The public asset checksum is protected by a regression test.

The homepage fingerprint matches the original after normalizing only the four script/style cache versions. Every original content block, link, navigation destination and design markup is preserved. Mobile MENU had no handler in the baseline; its existing links now open in normal document flow, with touch, link selection and Escape support.

## Changed implementation

- m-world-3d.mjs: framing, PBR presentation, full-skinning checks, actual depth-buffer counterparts, responsive canvas and diagnostics.
- scroll-buddy.js: component-aware paths, arrival/depth gates, perching, scroll/reflow handling, V16 attention/reactions, pause and local diagnostics.
- m-world-spatial.mjs: projected footprint/contact planning and explicit outside-viewport gates when narrow layouts have no side corridor.
- m-world.css: canvas alignment, native size, reading/click safety and mobile overflow.
- m-lab/interactions/facial-v6.mjs: original seven-key blink interpolation and source timing.
- interactions.js / styles.css: repair the existing mobile navigation.
- index.html: cache versions only.
- Unit tests, m-world-browser-smoke.mjs and the browser workflow: preservation, skinning, blink, spatial behavior and reproducible real-pixel checks.
- M-WORLD.md and this evidence directory: current behavior and validation.

## Remaining checks

- An actual Android/iOS phone, including long sessions, battery/thermal behavior and slow connections.
- Safari/iOS WebGL and touch behavior.
- Owner review of movement and visual fidelity in the local preview.
- Production deployment requires a separately approved merge; this work stays on its feature branch.

The webpage is represented by flat depth surfaces for cards and reading areas. This is real GPU occlusion against those surfaces, not a full physical reconstruction of arbitrary DOM shapes. The heavy original asset remains a material mobile cost. Future texture compression/streaming should be judged on real-device evidence without reducing the original skinning or facial fidelity.
## CI software renderer

The hosted Ubuntu runner uses SwiftShader and measured about 1–2 native FPS with the full original asset. This is not a phone or hardware-GPU benchmark. CI measures native cadence first, then uses Playwright's fixed RAF clock for controller/arrival observations. Only intermediate draw calls in those logical stepping windows are suppressed; original model loading, shader compilation and screenshot/pixel comparisons still use actual WebGL drawing. Final checkpoints are drawn again. The normal website and the separate hardware-Chrome validation above use the native clock and render each frame.

The runner also waits for real navigation/scroll settlement before comparing component positions, rather than assuming a fixed wall-clock delay.