import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { CausalEdge } from "../../types/extended";

const COLORS: Record<string, number> = {
  test: 0xdc6803, location: 0x7a5af8, hypothesis: 0xf04452, patch: 0x2e90fa,
  expected: 0x12b76a, failure: 0xd92d20, default: 0x667085,
};

/** 3D causal knowledge graph backed by real session edges + accessible list. */
export const KnowledgeGraph3D = memo(function KnowledgeGraph3D({ edges }: { edges: CausalEdge[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const mount = ref.current;
    if (!mount || edges.length === 0) return;
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const w = mount.clientWidth || 600;
    const h = 360;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 5, 9);
    camera.lookAt(0, 0.5, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.1));

    const nodes = new Map<string, THREE.Vector3>();
    const labels = new Set<string>();
    for (const e of edges) {
      labels.add(e.from);
      labels.add(e.to);
    }
    const list = [...labels].slice(0, 40);
    list.forEach((label, i) => {
      const a = (i / Math.max(1, list.length)) * Math.PI * 2;
      const r = 3.2 + (i % 3) * 0.7;
      nodes.set(label, new THREE.Vector3(Math.cos(a) * r, (i % 5) * 0.5, Math.sin(a) * r));
    });
    const typeOf = (label: string) => edges.find((e) => e.from === label)?.from_type
      ?? edges.find((e) => e.to === label)?.to_type ?? "default";
    const meshes: THREE.Mesh[] = [];
    nodes.forEach((pos, label) => {
      const color = COLORS[typeOf(label)] ?? COLORS.default;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 18, 14),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
      );
      mesh.position.copy(pos);
      mesh.userData.label = label;
      scene.add(mesh);
      meshes.push(mesh);
    });
    for (const e of edges.slice(0, 60)) {
      const a = nodes.get(e.from);
      const b = nodes.get(e.to);
      if (!a || !b) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      scene.add(new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: e.challenged ? 0xd92d20 : 0x98a2b3, transparent: true, opacity: 0.6 }),
      ));
    }
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (ev: MouseEvent) => {
      const rect = renderer!.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(meshes)[0];
      if (hit) setSelected(String((hit.object as THREE.Mesh).userData.label));
    };
    renderer.domElement.addEventListener("click", onClick);
    let raf = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;
      if (!reduce) scene.rotation.y = clock.getElapsedTime() * 0.1;
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
  }, [edges, filter]);

  const visible = filter === "all" ? edges : edges.filter((e) => e.from_type === filter || e.to_type === filter);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        {(["all", "test", "location", "hypothesis", "patch", "expected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded border px-2 py-1 ${filter === f ? "border-primary bg-surface-2" : "border-border"}`}
            aria-pressed={filter === f}
          >
            {f}
          </button>
        ))}
      </div>
      {edges.length === 0 ? (
        <p className="text-sm text-muted">No causal edges yet — run a session to build the graph.</p>
      ) : (
        <div ref={ref} role="img" aria-label={`3D causal graph with ${visible.length} edges. Click a node to inspect.`} />
      )}
      {selected ? <p className="mt-1 text-xs">Selected: <span className="font-mono">{selected}</span></p> : null}
      <ul className="mt-2 max-h-40 overflow-auto text-xs text-muted">
        {visible.slice(0, 30).map((e) => (
          <li key={e.id} className="border-b border-border/60 py-1">
            <span className="font-mono">{e.from}</span> → <span className="font-mono">{e.to}</span>
            {e.challenged ? <span className="ml-2 text-danger">CHALLENGED: {e.challenge_note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
});
