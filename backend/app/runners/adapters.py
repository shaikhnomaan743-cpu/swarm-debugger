"""Language runner adapters. Only Python is executed today.

Each adapter exposes `supported() -> bool` and `pytest_command()`.
Only expose a language as supported after actual execution works.
"""
from __future__ import annotations

import shutil


class PythonRunner:
    name = "python"

    @staticmethod
    def supported() -> bool:
        return True

    @staticmethod
    def test_command(raw: str) -> list[str]:
        import shlex
        from pathlib import Path
        parts = shlex.split(raw or "pytest -q")
        if Path(parts[0]).name != "pytest":
            raise ValueError("Only pytest is allowed in the MVP")
        return parts


class NodeRunner:
    name = "node"

    @staticmethod
    def supported() -> bool:
        return bool(shutil.which("node"))

    @staticmethod
    def test_command(_raw: str) -> list[str]:
        raise ValueError("JavaScript/Node.js execution is not yet supported")


class JavaRunner:
    name = "java"

    @staticmethod
    def supported() -> bool:
        return False


class CppRunner:
    name = "cpp"

    @staticmethod
    def supported() -> bool:
        return False


class GoRunner:
    name = "go"

    @staticmethod
    def supported() -> bool:
        return False


SUPPORTED_LANGUAGES = {"python"}
