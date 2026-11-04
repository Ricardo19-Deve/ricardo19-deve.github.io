# M portfolio companion backend

This optional backend connects the portfolio's M character to the OpenAI Responses API. Chat requests are sent when the visitor explicitly submits a message. V23 also prepares an optional automatic animation director, disabled on the server by default. Expressions and gestures are bounded animation suggestions for the character. They do not represent consciousness or actual emotions.

The public frontend endpoint points to the deployed Worker. Local scripted interactions still require no API traffic. If an approved rollout enables automatic directing, a limited snapshot of public visible components can also reach the API. The public browser config contains only public endpoint and feature settings. **Never put an OpenAI key in HTML, JavaScript, GitHub Pages, a browser config, a screenshot, or Git.**

## V27 narration repair — prepared, not deployed

The next build derives a strict encounter interpretation alongside the validated
context. Discovery location/route/time remain unknown; the active card is not
proof of a past event. Portuguese phrasing uses approved everyday words rather
than internal English IDs. Navigation suggestions require explicit intent in the
latest message; a narrowed schema and postvalidation gate suppress unsolicited
sections without replacing the ordinary provider reply. Input/output contracts,
model, secret and quotas remain unchanged. Eleven targeted offline regressions
cover this policy. Real prose quality still requires bounded evaluation after an
explicitly approved Worker rollout; no paid request was made in V27 development.

## V26 character continuity — published

V26 was published through PR #10 on 4 November 2026, Worker version
fee8d7fc-5d66-45cb-b370-5af0d0e20b7d. The build adds a bounded authored character context for M's fictional identity,
goal and remembered discovery. It does not add server-side story storage, raw chat
persistence, a new model, a new API key or an increased request allowance. Character
state is local encounter data, not verified global history or proof of visitor identity.

The new health response advertises `character: { version: 1 }`. New clients send
character data only after this capability is present. An older deployed Worker
continues receiving the exact old request shapes; its absence is not treated as
an error. Component-aware chat capability remains independent.

- Chat accepts optional `context.character`.
- Directing accepts optional top-level `character` beside the existing `snapshot`.
- The four-field chat and five-field director response schemas are unchanged.
- Both routes use the same authored identity and a strict shared validator in
  `../m-world-character-context.mjs`.
- The client includes used character state in its meaningful-context fingerprint
  and rejects stale responses when that state changes, without resetting quota.
- Only approved enum values and curated public component IDs cross this boundary;
  arbitrary diary strings, raw chat memory, visitor IDs and private fields are rejected.

The initial chapter is `small-light`: `seeking` / `follow-light` / no discovery;
`returning` / `find-lookout` / `little-light`; then `complete` / `explore` or a
returning-visit `revisit-lookout`, with the quiet-lookout preference. These are
validated cross-field states, not a request to create or complete an adventure.
Model phrasing must not invent a completed beat or rewrite M's authored identity.

Offline fixtures cover old/new capability negotiation, invalid private fields,
character changes during an in-flight response, unchanged model/schema, and the
same six-attempt / 65-second client allowance plus existing server quota tests.
Any Worker update or public rollout still requires explicit owner approval.

## Status and files

Deployed on 2 November 2026 to https://m-portfolio-companion.ricardopacheco-pinheiro.workers.dev with a SQLite Durable Object. The owner configured OPENAI_API_KEY directly as a Cloudflare secret; its value was never inspected. A real portfolio question and a real Chrome greeting both returned HTTP 200; the greeting requested a wave and the original rig performed it. Automated backend tests still use explicitly mocked responses and local SQLite. These tests are distinct from the recorded live checks.

