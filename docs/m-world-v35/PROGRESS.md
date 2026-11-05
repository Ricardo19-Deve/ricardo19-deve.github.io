# M World V35 — body language, real anticipation and spontaneous living gestures

## What V35 adds

The V34 M could successfully build an autonomous story, but the story was more visible in the UI than in the original Blender model. V35 makes real intentions and completed discoveries **visible in M's body** while keeping the original V6 asset.

- **Before moving:** as she enters the approach phase, M's head and neck lead toward the next destination before her torso begins to move. The reaction is directional, softened with a small response lag instead of a stiff rotation.
- **While exploring:** gaze follows real target/ball/light coordinates already provided by the movement controller. Two ears act asymmetrically; the original ten connected tail joints receive a small travelling motion, without mesh replacement or clip reconstruction.
- **Quiet independent moments:** M can listen, glance, notice or ponder during natural pauses. Durations and intervals vary per page visit. They are restrained when a visitor is reading and not tied to a repeating fixed loop.
- **Embodied story reactions:** only when the existing autonomy engine **acknowledges a successful, completed action** in the V34 story, M expresses a short corresponding beat with the original head/neck/ears/tail plus existing facial affect. A cancelled or unsuccessful action cannot trigger it.
- **Protected priority:** explicit gestures, V32 physical sleep, reduced-motion preference and original action/depth rules suppress this micro-acting. Nothing can force a new route, displace cards, inject an AI command or change navigation decisions.
- **Technical implementation:** a dedicated reversible three.js additive bone layer uses the same `createGestureLayer` contract as the existing physical gesture system. It *prepares* to undo last frame before the original animation updates, then applies the small new offset once. Max bone angles are capped and stage offsets stay under ~0.03 radians, protecting the V6 framing.
- **Cost and privacy:** no new Cloudflare Workers, OpenAI calls, data storage, visitor identity, telemetry, remote third-party services or secrets. M's 31-bone, high-fidelity multi-weight skinned GLB remains untouched. New module `m-world-living-performance.mjs` is local, deterministic when seeded for tests, and randomized across real visits.
- **Cache:** all imported M modules and the homepage link to `m-world.css` load `v=40`.

## How to verify

1. Load the official site after GitHub Pages publishes the merged commit; hard-refresh with Ctrl+Shift+R.
2. Let M explore autonomously. Look for a head glance and ear motion *before* movement, and naturally spaced micro-reactions during quiet moments.
3. Check `MWorld.snapshot().renderer.livingPerformance` with `?m-debug=1`; it exposes the active mode, gaze lag, completed idle performances and reaction amplitude.
4. Observe the existing sourced discovery story after **real** autonomous actions: its notice/explore/reflect receipts should cause brief physical body language.
5. Trigger Sleep, Hop and Think in developer diagnostics; original authoring must still take precedence. Verify `prefers-reduced-motion`, typing, reading, card depth and physical phone/browser behavior.
6. Watch GPU frame rates and the V6 fidelity in real Chrome/Safari. Automated Node tests do not establish artistic quality or in-browser FPS.

**Honesty:** V35 produces a more coherent simulation of independent life. It does not create consciousness, retrain a foundation model, or promise unrestricted autonomous exploration of the Web. The safe V33 world feed and V34 validated lived experiences continue unchanged.
