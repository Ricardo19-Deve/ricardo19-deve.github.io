# M Interaction Lab — isolated prototype

URL: https://ricardo19-deve.github.io/m-lab/interactions/

## Purpose

Test the M character's **interaction design** while the facial rig is developed separately by Codex/Blender. This laboratory does not modify the portfolio home page, its production mascot script or the older labs.

The repository is **public**. The laboratory is separated by URL, **not access-controlled/private**.

## Current capabilities

- Load a Meshy-derived **GLB locally** with the Safari/Chrome file picker; no user GLB is uploaded to a server.
- Use the existing r184 full-influence skin adapter from `../swim-v3/threejs/`, preserving the original joint/weight sets and baked shoulder corrective morphs.
- Discover actual animation clips at runtime; prefer a real Swim clip if present.
- Test a local motion **state machine**: Float, Swim, Curious, Follow Pointer, Peek, Knock, Hide.
- Demo sequence, pointer/touch events, scroll slider, clip speed, camera orbit, FPS and skeleton diagnostics.
- Auto-detect two optional blink morphs named like `M_Face_Blink_L` and `M_Face_Blink_R`. Facial controls remain **disabled** when these targets are absent.
- Release replaced 3D assets when loading another GLB, to reduce GPU memory growth on mobile.

## Honest limitations

- **Peek, Knock, Hide, Curious and Follow Pointer are global-body interaction previews, not final skeletal animations.** There is no animated arm knock or independent eye gaze in this build.
- Float uses the real Float/Hover/Idle clip if supplied; otherwise a neutral/rest pose plus gentle global movement.
- The browser needs internet access for the pinned Three.js 0.184.0 CDN modules.
- Mobile performance, full-influence shader operation on all devices and facial animation quality have **not been independently validated**.
- The `GLB` is not embedded in the deployed page. Select a local GLB from Files. A later isolated GH upload may remove this step, but would make the binary publicly accessible.

## State/animation contract for the next Codex run

| State | Intended real GLB animation | Current behavior |
|---|---|---|
| `float` | `M_Float_Final` / Float clip | Float clip or neutral global hover |
| `swim` | `M_Swim_V4` or newer | Plays first matching Swim clip |
| `curious` | independent gaze + head tilt | Whole-body gentle tilt |
| `peek` | Peek skeletal action | Whole-body lateral slide |
| `knock` | Two deliberate taps + follow-through | Body tap anticipation + 2 visual pulses |
| `shy` | Hide/retreat action | Body translation |
| `follow` | Eye gaze and subtle head tracking | Limited whole-body rotation/translation |

Export the body animation and independent facial controls without naming collisions. Preserve the two shoulder corrective morph targets; blink morph tracks must be independently blendable, not overwrite corrective morph weights. A future GLB with eye shape keys should expose descriptive morph names. The lab auto-detects `Blink_L` and `Blink_R` names.

## Integration priorities

1. Get the eye design and closed-eye appearance approved; do not ship rejected eye trials.
2. Export a complete rigged GLB after facial work; load it in this lab.
3. Verify full-influence skinning, skin/corrective morphs, eyes and FPS on iPhone.
4. Produce real Peek, Knock and Curious **skeletal clips**, not only body translations.
5. Verify reduced motion and document the character's real animation envelopes.
6. Only then consider integration into the production portfolio.

## Isolation

Changed/added paths are restricted to `m-lab/interactions/`. The laboratory imports the shared adapter from the existing `m-lab/swim-v3/` folder, but does not modify it.
