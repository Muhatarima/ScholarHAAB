import json
import os
import sys

os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

from sentence_transformers import SentenceTransformer

MODEL_NAME = os.getenv("LOCAL_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIMENSIONS = 384


def main() -> None:
    text = sys.stdin.read().strip()
    if not text:
        raise RuntimeError("No text supplied on stdin.")

    model = SentenceTransformer(MODEL_NAME)
    vector = model.encode(
        text,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).tolist()

    if len(vector) != EMBEDDING_DIMENSIONS:
        raise RuntimeError(
            f"Embedding has {len(vector)} dimensions; expected {EMBEDDING_DIMENSIONS}."
        )

    print(json.dumps({"embedding": vector}, separators=(",", ":")))


if __name__ == "__main__":
    main()
