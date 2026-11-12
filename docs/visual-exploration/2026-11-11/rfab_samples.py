"""XFrame visual exploration. Developed with OpenAI Codex.

Uses the secured, central RFAB client. Only the selected art prompt is sent.
POSTs are explicit, recorded, and never automatically repeated.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from urllib import request, parse

sys.path.insert(0, r"C:\Users\edwin\Documents\Codex\integrations\reality-fabricator\scripts")
from rfab import RfabClient, RfabError

ROOT = Path(__file__).resolve().parent
RECORDS = ROOT.parents[2] / ".qa" / "rfab" / ROOT.name
RECORDS.mkdir(parents=True, exist_ok=True)


def save(name, data):
    (RECORDS / name).write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def read(name):
    directory = ROOT if name.endswith("-prompt.json") else RECORDS
    return json.loads((directory / name).read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["discover", "submit", "poll", "download", "balance"])
    parser.add_argument("sample", nargs="?")
    args = parser.parse_args()
    client = RfabClient()
    if args.action == "discover":
        for name, endpoint in [
            ("model-catalog.json", "/api/image-generation/models"),
            ("generation-guide.json", "/api/image-generation/guide"),
            ("balance-before.json", "/api/tokens/balance"),
        ]:
            data = client.get(endpoint, timeout=45)
            save(name, data)
            if name == "model-catalog.json":
                models = data.get("models", [])
                if isinstance(models, dict):
                    models = list(models.values())
                for model in models:
                    if any(term in str(model.get("model_id", model.get("id", ""))) for term in ["gpt-image-2", "nano-banana", "flux-schnell"]):
                        print(json.dumps(model, ensure_ascii=True))
                print("Catalog top-level keys:", list(data))
            elif name == "balance-before.json":
                print("Starting balance:", data.get("tokenBalance"))
            else:
                print("Saved current generation guide; keys:", list(data) if isinstance(data, dict) else type(data).__name__)
        return
    if args.action == "balance":
        data = client.get("/api/tokens/balance")
        save("balance-after.json", data)
        print(json.dumps({key: data.get(key) for key in ["tokenBalance", "totalTokensUsed", "totalInteractions"]}, ensure_ascii=True))
        return
    if not args.sample or not args.sample.replace("-", "").isalnum():
        raise ValueError("Specify a sample slug")
    slug = args.sample
    if args.action == "submit":
        record = RECORDS / f"{slug}-submission.json"
        marker = RECORDS / f"{slug}-attempted.json"
        if record.exists() or marker.exists():
            raise ValueError("Submission already recorded or attempted. Inspect and poll the existing job; do not duplicate it.")
        payload = read(f"{slug}-prompt.json")
        save(marker.name, {"endpoint": "/api/image-generation/generate", "modelId": payload["modelId"]})
        data = client.post("/api/image-generation/generate", payload, timeout=60)
        save(record.name, data)
        print(json.dumps(data, ensure_ascii=True))
    elif args.action == "poll":
        submission = read(f"{slug}-submission.json")
        job_id = submission.get("jobId") or submission.get("job", {}).get("id")
        if not job_id:
            raise ValueError("No job ID in saved submission")
        data = client.get(f"/api/image-generation/job/{job_id}", timeout=45)
        save(f"{slug}-job.json", data)
        job = data.get("job", data)
        print(json.dumps({"jobId": job_id, "status": job.get("status"), "modelId": job.get("modelId"), "elapsedSeconds": job.get("elapsedSeconds"), "estimatedSecondsRemaining": job.get("estimatedSecondsRemaining"), "tokensDeducted": job.get("tokensDeducted"), "imageUrl": job.get("result", {}).get("imageUrl"), "error": job.get("error")}, ensure_ascii=True))
    elif args.action == "download":
        data = read(f"{slug}-job.json")
        job = data.get("job", data)
        if job.get("status") != "completed":
            raise ValueError("Job has not completed")
        result = job.get("result", {})
        url = result.get("imageUrl")
        if not url:
            images = result.get("images", [])
            url = images[0] if images else None
            if isinstance(url, dict):
                url = url.get("url") or url.get("imageUrl")
        parts = parse.urlsplit(url or "")
        if parts.scheme != "https" or not (parts.hostname or "").startswith("rfab-media.s3."):
            raise ValueError("Expected the generated RFAB S3 image URL")
        # No credential header is used for public generated media.
        with request.urlopen(url, timeout=45) as response:
            image_bytes = response.read(20 * 1024 * 1024 + 1)
        if len(image_bytes) > 20 * 1024 * 1024:
            raise ValueError("Unexpectedly large image")
        extension = ".png" if image_bytes.startswith(b"\x89PNG\r\n\x1a\n") else ".jpg" if image_bytes.startswith(b"\xff\xd8") else ".webp" if image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP" else None
        if not extension:
            raise ValueError("Unrecognized image format")
        output = ROOT / (slug + extension)
        output.write_bytes(image_bytes)
        print(str(output))


if __name__ == "__main__":
    try:
        main()
    except (RfabError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
