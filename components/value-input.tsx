"use client";

import { useState } from "react";
import { valueOf } from "@/lib/cpa";
import { formatCOP } from "@/lib/format";
import { AmountInput } from "./amount-input";
import { cx } from "./ui";

export interface ValueChange {
  amount: number;
  /** `null` = monto fijo en pesos. */
  percent: number | null;
}

const percentFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;
const clampPercent = (n: number) => Math.min(100, Math.max(0, round2(n)));

interface ValueInputProps {
  /** Id del campo en pesos (el de % recibe `${id}-percent`). */
  id?: string;
  /** Nombre accesible del valor, p. ej. "Proveedor". */
  label: string;
  amount: number;
  percent: number | null;
  /** Base del porcentaje: el precio de venta. */
  base: number;
  onChange: (value: ValueChange) => void;
  className?: string;
}

/**
 * Dos campos enlazados: pesos y % del precio de venta. Se escribe en cualquiera y el otro
 * se calcula; el que se escribió manda (queda fijo si cambia el precio) y el calculado se ve en gris.
 */
export function ValueInput({ id, label, amount, percent, base, onChange, className }: ValueInputProps) {
  const isPercent = percent !== null;
  const pesos = valueOf(amount, percent, base);
  const shownPercent = isPercent ? percent : base > 0 ? clampPercent((amount / base) * 100) : 0;

  return (
    <div className={cx("flex gap-1.5", className)}>
      <AmountInput
        id={id}
        aria-label={id ? undefined : `${label} en pesos`}
        title={isPercent ? `Calculado: ${percentFormat.format(shownPercent)} % del precio de venta` : undefined}
        value={Math.round(pesos)}
        onValueChange={(value) => onChange({ amount: value, percent: null })}
        className={cx("min-w-0 flex-1", isPercent && "text-muted")}
      />
      <PercentInput
        id={id ? `${id}-percent` : undefined}
        label={label}
        value={shownPercent}
        derived={!isPercent}
        title={isPercent ? undefined : `Calculado a partir de ${formatCOP(pesos)}`}
        onValueChange={(value) => onChange({ amount: round2((base * value) / 100), percent: value })}
      />
    </div>
  );
}

/** Porcentaje con hasta dos decimales (coma decimal), entre 0 y 100. */
function PercentInput({
  id,
  label,
  value,
  derived,
  title,
  onValueChange,
}: {
  id?: string;
  label: string;
  value: number;
  /** El valor se calculó desde los pesos: se muestra atenuado. */
  derived: boolean;
  title?: string;
  onValueChange: (value: number) => void;
}) {
  // Mientras se escribe se respeta el texto ("3," no se convierte en "3").
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div
      title={title}
      className={cx(
        "flex h-9 w-[4.25rem] shrink-0 items-center rounded-lg border border-line bg-surface text-sm shadow-xs transition-[border-color,box-shadow]",
        "hover:border-line-strong focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20",
        derived && "text-muted",
      )}
    >
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        aria-label={`${label} en % del precio de venta`}
        value={draft ?? (value ? percentFormat.format(value) : "")}
        onChange={(event) => {
          const text = event.target.value.replace(/[^\d.,]/g, "").replace(".", ",");
          const [whole = "", ...rest] = text.split(",");
          const decimals = rest.join("").replace(/\D/g, "").slice(0, 2);
          const next = clampPercent(Number(`${whole.slice(0, 3) || 0}.${decimals || 0}`));
          setDraft(next === 100 ? "100" : text.includes(",") ? `${whole.slice(0, 3)},${decimals}` : whole.slice(0, 3));
          onValueChange(next);
        }}
        onFocus={(event) => event.target.select()}
        onBlur={() => setDraft(null)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const delta = (event.shiftKey ? 10 : 1) * (event.key === "ArrowUp" ? 1 : -1);
          setDraft(null);
          onValueChange(clampPercent(Math.round(value) + delta));
        }}
        className="h-full w-full min-w-0 bg-transparent pl-2 text-right tabular-nums outline-none placeholder:text-muted/70"
      />
      <span aria-hidden className="pr-2.5 pl-0.5 text-muted select-none">
        %
      </span>
    </div>
  );
}
