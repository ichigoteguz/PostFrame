import { useEffect, useState } from 'react';

export type SiteTheme = 'system' | 'light' | 'dark';
const KEY = 'xframe-downloader.site-theme.v1';
export function readSiteTheme(): SiteTheme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Theme remains usable when storage is unavailable. */ }
  return 'system';
}
export function applySiteTheme(preference: SiteTheme) {
  const theme = preference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.siteTheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0C1C23' : '#F7F8F5');
}
export function useSiteTheme() {
  const [theme, setTheme] = useState<SiteTheme>(readSiteTheme);
  useEffect(() => {
    applySiteTheme(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* Optional preference persistence. */ }
    const query = matchMedia('(prefers-color-scheme: dark)');
    const update = () => { if (theme === 'system') applySiteTheme(theme); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [theme]);
  return [theme, setTheme] as const;
}
