import * as THREE from "three";

type OcctMesh = {
  attributes: { position: { array: number[] }; normal?: { array: number[] } };
  index: { array: number[] };
  brep_faces?: { first: number; last: number }[];
};

type OcctResult = { success: boolean; meshes: OcctMesh[] };

export type StepFace = { geometry: THREE.BufferGeometry };

/**
 * Reads a STEP file in a Web Worker (OpenCascade compiled to WebAssembly, copied to /vendor/occt by
 * scripts/copy-vendor.mjs) and returns one geometry per B-rep face, so faces can be picked and outlined.
 */
export async function readStep(source: string | ArrayBuffer): Promise<StepFace[]> {
  const buffer = typeof source === "string" ? await (await fetch(source)).arrayBuffer() : source;
  const result = await new Promise<OcctResult>((resolve, reject) => {
    const worker = new Worker("/vendor/occt/occt-import-js-worker.js");
    worker.onmessage = (ev: MessageEvent<OcctResult>) => {
      worker.terminate();
      resolve(ev.data);
    };
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(ev.message || "STEP reader failed"));
    };
    worker.postMessage({
      format: "step",
      buffer: new Uint8Array(buffer),
      params: { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.0015, angularDeflection: 0.35 },
    });
  });
  if (!result.success || !result.meshes?.length) throw new Error("This STEP file has no solid we can show.");

  const faces: StepFace[] = [];
  for (const m of result.meshes) {
    const position = new THREE.Float32BufferAttribute(m.attributes.position.array, 3);
    const normal = m.attributes.normal ? new THREE.Float32BufferAttribute(m.attributes.normal.array, 3) : null;
    const index = m.index.array;
    const ranges = m.brep_faces?.length ? m.brep_faces : [{ first: 0, last: index.length / 3 - 1 }];
    for (const r of ranges) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", position);
      if (normal) g.setAttribute("normal", normal);
      g.setIndex(index.slice(r.first * 3, (r.last + 1) * 3));
      if (!normal) g.computeVertexNormals();
      faces.push({ geometry: g });
    }
  }
  return faces;
}
