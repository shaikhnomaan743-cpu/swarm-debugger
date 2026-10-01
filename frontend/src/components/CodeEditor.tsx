import { Component, ReactNode, Suspense, lazy, useState } from "react";

const MonacoEditor = lazy(() => import("@monaco-editor/react").then((m) => ({ default: m.default })));

type CodeEditorProps = {
  value: string;
  language?: string;
  readOnly?: boolean;
  height?: number | string;
  onChange?: (value: string) => void;
  label?: string;
};

function PlainEditor({ value, readOnly, height, onChange, label }: CodeEditorProps) {
  return (
    <textarea
      aria-label={label ?? "code editor"}
      className="w-full rounded-md border border-border bg-bg p-3 font-mono text-[12px] leading-5 outline-none focus:border-primary"
      style={{ minHeight: typeof height === "number" ? height : 280 }}
      value={value}
      readOnly={readOnly}
      spellCheck={false}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

class EditorErrorBoundary extends Component<
  { onError: () => void; fallback: ReactNode; children: ReactNode },
  { broken: boolean }
> {
  state = { broken: false };

  static getDerivedStateFromError() {
    return { broken: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.broken) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Monaco code editor (loaded lazily so the main bundle stays small) with a
 * plain-textarea fallback when the CDN build is unreachable (offline demos,
 * restricted networks) or when rich editing fails in tests.
 */
export function CodeEditor(props: CodeEditorProps) {
  const { value, language = "python", readOnly = false, height = 280, onChange, label } = props;
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <PlainEditor {...props} />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Suspense fallback={<PlainEditor value={value} readOnly height={height} label={label} />}>
        <EditorErrorBoundary onError={() => setFailed(true)} fallback={<PlainEditor {...props} />}>
          <MonacoEditor
            height={height}
            language={language}
            value={value}
            theme="vs"
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              padding: { top: 8 },
            }}
            onChange={(next) => onChange?.(next ?? "")}
          />
        </EditorErrorBoundary>
      </Suspense>
    </div>
  );
}
