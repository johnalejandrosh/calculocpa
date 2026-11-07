"use client";

import type { CSSProperties, Dispatch } from "react";
import { Target } from "lucide-react";
import {
  COST_GROUP_LABEL,
  effectiveAdCpa,
  normalizeRates,
  project,
  type CpaResult,
  type Product,
  type Projection,
  type ProjectionHealth,
  type Tone,
} from "@/lib/cpa";
import { formatCOP, formatInt, formatPct } from "@/lib/format";
import type { Action } from "@/lib/store";
import { AmountInput } from "./amount-input";
import { AnimatedNumber } from "./animated-number";
import { Card, CardHeader, Field, Swatch, ToneIcon, cx } from "./ui";

// Rampa categórica s3 → s5: vecinos validados para daltonismo.
const STAGE_COLOR = {
  delivered: "var(--color-s3)",
  returned: "var(--color-s4)",
  canceled: "var(--color-s5)",
} as const;

/** Escenarios de un clic; los % son de los pedidos generados. */
const PRESETS = [
  { label: "Conservador", shipped: 70, delivered: 45 },
  { label: "Realista", shipped: 80, delivered: 60 },
  { label: "Optimista", shipped: 90, delivered: 75 },
] as const;

const HEALTH_INFO: Record<ProjectionHealth, { label: string; tone: Tone }> = {
  ganancia: { label: "Cumples tu ganancia mínima", tone: "good" },
  "bajo-minimo": { label: "Ganas, pero menos que tu mínimo", tone: "serious" },
  perdida: { label: "Pérdida", tone: "critical" },
};

interface ProjectionPanelProps {
  product: Product;
  result: CpaResult;
  dispatch: Dispatch<Action>;
}

