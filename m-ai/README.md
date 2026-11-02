# M portfolio companion backend

This optional backend connects the portfolio's M character to the OpenAI Responses API. The browser sends a request only when the visitor explicitly submits a chat message. Expressions and gestures are bounded animation suggestions for the character. They do not represent consciousness or actual emotions.

The public frontend endpoint points to the deployed Worker. Local scripted interactions still require no API traffic; only explicit chat submissions reach the API. The public browser config contains only a backend URL. **Never put an OpenAI key in HTML, JavaScript, GitHub Pages, a browser config, a screenshot, or Git.**

## Status and files

Deployed on 2 November 2026 to https://m-portfolio-companion.ricardopacheco-pinheiro.workers.dev with a SQLite Durable Object. The owner configured OPENAI_API_KEY directly as a Cloudflare secret; its value was never inspected. A real portfolio question and a real Chrome greeting both returned HTTP 200; the greeting requested a wave and the original rig performed it. Automated backend tests still use explicitly mocked responses and local SQLite. These tests are distinct from the recorded live checks.

- `core.mjs`: portable Request/Response handler, strict validation and fixed OpenAI upstream.
- `worker.mjs`: Cloudflare entrypoint and atomic SQLite quota class. Its only exports are the default handler and `PortfolioQuota`, as required by the native runtime; helper exports live in `quota.mjs`.
- `quota.mjs`: shared quota windows, Durable Object adapter/singleton and local-only memory adapter.
- `server.mjs`: loopback Node HTTP adapter for local development.
- `portfolio-context.mjs`: manually curated public facts from `../index.html`, reviewed 2026-10-31. Update this snapshot when the public page changes. Store-review claims are page snapshots, not live verification.
- `backend.test.mjs`: offline security, quota and HTTP tests.
- `wrangler.jsonc`: proposed Worker name and SQLite binding; no account identifiers or credentials.
- `.env.example`: empty key placeholder for local setup.

## Offline checks

Use Node 22.13 or later; the available validation runtime was Node 24.11.0. The SQLite test module may print Node's experimental-feature warning. No npm packages are needed for these checks.

```powershell
node --check m-ai/core.mjs
node --check m-ai/worker.mjs
node --check m-ai/server.mjs
node --test m-ai/backend.test.mjs
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

`GET /health` returns `{ "configured": boolean }` and no key/model/account details.

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

## Cost and abuse controls

Every Worker isolate reserves against the same named SQLite Durable Object, `m-portfolio-global-quota-v1`. Atomic SQL transactions enforce fixed UTC windows of 6 attempts per IP/minute, 40 per IP/hour, 60 globally/hour and 200 globally/day. Limits count attempts even if the provider fails. There is a global maximum of three active reservations, with 30-second expiry after crashes, plus a per-isolate concurrency cap. The 15-second upstream timeout and caller cancellation both abort the fetch; no automatic retries occur. Already-aborted requests never reserve quota or start the upstream. The Node adapter maps premature HTTP disconnects to cancellation while preserving normal request-body completion. The Worker keeps its cleanup promise alive with `ctx.waitUntil` after a disconnect. Cancellation frees active leases when the provider call settles; a quota reservation already in flight is released as soon as it returns. Counted attempts remain charged against request quotas, and cancelling a request does not guarantee that already-started provider work is unbilled. Quota service failures block AI calls. Never shard or rename the singleton casually: doing so resets the active budget scope.

These are request/token-size controls, not a monetary spend guarantee. Each request bounds input, history and output (`max_output_tokens: 700`); actual model pricing, tokenization and provider/account limits still determine cost. Review dedicated project spend settings before activation. Distributed attackers can exhaust the small global allowance and deny service to legitimate visitors. Fixed-window boundaries can allow a burst spanning two windows.

CORS and the Origin allowlist are browser controls, **not authentication**. Non-browser callers can spoof an allowed Origin. No authentication, CAPTCHA or Turnstile is claimed. If public abuse warrants additional protection, implement a verified challenge or access layer before raising quotas.

Cloudflare's edge-supplied `CF-Connecting-IP` is trusted only in the Cloudflare adapter; missing identity fails closed. The Node adapter uses socket IP. Never switch to trusting arbitrary `X-Forwarded-For`. Each operation creates a fresh request-scoped Durable Object stub for the same singleton. A failed or ambiguous reservation is never automatically retried, preserving counted attempts and avoiding a poisoned stub on later requests. The quota database stores counts, expiring leases and daily-scoped SHA-256 IP digests, not raw IPs or chat content. The date is public, so this is pseudonymization, not anonymization; guessed IPs may be correlated. Expired rows are removed on the next reservation. The source itself writes no prompt/key/IP logs; hosting-level telemetry and the provider have their own data handling.

## Privacy and grounding

Only explicit chat submissions and a bounded in-memory history are sent to this backend and OpenAI. Page browsing, pointer movement, idle behavior and local gestures do not require AI requests. Do not enter confidential or sensitive data. `store: false` disables Responses API application storage for these calls; it does not claim zero retention, because provider abuse-monitoring and account policies can still apply. This code does not persist chat or establish analytics identifiers.

Responses are grounded by a curated snapshot of already public portfolio facts, not private repositories or arbitrary website retrieval. The model has no tools. The upstream URL is fixed and HTTP redirects are handled manually then rejected, so the authorization header is never forwarded to a redirect destination. Prompt instructions and validation reduce accidental disclosure and invalid actions; they cannot prove factual accuracy of every natural-language sentence. Review representative answers about projects, employment, missing information and malicious instructions during the pending live evaluation.

Official references: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI API authentication](https://developers.openai.com/api/reference/overview), [gpt-5-mini model](https://developers.openai.com/api/docs/models/gpt-5-mini), [Cloudflare Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [SQLite Durable Object transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Cloudflare Request signals and redirect modes](https://developers.cloudflare.com/workers/runtime-apis/request/).
