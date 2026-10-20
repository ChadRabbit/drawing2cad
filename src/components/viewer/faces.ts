// Face labels written into preview GLBs by the model exporter:
//   face:<i>;k=<kind>;a=<area mm²>;d=<diameter>;span=<deg>;cv=<0|1>;n=<x,y,z>;p=<param>
// A GLB without labels (or a STEP read in the browser) gives plain "face:<i>" names.

export type FaceKind = "plane" | "cylinder" | "cone" | "torus" | "surface" | "unknown";

export type FaceInfo = {
  index: number;
  kind: FaceKind;
  area?: number;
  d?: number;
  span?: number;
  convex?: boolean;
  normal?: [number, number, number];
  p?: number;
};

export function parseFaceName(name: string): FaceInfo | null {
  if (!name.startsWith("face:")) return null;
  const [head, ...pairs] = name.split(";");
  const index = Number(head.slice(5).split(":")[0]);
  const info: FaceInfo = { index: Number.isFinite(index) ? index : 0, kind: "unknown" };
  for (const pair of pairs) {
    const [k, v] = pair.split("=");
    if (k === "k") info.kind = (["plane", "cylinder", "cone", "torus", "surface"].includes(v) ? v : "unknown") as FaceKind;
    else if (k === "a") info.area = Number(v);
    else if (k === "d") info.d = Number(v);
    else if (k === "span") info.span = Number(v);
    else if (k === "cv") info.convex = v === "1";
    else if (k === "p") info.p = Number(v);
    else if (k === "n") {
      const n = v.split(",").map(Number);
      if (n.length === 3) info.normal = [n[0], n[1], n[2]];
    }
  }
  return info;
}

const mm = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function facing(n: [number, number, number]): string {
  const [x, y, z] = n;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  if (az > 0.99) return z > 0 ? "facing up" : "facing down";
  if (ay > 0.99) return y > 0 ? "facing back" : "facing front";
  if (ax > 0.99) return x > 0 ? "facing right" : "facing left";
  return "angled";
}

export function describeFace(f: FaceInfo): { title: string; detail: string } {
  const area = f.area ? `${Math.round(f.area).toLocaleString("en-US")} mm²` : "";
  switch (f.kind) {
    case "cylinder": {
      const d = f.d ?? 0;
      const span = f.span ?? 360;
      if (span >= 300) return { title: f.convex ? `Boss Ø${mm(d)}` : `Hole Ø${mm(d)}`, detail: "Cylindrical face" };
      if (span < 150) return { title: `Fillet R${mm(d / 2)}`, detail: f.convex ? "Rounded outside edge" : "Rounded inside edge" };
      return { title: `Arc R${mm(d / 2)}`, detail: f.convex ? "Outside curve" : "Inside curve" };
    }
    case "plane":
      return { title: "Flat face", detail: [area, f.normal ? facing(f.normal) : ""].filter(Boolean).join(" · ") };
    case "cone": {
      const a = Math.abs(f.p ?? 0);
      if (Math.abs(a - 45) < 0.5) return { title: "Chamfer 45°", detail: area };
      return { title: `Cone ${a.toFixed(1)}°`, detail: area };
    }
    case "torus":
      return { title: `Torus R${mm(f.p ?? 0)}`, detail: area };
    case "surface":
      return { title: "Freeform surface", detail: area };
    default:
      return { title: `Face ${f.index + 1}`, detail: "" };
  }
}

export function formatMm(v: number) {
  return mm(v);
}
