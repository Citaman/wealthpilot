#!/usr/bin/env python3
"""Start a loopback-only, OpenAI-compatible MLX server for WealthPilot."""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path


def latest_snapshot(cache_name: str) -> Path | None:
    snapshots = Path.home() / ".cache" / "huggingface" / "hub" / cache_name / "snapshots"
    if not snapshots.exists():
        return None
    candidates = sorted((path for path in snapshots.iterdir() if path.is_dir()), reverse=True)
    return candidates[0] if candidates else None


def main() -> None:
    # Defense in depth: even a malformed client request must not make the
    # inference process resolve or download a model over the network.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    server = shutil.which("mlx_lm.server")
    if not server:
        candidate = Path.home() / ".local" / "bin" / "mlx_lm.server"
        server = str(candidate) if candidate.exists() else None
    if not server:
        raise SystemExit("mlx_lm.server est introuvable. Installez mlx-lm avec uv avant de continuer.")

    configured = os.environ.get("WEALTHPILOT_LOCAL_MODEL")
    model = Path(configured).expanduser() if configured else latest_snapshot(
        "models--lmstudio-community--granite-4.2-8b-MLX-8bit"
    )
    if not model or not model.exists():
        raise SystemExit(
            "Aucun modèle compatible trouvé. Définissez WEALTHPILOT_LOCAL_MODEL avec le chemin d’un modèle MLX local."
        )

    if "Ling-3.0-tiny" in str(model):
        print(
            "Attention: Ling 3.0 Tiny est actuellement incompatible avec mlx-lm 0.32 "
            "sur cette machine (poids kv_b_proj quantifiés). Utilisez un runtime compatible ou Granite.",
            file=sys.stderr,
        )

    origins = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    args = [
        server,
        "--model", str(model),
        "--host", "127.0.0.1",
        "--port", "8080",
        "--allowed-origins", origins,
        "--temp", "0",
        "--max-tokens", "160",
        "--prompt-concurrency", "1",
        "--decode-concurrency", "1",
        "--prompt-cache-size", "2",
        "--chat-template-args", '{"enable_thinking":false}',
    ]
    print(f"WealthPilot local AI: {model}")
    print("Écoute uniquement sur http://127.0.0.1:8080 — Ctrl+C pour arrêter.")
    os.execv(server, args)


if __name__ == "__main__":
    main()
