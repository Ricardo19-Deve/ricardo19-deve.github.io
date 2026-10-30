# M Interaction Lab — V10 reactive tail, V6 facial controls (isolated prototype)

URL: https://ricardo19-deve.github.io/m-lab/interactions/

## V10 reactive tail choreography — 30 October 2026

The V10 layer responds to feedback that the tail still did not visibly accompany the character's expressions and actions. The GLB has been directly inspected: `Tail.01` to `Tail.10` are connected in a joint chain, and each is animated by `M_Swim_V4`.

- `tail-v10.mjs`: new, independent 3-axis animation layer, additive to the original clip
- Tail response is driven by the current facial expression, interaction mode, head-turn pose and measured spring-smoothed body orientation/translation velocities, plus swim clip weight
- **Feliz**: active wag, **Curiosa**: raised/side-curved tail, **Surpreendida**: travelling kick and recovery, **Esconder**: curled retreat, **Nok nok**: two travelling pulses; swimming adds a propulsion wave
- `Ondulação base da cauda` controls idle wave amplitude (0–150%, default 110%)
- `Reatividade emocional e corporal` controls response to emotions and body movement (0–200%, default 150%); the channels are independent, so idle can be zero while reaction is strong
- The global `Vida do corpo` control remains the master limiter for all extra procedural motion, including accessibility reduced-motion mode
- Existing natural/calm/playful styles and the tail camera focus are preserved
- Every tail joint receives a delayed target and a soft-bounded additive rotation; no destructive Blender edits, new model assets, or uploads to the public repository

The V10 regression suite additionally checks that emotion-only reactions remain visible with base idle at zero, that rotation/velocity feed noticeable counter-motion, that swim blend weight affects the wave smoothly, and that 30/60 FPS pose differences stay bounded.

The checks run in GitHub Actions and do not constitute a visual approval of the V6 GLB on mobile or desktop. Check that no shoulder deformation, excessive tail curl or collision with the body occurs before production integration. The portfolio homepage is unchanged.

## V9 organic tail motion — 30 October 2026

Following video feedback that M's tail still looked rigid, the V8 lab now uses `tail-v9.mjs` for the **existing ten tail bones**, not a new mesh or a destructive GLB edit. The source `M_FacialExpressions_V6_Test.glb` was inspected: the ten joints are named `Tail.01`–`Tail.10`, and its `M_Swim_V4` clip already contains translation, rotation and scale tracks for all ten joints.

The independent tail layer adds:
- A three-axis traveling S-wave. Every segment receives a different phase, so the base leads the tip.
- Two slower overlapping frequencies for gentle side sweeps, lift and soft twist instead of rigid oscillation.
- Different tail behavior when happy, curious, surprised, shy or reacting to a knock.
- Three styles: **Ondulante / natural**, **Suave / tranquila**, **Brincalhona / expressiva**.
- A 0–150% intensity slider (115% by default, independent of the body energy slider). At 0%, the extra tail movement is exactly zero, while the original GLB swim animation still works.
- Inertial spring response, restrained amplitude per joint and continuous frame-to-frame motion.
- A smooth **Ver cauda** camera preset for observing the whole silhouette from the side.

The V9 layer remains additive over the original Swim V4. It never changes rig hierarchy, mesh geometry, skinning or shoulder corrective morphs. The lab intentionally does not publish the private 30.9 MB GLB.

### Validation

`node --test m-lab/interactions/*.test.mjs` is run by the `M Mascot Motion Regression Tests` GitHub Action. Tail-specific tests verify ten segments, differentiated styles, 30/60 FPS continuity, stable angular bounds, response to emotions and tail slider zero. Automated tests do not prove that the deformation looks right in Three.js; desktop and iPhone visual tests are still needed.

The main portfolio remains unchanged.

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
