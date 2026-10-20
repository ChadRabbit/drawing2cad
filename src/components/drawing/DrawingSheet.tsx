"use client";

import { useMemo } from "react";

type Pt = [number, number];

export type DrawingData = {
  sheet: { w: number; h: number; size: string };
  scale: string;
  title: string;
  number: string;
  material: string;
  views: { name: string; visible: Pt[][]; hidden: Pt[][] }[];
  annotations: Annotation[];
};

type Annotation =
  | { type: "linear"; view: string; a: Pt; b: Pt; dir: "h" | "v"; offset: number; text: string; id?: string }
  | { type: "diameter" | "radius"; view: string; c: Pt; r: number; angle: number; leader: number; text: string; id?: string }
  | { type: "note"; view: string; at: Pt; to: Pt; text: string; id?: string }
  | { type: "centerline"; view: string; a: Pt; b: Pt }
  | { type: "centermark"; view: string; c: Pt; size: number };

type Props = {
  data: DrawingData;
  /** "sheet" shows the whole A3 sheet with its frame and title block; "views" crops to the views. */
  crop?: "sheet" | "views";
  /** Annotation id drawn in the accent. */
  highlight?: string | null;
  /** When false the lines wait undrawn; flipping to true draws them in. */
  drawn?: boolean;
  textSize?: number;
  className?: string;
  label?: string;
};

const INK = "#161616";

export default function DrawingSheet({
  data,
  crop = "sheet",
  highlight = null,
  drawn = true,
  textSize = 5,
  className,
  label,
}: Props) {
  const box = useMemo(() => {
    if (crop === "sheet") return [0, 0, data.sheet.w, data.sheet.h] as const;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const add = ([x, y]: Pt) => {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    };
    for (const v of data.views) for (const pl of v.visible) pl.forEach(add);
    for (const a of data.annotations) {
      if (a.type === "linear") {
        const off = a.offset;
        if (a.dir === "h") {
          add([a.a[0], a.a[1] - off]);
          add([a.b[0], a.a[1] - off - textSize * 1.4]);
        } else {
          add([a.a[0] + off + Math.sign(off || 1) * textSize * 1.4, a.a[1]]);
        }
      } else if (a.type === "diameter" || a.type === "radius") {
        const rad = (a.angle * Math.PI) / 180;
        const tip: Pt = [a.c[0] + Math.cos(rad) * (a.r + a.leader), a.c[1] - Math.sin(rad) * (a.r + a.leader)];
        add(tip);
        add([tip[0] + Math.sign(Math.cos(rad) || 1) * textSize * a.text.length * 0.62, tip[1] - textSize * 1.4]);
      } else if (a.type === "note") {
        const end: Pt = [a.at[0] + a.to[0], a.at[1] - a.to[1]];
        add(end);
        add([end[0] + Math.sign(a.to[0] || 1) * textSize * a.text.length * 0.62, end[1] - textSize * 1.4]);
      }
    }
    const pad = 8;
    return [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2] as const;
  }, [data, crop, textSize]);

  let order = 0;
  const next = () => order++;

  return (
    <svg
      viewBox={box.join(" ")}
      className={className}
      role="img"
      aria-label={label ?? `Engineering drawing of ${data.title}, ${data.number}`}
      data-drawn={drawn ? "true" : "false"}
      style={{ fontFamily: "var(--font-text)", overflow: "visible" }}
    >
      <style>{`
        .ds-line { fill: none; stroke: ${INK}; stroke-linecap: round; stroke-linejoin: round; }
        .ds-vis { stroke-width: 0.5; }
        .ds-hid { stroke-width: 0.3; stroke-dasharray: 2.2 1.3; }
        .ds-thin { stroke-width: 0.22; }
        .ds-chain { stroke-width: 0.22; stroke-dasharray: 7 1.4 1 1.4; }
        .ds-text { fill: ${INK}; font-weight: 500; }
        .ds-fill { fill: ${INK}; }
        .ds-hl .ds-thin { stroke: ${INK}; stroke-width: 0.45; }
        .ds-hl-bg { fill: #dafa9c; }
        @media (prefers-reduced-motion: no-preference) {
          svg[data-drawn="false"] .ds-draw { stroke-dashoffset: 1; }
          .ds-draw { stroke-dasharray: 1 1; transition: stroke-dashoffset 1100ms cubic-bezier(0.33, 1, 0.68, 1); transition-delay: calc(var(--o, 0) * 6ms); }
          svg[data-drawn="false"] .ds-fade { opacity: 0; }
          .ds-fade { transition: opacity 500ms ease; transition-delay: calc(700ms + var(--o, 0) * 4ms); }
        }
      `}</style>

      {crop === "sheet" && <SheetFrame data={data} />}

      {data.views.map((v) => (
        <g key={v.name}>
          {v.hidden.map((pl, i) => (
            <polyline key={`h${i}`} className="ds-line ds-hid ds-fade" points={pts(pl)} style={{ ["--o" as string]: next() }} />
          ))}
          {v.visible.map((pl, i) => (
            <polyline
              key={`v${i}`}
              className="ds-line ds-vis ds-draw"
              points={pts(pl)}
              pathLength={1}
              style={{ ["--o" as string]: next() }}
            />
          ))}
        </g>
      ))}

      {data.annotations.map((a, i) => (
        <g
          key={i}
          className={`ds-fade${"id" in a && a.id && a.id === highlight ? " ds-hl" : ""}`}
          style={{ ["--o" as string]: next() }}
        >
          <AnnotationShape a={a} size={textSize} highlighted={"id" in a && !!a.id && a.id === highlight} />
        </g>
      ))}
    </svg>
  );
}

