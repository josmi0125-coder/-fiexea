export function safeExportName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0,100) || 'fiexea-export.txt';
}

export function parseAuthCallback(raw, scheme) {
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== `${scheme}:` || url.hostname !== 'auth' || url.pathname !== '/callback') return null;
  const params = new URLSearchParams();
  // PKCE code is consumed by the local Supabase client, which holds the verifier.
  const code = url.searchParams.get('code');
  if (!code) return null;
  params.set('code', code);
  const invite = url.searchParams.get('invite');
  if (invite && /^[a-zA-Z0-9_-]{10,200}$/.test(invite)) params.set('invite', invite);
  return `index.html?${params.toString()}`;
}

export async function consumeAuthCallback(raw, scheme, storage) {
  const target = parseAuthCallback(raw, scheme);
  if (!target) return null;
  // getLaunchUrl can repeat after WebView reload; remember only a digest, never the code or tokens.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const fingerprint = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  const key = 'fiexea-native-auth-callback';
  if (storage.getItem(key) === fingerprint) return null;
  storage.setItem(key, fingerprint);
  return target;
}
