# XFrame Downloader visual exploration

Developed with OpenAI Codex.

Generated through the user's Reality Fabricator API on November 11, 2026. The user selected **A as the light theme and B as the dark theme**, explicitly requesting two distinct themes rather than a palette swap. C remains exploratory. The images below are the original concept samples; the actual application uses editable controls and separately generated artwork.

| Sample | Direction | What it explores |
| --- | --- | --- |
| [A — Precision Studio](a-precision-studio.jpg) | Closest evolution | Ivory, ink, teal, and gold; dimensional frame artwork; calm practical editor. |
| [B — Night Signal](b-night-signal.jpg) | Cinematic media tool | Dark navy, cyan, and amber; glass frames and controlled light. |
| [C — Paper & Play](c-paper-play.jpg) | Warm sharing tool | Paper cream, coral, cobalt, and yellow; tactile layered frame artwork. |

Each concept uses the same brief and fictional post author, the same mountain-lake subject, and the same input, settings, preview, and download hierarchy. The photo, exact layout, logo, and small control details vary because these are independent generated images. Compare brand character, color, artwork, and overall density; the controls and small text are illustrative.

Visual review favors **C** for a stronger personality that suits sharing memes with friends. Simplify its emblem for small sizes and keep texture and offset shadows subtle. **A** is the natural refinement of the current identity; its panel boundaries and selected states need more contrast. **B** is useful inspiration for the dark site theme; reduce technical markings and avoid decorative effects that could be mistaken for export settings. Generated options such as Natural, Paper, and Transparent are not approved new features. All three omit some production export controls.

All three completed successfully at 3,360 tokens per image, for **10,080 RFAB tokens total**. Each retained JPEG is 1200 × 896 pixels; the provider chose that output size from the requested 4:3 composition. No regeneration, edit, upscale, video, or sound job was purchased.

The shared project style, individual directions, and planned costs are in `art-direction.json`; the exact API prompts are in each `*-prompt.json`. Generation provenance and actual charges are recorded in `manifest.json`. The model is `replicate:google/nano-banana-2.1`, chosen after live catalog and pricing checks for its text rendering, composition, and economical base price. Quality and resolution overrides were omitted. No reference images, project files, source code, or account data were uploaded; RFAB received only each creative brief and generation options. The central helper loaded the credential securely.

Account balance, billing responses, live catalog snapshots, and transient jobs are kept locally under ignored `.qa/rfab/2026-11-11/`. The helper `rfab_samples.py` records an attempt before submitting and refuses duplicate submissions. Poll existing jobs instead of rerunning generation. `create_prompts.py` recreates the local prompt files without making network requests.

The implementation retains the existing crisp SVG identity and translates A/B layouts and labels into accessible HTML/CSS. Dedicated text-free artwork is in `public/art/precision-studio.jpg` and `public/art/night-signal.jpg`; exact additional briefs are `precision-art-prompt.json` and `signal-art-prompt.json`. These two artwork generations cost 6,720 tokens separately from the original 10,080-token sample set. `theme-art-manifest.json` records provenance. Preserve independent site and export themes, complete export controls, mobile reflow, reduced-motion support, the page dedication, and owner/third-party attribution. The exact development credit is “Developed with OpenAI Codex.”
