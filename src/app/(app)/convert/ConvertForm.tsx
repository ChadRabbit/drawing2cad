"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Seg from "@/components/app/Seg";
import { useAccount } from "@/components/app/AccountProvider";
import { CoinGlyph } from "@/components/app/CoinGlyph";
import { FileGlyph } from "@/components/fragments/Fragments";
import { acceptAttr, acceptedFiles, site } from "@/lib/site";
import { formatBytes, partNameFromFile } from "@/lib/jobs";
import { uploadWithProgress } from "@/lib/upload";
import type { Tier } from "@/lib/pricing";

type Units = "auto" | "mm" | "inch";

function cleanFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "drawing";
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return `${base}.${ext}`;
}

export default function ConvertForm({ tiers }: { tiers: Tier[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { profile } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState(params.get("name") ?? "");
  const [nameTouched, setNameTouched] = useState(Boolean(params.get("name")));
  const [units, setUnits] = useState<Units>((["mm", "inch"].includes(params.get("units") ?? "") ? params.get("units") : "auto") as Units);
  const [notes, setNotes] = useState("");
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(ext in acceptedFiles)) {
      setError("That file type isn’t supported. Use PDF, PNG, JPG, WEBP, DWG or DXF.");
      return;
    }
    if (f.size > site.maxUploadMB * 1024 * 1024) {
      setError(`That file is ${formatBytes(f.size)}. Files can be up to ${site.maxUploadMB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
    if (!nameTouched) setName(partNameFromFile(f.name));
  };

  const kind = useMemo(() => {
    const ext = file?.name.split(".").pop()?.toLowerCase() ?? "";
    return acceptedFiles[ext as keyof typeof acceptedFiles];
  }, [file]);

  const busy = progress !== null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !profile) return;
    if (!name.trim()) {
      setError("Give the part a name.");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      const path = `${profile.id}/${crypto.randomUUID()}/${cleanFileName(file.name)}`;
      await uploadWithProgress("drawings", path, file, (p) => setProgress(p * 0.92));
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), path, bytes: file.size, units, notes: notes.trim() || null }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.message ?? "Something went wrong.");
      setProgress(1);
      router.push(`/models/${out.job.id}`);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">New conversion</h1>
          <p className="page__sub">Add one part’s drawing. We read it and price it first; nothing is charged until you confirm.</p>
        </div>
      </div>

      <div className="split">
        <form className="card card__pad stack" onSubmit={submit} style={{ gap: 22 }}>
          <AnimatePresence mode="wait" initial={false}>
            {!file ? (
              <motion.label
                key="drop"
                className="drop"
                data-over={over}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  pick(e.dataTransfer.files?.[0]);
                }}
              >
                <input type="file" accept={acceptAttr} onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose a drawing" />
                <FileGlyph />
                <span style={{ fontSize: 17, fontWeight: 500 }}>Drop a drawing here, or choose a file</span>
                <span className="muted" style={{ fontSize: 14 }}>
                  PDF, PNG, JPG, WEBP, DWG or DXF, up to {site.maxUploadMB} MB. One part per drawing.
                </span>
              </motion.label>
            ) : (
              <motion.div
                key="file"
                className="panel"
                style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 14, padding: 14 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              >
                <div
                  style={{
                    width: 88,
                    height: 66,
                    borderRadius: 8,
                    background: "#fff",
                    border: "1px solid var(--line)",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    color: "var(--text-2)",
                  }}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{file.name.split(".").pop()?.toUpperCase()}</span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                  <div className="muted" style={{ fontSize: 14 }}>
                    {kind === "image" ? "Image" : kind?.toUpperCase()} · {formatBytes(file.size)}
                  </div>
                </div>
                <button type="button" className="btn btn-tile btn-small" onClick={() => setFile(null)} disabled={busy}>
                  Replace
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="field">
            <label htmlFor="part-name">Part name</label>
            <input
              id="part-name"
              className="input"
              value={name}
              maxLength={120}
              placeholder="Bracket, rev C"
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
            />
          </div>

          <div className="field">
            <span className="field__label">Units</span>
            <Seg<Units>
              label="Units"
              value={units}
              onChange={setUnits}
              options={[
                { value: "auto", label: "From the sheet" },
                { value: "mm", label: "mm" },
                { value: "inch", label: "inch" },
              ]}
            />
          </div>

          <div className="field">
            <label htmlFor="notes">Note for the modeller</label>
            <textarea
              id="notes"
              className="textarea"
              value={notes}
              maxLength={1000}
              placeholder="Anything the sheet leaves out: a thread spec, which view is the section, a dimension that’s hard to read."
              onChange={(e) => setNotes(e.target.value)}
            />
            <span className="field__hint">Optional.</span>
          </div>

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            <button type="submit" className="btn btn-ink" disabled={!file || busy} style={{ justifySelf: "start" }}>
              {busy ? (progress! < 0.92 ? `Uploading ${Math.round((progress! / 0.92) * 100)}%` : "Starting…") : "Get a quote"}
            </button>
            {busy && (
              <div className="bar" aria-hidden="true">
                <motion.span animate={{ scaleX: progress! }} initial={{ scaleX: 0 }} transition={{ ease: [0.2, 0, 0, 1], duration: 0.3 }} />
              </div>
            )}
          </div>
        </form>

        <aside className="stack">
          <div className="card card__pad stack" style={{ gap: 14 }}>
            <h2 className="card__title">What it costs</h2>
            <p className="muted" style={{ fontSize: 14 }}>
              We set the level when we read your drawing. You see it, with the coins, before you confirm.
            </p>
            <div>
              {tiers.map((t) => (
                <div
                  key={t.id}
                  style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 14, alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--line)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/examples/${t.example_id}/thumb.webp`} alt="" width={64} height={48} style={{ borderRadius: 6, border: "1px solid var(--line)" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{t.name}</div>
                    <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
                      {t.summary}
                    </div>
                  </div>
                  <div className="tabular" style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                    {t.coins} coins
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card card__pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CoinGlyph size={22} />
              <div>
                <div className="tabular" style={{ fontWeight: 500 }}>
                  {profile ? `${profile.coins} coins` : "…"}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Your balance
                </div>
              </div>
            </div>
            <Link href="/coins" className="btn btn-tile btn-small">
              Buy coins
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
