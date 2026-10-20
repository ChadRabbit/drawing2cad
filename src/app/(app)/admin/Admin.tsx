"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ModelViewer, { type ModelStats, type ModelViewerHandle } from "@/components/viewer/ModelViewer";
import Seg from "@/components/app/Seg";
import StatusChip from "@/components/app/StatusChip";
import { useAccount } from "@/components/app/AccountProvider";
import { formatBytes, formatDateTime } from "@/lib/jobs";
import { formatMoney, type TierId } from "@/lib/pricing";
import { putSigned } from "@/lib/upload";
import type { Job } from "@/lib/types";

type AdminJob = Job & { profiles: { email: string | null; full_name: string | null; coins: number } | null };

async function post(path: string, body?: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.message ?? "Failed");
  return out;
}

export default function Admin() {
  const { isAdmin, loading } = useAccount();
  const [open, setOpen] = useState<AdminJob[] | null>(null);
  const [recent, setRecent] = useState<AdminJob[] | null>(null);
  const [summary, setSummary] = useState<{ users: number; done: number; revenue: { INR: number; USD: number } } | null>(null);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      fetch("/api/admin/jobs?scope=open").then((r) => r.json()),
      fetch("/api/admin/jobs?scope=recent").then((r) => r.json()),
      fetch("/api/admin/summary").then((r) => r.json()),
    ]);
    setOpen(a.jobs ?? []);
    setRecent(b.jobs ?? []);
    setSummary(c.users !== undefined ? c : null);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [isAdmin, load]);

  if (loading) return <main className="page" />;
  if (!isAdmin) {
    return (
      <main className="page">
        <div className="card empty">
          <h1 className="card__title">Owner only</h1>
          <p className="muted">This page is for the owner’s Google account.</p>
        </div>
      </main>
    );
  }

  const pricing = open?.filter((j) => j.status === "estimating") ?? [];
  const building = open?.filter((j) => j.status === "queued" || j.status === "processing") ?? [];
  const waiting = open?.filter((j) => j.status === "quoted") ?? [];

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Owner panel</h1>
          <p className="page__sub">Until the engine is connected, price drawings and publish models from here. The engine will use the same steps.</p>
        </div>
        {summary && (
          <dl className="kv card card__pad" style={{ margin: 0, minWidth: 260 }}>
            <dt>Accounts</dt>
            <dd>{summary.users}</dd>
            <dt>Models delivered</dt>
            <dd>{summary.done}</dd>
            <dt>Collected</dt>
            <dd>
              {formatMoney(summary.revenue.INR, "INR")} · {formatMoney(summary.revenue.USD, "USD")}
            </dd>
          </dl>
        )}
      </div>

      <div className="stack" style={{ gap: 40 }}>
        <Section title="Waiting for a price" count={pricing.length} empty="Nothing to price.">
          {pricing.map((j) => (
            <PriceRow key={j.id} job={j} onDone={load} />
          ))}
        </Section>
        <Section title="To build" count={building.length} empty="Nothing to build.">
          {building.map((j) => (
            <BuildRow key={j.id} job={j} onDone={load} />
          ))}
        </Section>
        <Section title="Quoted, waiting for the customer" count={waiting.length} empty="No open quotes.">
          {waiting.map((j) => (
            <JobRow key={j.id} job={j} onDone={load} />
          ))}
        </Section>
        <Grant />
        <Section title="Recent" count={recent?.length ?? 0} empty="Nothing finished yet.">
          {recent?.map((j) => (
            <JobRow key={j.id} job={j} onDone={load} finished />
          ))}
        </Section>
      </div>
    </main>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ gap: 12 }}>
      <h2 className="card__title">
        {title} <span className="muted tabular">{count}</span>
      </h2>
      {count === 0 ? <p className="muted">{empty}</p> : <div className="stack" style={{ gap: 10 }}>{children}</div>}
    </section>
  );
}

