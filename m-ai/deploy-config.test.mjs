import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const worker=JSON.parse(readFileSync(new URL('wrangler.jsonc',import.meta.url),'utf8'));
const workflow=readFileSync(new URL('../.github/workflows/m-companion-cloudflare-deploy.yml',import.meta.url),'utf8');
const analytics=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');

test('Git-triggered deployment targets only original M companion Worker',()=>{
 assert.equal(worker.name,'m-portfolio-companion');
 assert.equal(worker.main,'worker.mjs');
 assert.equal(worker.account_id,'410b1b4a477dbbb58f255c1e59ecd303');
 assert.match(workflow,/working-directory: m-ai/);
 assert.match(workflow,/--config wrangler\.jsonc --keep-vars/);
 assert.match(workflow,/branches: \[main\]/);
 assert.match(workflow,/'m-ai\/\*\*'/);
 assert.match(analytics,/name = "ricardo19-deve-github-io"/);
 assert.match(analytics,/analytics\/worker.mjs/);
 assert.ok(!workflow.includes('analytics/wrangler.toml'));
});

test('Git-triggered deployment cannot replace the existing M quota or dashboard secrets',()=>{
 assert.equal(worker.keep_vars,true);
 assert.ok(!Object.hasOwn(worker.vars,'AI_AUTOPLAY_ENABLED'));
 assert.deepEqual(worker.durable_objects.bindings,[{name:'M_QUOTA',class_name:'PortfolioQuota'}]);
 assert.deepEqual(worker.migrations,[{tag:'v1',new_sqlite_classes:['PortfolioQuota']}]);
 assert.ok(!Object.hasOwn(worker.vars,'LINKEDIN_DMA_ACCESS_TOKEN'));
 assert.ok(!Object.hasOwn(worker.vars,'OPENAI_API_KEY'));
 assert.match(workflow,/secrets\.CLOUDFLARE_API_TOKEN/);
 assert.match(workflow,/if: steps\.credentials\.outputs\.ready == 'true'/);
 assert.match(workflow,/--keep-vars/);
});
