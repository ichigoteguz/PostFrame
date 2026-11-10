# XFrame Downloader

Keep the whole post. Export public X/Twitter posts as images, or download a video playing inside its original post frame.

For that one friend who doesn't want to create a Twitter account, so sharing memes becomes more difficult than it has to be.

Developed utilizing Codex.

[Open XFrame Downloader](https://ichigoteguz.github.io/PostFrame/)

XFrame Downloader is a static, browser-based app designed for GitHub Pages. Post data comes from [FxEmbed's public FxTwitter API](https://docs.fxembed.com/api/introduction/); media comes from X's media CDN. Files are composed on your device. There are no XFrame Downloader accounts, backend, public download gallery, or stored post history. Loading a post necessarily sends its ID to FxTwitter and retrieves its assets from X.

The product is named XFrame Downloader; the repository and GitHub Pages path remain `PostFrame` so existing links keep working.

## Features

- Text, photos, quoted posts, and framed MP4 video with audio.
- Select one video and give it the complete media area; other attachments are omitted from that export.
- System, Light, and Dark site themes, remembered on this device and independent of the exported card.
- Light, Dim, and Dark cards; solid and gradient backgrounds; padding and aspect-ratio controls.
- PNG and JPG images at 2×, 3×, or 4×; 720p Fast and 1080p video presets.
- Live preview, exact output dimensions, progress, and cancellation.
- Animated GIF attachments supplied as MP4 use the video export path.

Video preset names describe the moving media inside the card. The complete MP4 includes the surrounding text and frame, so its dimensions can be larger. Video is never cropped or enlarged beyond its source resolution. PNG can preserve transparency; JPEG and MP4 are opaque.

## Run locally

Use Node.js 24 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the printed URL ending in `/PostFrame/`. For a production build:

```sh
pnpm test
pnpm build
pnpm preview
```

## Compatibility and limits

Desktop Chromium browsers with WebCodecs H.264 support are the video target. Codec availability depends on the device and browser; image exports remain available when video encoding is unsupported. Phone video export is not a launch guarantee.

Initial application guardrails: 120-second videos, 100 MiB input, 30 fps output, 4 million output pixels and 4096 pixels per side. Image exports allow 16 million pixels and 8192 pixels per side. These are application limits, not universal browser limits. Oversized combinations are rejected rather than silently resized.

Only public posts are supported. Deleted, protected, restricted, external-player, and live-broadcast content may be unavailable. FxTwitter is an unofficial external dependency and can change or become unavailable. No X credentials are requested. Full threads, batch exports, trimming, WebM, and GIF output are outside this version.

## Deployment

The GitHub Actions workflow tests and builds pushes and pull requests. Its deploy job intentionally runs only for a public repository, so private development does not publish the app. When release checks are complete, make the repository public, set Pages' source to GitHub Actions, and dispatch the workflow. `vite.config.ts` uses `/PostFrame/`; change `base` if the repository path changes. No runtime API tokens or build secrets are required. Worker and app assets are bundled and served from the same site.

The repository is public and the app is hosted on GitHub Pages. The actual workflow is in `.github/workflows/pages.yml`, with a reference copy under `docs/`.

## Architecture

The provider adapter normalizes FxTwitter v2 into application-owned types. React/CSS owns the shared post layout. `html-to-image` rasterizes the frame once; a dedicated Mediabunny/WebCodecs worker draws decoded video samples into the measured rounded media rectangle and creates H.264 MP4 while preserving compatible AAC audio. Cancellation terminates the export worker. Preferences are stored locally; source media and exports are temporary browser memory.

## Development acceptance test

Run the dev server and open `/PostFrame/?benchmark`. The development-only harness generates a synthetic H.264/AAC source, captures a dark frame plus quote, exports an MP4, verifies duration/audio/dimensions, and extracts first/middle/final playback frames. Local artifacts are saved under ignored `.qa/` by a dev-server-only endpoint. The harness and artifact endpoint are absent from the production app.

See [verification notes](docs/VERIFICATION.md) for measured results and remaining limitations. Dependency licenses and source links are listed in [third-party notices](THIRD_PARTY_NOTICES.md).
