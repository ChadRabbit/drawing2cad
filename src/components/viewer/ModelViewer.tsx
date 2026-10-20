"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { describeFace, parseFaceName, type FaceInfo } from "./faces";
import { readStep } from "./step";

export type ViewName = "iso" | "front" | "top" | "right" | "back" | "left" | "bottom";

export type Readout = {
  title: string;
  detail: string;
  point: [number, number, number];
  face: FaceInfo;
};

export type ModelStats = {
  size: [number, number, number];
  faces: number;
  triangles: number;
};

export type ModelViewerHandle = {
  setView: (view: ViewName) => void;
  setEdges: (on: boolean) => void;
  snapshot: (width: number, height: number) => Promise<Blob | null>;
  exportGlb: () => Promise<ArrayBuffer | null>;
};

type Props = {
  src: string;
  format?: "glb" | "step";
  theme?: "light" | "dark";
  autoRotate?: boolean;
  zoom?: boolean;
  /** On touch screens, wait for a tap before the model takes over the finger (so the page can scroll). */
  touchGate?: boolean;
  initialView?: ViewName;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  onReadout?: (r: Readout | null) => void;
  onLoad?: (stats: ModelStats) => void;
  onError?: (message: string) => void;
};

// CAD is Z-up; three.js is Y-up. Directions below are in three.js space after the model is turned.
const VIEW_DIRS: Record<ViewName, [number, number, number]> = {
  iso: [1, 0.78, 1.18],
  front: [0, 0, 1],
  back: [0, 0, -1],
  top: [0, 1, 0.0001],
  bottom: [0, -1, 0.0001],
  right: [1, 0, 0],
  left: [-1, 0, 0],
};

const THEMES = {
  light: { face: 0xe9e9e6, edge: 0x161616, hover: 0xc8f075, sky: 0xffffff, ground: 0x8a8a8a },
  dark: { face: 0x3b3b3b, edge: 0xe2e2e2, hover: 0xdafa9c, sky: 0xffffff, ground: 0x202020 },
};

type Scene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  pivot: THREE.Group; // turns Z-up into Y-up
  model: THREE.Group; // offset so the part's centre sits at the origin
  faces: THREE.Mesh[];
  edges: THREE.LineSegments[];
  radius: number;
  faceMat: THREE.MeshStandardMaterial;
  hoverMat: THREE.MeshStandardMaterial;
  edgeMat: THREE.LineBasicMaterial;
  render: () => void;
};

