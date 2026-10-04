/* Production-only release guard. No network access or owner credentials. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash, webcrypto} = require('node:crypto');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

async function verify() {
  const lock = JSON.parse(read('production-maintenance.json'));
  assert.match(lock.staging_sha, /^[a-f0-9]{40}$/);
  assert.ok(Object.keys(lock.files).length > 100, 'verified staging source inventory is required');
  for (const [name, expected] of Object.entries(lock.files)) {
    assert.ok(name.startsWith('site/') || name === 'scripts/build_pages.py');
    assert.ok(!name.split('/').includes('..'));
    const data = fs.readFileSync(path.join(root, name));
    const actual = createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex');
    assert.equal(actual, expected, `source differs from verified staging: ${name}`);
  }
  assert.ok(JSON.parse(read('package.json')).dependencies['@vercel/functions']);
  assert.match(read('site/maintenance.html'), /ただいまメンテナンス中/);

  if (lock.mode === 'public') {
    assert.ok(lock.release_authorized_at, 'explicit owner release authorization is required');
    assert.match(read('middleware.ts'), /const MAINTENANCE_ENABLED = false;/);
    console.log('Production source identity preserved; owner-authorized public release ' + lock.release_authorized_at);
    return;
  }

  // Run the real middleware with only platform routing adapters and a disposable
  // verification key substituted. No production private key/token is needed.
  const pair = await webcrypto.subtle.generateKey({name:'ECDSA', namedCurve:'P-256'}, true, ['sign','verify']);
  const key = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const source = read('middleware.ts');
  assert.match(source, /import \{ next, rewrite \} from '@vercel\/functions';/);
  assert.match(source, /const PUBLIC_KEY = \{/);
  const executable = source
    .replace(/import \{ next, rewrite \} from '@vercel\/functions';/, '')
    .replace(/const PUBLIC_KEY = \{[\s\S]*?\n\};/, `const PUBLIC_KEY = ${JSON.stringify(key)};`)
    .replace('export const config', 'const config')
    .replace('export default async function middleware', 'async function middleware');
  const route = (action, target, options) => ({action, target, headers:new Headers(options?.headers)});
  const context = vm.createContext({crypto:webcrypto, URL, Request, Response, Headers, TextEncoder, TextDecoder, atob,
    next:options=>route('next', null, options), rewrite:(url, options)=>route('rewrite',url.pathname,options)});
  const handler = vm.runInContext(executable + '\n({middleware, config})', context);
  assert.equal(JSON.stringify(handler.config.matcher), '["/:path*"]', 'all production paths must be guarded');
  const origin = 'https://piano-dream-stage.vercel.app';
  const request = (url, token) => new Request(origin + url, {headers:token ? {cookie:'pds_owner_preview='+token} : {}});
  const deniedPaths = ['/', '/index.html', '/home', '/home.js', '/piano.js', '/install/', '/install-v22/', '/install-v23/', '/audio/opening-3voices.m4a', '/characters/character01/manifest.json', '/unknown'];
  async function blocked(token) {
    for (const url of deniedPaths) {
      const response = await handler.middleware(request(url, token));
      assert.equal(response.action, 'rewrite', `public route exposed: ${url}`);
      assert.equal(response.target, '/maintenance.html');
      assert.match(response.headers.get('cache-control'), /no-store/);
    }
  }
  const encode = value => Buffer.from(value).toString('base64url');
  async function sign(payload) {
    const body = encode(JSON.stringify(payload));
    const sig = await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'}, pair.privateKey, new TextEncoder().encode(body));
    return body+'.'+encode(sig);
  }
  const now = Math.floor(Date.now()/1000);
  const owner = await sign({scope:'pds-prod-owner-preview-v1', exp:now+3600});
  await blocked();
  await blocked('invalid');
  await blocked(await sign({scope:'wrong-scope',exp:now+3600}));
  await blocked(await sign({scope:'pds-prod-owner-preview-v1',exp:now-1}));
  await blocked(owner.split('.')[0]+'.'+encode(Buffer.alloc(64)));
  for (const url of deniedPaths) assert.equal((await handler.middleware(request(url, owner))).action, 'next');
  for (const endpoint of ['/__owner-access','/__owner-manifest']) {
    for (const query of ['', '?token=invalid']) {
      const response = await handler.middleware(request(endpoint+query));
      assert.equal(response.status, 302);
      assert.equal(new URL(response.headers.get('location')).pathname, '/maintenance.html');
    }
  }
  const query = '?token='+encodeURIComponent(owner);
  const setup = await handler.middleware(request('/__owner-access'+query));
  assert.equal(setup.status, 200);
  assert.match(await setup.text(), /apple-mobile-web-app-capable/);
  for (const marker of ['HttpOnly','Secure','SameSite=Strict','Path=/']) assert.ok(setup.headers.get('set-cookie').includes(marker));
  const manifestResponse = await handler.middleware(request('/__owner-manifest'+query));
  assert.match(manifestResponse.headers.get('cache-control'), /no-store/);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  const start = new URL(manifest.start_url, origin);
  assert.equal(start.pathname, '/__owner-access');
  assert.equal(start.searchParams.get('token'), owner);
  assert.equal(start.searchParams.get('app'), '1');
  const launch = await handler.middleware(request(manifest.start_url));
  assert.equal(launch.action, 'rewrite');
  assert.equal(launch.target, '/index.html');
  assert.ok(launch.headers.get('set-cookie').includes('HttpOnly'));
  console.log(`PASS production maintenance, invalid/expired/forged access, owner standalone launch, and verified staging ${lock.staging_sha}`);
}
verify().catch(error=>{console.error('Production maintenance guard FAILED:', error.message);process.exitCode=1;});
