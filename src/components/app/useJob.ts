"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isOpen } from "@/lib/jobs";
import type { Job } from "@/lib/types";

/** Loads one job and keeps it live: Realtime updates, with a slow poll as a fallback while it is open. */
export function useJob(id: string) {
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabaseBrowser().from("jobs").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      setMissing(true);
      return;
    }
    setJob(data as Job);
  }, [id]);

  useEffect(() => {
    load();
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`job-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${id}` }, (payload) => {
        setJob(payload.new as Job);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    if (!job || !isOpen(job.status)) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [job, load]);

  return { job, setJob, missing, reload: load };
}

/** A short-lived signed URL for a private file. */
export function useSignedUrl(bucket: "drawings" | "models", path: string | null | undefined, download?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let alive = true;
    supabaseBrowser()
      .storage.from(bucket)
      .createSignedUrl(path, 3600, download ? { download } : undefined)
      .then(({ data }) => alive && setUrl(data?.signedUrl ?? null));
    return () => {
      alive = false;
    };
  }, [bucket, path, download]);
  return url;
}
