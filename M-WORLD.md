# M World V33 — verified discoveries from the outside world

M's local life now has a daily **sourced, validated world discovery**. A
central GitHub Actions job selects at most one safe historical/cultural/science
article from Wikipedia's "On this day" feed, storing only the date, year,
title, topic and canonical source link. A small collapsed note inside Ask M
shows the source. Curiosity can shift subtly toward the theme; topic interests
can persist across visits only when "Remember M" is enabled.

Visitors do **not** send prompts, identifying data or location to the feed,
and there are no extra OpenAI calls. The original M V6 rig, the existing
AI Worker and the separate D1 analytics Worker are untouched. If an
authenticated daily source is absent, stale or malformed, the knowledge
component stays empty instead of inventing a fact. This is adaptive topic
interest, not self-retraining or uncensored live Internet access.

Read [V33 implementation and verification](docs/m-world-v33/PROGRESS.md).

---

# M World V32 — M now actually lies down and wakes naturally

The original V6 character keeps her full 31-bone rig and detailed face, but
sleep is now a complete embodied performance: settle, tuck arms/legs and tail,
recline sideways, breathe, wake and stand up. Sleep is staged in a protected,
text-safe area rather than obscuring portfolio content. The visitor's local
time of day (night / morning / day / evening) softly influences what she feels
like doing while her V31 local outcome memory continues to mature. No new
OpenAI calls, location access, weather service, identity collection or D1 writes.

See [V32 embodied sleep and world-rhythm validation](docs/m-world-v32/PROGRESS.md).

---

# M World V31 — Independent starts and evolving local experience

M now begins with fresh browser entropy rather than a fixed gesture sequence.
Her first autonomous inclination can be to explore, play or observe, and authored
existing gestures vary between real card performances. A new private growth
memory uses only **completed local autonomous actions** to learn bounded
preferences over days (on the same browser). There are no extra OpenAI calls,
no visitor identifiers, no cross-user tracking, and no D1 changes. Opting out
of "Remember M" or resetting memory also clears growth records.

The V6 model and card-depth fixes remain unchanged. Read the
[V31 implementation and safety notes](docs/m-world-v31/PROGRESS.md).

---

# M World V29 — Life, conversation and privacy-aware insights

The original V6 M uses rounded **card-only occlusion** when behind portfolio
components, avoiding rectangular text-mask cutouts. Text remains protected in
navigation and in front. Added bounded micro-movement, settling and anticipation.
Public companion UI now has questions and answers, with privacy controls in a
small disclosure; visitor gesture/expression buttons are not shown by default.
Developer gesture diagnostics remain opt-in via `?m-debug=1`.

A standalone Cloudflare Worker + D1 database design tracks only aggregated
daily views and estimated browser-tab sessions. The owner has now configured the separate D1 database, the Worker binding and
private admin secret; the real Worker returned `/health` with `ready: true`.
The frontend visit endpoint is configured in `m-analytics-config.mjs`.
Confirm actual pageview ingestion in the private dashboard after GitHub Pages publishes. Do not
confuse this with the existing OpenAI M companion Worker. GitHub Actions passed
503/503 automated tests; native browser artistic verification is outstanding.

See [V29 setup and verification](docs/m-world-v29/PROGRESS.md).

---

# M World V28 — More natural presence and adaptive performance

Implemented on `feat/m-world-v28-presence-performance`; not published.
Movement and gaze now have bounded inertia, and autonomous facial morphs
crossfade smoothly while manual gestures and reduced motion take priority.
The original ten-bone tail and Blender V6 actor remain intact.
The renderer keeps V27 detail but can reduce pixel ratio after prolonged slow
frames and recover after stable fast frames. Visible hover/focus gently informs
local autonomous card choice without overriding reading, manual controls or
spatial guards. No new AI calls or changes to model, secrets, Worker, or quotas.
See [V28 progress and validation limits](docs/m-world-v28/PROGRESS.md).

---

# M World V27 — Readable conversation and living routines

Prepared on feat/m-living-routines-v27 from published V26 d667748.
The conversation has a dedicated readable scroll area, with a fixed composer and
responsive keyboard layout. M can independently choose sleep, thinking, a playful
hop and a three-tap floating-ball game, using the original actor and rig.
Existing utility ownership, text/depth protection and API budgets remain in place.
New backend narration rules distinguish remembered events from the current card.

Not published. Every new merge and Worker deployment requires owner approval.
See [V27 progress and validation](docs/m-world-v27/PROGRESS.md).

---

