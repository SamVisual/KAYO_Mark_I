"""ChromaDB-basiertes Gedächtnis für KAYO."""

import chromadb
from chromadb.utils import embedding_functions
from datetime import datetime
import hashlib


COLLECTION_NAME = "kayo_conversations"
N_RESULTS = 5  # Anzahl relevanter Erinnerungen die abgerufen werden


class Memory:
    def __init__(self, db_path: str = "./kayo_memory"):
        self.client = chromadb.PersistentClient(path=db_path)
        # Nutzt das eingebaute sentence-transformers Modell für Embeddings
        self.embed_fn = embedding_functions.DefaultEmbeddingFunction()
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=self.embed_fn,
            metadata={"hnsw:space": "cosine"},
        )

    def save(self, role: str, content: str) -> None:
        """Speichert eine Nachricht im Langzeitgedächtnis."""
        timestamp = datetime.now().isoformat()
        # Eindeutige ID aus Inhalt + Zeitstempel
        uid = hashlib.sha256(f"{timestamp}{content}".encode()).hexdigest()[:16]
        self.collection.add(
            documents=[content],
            metadatas=[{"role": role, "timestamp": timestamp}],
            ids=[uid],
        )

    def recall(self, query: str, n: int = N_RESULTS) -> list[dict]:
        """Sucht nach relevanten früheren Nachrichten anhand einer Anfrage."""
        count = self.collection.count()
        if count == 0:
            return []
        results = self.collection.query(
            query_texts=[query],
            n_results=min(n, count),
            include=["documents", "metadatas", "distances"],
        )
        memories = []
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0]
        for doc, meta, dist in zip(docs, metas, distances):
            # Nur relevante Erinnerungen (Cosine-Ähnlichkeit > 0.3)
            if dist < 0.7:
                memories.append(
                    {
                        "role": meta["role"],
                        "content": doc,
                        "timestamp": meta["timestamp"],
                        "relevance": round(1 - dist, 2),
                    }
                )
        # Sortiert nach Zeitstempel (älteste zuerst)
        memories.sort(key=lambda x: x["timestamp"])
        return memories

    def count(self) -> int:
        return self.collection.count()
