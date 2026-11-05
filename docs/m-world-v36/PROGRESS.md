# M World V36 — Ask M serves portfolio questions only

## Owner's requirement
The M character must decide *her own* autonomous gestures, expressions, play and exploration. **Ask M exists to talk about the content of the portfolio**, not as a remote control for the mascot.

## Fixed
- Removed manual gesture buttons, extra gestures, face/emotion controls, game-start controls, AI-play status and story panels **from the public chat DOM**, not merely by setting the `hidden` attribute. The older CSS had `display:flex` rules that overrode `hidden` and allowed those supposed-to-be-hidden controls to appear. V36 explicitly applies `display:none!important` to hidden components as a safety net.
- The public **Ask M** now presents an introductory invitation to ask about Ricardo's work, a conversation history, the text composer and **Send**. The contextual-question request continues to include only validated public portfolio context; no UI gesture or untrusted action buttons.
- Assistant responses **can no longer command M's body or navigation**, even if an older Cloudflare AI response still supplies `gesture`, `expression` and `section` fields. Those fields are parsed for schema compatibility only. Only the M autonomy and separate director engines choose the character's actions.
- M memory and AI-play preferences remain accessible, but **outside the conversation**, from a discreet gear button next to the Ask M launcher. A separate panel contains the existing **Remember M on this device** switch (with cross-V31–V34 memory revocation), **Pause AI play**, **Reset character memory**, a minimal data/privacy explanation and the source-linked daily discovery if available. The existing `M · Pause` control is unaffected.
- **Developer diagnostics:** the pre-existing `?m-debug=1` route can still expose testing controls only when explicitly requested. It is not ordinary public UI and should not be used as the design reference. Chat replies never trigger the V6 rig, including in diagnostics.
- Conversation history remains only in the tab, no permanent chat logging added. Form fields and unsent drafts are not shared by AI play. All original high-fidelity rig, animation, depth, discovery, D1 and Cloudflare Worker code remain unchanged.
- First-party cache revision advanced to `v=41` to force the real public site to load corrected DOM/CSS.

## Acceptance
1. Open `https://ricardo19-deve.github.io/` (without `?m-debug=1`) and hard refresh.
2. Click **Ask M**. See only a clean conversation and **Send**. There must be **no** buttons named Wave / Curious / Surprised / Shy, AI play, More gestures, M's story or Expressions & play. The content chat must answer portfolio questions without physically commanding M.
3. Click the small **⚙** button near Ask M. Verify memory/pause/reset controls are separate from the conversation and remain accessible on mobile.
4. After asking about a project, confirm the text answer uses the public portfolio context, while M's autonomous movements and expressions continue independently.
5. In Chrome dev tools, a hidden element's computed display must remain `none`, even when other CSS rules give the class `display:flex`.
6. Regressions: no change in Cloudflare AI/analytics Workers, API budget, 31-bone V6 rig, V32 sleep, V30 occlusion or V35 physical intention.

Node/GitHub CI tests cover DOM structure, isolated settings, contextual Q&A, no forced physical callbacks, cache and CSS. Manual Chrome / mobile visual QA is still required.