- `core.mjs`: portable Request/Response handler, strict validation and fixed OpenAI upstream.
- `worker.mjs`: Cloudflare entrypoint and atomic SQLite quota class. Its only exports are the default handler and `PortfolioQuota`, as required by the native runtime; helper exports live in `quota.mjs`.
- `quota.mjs`: shared and director quota windows, Durable Object adapter/singleton and local-only memory adapter.
- `director.mjs`: bounded automatic intent prompt and operation; shares the existing HTTP, abort, timeout and quota lifecycle in `core.mjs`.
- `../m-world-director-protocol.mjs`: shared exact-key request/reply validators and a dynamic strict schema.
- `server.mjs`: loopback Node HTTP adapter for local development.
- `portfolio-context.mjs`: manually curated public facts from `../index.html`, reviewed 2026-10-31. Update this snapshot when the public page changes. Store-review claims are page snapshots, not live verification.
- `backend.test.mjs`: original offline chat security, quota and HTTP regressions.
- `director.test.mjs` and `../m-world-director-protocol.test.mjs`: offline automatic request, protocol, cancellation and persistent quota checks.
- `wrangler.jsonc`: proposed Worker name and SQLite binding; no account identifiers or credentials.
- `.env.example`: empty key placeholder for local setup.

## Offline checks

Use Node 22.13 or later; the available validation runtime was Node 24.11.0. The SQLite test module may print Node's experimental-feature warning. No npm packages are needed for these checks.

```powershell
node --check m-ai/core.mjs
node --check m-ai/worker.mjs
node --check m-ai/server.mjs
node --test m-ai/backend.test.mjs m-ai/director.test.mjs m-world-director-protocol.test.mjs
```

## Local development

1. From the portfolio directory, copy `m-ai/.env.example` to `m-ai/.env`.
2. Set `OPENAI_API_KEY` locally in that ignored file using your own dedicated project key. Do not paste it into chat. Leave it blank to test the unavailable state.
3. Start the backend:

```powershell
node --env-file=m-ai/.env m-ai/server.mjs
```

4. Keep the portfolio static server on `http://localhost:4183` or `http://127.0.0.1:4183`.
5. Set the browser's public endpoint to `http://127.0.0.1:4184/api/m/respond` in the frontend configuration. The key remains in the backend process.
6. Open `http://127.0.0.1:4184/health`. `{ "configured": false }` means the backend has no usable key/configuration. `{ "configured": true }` reports presence of required configuration only; it does not verify the credential, model access, credit or provider availability.
7. Submit one short portfolio question to perform a live check only after you deliberately provide a key. API usage may incur charges. This live step was not run during implementation.

The Node adapter binds only to `127.0.0.1`, uses direct socket identity, and ignores forwarded-IP headers. Its quotas are in memory, reset on restart, and apply to one process. It is for local development only. Do not expose it as a public multi-process or serverless backend.

## Cloudflare setup and maintenance

The initial deployment was explicitly approved. The procedure below is retained for maintenance or an explicitly approved new deployment. In particular, `wrangler secret put` immediately deploys a new Worker version; it is not a read-only preparation step.

1. Select the intended Cloudflare account and review its Workers/Durable Objects plan and costs. No plan or paid service has been activated here.
2. Review the proposed Worker name `m-portfolio-companion` in `m-ai/wrangler.jsonc`. The compatibility date is `2026-10-30`, the latest date supported by the bundled local workerd validation runtime; advance it only after validating a newer runtime. The quota binding is `M_QUOTA` with SQLite class `PortfolioQuota`. The `enable_request_signal` compatibility flag enables caller-disconnect propagation.
3. Review `PORTFOLIO_ORIGIN` against the exact public portfolio origin. It defaults to `https://ricardo19-deve.github.io`. Do not add a path or trailing slash. Two local origins on port 4183 are also explicitly allowed.
4. Use the Cloudflare dashboard or an installed Wrangler CLI to create a server-side secret named `OPENAI_API_KEY` for this Worker. Use a dedicated key with only the required project permissions. Do not add it under `vars` or copy it into a public file. For local Wrangler development, use an ignored `m-ai/.dev.vars` file containing the key; the local Node adapter uses `.env` instead.
5. Deploy only after explicit deployment approval. From `m-ai`, the standard Wrangler deployment command is `wrangler deploy`. This publishes the Worker and provisions its configured Durable Object namespace. The approved initial deployment has been executed. With a new account, Wrangler may require creating the Worker before adding its secret; keep the frontend endpoint empty until the secret and health checks are ready. Without the key, paid requests fail closed.
6. The verified current hostname is `m-portfolio-companion.ricardopacheco-pinheiro.workers.dev`; hostnames for another account must be obtained from its actual deployment. After deployment, verify its `/health`, origin rejection, request limits, real response shape, timeout/refusal handling and Cloudflare logs/settings. Disable request-body/header logging in any account-level integrations as well.
7. Put only the verified HTTPS URL ending in `/api/m/respond` into the portfolio's public config. Test from the public portfolio and on an actual mobile device before publishing that frontend configuration.