# M World V26 — Persistent character continuity

Published through PR #10 on 4 November 2026 (merge d667748).
M initiates The Small Light adventure, records genuine discoveries and remembers
a preferred quiet lookout across browser visits. Optional story UI and negotiated
AI context share the same bounded state. Original V6 appearance, full skinning,
spatial protection and current model/secret/quotas are preserved.

See [V26 implementation, native evidence and two previews](docs/m-world-v26/VALIDATION.md).

---

# M World V25 — Autonomous initiative

Published through PR #9 on 3 November 2026 (merge 4da82fb4).
M chooses exploration, self-play, observation and rest without visitor commands.
Internal energy and bounded utility memory drive varied intentions; the existing
OpenAI director remains an occasional higher-level guide with unchanged budgets.
Original V6 geometry, rig, textures and materials are preserved.

See [V25 behavior, native evidence and preview](docs/m-world-v25/VALIDATION.md).

---

# M World V24 — Intent scenes, contextual chat and optional play

Published through PR #7 on 3 November 2026 (merge 8cc84d42).
V24 connects a local scene sequencer, five blends of the existing facial morphs,
component-aware chat, optional Find M / Follow a light play and bounded tab memory.
One AI decision can lead to a whole local scene without additional AI calls.
All paths remain subject to the existing depth and text-protection planner.

The original V6 GLB, rig, weights, textures and materials are unchanged. Character
memory stores public stable component IDs and motion statistics in this tab;
its reset cannot clear chat or AI budgets. Optional play never captures page links.
Voice is reserved for a following phase.

See [V24 validation and preview](docs/m-world-v24/VALIDATION.md).
The existing Worker was updated after explicit approval; one real contextual
Epoxy request returned HTTP 200. See [visibility follow-up](docs/m-world-v24/VISIBILITY_FIX.md)
for the two visibility issues corrected and published through PR #8 on 3 November 2026
(merge 61736e53).

---

# M World V23 — Living companion and bounded automatic AI play

V23 was approved and published through PR #6 on 2 November 2026 (merge 595eb75). It adds acceleration/turn
anticipation, original-morph Wink, Playful and Nod, semantic component observation
and an automatic high-level OpenAI director with persistent request budgets.
The model, textures, rig and portfolio content remain unchanged.

See [V23 validation, previews, budgets and activation requirements](docs/m-world-v23/VALIDATION.md).
V23 and the enabled Worker passed real provider and public Chrome validation; the PR release record supersedes the earlier pre-publication validation snapshot.

---
# M World V22 — Acting and optional OpenAI companion

The new feature branch adds four original-rig gestures, contextual choices, session memory and an optional explicit-send companion. V22 was approved and published on 2 November 2026, with V21 retained in Git history. The optional companion is connected through a verified Cloudflare Worker.

See [V22 changes, evidence and activation status](docs/m-world-v22/VALIDATION.md) and [Cloudflare/OpenAI setup](m-ai/README.md). Only the verified Worker URL is public. The owner entered the OpenAI key directly as a Cloudflare secret; real backend and Chrome conversation checks passed.

The live-fidelity fix branch adds bounded 2x rendering on DPR-1 displays, Enter submission, visible prioritized reactions, varied clear corridors and explicit reduced-motion consent. See [measurements, captures and local review steps](docs/m-world-v22/LIVE-FIX.md). The live-fidelity fixes were approved and published through PR #5 on 2 November 2026.

The notes below describe the previous version.

---

# M World V21 — Original V6 with page depth and V16 behavior

This feature branch refines the original Blender V6 actor in the portfolio. It does not deploy the website or replace the character. The previous version notes below are historical.

## Changes

