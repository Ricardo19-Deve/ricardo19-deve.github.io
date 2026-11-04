import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const config=file('analytics/wrangler.toml');
const schema=file('analytics/migrations/0001_daily_analytics.sql');
const runtime=file('analytics/worker.mjs');
const publicConfig=file('m-analytics-config.mjs');

test('production D1 binding is configured to the supplied real database',()=>{
 assert.match(config,/^name\s*=\s*"ricardo19-deve-github-io"$/m);
 assert.match(config,/^main\s*=\s*"worker.mjs"$/m);
 assert.match(config,/^binding\s*=\s*"ANALYTICS_DB"$/m);
 assert.match(config,/^database_name\s*=\s*"m-portfolio-analytics"$/m);
 assert.match(config,/^database_id\s*=\s*"[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}"$/m);
 assert.match(config,/^migrations_dir\s*=\s*"migrations"$/m);
 assert.match(config,/PUBLIC_ORIGIN = "https:\/\/ricardo19-deve\.github\.io"/);
 assert.match(runtime,/env\.ANALYTICS_DB/);
});

test('production analytics config cannot expose admin secrets or turn on a guessed endpoint',()=>{
 assert.doesNotMatch(config,/^ADMIN_TOKEN\s*=/m);
 assert.doesNotMatch(config,/^CLOUDFLARE_API_TOKEN\s*=/m);
 assert.match(publicConfig,/PORTFOLIO_ANALYTICS_ENDPOINT=''/);
 assert.doesNotMatch(publicConfig,/workers\.dev\/api\/visit/);
});

test('D1 migration safely creates three persistent analytics tables',()=>{
 for(const table of ['daily_sessions','daily_totals','daily_pages'])
  assert.match(schema,new RegExp('CREATE TABLE IF NOT EXISTS '+table+'\\b'));
 assert.match(schema,/PRIMARY KEY\s*\(day,\s*session_hash\)/);
 assert.match(schema,/PRIMARY KEY\s*\(day,\s*path\)/);
});