`wrangler.jsonc` uses the documented `new_sqlite_classes` migration mechanism, which remains supported. Current Cloudflare docs also describe the newer declarative `exports` mechanism; use one lifecycle mechanism consistently, never both. No route, custom domain or account identifier is guessed.

## HTTP contract

`GET /health` returns `{ "configured": boolean, "director": { "version": 1, "enabled": boolean }, "contextualChat": { "version": 1 }, "character": { "version": 1 } }` in the prepared V26 build, and no key/model/account details. The director reports enabled only when the normal backend configuration is present and `AI_AUTOPLAY_ENABLED` is exactly the string `true`. An old deployed backend without this capability must leave automatic requests disabled.

`POST /api/m/respond`, with an allowlisted `Origin` and `Content-Type: application/json`:

```json
{
  "message": "What are Ricardo's main skills?",
  "history": [{ "role": "user", "content": "Hello M" }],
  "context": { "section": "expertise", "language": "en" }
}
```

Input limits: 8KB encoded body; 1–1200 characters in the message; at most six history entries containing only `user` or `assistant` roles, each 1–600 characters; language `en` or `pt`. Context sections are `none`, `home`, `hero`, `about`, `experience`, `projects`, `expertise`, `certifications`, `contact`. All object fields are validated and unknown fields are rejected. Truncate a 700-character assistant reply to 600 characters before sending it back as history.

A successful response contains exactly:

```json
{
  "reply": "Ricardo works with Salesforce, integrations, software and cloud/AI projects.",
  "expression": "neutral",
  "gesture": "none",
  "section": "expertise"
}
```

- `reply`: plain text, 1–700 characters; no executable content or arbitrary links.
- `expression`: `neutral`, `happy`, `curious`, `surprised`.
- `gesture`: `none`, `wave`, `curious`, `surprised`, `shy`.
- `section`: `none`, `about`, `experience`, `projects`, `expertise`, `contact`.

The frontend must render the reply as text and independently validate the enum fields. A section is a suggestion for a fixed local section control; it never grants the model arbitrary navigation, URLs, scripts or selectors.

Errors use `{ "error": { "code": "...", "message": "..." } }`. Statuses include 400 invalid input, 403 disallowed origin, 413 body limit, 415 media type, 429 quota/concurrency limit, 499 caller cancellation, 502 provider/output failure, 503 unavailable configuration/quota service and 504 timeout. No provider response body, prompts, API key or exception details are returned or logged. An explicit provider refusal produces a static neutral portfolio redirection. Provider failures do not pretend that an AI answer succeeded.

## Optional automatic director (V23, published)

`AI_AUTOPLAY_ENABLED=false` is saved in the example environment and Worker configuration. V23 was published with the explicitly approved true override on 2 November 2026; the existing secret was preserved and two real provider checks passed. The checked-in false value remains the maintenance-safe default. Reuse the existing server-side secret; do not create a browser key or change backend hostnames.

`POST /api/m/direct` uses the same Origin allowlist, JSON media type, 8KB body cap, upstream URL, model default, no-tools policy, `store: false`, cancellation, timeout, cleanup, errors and concurrency pool as chat. The request has exactly one top-level key:

```json
{
  "snapshot": {
    "revision": "view-7",
    "section": "projects",
    "language": "en",
    "event": "pointer-interest",
    "attentionId": "project-bloom",
    "targets": [
      {
        "id": "project-bloom",
        "kind": "project",
        "title": "Magnet Bloom",
        "actions": ["peek", "perch"],
        "zone": "middle-right"
      }
    ],
    "recent": [{ "targetId": "portrait", "action": "inspect" }]
  }
}
```

Snapshots contain at most eight public visible feasible components and six recent actions. Titles are public headings of 1–80 characters, with no control characters. IDs and revisions are 1–64 ASCII letters/digits/colon/underscore/hyphen, beginning with a letter or digit. IDs are opaque local references, never selectors. `attentionId` is null or one current target ID. Sections use the existing chat context enum, and language is en/pt. No full DOM, page text, form contents, chat/history, pointer coordinates, arbitrary URL or analytics identifier is accepted.

- Events: `idle`, `section-change`, `arrival`, `pointer-interest`, `tap`.
- Kinds: `portrait`, `project`, `experience`, `expertise`, `certificate`, `contact`, `about`.
- Zones: the nine top/middle/bottom and left/center/right combinations, such as `top-left`.
- Offered actions: one or more unique values from `peek`, `perch`, `orbit`, `inspect`, `rest`.

The response has exactly five fields:

```json
{
  "snapshot": "view-7",
  "targetId": "project-bloom",
  "action": "peek",
  "gesture": "playful",
  "expression": "happy"
}
```

The schema narrows the revision, target IDs and action vocabulary to the submitted snapshot. Independent validation also checks that the selected action was offered by that exact target. New director gestures are `playful`, `wink`, `nod`, alongside `none`, `wave`, `curious`, `surprised`, `shy`; expressions remain `neutral`, `happy`, `curious`, `surprised`. A provider refusal returns a quiet `targetId: null, action: rest, gesture: none, expression: neutral` with the current revision. Invalid, incomplete or stale provider output fails closed. The public chat response remains the original four fields and original gesture enum for staged frontend/backend compatibility.

Every field is untrusted public data. The model has no access to forms or the visitor's thoughts and cannot execute anything. The browser must independently reject a reply after its snapshot changes and rerun its current visibility, collision and motion planner before accepting an intent. Browser policy adds a maximum of six attempts per session and at least 65 seconds between attempts; server quotas do not trust these client counters.

## Cost and abuse controls

Every Worker isolate reserves against the same named SQLite Durable Object, `m-portfolio-global-quota-v1`. Atomic SQL transactions enforce fixed UTC windows of 6 attempts per IP/minute, 40 per IP/hour, 60 globally/hour and 200 globally/day across both routes. Automatic directing also has fixed UTC fair-share windows of 1 attempt per IP/minute, 20 globally/hour and 80 globally/day. One transaction checks and charges both the director and overall counters; a quota rejection increments neither. The same existing singleton and database retain all counters across Worker recreation, without a reset or a new Durable Object migration. Limits count attempts even if the provider fails. There is a global maximum of three active reservations, with 30-second expiry after crashes, plus a per-isolate concurrency cap. The 15-second upstream timeout and caller cancellation both abort the fetch; no automatic retries occur. Already-aborted requests never reserve quota or start the upstream. The Node adapter maps premature HTTP disconnects to cancellation while preserving normal request-body completion. The Worker keeps its cleanup promise alive with `ctx.waitUntil` after a disconnect. Cancellation frees active leases when the provider call settles; a quota reservation already in flight is released as soon as it returns. Counted attempts remain charged against request quotas, and cancelling a request does not guarantee that already-started provider work is unbilled. Quota service failures block AI calls. Never shard or rename the singleton casually: doing so resets the active budget scope.

