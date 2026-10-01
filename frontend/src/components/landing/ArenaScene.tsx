import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ArenaArt } from "./ArenaArt";

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function codeFaceTexture(bg: string) {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(0, 0, 256, 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 96px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("</>", 128, 140);
  });
}

function labelTexture() {
  return canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = "#101828";
    roundRect(ctx, 4, 14, 504, 100, 22);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SWARM DEBUGGER", 256, 66);
  });
}

type RobotSpec = { color: number; dark: number; position: [number, number, number]; scale: number; phase: number };

function makeRobot({ color, dark, position, scale }: RobotSpec) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.5 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.42, 6, 20), bodyMat);
  body.position.y = 0.72;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), darkMat);
  belly.position.set(0, 0.62, 0.3);
  group.add(belly);
  const bellyDot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), whiteMat);
  bellyDot.position.set(0, 0.64, 0.38);
  group.add(bellyDot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
  head.position.y = 1.12;
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.18), darkMat);
  visor.position.set(0, 1.3, 0.22);
  group.add(visor);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), whiteMat);
    eye.position.set(side * 0.11, 1.31, 0.31);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), darkMat);
    pupil.position.set(side * 0.11, 1.31, 0.365);
    group.add(pupil);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 12), bodyMat);
    arm.position.set(side * 0.44, 0.72, 0);
    arm.rotation.z = side * -0.45;
    group.add(arm);
  }

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), bodyMat);
  antenna.position.y = 1.62;
  group.add(antenna);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), bodyMat);
  tip.position.y = 1.75;
  group.add(tip);

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  group.position.set(...position);
  group.scale.setScalar(scale);
  // Face the platform center.
  group.rotation.y = Math.atan2(-position[0], -position[2]);
  return group;
}

function makeArrow(from: THREE.Vector3, to: THREE.Vector3, color: number) {
  const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 1.1, 0));
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    emissive: color,
    emissiveIntensity: 0.25,
  });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 8), mat));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 12), mat);
  cone.position.copy(to);
  const tangent = curve.getTangent(1).normalize();
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  group.add(cone);
  return { group, mat };
}

/**
 * Animated Three.js agent arena. Falls back to the static SVG illustration
 * when WebGL is unavailable (tests, old browsers).
 */
