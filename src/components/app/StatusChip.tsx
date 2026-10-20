import { STATUS_LABEL } from "@/lib/jobs";
import type { Job } from "@/lib/types";

export default function StatusChip({ status }: { status: Job["status"] }) {
  const tone = status === "done" ? "lime" : status === "failed" ? "bad" : status === "quoted" ? "ink" : undefined;
  return (
    <span className="chip" data-tone={tone}>
      {(status === "estimating" || status === "processing" || status === "queued") && <span className="pulse" aria-hidden="true" />}
      {STATUS_LABEL[status]}
    </span>
  );
}