/** Proyección de ganancias según el % de pedidos que se envían, entregan, cancelan y devuelven. */
export function ProjectionPanel({ product, result, dispatch }: ProjectionPanelProps) {
  const adCpa = effectiveAdCpa(product, result);
  const projection = project(product, result, adCpa);
  const { shippedRate, deliveredRate } = normalizeRates(product.shippedRate, product.deliveredRate);
  const canceledRate = 100 - shippedRate;
  const returnedRate = shippedRate - deliveredRate;

  const update = (patch: Partial<Omit<Product, "id" | "costs">>) =>
    dispatch({ type: "update", id: product.id, patch });
  // Toda edición pasa por normalizeRates para respetar la secuencia de estados.
  const setRates = (shipped: number, delivered: number) => update(normalizeRates(shipped, delivered));

  return (
    <Card>
      <CardHeader
        title="Proyección por porcentajes"
        description="Simula qué parte de tus pedidos se envía, se entrega o se cancela y devuelve, y cuánto ganarías con tu CPA y tus costos."
      />

      <div className="@container">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 p-5 sm:p-6 @3xl:grid-cols-2 @3xl:gap-10">
          {/* Escenario */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Field id="projected-orders" label="Pedidos generados" hint="Base = 100 %">
                <AmountInput
                  id="projected-orders"
                  prefix={null}
                  value={product.projectedOrders}
                  onValueChange={(projectedOrders) => update({ projectedOrders })}
                />
              </Field>
              <Field id="projection-cpa" label="CPA por pedido" hint="El mismo del simulador">
                <AmountInput id="projection-cpa" value={adCpa} onValueChange={(value) => update({ adCpa: value })} />
              </Field>
            </div>

            <Presets shippedRate={shippedRate} deliveredRate={deliveredRate} onPick={setRates} />

            <FunnelBar projection={projection} />

            <div className="@container">
              <div className="mb-1 flex items-baseline justify-between text-xs text-muted">
                <span>Estado del pedido</span>
                <span>% de los pedidos generados</span>
              </div>
              <ul className="divide-y divide-line">
                <RateRow
                  id="rate-shipped"
                  label="Enviados"
                  hint="Salen a la transportadora"
                  rate={shippedRate}
                  count={projection.shipped}
                  onChange={(value) => setRates(value, deliveredRate)}
                />
                <RateRow
                  id="rate-delivered"
                  label="Entregas efectivas"
                  hint="El cliente recibe y paga"
                  color={STAGE_COLOR.delivered}
                  rate={deliveredRate}
                  count={projection.delivered}
                  onChange={(value) => setRates(Math.max(shippedRate, value), value)}
                />
                <RateRow
                  id="rate-canceled"
                  label="Cancelaciones"
                  hint="Se cancelan antes de enviar"
                  color={STAGE_COLOR.canceled}
                  rate={canceledRate}
                  count={projection.canceled}
                  onChange={(value) => setRates(100 - value, deliveredRate)}
                />
                <RateRow
                  id="rate-returned"
                  label="Devoluciones"
                  hint="Se envían y regresan"
                  color={STAGE_COLOR.returned}
                  rate={returnedRate}
                  max={shippedRate}
                  count={projection.returned}
                  onChange={(value) => setRates(shippedRate, shippedRate - value)}
                />
                <li className="flex items-center gap-3 py-3 text-sm">
                  <span className="min-w-0 flex-1 font-medium">Cancelaciones y devoluciones</span>
                  <span className="w-20 text-right font-semibold tabular-nums">{formatRate(100 - deliveredRate)}</span>
                  <span className="hidden w-24 text-right text-muted tabular-nums @md:block">
                    {formatInt(projection.canceled + projection.returned)} pedidos
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Resultado: en dos columnas si queda ancho debajo del escenario. */}
          <div className="@container">
            <div className="grid gap-5 @xl:grid-cols-2 @xl:items-start">
              <div className="space-y-5">
                <ProfitHero projection={projection} />
                <ProfitBreakdown projection={projection} product={product} result={result} adCpa={adCpa} />
              </div>
              <div className="space-y-5">
                <Goals projection={projection} shippedRate={shippedRate} adCpa={adCpa} />
                <RiskNote projection={projection} configured={result.groups.riesgo} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

const formatRate = (rate: number) => formatPct(rate / 100);

function Presets({
  shippedRate,
  deliveredRate,
  onPick,
}: {
  shippedRate: number;
  deliveredRate: number;
  onPick: (shipped: number, delivered: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted">Escenario rápido</span>
      <div role="group" aria-label="Escenario rápido" className="flex rounded-lg bg-surface-2 p-0.5">
        {PRESETS.map((preset) => {
          const active = preset.shipped === shippedRate && preset.delivered === deliveredRate;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              title={`Envíos ${preset.shipped} % · Entregas ${preset.delivered} %`}
              onClick={() => onPick(preset.shipped, preset.delivered)}
              className={cx(
                "h-7 rounded-md px-2.5 text-xs font-medium transition-[color,background-color,box-shadow,scale] duration-200 active:scale-[0.97]",
                "focus-visible:outline-2 focus-visible:outline-accent",
                active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FunnelBar({ projection }: { projection: Projection }) {
  const stages = [
    { key: "delivered", label: "Entregados", value: projection.delivered },
    { key: "returned", label: "Devueltos", value: projection.returned },
    { key: "canceled", label: "Cancelados", value: projection.canceled },
  ] as const;
  const total = projection.orders;

  return (
    <figure>
      <div
        role="img"
        aria-label={`De ${formatInt(total)} pedidos: ${stages.map((s) => `${formatInt(s.value)} ${s.label.toLowerCase()}`).join(", ")}`}
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2"
      >
        {total > 0 &&
          stages.map((stage, index) => (
            <div
              key={stage.key}
              title={`${stage.label}: ${formatInt(stage.value)} (${formatPct(stage.value / total)})`}
              className="min-w-0 transition-[flex-grow,margin] duration-500 ease-out-expo"
              style={{
                flex: `${stage.value} 1 0`,
                marginLeft: index > 0 && stage.value > 0 ? 2 : 0,
                background: STAGE_COLOR[stage.key],
              }}
            />
          ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {stages.map((stage) => (
          <span key={stage.key} className="flex items-center gap-1.5">
            <Swatch color={STAGE_COLOR[stage.key]} />
            {stage.label}
            <span className="text-muted tabular-nums">{total > 0 ? formatPct(stage.value / total) : "—"}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function RateRow({
  id,
  label,
  hint,
  color,
  rate,
  max = 100,
  count,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  color?: string;
  rate: number;
  max?: number;
  count: number;
  onChange: (rate: number) => void;
}) {
  const set = (value: number) => onChange(Math.min(max, Math.max(0, value)));

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 @md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto_auto]">
      <label htmlFor={id} className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          {color && <Swatch color={color} />}
          {label}
        </span>
        <span className="block truncate text-xs text-muted">
          {hint}
          <span className="tabular-nums @md:hidden"> · {formatInt(count)} pedidos</span>
        </span>
      </label>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={rate}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={`${label} (% de los pedidos)`}
        aria-valuetext={`${formatRate(rate)} · ${formatInt(count)} pedidos`}
        style={{ "--fill": `${rate}%` } as CSSProperties}
        className="range-input col-span-2 row-start-2 w-full @md:col-span-1 @md:row-start-auto"
      />
      <div className="flex h-9 w-20 items-center rounded-lg border border-line bg-surface text-sm shadow-xs transition-[border-color,box-shadow] hover:border-line-strong focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={String(rate)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
            set(digits === "" ? 0 : Number(digits));
          }}
          onFocus={(e) => e.target.select()}
          className="h-full w-full min-w-0 bg-transparent pl-3 text-right font-medium tabular-nums outline-none"
        />
        <span aria-hidden className="pr-3 pl-1 text-muted select-none">
          %
        </span>
      </div>
      <span className="hidden w-24 text-right text-sm text-ink-2 tabular-nums @md:block">
        {formatInt(count)} pedidos
      </span>
    </li>
  );
}

function ProfitHero({ projection }: { projection: Projection }) {
  if (projection.orders === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-ink-2">
        Ingresa cuántos pedidos generas para ver la proyección.
      </div>
    );
  }

  const info = HEALTH_INFO[projection.health];
  const overGoal = projection.netProfit - projection.minProfitGoal;

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="text-xs font-medium text-muted">
        Ganancia neta proyectada · {formatInt(projection.orders)} pedidos
      </p>
      <AnimatedNumber
        value={projection.netProfit}
        format={formatCOP}
        className="mt-1 block text-4xl font-semibold tracking-tighter tabular-nums"
      />
      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
        <ToneIcon tone={info.tone} className="size-4" />
        {info.label}
      </p>
      <p className="mt-1 text-xs text-ink-2">
        {overGoal >= 0 ? `+${formatCOP(overGoal)} sobre` : `${formatCOP(overGoal)} frente a`} tu ganancia mínima de{" "}
        {formatCOP(projection.minProfitGoal)} ({formatInt(projection.delivered)} entregas).
      </p>
    </div>
  );
}

function ProfitBreakdown({
  projection,
  product,
  result,
  adCpa,
}: {
  projection: Projection;
  product: Product;
  result: CpaResult;
  adCpa: number;
}) {
  const { delivered, shipped, orders } = projection;
  const rows = [
    { label: "Ingresos", detail: `${formatInt(delivered)} entregas × ${formatCOP(product.price)}`, value: projection.revenue },
    { label: "Pauta (CPA)", detail: `${formatInt(orders)} pedidos × ${formatCOP(adCpa)}`, value: -projection.adSpend },
    {
      label: COST_GROUP_LABEL.producto,
      detail: `${formatInt(delivered)} entregas × ${formatCOP(result.groups.producto)}`,
      value: -projection.supplier,
    },
    {
      label: COST_GROUP_LABEL.flete,
      detail: `${formatInt(shipped)} envíos × ${formatCOP(result.groups.flete)}`,
      value: -projection.freight,
    },
    {
      label: COST_GROUP_LABEL.operacion,
      detail: `${formatInt(delivered)} entregas × ${formatCOP(result.groups.operacion)}`,
      value: -projection.operating,
    },
  ];
  const margin = projection.revenue > 0 ? projection.netProfit / projection.revenue : null;

  return (
    <div>
      <h3 className="text-sm font-semibold">Desglose de la proyección</h3>
      <dl className="mt-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-3 border-b border-line py-2">
            <dt className="min-w-0 flex-1">
              <span className="text-ink-2">{row.label}</span>
              <span className="block truncate text-xs text-muted tabular-nums">{row.detail}</span>
            </dt>
            <dd className="font-medium tabular-nums">
              {row.value < 0 ? `− ${formatCOP(-row.value)}` : formatCOP(row.value)}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline gap-3 pt-2.5">
          <dt className="flex-1 font-semibold">Ganancia neta</dt>
          <dd className="font-semibold tabular-nums">{formatCOP(projection.netProfit)}</dd>
        </div>
        <div className="flex items-baseline gap-3 pt-1 text-xs text-muted">
          <dt className="flex-1">Por entrega · margen sobre ingresos</dt>
          <dd className="tabular-nums">
            {projection.profitPerDelivery === null ? "—" : formatCOP(projection.profitPerDelivery)} ·{" "}
            {margin === null ? "—" : formatPct(margin)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Goals({ projection, shippedRate, adCpa }: { projection: Projection; shippedRate: number; adCpa: number }) {
  const unreachable = `No se alcanza ni entregando todo lo enviado (${formatRate(shippedRate)})`;
  const items = [
    {
      label: "Para no perder dinero",
      value: projection.breakEvenRate === null ? null : formatPct(projection.breakEvenRate),
    },
    {
      label: "Para tu ganancia mínima",
      value: projection.goalRate === null ? null : formatPct(projection.goalRate),
    },
  ];
  const cpaOk = adCpa <= projection.maxCpaPerOrder;

  return (
    <div className="rounded-xl border border-line p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Target aria-hidden className="size-4 text-muted" />
        % de entregas que necesitas
      </h3>
      <dl className="mt-3 space-y-2.5 text-sm">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-2">{item.label}</dt>
            <dd
              className={cx(
                "text-right tabular-nums",
                item.value ? "font-semibold whitespace-nowrap" : "text-xs text-critical-ink",
              )}
            >
              {item.value ? `≥ ${item.value}` : unreachable}
            </dd>
          </div>
        ))}
        {projection.orders > 0 && (
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
            <dt className="text-ink-2">CPA máximo por pedido</dt>
            <dd className="text-right">
              <span className="font-semibold tabular-nums">{formatCOP(Math.max(0, projection.maxCpaPerOrder))}</span>
              <span className={cx("block text-xs", cpaOk ? "text-good-ink" : "text-critical-ink")}>
                Tu CPA: {formatCOP(adCpa)}
              </span>
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-muted">
        % de los pedidos generados que deben entregarse, manteniendo el % de envíos actual.
      </p>
    </div>
  );
}

function RiskNote({ projection, configured }: { projection: Projection; configured: number }) {
  if (projection.riskPerDelivery === null) return null;
  const real = projection.riskPerDelivery;
  const diff = real - configured;

  return (
    <p className="rounded-xl bg-surface-2 p-4 text-xs leading-relaxed text-ink-2">
      Con estos porcentajes, las cancelaciones y devoluciones cuestan{" "}
      <strong className="font-semibold text-ink">{formatCOP(real)} por entrega</strong> (pauta de pedidos no
      entregados y fletes de devoluciones). En el cálculo por precio tienes {formatCOP(configured)} en “
      {COST_GROUP_LABEL.riesgo}”; aquí no se suman para no contarlos dos veces.
      {Math.abs(diff) >= 1 && (
        <>
          {" "}
          {diff > 0
            ? `Para que tu CPA máximo refleje este escenario, esos costos deberían sumar ${formatCOP(real)}.`
            : `En este escenario podrías bajarlos a ${formatCOP(real)}.`}
        </>
      )}
    </p>
  );
}
