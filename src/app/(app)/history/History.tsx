"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import Seg from "@/components/app/Seg";
import { FileGlyph } from "@/components/fragments/Fragments";
import StatusChip from "@/components/app/StatusChip";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDate, isOpen } from "@/lib/jobs";
import type { Job } from "@/lib/types";

type Row = Pick<Job, "id" | "name" | "status" | "tier" | "coins_cost" | "coins_charged" | "thumb_path" | "source_kind" | "created_at" | "progress">;
type Filter = "all" | "open" | "done";

const PAGE = 24;

export default function History() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (from: number) => {
    const supabase = supabaseBrowser();
    const { data } = await supabase
      .from("jobs")
      .select("id,name,status,tier,coins_cost,coins_charged,thumb_path,source_kind,created_at,progress")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    const list = (data ?? []) as Row[];
    setMore(list.length === PAGE);
    const paths = list.map((r) => r.thumb_path).filter(Boolean) as string[];
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("models").createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      signed?.forEach((s) => {
        if (s.signedUrl && s.path) map[s.path] = s.signedUrl;
      });
      setThumbs((t) => ({ ...t, ...map }));
    }
    setRows((r) => (from === 0 ? list : [...(r ?? []), ...list]));
  }, []);

  useEffect(() => {
    load(0);
  }, [load]);

  // keep open conversions moving without a reload
  useEffect(() => {
    if (!rows?.some((r) => isOpen(r.status))) return;
    const t = setInterval(() => load(0), 10000);
    return () => clearInterval(t);
  }, [rows, load]);

  const shown = useMemo(() => {
    if (!rows) return null;
    if (filter === "open") return rows.filter((r) => isOpen(r.status));
    if (filter === "done") return rows.filter((r) => r.status === "done");
    return rows;
  }, [rows, filter]);

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Your models</h1>
          <p className="page__sub">Every drawing you’ve sent, with its STEP file once it’s ready.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Seg<Filter>
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "In progress" },
              { value: "done", label: "Ready" },
            ]}
          />
          <Link href="/convert" className="btn btn-ink btn-small">
            New conversion
          </Link>
        </div>
      </div>

      {shown === null ? (
        <div className="models">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: "4 / 3.6" }} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="card empty">
          <h2 className="card__title">{rows?.length ? "Nothing here" : "No models yet"}</h2>
          <p className="muted">{rows?.length ? "No conversions match this filter." : "Upload a drawing and its model will show up here."}</p>
          {!rows?.length && (
            <Link href="/convert" className="btn btn-ink btn-small">
              Convert a drawing
            </Link>
          )}
        </div>
      ) : (
        <motion.ul className="models" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
          {shown.map((r) => (
            <motion.li
              key={r.id}
              layout
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0, 0, 1] } } }}
            >
              <Link href={`/models/${r.id}`} className="model-card">
                <div className="model-card__thumb">
                  {r.thumb_path && thumbs[r.thumb_path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbs[r.thumb_path]} alt="" loading="lazy" />
                  ) : (
                    <div className="model-card__placeholder">
                      <FileGlyph />
                      <span>{r.source_kind === "image" ? "Image" : r.source_kind.toUpperCase()}</span>
                    </div>
                  )}
                  {(r.status === "processing" || r.status === "queued") && (
                    <div className="model-card__progress" aria-hidden="true">
                      <span style={{ transform: `scaleX(${Math.max(0.03, r.progress / 100)})` }} />
                    </div>
                  )}
                </div>
                <div className="model-card__meta">
                  <div className="model-card__name">{r.name}</div>
                  <div className="model-card__row">
                    <span className="muted">
                      {formatDate(r.created_at)}
                      {r.tier ? ` · ${r.tier.charAt(0).toUpperCase()}${r.tier.slice(1)}` : ""}
                      {r.coins_charged ? ` · ${r.coins_charged} coins` : ""}
                    </span>
                    <StatusChip status={r.status} />
                  </div>
                </div>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {more && filter === "all" && (
        <div style={{ display: "grid", placeItems: "center", marginTop: 32 }}>
          <button
            className="btn btn-tile btn-small"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load(rows?.length ?? 0);
              setLoadingMore(false);
            }}
          >
            {loadingMore ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </main>
  );
}
