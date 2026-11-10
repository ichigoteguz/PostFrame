# v1.0.0 — XFrame Downloader

First stable release, published November 10, 2026.

## What's included

- XFrame Downloader branding with the approved framed-X and gold download-arrow SVG logo, light/dark marks, and favicon.
- Logo-inspired ink, teal, and gold interface.
- System, Light, and Dark site themes with saved preferences and live system-theme updates, independent of exported post styling.
- Public X/Twitter posts exported as PNG/JPG images or framed MP4 video with audio.
- Quoted posts, attachment selection, post themes, backgrounds, padding, aspect ratios, and resolution controls.
- Rebranded download filenames and automatic migration of existing export preferences.
- Page dedication retained; README dedication removed.

Developed utilizing Codex.

## Verification

64 tests pass; TypeScript and the production build pass. GitHub Actions validated and deployed the rebrand. Live checks confirmed both site themes and logo assets; desktop/mobile interface checks, saved theme preference after reload, and a sample PNG export passed. Earlier release validation covered desktop Edge MP4 exports, audio preservation, cancellation, and two-minute synthetic video export (see [verification notes](VERIFICATION.md)).

## Supported scope and limits

Video export targets desktop Chromium with H.264 WebCodecs support. Desktop Edge video export was directly verified; mobile video export is not guaranteed. Video input is limited to two minutes and 100 MiB. Only public posts are supported; retrieval depends on FxTwitter and X CDN availability. Full threads, batch export, trimming, WebM, and GIF output remain outside this release.

[Open XFrame Downloader](https://ichigoteguz.github.io/PostFrame/). The existing repository and Pages path remain PostFrame so existing links continue to work.
