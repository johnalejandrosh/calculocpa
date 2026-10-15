"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { CpaResult, Product } from "@/lib/cpa";
import { formatCOP, formatCompactCOP, formatPct, formatRoas } from "@/lib/format";
import { TIER_COLOR } from "./palette";
import { Card, CardHeader, Swatch, ToneIcon, cx } from "./ui";

type SortKey = "name" | "price" | "operating" | "cpaMax" | "roasMax" | "cpaShare";
type Sort = { key: SortKey; dir: 1 | -1 };
type Row = { product: Product; result: CpaResult };

const ROW_HEIGHT = 40; // px, igual a h-10

function sortValue(row: Row, key: SortKey): string | number | null {
  switch (key) {
    case "name":
      return row.product.name.toLowerCase();
    case "price":
      return row.product.price;
    case "roasMax":
      return row.result.roasMax;
    default:
      return row.result[key];
  }
}

function sortRows(rows: Row[], sort: Sort): Row[] {
  return [...rows].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // sin ROAS al final
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  });
}

function niceTicks(max: number, count = 4) {
  if (max <= 0) return { top: 10_000, ticks: [0, 5_000, 10_000] };
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, ticks };
}

interface ComparisonProps {
  products: Product[];
  results: Map<string, CpaResult>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Comparison({ products, results, selectedId, onSelect }: ComparisonProps) {
  const [sort, setSort] = useState<Sort>({ key: "cpaMax", dir: -1 });
  const rows = sortRows(
    products.flatMap((product) => {
      const result = results.get(product.id);
      return result ? [{ product, result }] : [];
    }),
    sort,
  );

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 1 ? -1 : 1 }
        : { key, dir: key === "name" ? 1 : -1 },
    );
  }

  return (
    <Card>
      <CardHeader
        title="Comparativo de productos"
        description="Todos tus productos lado a lado, como en la hoja de cálculo. Haz clic en uno para editarlo."
      />
      <div className="space-y-8 p-5 sm:p-6">
        <Summary rows={rows} />
        <CpaChart rows={rows} selectedId={selectedId} onSelect={onSelect} />
        <ComparisonTable rows={rows} sort={sort} onSort={toggleSort} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </Card>
  );
}

