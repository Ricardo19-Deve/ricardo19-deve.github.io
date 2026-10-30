# M Interaction Lab — V6 facial controls (isolated prototype)

URL: https://ricardo19-deve.github.io/m-lab/interactions/

## V7 expressive secondary motion — 30 October 2026

Feedback from a screen recording: V6 facial morphs are subtle, and the small character view makes them hard to distinguish. The original GLB was inspected: `Expr_Happy` moves ~2.6% of 61,765 body vertices more than 0.001 unit; `Expr_Curious` ~1.0%; `Expr_Surprised` ~2.6%. This is a Blender model limitation, not proof of a renderer failure.

The lab now adds `motion-v7.mjs`, a **non-destructive procedural secondary-motion layer** on the existing 31-bone rig. It evaluates after the original swim clip and adds smoothly blended local rotations for head, neck, chest, ears and ear tips, both arms/forearms, legs and the ten tail segments. Existing joints, baked swim and shoulder corrective morphs remain unchanged. A gesture begins relative to its interaction mode, not the global playback clock.

New controls:
- **Vida do corpo** slider (85% by default, adjustable down to zero)
- **Intensidade da expressão** slider (185% by default, 100–250%; lower it if the shape deforms)
- **Piscadelas automáticas naturais**, with separate left/right blink clips (turned off for reduced-motion)
- **Ver rosto** camera zoom to evaluate eye design and subtle facial differences
- Facial buttons now trigger emotion-specific head, ears and arms poses, with a small transient reaction
- Demo automatically pairs body actions with suitable expressions

**Validation caveat:** JS syntax and pure motion/face unit checks were run, but this version still needs real visual review on desktop and iPhone using the local V6 GLB. Stronger Blender facial shape keys remain the best way to make Happy/Curious/Surprised genuinely distinct, rather than indefinitely increasing morph weights. The production homepage is unchanged.

Run regression tests with `node --test m-lab/interactions/*.test.mjs`.

## What changed on 30 October 2026

The lab supports local loading of `M_FacialExpressions_V6_Test.glb` (30.9 MB) with the following animation tracks:

- `M_Swim_V4`: 31-bone body swim, including its original animated shoulder corrective morphs
- `M_LeftBlink_V4` and `M_RightBlink_V1`: independently sampled eye/lid animations
- `M_Expression_Happy_V1`, `M_Expression_Curious_V1`, `M_Expression_Surprised_V1`: expressions represented by the body morph targets `Expr_Happy`, `Expr_Curious`, `Expr_Surprised`

The new `facial-v6.mjs` layer samples the left and right blink tracks separately and sets only the three `Expr_*` morph slots on the body. **It deliberately does not overwrite** `Shoulder_Propulsion_Corrective` or `Shoulder_Glide_Corrective` while the swim clip is playing.

The UI provides Neutral, Happy, Curious and Surprised buttons, one independent closure slider per eye, and independent/simultaneous blink playback. Facial controls are disabled when the corresponding morphs/animation clips are missing. The animation selector shows body/idle clips only, so it will not accidentally treat a facial clip as the main body clip.

## How to test the V6

1. Open the lab URL.
2. Select `M_FacialExpressions_V6_Test.glb` using **Escolher GLB**. The file is processed locally: it is not uploaded.
3. Confirm the diagnostics show three expression morphs and four tracks for each eye.
4. Select **Nadar** and switch among the three expressions while the body animation runs. Check shoulders, face and tail from front/side/rear.
5. Use the left/right sliders, then the independent blink buttons and **Piscar ambos**.
6. Check the entire sequence on desktop and mobile (including Safari/iPhone), confirming FPS and device thermals.
7. Check that no geometry flickers, the eye cover fully closes, the eyebrows do not collapse and the Surprised mouth stays closed.

## What is not approved yet

- Browser rendering and mobile/Safari behavior **have not been visually validated** against the Blender V6.
- Complex Peek, Knock, Shy and Follow Pointer states remain **whole-body interaction prototypes**, not complete skeleton/gaze animations.
- Facial expression keys are currently held morph strengths with smooth transitions; the exported 3-second expression clip timing is *not* independently played.
- The public repository only contains the lab code, **not the 30.9 MB private user-provided GLB**.
- The main portfolio page and production mascot remain unchanged.
- Three.js r184 modules load from the CDN and require network access.

## Release criteria

- Approved closed-eye appearance and facial expression poses
- Confirmed 31-bone skinning + shoulder correctives in Three.js
- Real mobile tests with acceptable FPS and memory
- Reduced-motion preference and accessibility checks
- Only after sign-off: optimizations and integration into the homepage, with a rollback path

Earlier prototypes are available separately at `/m-lab/swim-v3/` and `/m-lab/meshy-motion/`.
