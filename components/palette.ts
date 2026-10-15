import type { CostGroup } from "@/lib/cpa";

export type SegmentKey = CostGroup | "ganancia" | "cpa";

// Orden de la barra apilada (izquierda → derecha) = ranuras categóricas 6 → 1,
// así cada par vecino es un par validado para daltonismo.
export const SEGMENT_COLOR: Record<SegmentKey, string> = {
  producto: "var(--color-s6)",
  flete: "var(--color-s5)",
  riesgo: "var(--color-s4)",
  operacion: "var(--color-s3)",
  ganancia: "var(--color-s2)",
  cpa: "var(--color-s1)",
};

export const TIER_COLOR = {
  min: "var(--color-z1)",
  med: "var(--color-z2)",
  max: "var(--color-z3)",
} as const;
