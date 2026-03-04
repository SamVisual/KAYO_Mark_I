"""JSON-basiertes Gedächtnis für KAYO – funktioniert mit Python 3.14+, keine ChromaDB nötig."""

import json
import os
import re
import hashlib
import tempfile
from datetime import datetime


MEMORY_FILE = "./kayo_memory.json"
N_RESULTS = 5


def _tokenize(text: str) -> list[str]:
    return re.findall(r'\b\w+\b', text.lower())


def _jaccard(a: list[str], b: list[str]) -> float:
    """Jaccard-Ähnlichkeit als einfaches Relevanz-Maß."""
    if not a or not b:
        return 0.0
    sa, sb = set(a), set(b)
    return len(sa & sb) / len(sa | sb)


class Memory:
    def __init__(self, db_path: str = MEMORY_FILE):
        self.path = db_path
        self.entries: list[dict] = self._load()

    def _load(self) -> list[dict]:
        if not os.path.exists(self.path):
            return []
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"[WARNUNG] Gedächtnis konnte nicht geladen werden ({e}). Starte mit leerem Gedächtnis.")
            return []

    def _persist(self) -> None:
        """Schreibt atomar: zuerst in eine Temp-Datei, dann atomares Umbenennen."""
        dir_name = os.path.dirname(os.path.abspath(self.path))
        try:
            with tempfile.NamedTemporaryFile(
                "w", dir=dir_name, encoding="utf-8", delete=False, suffix=".tmp"
            ) as tmp:
                json.dump(self.entries, tmp, ensure_ascii=False, indent=2)
                tmp_path = tmp.name
            os.replace(tmp_path, self.path)
        except OSError as e:
            print(f"[WARNUNG] Gedächtnis konnte nicht gespeichert werden: {e}")

    def save(self, role: str, content: str) -> None:
        """Speichert eine Nachricht dauerhaft."""
        timestamp = datetime.now().isoformat()
        uid = hashlib.sha256(f"{timestamp}{content}".encode()).hexdigest()[:16]
        self.entries.append({"id": uid, "role": role, "content": content, "timestamp": timestamp})
        self._persist()

    def recall(self, query: str, n: int = N_RESULTS) -> list[dict]:
        """Gibt die relevantesten Erinnerungen zur Anfrage zurück."""
        if not self.entries:
            return []
        q_tokens = _tokenize(query)
        scored = [
            (e, _jaccard(q_tokens, _tokenize(e["content"])))
            for e in self.entries
        ]
        # Mindest-Relevanz 0.05, dann nach Score sortieren
        relevant = [(e, s) for e, s in scored if s >= 0.05]
        relevant.sort(key=lambda x: (-x[1], x[0]["timestamp"]))
        top = relevant[:n]
        # Chronologisch ausgeben
        top.sort(key=lambda x: x[0]["timestamp"])
        return [{**e, "relevance": round(s, 2)} for e, s in top]

    def count(self) -> int:
        return len(self.entries)
