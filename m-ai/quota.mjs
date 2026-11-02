import { readBoundedText } from './core.mjs';

// Fixed request quotas are conservative attempt limits, not a currency budget.
export const QUOTA_POLICY = Object.freeze({ ipMinute: 6, ipHour: 40, globalHour: 60, globalDay: 200, concurrent: 3, leaseMs: 30000 });
export function quotaWindows(client, now, policy = QUOTA_POLICY) {
  return [
    { key: `ip-minute:${client}:${Math.floor(now / 60000)}`, limit: policy.ipMinute, expires: (Math.floor(now / 60000) + 1) * 60000 },
    { key: `ip-hour:${client}:${Math.floor(now / 3600000)}`, limit: policy.ipHour, expires: (Math.floor(now / 3600000) + 1) * 3600000 },
    { key: `global-hour:${Math.floor(now / 3600000)}`, limit: policy.globalHour, expires: (Math.floor(now / 3600000) + 1) * 3600000 },
    { key: `global-day:${Math.floor(now / 86400000)}`, limit: policy.globalDay, expires: (Math.floor(now / 86400000) + 1) * 86400000 }
  ];
}

// Local development only. A restart resets these counters; never use this for a public Worker.
export class MemoryQuota {
  ready = true;
  constructor({ now = Date.now, policy = QUOTA_POLICY } = {}) { this.now = now; this.policy = policy; this.counters = new Map(); this.leases = new Map(); }
  async reserve(client) {
    const now = this.now();
    for (const [key, value] of this.counters) if (value.expires <= now) this.counters.delete(key);
    for (const [key, expires] of this.leases) if (expires <= now) this.leases.delete(key);
    if (this.leases.size >= this.policy.concurrent) return { allowed: false, retryAfter: 30 };
    const windows = quotaWindows(client, now, this.policy);
    const blocked = windows.find(item => (this.counters.get(item.key)?.count || 0) >= item.limit);
    if (blocked) return { allowed: false, retryAfter: Math.max(1, Math.ceil((blocked.expires - now) / 1000)) };
    for (const item of windows) this.counters.set(item.key, { count: (this.counters.get(item.key)?.count || 0) + 1, expires: item.expires });
    const token = crypto.randomUUID();
    this.leases.set(token, now + this.policy.leaseMs);
    return { allowed: true, token };
  }
  async release(token) { this.leases.delete(token); }
}

// One namespace ID is shared by every Worker isolate. Do not shard this name:
// global cost limits and active leases must be coordinated in one SQLite object.
export const QUOTA_OBJECT_NAME = 'm-portfolio-global-quota-v1';
const INTERNAL_ORIGIN = 'https://quota.internal';

export function createDurableQuota(binding) {
  if (!binding?.idFromName || !binding?.get) return { ready: false };
  const stub = binding.get(binding.idFromName(QUOTA_OBJECT_NAME));
  const call = async (path, body) => {
    const result = await stub.fetch(`${INTERNAL_ORIGIN}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(2000) });
    if (!result.ok) throw new Error('quota unavailable');
    const value = JSON.parse(await readBoundedText(result.body, 1024));
    if (path === '/reserve' && (typeof value.allowed !== 'boolean' || (value.allowed && !/^[a-f0-9-]{36}$/.test(value.token)))) throw new Error('invalid quota');
    return value;
  };
  return {
    ready: true,
    async reserve(clientIp) {
      // Short-lived pseudonymous digest; raw IP and prompts are never persisted.
      // This is not anonymization: common addresses may be guessed from a hash.
      const input = new TextEncoder().encode(`${Math.floor(Date.now() / 86400000)}:${clientIp}`);
      const digest = await crypto.subtle.digest('SHA-256', input);
      const client = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      return call('/reserve', { client });
    },
    async release(token) { await call('/release', { token }); }
  };
}
