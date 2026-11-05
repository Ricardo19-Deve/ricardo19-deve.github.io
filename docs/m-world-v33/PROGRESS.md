# M World V33 — daily world discoveries with source attribution

## Implemented

1. **Daily public knowledge** — GitHub Actions runs `scripts/update-m-world-daily.mjs` at 07:17 UTC, with manual dispatch and a one-time push trigger when the workflow first reaches `main`. The script fetches the English Wikipedia/Wikimedia **On this day / selected** feed once, validates its structure, rejects violent/political or malformed candidates, and stores at most **one sourced title/year/article link/topic** in `data/m-world-daily.json`. It never copies full Wikipedia text.
2. **No paid AI growth loop** — this is a centralized GitHub job, not an outbound request per visitor. No new OpenAI API calls, Cloudflare Workers, D1 bindings, visitor tracking, geolocation or chat messages.
3. **Safe retrieval** — the browser reads the local GitHub Pages JSON once. If it is still yesterday's version, it can retrieve the latest exact same JSON from the repository's `raw.githubusercontent.com` URL, with `credentials: 'omit'` and no referrer. That fallback is essential because GitHub Actions commits made with `GITHUB_TOKEN` **do not automatically trigger a new branch-source GitHub Pages build**. The browser never calls Wikimedia directly.
4. **Strict date and source validation** — the M runtime accepts only the current Lisbon calendar day's source, a canonical Wikipedia article URL, a whitelisted topic, a valid year, and bounded plain title. Stale/offline/untrusted data is ignored completely. There is no hallucinated fallback fact.
5. **Curiosity and local learning** — a verified discovery subtly influences M's existing safe `think` / `inspect` / `observe` / playful scene choices based on topic. The existing action-safety, reading, visibility, reduced-motion and cost constraints remain authoritative. When Remember M is on, the character records only a topic category and unique day identifier locally; a later day can reflect previous interests. Disabling Remember M clears this record.
6. **Minimal UI** — Ask M remains a questions-first experience. A small collapsed **M's discovery today** section shows the topic, article title and a direct Wikipedia source link. No new gesture buttons or prompts to remote AI.
7. **Original actor preserved** — V6 31 bones, tail rig, skin, animations, depth masking, physical rest and the private analytics D1 are unchanged. Cache version 38 loads the new runtime.

## Attribution and limits

World facts originate from **Wikipedia (On this day)** and remain attributed with direct URLs; Wikipedia contributors and articles may be edited and are not independently fact-checked by M. Treat this as a short, sourced discovery, not as verification of breaking news. No political persuasion or dangerous content is intentionally selected, but programmatic filtering is not a perfect editorial process.

M's new "learning" is **local topic interest and choice adaptation**, not retraining the OpenAI model, browsing the Internet independently, or storing common knowledge shared by visitors. The GitHub Actions schedule requires an enabled workflow and repository permissions (`contents: write`). GitHub may delay or skip a scheduled run. If a day lacks a valid feed, M simply continues her existing autonomous local life.

### Verification

- GitHub → Actions → **M World — verified daily discovery**: check whether the run completed and whether `data/m-world-daily.json` has today's date.
- Visit `https://ricardo19-deve.github.io/?m-debug=1`, then inspect `MWorld.snapshot().character.world` in browser diagnostics. Do not expect a sourced discovery until the workflow successfully publishes the feed.
- Ask M → **M's discovery today** opens the Wikipedia article when valid feed is present.
- Disable Remember M via Ask M → Privacy. The local `m-world-knowledge-v33` storage key must disappear and not be recreated without opt-in.
- Native Chrome / Safari / iPhone tests remain required for art/UX. Automated test passes do not prove animation looks natural.

The `m-portfolio-companion` AI Worker and `ricardo19-deve-github-io` analytics Worker remain **untouched**.
