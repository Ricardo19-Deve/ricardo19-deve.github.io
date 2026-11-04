# Activate M portfolio analytics in Cloudflare (production D1)

The production D1 database already exists:

- D1 name: `m-portfolio-analytics`
- D1 ID: `f0049534-9f80-4cf3-adb5-3e9e568e643a`
- Worker name: `m-portfolio-analytics`
- GitHub repository: `Ricardo19-Deve/ricardo19-deve.github.io`
- Worker root directory: **`analytics`** (not repository root)
- Runtime binding: `ANALYTICS_DB`
- Wrangler source: [`wrangler.toml`](wrangler.toml)

The ID above is not a secret. **Never commit the `ADMIN_TOKEN` value.**

## 1. Initialize database tables

The owner can use **Cloudflare Dashboard → D1 SQL Database → m-portfolio-analytics → Console** to execute the statements in
[`migrations/0001_daily_analytics.sql`](migrations/0001_daily_analytics.sql).
The SQL uses `IF NOT EXISTS` and is safe to rerun. Alternatively, using Wrangler from the `analytics` directory:

```sh
npx wrangler login
npx wrangler d1 migrations apply m-portfolio-analytics --remote
```

Using the dashboard console does not register an entry in the `d1_migrations` table. If you later apply the migration with Wrangler, `IF NOT EXISTS` means the schema commands still succeed and become formally tracked.

Verify via console:

```sql
SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('daily_sessions','daily_totals','daily_pages') ORDER BY name;
```

**Do not manually insert fabricated visits.**

## 2. Deploy Worker from GitHub (without local Node.js)

Go to **Cloudflare Dashboard → Workers & Pages → Create application → GitHub**.
Authorize the repo if prompted, then select `Ricardo19-Deve/ricardo19-deve.github.io`.

Use these settings:

| Setting | Value |
|---|---|
| Worker name | `m-portfolio-analytics` |
| Branch | `main` |
| Root directory | `analytics` |
| Build command | leave empty |
| Deploy command | `npx wrangler deploy` |
| Wrangler configuration | existing `analytics/wrangler.toml` |

Save and deploy. Workers Builds will find the Wrangler config in `analytics` and bind the existing D1. The Worker name **must** match the Wrangler `name` field. The Worker includes `worker.mjs`, `admin-page.mjs`, the migration files, and the nightly cleanup trigger.

**Important:** create a **new** analytics Worker; do not replace or edit the existing `m-portfolio-companion` AI Worker.

If the Cloudflare dashboard only offers *Create Worker* (not GitHub), use Workers & Pages → Create application → GitHub to import the repo as a new Workers project, or deploy from a terminal inside `analytics` with `npx wrangler deploy`.

## 3. Set administrator secret inside Cloudflare

In **Workers & Pages → m-portfolio-analytics → Settings → Variables and Secrets**, create a **Secret** named:

`ADMIN_TOKEN`

Use a strong random value, save it in your password manager, and deploy the secret update. Do not post or paste the value into chat, GitHub, JS, or a screenshot. This controls access to the private `/api/summary` endpoint.

Optional extra protection: use Cloudflare Access to restrict `/admin` for your own email if you have an appropriate domain.

## 4. Verify private Worker before starting tracking

Copy the **real**, Cloudflare-provided `workers.dev` URL for this Worker.

- `https://<actual-worker-url>/health` → JSON `{"service":"portfolio-analytics","ready":true}`.
- `https://<actual-worker-url>/api/summary` **without** Authorization → HTTP `401`.
- `https://<actual-worker-url>/admin` → the private dashboard, with password prompt. The UI should show zeros initially.

If `ready` is false, fix D1 binding or `ADMIN_TOKEN` secret before proceeding.

## 5. Activate frontend tracking *only when the Worker is live*

The public config file [`../m-analytics-config.mjs`](../m-analytics-config.mjs) intentionally currently contains:

```js
export const PORTFOLIO_ANALYTICS_ENDPOINT='';
```

Once the Worker is deployed, replace the empty string with the real public Worker URL plus `/api/visit`. The exact URL is provided by Cloudflare and must not be guessed. Commit to `main` to publish via GitHub Pages. The `ADMIN_TOKEN` must never be included in frontend code.

The client reports only first-party page paths and a short-lived anonymous tab-session ID. D1 stores aggregates and day-scoped session hashes; it stores **no IP, User-Agent, referrer, email, chat content or typed values**. Do Not Track and Global Privacy Control are respected. Counts are approximate; traffic can be inflated by bots, blockers can undercount, and sessions are **not unique visitors**.

## 6. Verify a real visit

Load `https://ricardo19-deve.github.io/` after GitHub Pages publishes the updated config, with tracking unblocked, then open `/admin` on the new analytics Worker to see real counts.

D1 Console verification:

```sql
SELECT * FROM daily_totals ORDER BY day DESC LIMIT 10;
```

Keep the AI Worker unchanged. Analytics is ready only after D1 tables, GitHub deployment, `ADMIN_TOKEN`, and the real frontend endpoint are all configured.
