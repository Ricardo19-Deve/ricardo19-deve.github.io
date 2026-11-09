import { createHandler, jsonResponse, readBoundedText } from './core.mjs';
import { QUOTA_POLICY, quotaWindows, createDurableQuota } from './quota.mjs';
import {readVerifiedPosts} from './verified-post-cache.mjs';
import {refreshAutomaticLinkedIn} from './automatic-linkedin.mjs';
export {MVerifiedPosts} from './verified-post-cache.mjs';

// The fetch interface intentionally avoids platform-only imports so its real SQL
// transaction logic can also be verified against Node's SQLite in offline tests.
export class PortfolioQuota {
  constructor(ctx) {
    this.storage = ctx.storage;
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS leases (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
  }
  async fetch(request) {
    if (request.method !== 'POST') return jsonResponse({ error: 'method' }, 405);
    let data;
    try { data = JSON.parse(await readBoundedText(request.body, 512)); } catch { return jsonResponse({ error: 'request' }, 400); }
    const path = new URL(request.url).pathname;
    if (path === '/release' && typeof data.token === 'string' && /^[a-f0-9-]{36}$/.test(data.token)) {
      this.sql.exec('DELETE FROM leases WHERE token = ?', data.token);
      return jsonResponse({ released: true });
    }
    if (path !== '/reserve' || typeof data.client !== 'string' || !/^[a-f0-9]{64}$/.test(data.client)
      || !['chat', 'director'].includes(data.scope ?? 'chat')
      || Object.keys(data).some(key => !['client', 'scope'].includes(key))) return jsonResponse({ error: 'request' }, 400);
    const now = Date.now();
    const result = this.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM counters WHERE expires <= ?', now);
      this.sql.exec('DELETE FROM leases WHERE expires <= ?', now);
      const active = this.sql.exec('SELECT count(*) AS total FROM leases').toArray()[0].total;
      if (active >= QUOTA_POLICY.concurrent) return { allowed: false, retryAfter: 30 };
      // General and director windows are checked and incremented in this one
      // transaction: rejected automatic requests spend neither allowance.
      const windows = quotaWindows(data.client, now, QUOTA_POLICY, data.scope ?? 'chat');
      for (const item of windows) {
        const row = this.sql.exec('SELECT count FROM counters WHERE key = ?', item.key).toArray()[0];
        if (row && row.count >= item.limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((item.expires - now) / 1000)) };
      }
      for (const item of windows) this.sql.exec('INSERT INTO counters (key, count, expires) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1', item.key, item.expires);
      const token = crypto.randomUUID();
      this.sql.exec('INSERT INTO leases (token, expires) VALUES (?, ?)', token, now + QUOTA_POLICY.leaseMs);
      return { allowed: true, token };
    });
    return jsonResponse(result);
  }
}

// Keep one handler per isolate for the additional local concurrency cap. The
// Durable Object still coordinates quotas and global leases across all isolates.
let lastEnv;
let handler;
export default {
  async fetch(request, env, ctx) {
    try {
      if (!handler || lastEnv !== env) { handler = createHandler({ env, quota: createDurableQuota(env.M_QUOTA), getCachedPublicPosts:()=>readVerifiedPosts(env) }); lastEnv = env; }
      // Cloudflare sets this header at its edge. Never use x-forwarded-for here.
      // Missing identity fails closed for paid POSTs (including unconfigured dev).
      const clientIp = request.headers.get('CF-Connecting-IP');
      if (['/api/m/respond', '/api/m/direct'].includes(new URL(request.url).pathname) && request.method === 'POST' && !clientIp) return jsonResponse({ error: { code: 'unavailable', message: 'AI chat is temporarily unavailable.' } }, 503);
      const pending = handler(request, { clientIp: clientIp || 'unknown' });
      // Keep cleanup alive briefly after disconnect so its Durable Object lease
      // can be released. The linked request signal still aborts the paid fetch.
      ctx?.waitUntil(pending.then(() => {}, () => {}));
      return await pending;
    } catch { return jsonResponse({ error: { code: 'unavailable', message: 'AI chat is temporarily unavailable.' } }, 503); }
  },
  async scheduled(_event,env,ctx){
    // The Cron is server-side: no visitor must keep the website open.
    // Only validated PUBLIC posts may enter the time-limited archive.
    const pending=refreshAutomaticLinkedIn(env);
    ctx?.waitUntil(pending);
    await pending;
  }
};;
