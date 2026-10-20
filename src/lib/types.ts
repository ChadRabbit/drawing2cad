import type { TierId } from "./pricing";

export type JobStatus = "estimating" | "quoted" | "queued" | "processing" | "done" | "failed" | "cancelled";

/** What the conversion engine (or the owner) stores in jobs.result. Every field is optional. */
export type JobResult = {
  bbox?: [number, number, number];
  volume_mm3?: number;
  area_mm2?: number;
  faces?: number;
  units?: "mm" | "inch";
  step_bytes?: number;
  /** Dimension check: each dimension on the drawing measured on the model. */
  checks?: { label: string; drawing: string; model: string; ok: boolean }[];
  /** Anything the engine had to assume because the sheet didn't say. */
  assumptions?: string[];
};

export type Job = {
  id: string;
  user_id: string;
  name: string;
  source_path: string;
  source_kind: "pdf" | "image" | "dwg" | "dxf";
  source_bytes: number;
  units: "auto" | "mm" | "inch";
  notes: string | null;
  status: JobStatus;
  tier: TierId | null;
  coins_cost: number | null;
  coins_charged: number;
  estimate_note: string | null;
  progress: number;
  stage: string | null;
  error: string | null;
  step_path: string | null;
  glb_path: string | null;
  thumb_path: string | null;
  result: JobResult | null;
  created_at: string;
  quoted_at: string | null;
  confirmed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  coins: number;
  created_at: string;
};

export type LedgerRow = {
  id: number;
  delta: number;
  balance_after: number;
  reason: "signup_bonus" | "purchase" | "conversion" | "refund" | "grant" | "adjustment";
  job_id: string | null;
  note: string | null;
  created_at: string;
};
