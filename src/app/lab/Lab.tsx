"use client";

import { useEffect, useState } from "react";
import ModelViewer, { type Readout } from "@/components/viewer/ModelViewer";
import DrawingSheet, { type DrawingData } from "@/components/drawing/DrawingSheet";

const ids = ["mounting-plate", "pillow-block", "gearbox-housing"];

export default function Lab() {
  const [drawings, setDrawings] = useState<Record<string, DrawingData>>({});
  const [readout, setReadout] = useState<Readout | null>(null);
  useEffect(() => {
    Promise.all(ids.map((id) => fetch(`/examples/${id}/drawing.json`).then((r) => r.json()))).then((all) =>
      setDrawings(Object.fromEntries(ids.map((id, i) => [id, all[i]]))),
    );
  }, []);
  return (
    <main className="scheme-light" style={{ padding: 24, display: "grid", gap: 24 }}>
      <p>{readout ? `${readout.title} · ${readout.detail} · ${readout.point.map((v) => v.toFixed(1)).join(", ")}` : "hover a face"}</p>
      {ids.map((id) => (
        <section key={id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: "#fff", border: "1px solid #ddd" }}>
            {drawings[id] && <DrawingSheet data={drawings[id]} />}
          </div>
          <ModelViewer src={`/examples/${id}/model.glb`} className="lab-viewer" onReadout={setReadout} />
        </section>
      ))}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>{drawings["pillow-block"] && <DrawingSheet data={drawings["pillow-block"]} crop="views" highlight="bore" />}</div>
        <ModelViewer src="/examples/pillow-block/model.step" format="step" className="lab-viewer" onReadout={setReadout} />
      </section>
      <style>{`.lab-viewer { height: 420px; background: #f4f4f4; }`}</style>
    </main>
  );
}
