"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { formatInt } from "@/lib/format";
import { cx } from "./ui";

const MAX_DIGITS = 12;

interface AmountInputProps
  extends Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "size" | "prefix"> {
  value: number;
  onValueChange: (value: number) => void;
  prefix?: string | null;
  size?: "md" | "lg";
  /** Solo el `<input>`, sin caja ni prefijo, para componerlo dentro de otro campo. */
  bare?: boolean;
  /** Cuánto suben o bajan las flechas ↑/↓ (Shift = ×10). Por defecto $1.000, o 1 sin prefijo. */
  step?: number;
}

const MAX_VALUE = 10 ** MAX_DIGITS - 1;

/** Campo numérico entero con separador de miles (89.900) que conserva la posición del cursor. */
export function AmountInput({
  value,
  onValueChange,
  prefix = "$",
  size = "md",
  step = prefix === null ? 1 : 1_000,
  bare = false,
  className,
  ...props
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Cantidad de dígitos a la izquierda del cursor tras la última edición.
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const digits = caretDigits.current;
    if (!input || digits === null) return;
    caretDigits.current = null;
    let pos = 0;
    for (let seen = 0; pos < input.value.length && seen < digits; pos++) {
      if (/\d/.test(input.value[pos])) seen++;
    }
    input.setSelectionRange(pos, pos);
  });

  const input = (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      value={value ? formatInt(value) : ""}
      onChange={(event) => {
        const raw = event.target.value;
        const caret = event.target.selectionStart ?? raw.length;
        const digits = raw.replace(/\D/g, "").slice(0, MAX_DIGITS);
        const trimmed = digits.replace(/^0+/, "");
        const before = raw.slice(0, caret).replace(/\D/g, "").length;
        caretDigits.current = Math.max(0, before - (digits.length - trimmed.length));
        onValueChange(trimmed ? Number(trimmed) : 0);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const unit = step * (event.shiftKey ? 10 : 1);
        // Salta al siguiente múltiplo del paso: 89.900 ↑ → 90.000, ↓ → 89.000.
        const next =
          event.key === "ArrowUp" ? Math.floor(value / unit) * unit + unit : Math.ceil(value / unit) * unit - unit;
        onValueChange(Math.min(MAX_VALUE, Math.max(0, next)));
      }}
      className={cx(
        "h-full w-full min-w-0 bg-transparent text-right tabular-nums outline-none placeholder:text-muted/70",
        bare ? "px-1" : "px-3",
      )}
      {...props}
    />
  );

  if (bare) return input;

  return (
    <div
      className={cx(
        "flex items-center rounded-lg border border-line bg-surface shadow-xs transition-[border-color,box-shadow]",
        "hover:border-line-strong focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20",
        size === "lg" ? "h-12 text-lg font-semibold" : "h-9 text-sm",
        className,
      )}
    >
      {prefix && (
        <span aria-hidden className="pl-3 text-muted select-none">
          {prefix}
        </span>
      )}
      {input}
    </div>
  );
}
