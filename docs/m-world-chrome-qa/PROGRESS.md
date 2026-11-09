# M — Current Chrome contracts and mobile header touch

Prepared from published V60 `bef65c3` on `fix/m-world-current-chrome-qa`.
Rebased before publication review onto the newer owner-authorized LinkedIn
sync merge `9d6cc54`; all of those backend changes are preserved unchanged.
This is a focused UI/regression repair, with no new mascot behaviors, model,
animation, LinkedIn, provider, credential, quota or Worker changes.

## Observed failures and cause

Spatial CI `42610732430` failed three checks. The harness disabled the chat
endpoint, which intentionally hides its composer, then measured the hidden
controls. It also required invisible text meshes that V30 intentionally removed.
The current visual contract uses complete card silhouettes behind M and route
safety for text, not rectangular holes cut into the character.

Enabling a browser-local mock and actually submitting with Enter revealed a
separate mobile bug. After the reply refocused the textarea, the first tap on the
header menu blurred it. Synchronous viewport reframing moved the menu from Y20
to Y160 before the click was dispatched, so that click reached the background.
The isolated native event trace reproduced this with the actual companion/CSS.

## Change

- Refresh viewport on composer blur on the next animation frame. Focus still
  updates immediately, the fallback remains synchronous without RAF, and queued
  callbacks cannot mutate destroyed UI. The touch click reaches its control
  before layout changes. Entry/companion UI cache tags advance to61; the core
  runtime revision55 and stylesheet59 remain unchanged.
- Configure the smoke harness with a valid, entirely intercepted local endpoint.
  Check a real Enter submission, one586-character mock reply, readable space,
  viewport fit, reachable Send and the real internal Pause/Resume controls.
- Capture the planner's own pose before deliberate debug depth overrides.
  Require zero changed text-interior pixels in that planned behind-card reveal
  and in the forced behind view. Separately verify forced foreground has no
  text meshes/card meshes and no artificial text-shaped cutouts.
- Keep the existing pixel delta12 threshold and two-CSS-pixel inset. The forced
  foreground fixture is deliberately unsafe for text and is not evidence that
  all routes are safe. These checks cover the sampled real plan phase.

## Executed validation

- Full Node regression:713/713; companion tests44/44, including touch/blur
  ordering, next-frame settling and destruction. Cache and portfolio-markup
  preservation checks pass.
- Integrated regression after the unrelated backend update:721/721. The
  frontend files used for the native evidence are unchanged by that rebase.
- First native desktop/mobile run:30/31 before the product fix, desktop18/18;
  mobile stopped at the newly exposed menu tap. Initial evidence retained.
- Isolated mobile before/after trace: first tap changed from background click /
  hidden menu to header click / open menu.
- Only the affected full mobile profile was repeated after the fix:17/17 pass,
  including touch Pause/Resume, original rig/maps/clips, actual GPU card depth,
  live autonomy and Enter/readability. No duplicated combined perfect run.
- Desktop planned paragraph comparison:89,184 protected interior pixels,
  zero planned/behind changes. Original front model rendered without text-box
  cutouts. Screenshots were visually inspected.
- No real provider call was made. Tests use native Chrome156.0.8078.73 on
  Windows and emulated touch mobile; physical iPhone/Safari/OS keyboard checks
  remain required. No complete artistic or all-trajectory approval is claimed.

The initial sandbox-only Node attempt could not open loopback HTTP fixtures and
also exposed the cache-tag expectation; after the targeted cache test update,
the authorized loopback run passed713/713. All failures are preserved locally.

Native captures/reports are retained in the chat workspace under
`work/M_Current_20261109_QA/`; hosted CI uploads portable screenshots and the
full smoke report. Hosted checks must pass before asking for publication.

Suggested commit: `fix(m-world): preserve mobile header taps and align Chrome QA`.
Every new merge/publication requires explicit owner approval. No Worker deploy
is necessary for this change.