- The original GLB chunks and ten restored detail maps are unchanged. All 320 numeric glTF accessors match the source V6: mesh, normals, UVs, skin weights, shoulder correctives, facial targets and six clips.
- The 31-bone rig retains all four joint/weight sets (up to fourteen influences). Initialization fails rather than silently reducing the character to four influences.
- The transparent canvas uses native 272px desktop / 208px mobile dimensions without a negative offset, CSS scale, blur, or an SVG substitute. DPR is capped at 2.5 / 2. Orthographic framing uses actually deformed points from bounded production poses, rather than rotating the corners of a combined bounding box.
- AgX tone mapping and a moderate PMREM studio environment preserve skin volume and eye reflections. Colour maps remain sRGB; normal/roughness maps remain linear, with mipmaps and anisotropic filtering.
- Rounded DOM counterparts write only to the WebGL depth buffer. Cards occlude the actor behind them; protected text and controls occlude the actor at every depth. Two reusable geometry batches bound the added draw calls.
- Paths use the renderer's projected footprint and foot contact. Actual arrival, geometric clearance and settled depth gate transitions. Perches latch only after arrival, follow the component during scroll, and compensate for the animated foot position.
- On narrow layouts an explicit external portal lets M leave the viewport, change depth only after clearing every card, and return behind a visible edge. Component resizes, content mutations, image/font loading and viewport changes invalidate cached layout. Scrolling projects cached document coordinates; finite CSS geometry transitions trigger temporary frame updates so the depth masks stay attached to moving cards.
- The V16 director supplies local attention, spontaneous curiosity, expressions and tap/scroll reactions. Existing V8 motion and V15 staging remain; source swimming is blended by actual speed and settles on perches.
- Facial controls use the real V6 morph knots: a manual half blink reaches Half_Closed rather than remaining on the clip's initial Open hold. Automatic playback preserves the source clip timing.
- Mobile MENU now opens the existing navigation in normal document flow, closes on link selection or Escape, and preserves every original destination. This repairs a pre-existing missing handler discovered by real touch testing.
- One RAF owner handles pause/resume and visibility. Reduced motion parks M. A stored disabled preference avoids downloading the character. Overlays cannot capture page clicks; load errors provide Retry.

## Validation

See [the measured results, screenshots and motion recording](docs/m-world-v21/VALIDATION.md).

Run the regression suite:

