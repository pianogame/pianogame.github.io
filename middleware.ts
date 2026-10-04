import { next, rewrite } from '@vercel/functions';

const OWNER_COOKIE = 'pds_owner_preview';
const OWNER_SCOPE = 'pds-prod-owner-preview-v1';
const PUBLIC_KEY = {
  kty: 'EC',
  crv: 'P-256',
  x: 'zbh721wADk_LpYpXnhvrilpt0-z-hoT4LDhWBc53d7s',
  y: 'K6sOmoofXsDllzn8XUjT74Dklhgncl3MXLzZGoOd5nY',
  ext: true,
};

function decodeBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

async function verifyOwnerToken(token) {
  try {
    const [payloadPart, signaturePart, extra] = String(token || '').split('.');
    if (!payloadPart || !signaturePart || extra) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadPart)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.scope !== OWNER_SCOPE || !Number.isFinite(payload.exp) || payload.exp <= now) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      PUBLIC_KEY,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      decodeBase64Url(signaturePart),
      new TextEncoder().encode(payloadPart),
    );
    return valid ? payload : null;
  } catch {
    return null;
  }
}


const PUBLIC_PWA_PATHS = new Set([
  '/maintenance.html', '/sw.js', '/manifest.webmanifest',
  '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png',
  '/install/pwa-icon-192-v21.png', '/install/pwa-icon-512-v21.png',
  '/install-v23/piano-dream-stage-touch-v23.png',
]);

function ownerHeaders(token, payload) {
  const maxAge = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Cookie',
    'Set-Cookie': `${OWNER_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`,
  };
}

function ownerManifest(token) {
  return {
    name: 'ドリステ確認用', short_name: 'ドリステ確認',
    id: '/?pds_owner_app_id=20261004', scope: '/',
    start_url: '/__owner-access?token=' + encodeURIComponent(token) + '&app=1',
    display: 'standalone', display_override: ['standalone', 'fullscreen'],
    orientation: 'landscape', theme_color: '#241324', background_color: '#241324', lang: 'ja',
    icons: [
      {src:'/install/pwa-icon-192-v21.png',sizes:'192x192',type:'image/png'},
      {src:'/install/pwa-icon-512-v21.png',sizes:'512x512',type:'image/png'},
    ],
  };
}

function ownerInstallPage(token, payload) {
  const encoded = encodeURIComponent(token);
  const appUrl = '/__owner-access?token=' + encoded + '&app=1';
  const expires = new Date(payload.exp * 1000).toLocaleString('ja-JP', {timeZone:'Asia/Tokyo'});
  return `<!doctype html><html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#241324"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ドリステ確認"><title>ドリステ確認用</title>
<link rel="manifest" href="/__owner-manifest?token=${encoded}">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#241324;color:#fff;font-family:system-ui,-apple-system,sans-serif;line-height:1.8}main{max-width:520px;border:1px solid #d6b976;border-radius:22px;padding:28px;background:#1a101b}img{width:72px;height:72px;border-radius:16px;display:block;margin:auto}h1{text-align:center;font-size:26px}ol{padding-left:1.4em}a{display:block;text-align:center;padding:12px;background:#d6b976;color:#241324;border-radius:12px;text-decoration:none}.small{font-size:13px;color:#d8c6d6}</style>
</head><body><main><img src="/apple-touch-icon.png" alt=""><h1>ホーム画面から本番を確認</h1>
<ol><li>Safariの「共有」をタップ</li><li>「ホーム画面に追加」をタップ</li><li>名前が「ドリステ確認」になっていることを確認して追加</li><li>追加した「ドリステ確認」のアイコンから起動</li></ol>
<p>一般ユーザーにはメンテナンス画面を表示したまま、所有者専用の本番画面を確認できます。</p>
<a href="${appUrl}">この画面から本番を確認</a><p class="small">有効期限：${expires}（日本時間）<br>このリンクは他の人に共有しないでください。</p></main>
<script>if(navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches)location.replace(${JSON.stringify(appUrl)});</script>
</body></html>`;
}

export const config = { matcher: ['/:path*'] };

export default async function middleware(request) {
  const url = new URL(request.url);
  if (PUBLIC_PWA_PATHS.has(url.pathname)) return next();

  if (url.pathname === '/__owner-access' || url.pathname === '/__owner-manifest') {
    const token = url.searchParams.get('token') || '';
    const payload = await verifyOwnerToken(token);
    if (!payload) return Response.redirect(new URL('/maintenance.html', request.url), 302);

    if (url.pathname === '/__owner-manifest') {
      return new Response(JSON.stringify(ownerManifest(token)), {
        headers: {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'private, no-store, max-age=0',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }
    const headers = ownerHeaders(token, payload);
    if (url.searchParams.get('app') === '1') {
      return rewrite(new URL('/index.html', request.url), {headers});
    }
    return new Response(ownerInstallPage(token, payload), {
      headers: {...headers, 'Content-Type':'text/html; charset=utf-8'},
    });
  }

  const token = readCookie(request.headers.get('cookie'), OWNER_COOKIE);
  if (await verifyOwnerToken(token)) return next({headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','Referrer-Policy':'no-referrer'}});

  return rewrite(new URL('/maintenance.html', request.url), {
    headers: {'Cache-Control':'no-store, max-age=0','Vary':'Cookie'},
  });
}
