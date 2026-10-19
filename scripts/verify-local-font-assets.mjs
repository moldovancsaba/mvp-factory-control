/**
 * Read-only integrity check for bundled IBM Plex font assets.
 * Git blob hashes include the binary byte length; upstream replacements
 * require an explicit manifest and licence review.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const base = new URL('../apps/mvp-factory-control/src/app/fonts/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('sources.json', base), 'utf8'));
for (const item of manifest.files) {
  const bytes = readFileSync(new URL(item.file, base));
  const sha = createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\\0')).update(bytes).digest('hex');
  assert.equal(sha, item.gitBlobSha, item.file + ': upstream blob mismatch');
  assert.ok(bytes.length > 100000, item.file + ': truncated asset');
}
const layout = readFileSync(new URL('../apps/mvp-factory-control/src/app/layout.tsx', import.meta.url), 'utf8');
assert.ok(layout.includes('next/font/local'));
assert.ok(!layout.includes('next/font/google'));
assert.ok(readFileSync(new URL('OFL.txt', base), 'utf8').includes('SIL OPEN FONT LICENSE'));
console.log('PASS: four official font assets, upstream hashes, licence and local-only font loader');