export function ArenaScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer | null = null;
    let frame = 0;
    let disposed = false;
    const disposables: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    if (!renderer.getContext()) {
      setFailed(true);
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const width = mount.clientWidth || 640;
    const height = Math.max(320, (width * 470) / 640);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(7.6, 6.2, 9.6);
    camera.lookAt(0, 1.1, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(5, 9, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    scene.add(sun);

    const world = new THREE.Group();
    scene.add(world);

    // Platform slabs.
    const slab = (w: number, h: number, y: number, color: number) => {
      const mesh = new THREE.Mesh(
        track(new THREE.BoxGeometry(w, h, w)),
        track(new THREE.MeshStandardMaterial({ color, roughness: 0.9 })),
      );
      mesh.position.y = y;
      mesh.receiveShadow = true;
      world.add(mesh);
    };
    slab(7, 0.5, -0.25, 0xeef1f5);
    slab(6.4, 0.4, -0.7, 0xd5dbe3);
    slab(5.8, 0.35, -1.05, 0xc3ccd7);

    const grid = new THREE.GridHelper(6.4, 8, 0xc9d2dd, 0xdde3ea);
    grid.position.y = 0.012;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.7;
    world.add(grid);

    // Central code cube.
    const cube = new THREE.Group();
    const faces = [
      codeFaceTexture("#53389e"),
      codeFaceTexture("#6941c6"),
      codeFaceTexture("#7a5af8"),
      codeFaceTexture("#53389e"),
      codeFaceTexture("#9b8afb"),
      codeFaceTexture("#4a2fa0"),
    ].map((tex) => track(new THREE.MeshStandardMaterial({ map: track(tex), roughness: 0.4 })));
    const cubeMesh = new THREE.Mesh(track(new THREE.BoxGeometry(1.3, 1.3, 1.3)), faces);
    cubeMesh.castShadow = true;
    cube.add(cubeMesh);
    cube.position.set(0, 1.75, 0);
    world.add(cube);

    const label = new THREE.Mesh(
      track(new THREE.PlaneGeometry(3.3, 0.82)),
      track(new THREE.MeshBasicMaterial({ map: track(labelTexture()), transparent: true })),
    );
    label.position.set(0, 0.5, 3.1);
    world.add(label);

    // Robots.
    const specs: RobotSpec[] = [
      { color: 0x2e90fa, dark: 0x122a4d, position: [-2.5, 0, 0.9], scale: 1.05, phase: 0 },
      { color: 0xf04452, dark: 0x4d1220, position: [0, 0, -2.4], scale: 0.88, phase: 2.1 },
      { color: 0x12b76a, dark: 0x0b3d28, position: [2.5, 0, 0.9], scale: 1.05, phase: 4.2 },
    ];
    const robots = specs.map((spec) => {
      const robot = makeRobot(spec);
      world.add(robot);
      return { node: robot, baseYaw: robot.rotation.y, phase: spec.phase };
    });

    // Debate arrows robot -> cube.
    const arrows = specs.map((spec, i) => {
      const colors = [0x2e90fa, 0xf04452, 0x12b76a];
      const from = new THREE.Vector3(spec.position[0], 1.5, spec.position[2]);
      const to = new THREE.Vector3(spec.position[0] * 0.22, 2.0, spec.position[2] * 0.22);
      const arrow = makeArrow(from, to, colors[i]);
      world.add(arrow.group);
      return arrow;
    });

    // Floating deco cubes.
    const deco: { node: THREE.Mesh; phase: number }[] = [];
    const decoCols = [0xd7e3f8, 0xd3f8df, 0xfbd7dc, 0xe6defc];
    const decoPos: [number, number, number][] = [
      [-3.6, 2.4, -1.4],
      [3.6, 2.8, -1.6],
      [3.8, 1.8, 2.2],
      [-3.8, 2.0, 2.0],
    ];
    decoPos.forEach((pos, i) => {
      const mesh = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.34, 0.34, 0.34)),
        track(new THREE.MeshStandardMaterial({ color: decoCols[i], roughness: 0.6 })),
      );
      mesh.position.set(...pos);
      mesh.castShadow = true;
      world.add(mesh);
      deco.push({ node: mesh, phase: i * 1.7 });
    });

    // Drag to look around + gentle auto-rotate.
    let yaw = 0;
    let targetYaw = 0;
    let dragging = false;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      targetYaw += (e.clientX - lastX) * 0.006;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const onResize = () => {
      const w = mount.clientWidth || 640;
      const h = Math.max(320, (w * 470) / 640);
      renderer?.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(mount);

    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;
      const t = clock.getElapsedTime();
      if (!reduceMotion && !dragging) targetYaw += 0.0016;
      yaw += (targetYaw - yaw) * 0.06;
      world.rotation.y = yaw;

      const amp = reduceMotion ? 0 : 1;
      robots.forEach(({ node, baseYaw, phase }) => {
        node.position.y = Math.sin(t * 1.4 + phase) * 0.09 * amp;
        node.rotation.y = baseYaw + Math.sin(t * 0.6 + phase) * 0.28 * amp;
      });
      cubeMesh.rotation.y = t * 0.5 * amp;
      cube.position.y = 1.75 + Math.sin(t * 1.1) * 0.1 * amp;
      arrows.forEach((arrow, i) => {
        arrow.mat.emissiveIntensity = 0.25 + (Math.sin(t * 2 + i * 2.1) * 0.5 + 0.5) * 0.35 * amp;
      });
      deco.forEach(({ node, phase }) => {
        node.position.y += Math.sin(t * 1.2 + phase) * 0.002 * amp;
        node.rotation.x = t * 0.3 + phase;
        node.rotation.y = t * 0.4 + phase;
      });
      label.lookAt(camera.position);
      renderer?.render(scene, camera);
      if (!reduceMotion) frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer?.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const mat = child.material;
          (Array.isArray(mat) ? mat : [mat]).forEach((m) => {
            const withMap = m as THREE.MeshStandardMaterial;
            withMap.map?.dispose();
            m.dispose();
          });
        }
      });
      disposables.forEach((d) => {
        try {
          d.dispose();
        } catch {
          /* already disposed via traversal */
        }
      });
      renderer?.dispose();
      renderer?.domElement.remove();
      renderer = null;
    };
  }, []);

  if (failed) {
    return <ArenaArt />;
  }
  return <div ref={mountRef} className="min-h-[320px] w-full cursor-grab active:cursor-grabbing" aria-label="Animated 3D swarm agent arena. Drag to look around." />;
}
