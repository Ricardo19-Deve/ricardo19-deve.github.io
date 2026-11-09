# M — Automatic LinkedIn post synchronization (V61)

The account's existing `ricardo19-deve-github-io` analytics Worker reuses **one** Cron Trigger: `15 2,5,8,11,14,17,20,23 * * *` UTC (every three hours). It invokes `MLinkedInSyncService.refresh()` through a private Cloudflare Service Binding, with no public synchronization URL. The M Worker declares `triggers.crons=[]` to avoid exceeding the Cloudflare Free limit of five Cron Triggers. The browser does **not** need to be open.

## Data sources (in strict order)

1. **Official LinkedIn Posts API** (automatic discovery and updates). Requires a token that is specifically approved for restricted `r_member_social` and the owner's `urn:li:person:...`. This **cannot** be substituted with the existing DMA token, `w_member_social`, a public profile URL or a username.
2. **Existing LinkedIn EU/EEA Member Data Portability API** (`MEMBER_SHARE_INFO`). Works only with the owner's existing consent, and **only rows with explicit `PUBLIC`/`ANYONE`/`EVERYONE`** can be used. The ambiguous `MEMBER_NETWORK` field does not prove public visibility; these rows are never published.
3. **Previously owner-confirmed public posts**, maintained in `data/m-public-activity.json`. This remains a fallback only, not an automatic full-profile mirror.

The Worker checks both official sources (where configured), validates their results, merges verified records, and stores at most eight selected public posts in a private, short-lived Cloudflare Durable Object (four-hour expiry). There are no page scrapers, passwords, cookies, messages, contacts or private posts. Every Ask M publication question also performs a current-source check, with the short-lived cache used only during transient provider failures while valid permission exists. Access restrictions and non-public visibility fail closed.

## One-time setup for unrestricted automatic discovery

The LinkedIn developer application must **already have** access to restricted `r_member_social` before configuring the following Cloudflare Worker secrets/vars:

- `LINKEDIN_MEMBER_SOCIAL_ACCESS_TOKEN` — authenticated owner token with approved `r_member_social` (secret; never commit to GitHub).
- `LINKEDIN_MEMBER_PERSON_URN` — the matching application-scoped `urn:li:person:<member-id>` value. Do not substitute a profile handle or OpenID subject.
- Leave the existing `LINKEDIN_DMA_ACCESS_TOKEN` intact as a separately scoped fallback.

No new permission is automatically granted by deploying this code. If `r_member_social` is unavailable, the scheduled process can only discover posts that the existing DMA data **explicitly confirms as public**. If the DMA response contains `MEMBER_NETWORK` or no visibility, automatic discovery is deliberately blocked.

Once the owner authorizes the official source, updates need no manual GitHub action or copy/paste when posting on LinkedIn. Cloudflare runs every three hours, and new Ask M post queries can refresh an existing authenticated feed between runs. If the token expires or permissions are revoked, update/re-authorize it at the provider; no background process can bypass LinkedIn's consent and API restrictions.

## Configuration and verification

- Project: Cloudflare Worker `m-portfolio-companion`, with root directory `m-ai`.
- `m-ai/wrangler.jsonc`: `triggers.crons=[]`; `M_VERIFIED_POSTS` is the private, time-limited Durable Object. The `v2` migration creates its SQLite class.
- `wrangler.toml` (root analytics Worker) and `analytics/wrangler.toml` both keep a **single** shared Cron expression and bind `M_LINKEDIN_SYNC` to the private `MLinkedInSyncService` entrypoint. Existing analytics retention cleanup remains once daily at 02:15 UTC.
- Deploy using the **existing Cloudflare Workers Builds GitHub integration**, or an authorized Wrangler deploy with `--keep-vars` to preserve secrets and existing environment settings.
- Public `/health` remains backward-compatible. Add `?sync=1` to see bounded `memberPosts` official API status alongside `linkedin` (existing DMA). Neither endpoint exposes an access token, private data or post text.
- Verify both active Worker deployments, the shared analytics Cron trigger and Service Binding, the M Durable Object binding and the `memberPosts.enabled` field before claiming full automatic synchronization is active.
- Run `node --test m-ai/*.test.mjs analytics/m-linkedin-cron.test.mjs` for regression checks. The V61 suite covers authorization, source allowlists, privacy, cache expiry, Cron and public-post reply context.

## Official LinkedIn documentation

https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api

LinkedIn explicitly states that `r_member_social` is restricted and only available to approved users. This integration cannot manufacture that approval or discover private/unknown-visibility posts.
