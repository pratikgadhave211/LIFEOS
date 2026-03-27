from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from uuid import uuid4


class RagService:
    """Simple persistent RAG store using JSONL + lexical overlap retrieval.

    This keeps the same public API as the previous vector-backed service,
    while remaining fully compatible with lightweight Python environments.
    """

    def __init__(self, path: str, collection_name: str = "lifeos_knowledge") -> None:
        base = Path(path)
        base.mkdir(parents=True, exist_ok=True)
        self.store_file = base / f"{collection_name}.jsonl"
        if not self.store_file.exists():
            self.store_file.write_text("", encoding="utf-8")

    def ingest_documents(self, documents: list[dict[str, Any]], namespace: str | None = None) -> int:
        if not documents:
            return 0

        count = 0
        with self.store_file.open("a", encoding="utf-8") as handle:
            for doc in documents:
                text = str(doc.get("text", "")).strip()
                if not text:
                    continue

                raw_metadata = dict(doc.get("metadata", {}))
                metadata: dict[str, str | int | float | bool] = {
                    key: value
                    for key, value in raw_metadata.items()
                    if isinstance(value, (str, int, float, bool))
                }
                metadata["source"] = str(doc.get("source", "unknown"))
                if namespace:
                    metadata["namespace"] = namespace

                payload = {
                    "id": str(uuid4()),
                    "text": text,
                    "metadata": metadata,
                }
                handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
                count += 1

        return count

    def _tokenize(self, text: str) -> set[str]:
        return set(re.findall(r"[a-z0-9]+", text.lower()))

    def query(self, query_text: str, top_k: int = 6, namespace: str | None = None) -> list[dict[str, Any]]:
        query_tokens = self._tokenize(query_text)
        if not query_tokens:
            return []

        rows: list[dict[str, Any]] = []
        with self.store_file.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue

                text = str(item.get("text", ""))
                metadata = item.get("metadata", {})
                if not isinstance(metadata, dict):
                    metadata = {}

                if namespace and str(metadata.get("namespace", "")) != namespace:
                    continue

                doc_tokens = self._tokenize(text)
                if not doc_tokens:
                    continue

                overlap = len(query_tokens.intersection(doc_tokens))
                if overlap == 0:
                    continue

                score = overlap / len(query_tokens)
                rows.append(
                    {
                        "content": text,
                        "metadata": metadata,
                        "score": float(score),
                    }
                )

        rows.sort(key=lambda row: row["score"], reverse=True)
        return rows[:top_k]
