# M Interaction Lab — V15 full-body character acting (isolated prototype)

URL: https://ricardo19-deve.github.io/m-lab/interactions/

## V15 — Bigger presence, emotion-specific full-body acting (30 October 2026)

The user's 21-second mobile recording of V14 confirmed that the tail movement is functional, but the character remains visually small and its expressions/body reactions are too subtle. **V15 changes the acting and on-screen presentation**, not just the tail oscillation amplitudes.

- `performance-v15.mjs`: explicit expressive poses on the existing head, ears, arms, forearms, chest and neck. Three emotions have different body silhouettes, with smoothly settling gesture accents. The body also contributes to Swim, Peek, Knock, Shy and Follow.
- `tail-v15.mjs`: larger emotion-specific traveling tail sweeps (Happy), lifted/curved question-mark pose (Curious) and a delayed recoil (Surprised), while preserving V14's continuous breathing and 10-bone phase lag. Every value remains a reversible local rotation, applied through the existing spring solver and real GLTFLoader bone aliases.
- `performanceStagePoseV15`: gentle whole-character acting, with vertical buoyancy, orientation changes, a small surprised pop and gentle happy motions. All gestures still respect reduced-motion and body-energy controls.
- New `Expressividade da M` slider defaults to 120% (0–160%). At 0%, the old V14 tail pose is exactly returned and V15 acting disappears, allowing a direct A/B comparison on the same GLB.
- New `Tamanho da M no palco` control defaults to 130% (100–150%). It scales the already-centred model visually without changing the imported GLB, skeleton or animation weights.
- Selecting an interaction mode now automatically selects the accompanying facial emotion. Manually clicking a facial emotion pins it until **Pose neutra** or **Demo automática**.
- The existing V6 GLB and main production portfolio remain untouched and are not publicly uploaded.

`performance-v15.test.mjs` checks distinct expressive poses, A/B differences at 0% versus 120%, tail continuity at 30/60 FPS, reduced-motion settings and motion limits. The user's real browser rendering still needs visual validation, particularly whether enlarged character framing remains suitable on mobile and whether any specific mesh deformation needs adjustment.


## V14 — fluid tail follow-through and elastic wave (30 October 2026)

After the user recorded the correctly bound V13 tail, the visible issue remained that it held nearly the same curled silhouette while other parts moved. A new animation is now added using `tail-v14.mjs`, and the existing runtime uses faster springs at the base, longer lag and softer damping toward the tip, plus a small amount of upstream angular-velocity transfer between adjacent joints.

- Root-to-tip phase delay on a continuous dual-frequency S-wave, including gentle idle breathing and separate swimming propulsion.
- Happy: repeating celebratory wag and a longer initial sweep; Curious: raised, gently exploring posture; Surprised: travelling recoil and recovery; gestures continue driving counter-motion.
- New `Elasticidade da cauda` slider (0–100%, default 73%) changes phase propagation and the spring follow-through, independently from `Ondulação base`, `Reatividade`, and the global `Vida do corpo` control.
- Existing r184 `Tail01` normalization, 10/10 connected-bone diagnostics, V6 baked swimming action and original corrective morphs are unchanged.
- The procedural layer remains non-destructive to the local GLB and no edits are made to the portfolio main page.

Tests in `tail-v14.test.mjs` cover 10 joint names, distinct phase differences, 30/60 FPS continuous targets, different reactions and elastic control ranges, and hundreds of animated frames without quaternion accumulation. **These are code validations**; the user should validate the visual appearance of the GLB in the web laboratory before production integration.

## V13 — actual Three.js r184 node-name fix, confirmed against upstream source

The original V12 fix was incomplete. It assumed Three.js replaced Blender dots with underscores (e.g., `Tail.01 → Tail_01`), but the **actual r184 implementation** of `PropertyBinding.sanitizeNodeName()` removes reserved punctuation. `GLTFLoader.createUniqueName()` uses this sanitizer. Therefore, with this GLB, the actual imported bone names are `Tail01 ... Tail10`, `EarL`, `ArmL`, and so on, not the previously assumed underscore aliases.

`canonicalBoneName()` now supports the **real punctuation-stripped form**, legacy underscore names, and unsanitized Blender names, while leaving the original imported Object3D names untouched (so baked Swim V4 can still play correctly). The runtime maps them to the canonical procedural animation targets `Tail.01 ... Tail.10` and `Arm.L`/etc.

