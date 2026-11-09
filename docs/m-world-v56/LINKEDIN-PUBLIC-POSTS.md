# M V56 — public LinkedIn post reader: real archive compatibility

## What happened

Three days after LinkedIn authorization, the owner reported Ask M returning
"snapshot without recognizable entries" while asking for the last post.
The Cloudflare Worker was reaching LinkedIn; the previous source validator
rejected formats that occur in genuine LinkedIn share exports.

**Confirmed code defects, not a proven LinkedIn outage:**

1. The V45 date parser accepted ISO dates, but wrongly required a `Z` or
   timezone offset whenever hours/minutes were present. Real
   `Shares.csv` exports use timestamps such as `2026-11-05 15:44:45`
   (UTC without a suffix).
2. The URL allowlist accepted raw `urn:li:share:...` paths, but not
   LinkedIn's percent-encoded post URLs such as
   `https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A...`.
   These are now decoded exactly once, checked against an exact allowed
   post path, normalized to `https://www.linkedin.com` and stripped of
   tracking query parameters.
3. Public reposts with an empty `ShareCommentary` were discarded even
   if their audience, share link and date were verifiable. The reader now
   identifies these accurately as a public share **without original
   commentary**, without inventing the reposted article.
4. Posts longer than 1,500 characters were dropped; the reader now
   returns an explicitly truncated excerpt within the bounded context.

## Owner's privacy restriction remains absolute

The M app only requests the owner's `MEMBER_SHARE_INFO` domain.
Only records explicitly `PUBLIC`, `EVERYONE` or `ANYONE`
are eligible. In particular `MEMBER_NETWORK`, `CONNECTIONS`,
`PRIVATE`, `LOGGED_IN`, unknown or absent visibility are excluded.

The fix **does not** query inbox, contacts, followers, company pages,
profile data, reactions, comments or any additional LinkedIn domain.
The secret remains exclusively in Cloudflare, and raw snapshots never
enter OpenAI or the browser.

## What the new status means

- `ready`: one or more public rows with valid post date/link.
- `empty`: API returned zero share rows in the requested domain.
- `no-public-posts`: rows were returned, but **none explicitly public**.
  This is a privacy boundary, not a technical bug or proof no posts exist.
- `unrecognized-public`: public rows were returned, but their date/link
  still could not be safely verified. The parser needs more validation.
- `not-ready`: initial API request returned HTTP 404, ambiguous between
  a snapshot not yet prepared and no data for the domain.
- `not-authorized`: LinkedIn returned 401/403.
- Other V48 statuses remain unchanged.

**Cache safety:** unlike earlier code, once LinkedIn fails to revalidate
public posts or the snapshot changes, the Worker immediately drops the
previous in-memory verified-post list rather than continuing to expose
stale data indefinitely.

## Validation and deployment

`m-ai/linkedin-v56-real-snapshot.test.mjs` has mocked end-to-end
fixtures reflecting public share export columns, encoded URLs, UTC
timestamps, empty repost commentary, lengthy text, restricted-only
content, malformed links, private data exclusion, and post cache
invalidation. Original LinkedIn security tests also remain active.

**698 / 698 Node regression tests passed** in GitHub Actions on commit
`6b11a732`. This validates the parser against known and simulated
structures. It **does not confirm** that the actual owner's LinkedIn
snapshot contains publicly visible posts.

After merging to GitHub `main`, Cloudflare Workers Builds should
update `m-portfolio-companion` automatically. Ask M again about
the latest LinkedIn post. If the answer is `no-public-posts`, check
that at least one LinkedIn share has audience **Anyone**, not just
connections. If it is `unrecognized-public`, inspect the exact
response shape **only within the owner's secure environment** —
do not share a raw token, whole snapshot, private posts or metadata.
