# M V54 — alive between the big moments

## Objective

M already has 11 original-rig micro-performances, seamless V41 pose
handoffs and coordinated emotional body language. However, there were
long gaps when no miniature was running and M could appear neutral or
robotically stationary. V54 adds **quiet attention** without flooding
the page with more large animations or extra controls.

## New living-attention layer

`m-world-between-beats.mjs` is a small, seeded visual-only state machine:

- **Subtle head/neck orientation** follows the existing attention vector
  from the page-world controller, with delayed movement and no snap.
- **Ears react asymmetrically** when the attention target genuinely changes;
  no invented objects or fake interaction claims.
- **Ten tail joints** follow the existing direction and actual turning with
  progressively slower damping towards the tip, preserving the original
  V6 rig and bounded rotations.
- **Gentle curiosity, joy and eyelid changes** appear between major actions,
  with non-repeating pulses separated by varied quiet periods.
- The layer responds proportionally to **character energy** and
  exploration/observation mode.
- These micro-reactions use deterministic local math, not OpenAI tokens,
  extra model calls or visitor history.

## Motion authority and continuity

- **Always yields** to an authored gesture, sleeping/resting, verified
  card contact, reading, active emotional performance, fast traversal
  and reduced-motion accessibility.
- During a spontaneous mini-performance, the micro-layer is suppressed:
  the original V50/V51 performance owns the stage and the facial cues.
- When the miniature ends, V41 springs recover the micro layer
  continuously. The face uses V28 crossfading, not abrupt on/off eyelids.
- The micro layer has **no position or depth authority**, does not
  navigate the page and cannot move overlays, cards or buttons.
- It reuses the original `createGestureLayer`, V41 joint handoffs and
  V28 facial continuity. No new 3D asset, skeleton, rig, audio or
  WebGL draw call is needed for the motion maths.

## Privacy and professional presentation

- Ask M's V53 professional-first profile/story/services/contact behavior
  is unchanged.
- The Cloudflare LinkedIn integration remains restricted in our code
  exclusively to the owner's verified, publicly shared posts via
  `MEMBER_SHARE_INFO`. No messages, contacts, follower information or
  other LinkedIn member domains are accessed.
- The visual micro-layer never uses LinkedIn or any other network API
  and never learns visitor identity or behavior outside already
  available page-world attention signals.

## Validation

`m-world-v54-between-beats.test.mjs` validates:

1. Staying quietly expressive during long periods between actions.
2. Smooth real-target direction reversal; head and tail velocity continuity.
3. Priority given to the spontaneous 11 mini-performances.
4. Gestures, sleep, card contact, reduced motion and accessibility.
5. Bone/face amplitude bounds and no position/depth interference.
6. 30/60/120 fps numerical stability.
7. Full renderer integration through V41 bone and V28 facial handoffs,
   with no network, storage, visitor identifiers or analytics.

**682/682 Node regression tests passed** on branch commit `52729a77`.

Version parity was raised to `?v=54` across site entry, runtime
module imports, CSS, and cache-parity tests. Browser visual validation
is a separate check. The existing Chrome suite still has historical
old-UI contract and desktop text-shield pixel failures on the V53
baseline; do not treat those checks as successful without real evidence.

## Production

Merge to GitHub `main` to trigger GitHub Pages. The separate
Cloudflare Workers Builds integration keeps the public-posts-only
Ask M backend synchronized where applicable. No secrets or Cloudflare
settings need changing.