function pts(pl: Pt[]) {
  return pl.map(([x, y]) => `${x},${y}`).join(" ");
}

function Arrow({ tip, dir, size }: { tip: Pt; dir: Pt; size: number }) {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / len;
  const uy = dir[1] / len;
  const L = size * 0.62;
  const W = size * 0.16;
  const bx = tip[0] - ux * L;
  const by = tip[1] - uy * L;
  return <polygon className="ds-fill" points={`${tip[0]},${tip[1]} ${bx - uy * W},${by + ux * W} ${bx + uy * W},${by - ux * W}`} />;
}

function Label({ x, y, text, size, anchor = "middle", rotate = 0, highlighted }: { x: number; y: number; text: string; size: number; anchor?: "start" | "middle" | "end"; rotate?: number; highlighted?: boolean }) {
  const w = text.length * size * 0.6;
  const bx = anchor === "middle" ? -w / 2 : anchor === "end" ? -w : 0;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      {highlighted && <rect className="ds-hl-bg" x={bx - 1.2} y={-size * 0.95} width={w + 2.4} height={size * 1.3} rx={0.8} />}
      <text className="ds-text" fontSize={size} textAnchor={anchor} x={0} y={0}>
        {text}
      </text>
    </g>
  );
}

function AnnotationShape({ a, size, highlighted }: { a: Annotation; size: number; highlighted: boolean }) {
  const gap = 1.4;
  const over = 2;
  if (a.type === "centerline") {
    return <line className="ds-line ds-chain" x1={a.a[0]} y1={a.a[1]} x2={a.b[0]} y2={a.b[1]} />;
  }
  if (a.type === "centermark") {
    const h = a.size / 2;
    return (
      <g>
        <line className="ds-line ds-chain" x1={a.c[0] - h} y1={a.c[1]} x2={a.c[0] + h} y2={a.c[1]} />
        <line className="ds-line ds-chain" x1={a.c[0]} y1={a.c[1] - h} x2={a.c[0]} y2={a.c[1] + h} />
      </g>
    );
  }
  if (a.type === "linear") {
    if (a.dir === "h") {
      const y = a.a[1] - a.offset;
      const s = Math.sign(y - a.a[1]) || 1;
      const sb = Math.sign(y - a.b[1]) || 1;
      const [x0, x1] = [a.a[0], a.b[0]];
      const inside = Math.abs(x1 - x0) > size * 2.2;
      return (
        <g>
          <line className="ds-line ds-thin" x1={x0} y1={a.a[1] + s * gap} x2={x0} y2={y + s * over} />
          <line className="ds-line ds-thin" x1={x1} y1={a.b[1] + sb * gap} x2={x1} y2={y + sb * over} />
          <line className="ds-line ds-thin" x1={x0} y1={y} x2={x1} y2={y} />
          <Arrow tip={[x0, y]} dir={inside ? [x0 - x1, 0] : [x1 - x0, 0]} size={size} />
          <Arrow tip={[x1, y]} dir={inside ? [x1 - x0, 0] : [x0 - x1, 0]} size={size} />
          <Label x={(x0 + x1) / 2} y={y - 1.4} text={a.text} size={size} highlighted={highlighted} />
        </g>
      );
    }
    const x = a.a[0] + a.offset;
    const s = Math.sign(x - a.a[0]) || 1;
    const sb = Math.sign(x - a.b[0]) || 1;
    const [y0, y1] = [a.a[1], a.b[1]];
    const inside = Math.abs(y1 - y0) > size * 2.2;
    return (
      <g>
        <line className="ds-line ds-thin" x1={a.a[0] + s * gap} y1={y0} x2={x + s * over} y2={y0} />
        <line className="ds-line ds-thin" x1={a.b[0] + sb * gap} y1={y1} x2={x + sb * over} y2={y1} />
        <line className="ds-line ds-thin" x1={x} y1={y0} x2={x} y2={y1} />
        <Arrow tip={[x, y0]} dir={inside ? [0, y0 - y1] : [0, y1 - y0]} size={size} />
        <Arrow tip={[x, y1]} dir={inside ? [0, y1 - y0] : [0, y0 - y1]} size={size} />
        <Label x={x - 1.4} y={(y0 + y1) / 2} text={a.text} size={size} rotate={-90} highlighted={highlighted} />
      </g>
    );
  }
  if (a.type === "diameter" || a.type === "radius") {
    const rad = (a.angle * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = -Math.sin(rad);
    const tip: Pt = [a.c[0] + ux * a.r, a.c[1] + uy * a.r];
    const elbow: Pt = [a.c[0] + ux * (a.r + a.leader), a.c[1] + uy * (a.r + a.leader)];
    const right = ux >= 0;
    const textW = a.text.length * size * 0.6;
    const end: Pt = [elbow[0] + (right ? 1 : -1) * (textW + 2), elbow[1]];
    const start: Pt = a.type === "radius" ? a.c : tip;
    return (
      <g>
        <polyline className="ds-line ds-thin" points={pts([start, elbow, end])} />
        <Arrow tip={tip} dir={a.type === "radius" ? [ux, uy] : [-ux, -uy]} size={size} />
        <Label x={elbow[0] + (right ? 1 : -1)} y={elbow[1] - 1.2} text={a.text} size={size} anchor={right ? "start" : "end"} highlighted={highlighted} />
      </g>
    );
  }
  if (a.type !== "note") return null;
  const end: Pt = [a.at[0] + a.to[0], a.at[1] - a.to[1]];
  const right = a.to[0] >= 0;
  const textW = a.text.length * size * 0.6;
  const shoulder: Pt = [end[0] + (right ? 1 : -1) * (textW + 2), end[1]];
  return (
    <g>
      <polyline className="ds-line ds-thin" points={pts([a.at, end, shoulder])} />
      <Arrow tip={a.at} dir={[a.at[0] - end[0], a.at[1] - end[1]]} size={size} />
      <Label x={end[0] + (right ? 1 : -1)} y={end[1] - 1.2} text={a.text} size={size} anchor={right ? "start" : "end"} highlighted={highlighted} />
    </g>
  );
}

function SheetFrame({ data }: { data: DrawingData }) {
  const { w, h } = data.sheet;
  const tbW = 180;
  const tbH = 44;
  const x = w - 10 - tbW;
  const y = h - 10 - tbH;
  const t = 3.2;
  const small = 2.4;
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} fill="#ffffff" />
      <rect x={10} y={10} width={w - 20} height={h - 20} className="ds-line" strokeWidth={0.7} />
      <g className="ds-line ds-thin">
        <rect x={x} y={y} width={tbW} height={tbH} strokeWidth={0.5} />
        <line x1={x} y1={y + 16} x2={x + tbW} y2={y + 16} />
        <line x1={x} y1={y + 30} x2={x + tbW} y2={y + 30} />
        <line x1={x + 100} y1={y + 16} x2={x + 100} y2={y + tbH} />
        <line x1={x + 140} y1={y + 16} x2={x + 140} y2={y + tbH} />
      </g>
      <TB x={x + 3} y={y + 5} label="Title" value={data.title} size={t + 1.4} small={small} />
      <TB x={x + 3} y={y + 20} label="Material" value={data.material} size={t} small={small} />
      <TB x={x + 3} y={y + 34} label="Drawing no." value={data.number} size={t} small={small} />
      <TB x={x + 103} y={y + 20} label="Scale" value={data.scale} size={t} small={small} />
      <TB x={x + 103} y={y + 34} label="Units" value="mm" size={t} small={small} />
      <TB x={x + 143} y={y + 20} label="Sheet" value={`${data.sheet.size} · 1/1`} size={t} small={small} />
      <TB x={x + 143} y={y + 34} label="Projection" value="First angle" size={t} small={small} />
      <text className="ds-text" x={14} y={h - 13} fontSize={small} fontWeight={400}>
        General tolerance ±0.1 unless stated. Break sharp edges 0.2.
      </text>
    </g>
  );
}

function TB({ x, y, label, value, size, small }: { x: number; y: number; label: string; value: string; size: number; small: number }) {
  return (
    <g>
      <text className="ds-text" x={x} y={y} fontSize={small} fontWeight={400}>
        {label}
      </text>
      <text className="ds-text" x={x} y={y + size + 1.4} fontSize={size}>
        {value}
      </text>
    </g>
  );
}
