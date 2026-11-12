# XFrame Downloader

The approved identity combines frame corners, a geometric X, and a gold download arrow. The production marks are SVGs, recreated from the approved concept for sharp rendering at header and favicon sizes.

- `public/logo-mark.svg`: teal frame and ink X for light surfaces.
- `public/logo-mark-dark.svg`: reversed ivory frame and X for dark surfaces.
- `public/favicon.svg`: reversed mark on an ink tile.
- `src/Brand.tsx`: shared mark and typeset wordmark.

The user selected two complementary art directions from the [Reality Fabricator samples](visual-exploration/2026-11-11/README.md): **Precision Studio (A)** for Light and **Night Signal (B)** for Dark. They share the product identity and controls, with different compositions, artwork, surfaces, and accents.

Light uses ink `#122C36`, teal `#087F80`, gold `#E6AE45`, and ivory `#F7F8F5`. It has an open editorial header, a dimensional frame sculpture, an integrated rounded studio, and gold download actions. Dark uses near-black navy `#0B111B`, slate `#172331`, icy cyan `#63E6E2`, and amber `#F4B95B`. It has a cinematic glass-frame header, technical framing, separate matte studio panels, and cyan download actions. Interface colors are semantic CSS variables in `src/styles.css`; structural rules give the themes distinct treatments.

Dedicated text-free artwork was generated through the user's Reality Fabricator API using `replicate:google/nano-banana-2.1` at the base tier. `public/art/precision-studio.jpg` and `public/art/night-signal.jpg` are production assets, not crops of the concept screenshots. Prompts and asset provenance are retained with the exploration documents; the two artwork jobs charged 6,720 tokens in total. Small interface text, logos, and controls remain HTML/CSS/SVG. No source code, credentials, or unrelated private material was sent to the generation service.

The header's Site theme selector offers System, Light, and Dark. System follows the operating system, including changes while the app is open. An explicit choice persists on this device. The site theme is independent of the exported post theme, background, and media. Existing export preferences migrate from the previous brand's storage key.

The original SVG logo family is retained so both themes remain recognizable as the same application. Site artwork and decorative framing stay outside the captured post component. The page retains its dedication and credits: Developed with OpenAI Codex.

The repository and deployment path remain `PostFrame` until the repository is renamed separately. Product names, document title, user-facing errors, download filenames, and license introductions use XFrame Downloader. Historical verification notes retain the names and paths used when those checks ran.
