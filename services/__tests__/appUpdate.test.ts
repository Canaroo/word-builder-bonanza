// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

describe('app updates (v7.63.0)', () => {
  it('waits for a downloaded version, applies it once, and leaves a note for the toast', async () => {
    vi.resetModules();
    const mod = await import('../appUpdate');
    const updateSW = vi.fn(() => Promise.resolve());
    let fire: () => void = () => {};
    mod.initAppUpdates(opts => { fire = opts.onNeedRefresh!; return updateSW; });
    expect(mod.isUpdateReady()).toBe(false);
    expect(mod.applyUpdate('1.0.0')).toBe(false); // nothing downloaded yet
    const seen = vi.fn();
    const off = mod.onUpdateReady(seen);
    fire();
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    expect(mod.isUpdateReady()).toBe(true);
    expect(mod.applyUpdate('1.0.0')).toBe(true);
    expect(mod.applyUpdate('1.0.0')).toBe(false); // only once
    expect(updateSW).toHaveBeenCalledWith(true);
    expect(mod.takeUpdatedNote()).toBe('1.0.0');
    expect(mod.takeUpdatedNote()).toBeNull();
  });

  it('checks for a new version when the app comes back, at most once a minute', async () => {
    vi.resetModules();
    const mod = await import('../appUpdate');
    const update = vi.fn(() => Promise.resolve());
    mod.initAppUpdates(opts => { opts.onRegisteredSW!('sw.js', { update } as unknown as ServiceWorkerRegistration); return () => Promise.resolve(); });
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(1);
  });
});
