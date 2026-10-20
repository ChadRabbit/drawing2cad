"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ModelViewer, { type ModelViewerHandle, type Readout, type ViewName } from "@/components/viewer/ModelViewer";
import { formatMm } from "@/components/viewer/faces";
import { Check } from "@/components/fragments/Fragments";
import { useAccount } from "@/components/app/AccountProvider";
import { useJob, useSignedUrl } from "@/components/app/useJob";
import Seg from "@/components/app/Seg";
import StatusChip from "@/components/app/StatusChip";
import { BUILD_STAGES, formatBytes, formatDateTime, stageIndex } from "@/lib/jobs";
import type { Job } from "@/lib/types";
import "./model.css";

const ease = [0.2, 0, 0, 1] as const;

export default function ModelPage() {
  const { id } = useParams<{ id: string }>();
  const { job, setJob, missing } = useJob(id);

  if (missing) {
    return (
      <main className="page">
        <div className="empty card">
          <h1 className="card__title">This model isn’t here</h1>
          <p className="muted">The link may be wrong, or it belongs to another account.</p>
          <Link href="/history" className="btn btn-ink btn-small">
            Your models
          </Link>
        </div>
      </main>
    );
  }
  if (!job) {
    return (
      <main className="page">
        <div className="skeleton" style={{ height: 48, width: 320, marginBottom: 28 }} />
        <div className="split split--viewer">
          <div className="skeleton" style={{ height: 520 }} />
          <div className="skeleton" style={{ height: 320 }} />
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <Header job={job} onRenamed={setJob} />
      <AnimatePresence mode="wait">
        <motion.div
          key={job.status === "queued" ? "processing" : job.status}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease }}
        >
          {job.status === "done" ? <Done job={job} /> : <InProgress job={job} onChange={setJob} />}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

/* ------------------------------------------------------------------------------------------ header */

function Header({ job, onRenamed }: { job: Job; onRenamed: (j: Job) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(job.name);

  useEffect(() => setName(job.name), [job.name]);

  const save = async () => {
    setEditing(false);
    if (!name.trim() || name.trim() === job.name) return setName(job.name);
    const res = await fetch(`/api/jobs/${job.id}/rename`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const out = await res.json();
    if (res.ok) onRenamed(out.job);
    else setName(job.name);
  };

  return (
    <div className="page__head">
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Link href="/history" className="muted link" style={{ fontSize: 14 }}>
            Your models
          </Link>
          <span className="muted">/</span>
          <StatusChip status={job.status} />
        </div>
        {editing ? (
          <input
            className="input model__name-input"
            value={name}
            autoFocus
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setName(job.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <h1 className="page__title model__name">
            <button type="button" onClick={() => setEditing(true)} title="Rename">
              {job.name}
            </button>
          </h1>
        )}
        <p className="page__sub">Uploaded {formatDateTime(job.created_at)}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ before done */

function InProgress({ job, onChange }: { job: Job; onChange: (j: Job) => void }) {
  return (
    <div className="split">
      <DrawingPreview job={job} scanning={job.status === "estimating" || job.status === "processing" || job.status === "queued"} />
      <div className="stack">
        {job.status === "estimating" && <Estimating job={job} onChange={onChange} />}
        {job.status === "quoted" && <Quote job={job} onChange={onChange} />}
        {(job.status === "queued" || job.status === "processing") && <Building job={job} />}
        {job.status === "failed" && <Failed job={job} />}
        {job.status === "cancelled" && <Cancelled />}
        <Brief job={job} />
      </div>
    </div>
  );
}

function DrawingPreview({ job, scanning }: { job: Job; scanning: boolean }) {
  const url = useSignedUrl("drawings", job.source_path);
  const fileName = job.source_path.split("/").pop() ?? "drawing";
  return (
    <div className="card drawing-preview">
      <div className="drawing-preview__body">
        {job.source_kind === "image" && url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`The drawing uploaded for ${job.name}`} />
        )}
        {job.source_kind === "pdf" && url && <iframe src={`${url}#view=FitH&toolbar=0`} title={`The drawing uploaded for ${job.name}`} />}
        {(job.source_kind === "dwg" || job.source_kind === "dxf") && (
          <div className="empty">
            <span className="chip">{job.source_kind.toUpperCase()}</span>
            <p className="muted">{job.source_kind.toUpperCase()} files can’t be previewed in the browser, but we read them directly.</p>
          </div>
        )}
        {!url && job.source_kind !== "dwg" && job.source_kind !== "dxf" && <div className="skeleton" style={{ position: "absolute", inset: 0 }} />}
        {scanning && <span className="scanline" aria-hidden="true" />}
      </div>
      <div className="drawing-preview__foot">
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
        <span className="muted">{formatBytes(job.source_bytes)}</span>
      </div>
    </div>
  );
}

function Estimating({ job, onChange }: { job: Job; onChange: (j: Job) => void }) {
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    const res = await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" });
    const out = await res.json();
    setBusy(false);
    if (res.ok) onChange(out.job);
  };
  return (
    <div className="card card__pad stack">
      <h2 className="card__title">Reading your drawing</h2>
      <p className="muted">
        We’re working out the views, the dimensions and how much there is to model. The price shows up here as soon as it’s ready; you
        can leave this page, it’s saved in Your models.
      </p>
      <div className="bar bar--indeterminate" aria-hidden="true">
        <span />
      </div>
      <button className="btn btn-tile btn-small" onClick={cancel} disabled={busy} style={{ justifySelf: "start" }}>
        {busy ? "Cancelling…" : "Cancel"}
      </button>
    </div>
  );
}

function Quote({ job, onChange }: { job: Job; onChange: (j: Job) => void }) {
  const { profile, refresh } = useAccount();
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cost = job.coins_cost ?? 0;
  const balance = profile?.coins ?? 0;
  const short = Math.max(0, cost - balance);

  const act = async (what: "confirm" | "cancel") => {
    setBusy(what);
    setError(null);
    const res = await fetch(`/api/jobs/${job.id}/${what}`, { method: "POST" });
    const out = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(out.message);
      return;
    }
    onChange(out.job);
    refresh();
  };

  return (
    <div className="card card__pad stack" style={{ gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 className="card__title" style={{ fontSize: 28 }}>
          {job.tier ? `${job.tier.charAt(0).toUpperCase()}${job.tier.slice(1)} part` : "Your quote"}
        </h2>
        <span className="tabular" style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 300 }}>
          {cost} coins
        </span>
      </div>
      {job.estimate_note && <p className="muted">{job.estimate_note}</p>}
      <dl className="kv panel" style={{ padding: "12px 14px", margin: 0 }}>
        <dt>Balance now</dt>
        <dd>{balance} coins</dd>
        <dt>After this part</dt>
        <dd style={{ fontWeight: 500 }}>{short > 0 ? `${short} coins short` : `${balance - cost} coins`}</dd>
      </dl>
      {error && <p className="alert">{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {short > 0 ? (
          <Link href={`/coins?need=${short}&back=${encodeURIComponent(`/models/${job.id}`)}`} className="btn">
            Buy coins
          </Link>
        ) : (
          <button className="btn" onClick={() => act("confirm")} disabled={busy !== null}>
            {busy === "confirm" ? "Starting…" : `Convert for ${cost} coins`}
          </button>
        )}
        <button className="btn btn-tile" onClick={() => act("cancel")} disabled={busy !== null}>
          {busy === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        If the part can’t be converted after you confirm, the coins come back automatically.
      </p>
    </div>
  );
}

function Building({ job }: { job: Job }) {
  const idx = stageIndex(job);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const since = job.started_at ?? job.confirmed_at ?? job.created_at;
  const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const elapsed = `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, "0")} s`;

  return (
    <div className="card card__pad stack" style={{ gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 className="card__title">{job.status === "queued" ? "In the queue" : "Building your model"}</h2>
        <span className="muted tabular" style={{ fontSize: 14 }}>
          {elapsed}
        </span>
      </div>
      <div className="bar" aria-label={`${job.progress}% done`} role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}>
        <motion.span initial={false} animate={{ scaleX: Math.max(0.02, job.progress / 100) }} transition={{ type: "spring", stiffness: 60, damping: 20 }} />
      </div>
      <ol className="stages">
        {BUILD_STAGES.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "now" : "todo";
          return (
            <li key={s} data-state={state}>
              <span className="stages__dot">{state === "done" && <Check size={10} />}</span>
              <span>{s}</span>
            </li>
          );
        })}
      </ol>
      <p className="muted" style={{ fontSize: 13 }}>
        {job.coins_charged} coins taken. You can close this page; the model will be waiting in Your models.
      </p>
    </div>
  );
}

function Failed({ job }: { job: Job }) {
  return (
    <div className="card card__pad stack">
      <h2 className="card__title">We couldn’t convert this drawing</h2>
      {job.error && <p>{job.error}</p>}
      <p className="muted">Any coins taken for this part are back in your balance.</p>
      <Link href="/convert" className="btn btn-ink btn-small" style={{ justifySelf: "start" }}>
        Try another drawing
      </Link>
    </div>
  );
}

function Cancelled() {
  return (
    <div className="card card__pad stack">
      <h2 className="card__title">Cancelled</h2>
      <p className="muted">Nothing was charged for this drawing.</p>
      <Link href="/convert" className="btn btn-ink btn-small" style={{ justifySelf: "start" }}>
        New conversion
      </Link>
    </div>
  );
}

function Brief({ job }: { job: Job }) {
  return (
    <div className="card card__pad">
      <dl className="kv" style={{ margin: 0 }}>
        <dt>Units</dt>
        <dd>{job.units === "auto" ? "Read from the sheet" : job.units === "mm" ? "Millimetres" : "Inches"}</dd>
        <dt>File</dt>
        <dd>{job.source_kind === "image" ? "Image" : job.source_kind.toUpperCase()}</dd>
        {job.notes && (
          <>
            <dt>Your note</dt>
            <dd style={{ textAlign: "left" }}>{job.notes}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ done */

function Done({ job }: { job: Job }) {
  const viewer = useRef<ModelViewerHandle>(null);
  const [tab, setTab] = useState<"model" | "drawing">("model");
  const [view, setView] = useState<ViewName>("iso");
  const [edges, setEdges] = useState(true);
  const [readout, setReadout] = useState<Readout | null>(null);
  const [size, setSize] = useState<[number, number, number] | null>(null);
  const safeName = job.name.replace(/[^\w.-]+/g, "_");
  const previewUrl = useSignedUrl("models", job.glb_path ?? job.step_path);
  const stepUrl = useSignedUrl("models", job.step_path, `${safeName}.step`);
  const drawingUrl = useSignedUrl("drawings", job.source_path, job.source_path.split("/").pop());
  const r = job.result ?? {};
  const bbox = r.bbox ?? size;

  return (
    <div className="split split--viewer">
      <div className="card viewer-card">
        <div className="viewer-card__bar">
          <Seg<"model" | "drawing">
            label="Show"
            value={tab}
            onChange={setTab}
            options={[
              { value: "model", label: "3D model" },
              { value: "drawing", label: "Your drawing" },
            ]}
          />
          {tab === "model" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Seg<ViewName>
                label="View"
                value={view}
                onChange={(v) => {
                  setView(v);
                  viewer.current?.setView(v);
                }}
                options={[
                  { value: "iso", label: "Iso" },
                  { value: "front", label: "Front" },
                  { value: "top", label: "Top" },
                  { value: "right", label: "Right" },
                ]}
              />
              <button
                type="button"
                className="btn btn-tile btn-small"
                aria-pressed={edges}
                onClick={() => {
                  setEdges(!edges);
                  viewer.current?.setEdges(!edges);
                }}
              >
                {edges ? "Hide edges" : "Show edges"}
              </button>
            </div>
          )}
        </div>
        <div className="viewer-card__stage">
          {previewUrl && (
            <ModelViewer
              ref={viewer}
              src={previewUrl}
              format={job.glb_path ? "glb" : "step"}
              style={{ position: "absolute", inset: 0, visibility: tab === "model" ? "visible" : "hidden" }}
              label={`3D model of ${job.name}`}
              onReadout={setReadout}
              onLoad={(s) => setSize(s.size)}
            />
          )}
          {tab === "drawing" && <DrawingInline job={job} />}
        </div>
        <div className="viewer-card__foot" aria-live="polite">
          {tab === "model" ? (
            readout ? (
              <>
                <span style={{ fontWeight: 500 }}>{readout.title}</span>
                <span className="muted tabular">
                  {readout.detail ? `${readout.detail} · ` : ""}x {formatMm(readout.point[0])} · y {formatMm(readout.point[1])} · z {formatMm(readout.point[2])} mm
                </span>
              </>
            ) : (
              <span className="muted">Drag to turn it, scroll to zoom, and point at any face to measure it.</span>
            )
          ) : (
            <span className="muted">The file you uploaded.</span>
          )}
        </div>
      </div>

      <div className="stack">
        <div className="card card__pad stack" style={{ gap: 12 }}>
          <h2 className="card__title">Download</h2>
          <a className={`btn${stepUrl ? "" : " is-disabled"}`} href={stepUrl ?? undefined} aria-disabled={!stepUrl}>
            STEP file{r.step_bytes ? ` · ${formatBytes(r.step_bytes)}` : ""}
          </a>
          <a className="btn btn-tile" href={drawingUrl ?? undefined} aria-disabled={!drawingUrl}>
            Your drawing
          </a>
          <p className="muted" style={{ fontSize: 13 }}>
            STEP AP214. Opens in SolidWorks, Fusion, Inventor, Creo, CATIA, NX, Onshape and FreeCAD.
          </p>
        </div>

        <div className="card card__pad">
          <h2 className="card__title" style={{ marginBottom: 12 }}>
            Details
          </h2>
          <dl className="kv" style={{ margin: 0 }}>
            {bbox && (
              <>
                <dt>Size</dt>
                <dd>
                  {bbox.map((v) => Math.round(v * 100) / 100).join(" × ")} mm
                </dd>
              </>
            )}
            {r.volume_mm3 !== undefined && (
              <>
                <dt>Volume</dt>
                <dd>{(r.volume_mm3 / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} cm³</dd>
              </>
            )}
            {r.faces !== undefined && (
              <>
                <dt>Faces</dt>
                <dd>{r.faces}</dd>
              </>
            )}
            {job.tier && (
              <>
                <dt>Level</dt>
                <dd style={{ textTransform: "capitalize" }}>{job.tier}</dd>
              </>
            )}
            {job.finished_at && (
              <>
                <dt>Finished</dt>
                <dd>{formatDateTime(job.finished_at)}</dd>
              </>
            )}
          </dl>
        </div>

        {r.checks && r.checks.length > 0 && (
          <div className="card">
            <div className="card__pad" style={{ paddingBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 className="card__title">Dimension check</h2>
              <span className="muted" style={{ fontSize: 13 }}>
                {r.checks.filter((c) => c.ok).length} of {r.checks.length} match
              </span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Drawing</th>
                  <th className="num">Model</th>
                </tr>
              </thead>
              <tbody>
                {r.checks.map((c, i) => (
                  <tr key={i}>
                    <td>{c.label}</td>
                    <td>{c.drawing}</td>
                    <td className="num" style={{ color: c.ok ? undefined : "var(--danger)" }}>
                      {c.model} {c.ok && <Check />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {r.assumptions && r.assumptions.length > 0 && (
          <div className="card card__pad stack" style={{ gap: 8 }}>
            <h2 className="card__title">What we assumed</h2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {r.assumptions.map((a, i) => (
                <li key={i} style={{ fontSize: 14 }}>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function DrawingInline({ job }: { job: Job }) {
  const url = useSignedUrl("drawings", job.source_path);
  if (job.source_kind === "dwg" || job.source_kind === "dxf") {
    return (
      <div className="empty" style={{ position: "absolute", inset: 0 }}>
        <p className="muted">{job.source_kind.toUpperCase()} files can’t be previewed in the browser. Download it from the panel on the right.</p>
      </div>
    );
  }
  if (!url) return null;
  return job.source_kind === "pdf" ? (
    <iframe className="viewer-card__drawing" src={`${url}#view=FitH&toolbar=0`} title={`Drawing for ${job.name}`} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="viewer-card__drawing" src={url} alt={`Drawing for ${job.name}`} style={{ objectFit: "contain" }} />
  );
}
