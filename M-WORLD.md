# M World V17 — Portfolio spatial integration

The homepage now runs the production M World script, powered by
`scroll-buddy.js`, `m-world-spatial.mjs` and `m-world.css`.

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

## Important asset distinction

The website **currently uses its existing illustrated SVG representation**
of M. The character model `M_FacialExpressions_V6_Test.glb` (about 30.9 MB)
is in the owner’s ChatGPT file library, but was not present in the public
GitHub repository. It has **not** been silently substituted for another
3D model or published in this release.

The real V6 rig, facial expression and swim work remains safely isolated at
`/m-lab/interactions/`. A later production 3D renderer can reuse this same
world positioning, occlusion and behavior layer after the actual GLB is
optimised and intentionally hosted as a public asset (e.g. a versioned file
under `assets/`), without changing the homepage navigation.

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