~~~powershell
node --test m-lab/interactions/*.test.mjs m-world*.test.mjs
~~~

Run the actual-browser suite against a local static server:

~~~powershell
$env:BASE_URL = 'http://127.0.0.1:4183/'
$env:M_WORLD_ARTIFACT_DIR = 'C:\path\to\validation'
node m-world-browser-smoke.mjs
~~~

The browser runner uses the installed Chrome executable (override CHROME_BIN), a separate desktop context and a true mobile/touch emulation context. It writes screenshots and a JSON report. The query ?m-debug=1 exposes deterministic MWorld.stepTo, setDepth, playAction, snapshot, resume and setActive controls for reproducing card interactions; normal visitors do not get that API.

The homepage fingerprint ignores only cache versions for the mascot and navigation script/style files. It guards all portfolio content, links, navigation and markup. A second fingerprint guards the unchanged V6 asset.

## Practical limits

DOM cards are represented by flat depth surfaces in a local 3D overlay, not a physically reconstructed webpage. The depth buffer provides real pixel occlusion against those surfaces; there is no claim of general mesh collision with arbitrary DOM shapes. A warm desktop-GPU measurement in mobile emulation is not a physical-phone performance result. Safari/iOS, thermal behavior, slow networks and an actual touch device still need separate checks. Web PBR presentation is not pixel-identical to Blender's renderer.

---

# M World V20 — High-definition 3D M in the real portfolio

## Quality improvements (30 October 2026)

The user's video showed a visibly soft M and weak interactions with card content. The public portfolio now uses the genuine Blender V6 GLB plus **10 restored high-detail original material maps**, not an invented substitute. The maps include the main body's diffuse texture and normal/roughness support, detailed left-eye and eyelid skin colours, and three higher-quality tangent-space normal maps. They are separately cached under `assets/m-v6-detail/` and loaded by `m-world-3d.mjs` in addition to the ~16.9MB optimized geometry+animation GLB.

Rendering upgrades:
- Native 272×272 desktop and 232×232 mobile transparent canvas, drawn up to 2.5×/2× device-pixel density respectively (actual framebuffer size scales with DPR)
- Revised perspective and model framing for crisp but non-obstructive placement
- Correct sRGB on colour maps, linear space on normal/roughness maps, anisotropic filtering and mipmaps
- Lighting/exposure calibrated to retain eye/face detail without washing out the skin
- Responsive framebuffer resize when moving between desktop and mobile
- Production cache busting: `scroll-buddy.js?v=20`, `m-world-3d.mjs?v=20`, `m-world-spatial.mjs?v=20`

Spatial interactions:
- Card-attached **Peeking** that emerges from behind the edge instead of remaining invisible
- **Perching** on the panel's upper border without landing on paragraph text
- **Orbiting** using a curved route across the card's upper edge and behind the far side
- Matching eye/head gaze toward the real card being visited
- Mobile transitions begin in a safe gutter; card interiors mask M when she passes behind them, so text remains readable
- The mobile browser smoke check now fails when M covers the interior of readable cards instead of passing behind them

CI:
- `node --test m-lab/interactions/*.test.mjs m-world*.test.mjs`
- Headless Chrome / SwiftShader tests of real 3D asset loading, high-DPI canvas, original-detail asset restoration, navigation, mobile horizontal overflow and card-depth status

**Limitations:** Card occlusion is a purposeful 2D viewport cutout, not mesh-depth collision or physically based simulation. Browser visual testing is still needed on real devices and browsers after automated checks pass.

---
# M World V19 — Original Blender V6 in the live portfolio

## Real 3D mascot now deployed

The original `M_FacialExpressions_V6_Test.glb` was found in the owner's
ChatGPT file library, optimized **30.9 MB → 16.9 MB** by reducing embedded
texture resolution, and uploaded to the public GitHub repository as
19 static binary pieces under `assets/m-v6-web/`. The geometry, real 43-node
rig, 10-bone tail, all 11 meshes, facial morph targets, and six animation
clips were preserved. The blobs were checked against matching Git SHA-1
content hashes and the binary glTF header and buffers were validated.

The front end uses `m-world-3d.mjs` and the same Three.js version as the
lab. It reconstructs the 19 pieces in memory, imports with GLTFLoader,
retains the original skin weights with the full-skinning adapter,
and executes `createFacialV6` and `createMotionV8` for expressions,
blink, swimming and flowing tail motion.

The SVG is **fallback only** when WebGL or real 3D initialization fails.
It is hidden when the real V6 canvas loads. The pause button shows
download progress and stores the on/off preference. With the mascot disabled,
the 16.9 MB file is not needlessly downloaded.

CI checks the assembled GLB bytes, animation names, tail joints, facial
morphs and host-side JavaScript. A separate Chrome smoke workflow loads the
full 3D character from local static hosting and checks both desktop and mobile,
the canvas, hidden SVG, navigation and no M-induced horizontal overflow.
A successful smoke run on 30 October 2026 confirmed `model: V6 GLB`,
`svgHidden: true`, all 3D modules loaded, and navigation worked.
There remains a pre-existing 93px document overflow from decorative aurora
elements on a 390px viewport; M did not add any overflow.

The M World spatial layer chooses real visible cards and varies between
foreground play, peeking from behind, perching and orbiting. It dynamically
masks the 3D canvas when overlapping readable cards, so text remains visible.
It deliberately uses **2D simulated depth** relative to DOM elements; there
is no true 3D collision mesh of the webpage.

## What the character can do

- Detect real, visible project cards, experience roles, about tiles, certifications,
  hero portrait, expertise cards and contact section.
- Choose a destination in the visible viewport and adapt to the card's live
  bounding rectangle, including as the page scrolls and reflows.
- Swim along page sections and navigate to cards, orbit their sides,
  perch near an edge, or peek from behind them.
- Move in front of other elements, and use a viewport-relative **even-odd
  occlusion cutout** to hide the portion that passes behind the selected card.
  This is **2D simulated depth**, not a full WebGL scene depth buffer.
- Move with inertia, tail drag, head/body bob and gentle breathing.
- Stay click-through: world overlay and mascot have no pointer hit testing;
  direct interactions are heard only on noninteractive backgrounds and
  never intercept real links, forms, buttons, project filters or navigation.
- Keep sticky navigation in front of M. A small keyboard-accessible
  pause/resume control lets visitors choose, with the preference stored locally.
- Respect `prefers-reduced-motion` with a parked, calm character.
- Avoid high-frequency layout work: target discovery occurs only on gesture
  selection or at an approximately 420ms interval during scrolling.

## Limitations and acceptance

Even-odd clipping provides convincing front/back interactions for flat
rectangular cards; it does not do true per-pixel depth or collision physics.
For example, the silhouette does not occlude individual text glyphs or
irregular objects with exact 3D geometry.

CI: `node --test m-lab/interactions/*.test.mjs m-world*.test.mjs`.

Manual browser checks remain necessary:

1. Desktop: scroll from Hero through About, Experience, Projects and Contact,
   observe peeking/orbit/perching while all CTA links remain usable.
2. Project filters: hidden cards must never be destinations.
3. Mobile: test portrait layout, sticky menu, responsive card positions,
   safe-area pause switch and smooth scrolling.
4. Reduced motion: the character stays small and calm in the corner.
5. Pause and resume: preference persists after refresh.
6. Watch the console for errors and check CPU/battery impact on mobile.

If a visual defect appears, the world layer is isolated and can be disabled
without touching the portfolio content or the V6 Blender model.