function JobHead({ job }: { job: AdminJob }) {
  const [busy, setBusy] = useState(false);
  const openDrawing = async () => {
    setBusy(true);
    const { url } = await post(`/api/admin/jobs/${job.id}/drawing`).catch(() => ({ url: null }));
    setBusy(false);
    if (url) window.open(url, "_blank", "noopener");
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontWeight: 500 }}>{job.name}</strong>
          <StatusChip status={job.status} />
          {job.tier && <span className="chip">{job.tier} · {job.coins_cost} coins</span>}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {job.profiles?.email} · {formatDateTime(job.created_at)} · {job.source_kind.toUpperCase()} {formatBytes(job.source_bytes)} · units{" "}
          {job.units}
        </div>
        {job.notes && <p style={{ fontSize: 14, marginTop: 6 }}>“{job.notes}”</p>}
        {job.error && <p className="alert" style={{ marginTop: 8 }}>{job.error}</p>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <a className="btn btn-tile btn-small" href={`/models/${job.id}`} target="_blank" rel="noopener">
          Customer view
        </a>
        <button className="btn btn-tile btn-small" onClick={openDrawing} disabled={busy}>
          Open drawing
        </button>
      </div>
    </div>
  );
}

function JobRow({ job, onDone, finished = false }: { job: AdminJob; onDone: () => void; finished?: boolean }) {
  return (
    <div className="card card__pad stack" style={{ gap: 12 }}>
      <JobHead job={job} />
      {!finished && <FailBox job={job} onDone={onDone} />}
    </div>
  );
}

function PriceRow({ job, onDone }: { job: AdminJob; onDone: () => void }) {
  const [tier, setTier] = useState<TierId>("medium");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await post(`/api/admin/jobs/${job.id}/quote`, { tier, note });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div className="card card__pad stack" style={{ gap: 14 }}>
      <JobHead job={job} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Seg<TierId>
          label="Level"
          value={tier}
          onChange={setTier}
          options={[
            { value: "simple", label: "Simple" },
            { value: "medium", label: "Medium" },
            { value: "complex", label: "Complex" },
          ]}
        />
        <input
          className="input"
          style={{ flex: "1 1 280px", width: "auto" }}
          placeholder="What the customer sees, e.g. Three views and a section, 11 dimensions."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn btn-ink btn-small" onClick={send} disabled={busy}>
          {busy ? "Sending…" : "Send quote"}
        </button>
      </div>
      {error && <p className="alert">{error}</p>}
      <FailBox job={job} onDone={onDone} />
    </div>
  );
}