function Summary({ rows }: { rows: Row[] }) {
  const viable = rows.filter((row) => row.result.viable);
  const average = viable.length
    ? viable.reduce((sum, row) => sum + row.result.cpaMax, 0) / viable.length
    : null;
  const best = viable.reduce<Row | null>(
    (top, row) => (!top || row.result.cpaShare > top.result.cpaShare ? row : top),
    null,
  );

  const tiles = [
    { label: "Productos", value: String(rows.length) },
    { label: "Rentables", value: `${viable.length} de ${rows.length}` },
    { label: "CPA máx. promedio", value: average === null ? "—" : formatCOP(average) },
    {
      label: "Más margen para pauta",
      value: best ? best.product.name || "Sin nombre" : "—",
      note: best ? `${formatPct(best.result.cpaShare)} del precio` : undefined,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="min-w-0 rounded-xl bg-surface-2 px-4 py-3">
          <dt className="text-xs font-medium text-muted">{tile.label}</dt>
          <dd className="mt-1 truncate text-xl font-semibold tracking-tight">{tile.value}</dd>
          {tile.note && <dd className="text-xs text-muted">{tile.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

const ZONES = [
  { key: "min", label: "Hasta CPA mínimo", color: TIER_COLOR.min, grow: 1 },
  { key: "med", label: "Hasta CPA medio", color: TIER_COLOR.med, grow: 1 },
  { key: "max", label: "Hasta CPA máximo", color: TIER_COLOR.max, grow: 2 },
] as const;

function CpaChart({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Row[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const { top, ticks } = niceTicks(Math.max(0, ...rows.map((row) => row.result.cpaMax)));
  const hoveredIndex = rows.findIndex((row) => row.product.id === hovered);
  const hoveredRow = hoveredIndex >= 0 ? rows[hoveredIndex] : null;

  return (
    <figure>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="text-sm font-semibold">CPA por producto</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {ZONES.map((zone) => (
            <span key={zone.key} className="flex items-center gap-1.5">
              <Swatch color={zone.color} />
              {zone.label}
            </span>
          ))}
        </span>
      </figcaption>

      <div className="mt-4 grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
        {/* Nombres */}
        <ul>
          {rows.map(({ product }) => (
            <li key={product.id} className="h-10">
              <button
                type="button"
                onClick={() => onSelect(product.id)}
                onMouseEnter={() => setHovered(product.id)}
                onMouseLeave={() => setHovered(null)}
                className={cx(
                  "flex h-full w-full items-center truncate rounded-md px-2 text-left text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-accent",
                  hovered === product.id && "bg-surface-2",
                  product.id === selectedId ? "font-semibold text-ink" : "text-ink-2",
                )}
              >
                <span className="truncate">{product.name || "Sin nombre"}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Área de trazado: el margen derecho deja espacio a la etiqueta de valor */}
        <div className="relative mr-20">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {ticks.map((tick) => (
              <div
                key={tick}
                className={cx("absolute inset-y-0 w-px", tick === 0 ? "bg-line-strong" : "bg-line")}
                style={{ left: `${(tick / top) * 100}%` }}
              />
            ))}
          </div>

          {rows.map(({ product, result }) => (
            <div
              key={product.id}
              onMouseEnter={() => setHovered(product.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(product.id)}
              className="relative flex h-10 cursor-pointer items-center"
            >
              {result.viable ? (
                <>
                  <div
                    className={cx(
                      "flex h-4 gap-[2px] transition-opacity",
                      hovered && hovered !== product.id && "opacity-40",
                    )}
                    style={{ width: `${(result.cpaMax / top) * 100}%` }}
                  >
                    {ZONES.map((zone) => (
                      <div
                        key={zone.key}
                        className="min-w-px last:rounded-r-[4px]"
                        style={{ flex: `${zone.grow} 1 0`, background: zone.color }}
                      />
                    ))}
                  </div>
                  <span
                    className="absolute text-xs font-medium whitespace-nowrap tabular-nums"
                    style={{ left: `calc(${(result.cpaMax / top) * 100}% + 8px)` }}
                  >
                    {formatCOP(result.cpaMax)}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1.5 pl-2 text-xs text-ink-2">
                  <ToneIcon tone="critical" className="size-3.5" />
                  No rentable
                </span>
              )}
            </div>
          ))}

          {hoveredRow?.result.viable && (
            <div
              role="tooltip"
              className={cx(
                "pointer-events-none absolute z-10 w-52 rounded-lg border border-line bg-surface p-3 text-xs shadow-lg",
                // En las primeras filas se abre hacia abajo para no tapar la leyenda.
                hoveredIndex >= 2 && "-translate-y-full",
              )}
              style={{
                top: hoveredIndex >= 2 ? hoveredIndex * ROW_HEIGHT + 4 : (hoveredIndex + 1) * ROW_HEIGHT - 4,
                left: `clamp(0px, calc(${(hoveredRow.result.cpaMax / top) * 100}% - 6.5rem), calc(100% - 13rem))`,
              }}
            >
              <p className="mb-1.5 truncate font-semibold">{hoveredRow.product.name || "Sin nombre"}</p>
              {[
                { label: "CPA máximo", value: hoveredRow.result.cpaMax, color: TIER_COLOR.max },
                { label: "CPA medio", value: hoveredRow.result.cpaMed, color: TIER_COLOR.med },
                { label: "CPA mínimo", value: hoveredRow.result.cpaMin, color: TIER_COLOR.min },
              ].map((item) => (
                <p key={item.label} className="flex items-center gap-2 py-0.5">
                  <Swatch color={item.color} />
                  <span className="flex-1 text-ink-2">{item.label}</span>
                  <span className="font-medium tabular-nums">{formatCOP(item.value)}</span>
                </p>
              ))}
              <p className="mt-1.5 flex justify-between border-t border-line pt-1.5 text-ink-2">
                ROAS objetivo <span className="font-medium text-ink tabular-nums">{formatRoas(hoveredRow.result.roasMax)}</span>
              </p>
            </div>
          )}

          <div aria-hidden className="relative mt-1 h-4 text-[11px] text-muted tabular-nums">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${(tick / top) * 100}%` }}
              >
                {formatCompactCOP(tick)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      className={cx("px-3 py-2 font-medium", align === "left" ? "text-left" : "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cx(
          "inline-flex items-center gap-1 rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-accent",
          active && "text-ink",
        )}
      >
        {label}
        <Icon aria-hidden className={cx("size-3", !active && "opacity-50")} />
      </button>
    </th>
  );
}

function ComparisonTable({
  rows,
  sort,
  onSort,
  selectedId,
  onSelect,
}: {
  rows: Row[];
  sort: Sort;
  onSort: (key: SortKey) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const plain = "px-3 py-2 text-right font-medium";
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-y border-line bg-surface-2 text-xs text-muted">
            <SortHeader label="Producto" sortKey="name" sort={sort} onSort={onSort} align="left" />
            <SortHeader label="Venta" sortKey="price" sort={sort} onSort={onSort} />
            <SortHeader label="Gastos operativos" sortKey="operating" sort={sort} onSort={onSort} />
            <SortHeader label="CPA máx." sortKey="cpaMax" sort={sort} onSort={onSort} />
            <th scope="col" className={plain}>CPA med.</th>
            <th scope="col" className={plain}>CPA mín.</th>
            <SortHeader label="ROAS objetivo" sortKey="roasMax" sort={sort} onSort={onSort} />
            <SortHeader label="% del precio" sortKey="cpaShare" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, result }) => {
            const selected = product.id === selectedId;
            return (
              <tr
                key={product.id}
                onClick={() => onSelect(product.id)}
                className={cx(
                  "cursor-pointer border-b border-line tabular-nums transition-colors last:border-0",
                  selected ? "bg-accent-soft" : "hover:bg-surface-2",
                )}
              >
                <th scope="row" className="max-w-56 px-3 py-2.5 text-left font-medium">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(product.id);
                    }}
                    className="block max-w-full truncate rounded text-left focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {product.name || "Sin nombre"}
                  </button>
                </th>
                <td className="px-3 py-2.5 text-right">{formatCOP(product.price)}</td>
                <td className="px-3 py-2.5 text-right">{formatCOP(result.operating)}</td>
                <td className="px-3 py-2.5 text-right font-semibold">
                  {result.viable ? (
                    formatCOP(result.cpaMax)
                  ) : (
                    <span className="inline-flex items-center gap-1 font-normal text-ink-2">
                      <ToneIcon tone="critical" className="size-3.5" />
                      {formatCOP(result.cpaMax)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-ink-2">{result.viable ? formatCOP(result.cpaMed) : "—"}</td>
                <td className="px-3 py-2.5 text-right text-ink-2">{result.viable ? formatCOP(result.cpaMin) : "—"}</td>
                <td className="px-3 py-2.5 text-right">{formatRoas(result.roasMax)}</td>
                <td className="px-3 py-2.5 text-right text-ink-2">{result.viable ? formatPct(result.cpaShare) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
