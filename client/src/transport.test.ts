import { describe, expect, it, vi } from 'vitest';

describe('transport (same-origin default)', () => {
  it('leaves URLs and protocols alone when VITE_API_BASE is empty', async () => {
    vi.resetModules();
    const t = await import('./transport');
    expect(t.remote).toBe(false);
    expect(t.apiUrl('/api/state')).toBe('/api/state');
    expect(t.wsProtocols()).toBeUndefined();
  });
});

describe('transport (remote)', () => {
  it('stores the token from the fragment, strips it, and never builds an empty subprotocol', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE', 'https://office.example:4317/');
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const replace = vi.fn();
    vi.stubGlobal('history', { replaceState: replace });
    vi.stubGlobal('location', { hash: '', pathname: '/', search: '', protocol: 'https:', host: 'ui.example', hostname: 'ui.example', origin: 'https://ui.example' });
    let t = await import('./transport');
    expect(t.remote).toBe(true);
    expect(t.wsUrl('/ws')).toBe('wss://office.example:4317/ws');
    expect(t.wsProtocols()).toBeUndefined(); // no token yet: must not throw in new WebSocket
    vi.resetModules();
    vi.stubGlobal('location', { hash: '#t=abc123', pathname: '/', search: '', protocol: 'https:', host: 'ui.example', hostname: 'ui.example', origin: 'https://ui.example' });
    t = await import('./transport');
    expect(replace).toHaveBeenCalled();
    expect(t.wsProtocols()).toEqual(['bearer', 'abc123']);
    expect(t.officeLocation.origin).toBe('https://office.example:4317');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
