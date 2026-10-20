import type { Job, JobStatus } from "./types";

export const STATUS_LABEL: Record<JobStatus, string> = {
  estimating: "Pricing",
  quoted: "Waiting for you",
  queued: "In the queue",
  processing: "Building",
  done: "Ready",
  failed: "Couldn’t convert",
  cancelled: "Cancelled",
};

/** The stages the model page lists while a part is being built. The engine reports one of these in jobs.stage. */
export const BUILD_STAGES = [
  "Reading the drawing",
  "Finding views and dimensions",
  "Building the solid",
  "Checking it against your sheet",
  "Exporting the STEP",
] as const;

export function stageIndex(job: Pick<Job, "status" | "stage" | "progress">) {
  if (job.status === "done") return BUILD_STAGES.length;
  if (job.status !== "processing") return -1;
  const i = BUILD_STAGES.findIndex((s) => s === job.stage);
  if (i >= 0) return i;
  // unknown stage text: estimate from progress
  return Math.min(BUILD_STAGES.length - 1, Math.floor((job.progress / 100) * BUILD_STAGES.length));
}

export function isOpen(status: JobStatus) {
  return status === "estimating" || status === "quoted" || status === "queued" || status === "processing";
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function partNameFromFile(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}
