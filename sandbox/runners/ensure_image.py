#!/usr/bin/env python3
"""Helpers for launching the Swarm Debugger sandbox image."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


def image_exists(name: str) -> bool:
    result = subprocess.run(
        ["docker", "image", "inspect", name],
        capture_output=True,
        check=False,
    )
    return result.returncode == 0


def build_image(name: str) -> None:
    docker_dir = Path(__file__).resolve().parents[1] / "docker"
    subprocess.run(["docker", "build", "-t", name, str(docker_dir)], check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", default="swarm-debugger-sandbox:mvp")
    args = parser.parse_args()
    if not image_exists(args.image):
        build_image(args.image)


if __name__ == "__main__":
    main()
