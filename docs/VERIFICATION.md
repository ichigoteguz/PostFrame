# Verification

Implementation and browser validation began November 9, 2026 (America/New_York).

## Executed browser checks

Microsoft Edge 157 on the owner's Windows computer, November 9, 2026 Eastern:

| Check | Result |
| --- | --- |
| Two-minute 1280×720, 30 fps H.264/AAC source | Generated offline in 7.7 seconds |
| Framed export, dark post plus quote, 1440×1746 | Completed in 34.9 seconds |
| Output | 120 seconds, H.264 + AAC, 15,888,946 bytes |
| Audio passthrough | All 5,625 AAC packet payloads identical to source |
| Playback frame extraction | First, middle, final seek succeeded; frame visually inspected |
| Three-second smoke test | Completed; silent portrait source retained no audio track |
| Cancellation and repeat export | AbortError returned; subsequent export succeeded |
| Static formats | Genuine PNG and JPEG MIME types |

The first smoke run exposed an incorrectly positioned root in the test harness's static capture. The harness was corrected to capture the same inner frame component as the application. The corrected full two-minute export visibly includes author/avatar, text, selected moving video, quote, and timestamp. The application renderer was not affected by that harness error.

These measured timings describe a synthetic fixture on this computer, not general performance guarantees. Browser memory was not instrumented. Edge is directly tested; standalone Chrome, mobile browsers, variable-frame-rate sources, and rotation metadata still require broader coverage. Local reports and videos are under ignored `.qa/`.

## Code checks

- TypeScript and production Vite build passed.
- All 53 unit tests passed after review refinements, including H.264 source preference and CDN referrer handling.
- Production dependency audit reported no known vulnerabilities.
- GitHub Actions run `42729702135` passed its install, test, and production build job on commit `216dd004099a4697311cf9930fc1b7a165d74d94`. Public deployment was intentionally skipped because the repository is private.

## Real-post check

Loaded the reference downloader's example public post, `1903302115721629989`, through the actual UI. Author, text, avatar, and portrait video loaded. Source inspection resolved the selected 720×1280 MP4 and displayed the exact complete export size of 810×1566; the provider's original dimensions were larger. Cached-Blob video preview was observed playing.

This check found that X's CDN rejects a non-X Referer even while allowing our browser Origin. A direct comparison returned 206 without the referrer and 403 with the localhost referrer. The video fetch now explicitly uses `referrerPolicy: 'no-referrer'`; the same real post then downloaded into the browser's source cache successfully. A regression test covers that request policy.

## Stopping checkpoint

Stopped at the owner's request on November 9, 2026 Eastern. Core implementation, local build, 53 tests, the synthetic two-minute export, and private GitHub CI are complete. Repository remains private and Pages is not enabled.

Next: finish the real-post MP4 download through the main UI, check real text/photo exports and appearance controls, then enable public repository/Pages and smoke-test deployed worker paths and live retrieval. Standalone Chrome and phone testing remain unverified. Do not repeat GitHub authentication unless credentials have expired.
