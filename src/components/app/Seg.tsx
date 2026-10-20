"use client";

import { motion } from "motion/react";
import { useId } from "react";

export default function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && (
            <motion.span layoutId={`seg-${id}`} className="seg__pill" transition={{ type: "spring", stiffness: 520, damping: 40 }} />
          )}
          <span className="seg__label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
