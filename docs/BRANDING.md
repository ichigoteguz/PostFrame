# XFrame Downloader

The approved identity combines frame corners, a geometric X, and a gold download arrow. The production marks are SVGs, recreated from the approved concept for sharp rendering at header and favicon sizes.

- `public/logo-mark.svg`: teal frame and ink X for light surfaces.
- `public/logo-mark-dark.svg`: reversed ivory frame and X for dark surfaces.
- `public/favicon.svg`: reversed mark on an ink tile.
- `src/Brand.tsx`: shared mark and typeset wordmark.

Core palette: ink `#122C36`, teal `#087F80`, gold `#E6AE45`, and off-white `#F7F8F5`. Dark surfaces use `#0C1C23` and `#122932`, with lighter teal accents for contrast. Interface colors are semantic CSS variables in `src/styles.css`.

The header's Site theme selector offers System, Light, and Dark. System follows the operating system, including changes while the app is open. An explicit choice persists on this device. The site theme is independent of the exported post theme, background, and media. Existing export preferences migrate from the previous brand's storage key.

The repository and deployment path remain `PostFrame` until the repository is renamed separately. Product names, document title, user-facing errors, download filenames, and license introductions use XFrame Downloader. Historical verification notes retain the names and paths used when those checks ran.
