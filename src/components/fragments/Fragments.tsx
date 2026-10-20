import type { ReactNode } from "react";
import "./ui.css";

type Theme = "light" | "dark";

function Frag({ theme = "light", className, children, label }: { theme?: Theme; className?: string; children: ReactNode; label: string }) {
  return (
    <div data-ui="" data-theme={theme} className={className} role="img" aria-label={label}>
      {children}
    </div>
  );
}

export function Check({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.2 5 8.6l4.6-5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FileGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M8 3.5h8l5.5 5.5v15.5H8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 3.5V9h5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------- */

export function UploadFragment({
  theme = "light",
  file,
  className,
}: {
  theme?: Theme;
  file?: { name: string; meta: string; thumb?: ReactNode };
  className?: string;
}) {
  return (
    <Frag theme={theme} className={className} label="Upload panel: a drawing file added, units and a note set">
      <div className="ui-bar">
        <span className="ui-title">New conversion</span>
        <span className="ui-sub">Upload</span>
      </div>
      <div className="ui-body" style={{ display: "grid", gap: 14 }}>
        {file ? (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>
            {file.thumb}
            <div style={{ minWidth: 0 }}>
              <div className="ui-title">{file.name}</div>
              <div className="ui-sub">{file.meta}</div>
            </div>
            <span className="ui-chip">
              <Check /> &nbsp;Uploaded
            </span>
          </div>
        ) : (
          <div className="ui-drop">
            <FileGlyph />
            <span style={{ color: "var(--ui-text)", fontWeight: 500 }}>Drop a drawing here</span>
            <span>PDF, PNG, JPG, DWG or DXF, up to 50 MB</span>
          </div>
        )}
        <div className="ui-field">
          <span className="ui-sub">Units</span>
          <div className="ui-seg" style={{ width: "fit-content" }}>
            <button type="button" tabIndex={-1} aria-pressed="true">
              Read from sheet
            </button>
            <button type="button" tabIndex={-1} aria-pressed="false">
              mm
            </button>
            <button type="button" tabIndex={-1} aria-pressed="false">
              inch
            </button>
          </div>
        </div>
        <div className="ui-field">
          <span className="ui-sub">Note for the modeller (optional)</span>
          <div className="ui-input" style={{ display: "flex", alignItems: "center", fontSize: 14 }}>
            Thread is 1¼″ BSP, not shown on the section.
          </div>
        </div>
        <span className="ui-btn ui-btn-primary" style={{ height: 40 }}>
          Get a quote
        </span>
      </div>
    </Frag>
  );
}

export function QuoteFragment({ theme = "light", className }: { theme?: Theme; className?: string }) {
  return (
    <Frag theme={theme} className={className} label="Quote panel: a Medium part for 50 coins, with balance before and after">
      <div className="ui-bar">
        <span className="ui-title">PB-47_pillow-block.pdf</span>
        <span className="ui-chip ui-chip-accent">Quoted</span>
      </div>
      <div className="ui-body" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 500 }}>Medium part</span>
          <span style={{ fontSize: 22, fontWeight: 500 }} className="ui-kbd">
            50 coins
          </span>
        </div>
        <p className="ui-sub" style={{ margin: 0 }}>
          Three views and a section, 11 dimensions, one H7 bore and two slots. Units read from the sheet: millimetres.
        </p>
        <div style={{ display: "grid", gap: 6, padding: "10px 12px", background: "var(--ui-panel)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="ui-sub">Balance now</span>
            <span className="ui-kbd">120 coins</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="ui-sub">After this part</span>
            <span className="ui-kbd" style={{ fontWeight: 500 }}>
              70 coins
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <span className="ui-btn">Cancel</span>
          <span className="ui-btn ui-btn-primary">Convert for 50 coins</span>
        </div>
      </div>
    </Frag>
  );
}

const STEPS: { label: string; state: "done" | "now" | "todo"; time?: string }[] = [
  { label: "Reading the drawing", state: "done", time: "0:14" },
  { label: "Finding views and dimensions", state: "done", time: "0:31" },
  { label: "Building the solid", state: "now", time: "62%" },
  { label: "Checking it against your sheet", state: "todo" },
  { label: "Exporting the STEP", state: "todo" },
];

export function ProgressFragment({ theme = "light", className }: { theme?: Theme; className?: string }) {
  return (
    <Frag theme={theme} className={className} label="Progress panel: building the solid, 62 percent done">
      <div className="ui-bar">
        <span className="ui-title">bracket_rev-C.pdf</span>
        <span className="ui-sub ui-kbd">1 min 52 s</span>
      </div>
      <div className="ui-body" style={{ display: "grid", gap: 12 }}>
        <div className="ui-progress" aria-hidden="true">
          <span style={{ width: "62%" }} />
        </div>
        <ul className="ui-steps">
          {STEPS.map((s) => (
            <li key={s.label}>
              <span className="ui-dot" data-state={s.state}>
                {s.state === "done" && <Check size={10} />}
              </span>
              <span style={{ color: s.state === "todo" ? "var(--ui-text-2)" : "var(--ui-text)", fontWeight: s.state === "now" ? 500 : 400 }}>
                {s.label}
              </span>
              <span className="ui-sub ui-kbd">{s.time ?? ""}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frag>
  );
}

const CHECKS: [string, string, string][] = [
  ["Length", "150", "150.00"],
  ["Height", "98", "98.00"],
  ["Centre height", "52", "52.00"],
  ["Bore", "Ø47 H7", "47.000"],
  ["Housing", "R42", "42.00"],
  ["Depth", "44", "44.00"],
  ["Slot pitch", "120", "120.00"],
];

export function CheckFragment({ theme = "light", className }: { theme?: Theme; className?: string }) {
  return (
    <Frag theme={theme} className={className} label="Dimension check: seven drawing dimensions compared with the model, all matching">
      <div className="ui-bar">
        <span className="ui-title">Dimension check</span>
        <span className="ui-ok" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <Check /> 11 of 11 match
        </span>
      </div>
      <table className="ui-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Drawing</th>
            <th>Model</th>
          </tr>
        </thead>
        <tbody>
          {CHECKS.map(([f, d, m]) => (
            <tr key={f}>
              <td>{f}</td>
              <td>{d}</td>
              <td>
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  {m} <span className="ui-ok"><Check /></span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frag>
  );
}

export function ViewerToolsFragment({ theme = "light", className }: { theme?: Theme; className?: string }) {
  return (
    <Frag theme={theme} className={className} label="Viewer panel: pillow block model with view buttons and a face reading of a 47 millimetre hole">
      <div className="ui-bar">
        <div className="ui-seg">
          {["Iso", "Front", "Top", "Right"].map((v, i) => (
            <button key={v} type="button" tabIndex={-1} aria-pressed={i === 0}>
              {v}
            </button>
          ))}
        </div>
        <span className="ui-btn" style={{ height: 30 }}>
          Edges
        </span>
      </div>
      <div style={{ background: "#ffffff", display: "grid", placeItems: "center", padding: "6px 0" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/examples/pillow-block/thumb.webp" alt="" width={640} height={480} style={{ width: "86%", height: "auto" }} />
      </div>
      <div className="ui-foot">
        <div>
          <div className="ui-title">Hole Ø47.00</div>
          <div className="ui-sub ui-kbd">x 0.00 · y 22.00 · z 52.00 mm</div>
        </div>
        <span className="ui-chip">Cylindrical</span>
      </div>
    </Frag>
  );
}

const HISTORY = [
  { id: "gearbox-housing", name: "Gearbox housing GB-110", meta: "Complex · 100 coins · 19 Oct", done: true },
  { id: "pillow-block", name: "Pillow block PB-47", meta: "Medium · 50 coins · 18 Oct", done: true },
  { id: "mounting-plate", name: "Mounting plate MP-120", meta: "Simple · 20 coins · 16 Oct", done: true },
];

export function HistoryFragment({ theme = "light", className }: { theme?: Theme; className?: string }) {
  return (
    <Frag theme={theme} className={className} label="History panel: three finished models with STEP downloads and one in progress">
      <div className="ui-bar">
        <span className="ui-title">Your models</span>
        <span className="ui-sub">4 drawings</span>
      </div>
      <div className="ui-row">
        <span className="ui-thumb" style={{ display: "grid", placeItems: "center", color: "var(--ui-text-2)" }}>
          <FileGlyph />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="ui-title">Bracket, rev C</div>
          <div className="ui-sub">Simple · building the solid</div>
        </div>
        <span className="ui-sub ui-kbd">62%</span>
      </div>
      {HISTORY.map((h) => (
        <div className="ui-row" key={h.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ui-thumb" src={`/examples/${h.id}/thumb.webp`} alt="" width={56} height={42} />
          <div style={{ minWidth: 0 }}>
            <div className="ui-title">{h.name}</div>
            <div className="ui-sub">{h.meta}</div>
          </div>
          <span className="ui-btn" style={{ height: 30 }}>
            STEP
          </span>
        </div>
      ))}
    </Frag>
  );
}

export function DoneFragment({ theme = "light", className }: { theme?: Theme; className?: string }) {
  return (
    <Frag theme={theme} className={className} label="Finished model: pillow block preview with STEP download">
      <div className="ui-bar">
        <span className="ui-title">Pillow block PB-47</span>
        <span className="ui-ok" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <Check /> Ready
        </span>
      </div>
      <div style={{ background: "#ffffff", display: "grid", placeItems: "center", padding: "10px 0" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/examples/pillow-block/thumb.webp" alt="" width={640} height={480} style={{ width: "88%", height: "auto" }} />
      </div>
      <div className="ui-foot">
        <div>
          <div className="ui-title ui-kbd">150 × 44 × 98 mm</div>
          <div className="ui-sub">34 faces · STEP AP214 · 145 KB</div>
        </div>
        <span className="ui-btn ui-btn-primary">Download STEP</span>
      </div>
    </Frag>
  );
}
