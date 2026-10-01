import { memo, useEffect, useRef } from "react";
import * as THREE from "three";

export type ReplayEvent = {
  id: string;
  type: string;
  message: string;
  created_at: string;
};

/** 3D session replay: chronological event spine with scrub index. */
export const Replay3D = memo(function Replay3D({
  events, index,
}: {
  events: ReplayEvent[];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

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
    const h = 280;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200);
    camera.position.set(0, 5, 11);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.1));
    const pts = events.slice(0, 80);
    const step = 0.55;
    const nodes: THREE.Mesh[] = [];
    pts.forEach((e, i) => {
      const active = i <= index;
      const color = e.type.includes("verified") ? 0x12b76a
        : e.type.includes("reject") || e.type.includes("fail") ? 0xd92d20
        : e.type.includes("prosecutor") ? 0xf04452
        : e.type.includes("defender") ? 0x2e90fa
        : 0x667085;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(active ? 0.26 : 0.16, 14, 12),
        new THREE.MeshStandardMaterial({
          color, roughness: 0.4, transparent: true, opacity: active ? 1 : 0.35,
        }),
      );
      mesh.position.set((i - pts.length / 2) * step, Math.sin(i * 0.7) * 0.8, 0);
      scene.add(mesh);
      nodes.push(mesh);
      if (i > 0) {
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([nodes[i - 1].position, mesh.position]),
          new THREE.LineBasicMaterial({ color: 0x98a2b3, transparent: true, opacity: 0.5 }),
        ));
      }
    });
    let raf = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;
      if (!reduce) scene.rotation.y = Math.sin(clock.getElapsedTime() * 0.2) * 0.2;
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
  }, [events, index]);

  if (events.length === 0) return <p className="text-sm text-muted">No events to replay yet.</p>;
  return <div ref={ref} role="img" aria-label={`3D replay at event ${index + 1} of ${events.length}`} />;
});
