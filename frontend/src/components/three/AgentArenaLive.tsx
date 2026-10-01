import { memo, useEffect, useRef } from "react";
import * as THREE from "three";

export type ArenaPhase =
  | "IDLE" | "ANALYZING" | "DEBATING" | "EXECUTING" | "TRACE"
  | "VERIFIED" | "REJECTED" | "NEXT_ROUND";

const NODES: { id: string; label: string; color: number; pos: [number, number, number] }[] = [
  { id: "prosecutor", label: "PROSECUTOR", color: 0xf04452, pos: [-3, 1, 0] },
  { id: "defender", label: "DEFENDER", color: 0x2e90fa, pos: [3, 1, 0] },
  { id: "judge", label: "JUDGE", color: 0x12b76a, pos: [0, 1, -3.2] },
  { id: "coordinator", label: "COORDINATOR", color: 0x101828, pos: [0, 2.6, 1.6] },
  { id: "localizer", label: "FAULT", color: 0xdc6803, pos: [-3, 1, 2.6] },
  { id: "probe", label: "PROBE", color: 0x7a5af8, pos: [3, 1, 2.6] },
  { id: "evidence", label: "EVIDENCE", color: 0x667085, pos: [0, 0.4, 0] },
  { id: "sandbox", label: "SANDBOX", color: 0x0e9384, pos: [0, 0.4, -1.4] },
];

function labelSprite(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = color;
  ctx.font = "700 22px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

/** State-driven 3D Agent Arena. Animation always reflects `phase` + `round`. */
export const AgentArenaLive = memo(function AgentArenaLive({
  phase = "IDLE",
  round = 0,
  height = 380,
}: {
  phase?: ArenaPhase;
  round?: number;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

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
    renderer.setSize(w, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / height, 0.1, 100);
    camera.position.set(0, 5.4, 8.4);
    camera.lookAt(0, 1, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 8, 3);
    scene.add(sun);
    const world = new THREE.Group();
    scene.add(world);

    const grid = new THREE.GridHelper(9, 12, 0xc9d2dd, 0xdde3ea);
    world.add(grid);

    const spheres = new Map<string, THREE.Mesh>();
    const mats = new Map<string, THREE.MeshStandardMaterial>();
    for (const n of NODES) {
      const mat = new THREE.MeshStandardMaterial({
        color: n.color, roughness: 0.35, emissive: n.color, emissiveIntensity: 0.15,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), mat);
      mesh.position.set(...n.pos);
      mesh.userData.id = n.id;
      world.add(mesh);
      spheres.set(n.id, mesh);
      mats.set(n.id, mat);
      const sprite = labelSprite(n.label, "#101828");
      if (sprite) {
        sprite.position.set(n.pos[0], n.pos[1] + 0.75, n.pos[2]);
        world.add(sprite);
      }
    }
    const link = (a: string, b: string, color = 0x98a2b3) => {
      const pa = spheres.get(a)?.position;
      const pb = spheres.get(b)?.position;
      if (!pa || !pb) return;
      const geo = new THREE.BufferGeometry().setFromPoints([pa.clone(), pb.clone()]);
      world.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })));
    };
    link("prosecutor", "evidence", 0xf04452);
    link("defender", "evidence", 0x2e90fa);
    link("evidence", "judge", 0x12b76a);
    link("judge", "sandbox", 0x12b76a);
    link("sandbox", "probe", 0x7a5af8);
    link("probe", "evidence", 0x7a5af8);
    link("coordinator", "prosecutor");
    link("coordinator", "defender");
    link("localizer", "evidence", 0xdc6803);

    // data particles prosecutor <-> defender + judge -> sandbox
    const P = 90;
    const positions = new Float32Array(P * 3);
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      pgeo,
      new THREE.PointsMaterial({ color: 0x6941c6, size: 0.09, transparent: true, opacity: 0.9 }),
    );
    world.add(points);

    let raf = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const animate = () => {
      if (disposed) return;
      const t = clock.getElapsedTime();
      const amp = reduce ? 0 : 1;
      // idle orbit
      world.rotation.y = reduce ? 0 : t * 0.08;
      // phase-driven activation
      const glow = (id: string, v: number) => mats.get(id)?.emissiveIntensity !== undefined &&
        (mats.get(id)!.emissiveIntensity = v);
      for (const n of NODES) glow(n.id, 0.15 + Math.sin(t * 1.2) * 0.05 * amp);
      if (phase === "ANALYZING") glow("prosecutor", 0.9);
      if (phase === "DEBATING") {
        glow("prosecutor", 0.8);
        glow("defender", 0.8);
      }
      if (phase === "EXECUTING") glow("sandbox", 0.9);
      if (phase === "TRACE") {
        glow("probe", 0.9);
        glow("evidence", 0.9);
      }
      if (phase === "VERIFIED") glow("judge", 1.2);
      if (phase === "REJECTED") glow("evidence", 0.7);
      // bobbing
      spheres.forEach((m, id) => {
        const base = NODES.find((n) => n.id === id)?.pos[1] ?? 1;
        m.position.y = base + Math.sin(t * 1.5 + base) * 0.08 * amp;
      });
      // particles: prosecutor<->defender when debating; judge->sandbox when executing
      const pa = spheres.get("prosecutor")?.position ?? tmpA;
      const pb =
        phase === "EXECUTING"
          ? (spheres.get("sandbox")?.position ?? tmpB)
          : (spheres.get("defender")?.position ?? tmpB);
      const src = phase === "TRACE" ? spheres.get("sandbox")?.position : pa;
      const dst = phase === "TRACE" ? spheres.get("probe")?.position : pb;
      for (let i = 0; i < P; i++) {
        const f = ((t * (phase === "IDLE" ? 0.15 : 0.6) + i / P) % 1 + 1) % 1;
        const a = src ?? pa;
        const b = dst ?? pb;
        positions[i * 3] = a.x + (b.x - a.x) * f;
        positions[i * 3 + 1] = a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * 0.5;
        positions[i * 3 + 2] = a.z + (b.z - a.z) * f;
      }
      pgeo.attributes.position.needsUpdate = true;
      renderer?.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(animate);
    };
    animate();
    // pause when tab hidden
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduce) animate();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          const m = c.material as THREE.Material;
          m.dispose();
        }
      });
      pgeo.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [phase, round, height]);

  return (
    <div>
      <div
        ref={ref}
        style={{ height }}
        role="img"
        aria-label={`3D agent arena, phase ${phase}, round ${round}. Prosecutor versus Defender feeding evidence to the Judge and sandbox.`}
      />
      <p className="mt-1 font-mono text-[11px] text-muted">
        Phase {phase} · Round {round} · animation driven by live session state
      </p>
    </div>
  );
});
