# M V55 — emotional continuity between observation and play

## Goal

Keep M **visibly alive and emotionally continuous** when she changes between
exploring, observing, playing and settling down. The V54 between-beats layer
introduced quiet attention, but V50+ playful expressions still switched to
V54 attention as completely separate sources. Their bones were already
smoothed individually through V41, while their *facial intentions* switched
instantaneously before V28 could fade.

The V55 bridge solves the gap by gradually changing the **weights of the two
intentions**, preserving the previous verified expression briefly while the
next intention gains influence.

## New renderer behavior

New `m-world-intent-crossfade.mjs` provides
`createIntentCrossfade()` and stateless, bounded scale helpers:

- **Observe → play:** keep part of M's curious expression and attentive head
  orientation while a playful smile and the body performance fade in
- **Play → observe:** the smile decays naturally while attention and ears
  resume without a blank neutral-expression frame
- **Play → quiet:** completed source poses return to neutral through the
  original V41 velocity-preserving spring, while the old facial weights
  briefly decay instead of being discarded
- **Sleep, rest, deliberate gestures, verified card contact and active
  authored emotion:** take priority over the miniature layers
- **Reduced-motion accessibility:** resets the blending weights and
  disables the new expressive layer immediately
- **Stage movement:** receives the same small play weighting as the V6 bone
  pose before the existing final stage handoff
- **No overlapping overdrive:** the sum of play+observe weights is
  normalized to at most 1

The code reuses **V41 bone angular-velocity handoff** and the original
**V28 facial morph crossfade**. It does not create any new rig, mesh,
animation, draw call, manual UI, page route, landing behavior, or visitor
identity state.

The full original 31-bone GLB, cards, depth occlusion, on-page navigation,
eleven spontaneous mini-performances, V54 subtle presence, V53 professional
Ask M and the embodied sleep/wake behavior remain intact.

## Data and privacy

No extra OpenAI requests, visitor tracking, local storage or external
network access. The LinkedIn code is untouched and stays restricted to the
owner's **publicly shared posts** via `MEMBER_SHARE_INFO`, with no new
permissions, messages, contacts or private account-data access.

## Tests

`m-world-v55-intent-crossfade.test.mjs` tests seven scenarios:

1. Observe → play retains curious eyes while the playful pose begins
2. Play → observe retains the previous smile during handoff
3. Explicit gesture / sleep / affect / reduced-motion priority
4. Play → neutral leaves pose fading to V41, no instant facial reset
5. No additive weight overshoot, invented bones or exaggerated stage
6. Numerically stable 30/60/120 Hz blend with no frame-one direction snap
7. Integration into original renderer with V41 and V28

The V54 static regression was updated for the new expression source.
Entry-point JS/CSS and first-party imports use **`?v=55`**, preventing old
V54 browser caches from masking this work.

**689/689 Node motion regression tests passed** on commit `188af3dc`.
Visual Chrome automation still has historical failures on the baseline
from a removed V24 chat button and a paragraph pixel-shield assertion;
these must be assessed separately before claiming artistic sign-off.

## Rollout

Merge the PR into `main` to trigger GitHub Pages and the existing
Cloudflare Worker build connection. The Worker code/secrets were not changed
in this version; no LinkedIn action is required.
