import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { ArenaArt } from "../components/landing/ArenaArt";

const ArenaScene = lazy(() =>
  import("../components/landing/ArenaScene").then((m) => ({ default: m.ArenaScene })),
);

const NAV = [
  { label: "Dashboard", to: "/app" },
  { label: "Arena", to: "/app" },
  { label: "Workbench", to: "/app/new" },
  { label: "Investigation", to: "/app/history" },
  { label: "History", to: "/app/history" },
];

const MENU = [
  { icon: "+", title: "New Case", sub: "Upload code or paste", to: "/app/new", bg: "bg-[#2e90fa]" },
  { icon: "◈", title: "Arena", sub: "Watch agents debate", to: "/app", bg: "bg-[#fb6514]" },
  { icon: "▤", title: "Workbench", sub: "Edit, test and iterate", to: "/app/new", bg: "bg-[#0e9384]" },
  { icon: "◎", title: "Investigation", sub: "View reasoning & evidence", to: "/app/history", bg: "bg-[#7a5af8]" },
  { icon: "◷", title: "History", sub: "Past debugging sessions", to: "/app/history", bg: "bg-[#12b76a]" },
];

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect x="1" y="1" width="24" height="24" rx="6" fill="none" stroke="#101828" strokeWidth="2.4" />
        <path d="M10 8 L6 13 L10 18" fill="none" stroke="#101828" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 8 L20 13 L16 18" fill="none" stroke="#101828" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="text-[15px] font-extrabold tracking-wide text-[#101828]">SWARM DEBUGGER</span>
    </span>
  );
}

type CodeLine = { n: number; text: string; tone?: "bad" | "good" };