Updated `rig-binding.test.mjs` specifically emulates r184 names and asserts that the ten actual bone objects, plus both arm/ear samples, receive nonzero expressive rotations with reversible additive quaternions. The lab now displays **V13**, forces a new module URL to avoid cache re-use, and lists all recognized original→canonical bone aliases in the diagnostic panel.

**User verification still required:** load local `M_FacialExpressions_V6_Test.glb` and confirm `Cauda: 10/10 ossos`. This is not a browser-rendering claim until tested with the real file. The source GLB and main portfolio remain unchanged.

## V12 — Root cause confirmed from user video: missing bone binding

The new screen recording supplied on 30 October 2026 visibly showed **`Cauda: 0/10 ossos · flexão 0.0°`**, even though the Blender GLB itself has 10 correctly weighted tail joints and a built-in `M_Swim_V4` animation. This proves the prior procedural motion was **not bound to the real tail bones**. Repeated changes to angles and waveforms could not solve that.

**Actual defect:** GLTFLoader sanitizes node names containing a dot (Blender `Tail.01` is exposed as `Tail_01`; `Arm.L` as `Arm_L`). The procedural motion generated targets under the Blender names, but looked up the imported node names literally. The result was 0/10 tail bones and also lost secondary motion on arms, ears and legs.

**Actual fix:** `canonicalBoneName` in `motion-v8.mjs` maps imported `Tail_01..Tail_10`, `Arm_L`, `Ear_R`, etc. to their original procedural target keys **without renaming the Three.js nodes** (which would break existing GLB animations). The diagnostic now exposes both imported and canonical names, and V12 highlights a clear warning if the number of mapped tail bones is not exactly 10. V12 uses a versioned module URL to bypass old cached code.

New regression tests `rig-binding.test.mjs` emulate sanitized GLTFLoader node names, assert ten actual bone object rotations change while emotions animate, check arm and ear bindings, and verify that additive rotations remain reversible without drift. All tests must pass via GitHub Actions.

**Visual acceptance criteria:** after loading the same local `M_FacialExpressions_V6_Test.glb`, the status should read `Cauda: 10/10 ossos` and the reported flexion angle should change over time. The tail should react visibly to Happy, Curious, Surprised and Knock without distorting the body. Code tests are not a substitute for checking actual appearance in-browser.

No modifications to the original GLB or production portfolio page were made.

## V11 — Correct tail axes, expressive bends (30 October 2026)

**Root cause identified from the actual V6 GLB**: in all nine tail parent-to-child segments, local +Y is aligned with the bone length (dot product 1.0 within numerical tolerance). The V9/V10 engines were concentrating much of their additive wag in local Y, which mostly twisted the tail and produced limited change in its silhouette.

V11 uses `tail-v11.mjs` and fixes that specific root cause:

- Tail side bends and vertical lifts now act in **local X and Z**. Local Y is reserved for a very small longitudinal twist.
- **Feliz**: distinct repeated lateral wag and a brief celebratory kick.
- **Curiosa**: holds a raised, side-curved pose while gently moving.
- **Surpreendida**: recoils upwards with a delayed traveling kick.
- **Esconder**: tucks the tail behind the body; **Espiar**, **Nok nok** and **Seguir dedo** trigger their own counter-movements.
- `Ondulação base` defaults to **85%** and `Reatividade emocional e corporal` to **175%**, independently adjustable.
- Spring-smoothed head/body coupling and original V6 baked Swim V4 playback are preserved.
- The laboratory shows **Cauda: N/10 ossos · flexão X°** as live diagnostics. If N is not 10, the rig did not bind correctly. This number measures additional procedural rotation at the joints, not final silhouette displacement.
- V11 does not change the original Blender GLB, mesh, weights or corrective morphs. The GLB remains local to the user's browser, not committed to the public repository.

The CI suite now checks the critical bend-vs-twist ratio, distinctive expressive poses, 30/60 FPS continuity, extreme angle bounds and zero-motion controls. CI does not replace visual browser testing on the real GLB. Do not integrate into the portfolio production page until the user approves the final silhouette and animation quality.

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
