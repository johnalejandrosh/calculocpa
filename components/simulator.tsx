"use client";

import type { Dispatch } from "react";
import {
  HEALTH,
  effectiveAdCpa,
  simulate,
  type CpaResult,
  type Health,
  type Product,
} from "@/lib/cpa";
import { formatCOP, formatRoas } from "@/lib/format";
import type { Action } from "@/lib/store";
import { AmountInput } from "./amount-input";
import { Card, CardHeader, Field, Swatch, ToneIcon, cx } from "./ui";

interface Zone {
  health: Health;
  from: number;
  to: number;
  color: string;
}

const ZONE_COLOR: Record<Health, string> = {
  excelente: "var(--color-good)",
  saludable: "color-mix(in oklab, var(--color-good) 45%, var(--color-surface))",
  limite: "var(--color-warning)",
  "bajo-minimo": "var(--color-serious)",
  perdida: "var(--color-critical)",
};

function buildZones(result: CpaResult): Zone[] {
  const breakEven = Math.max(0, result.breakEven);
  const bounds: Array<[Health, number, number]> = result.viable
    ? [
        ["excelente", 0, result.cpaMin],
        ["saludable", result.cpaMin, result.cpaMed],
        ["limite", result.cpaMed, result.cpaMax],
        ["bajo-minimo", result.cpaMax, breakEven],
      ]
    : [["bajo-minimo", 0, breakEven]];
  bounds.push(["perdida", breakEven, Infinity]);
  return bounds
    .filter(([, from, to]) => to > from)
    .map(([health, from, to]) => ({ health, from, to, color: ZONE_COLOR[health] }));
}

function zoneRange(zone: Zone) {
  if (zone.to === Infinity) return `más de ${formatCOP(zone.from)}`;
  if (zone.from === 0) return `hasta ${formatCOP(zone.to)}`;
  return `${formatCOP(zone.from)} – ${formatCOP(zone.to)}`;
}

interface SimulatorProps {
  product: Product;
  result: CpaResult;
  dispatch: Dispatch<Action>;
}

export function Simulator({ product, result, dispatch }: SimulatorProps) {
  const adCpa = effectiveAdCpa(product, result);
  const sim = simulate(result, adCpa);
  const health = HEALTH[sim.health];
  const zones = buildZones(result);
  const scaleMax = Math.ceil(Math.max(result.breakEven * 1.2, adCpa, result.price * 0.1, 1_000) / 1_000) * 1_000;
  const orders = product.monthlyOrders;

  const setAdCpa = (value: number) =>
    dispatch({ type: "update", id: product.id, patch: { adCpa: value } });

  return (
    <Card>
      <CardHeader
        title="Simulador de pauta"
        description="Ingresa lo que realmente te está costando cada venta en publicidad y mira si tu campaña es rentable."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Field id="ad-cpa" label="CPA real de tu campaña" hint="Gasto en pauta ÷ ventas">
            <AmountInput id="ad-cpa" size="lg" value={adCpa} onValueChange={setAdCpa} />
          </Field>

          <div>
            <div className="relative h-8">
              {/* Pista de zonas, recortada por el radio del control para que el pulgar caiga en su valor. */}
              <div aria-hidden className="absolute inset-x-[10px] top-1/2 flex h-2.5 -translate-y-1/2 gap-[2px]">
                {zones.map((zone) => (
                  <div
                    key={zone.health}
                    className="first:rounded-l-full last:rounded-r-full"
                    style={{
                      flex: `${Math.min(zone.to, scaleMax) - Math.min(zone.from, scaleMax)} 1 0`,
                      background: zone.color,
                    }}
                  />
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={scaleMax}
                step={100}
                value={Math.min(adCpa, scaleMax)}
                onChange={(e) => setAdCpa(Number(e.target.value))}
                aria-label="CPA real de tu campaña"
                aria-valuetext={formatCOP(adCpa)}
                className="cpa-range absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2"
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted tabular-nums">
              <span>$ 0</span>
              <span>{formatCOP(scaleMax)}</span>
            </div>
          </div>

          <ul className="space-y-0.5 text-sm">
            {zones.map((zone) => {
              const current = zone.health === sim.health;
              return (
                <li
                  key={zone.health}
                  aria-current={current ? "true" : undefined}
                  className={cx(
                    "flex items-center gap-3 rounded-md px-2.5 py-1.5",
                    current ? "bg-surface-2 font-medium" : "text-ink-2",
                  )}
                >
                  <Swatch color={zone.color} className="h-2.5 w-4 rounded-full" />
                  <span className="flex-1">{HEALTH[zone.health].label}</span>
                  <span className="text-xs tabular-nums text-muted">{zoneRange(zone)}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-line bg-surface-2 p-4" role="status">
            <ToneIcon tone={health.tone} className="mt-0.5 size-5" />
            <div>
              <p className="font-semibold">{health.label}</p>
              <p className="mt-0.5 text-sm text-ink-2">{health.hint}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Ganancia por venta"
              value={formatCOP(sim.profit)}
              delta={
                sim.overMin >= 0
                  ? { text: `+${formatCOP(sim.overMin)} sobre tu mínimo`, good: true }
                  : { text: `${formatCOP(sim.overMin)} bajo tu mínimo`, good: false }
              }
            />
            <Stat
              label="ROAS real"
              value={formatRoas(sim.roas)}
              note={result.viable ? `Objetivo ≥ ${formatRoas(result.roasMax)}` : undefined}
            />
          </div>

          <div className="rounded-xl border border-line p-4">
            <Field id="orders" label="Ventas al mes" hint="Para proyectar el mes">
              <AmountInput
                id="orders"
                prefix={null}
                value={orders}
                onValueChange={(monthlyOrders) =>
                  dispatch({ type: "update", id: product.id, patch: { monthlyOrders } })
                }
              />
            </Field>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
              <ProjectionRow label="Facturación" value={orders ? formatCOP(orders * result.price) : "—"} />
              <ProjectionRow label="Inversión en pauta" value={orders ? formatCOP(orders * adCpa) : "—"} />
              <ProjectionRow label="Ganancia neta" value={orders ? formatCOP(orders * sim.profit) : "—"} />
            </dl>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  note,
  delta,
}: {
  label: string;
  value: string;
  note?: string;
  delta?: { text: string; good: boolean };
}) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {delta && (
        <p className={cx("mt-1 text-xs font-medium", delta.good ? "text-good-ink" : "text-critical-ink")}>
          {delta.text}
        </p>
      )}
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function ProjectionRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
