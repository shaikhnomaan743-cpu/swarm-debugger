from __future__ import annotations

import json
import re
from typing import Protocol

import httpx

from app.core.config import settings
from app.schemas.internal import AgentProposal, DebugContext, PatchFile

PROMPT_VERSION = "prosecutor-defender-v1"


class LLMProvider(Protocol):
    mode: str
    model: str

    def generate_prosecutor(self, context: DebugContext) -> AgentProposal: ...

    def generate_defender(self, context: DebugContext) -> AgentProposal: ...

    def summarize_judge_evidence(self, evidence: str, verdict: str) -> str: ...


def _file_blob(files: dict[str, str]) -> str:
    parts = []
    for path in sorted(files):
        parts.append(f"### {path}\n{files[path]}")
    return "\n\n".join(parts)


def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("Provider did not return JSON")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Provider JSON was not an object")
    return parsed


def _proposal_from_dict(data: dict, *, demo: bool) -> AgentProposal:
    files = [
        PatchFile(path=item["path"], content=item["content"])
        for item in data.get("files") or []
        if isinstance(item, dict) and "path" in item and "content" in item
    ]
    changed = data.get("files_changed") or [item.path for item in files]
    return AgentProposal(
        root_cause=str(data.get("root_cause") or ""),
        hypothesis=str(data.get("hypothesis") or data.get("alternative_hypothesis") or ""),
        evidence=[str(item) for item in data.get("evidence") or []],
        files=files,
        files_changed=[str(item) for item in changed],
        expected_behavior=str(data.get("expected_behavior") or ""),
        expected_tests=[str(item) for item in data.get("expected_tests") or []],
        objections=str(data.get("objections") or ""),
        assumptions=[str(item) for item in data.get("assumptions") or []],
        falsification_tests=[str(item) for item in data.get("falsification_tests") or []],
        patch_summary=str(data.get("patch_summary") or ""),
        demo_mode=demo,
        verified=False,
        validation_plan=str(data.get("validation_plan") or ""),
        alternative_hypothesis=str(data.get("alternative_hypothesis") or ""),
        alternative_root_cause=str(data.get("alternative_root_cause") or ""),
        evidence_needed=[str(item) for item in data.get("evidence_needed") or []],
    )


class DemoProvider:
    mode = "demo"
    model = "deterministic-demo"

    def generate_prosecutor(self, context: DebugContext) -> AgentProposal:
        tests = "\n".join(content for path, content in context.files.items() if "test" in path)
        source = context.files.get("solution.py") or next(iter(context.files.values()), "")
        expects_none = "is None" in tests
        previous = "\n".join(context.previous_failures)
        if expects_none:
            content = (
                "def divide(a, b):\n"
                "    if b == 0:\n"
                "        return None\n"
                "    return a / b\n"
            )
            if "return None" in previous and "float('inf')" not in previous:
                content = (
                    "def divide(a, b):\n"
                    "    if b == 0:\n"
                    "        return float('inf')\n"
                    "    return a / b\n"
                )
            root = "Division by zero is unhandled, so the failing test never receives a controlled result."
            expected = "divide(1, 0) returns None without raising."
        else:
            content = source
            root = "Unable to match a known fixture; proposing a minimal no-op so the Judge can reject it with evidence."
            expected = "Tests should still execute against the original logic."
        return AgentProposal(
            root_cause=root,
            hypothesis="A missing zero-divisor guard is the most likely cause of the baseline failure.",
            evidence=[
                "Baseline stderr/stdout shows the original program crashing or failing test_divide_zero.",
                "solution.py performs raw division.",
            ],
            files=[PatchFile(path="solution.py", content=content)],
            files_changed=["solution.py"],
            expected_behavior=expected,
            expected_tests=["test_divide_zero", "test_divide_normal"],
            patch_summary="Guard b == 0 before dividing.",
            demo_mode=True,
            verified=False,
        )

    def generate_defender(self, context: DebugContext) -> AgentProposal:
        tests = "\n".join(content for path, content in context.files.items() if "test" in path)
        prosecutor = context.prosecutor_proposal
        prosecutor_text = prosecutor.files[0].content if prosecutor and prosecutor.files else ""
        if "is None" in tests:
            content = (
                "def divide(a, b):\n"
                "    if b == 0:\n"
                "        raise ZeroDivisionError('division by zero')\n"
                "    return a / b\n"
            )
            objections = (
                "The Prosecutor assumes the API should return None. That may be inventing a contract. "
                "Python's native behavior is to raise ZeroDivisionError; returning None can hide caller bugs."
            )
            expected = "Callers observe an explicit ZeroDivisionError."
        else:
            content = prosecutor_text or "def divide(a, b):\n    return a / b\n"
            objections = "Prosecutor patch is under-specified; an alternative hypothesis is needed."
            expected = "Keep exception semantics."
        return AgentProposal(
            root_cause="The failure may be an API-contract misunderstanding rather than a missing sentinel return.",
            hypothesis="The function should fail loudly on zero rather than returning None.",
            evidence=[
                "The Prosecutor did not prove that None is the specified contract.",
                "Native Python division already raises on zero.",
            ],
            files=[PatchFile(path="solution.py", content=content)],
            files_changed=["solution.py"],
            expected_behavior=expected,
            expected_tests=["test_divide_zero"],
            objections=objections,
            assumptions=["The test suite encodes the true contract.", "Callers want a sentinel None."],
            falsification_tests=["Assert divide(1, 0) is None — this should fail if exception semantics are required."],
            patch_summary="Raise ZeroDivisionError instead of returning None.",
            demo_mode=True,
            verified=False,
        )

    def summarize_judge_evidence(self, evidence: str, verdict: str) -> str:
        return (
            f"[DEMO MODE] Judge explanation is derived only from runtime facts. "
            f"Verdict={verdict}. {evidence} LLM confidence was not used."
        )


