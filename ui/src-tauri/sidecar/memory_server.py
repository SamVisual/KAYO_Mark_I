#!/usr/bin/env python3
"""
KAYO Memory Server – ChromaDB-backed semantic memory with FastAPI.
Runs as a Tauri sidecar on localhost:7437.
"""

import os
import time
import uuid

import chromadb
import uvicorn
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ── Config ────────────────────────────────────────────────────────────────────

PORT = 7437
COLLECTION_NAME = "kayo_memory"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Persist path: passed via env or default to ./kayo_memory_db
PERSIST_DIR = os.environ.get(
    "KAYO_MEMORY_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "kayo_memory_db"),
)

# ── ChromaDB setup ────────────────────────────────────────────────────────────

embedding_fn = SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL)

chroma_client = chromadb.PersistentClient(path=PERSIST_DIR)
collection = chroma_client.get_or_create_collection(
    name=COLLECTION_NAME,
    embedding_function=embedding_fn,
)

# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="KAYO Memory Server", version="1.0.0")


# ── Models ────────────────────────────────────────────────────────────────────


class AddRequest(BaseModel):
    content: str
    metadata: dict  # role, timestamp, session_id


class SearchRequest(BaseModel):
    query: str
    n_results: int = 10


class MemoryResult(BaseModel):
    id: str
    content: str
    metadata: dict
    distance: float


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok", "memories": collection.count()}


@app.post("/memory/add")
def memory_add(req: AddRequest):
    doc_id = str(uuid.uuid4())
    # Ensure timestamp is stored
    meta = dict(req.metadata)
    if "timestamp" not in meta:
        meta["timestamp"] = int(time.time())
    # ChromaDB metadata values must be str, int, float, or bool
    sanitized = {}
    for k, v in meta.items():
        if isinstance(v, (str, int, float, bool)):
            sanitized[k] = v
        else:
            sanitized[k] = str(v)
    collection.add(
        ids=[doc_id],
        documents=[req.content],
        metadatas=[sanitized],
    )
    return {"id": doc_id, "count": collection.count()}


@app.post("/memory/search")
def memory_search(req: SearchRequest):
    if collection.count() == 0:
        return {"results": []}
    # Don't request more results than available
    n = min(req.n_results, collection.count())
    results = collection.query(
        query_texts=[req.query],
        n_results=n,
    )
    items = []
    for i in range(len(results["ids"][0])):
        items.append(
            MemoryResult(
                id=results["ids"][0][i],
                content=results["documents"][0][i],
                metadata=results["metadatas"][0][i],
                distance=results["distances"][0][i] if results.get("distances") else 0.0,
            )
        )
    return {"results": items}


@app.get("/memory/session/{session_id}")
def memory_get_session(session_id: str):
    results = collection.get(
        where={"session_id": session_id},
    )
    items = []
    for i in range(len(results["ids"])):
        items.append(
            {
                "id": results["ids"][i],
                "content": results["documents"][i],
                "metadata": results["metadatas"][i],
            }
        )
    # Sort by timestamp
    items.sort(key=lambda x: x["metadata"].get("timestamp", 0))
    return {"results": items}


@app.delete("/memory/clear")
def memory_clear():
    global collection
    chroma_client.delete_collection(COLLECTION_NAME)
    collection = chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
    )
    return {"status": "cleared"}


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"KAYO Memory Server starting on port {PORT}...")
    print(f"Persist directory: {PERSIST_DIR}")
    print(f"Embedding model: {EMBEDDING_MODEL}")
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
