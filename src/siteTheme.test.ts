import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySiteTheme, readSiteTheme } from './siteTheme';

afterEach(() => vi.unstubAllGlobals());

describe('site theme preferences', () => {
  it.each(['light', 'dark'])('restores an explicit %s choice', saved => {
    vi.stubGlobal('localStorage', { getItem: () => saved });
    expect(readSiteTheme()).toBe(saved);
  });

  it.each([null, 'system', 'invalid'])('uses the system for %s', saved => {
    vi.stubGlobal('localStorage', { getItem: () => saved });
    expect(readSiteTheme()).toBe('system');
  });

  it('still works when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Blocked'); } });
    expect(readSiteTheme()).toBe('system');
  });

  it.each([
    ['system', true, 'dark', '#0B111B'],
    ['system', false, 'light', '#F7F8F5'],
    ['light', true, 'light', '#F7F8F5'],
    ['dark', false, 'dark', '#0B111B'],
  ] as const)('resolves %s with system dark=%s to %s', (choice, systemDark, expected, chromeColor) => {
    const dataset: Record<string, string> = {};
    const setAttribute = vi.fn();
    vi.stubGlobal('document', { documentElement: { dataset }, querySelector: () => ({ setAttribute }) });
    vi.stubGlobal('matchMedia', () => ({ matches: systemDark }));
    applySiteTheme(choice);
    expect(dataset.siteTheme).toBe(expected);
    expect(setAttribute).toHaveBeenCalledWith('content', chromeColor);
  });
});
