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
}

/** Campo numérico entero con separador de miles (89.900) que conserva la posición del cursor. */
export function AmountInput({
  value,
  onValueChange,
  prefix = "$",
  size = "md",
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

  return (
    <div
      className={cx(
        "flex items-center rounded-lg border border-line bg-surface transition-colors",
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
        className="h-full w-full min-w-0 bg-transparent px-3 text-right tabular-nums outline-none placeholder:text-muted/70"
        {...props}
      />
    </div>
  );
}