const ModelViewer = forwardRef<ModelViewerHandle, Props>(function ModelViewer(
  {
    src,
    format = "glb",
    theme = "light",
    autoRotate = false,
    zoom = true,
    touchGate = false,
    initialView = "iso",
    className,
    style,
    label = "3D model",
    onReadout,
    onLoad,
    onError,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [gateOpen, setGateOpen] = useState(!touchGate);
  const [coarse, setCoarse] = useState(false);
  const callbacks = useRef({ onReadout, onLoad, onError });
  callbacks.current = { onReadout, onLoad, onError };

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const colours = THEMES[theme];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100000);
    scene.add(camera);
    scene.add(new THREE.HemisphereLight(colours.sky, colours.ground, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.2, 1.6, 2);
    camera.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-2, -0.5, -1);
    camera.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = zoom;
    controls.enableZoom = zoom;
    controls.rotateSpeed = 0.85;
    controls.autoRotate = autoRotate && !reduced;
    controls.autoRotateSpeed = 1.1;
    if (touchGate) controls.enabled = false;

    const pivot = new THREE.Group();
    pivot.rotation.x = -Math.PI / 2;
    const model = new THREE.Group();
    pivot.add(model);
    scene.add(pivot);

    const faceMat = new THREE.MeshStandardMaterial({
      color: colours.face,
      metalness: 0.08,
      roughness: 0.62,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const hoverMat = faceMat.clone();
    hoverMat.color.set(colours.hover);
    const edgeMat = new THREE.LineBasicMaterial({ color: colours.edge });

    let frame = 0;
    let visible = true;
    let disposed = false;
    const render = () => {
      if (!frame) {
        frame = requestAnimationFrame(tick);
      }
    };
    const tick = () => {
      frame = 0;
      if (disposed) return;
      const moving = controls.update();
      renderer.render(scene, camera);
      if ((controls.autoRotate || moving) && visible && !document.hidden) render();
    };

    const s: Scene = {
      renderer,
      scene,
      camera,
      controls,
      pivot,
      model,
      faces: [],
      edges: [],
      radius: 1,
      faceMat,
      hoverMat,
      edgeMat,
      render,
    };
    sceneRef.current = s;

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) render();
    });
    io.observe(host);
    const onVisibility = () => !document.hidden && render();
    document.addEventListener("visibilitychange", onVisibility);
    controls.addEventListener("change", render);
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
    });

    // ---- hover / tap to read a face -------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hovered: THREE.Mesh | null = null;
    let downAt: [number, number] | null = null;

    const pick = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(s.faces, false)[0];
      const mesh = (hit?.object as THREE.Mesh | undefined) ?? null;
      if (mesh !== hovered) {
        if (hovered) hovered.material = faceMat;
        hovered = mesh;
        if (hovered) hovered.material = hoverMat;
        render();
      }
      if (!hit || !mesh) {
        callbacks.current.onReadout?.(null);
        return;
      }
      const p = model.worldToLocal(hit.point.clone());
      const face = (mesh.userData.face as FaceInfo) ?? { index: 0, kind: "unknown" };
      const { title, detail } = describeFace(face);
      callbacks.current.onReadout?.({ title, detail, point: [p.x, p.y, p.z], face });
    };

    let pending: [number, number] | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons) return;
      if (!pending) {
        requestAnimationFrame(() => {
          if (pending) pick(pending[0], pending[1]);
          pending = null;
        });
      }
      pending = [e.clientX, e.clientY];
    };
    const onLeave = () => {
      if (hovered) hovered.material = faceMat;
      hovered = null;
      callbacks.current.onReadout?.(null);
      render();
    };
    const onDown = (e: PointerEvent) => {
      downAt = [e.clientX, e.clientY];
    };
    const onUp = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
      downAt = null;
      if (moved < 5 && e.pointerType !== "mouse") pick(e.clientX, e.clientY);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // ---- load --------------------------------------------------------------------------------
    const finish = () => {
      if (disposed) return;
      // measure in the part's own (CAD, Z-up) coordinates, then centre it inside the turned pivot
      pivot.rotation.x = 0;
      pivot.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      pivot.rotation.x = -Math.PI / 2;
      model.position.copy(centre).multiplyScalar(-1);
      pivot.updateMatrixWorld(true);
      s.radius = Math.max(size.length() / 2, 1);
      camera.near = s.radius / 100;
      camera.far = s.radius * 100;
      camera.updateProjectionMatrix();
      applyView(s, initialView, false);
      let triangles = 0;
      for (const f of s.faces) triangles += (f.geometry.index?.count ?? f.geometry.attributes.position.count) / 3;
      setState("ready");
      callbacks.current.onLoad?.({
        size: [size.x, size.y, size.z],
        faces: s.faces.length,
        triangles: Math.round(triangles),
      });
      render();
    };

    const fail = (err: unknown) => {
      if (disposed) return;
      console.error(err);
      setState("error");
      callbacks.current.onError?.("The 3D preview could not be loaded.");
    };

    if (format === "step") {
      readStep(src)
        .then((parts) => {
          if (disposed) return;
          parts.forEach((part, i) => {
            const mesh = new THREE.Mesh(part.geometry, faceMat);
            mesh.name = `face:${i}`;
            mesh.userData.face = { index: i, kind: "unknown" } satisfies FaceInfo;
            model.add(mesh);
            s.faces.push(mesh);
            const lines = new THREE.LineSegments(new THREE.EdgesGeometry(part.geometry, 35), edgeMat);
            lines.name = "edges";
            model.add(lines);
            s.edges.push(lines);
          });
          finish();
        })
        .catch(fail);
    } else {
      new GLTFLoader()
        .loadAsync(src)
        .then((gltf) => {
          if (disposed) return;
          const found: { mesh: THREE.Mesh; face: FaceInfo }[] = [];
          const lines: THREE.LineSegments[] = [];
          let n = 0;
          gltf.scene.updateMatrixWorld(true);
          gltf.scene.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              const m = o as THREE.Mesh;
              const name = (m.userData.name as string | undefined) ?? m.name;
              const face = parseFaceName(name) ?? { index: n, kind: "unknown" as const };
              n += 1;
              found.push({ mesh: m, face });
            } else if ((o as THREE.LineSegments).isLineSegments) {
              lines.push(o as THREE.LineSegments);
            }
          });
          for (const { mesh, face } of found) {
            const geom = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
            if (!geom.attributes.normal) geom.computeVertexNormals();
            const out = new THREE.Mesh(geom, faceMat);
            out.name = `face:${face.index}`;
            out.userData.face = face;
            model.add(out);
            s.faces.push(out);
          }
          if (lines.length) {
            for (const l of lines) {
              const out = new THREE.LineSegments(l.geometry.clone().applyMatrix4(l.matrixWorld), edgeMat);
              out.name = "edges";
              model.add(out);
              s.edges.push(out);
            }
          } else {
            for (const f of s.faces) {
              const out = new THREE.LineSegments(new THREE.EdgesGeometry(f.geometry, 35), edgeMat);
              out.name = "edges";
              model.add(out);
              s.edges.push(out);
            }
          }
          finish();
        })
        .catch(fail);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      model.traverse((o) => {
        const g = (o as THREE.Mesh).geometry;
        if (g) g.dispose();
      });
      faceMat.dispose();
      hoverMat.dispose();
      edgeMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
    // The scene is rebuilt only when the file or its look changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, format, theme]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.controls.enabled = gateOpen;
  }, [gateOpen, state]);

  useImperativeHandle(
    ref,
    () => ({
      setView: (view) => {
        const s = sceneRef.current;
        if (s) applyView(s, view, true);
      },
      setEdges: (on) => {
        const s = sceneRef.current;
        if (!s) return;
        for (const e of s.edges) e.visible = on;
        s.render();
      },
      snapshot: async (width, height) => {
        const s = sceneRef.current;
        if (!s) return null;
        const { renderer, camera } = s;
        const prevSize = renderer.getSize(new THREE.Vector2());
        const prevRatio = renderer.getPixelRatio();
        const prevAspect = camera.aspect;
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.render(s.scene, camera);
        const blob = await new Promise<Blob | null>((resolve) => renderer.domElement.toBlob(resolve, "image/webp", 0.9));
        renderer.setPixelRatio(prevRatio);
        renderer.setSize(prevSize.x, prevSize.y, false);
        camera.aspect = prevAspect;
        camera.updateProjectionMatrix();
        s.render();
        return blob;
      },
      exportGlb: async () => {
        const s = sceneRef.current;
        if (!s) return null;
        const group = new THREE.Group();
        for (const f of s.faces) {
          const m = new THREE.Mesh(f.geometry, new THREE.MeshStandardMaterial({ color: 0xdddddd }));
          m.name = f.name;
          group.add(m);
        }
        for (const e of s.edges) {
          // the exporter only reads the colour; a basic material keeps it from warning about line materials
          const l = new THREE.LineSegments(e.geometry, new THREE.MeshBasicMaterial({ color: 0x111111 }));
          l.name = "edges";
          group.add(l);
        }
        const out = await new GLTFExporter().parseAsync(group, { binary: true });
        return out as ArrayBuffer;
      },
    }),
    [],
  );

  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <div
        ref={hostRef}
        role="img"
        aria-label={label}
        style={{
          position: "absolute",
          inset: 0,
          touchAction: gateOpen ? "none" : "pan-y",
          cursor: state === "ready" ? "grab" : "default",
        }}
      />
      {state === "loading" && <ViewerNote theme={theme}>Loading the model…</ViewerNote>}
      {state === "error" && <ViewerNote theme={theme}>The 3D preview could not be loaded.</ViewerNote>}
      {touchGate && coarse && !gateOpen && state === "ready" && (
        <button
          type="button"
          onClick={() => setGateOpen(true)}
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
            border: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 14,
            cursor: "pointer",
          }}
          aria-label="Tap to turn the model"
        >
          <span
            style={{
              fontSize: 13,
              padding: "6px 12px",
              borderRadius: 999,
              background: theme === "light" ? "#0f0f0f" : "#ffffff",
              color: theme === "light" ? "#ffffff" : "#0f0f0f",
            }}
          >
            Tap to turn it
          </span>
        </button>
      )}
    </div>
  );
});

