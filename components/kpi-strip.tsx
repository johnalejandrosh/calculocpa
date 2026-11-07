"use client";

import { ArrowUpRight, Calculator, ChartColumn, Gauge, Percent, type LucideIcon } from "lucide-react";
import {
  HEALTH,
  effectiveAdCpa,
  project,
  simulate,
  type CpaResult,
  type Product,
  type Tone,
} from "@/lib/cpa";
import { formatCOP, formatInt, formatPct, formatRoas } from "@/lib/format";
import { AnimatedNumber } from "./animated-number";
import { ToneIcon, cx } from "./ui";

interface Kpi {
  label: string;
  icon: LucideIcon;
  /** Sección a la que lleva el indicador. */
  target: string;
  value: number | null;
  format: (n: number) => string;
  /** Nota corta bajo el valor; `detail` amplía al pasar el mouse. */
  note: string;
  detail?: string;
  tone?: Tone;
}

const PROJECTION_LABEL = {
  ganancia: "Cumples tu mínimo",
  "bajo-minimo": "Bajo tu mínimo",
  perdida: "Pérdida",
} as const;
const PROJECTION_TONE = { ganancia: "good", "bajo-minimo": "serious", perdida: "critical" } as const;

/** Resumen del producto activo: un vistazo a cada sección del panel. */
export function KpiStrip({ product, result }: { product: Product; result: CpaResult }) {
  const adCpa = effectiveAdCpa(product, result);
  const sim = simulate(result, adCpa);
  const projection = project(product, result, adCpa);

  const kpis: Kpi[] = [
    {
      label: "CPA máximo",
      icon: Calculator,
      target: "editor",
      value: result.cpaMax,
      format: formatCOP,
      note: result.viable ? `${formatPct(result.cpaShare)} del precio` : "No rentable",
      detail: "Lo máximo que puedes pagar en pauta por venta y aún ganar tu mínimo.",
      tone: result.viable ? undefined : "critical",
    },
    {
      label: "Proyección",
      icon: Percent,
      target: "proyeccion",
      value: projection.orders > 0 ? projection.netProfit : null,
      format: formatCOP,
      note: projection.orders > 0 ? PROJECTION_LABEL[projection.health] : "Sin pedidos",
      detail: `Ganancia neta con ${formatInt(projection.delivered)} entregas de ${formatInt(projection.orders)} pedidos generados.`,
      tone: projection.orders > 0 ? PROJECTION_TONE[projection.health] : undefined,
    },
    {
      label: "Ganancia por venta",
      icon: Gauge,
      target: "simulador",
      value: sim.profit,
      format: formatCOP,
      note: HEALTH[sim.health].label,
      detail: `Con un CPA real de ${formatCOP(adCpa)}.`,
      tone: HEALTH[sim.health].tone,
    },
    {
      label: "ROAS objetivo",
      icon: ChartColumn,
      target: "comparativo",
      value: result.roasMax,
      format: formatRoas,
      note: sim.roas === null ? "Sin CPA real" : `Real: ${formatRoas(sim.roas)}`,
      detail: "Retorno mínimo que debe mostrar tu campaña para no superar el CPA máximo.",
    },
  ];

  return (
    <div className="@container animate-enter">
      <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        {kpis.map((kpi) => (
          <li key={kpi.label} className="min-w-0">
            <button
              type="button"
              title={kpi.detail}
              onClick={() =>
                document.getElementById(kpi.target)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className={cx(
                "group flex h-full w-full flex-col rounded-xl border border-line bg-surface p-4 text-left shadow-card",
                "transition-[border-color,box-shadow,translate] duration-200 ease-out-expo",
                "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              )}
            >
              <span className="flex items-center gap-2 text-xs font-medium text-muted">
                <kpi.icon aria-hidden className="hidden size-3.5 shrink-0 @md:block" />
                <span className="truncate">{kpi.label}</span>
                <ArrowUpRight
                  aria-hidden
                  className="ml-auto size-3.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </span>
              <span className="mt-2 truncate text-xl font-semibold tracking-tight tabular-nums @3xl:text-2xl">
                {kpi.value === null ? "—" : <AnimatedNumber value={kpi.value} format={kpi.format} />}
              </span>
              <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
                {kpi.tone && <ToneIcon tone={kpi.tone} className="size-3.5" />}
                <span className="truncate">{kpi.note}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
