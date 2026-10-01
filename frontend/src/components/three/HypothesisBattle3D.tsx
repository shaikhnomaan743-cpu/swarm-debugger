import { memo, useEffect, useRef } from "react";
import * as THREE from "three";
import type { CandidateOut, ExecutionOut } from "../../types";

/** Hypothesis battle: bar heights from REAL evidence counts, not fake confidence. */
export const HypothesisBattle3D = memo(function HypothesisBattle3D({
  a, b, execA, execB, falsA, falsB,
}: {
  a?: CandidateOut;
  b?: CandidateOut;
  execA?: ExecutionOut;
  execB?: ExecutionOut;
  falsA?: string;
  falsB?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const strength = (exec?: ExecutionOut, fals?: string) => {
    if (!exec) return 0;
    const passed = exec.tests_passed ?? 0;
    const total = exec.tests_total ?? 1;
    let s = passed / Math.max(1, total);
    if (fals && fals.includes("failed")) s -= 0.3;
    return Math.max(0.05, Math.min(1, s));
  };
  const sA = strength(execA, falsA);
  const sB = strength(execB, falsB);

  useEffect(() => {
    const mount = ref.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const w = mount.clientWidth || 600;
    const h = 300;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 4.4, 8);
    camera.lookAt(0, 1.4, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.1));
    const mk = (x: number, s: number, color: number) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, Math.max(0.2, s * 3.4), 1.4),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
      );
      mesh.position.set(x, mesh.geometry.parameters.height / 2, 0);
      scene.add(mesh);
    };
    mk(-1.6, sA, 0xf04452);
    mk(1.6, sB, 0x2e90fa);
    const grid = new THREE.GridHelper(8, 8, 0xc9d2dd, 0xdde3ea);
    scene.add(grid);
    let raf = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;
      if (!reduce) scene.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.25;
      renderer?.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [sA, sB]);

  return (
    <div>
      <div ref={ref} role="img" aria-label={`Hypothesis battle. Candidate A strength ${sA.toFixed(2)}, candidate B strength ${sB.toFixed(2)} from test evidence.`} />
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded border border-prosecutor/40 p-2">
          <p className="font-semibold text-prosecutor">HYPOTHESIS A — {a?.agent ?? "prosecutor"}</p>
          <p className="mt-1">{a?.hypothesis || "No hypothesis"}</p>
          <p className="mt-1 font-mono text-muted">
            tests {execA?.tests_passed ?? 0}/{execA?.tests_total ?? 0} · {execA?.status ?? "pending"} · falsification {falsA ? "recorded" : "pending"}
          </p>
        </div>
        <div className="rounded border border-defender/40 p-2">
          <p className="font-semibold text-defender">HYPOTHESIS B — {b?.agent ?? "defender"}</p>
          <p className="mt-1">{b?.hypothesis || "No hypothesis"}</p>
          <p className="mt-1 font-mono text-muted">
            tests {execB?.tests_passed ?? 0}/{execB?.tests_total ?? 0} · {execB?.status ?? "pending"} · falsification {falsB ? "recorded" : "pending"}
          </p>
        </div>
      </div>
    </div>
  );
});
