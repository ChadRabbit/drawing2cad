"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ModelViewer, { type ModelViewerHandle, type Readout } from "@/components/viewer/ModelViewer";
import DrawingSheet, { type DrawingData } from "@/components/drawing/DrawingSheet";
import { formatMm } from "@/components/viewer/faces";
import "@/components/fragments/ui.css";

type Example = {
  id: string;
  title: string;
  number: string;
  material: string;
  bbox: [number, number, number];
  faces: number;
  mass_g: number;
  step_bytes: number;
};

/** Which dimension on the drawing a hovered face corresponds to (by its diameter or radius). */
function matchAnnotation(r: Readout | null, drawing: DrawingData | null): string | null {
  if (!r || !drawing || r.face.kind !== "cylinder" || !r.face.d) return null;
  const d = Math.round(r.face.d * 10) / 10;
  const rad = Math.round((r.face.d / 2) * 10) / 10;
  for (const a of drawing.annotations) {
    if (!("text" in a) || !("id" in a) || !a.id) continue;
    if (a.text.startsWith(`Ø${d}`) || a.text.startsWith(`R${rad}`) || a.text.includes(` Ø${d}`)) return a.id;
  }
  return null;
}

export default function HeroViewer({
  example,
  className,
  compact = false,
  autoRotate = true,
}: {
  example: Example;
  className?: string;
  compact?: boolean;
  autoRotate?: boolean;
}) {
  const [mode, setMode] = useState<"model" | "drawing">("model");
  const [readout, setReadout] = useState<Readout | null>(null);
  const [lastMatch, setLastMatch] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<DrawingData | null>(null);
  const viewer = useRef<ModelViewerHandle>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/examples/${example.id}/drawing.json`)
      .then((r) => r.json())
      .then((d) => alive && setDrawing(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [example.id]);

  const match = useMemo(() => matchAnnotation(readout, drawing), [readout, drawing]);
  useEffect(() => {
    if (match) setLastMatch(match);
  }, [match]);

  const matchedText = useMemo(() => {
    const id = match ?? null;
    const a = drawing?.annotations.find((x) => "id" in x && x.id === id);
    return a && "text" in a ? a.text : null;
  }, [match, drawing]);

  const [w, d, h] = example.bbox;
  const kb = Math.round(example.step_bytes / 1024);

  return (
    <div data-ui="" className={className} style={{ display: "grid", gridTemplateRows: "auto 1fr auto" }}>
      <div className="ui-bar">
        <div style={{ minWidth: 0 }}>
          <div className="ui-title">
            {example.title}, {example.number}
          </div>
          {!compact && <div className="ui-sub">{example.material}</div>}
        </div>
        <div className="ui-seg" role="group" aria-label="Show">
          <button type="button" aria-pressed={mode === "model"} onClick={() => setMode("model")}>
            3D model
          </button>
          <button type="button" aria-pressed={mode === "drawing"} onClick={() => setMode("drawing")}>
            Drawing
          </button>
        </div>
      </div>

      <div style={{ position: "relative", minHeight: 0, background: "#ffffff" }}>
        <ModelViewer
          ref={viewer}
          src={`/examples/${example.id}/model.glb`}
          autoRotate={autoRotate}
          zoom={false}
          touchGate
          label={`3D model of the ${example.title.toLowerCase()} built from its drawing. Drag to turn it.`}
          style={{ position: "absolute", inset: 0 }}
          onReadout={setReadout}
        />
        <div
          aria-hidden={mode !== "drawing"}
          style={{
            position: "absolute",
            inset: 0,
            background: "#ffffff",
            display: "grid",
            placeItems: "center",
            padding: compact ? 12 : 18,
            opacity: mode === "drawing" ? 1 : 0,
            pointerEvents: mode === "drawing" ? "auto" : "none",
            transition: "opacity 240ms var(--ease-ui)",
          }}
        >
          {drawing && (
            <DrawingSheet
              data={drawing}
              crop="views"
              drawn={mode === "drawing"}
              highlight={lastMatch}
              textSize={compact ? 6.4 : 5.6}
              className="hero-drawing"
            />
          )}
        </div>
      </div>

      <div className="ui-foot" aria-live="polite">
        {mode === "model" ? (
          readout ? (
            <div style={{ minWidth: 0 }}>
              <div className="ui-title">
                {readout.title}
                {matchedText && <span className="ui-sub"> &nbsp;matches {matchedText} on the drawing</span>}
              </div>
              <div className="ui-sub ui-kbd">
                x {formatMm(readout.point[0])} · y {formatMm(readout.point[1])} · z {formatMm(readout.point[2])} mm
              </div>
            </div>
          ) : (
            <div style={{ minWidth: 0 }}>
              <div className="ui-title ui-kbd">
                {w} × {d} × {h} mm
              </div>
              <div className="ui-sub">Point at any face to measure it</div>
            </div>
          )
        ) : (
          <div style={{ minWidth: 0 }}>
            <div className="ui-title">The sheet it was built from</div>
            <div className="ui-sub">
              {lastMatch ? "Highlighted: the dimension you last pointed at" : "First-angle projection, millimetres"}
            </div>
          </div>
        )}
        <a className="ui-btn" href={`/examples/${example.id}/model.step`} download={`${example.number}.step`}>
          STEP · {kb} KB
        </a>
      </div>
    </div>
  );
}
