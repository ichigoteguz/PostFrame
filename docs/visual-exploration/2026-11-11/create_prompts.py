"""Write the intentionally small public creative briefs, without project source.

Developed with OpenAI Codex.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STYLE = "XFrame Downloader project art direction: a friendly, thoughtfully designed browser tool that preserves an X/Twitter post around an exported image or video. The brand metaphor is a frame, context, and a downward download gesture. Restrained, confident visual design; a clear URL input, usable customization controls, and one dominant post preview. Original artwork and fictional demo content only."
COMMON = "Create one polished visual concept of the actual web application, flat front-on screen design, 4:3 landscape composition, no laptop or device mockup. Header: an original compact frame-plus-X-plus-download symbol with wordmark 'XFrame' and small 'DOWNLOADER'. Hero: large headline 'Keep the whole post.' and a short supporting line. Beneath it a wide URL input and 'Load post' button. Main workspace: left narrow settings panel with Image / Video tabs, three theme buttons, five color swatches, PNG / JPG toggle; right large preview canvas containing one dark fictional social post with author 'Alex Morgan', handle '@alexoutside', short text 'Some moments need the whole post.' and a beautiful mountain lake at golden hour image. The preview card is the largest object. Below the workspace a clear 'Download image' button. Preserve this functional hierarchy; generous spacing, high contrast, careful alignment, readable large typography. Small bottom credit 'Developed with OpenAI Codex' and dedication 'For Marcy, with love'. Show a plausible implementable UI, not an abstract moodboard."
DIRECTIONS = {
    "a-precision-studio": "DIRECTION A / PRECISION STUDIO. Evolve a premium light identity: warm ivory #F7F8F5, deep ink #122C36, teal #087F80, honey gold #E6AE45. Crisp geometric sans typography, thin precise dividers, understated rounded panels. Distinctive editorial hero composed asymmetrically: headline and URL occupy the left two thirds, an elegant small sculptural arrangement of three overlapping teal and translucent ivory frames with one gold download arrow occupies the upper right. The decorative object adds depth without competing with the controls. Teal accent to the last words of headline; solid gold download button, refined teal active controls. Very subtle warm studio lighting and soft purposeful shadows. Calm, crafted, trustworthy utility. Keep imagery confined to hero sculpture and post photo.",
    "b-night-signal": "DIRECTION B / NIGHT SIGNAL. A confident cinematic media-tool identity: near-black navy #0B111B, slate #172331, icy cyan #63E6E2, restrained amber #F4B95B, pale text #EEF7FA. Broad geometric typography, slim technical rules, subtle crop marks. Hero asymmetry: headline and URL on left, a small dimensional glass frame floating through a cyan light beam at upper right, restrained amber download gesture. Dark matte workspace, luminous cyan selected controls, deep charcoal post preview with a narrow amber edge. Subtle film-frame vocabulary; sharp and premium, never busy cyberpunk. Cyan primary download button. Useful editor interface always foregrounded; cinematic light only on hero artwork and preview surround.",
    "c-paper-play": "DIRECTION C / PAPER AND PLAY. A warmer expressive sharing-tool identity: warm paper cream #FFF8E9, dark cocoa #332D35, punchy coral #F16D58, cobalt #4058D6, butter yellow #F0CD65. Bold friendly editorial typography. Geometric frame-plus-X logo interpreted as a playful flat folded-paper emblem with a coral download arrow. Hero asymmetry: headline and URL on left, a small beautifully art-directed layered paper-cut collage of overlapping post cards and a down arrow at upper right, tactile edges, subtle paper fibers, soft real shadows. Cream solid panels with crisp cocoa borders; offset coral or cobalt shadows used sparingly. Cobalt active controls, coral primary download button with dark readable label. Friendly and memorable, warm grown-up print design, not childish or cluttered. Real controls remain flat and accessible; paper texture limited to decorative art and very subtle canvas grain."
}

for slug, direction in DIRECTIONS.items():
    payload = {
        "prompt": "\n\n".join([STYLE, direction, COMMON]),
        "modelId": "replicate:google/nano-banana-2.1",
        "width": 1024,
        "height": 768,
        "aspectRatio": "4:3",
        "imageCount": 1,
        "async": True,
    }
    (ROOT / (slug + "-prompt.json")).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

(ROOT / "art-direction.json").write_text(json.dumps({"projectStyle": STYLE, "sharedBrief": COMMON, "directions": DIRECTIONS, "model": "replicate:google/nano-banana-2.1", "catalogTokensPerImage": 3360, "plannedImages": 3, "plannedTokens": 10080, "referenceUploads": False, "purpose": "Unapproved visual exploration; no production theme change."}, indent=2) + "\n", encoding="utf-8")
print("Wrote three sample briefs and art direction manifest.")
