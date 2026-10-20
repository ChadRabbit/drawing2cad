"use client";

import { useEffect, useRef } from "react";

/** A muted loop that only plays while on screen, and stays on its poster for reduced motion. */
export default function LoopVideo({ src, poster, className, width, height }: { src: string; poster: string; className?: string; width: number; height: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video ref={ref} className={className} muted loop playsInline preload="metadata" poster={poster} width={width} height={height} aria-hidden="true">
      <source src={src} type="video/webm" />
    </video>
  );
}
