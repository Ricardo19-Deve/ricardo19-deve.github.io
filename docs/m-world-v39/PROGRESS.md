# M World V39 — movement continuity and momentum

## Goal

M already has source-verified discoveries, autonomous choices, original V6
gestures, V32 physical sleep and V38 real card contact. Her *transitions*
still felt more mechanical: an approach could suddenly become a stop or turn,
and the body lacked a short recovering moment between one action and the next.

## Implemented

- **True departures** — after the existing controller's actual speed crosses a
  hysteresis threshold, the original Head, Neck, Chest, Body, Arms and Legs
  anticipate the start with a small bounded pose. Never simulate movement
  or generate routes. No fake "departure" on initial page load.
- **True arrivals** — a genuine reduction in velocity produces one short
  recovering body impulse, then eases back to neutral. The moving/stationary
  thresholds differ to avoid retriggering at low speed.
- **Soft turns** — the head follows the turn quickly while the existing
  connected ten-tail-bone chain countersways with a slower filtered response.
- **Intent changes** — when the existing planner moves toward peeking,
  exploring or playing, the M body briefly reorients rather than performing
  a new fixed-loop gesture. No additional user action and no AI prompts.
- **Priorities** — *verified card contact* (V38), authored gesture, real
  sleep and prefers-reduced-motion immediately suppress this layer. Reading
  attenuates it. The original route still owns all real coordinates, bounds,
  depth, card attachment, navigation and collisions.
- **Original fidelity** — a single additional reversible bone layer based on
  the established `createGestureLayer` API. It undoes its previous offsets
  before applying each new sampled pose. Angular and stage impulses are
  tightly bounded, and the 3D contact-stage X offset is always exactly 0.
  No meshes, skins, animations or LOD replacements.
- **Performance** — only tiny numerical updates per frame; no DOM, Web APIs,
  network calls, model requests, D1 writes or storage. Debug mode can inspect
  `MWorld.snapshot().renderer.continuity`.
- **UI unchanged** — Ask M remains exclusively Q&A about the portfolio;
  ⚙ preferences retain only Memory and AI play.
- **Cache** — revised first-party mascot import and homepage references v44.

## Test plan

1. On the public portfolio, observe M beginning a true route, turning near a
   card, coming to a stop, and taking a natural moment to balance.
2. When M physically lands on a card, V38 must remain the **only** contact
   authority. Check her paws, tail, and scroll-following behavior without
   horizontal drift.
3. Repeated turns and low-velocity jitter must not continuously fire
   "beginning" or "arrival" events.
4. Test real sleep, authored gestures, and reduced-motion. These own the
   motion and the new transition layer must be neutral.
5. Use `?m-debug=1` to check `renderer.continuity` and
   `renderer.contact`. All diagnostic controls remain outside Ask M.
6. Validate desktop, narrow screens, 30/60/120Hz pacing, accessibility, and
   face/tail realism by viewing M in a real browser. Automated tests alone
   cannot prove artistic naturalness.

## Scope / limitations

This is a **bounded simulation of bodily continuity**, not actual sentience
or physical-world sensing. The time of day, local interests, verified
discoveries and completed experience memory still guide autonomous choices.
All existing Cloudflare Workers, budget limits, privacy controls, D1 analytics
and daily knowledge workflow remain unchanged.