function BuildRow({ job, onDone }: { job: AdminJob; onDone: () => void }) {
  const viewer = useRef<ModelViewerHandle>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const start = async () => {
    setBusy("start");
    await post(`/api/admin/jobs/${job.id}/start`).catch((e) => setError(e.message));
    setBusy(null);
    onDone();
  };

  const publish = async () => {
    if (!file || !viewer.current) return;
    setBusy("publish");
    setError(null);
    try {
      if (job.status === "queued") await post(`/api/admin/jobs/${job.id}/start`);
      await post(`/api/admin/jobs/${job.id}/progress`, { progress: 90, stage: "Exporting the STEP" });
      const [glb, thumb] = await Promise.all([viewer.current.exportGlb(), viewer.current.snapshot(640, 480)]);
      const { urls } = await post(`/api/admin/jobs/${job.id}/upload`);
      await putSigned(urls["model.step"], new Blob([await file.arrayBuffer()], { type: "application/step" }));
      if (glb) await putSigned(urls["model.glb"], new Blob([glb], { type: "model/gltf-binary" }));
      if (thumb) await putSigned(urls["thumb.webp"], thumb);
      await post(`/api/admin/jobs/${job.id}/complete`, {
        glb: Boolean(glb),
        thumb: Boolean(thumb),
        result: {
          bbox: stats?.size.map((v) => Math.round(v * 100) / 100),
          faces: stats?.faces,
          step_bytes: file.size,
        },
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  return (
    <div className="card card__pad stack" style={{ gap: 14 }}>
      <JobHead job={job} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {job.status === "queued" && (
          <button className="btn btn-tile btn-small" onClick={start} disabled={busy !== null}>
            Mark as building
          </button>
        )}
        <label className="btn btn-tile btn-small" style={{ position: "relative" }}>
          {file ? "Choose another STEP" : "Choose the STEP file"}
          <input
            type="file"
            accept=".step,.stp"
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
            onChange={(e) => {
              setStats(null);
              setFile(e.target.files?.[0] ?? null);
            }}
          />
        </label>
        {file && (
          <span className="muted" style={{ fontSize: 13 }}>
            {file.name} · {formatBytes(file.size)}
            {stats && ` · ${stats.size.map((v) => v.toFixed(1)).join(" × ")} mm · ${stats.faces} faces`}
          </span>
        )}
      </div>
      <AnimatePresence>
        {url && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 360 }} exit={{ opacity: 0, height: 0 }} style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}>
            <ModelViewer ref={viewer} src={url} format="step" style={{ position: "absolute", inset: 0 }} onLoad={setStats} onError={setError} />
          </motion.div>
        )}
      </AnimatePresence>
      {file && (
        <button className="btn btn-small" onClick={publish} disabled={!stats || busy !== null} style={{ justifySelf: "start" }}>
          {busy === "publish" ? "Publishing…" : "Publish to the customer"}
        </button>
      )}
      {error && <p className="alert">{error}</p>}
      <FailBox job={job} onDone={onDone} />
    </div>
  );
}

function FailBox({ job, onDone }: { job: AdminJob; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button className="link muted" style={{ justifySelf: "start", background: "none", border: 0, padding: 0, fontSize: 13, cursor: "pointer" }} onClick={() => setOpen(true)}>
        Can’t convert this…
      </button>
    );
  }
  return (
    <div className="panel" style={{ padding: 12, display: "grid", gap: 10 }}>
      <textarea
        className="textarea"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Shown to the customer. E.g. The side view is missing, so the depth of the pocket can’t be read."
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-ink btn-small"
          disabled={busy || !reason.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await post(`/api/admin/jobs/${job.id}/fail`, { error: reason });
              onDone();
            } catch (e) {
              setError((e as Error).message);
            }
            setBusy(false);
          }}
        >
          {busy ? "Saving…" : job.coins_charged ? `Fail (keeps ${job.coins_charged} coins)` : "Fail"}
        </button>
        <button className="btn btn-tile btn-small" onClick={() => setOpen(false)}>
          Back
        </button>
      </div>
      {error && <p className="alert">{error}</p>}
    </div>
  );
}

function Grant() {
  const [email, setEmail] = useState("");
  const [coins, setCoins] = useState("20");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="stack" style={{ gap: 12 }}>
      <h2 className="card__title">Give coins</h2>
      <form
        className="card card__pad"
        style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          try {
            const out = await post("/api/admin/grant", { email, coins: Number(coins), note });
            setMsg(`Done. ${email} now has ${out.balance} coins.`);
            setEmail("");
            setNote("");
          } catch (err) {
            setMsg((err as Error).message);
          }
          setBusy(false);
        }}
      >
        <input className="input" style={{ flex: "2 1 220px", width: "auto" }} type="email" required placeholder="customer@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" style={{ flex: "0 1 110px", width: "auto" }} type="number" required value={coins} onChange={(e) => setCoins(e.target.value)} aria-label="Coins (negative to take away)" />
        <input className="input" style={{ flex: "2 1 220px", width: "auto" }} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-ink btn-small" disabled={busy}>
          {busy ? "Saving…" : "Give coins"}
        </button>
        {msg && (
          <p className="muted" style={{ flexBasis: "100%", fontSize: 14 }}>
            {msg}
          </p>
        )}
      </form>
    </section>
  );
}
