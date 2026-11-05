# M World V38 — real card contact, weight and balance

## Goal

M must not seem to hover over every card. A reliable *actual* perch, already
confirmed by the original screen-space route planner, becomes an expressive
physical event on her original 31-bone V6 body: arrival, weight, balance,
calm breathing and a natural release.

## What was implemented

- `m-world-surface-contact.mjs`: a lightweight, bounded deterministic contact
  performer with phases **airborne → landing → perched → lifting**. It cannot
  invent ground contact. Only an explicit `attached===true` from the existing
  `perch` route while its physical arrival phase is `hold` triggers landing.
  A failed/missing or moved target immediately begins a smooth release.
- The original V6 body compresses very slightly on arrival; both legs and feet
  adjust and the ten original connected tail joints counterbalance. The
  landing bounce decays naturally into quiet breathing and gentle balance.
  Horizontal movement is **exactly zero inside the 3D pose**; scrolling,
  resizing, contact points, cards and absolute positioning remain exclusively
  controlled by the tested screen-space spatial planner.
- Integration uses a reversible `createGestureLayer` applied on top of the
  existing original skeleton after locomotion, gestures and V35 living motion.
  Each frame restores the previous additive rotations first. No alternative
  GLB, sprites, new geometry, simplified rig or external animation framework.
- Explicit gestures, the V32 full-body sleep and reduced-motion preference
  override contact. The effect is attenuated when a visitor is reading.
- The debug snapshot exposes `acting.cardContact` and
  `renderer.contact` (state, weight, landings). No new public UI or buttons.
  In particular **Ask M** still contains only portfolio questions and a
  message composer; ⚙ settings still has only Memory and optional AI play.
- The M entrypoint and first-party module URLs are synchronized to `v=43`.
  Cloudflare AI Worker, D1 analytics Worker, GitHub daily knowledge feed,
  local consent, remote AI request limits and original depth masks are untouched.

## How to verify

1. Load the updated portfolio and hard-refresh. With `?m-debug=1`, ask the
   existing *Dev tools* to perform a `perch` card route, or let M decide
   herself on a visible project card. Do **not** expect the landing effect for
   ordinary floating next to a card.
2. When the route becomes truly attached, look for a soft squat, tiny settling
   of the feet, tail counterbalance, then calm stationary breathing. The
   diagnostic `MWorld.snapshot().renderer.contact` should show `perched`
   and a nonzero weight only after genuine attachment.
3. Scroll while M is perched. She must remain attached to the same card, and
   the 3D stage must not introduce lateral drift.
4. When she takes off, the compression should fade smoothly. Moving/removing
   the card must release rather than leave her suspended in a fake pose.
5. Test physical sleep, intentional gestures, prefers-reduced-motion,
   card-depth reveal behind foreground surfaces and mobile browser.
6. Assess artistic naturalness and performance on a real Chrome/Safari device.
   Node tests cannot demonstrate 3D visual quality or mobile frame rate.

## Limits

This is *contact-aware body acting*, not a physics engine or biological life.
It depends on trusted existing card-attachment geometry and protects visitor
readability. It uses no extra network calls, personal information or AI tokens.