class OpenAICompatibleProvider:
    mode = "live"
    model = settings.llm_model

    def _complete(self, system: str, user: str) -> dict:
        if not settings.llm_api_key:
            raise RuntimeError("LLM_API_KEY is not configured")
        url = settings.llm_base_url.rstrip("/") + "/chat/completions"
        headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
        payload = {
            "model": settings.llm_model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        try:
            response = httpx.post(url, headers=headers, json=payload, timeout=45)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            return _extract_json(content)
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError("LLM provider request failed") from exc

    def generate_prosecutor(self, context: DebugContext) -> AgentProposal:
        system = (
            f"You are the Prosecutor agent for Swarm Debugger ({PROMPT_VERSION}). "
            "Identify a concrete root cause and propose a minimal patch. "
            "Never claim the fix is verified. Never modify tests. Return JSON."
        )
        user = (
            f"Project: {context.project_name}\nLanguage: {context.language}\n"
            f"Description: {context.description}\nTest command: {context.test_command}\n"
            f"Round: {context.round_number}\n"
            f"Baseline exit: {context.baseline_exit_code}\n"
            f"Baseline stdout:\n{context.baseline_stdout}\n"
            f"Baseline stderr:\n{context.baseline_stderr}\n"
            f"Previous failures:\n{chr(10).join(context.previous_failures)}\n"
            f"Files:\n{_file_blob(context.files)}\n"
            "JSON keys: root_cause, hypothesis, evidence, files (path, content), "
            "files_changed, expected_behavior, expected_tests, patch_summary."
        )
        data = self._complete(system, user)
        proposal = _proposal_from_dict(data, demo=False)
        proposal.verified = False
        return proposal

    def generate_defender(self, context: DebugContext) -> AgentProposal:
        prosecutor = context.prosecutor_proposal
        prosecutor_blob = prosecutor.model_dump() if prosecutor else {}
        system = (
            f"You are the Defender agent ({PROMPT_VERSION}). Challenge the Prosecutor. "
            "Do not repeat their patch. Identify assumptions and propose an alternative. "
            "Never claim verification. Never modify tests. Return JSON."
        )
        user = (
            f"Project: {context.project_name}\n"
            f"Prosecutor proposal:\n{json.dumps(prosecutor_blob)}\n"
            f"Previous failures:\n{chr(10).join(context.previous_failures)}\n"
            f"Files:\n{_file_blob(context.files)}\n"
            "JSON keys: root_cause, hypothesis, evidence, objections, assumptions, "
            "falsification_tests, files, files_changed, expected_behavior, expected_tests, patch_summary."
        )
        data = self._complete(system, user)
        proposal = _proposal_from_dict(data, demo=False)
        proposal.verified = False
        return proposal

    def summarize_judge_evidence(self, evidence: str, verdict: str) -> str:
        try:
            data = self._complete(
                "Explain Judge runtime evidence in two sentences. Do not change the verdict.",
                f"Verdict: {verdict}\nEvidence: {evidence}",
            )
            return str(data.get("explanation") or data.get("summary") or evidence)
        except Exception:  # noqa: BLE001
            return evidence


def get_provider() -> LLMProvider:
    if settings.llm_api_key.strip():
        return OpenAICompatibleProvider()
    return DemoProvider()