function CodeCard({
  title,
  file,
  lines,
  action,
}: {
  title: string;
  file: string;
  lines: CodeLine[];
  action?: { label: string; to: string };
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-[#e7e2d8] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#101828]">{title}</h3>
        <span className="flex items-center gap-1 font-mono text-[11px] text-[#667085]">
          {file}
          <span className="inline-block h-3 w-3 rounded-sm border border-[#d0d5dd]" aria-hidden />
        </span>
      </div>
      <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-[#f7f5f0] p-3 font-mono text-[12px] leading-6">
        {lines.map((line) => (
          <div
            key={line.n}
            className={
              line.tone === "bad"
                ? "-mx-1 bg-[#fde8ea] px-1"
                : line.tone === "good"
                  ? "-mx-1 bg-[#dcfae6] px-1"
                  : undefined
            }
          >
            <span className="mr-3 inline-block w-4 select-none text-right text-[#98a2b3]">{line.n}</span>
            <span className="text-[#344054]">{line.text}</span>
          </div>
        ))}
      </pre>
      {action ? (
        <Link
          to={action.to}
          className="mt-3 self-center rounded-lg bg-[#101828] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}

function Donut({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 84 84" className="h-24 w-24 -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#e7e2d8" strokeWidth="10" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="#12b76a"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-[#101828]">
        {pct}%
      </span>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f3ee] text-[#101828]">
      {/* header */}
      <header className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-4">
        <Link to="/" aria-label="Swarm Debugger home">
          <Logo />
        </Link>
        <nav className="mx-auto flex flex-wrap items-center gap-6 text-sm font-medium text-[#344054]" aria-label="Primary">
          {NAV.map((item) => (
            <Link key={item.label} to={item.to} className="hover:text-[#101828]">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#e7e2d8] bg-white px-3 py-1.5 text-xs font-medium text-[#344054]">
            Python (PyTest) ▾
          </span>
          <Link
            to="/app/new"
            className="rounded-lg bg-[#101828] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            ▶ Run Tests
          </Link>
          <Link to="/login" className="px-2 text-xs font-semibold text-[#344054] hover:text-[#101828]">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-10">
        {/* hero + arena */}
        <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)_300px]">
          {/* left: headline + menu */}
          <div className="flex flex-col gap-3">
            <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight">
              Debugging should prove itself.
            </h1>
            <p className="text-[15px] text-[#475467]">
              Competing AI agents. Real execution. Evidence-driven verification.
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {MENU.map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className="flex items-center gap-3 rounded-2xl border border-[#e7e2d8] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:shadow-md"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white ${item.bg}`}
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{item.title}</span>
                    <span className="block text-xs text-[#667085]">{item.sub}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* center: arena */}
          <div className="relative rounded-3xl border border-[#e7e2d8] bg-[#faf9f6] p-2">
            <div className="relative">
              <Suspense fallback={<ArenaArt />}>
                <ArenaScene />
              </Suspense>
              {/* speech bubbles */}
              <div className="absolute left-[4%] top-[30%] max-w-[150px] rounded-2xl rounded-bl-sm border border-[#bfe3ff] bg-[#eef6ff] p-2 text-[11px] leading-snug shadow-sm">
                <p className="font-bold text-[#1570ef]">Defender</p>
                <p className="text-[#344054]">That&apos;s not the real issue. Consider this alternative….</p>
              </div>
              <div className="absolute left-[38%] top-[2%] max-w-[160px] rounded-2xl rounded-bl-sm border border-[#f9cdd4] bg-[#fef1f2] p-2 text-[11px] leading-snug shadow-sm">
                <p className="text-[#344054]">I think the bug is due to empty list handling…</p>
              </div>
              <div className="absolute right-[2%] top-[26%] max-w-[150px] rounded-2xl rounded-br-sm border border-[#b7e9cd] bg-[#eefcf3] p-2 text-[11px] leading-snug shadow-sm">
                <p className="font-bold text-[#039855]">Judge</p>
                <p className="text-[#344054]">Let&apos;s run the tests and see the actual result.</p>
              </div>
            </div>
          </div>

          {/* right: execution panels */}
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-[#e7e2d8] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
                <span aria-hidden>◉</span> Test Execution
              </h2>
              <div className="flex items-center gap-4">
                <Donut pct={60} />
                <ul className="flex flex-col gap-2 text-xs">
                  <li className="flex items-center gap-2 text-[#1570ef]">
                    <span className="h-2 w-2 rounded-full bg-[#2e90fa]" aria-hidden /> Running tests…
                  </li>
                  <li className="flex items-center gap-2 text-[#039855]">
                    <span aria-hidden>✓</span> 5/8 tests passed
                  </li>
                  <li className="flex items-center gap-2 text-[#475467]">
                    <span aria-hidden>✓</span> Runtime: 198 ms
                  </li>
                </ul>
              </div>
            </section>
            <section className="rounded-2xl border border-[#e7e2d8] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
              <h2 className="mb-2 text-sm font-bold">Latest Output</h2>
              <div className="rounded-xl bg-[#f7f5f0] p-3 font-mono text-[11.5px] leading-6">
                <p className="text-[#667085]">pytest test_calculator.py</p>
                <p className="text-[#d92d20]">E&nbsp;&nbsp; ZeroDivisionError: division by zero</p>
                <p className="text-[#667085]">&nbsp;&nbsp;&nbsp;at calculate_average()</p>
                <p className="mt-1 text-[#344054]">1 failed, 5 passed in 0.21s</p>
              </div>
            </section>
            <Link
              to="/app"
              className="rounded-2xl bg-[#101828] p-4 text-center text-sm font-semibold text-white hover:opacity-90"
            >
              Open the live workspace →
            </Link>
          </div>
        </div>

        {/* bottom: code comparison */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CodeCard
            title="Buggy Code"
            file="calculator.py"
            lines={[
              { n: 1, text: "def divide(a, b):" },
              { n: 2, text: "    if b == 0:" },
              { n: 3, text: "        return a / b", tone: "bad" },
              { n: 4, text: "    return a / b" },
              { n: 5, text: "" },
              { n: 15, text: "def calculate_average(nums):" },
              { n: 16, text: "    return sum(nums) / len(nums)", tone: "bad" },
            ]}
          />
          <CodeCard
            title="Prosecutor's Fix"
            file="patch_a.py"
            lines={[
              { n: 1, text: "def calculate_average(nums):" },
              { n: 2, text: "    if not nums:", tone: "good" },
              { n: 3, text: "        return 0", tone: "good" },
              { n: 4, text: "    return sum(nums) / len(nums)" },
            ]}
            action={{ label: "Apply Fix", to: "/app/new" }}
          />
          <CodeCard
            title="Defender's Alternative"
            file="patch_b.py"
            lines={[
              { n: 1, text: "def calculate_average(nums):" },
              { n: 2, text: "    try:", tone: "good" },
              { n: 3, text: "        return sum(nums) / len(nums)" },
              { n: 4, text: "    except ZeroDivisionError:", tone: "good" },
              { n: 5, text: "        return 0", tone: "good" },
            ]}
            action={{ label: "Apply Alternative", to: "/app/new" }}
          />
          <section className="flex flex-col rounded-2xl border border-[#f3b7bd] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
            <h3 className="mb-2 text-sm font-bold text-[#101828]">Test Result</h3>
            <p className="flex items-center justify-center gap-2 rounded-xl bg-[#fde8ea] py-2 text-sm font-extrabold text-[#d92d20]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d92d20] text-xs text-white" aria-hidden>
                ✕
              </span>
              FAILED
            </p>
            <p className="mt-3 text-xs leading-6 text-[#d92d20]">
              ZeroDivisionError: division by zero at calculate_average() (test_calculator.py:12)
            </p>
            <p className="mt-auto pt-3 text-xs text-[#667085]">Runtime: 214 ms</p>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-[#667085]">
          Runtime evidence is the source of truth — the Judge only accepts a fix after real test
          execution. Demo login: <span className="font-mono">demo@swarm.local</span> /{" "}
          <span className="font-mono">demo</span>
        </p>
      </main>
    </div>
  );
}
