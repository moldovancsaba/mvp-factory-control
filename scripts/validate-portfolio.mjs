/**
 * Read-only validation for the public portfolio discovery register.
 * Uses Node built-ins only. Checks evidence state and privacy invariants;
 * does not infer operational truth or perform network requests.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export function validate(data) {
  const errors = [];
  if (data?.schemaVersion !== 1 || !Array.isArray(data?.repositories))
    return ['Expected schemaVersion 1 and repositories array'];
  const seen = new Set();
  for (const r of data.repositories) {
    const id = r?.repository;
    const fail = message => errors.push(String(id) + ': ' + message);
    if (typeof id !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(id)) fail('invalid repository');
    if (seen.has(id)) fail('duplicate repository');
    seen.add(id);
    if (r.visibility !== 'public') fail('restricted record cannot be published');
    if (!r.investigationOwner?.trim()) fail('investigation owner required');
    if (!r.displayName?.trim()) fail('display name required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.observedAt || '') || !Number.isFinite(Date.parse(r.observedAt))) fail('observation date required');
    if (r.source !== 'https://api.github.com/repos/' + id) fail('metadata evidence URL mismatch');
    if (!Array.isArray(r.topics) || r.topics.some(t => typeof t !== 'string')) fail('topics must be strings');
    if (!['active','maintenance','paused','archived','unknown'].includes(r.lifecycle)) fail('invalid lifecycle');
    if (!['unknown','hosted-app','local-tool','library','monorepo','prototype','redirect','assets','documentation'].includes(r.role)) fail('invalid role');
    if (!['investigating','blocked','accepted'].includes(r.reviewState)) fail('invalid review state');
    if (!['not-set','unverified','verified','not-applicable'].includes(r.homepage?.state)) fail('invalid homepage state');
    if (r.homepage?.url && !/^https?:\/\//.test(r.homepage.url)) fail('invalid homepage URL');
    if (r.homepage?.state === 'verified' && (!r.homepage.url || !r.homepage.evidence)) fail('verified homepage requires destination evidence');
    if (!['documented','unverified'].includes(r.deliveryRouting?.state)) fail('invalid delivery routing state');
    if (r.deliveryRouting?.state === 'documented' && !r.deliveryRouting.source) fail('routing evidence required');
    if (r.reviewState !== 'accepted' && !r.investigation?.trim()) fail('open record requires investigation');
    if (r.reviewState === 'accepted') {
      if (!r.acceptance?.reviewer || !r.acceptance?.evidence?.length) fail('acceptance requires reviewer/evidence');
      if (r.role === 'unknown' || r.lifecycle === 'unknown' || r.deliveryRouting?.state === 'unverified' ||
          ['not-set','unverified'].includes(r.homepage?.state)) fail('unknown facts cannot be accepted');
    }
  }
  return errors;
}

function selfTest() {
  const valid = { schemaVersion: 1, repositories: [{
    investigationOwner:'maintainer', repository:'example/tool', visibility:'public', displayName:'Tool', observedAt:'2026-10-19',
    source:'https://api.github.com/repos/example/tool', description:null, topics:[],
    homepage:{url:null,state:'not-set'}, lifecycle:'unknown', role:'unknown',
    deliveryRouting:{state:'unverified',source:null}, reviewState:'investigating',
    investigation:'Verify local-only destination policy and source purpose.'
  }] };
  assert.deepEqual(validate(valid), []);
  const cases = [
    ['private disclosure', d => d.repositories[0].visibility = 'private'],
    ['duplicate identifier', d => d.repositories.push(structuredClone(d.repositories[0]))],
    ['unsupported acceptance', d => d.repositories[0].reviewState = 'accepted'],
    ['false URL verification', d => d.repositories[0].homepage.state = 'verified'],
    ['missing evidence', d => d.repositories[0].source = 'https://example.com'],
    ['unowned unknown', d => d.repositories[0].investigation = '']
  ];
  for (const [label, mutate] of cases) {
    const d = structuredClone(valid); mutate(d);
    assert.ok(validate(d).length > 0, label + ' must fail');
  }
  const local = structuredClone(valid);
  Object.assign(local.repositories[0], {
    role:'local-tool', lifecycle:'active', homepage:{url:null,state:'not-applicable'},
    deliveryRouting:{state:'documented',source:'https://github.com/example/tool/issues'},
    reviewState:'accepted', acceptance:{reviewer:'maintainer',evidence:['https://github.com/example/tool/commit/example']}
  });
  assert.deepEqual(validate(local), [], 'local-only tool may have no homepage');
  console.log('PASS: valid investigation, local-only exception and six negative cases');
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    const path = process.argv[2] || 'docs/portfolio/repositories.json';
    const data = JSON.parse(readFileSync(path,'utf8'));
    const errors = validate(data);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('PASS: ' + data.repositories.length + ' public records; structural checks only, acceptance not implied');
  }
}
