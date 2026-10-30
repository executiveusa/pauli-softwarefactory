// Transport only. Same-origin by default (VITE_API_BASE empty): behaviour is identical to before.
// When the UI is hosted elsewhere (e.g. Vercel), VITE_API_BASE points at the tailnet-only office and every
// request carries an owner bearer token. The token is never built into the bundle: the owner opens
// <ui>/#t=<token> once (fragments are never sent to any server), it is kept in this browser's localStorage and the
// fragment is removed from the address bar.
const BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/+$/, '');
const KEY = 'cubefarm.owner-token';

if (BASE && typeof location !== 'undefined') {
  const m = /(?:^|[#&])t=([^&]+)/.exec(location.hash);
  if (m) {
    try {
      localStorage.setItem(KEY, decodeURIComponent(m[1]));
    } catch {
      /* storage blocked: requests will be refused with 401 */
    }
    history.replaceState(null, '', location.pathname + location.search);
  }
}

const token = () => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};

export const remote = BASE !== '';
export const apiUrl = (path: string) => BASE + path;

export function wsUrl(path: string): string {
  if (BASE) return BASE.replace(/^http/, 'ws') + path;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`;
}

/** WebSocket subprotocols that carry the token (a browser cannot set headers on a WebSocket). */
export const wsProtocols = (): string[] | undefined => {
  const t = token();
  // no token: connect without a subprotocol (the proxy answers 401) instead of throwing a SyntaxError on an empty one
  return BASE && t ? ['bearer', t] : undefined;
};

/** fetch() against the office: base URL plus bearer token when remote; untouched when same-origin. */
export function officeFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!BASE) return fetch(path, init);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token()}`);
  return fetch(BASE + path, { ...init, headers, credentials: 'omit', mode: 'cors' });
}

/** Sets an image's source from an office path. Remote images need the token, so they are fetched and shown from a blob. */
export function setOfficeImage(img: HTMLImageElement, path: string) {
  if (!BASE) {
    img.src = path;
    return;
  }
  officeFetch(path)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((b) => {
      img.src = URL.createObjectURL(b);
    })
    .catch(() => img.onerror?.(new Event('error')));
}

/** Opens an office file in a new tab (remote mode: the plain link would carry no token). */
export async function openOfficeBlob(path: string) {
  const w = window.open('', '_blank');
  try {
    const r = await officeFetch(path);
    if (!r.ok) throw new Error(String(r.status));
    const url = URL.createObjectURL(await r.blob());
    if (w) w.location.href = url;
  } catch {
    w?.close();
  }
}

/** Where the office's own address (and /preview/<port>/ links) live: this page when same-origin, else the office. */
export const officeLocation: Pick<Location, 'hostname' | 'origin'> = BASE
  ? { hostname: new URL(BASE).hostname, origin: new URL(BASE).origin }
  : (typeof location !== 'undefined' ? location : { hostname: '', origin: '' });
