"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 450;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Número que se desliza hasta su nuevo valor cuando cambia.
 * Con "reducir movimiento" activado, cambia de inmediato.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = reduce ? 1 : Math.min(1, (now - start) / DURATION_MS);
      current.current = from + (value - from) * easeOutCubic(t);
      setDisplay(t === 1 ? value : current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={className}>{format(display)}</span>;
}
