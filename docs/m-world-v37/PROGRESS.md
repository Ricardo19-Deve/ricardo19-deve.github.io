# M World V37 — minimal M settings

The owner requested a minimalist settings drawer instead of AI-play technical disclosures, daily discovery cards, story text and a character-reset button.

## Public interface
The separate ⚙ drawer now includes exactly two controls:
- **Memory · On / Off** — toggles existing local character-memory consent. Off clears stored M experiences and learned preferences.
- **AI play · On / Off** — pauses/resumes optional AI play without stopping local autonomous movement or portfolio Q&A.

Each control retains an accessible label and tooltip. No counters, detailed AI prose, source list, discovery of the day, narratives, reset button or gesture controls appear in public settings. Ask M remains content-only chat.

The existing V33 Wikipedia discovery feed, V34 truthful lived-story engine and V35 physical reactions continue **behind the scenes**. The original V6 31-bone character, the Cloudflare AI Worker, the analytics D1 Worker and API budgets remain untouched.

The optional `?m-debug=1` Dev tools panel retains character reset for explicit developer testing. It is separate from public settings.

## Acceptance
1. Open the public portfolio and hard-refresh.
2. Open ⚙ — see only **M settings**, Close, **Memory** and **AI play**.
3. Turn Memory Off — saved local character history must be cleared.
4. Turn AI play Off — local M behavior and Q&A must continue.
5. Verify the sourced daily discovery still influences M, without appearing in the chat/settings.
6. Confirm accessibility and layout on desktop/mobile.

CI tests cover interface construction and callbacks; browser visual confirmation remains necessary.
