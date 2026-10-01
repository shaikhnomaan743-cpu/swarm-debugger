import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CodeEditor } from "../components/CodeEditor";
import { createSession, startSession } from "../services/api";

const DEFAULT_SOURCE = "def divide(a, b):\n    return a / b\n";
const DEFAULT_TESTS =
  "from solution import divide\n\n\ndef test_divide_normal():\n    assert divide(10, 2) == 5\n\n\ndef test_divide_zero():\n    assert divide(1, 0) is None\n";

export function NewSessionPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("demo-divide");
  const [description, setDescription] = useState(
    "Demo: divide() crashes on zero instead of returning None.",
  );
  const [testCommand, setTestCommand] = useState("pytest -q");
  const [entryPoint, setEntryPoint] = useState("solution.py");
  const [language, setLanguage] = useState("python");
  const [maxRounds, setMaxRounds] = useState(5);
  const [useDemo, setUseDemo] = useState(true);
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [tests, setTests] = useState(DEFAULT_TESTS);
  const [testPath, setTestPath] = useState("test_solution.py");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!useDemo) {
      if (!source.trim()) {
        setError("Paste the buggy source file, or switch back to the demo fixture.");
        return;
      }
      if (!tests.trim()) {
        setError("Provide the failing test file so the Judge has runtime evidence.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const created = await createSession({
        project_name: projectName.trim() || "debug-session",
        language,
        description,
        test_command: testCommand.trim() || "pytest -q",
        entry_point: entryPoint.trim() || "solution.py",
        max_rounds: maxRounds,
        use_demo_fixture: useDemo,
        files: useDemo
          ? undefined
          : [
              { path: entryPoint.trim() || "solution.py", content: source },
              { path: testPath.trim() || "test_solution.py", content: tests },
            ],
      });
      await startSession(created.id);
      navigate(`/app/sessions/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <Link className="text-xs text-muted hover:text-text" to="/app">
          ← Dashboard
        </Link>
        <h1 className="mt-3 text-[28px] font-semibold">New debug session</h1>
        <p className="mt-2 text-sm text-muted">
          Baseline tests run first. Prosecutor and Defender only propose patches; the Judge accepts a
          fix from test evidence.
        </p>
      </div>

      <form
        className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6"
        onSubmit={onSubmit}
      >
        <label className="flex items-start gap-3 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={useDemo}
            onChange={(event) => setUseDemo(event.target.checked)}
          />
          <span>
            Use built-in demo fixture (divide by zero)
            <span className="block text-xs text-muted">
              Uncheck to paste your own buggy source and failing test instead.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Project name
            <input
              className="rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Language
            <select
              className="rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-primary"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="python">Python (supported)</option>
              <option value="javascript" disabled>
                JavaScript (planned)
              </option>
              <option value="typescript" disabled>
                TypeScript (planned)
              </option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm">
          Description
          <textarea
            className="min-h-20 rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What fails, and what should happen instead?"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            Test command
            <input
              className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              value={testCommand}
              onChange={(event) => setTestCommand(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Entry point
            <input
              className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              value={entryPoint}
              onChange={(event) => setEntryPoint(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Max rounds
            <input
              className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-[13px] outline-none focus:border-primary"
              type="number"
              min={1}
              max={10}
              value={maxRounds}
              onChange={(event) => setMaxRounds(Number(event.target.value) || 5)}
            />
          </label>
        </div>

        {useDemo ? null : (
          <div className="flex flex-col gap-5 rounded-lg border border-border bg-bg/40 p-4">
            <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
              <p className="text-xs text-muted">
                Test files are <span className="text-text">protected</span>: candidates may not modify
                them, and tampering is rejected by the Judge.
              </p>
              <label className="flex flex-col gap-2 font-mono text-[11px] text-muted">
                test path
                <input
                  className="rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-text outline-none focus:border-primary"
                  value={testPath}
                  onChange={(event) => setTestPath(event.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm">
              Buggy source — <span className="font-mono text-[12px] text-muted">{entryPoint}</span>
              <CodeEditor value={source} language="python" onChange={setSource} label="Buggy source code" />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Failing test — <span className="font-mono text-[12px] text-muted">{testPath} (protected)</span>
              <CodeEditor value={tests} language="python" onChange={setTests} label="Failing test code" />
            </label>
          </div>
        )}

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Starting…" : "Create and start"}
        </button>
      </form>
    </main>
  );
}
