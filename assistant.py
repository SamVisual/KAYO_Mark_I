#!/usr/bin/env python3
"""
KAYO Mark I - Persönlicher KI-Assistent
Starte mit: python assistant.py
"""

import os
import sys
import yaml
import anthropic
from memory import Memory


PROFILE_PATH = "profile.yaml"
MODEL = "claude-opus-4-6"
MAX_TOKENS = 1024
# Nachrichten die in der aktuellen Session gehalten werden (Kurzzeitgedächtnis)
SESSION_HISTORY_LIMIT = 20


def load_profile(path: str = PROFILE_PATH) -> dict:
    if not os.path.exists(path):
        print(f"[WARNUNG] Profildatei '{path}' nicht gefunden. Erstelle Standard-Profil.")
        return {"user": {"name": "Nutzer"}, "personality": {"description": "Du bist ein hilfreicher Assistent."}, "goals": [], "preferences": {}}
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def build_system_prompt(profile: dict, memories: list[dict]) -> str:
    user_name = profile.get("user", {}).get("name", "Nutzer")
    personality = profile.get("personality", {}).get("description", "")
    traits = profile.get("personality", {}).get("traits", [])
    goals = profile.get("goals", [])
    prefs = profile.get("preferences", {})

    parts = [f"# Deine Identität\n{personality.strip()}"]

    if traits:
        parts.append("## Eigenschaften\n" + "\n".join(f"- {t}" for t in traits))

    if goals:
        parts.append("## Ziele des Nutzers\n" + "\n".join(f"- {g}" for g in goals))

    if prefs:
        pref_lines = "\n".join(f"- {k}: {v}" for k, v in prefs.items())
        parts.append(f"## Präferenzen\n{pref_lines}")

    parts.append(f"## Nutzer\nDu sprichst mit: {user_name}")

    if memories:
        mem_lines = []
        for m in memories:
            ts = m["timestamp"][:16].replace("T", " ")
            mem_lines.append(f"[{ts}] {m['role'].upper()}: {m['content']}")
        parts.append(
            "## Relevante frühere Gespräche\n"
            "Diese Erinnerungen sind thematisch relevant für die aktuelle Frage:\n"
            + "\n".join(mem_lines)
        )

    return "\n\n".join(parts)


def chat(client: anthropic.Anthropic, system: str, history: list[dict], user_input: str) -> str:
    history.append({"role": "user", "content": user_input})
    # Kürze History falls nötig (Kurzzeitgedächtnis-Limit)
    trimmed = history[-SESSION_HISTORY_LIMIT:]
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=trimmed,
    )
    reply = response.content[0].text
    history.append({"role": "assistant", "content": reply})
    return reply


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Fehler: ANTHROPIC_API_KEY Umgebungsvariable ist nicht gesetzt.")
        print("Setze sie mit: export ANTHROPIC_API_KEY='dein-api-key'")
        sys.exit(1)

    print("Lade Profil...")
    profile = load_profile()
    user_name = profile.get("user", {}).get("name", "Nutzer")

    print("Initialisiere Gedächtnis...")
    memory = Memory()
    mem_count = memory.count()
    print(f"  {mem_count} Erinnerungen geladen.")

    client = anthropic.Anthropic(api_key=api_key)
    session_history: list[dict] = []

    print(f"\nKAYO Mark I gestartet. Hallo, {user_name}!")
    print("Tippe 'exit' oder 'quit' zum Beenden.")
    print("Tippe 'memory' um gespeicherte Erinnerungen zu sehen.")
    print("-" * 50)

    while True:
        try:
            user_input = input(f"\n{user_name}: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nTschüss!")
            break

        if not user_input:
            continue

        if user_input.lower() in ("exit", "quit", "tschüss", "bye"):
            print("KAYO: Bis zum nächsten Mal!")
            break

        if user_input.lower() == "memory":
            print(f"\n[Gedächtnis] {mem_count} Einträge gespeichert.")
            recent = memory.recall(user_input, n=5)
            if recent:
                print("Letzte relevante Erinnerungen:")
                for m in recent:
                    ts = m["timestamp"][:16].replace("T", " ")
                    print(f"  [{ts}] {m['role']}: {m['content'][:80]}...")
            continue

        # Relevante Erinnerungen aus ChromaDB abrufen
        memories = memory.recall(user_input)

        # System-Prompt mit Profil + Erinnerungen aufbauen
        system_prompt = build_system_prompt(profile, memories)

        # Antwort generieren
        try:
            reply = chat(client, system_prompt, session_history, user_input)
        except anthropic.APIError as e:
            print(f"[API Fehler] {e}")
            # Entferne die letzte user-Nachricht aus der History da sie fehlschlug
            if session_history and session_history[-1]["role"] == "user":
                session_history.pop()
            continue

        print(f"\nKAYO: {reply}")

        # Beide Nachrichten im Langzeitgedächtnis speichern
        memory.save("user", user_input)
        memory.save("assistant", reply)
        mem_count = memory.count()


if __name__ == "__main__":
    main()
