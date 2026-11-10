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
- The documentation checkpoint also passed CI (`42729880571`, commit `198e5a54456295a1c955505c385c2ece64088609`). Windows native file-watcher EBUSY crashes were observed when large QA artifacts and a workflow file were written; QA/docs/workflow directories are now ignored and Windows development uses polling. This affects the local dev server only.

## Real-post check

Loaded the reference downloader's example public post, `1903302115721629989`, through the actual UI. Author, text, avatar, and portrait video loaded. Source inspection resolved the selected 720×1280 MP4 and displayed the exact complete export size of 810×1566; the provider's original dimensions were larger. Cached-Blob video preview was observed playing.

This check found that X's CDN rejects a non-X Referer even while allowing our browser Origin. A direct comparison returned 206 without the referrer and 403 with the localhost referrer. The video fetch now explicitly uses `referrerPolicy: 'no-referrer'`; the same real post then downloaded into the browser's source cache successfully. A regression test covers that request policy.

## Stopping checkpoint

Stopped at the owner's request on November 9, 2026 Eastern. Core implementation, local build, 53 tests, the synthetic two-minute export, and private GitHub CI are complete. Repository remains private and Pages is not enabled.

Next: finish the real-post MP4 download through the main UI, check real text/photo exports and appearance controls, then enable public repository/Pages and smoke-test deployed worker paths and live retrieval. Standalone Chrome and phone testing remain unverified. Do not repeat GitHub authentication unless credentials have expired.

## Resumed release validation

On November 9, 2026 Eastern, the owner resumed work and requested the personal subtitle, bottom dedication, and Codex credit. All three are implemented; Codex is credited in the README, repository description, and private GitHub Projects entry.

- The actual xtoimage sample post, `1856142448721793197`, exported through the main UI as a 6,555,294-byte H.264 MP4 at 1194×1376 for its full 46.5 seconds. Its original selected source is silent (1062×720), and the output correctly remains silent.
- Don Pettit's photo post `1844748089560596542` exported as a light-theme PNG at 4×, 2400×4592. The long text and photo were visually inspected without clipping. This test exposed a stale FxEmbed media facet that pointed into full-note prose; the adapter now verifies the original URL span before suppressing a media link. Live normalization confirms all original note text is preserved, with a regression test added.
- The text-only post `20` exported as a Dim-theme JPEG with Sunset background, medium padding, 4:5 ratio, and 3× scale at 2112×2640.
- All 54 tests, TypeScript, and the production build pass. Private CI also passed the exact feature commit `44c908a` (run `42757674264`).
- The repository is now public and GitHub Pages uses the Actions workflow. Deployed URL: https://ichigoteguz.github.io/PostFrame/ . Deployment and live smoke-test results follow below.

## Public deployment smoke test

GitHub Actions deployment `42757919752` succeeded, followed by successful build/deploy run `42758132776` for the release documentation commit. The HTTPS page, generated JavaScript, CSS, and video worker all returned HTTP 200 at their `/PostFrame/` paths.

The live site was opened in Edge. The exact requested subtitle and bottom dedication were verified. Loading the Ozgur Ozer reference post from the deployed origin succeeded, and the deployed worker exported/downloaded the complete 46.5-second MP4 (6,559,030 bytes). The output is H.264 at 1194×1376 and correctly silent, matching the source's lack of an audio track. This verifies the production worker, post-provider CORS, direct media retrieval, frame capture, and download path together.

Release scope is complete. Remaining compatibility limits are the documented desktop-first video support, two-minute/100 MiB input guardrails, and unverified standalone Chrome/mobile coverage. The app continues to depend on FxTwitter and X CDN availability. The private project board records the public app, repository, Codex attribution, and validation results.
