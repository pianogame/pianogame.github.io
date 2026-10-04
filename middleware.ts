import { next, rewrite } from '@vercel/functions';

const OWNER_COOKIE = 'pds_owner_preview';
const OWNER_SCOPE = 'pds-prod-owner-preview-v1';
const PUBLIC_KEY = {
  kty: 'EC',
  crv: 'P-256',
  x: 's6yISEKxr7WmToiviNOtHDDwSdAeDHKHcpeAKVRls54',
  y: 'aLcR8tV9o_8s3nkUJD-mXbUpf_IZ1ahbEO9o8hMsUZE',
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

export const config = {
  matcher: ['/:path*'],
};

export default async function middleware(request) {
  const url = new URL(request.url);

  if (url.pathname === '/maintenance.html' || url.pathname === '/sw.js') return next();

  if (url.pathname === '/__owner-access') {
    const token = url.searchParams.get('token') || '';
    const payload = await verifyOwnerToken(token);
    if (!payload) {
      return Response.redirect(new URL('/maintenance.html', request.url), 302);
    }
    const maxAge = Math.max(60, payload.exp - Math.floor(Date.now() / 1000));
    const headers = new Headers({
      Location: '/',
      'Cache-Control': 'no-store, max-age=0',
    });
    headers.append(
      'Set-Cookie',
      `${OWNER_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`,
    );
    return new Response(null, { status: 302, headers });
  }

  const token = readCookie(request.headers.get('cookie'), OWNER_COOKIE);
  if (await verifyOwnerToken(token)) {
    return next({
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  return rewrite(new URL('/maintenance.html', request.url), {
    headers: { 'Cache-Control': 'no-store, max-age=0', 'Vary': 'Cookie' },
  });
}
