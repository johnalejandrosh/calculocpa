"use client";

import { useState } from "react";
import { COST_GROUP_LABEL, type CpaResult } from "@/lib/cpa";
import { formatCOP, formatPct } from "@/lib/format";
import { SEGMENT_COLOR, type SegmentKey } from "./palette";
import { Swatch, cx } from "./ui";

interface Segment {
  key: SegmentKey;
  label: string;
  value: number;
}

/** Barra apilada: a dónde se va cada peso del precio de venta. */
export function CostBreakdown({ result, minProfit }: { result: CpaResult; minProfit: number }) {
  const [active, setActive] = useState<SegmentKey | null>(null);

  const segments: Segment[] = [
    { key: "producto", label: COST_GROUP_LABEL.producto, value: result.groups.producto },
    { key: "flete", label: COST_GROUP_LABEL.flete, value: result.groups.flete },
    { key: "riesgo", label: COST_GROUP_LABEL.riesgo, value: result.groups.riesgo },
    { key: "operacion", label: COST_GROUP_LABEL.operacion, value: result.groups.operacion },
    { key: "ganancia", label: "Ganancia mínima", value: minProfit },
    { key: "cpa", label: "Disponible para pauta (CPA máx.)", value: Math.max(0, result.cpaMax) },
  ];
  const drawn = segments.filter((s) => s.value > 0);
  // Si los costos superan la venta, la escala es el total y se marca dónde queda el precio.
  const scale = Math.max(result.price, result.operating, 1);
  const overflow = result.operating > result.price;
  const share = (value: number) => (result.price > 0 ? formatPct(value / result.price) : "—");

  let tooltip: { segment: Segment; center: number } | null = null;
  let offset = 0;
  for (const segment of drawn) {
    if (segment.key === active) {
      tooltip = { segment, center: ((offset + segment.value / 2) / scale) * 100 };
    }
    offset += segment.value;
  }

  return (
    <figure className="mt-8">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">¿A dónde va cada venta?</span>
        <span className="text-xs text-muted">% del precio de venta</span>
      </figcaption>

      <div className="relative mt-3">
        <div
          role="img"
          aria-label="Distribución del precio de venta entre costos, ganancia y CPA"
          className="flex h-7 w-full gap-[2px] overflow-hidden rounded-[4px] bg-surface-2"
        >
          {drawn.map((segment) => (
            <div
              key={segment.key}
              onMouseEnter={() => setActive(segment.key)}
              onMouseLeave={() => setActive(null)}
              className="min-w-[3px] transition-opacity duration-150"
              style={{
                flex: `${segment.value} 1 0`,
                background: SEGMENT_COLOR[segment.key],
                opacity: active && active !== segment.key ? 0.3 : 1,
              }}
            />
          ))}
        </div>

        {overflow && result.price > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-y-1.5 w-0.5 rounded-full bg-ink"
            style={{ left: `${(result.price / scale) * 100}%` }}
          >
            <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 text-[11px] font-medium whitespace-nowrap">
              Precio
            </span>
          </div>
        )}

        {tooltip && (
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-lg"
            style={{ left: `clamp(5.5rem, ${tooltip.center}%, calc(100% - 5.5rem))` }}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Swatch color={SEGMENT_COLOR[tooltip.segment.key]} />
              {tooltip.segment.label}
            </span>
            <span className="mt-0.5 block text-ink-2 tabular-nums">
              {formatCOP(tooltip.segment.value)} · {share(tooltip.segment.value)}
            </span>
          </div>
        )}
      </div>

      <ul className={cx("divide-y divide-line text-sm", overflow ? "mt-7" : "mt-4")}>
        {segments.map((segment) => (
          <li
            key={segment.key}
            onMouseEnter={() => setActive(segment.key)}
            onMouseLeave={() => setActive(null)}
            className={cx(
              "-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors",
              active === segment.key && "bg-surface-2",
              segment.value === 0 && "opacity-50",
            )}
          >
            <Swatch color={SEGMENT_COLOR[segment.key]} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{segment.label}</span>
            <span className="font-medium tabular-nums">{formatCOP(segment.value)}</span>
            <span className="w-14 text-right text-muted tabular-nums">{share(segment.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