These are request/token-size controls, not a monetary spend guarantee. Each request bounds input, history and output (`max_output_tokens: 700`); actual model pricing, tokenization and provider/account limits still determine cost. Review dedicated project spend settings before activation. Distributed attackers can exhaust the small global allowance and deny service to legitimate visitors. Fixed-window boundaries can allow a burst spanning two windows.

CORS and the Origin allowlist are browser controls, **not authentication**. Non-browser callers can spoof an allowed Origin. No authentication, CAPTCHA or Turnstile is claimed. If public abuse warrants additional protection, implement a verified challenge or access layer before raising quotas.

Cloudflare's edge-supplied `CF-Connecting-IP` is trusted only in the Cloudflare adapter; missing identity fails closed. The Node adapter uses socket IP. Never switch to trusting arbitrary `X-Forwarded-For`. Each operation creates a fresh request-scoped Durable Object stub for the same singleton. A failed or ambiguous reservation is never automatically retried, preserving counted attempts and avoiding a poisoned stub on later requests. The quota database stores counts, expiring leases and daily-scoped SHA-256 IP digests, not raw IPs or chat content. The date is public, so this is pseudonymization, not anonymization; guessed IPs may be correlated. Expired rows are removed on the next reservation. The source itself writes no prompt/key/IP logs; hosting-level telemetry and the provider have their own data handling.

## Privacy and grounding

Explicit chat submissions and bounded in-memory chat history are sent to this backend and OpenAI. If the separately gated automatic director is enabled, a bounded snapshot of public component headings/kinds/zones and recent actions is also sent. Raw pointer movement, full page contents, form fields and private chat are excluded from that snapshot; ordinary local animation still requires no AI request. Do not enter confidential or sensitive data. `store: false` disables Responses API application storage for these calls; it does not claim zero retention, because provider abuse-monitoring and account policies can still apply. This code does not persist chat or establish analytics identifiers.

Responses are grounded by a curated snapshot of already public portfolio facts, not private repositories or arbitrary website retrieval. The model has no tools. The upstream URL is fixed and HTTP redirects are handled manually then rejected, so the authorization header is never forwarded to a redirect destination. Prompt instructions and validation reduce accidental disclosure and invalid actions; they cannot prove factual accuracy of every natural-language sentence. Review representative answers about projects, employment, missing information and malicious instructions during the pending live evaluation.

Official references: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI API authentication](https://developers.openai.com/api/reference/overview), [gpt-5-mini model](https://developers.openai.com/api/docs/models/gpt-5-mini), [Cloudflare Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [SQLite Durable Object transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Cloudflare Request signals and redirect modes](https://developers.cloudflare.com/workers/runtime-apis/request/).


## V24 contextual chat (published 3 November 2026)

The V24 Worker was explicitly approved and deployed as version
`ee7eab6d-aaa6-427f-bcea-788ef0d86c2b`, preserving the existing true automatic-AI
override, secret and quota namespace. Its health reports contextual-chat version 1.
One real Epoxy request returned a correctly grounded four-field HTTP 200 response.

The public four-field chat response is unchanged. A new request may add the
optional field context.component, containing a stable ID from the fixed public
catalogue in ../m-world-context.mjs, or null. The old two-field context remains
valid. Extra metadata, unknown IDs, arbitrary titles, HTML and form values are
rejected before quota reservation.

The frontend checks the free /health capability contextualChat.version===1
before including the component. Older Workers receive the old request contract.
An accepted contextual reaction owns its expression and gesture once; legacy
callbacks do not cancel the new sequence. New typing interrupts the reaction;
automatic focus on the empty chat field after a response does not.

The active catalogue component and its existing verified portfolio facts anchor
references such as 'this project'. The model receives no live DOM or private
repository data. Missing facts remain unknown; project status remains a public
snapshot. Component focus can orient M locally without clicking or navigating.

V24 implementation tests mock the provider. The Worker has only been bundled
with --dry-run in this phase. Deployment, one real contextual request and
frontend publication remain separate approval steps. Keep the existing model,
secret, Origin allowlist, SQLite singleton and request budgets.
