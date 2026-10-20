"""Builds the three sample parts shown on the landing page.

For each part this writes, into public/examples/<id>/:
  model.step    the real STEP file visitors can download
  model.glb     browser preview: one mesh per B-rep face (named with its kind and size) + edge lines
  drawing.json  a first-angle A3 drawing: hidden-line views + dimensions, rendered by <DrawingSheet>
  info.json     measured facts about the solid (bounding box, volume, mass, counts)

Run:  tools/.venv/bin/python tools/examples/build_examples.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import trimesh
from build123d import (
    Align,
    Axis,
    Box,
    Cylinder,
    GeomType,
    Part,
    Plane,
    Polyline,
    Pos,
    Rot,
    RectangleRounded,
    SlotCenterToCenter,
    Vector,
    chamfer,
    export_step,
    extrude,
    fillet,
    make_face,
)
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.BRepTools import BRepTools
from OCP.GeomAbs import GeomAbs_Cone, GeomAbs_Cylinder, GeomAbs_Plane, GeomAbs_Torus

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "examples"
C, MIN = Align.CENTER, Align.MIN

# --------------------------------------------------------------------------------------------
# Parts
# --------------------------------------------------------------------------------------------


def mounting_plate() -> Part:
    plate = Box(120, 80, 10, align=(C, C, MIN))
    plate = fillet(plate.edges().filter_by(Axis.Z), 8)
    for x in (-48, 48):
        for y in (-28, 28):
            plate -= Pos(x, y, 5) * Cylinder(4.5, 20)
    plate -= Pos(0, 0, 5) * Cylinder(20, 20)
    top_bore = [e for e in plate.edges().filter_by(GeomType.CIRCLE) if abs(e.center().Z - 10) < 1e-6 and abs(e.radius - 20) < 1e-6]
    plate = chamfer(top_bore, 1)
    return plate


def pillow_block() -> Part:
    base = Box(150, 44, 14, align=(C, C, MIN))
    base = fillet(base.edges().filter_by(Axis.Z), 4)
    pedestal = Box(84, 44, 52, align=(C, C, MIN))
    housing = Pos(0, 0, 52) * Rot(90, 0, 0) * Cylinder(42, 44)
    body = base + pedestal + housing
    junction = [e for e in body.edges().filter_by(Axis.Y) if abs(e.center().Z - 14) < 1e-6 and abs(abs(e.center().X) - 42) < 1e-6]
    body = fillet(junction, 6)
    body += Pos(0, 0, 86) * Cylinder(7, 12, align=(C, C, MIN))
    body -= Pos(0, 0, 52) * Rot(90, 0, 0) * Cylinder(23.5, 60)
    body -= Pos(0, 0, 60) * Cylinder(2.5, 40, align=(C, C, MIN))
    for x in (-60, 60):
        body -= Pos(x, 0, -1) * extrude(SlotCenterToCenter(9, 13), 16)
    body -= Box(60, 50, 2, align=(C, C, MIN))
    bore_edges = [e for e in body.edges().filter_by(GeomType.CIRCLE) if abs(e.radius - 23.5) < 1e-6]
    body = chamfer(bore_edges, 1)
    return body


def gearbox_housing() -> Part:
    base = Box(150, 120, 12, align=(C, C, MIN))
    base = fillet(base.edges().filter_by(Axis.Z), 10)
    body = Pos(0, 0, 12) * extrude(RectangleRounded(110, 90, 12), 70)
    part = base + body
    junction = [
        e
        for e in part.edges()
        if abs(e.center().Z - 12) < 1e-6 and abs(e.center().X) <= 56 and abs(e.center().Y) <= 46
    ]
    part = fillet(junction, 4)
    part += Pos(0, 0, 74) * extrude(RectangleRounded(124, 104, 14), 8)
    # bosses for the two shafts, front and back
    shafts = [(-22, 45, 23, 13), (32, 45, 16, 8)]  # x, z, boss radius, bore radius
    for x, z, rb, _ in shafts:
        for y0 in (-53, 45):
            part += Pos(x, y0 + 4, z) * Rot(90, 0, 0) * Cylinder(rb, 8)
    # drain boss on +X wall
    part += Pos(59, 0, 26) * Rot(0, 90, 0) * Cylinder(10, 8)
    # gussets
    rib_profile = make_face(Polyline((55, 12), (72, 12), (55, 50), close=True))
    for sx in (1, -1):
        for y in (-25, 25):
            rib = extrude(Plane.XZ * rib_profile, 3, both=True)
            if sx < 0:
                rib = Rot(0, 0, 180) * rib
            part += Pos(0, y, 0) * rib
    # cavity
    part -= Pos(0, 0, 18) * extrude(RectangleRounded(98, 78, 6), 80)
    for x, z, _, rbore in shafts:
        part -= Pos(x, 0, z) * Rot(90, 0, 0) * Cylinder(rbore, 140)
    part -= Pos(52, 0, 26) * Rot(0, 90, 0) * Cylinder(4.25, 20, align=(C, C, MIN))
    # mounting holes with counterbores
    for x in (-62, 62):
        for y in (-47, 47):
            part -= Pos(x, y, 6) * Cylinder(5.5, 30)
            part -= Pos(x, y, 6) * Cylinder(9, 6.5, align=(C, C, MIN))
    # tapped holes in the lip (M5 tap drill 4.2, 12 deep)
    lip = [(-55.5, -45.5), (0, -45.5), (55.5, -45.5), (-55.5, 45.5), (0, 45.5), (55.5, 45.5), (-55.5, 0), (55.5, 0)]
    for x, y in lip:
        part -= Pos(x, y, 82) * Cylinder(2.1, 12, align=(C, C, Align.MAX))
    return part


# --------------------------------------------------------------------------------------------
# Preview mesh (GLB) and facts
# --------------------------------------------------------------------------------------------


def face_kind(face) -> tuple[str, str]:
    s = BRepAdaptor_Surface(face.wrapped)
    t = s.GetType()
    if t == GeomAbs_Plane:
        n = face.normal_at()
        return "plane", ",".join(f"{c:.3f}" for c in (n.X, n.Y, n.Z))
    if t == GeomAbs_Cylinder:
        return "cylinder", f"{2 * s.Cylinder().Radius():.3f}"
    if t == GeomAbs_Cone:
        return "cone", f"{math.degrees(s.Cone().SemiAngle()):.2f}"
    if t == GeomAbs_Torus:
        return "torus", f"{s.Torus().MinorRadius():.3f}"
    return "surface", ""


def face_label(i: int, face) -> str:
    """Node name the viewer parses: face:<i>;k=<kind>;d=<diameter>;n=<normal>;span=<deg>;cv=<0|1>;a=<area>"""
    kind, param = face_kind(face)
    parts = [f"face:{i}", f"k={kind}", f"a={face.area:.1f}"]
    if kind == "plane":
        parts.append(f"n={param}")
    elif kind == "cylinder":
        surf = BRepAdaptor_Surface(face.wrapped)
        umin, umax, vmin, vmax = BRepTools.UVBounds_s(face.wrapped)
        span = math.degrees(umax - umin)
        cyl = surf.Cylinder()
        loc, ax = cyl.Location(), cyl.Axis().Direction()
        pnt = surf.Value((umin + umax) / 2, (vmin + vmax) / 2)
        v = np.array([pnt.X() - loc.X(), pnt.Y() - loc.Y(), pnt.Z() - loc.Z()])
        a = np.array([ax.X(), ax.Y(), ax.Z()])
        radial = v - a * v.dot(a)
        n = face.normal_at(Vector(pnt.X(), pnt.Y(), pnt.Z()))
        convex = radial.dot(np.array([n.X, n.Y, n.Z])) > 0
        parts += [f"d={param}", f"span={span:.0f}", f"cv={1 if convex else 0}"]
    elif kind in ("cone", "torus"):
        parts.append(f"p={param}")
    return ";".join(parts)


def sample_edge(edge, step=1.0, max_n=64):
    if edge.geom_type == GeomType.LINE:
        ts = [0.0, 1.0]
    else:
        n = int(min(max_n, max(8, math.ceil(edge.length / step))))
        ts = list(np.linspace(0, 1, n + 1))
    return [edge.position_at(t) for t in ts]


def export_preview(part: Part, path: Path):
    scene = trimesh.Scene()
    for i, face in enumerate(part.faces()):
        verts, tris = face.tessellate(0.03, 0.2)
        if not tris:
            continue
        v = np.array([[p.X, p.Y, p.Z] for p in verts], dtype=np.float64)
        f = np.array(tris, dtype=np.int64)
        mesh = trimesh.Trimesh(vertices=v, faces=f, process=True)
        label = face_label(i, face)
        scene.add_geometry(mesh, geom_name=label, node_name=label)
    segs = []
    for edge in part.edges():
        pts = sample_edge(edge, step=0.8)
        for a, b in zip(pts, pts[1:]):
            segs.append([[a.X, a.Y, a.Z], [b.X, b.Y, b.Z]])
    if segs:
        path3d = trimesh.load_path(np.array(segs))
        scene.add_geometry(path3d, geom_name="edges", node_name="edges")
    path.write_bytes(trimesh.exchange.gltf.export_glb(scene, include_normals=True))


def facts(part: Part, density: float) -> dict:
    bb = part.bounding_box()
    faces = part.faces()
    cyl = [face_kind(f) for f in faces]
    vol = part.volume
    return {
        "bbox": [round(bb.size.X, 2), round(bb.size.Y, 2), round(bb.size.Z, 2)],
        "volume_mm3": round(vol, 1),
        "area_mm2": round(part.area, 1),
        "mass_g": round(vol * density * 1e-3, 1),
        "faces": len(faces),
        "edges": len(part.edges()),
        "cylindrical_faces": sum(1 for k, _ in cyl if k == "cylinder"),
        "valid": part.is_valid,
    }


# --------------------------------------------------------------------------------------------
# Drawing: first-angle views on an A3 sheet
# --------------------------------------------------------------------------------------------

VIEWS = {
    # name: (camera direction from target, up vector)
    "front": ((0, -1, 0), (0, 0, 1)),
    "top": ((0, 0, 1), (0, 1, 0)),
    "left": ((-1, 0, 0), (0, 0, 1)),
}


def to_view(view: str, p, centre):
    x, y, z = (p[0] - centre[0], p[1] - centre[1], p[2] - centre[2])
    if view == "front":
        return (x, z)
    if view == "top":
        return (x, y)
    return (-y, z)


def seg_dist(points: np.ndarray, segs: np.ndarray) -> np.ndarray:
    """Distance from each point to the nearest segment."""
    a = segs[:, 0][None, :, :]
    b = segs[:, 1][None, :, :]
    p = points[:, None, :]
    ab = b - a
    denom = np.maximum((ab**2).sum(-1), 1e-12)
    t = np.clip(((p - a) * ab).sum(-1) / denom, 0, 1)
    proj = a + t[..., None] * ab
    return np.sqrt(((p - proj) ** 2).sum(-1)).min(axis=1)


def project(part: Part, view: str, centre):
    d, up = VIEWS[view]
    origin = (centre[0] + d[0] * 2000, centre[1] + d[1] * 2000, centre[2] + d[2] * 2000)
    vis, hid = part.project_to_viewport(origin, up, look_at=centre)

    def polys(edges):
        out = []
        for e in edges:
            pts = sample_edge(e, step=0.6)
            out.append([(p.X, p.Y) for p in pts])
        return out

    vpolys = polys(vis)
    hpolys = polys(hid)
    vsegs = np.array([[a, b] for pl in vpolys for a, b in zip(pl, pl[1:])]) if vpolys else np.zeros((0, 2, 2))
    kept = []
    for pl in hpolys:
        arr = np.array(pl)
        idx = np.linspace(0, len(arr) - 1, min(len(arr), 5)).astype(int)
        if len(vsegs) and seg_dist(arr[idx], vsegs).max() < 0.02:
            continue
        kept.append(pl)
    return vpolys, kept


def build_drawing(part: Part, spec: dict) -> dict:
    bb = part.bounding_box()
    centre = (bb.center().X, bb.center().Y, bb.center().Z)
    sx, sy, sz = bb.size.X, bb.size.Y, bb.size.Z
    s = spec["scale"]
    gap = spec.get("gap", 34)
    # sheet: A3 landscape 420 x 297, 10 mm border, title block 180 x 44 bottom right
    left_x = spec.get("left", 32)
    top_y = spec.get("top", 34)
    front_c = (left_x + sx * s / 2, top_y + sz * s / 2)
    plan_c = (front_c[0], top_y + sz * s + gap + sy * s / 2)
    side_c = (left_x + sx * s + gap + sy * s / 2, front_c[1])
    placement = {"front": front_c, "top": plan_c, "left": side_c}

    def place(view, uv):
        cx, cy = placement[view]
        return (round(cx + uv[0] * s, 3), round(cy - uv[1] * s, 3))

    views = []
    for name in ("front", "top", "left"):
        vis, hid = project(part, name, centre)
        views.append(
            {
                "name": name,
                "visible": [[place(name, p) for p in pl] for pl in vis],
                "hidden": [[place(name, p) for p in pl] for pl in hid],
            }
        )

    def P(view, xyz):
        return place(view, to_view(view, xyz, centre))

    annotations = []
    for a in spec["annotations"]:
        kind = a["type"]
        v = a["view"]
        if kind == "linear":
            pa = P(v, a["a"])
            offset = a.get("offset", 0)
            if "line_at" in a:
                pl = P(v, a["line_at"])
                pad = a.get("pad", 0)
                offset = round(pa[1] - (pl[1] - pad), 3) if a["dir"] == "h" else round((pl[0] + pad) - pa[0], 3)
            annotations.append(
                {
                    "type": "linear",
                    "view": v,
                    "a": pa,
                    "b": P(v, a["b"]),
                    "dir": a["dir"],
                    "offset": offset,
                    "text": a["text"],
                    "id": a.get("id"),
                }
            )
        elif kind in ("diameter", "radius"):
            c = P(v, a["c"])
            annotations.append(
                {
                    "type": kind,
                    "view": v,
                    "c": c,
                    "r": round(a["r"] * s, 3),
                    "angle": a.get("angle", 45),
                    "leader": a.get("leader", 14),
                    "text": a["text"],
                    "id": a.get("id"),
                }
            )
        elif kind == "centerline":
            annotations.append({"type": "centerline", "view": v, "a": P(v, a["a"]), "b": P(v, a["b"])})
        elif kind == "centermark":
            annotations.append({"type": "centermark", "view": v, "c": P(v, a["c"]), "size": round(a["size"] * s, 3)})
        elif kind == "note":
            annotations.append(
                {
                    "type": "note",
                    "view": v,
                    "at": P(v, a["at"]),
                    "to": [round(a["dx"], 2), round(a["dy"], 2)],
                    "text": a["text"],
                    "id": a.get("id"),
                }
            )
    return {
        "sheet": {"w": 420, "h": 297, "size": "A3"},
        "scale": spec["scale_label"],
        "title": spec["title"],
        "number": spec["number"],
        "material": spec["material"],
        "views": views,
        "annotations": annotations,
    }


# --------------------------------------------------------------------------------------------
# The three samples, with their dimensions (3D points; projected per view)
# --------------------------------------------------------------------------------------------


def specs():
    plate = {
        "id": "mounting-plate",
        "build": mounting_plate,
        "tier": "simple",
        "title": "Mounting plate",
        "number": "MP-120",
        "material": "Aluminium 6061-T6",
        "density": 2.70,
        "scale": 1.6,
        "scale_label": "1.6 : 1",
        "gap": 30,
        "left": 46,
        "annotations": [
            {"type": "linear", "view": "front", "a": (-60, -40, 0), "b": (60, -40, 0), "dir": "h", "offset": -14, "text": "120", "id": "len"},
            {"type": "linear", "view": "front", "a": (60, -40, 0), "b": (60, -40, 10), "dir": "v", "offset": 12, "text": "10", "id": "thk"},
            {"type": "linear", "view": "top", "a": (-48, -28, 10), "b": (48, -28, 10), "dir": "h", "offset": -26, "text": "96", "id": "pitch-x"},
            {"type": "linear", "view": "top", "a": (48, -28, 10), "b": (48, 28, 10), "dir": "v", "offset": 30, "text": "56", "id": "pitch-y"},
            {"type": "linear", "view": "left", "a": (0, 40, 0), "b": (0, -40, 0), "dir": "h", "offset": -14, "text": "80", "id": "wid"},
            {"type": "diameter", "view": "top", "c": (0, 0, 10), "r": 20, "angle": 40, "leader": 22, "text": "Ø40", "id": "bore"},
            {"type": "note", "view": "top", "at": (-48, 28, 10), "dx": -14, "dy": -16, "text": "4× Ø9 THRU", "id": "holes"},
            {"type": "radius", "view": "top", "c": (52, 32, 10), "r": 8, "angle": 45, "leader": 12, "text": "R8 TYP", "id": "corner"},
            {"type": "centermark", "view": "top", "c": (0, 0, 10), "size": 24},
            {"type": "centerline", "view": "front", "a": (0, 0, -3), "b": (0, 0, 13)},
        ],
    }
    pillow = {
        "id": "pillow-block",
        "build": pillow_block,
        "tier": "medium",
        "title": "Pillow block, 6204 bearing",
        "number": "PB-47",
        "material": "Cast iron EN-GJL-250",
        "density": 7.20,
        "scale": 1.2,
        "scale_label": "1.2 : 1",
        "gap": 30,
        "left": 46,
        "top": 30,
        "annotations": [
            {"type": "linear", "view": "front", "a": (-75, -22, 0), "b": (75, -22, 0), "dir": "h", "line_at": (0, -22, 0), "pad": -14, "text": "150", "id": "len"},
            {"type": "linear", "view": "front", "a": (75, -22, 0), "b": (75, -22, 14), "dir": "v", "line_at": (75, -22, 0), "pad": 12, "text": "14", "id": "base"},
            {"type": "linear", "view": "front", "a": (75, -22, 0), "b": (42, -22, 52), "dir": "v", "line_at": (75, -22, 0), "pad": 26, "text": "52", "id": "centre-height"},
            {"type": "linear", "view": "front", "a": (-7, -22, 98), "b": (-75, -22, 0), "dir": "v", "line_at": (-75, -22, 0), "pad": -14, "text": "98", "id": "height"},
            {"type": "diameter", "view": "front", "c": (0, -22, 52), "r": 23.5, "angle": 135, "leader": 18, "text": "Ø47 H7", "id": "bore"},
            {"type": "radius", "view": "front", "c": (0, -22, 52), "r": 42, "angle": 40, "leader": 12, "text": "R42", "id": "housing"},
            {"type": "centermark", "view": "front", "c": (0, -22, 52), "size": 96},
            {"type": "linear", "view": "left", "a": (0, 22, 0), "b": (0, -22, 0), "dir": "h", "line_at": (0, 0, 0), "pad": -14, "text": "44", "id": "depth"},
            {"type": "linear", "view": "top", "a": (-60, 0, 14), "b": (60, 0, 14), "dir": "h", "line_at": (0, -22, 14), "pad": -12, "text": "120", "id": "slot-pitch"},
            {"type": "note", "view": "top", "at": (66, 0, 14), "dx": 14, "dy": 22, "text": "2× SLOT 13 × 22", "id": "slots"},
            {"type": "centerline", "view": "top", "a": (0, -27, 98), "b": (0, 27, 98)},
            {"type": "centerline", "view": "left", "a": (0, -27, 52), "b": (0, 27, 52)},
        ],
    }
    gearbox = {
        "id": "gearbox-housing",
        "build": gearbox_housing,
        "tier": "complex",
        "title": "Gearbox housing, two-stage",
        "number": "GB-110",
        "material": "Aluminium A356-T6",
        "density": 2.68,
        "scale": 0.85,
        "scale_label": "1 : 1.2",
        "gap": 44,
        "left": 62,
        "top": 50,
        "annotations": [
            {"type": "linear", "view": "front", "a": (-75, -60, 0), "b": (75, -60, 0), "dir": "h", "line_at": (0, -60, 0), "pad": -14, "text": "150", "id": "len"},
            {"type": "linear", "view": "front", "a": (-22, -53, 45), "b": (32, -53, 45), "dir": "h", "line_at": (0, -60, 82), "pad": 10, "text": "54", "id": "centres"},
            {"type": "linear", "view": "front", "a": (75, -60, 0), "b": (62, -60, 82), "dir": "v", "line_at": (75, -60, 0), "pad": 12, "text": "82", "id": "height"},
            {"type": "linear", "view": "front", "a": (-75, -60, 0), "b": (-22, -53, 45), "dir": "v", "line_at": (-75, -60, 0), "pad": -12, "text": "45", "id": "shaft-height"},
            {"type": "diameter", "view": "front", "c": (-22, -53, 45), "r": 13, "angle": 228, "leader": 22, "text": "Ø26 H7", "id": "out-bore"},
            {"type": "diameter", "view": "front", "c": (32, -53, 45), "r": 8, "angle": 312, "leader": 20, "text": "Ø16 H7", "id": "in-bore"},
            {"type": "centermark", "view": "front", "c": (-22, -53, 45), "size": 54},
            {"type": "centermark", "view": "front", "c": (32, -53, 45), "size": 38},
            {"type": "linear", "view": "top", "a": (75, -60, 12), "b": (75, 60, 12), "dir": "v", "line_at": (75, 0, 12), "pad": 12, "text": "120", "id": "wid"},
            {"type": "linear", "view": "top", "a": (-62, 47, 12), "b": (62, 47, 12), "dir": "h", "line_at": (0, 60, 12), "pad": 10, "text": "124", "id": "hole-pitch"},
            {"type": "note", "view": "top", "at": (-62, -47, 12), "dx": 8, "dy": -24, "text": "4× Ø11 CBORE Ø18", "id": "mount"},
            {"type": "note", "view": "top", "at": (55.5, 45.5, 82), "dx": 18, "dy": 16, "text": "8× M5 × 12 DEEP", "id": "tapped"},
            {"type": "linear", "view": "left", "a": (0, 53, 45), "b": (0, -53, 45), "dir": "h", "line_at": (0, 0, 0), "pad": -14, "text": "106", "id": "depth"},
        ],
    }
    return [plate, pillow, gearbox]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for spec in specs():
        part = spec["build"]()
        if not part.is_valid:
            raise SystemExit(f"{spec['id']}: invalid solid")
        d = OUT / spec["id"]
        d.mkdir(exist_ok=True)
        part.label = spec["title"]
        export_step(part, d / "model.step", timestamp="2026-10-20T12:00:00")
        export_preview(part, d / "model.glb")
        drawing = build_drawing(part, spec)
        (d / "drawing.json").write_text(json.dumps(drawing, separators=(",", ":")))
        info = {
            "id": spec["id"],
            "tier": spec["tier"],
            "title": spec["title"],
            "number": spec["number"],
            "material": spec["material"],
            **facts(part, spec["density"]),
            "step_bytes": (d / "model.step").stat().st_size,
            "glb_bytes": (d / "model.glb").stat().st_size,
        }
        (d / "info.json").write_text(json.dumps(info, indent=2))
        index.append(info)
        print(json.dumps(info))
    (OUT / "index.json").write_text(json.dumps(index, indent=2))


if __name__ == "__main__":
    main()
