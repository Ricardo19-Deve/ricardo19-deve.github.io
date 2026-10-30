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