function ViewerNote({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <p
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        fontSize: 14,
        color: theme === "light" ? "#5c5c5c" : "#9a9a9a",
        pointerEvents: "none",
      }}
    >
      {children}
    </p>
  );
}

function applyView(s: Scene, view: ViewName, animate: boolean) {
  const dir = new THREE.Vector3(...VIEW_DIRS[view]).normalize();
  const fov = THREE.MathUtils.degToRad(s.camera.fov);
  const fitH = s.radius / Math.sin(fov / 2);
  const fitW = fitH / Math.min(1, s.camera.aspect);
  const dist = Math.max(fitH, fitW) * 1.08;
  const target = new THREE.Vector3(0, 0, 0);
  const to = dir.multiplyScalar(dist);
  s.controls.minDistance = s.radius * 0.4;
  s.controls.maxDistance = s.radius * 12;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!animate || reduced) {
    s.camera.position.copy(to);
    s.controls.target.copy(target);
    s.camera.up.set(0, 1, 0);
    s.controls.update();
    s.render();
    return;
  }
  const from = s.camera.position.clone();
  const fromTarget = s.controls.target.clone();
  const start = performance.now();
  const duration = 520;
  const ease = (t: number) => 1 - Math.pow(1 - t, 4);
  const swing = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  s.controls.autoRotate = false;
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / duration);
    const k = ease(t);
    // travel on a sphere so the camera swings round the part instead of passing through it
    const dirNow = from.clone().normalize().applyQuaternion(new THREE.Quaternion().slerp(swing, k));
    const len = THREE.MathUtils.lerp(from.length(), to.length(), k);
    s.camera.position.copy(dirNow.multiplyScalar(len || dist));
    s.controls.target.lerpVectors(fromTarget, target, k);
    s.controls.update();
    s.renderer.render(s.scene, s.camera);
    if (t < 1) requestAnimationFrame(step);
    else s.render();
  };
  requestAnimationFrame(step);
}

export default ModelViewer;
