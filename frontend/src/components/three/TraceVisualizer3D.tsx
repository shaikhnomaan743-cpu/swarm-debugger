import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { TracePoint } from "../../types/extended";

/** 3D execution-trace path: START → calls → branch → return/failure. Click = inspect. */
export const TraceVisualizer3D = memo(function TraceVisualizer3D({ events }: { events: TracePoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<TracePoint | null>(null);

  useEffect(() => {
    const mount = ref.current;
    if (!mount || events.length === 0) return;
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const w = mount.clientWidth || 600;
    const h = 340;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.1));

    const pts = events.slice(0, 120);
    const positions = pts.map((_, i) => {
      const a = (i / Math.max(1, pts.length)) * Math.PI * 4;
      return new THREE.Vector3(Math.cos(a) * (2 + i * 0.02), i * 0.09 - 3, Math.sin(a) * (2 + i * 0.02));
    });
    const colorFor = (kind: string) =>
      kind === "exception" ? 0xd92d20 : kind === "enter" ? 0x2e90fa : kind === "exit" ? 0x12b76a : 0x7a5af8;
    const meshes: THREE.Mesh[] = [];
    positions.forEach((p, i) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 14, 12),
        new THREE.MeshStandardMaterial({ color: colorFor(pts[i].kind), roughness: 0.4 }),
      );
      mesh.position.copy(p);
      mesh.userData.index = i;
      scene.add(mesh);
      meshes.push(mesh);
    });
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(positions),
      new THREE.LineBasicMaterial({ color: 0x98a2b3 }),
    ));
    // moving pulse along the path
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x101828 }),
    );
    scene.add(pulse);

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (ev: MouseEvent) => {
      const rect = renderer!.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(meshes)[0];
      if (hit) setSel(pts[Number((hit.object as THREE.Mesh).userData.index)]);
    };
    renderer.domElement.addEventListener("click", onClick);
    let raf = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;
      const t = reduce ? 0 : clock.getElapsedTime() * 0.25;
      const idx = Math.floor(t * 8) % Math.max(1, positions.length);
      pulse.position.copy(positions[idx]);
      renderer?.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer?.domElement.removeEventListener("click", onClick);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [events]);

  if (events.length === 0) {
    return <p className="text-sm text-muted">No trace events yet — execute a candidate with the runtime probe enabled.</p>;
  }
  return (
    <div>
      <div ref={ref} role="img" aria-label={`3D execution trace with ${events.length} events`} />
      {sel ? (
        <dl className="mt-2 grid gap-1 rounded border border-border bg-surface-2 p-3 font-mono text-[11px]">
          <div><dt className="inline text-muted">function </dt><dd className="inline">{sel.function} @ {sel.file}:{sel.line ?? "?"}</dd></div>
          <div><dt className="inline text-muted">kind </dt><dd className="inline">{sel.kind}</dd></div>
          <div><dt className="inline text-muted">note </dt><dd className="inline">{sel.note}</dd></div>
          <div><dt className="inline text-muted">vars </dt><dd className="inline">{JSON.stringify(sel.variables).slice(0, 400)}</dd></div>
        </dl>
      ) : (
        <p className="mt-1 text-xs text-muted">Click a node to inspect function, file, line, variable state, and timestamp.</p>
      )}
    </div>
  );
});
