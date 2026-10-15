"use client";

import type { Dispatch } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { newCost, type CostItem, type CpaResult, type Product } from "@/lib/cpa";
import { formatCOP, formatRoas } from "@/lib/format";
import type { Action } from "@/lib/store";
import { AmountInput } from "./amount-input";
import { CostBreakdown } from "./cost-breakdown";
import { SEGMENT_COLOR, TIER_COLOR } from "./palette";
import { Button, Card, Field, Swatch, ToneIcon } from "./ui";

interface ProductEditorProps {
  product: Product;
  result: CpaResult;
  dispatch: Dispatch<Action>;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function ProductEditor({ product, result, dispatch, onDuplicate, onRemove }: ProductEditorProps) {
  const update = (patch: Partial<Omit<Product, "id" | "costs">>) =>
    dispatch({ type: "update", id: product.id, patch });

  return (
    <Card id="editor" className="scroll-mt-22">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <label htmlFor="product-name" className="text-xs font-medium text-muted">
            Producto
          </label>
          <input
            id="product-name"
            value={product.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Nombre del producto"
            className="-mx-1.5 block w-[calc(100%+0.75rem)] rounded-md bg-transparent px-1.5 text-xl font-semibold tracking-tight outline-none hover:bg-surface-2 focus:bg-surface-2 focus:ring-3 focus:ring-accent/20"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onDuplicate} aria-label="Duplicar producto">
          <Copy aria-hidden />
          <span className="hidden sm:inline">Duplicar</span>
        </Button>
        <Button variant="danger" size="sm" onClick={onRemove} aria-label="Eliminar producto">
          <Trash2 aria-hidden />
          <span className="hidden sm:inline">Eliminar</span>
        </Button>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-2">
        {/* Entradas */}
        <div className="space-y-7 border-line p-5 sm:p-6 xl:border-r">
          <Field id="price" label="Precio de venta" hint="Lo que paga el cliente">
            <AmountInput
              id="price"
              size="lg"
              value={product.price}
              onValueChange={(price) => update({ price })}
            />
          </Field>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-medium">Costos por venta</h3>
              <span className="text-sm text-muted tabular-nums">{formatCOP(result.costs)}</span>
            </div>
            <ul className="space-y-1.5">
              {product.costs.map((cost) => (
                <CostRow
                  key={cost.id}
                  cost={cost}
                  onChange={(patch) =>
                    dispatch({ type: "updateCost", id: product.id, costId: cost.id, patch })
                  }
                  onRemove={() => dispatch({ type: "removeCost", id: product.id, costId: cost.id })}
                />
              ))}
            </ul>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -ml-2.5"
              onClick={() => dispatch({ type: "addCost", id: product.id, cost: newCost() })}
            >
              <Plus aria-hidden />
              Agregar costo
            </Button>
          </div>

          <Field id="min-profit" label="Ganancia mínima por venta" hint="Lo que quieres ganar sí o sí">
            <AmountInput
              id="min-profit"
              value={product.minProfit}
              onValueChange={(minProfit) => update({ minProfit })}
            />
          </Field>

          <dl className="space-y-2 rounded-xl bg-surface-2 p-4 text-sm">
            <SummaryRow label="Ingreso (venta)" value={formatCOP(result.price)} />
            <SummaryRow
              label="Gastos operativos"
              note="costos + ganancia mínima"
              value={`− ${formatCOP(result.operating)}`}
            />
            <div className="border-t border-line-strong/60 pt-2">
              <SummaryRow strong label="Total CPA" value={formatCOP(result.cpaMax)} />
            </div>
          </dl>
        </div>

        {/* Resultados */}
        <div className="p-5 sm:p-6">
          <CpaHero result={result} minProfit={product.minProfit} />
          <TierTable result={result} />
          <CostBreakdown result={result} minProfit={product.minProfit} />
        </div>
      </div>
    </Card>
  );
}

function CostRow({
  cost,
  onChange,
  onRemove,
}: {
  cost: CostItem;
  onChange: (patch: Partial<Omit<CostItem, "id">>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="group flex items-center gap-2">
      <Swatch color={SEGMENT_COLOR[cost.group]} />
      <input
        value={cost.label}
        onChange={(e) => onChange({ label: e.target.value })}
        aria-label="Concepto del costo"
        className="h-9 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm text-ink-2 outline-none hover:bg-surface-2 focus:bg-surface-2 focus:text-ink focus:ring-3 focus:ring-accent/20"
      />
      <AmountInput
        value={cost.amount}
        onValueChange={(amount) => onChange({ amount })}
        aria-label={`Monto de ${cost.label}`}
        className="w-32 shrink-0 sm:w-40"
      />
      <Button
        variant="danger"
        size="icon"
        onClick={onRemove}
        aria-label={`Quitar ${cost.label}`}
        className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}

function SummaryRow({
  label,
  note,
  value,
  strong,
}: {
  label: string;
  note?: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-semibold" : "text-ink-2"}>
        {label}
        {note && <span className="ml-1.5 text-xs text-muted">({note})</span>}
      </dt>
      <dd className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</dd>
    </div>
  );
}

function CpaHero({ result, minProfit }: { result: CpaResult; minProfit: number }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
        <Swatch color={SEGMENT_COLOR.cpa} />
        CPA máximo
      </p>
      <p className="mt-1 text-5xl font-semibold tracking-tight">{formatCOP(result.cpaMax)}</p>
      {result.viable ? (
        <p className="mt-2 max-w-md text-sm text-ink-2">
          Es lo máximo que puedes pagar en publicidad por cada venta y aún ganar{" "}
          <strong className="font-semibold text-ink">{formatCOP(minProfit)}</strong>.
        </p>
      ) : (
        <p className="mt-3 flex max-w-md gap-2 rounded-lg border border-critical/30 bg-critical/8 p-3 text-sm">
          <ToneIcon tone="critical" className="mt-0.5 size-4" />
          <span>
            <strong className="font-semibold">No rentable.</strong> Los costos más tu ganancia mínima
            superan el precio en {formatCOP(-result.cpaMax)}. Sube el precio o reduce costos.
          </span>
        </p>
      )}
    </div>
  );
}

function TierTable({ result }: { result: CpaResult }) {
  const tiers = [
    { label: "Máximo", ratio: "100 %", value: result.cpaMax, roas: result.roasMax, color: TIER_COLOR.max },
    { label: "Medio", ratio: "50 %", value: result.cpaMed, roas: result.roasMed, color: TIER_COLOR.med },
    { label: "Mínimo", ratio: "25 %", value: result.cpaMin, roas: result.roasMin, color: TIER_COLOR.min },
  ];

  return (
    <div className="mt-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th scope="col" className="py-2 text-left font-medium">Nivel de CPA</th>
            <th scope="col" className="py-2 text-right font-medium">CPA</th>
            <th scope="col" className="py-2 text-right font-medium">ROAS objetivo</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.label} className="border-b border-line last:border-0">
              <th scope="row" className="py-2.5 text-left font-medium">
                <span className="flex items-center gap-2">
                  <Swatch color={tier.color} />
                  {tier.label}
                  <span className="text-xs font-normal text-muted">{tier.ratio}</span>
                </span>
              </th>
              <td className="py-2.5 text-right font-semibold tabular-nums">
                {result.viable ? formatCOP(tier.value) : "—"}
              </td>
              <td className="py-2.5 text-right tabular-nums text-ink-2">{formatRoas(tier.roas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        ROAS objetivo = venta ÷ CPA. Es el retorno mínimo que debe mostrar tu campaña para no
        superar ese CPA.
      </p>
    </div>
  );
}
