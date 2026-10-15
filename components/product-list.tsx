"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import type { CpaResult, Product } from "@/lib/cpa";
import { formatCOP } from "@/lib/format";
import { Button, Card, ToneIcon, cx } from "./ui";

interface ProductListProps {
  products: Product[];
  results: Map<string, CpaResult>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ProductList({ products, results, selectedId, onSelect, onAdd }: ProductListProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? products.filter((p) => p.name.toLowerCase().includes(needle))
    : products;

  return (
    <Card className="flex min-h-0 flex-col lg:sticky lg:top-22 lg:max-h-[calc(100dvh-7rem)]">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Productos
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2 tabular-nums">
            {products.length}
          </span>
        </h2>
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus aria-hidden />
          Nuevo
        </Button>
      </div>

      {products.length > 0 && (
        <div className="px-3 pt-3">
          <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20">
            <Search aria-hidden className="size-4 text-muted" />
            <span className="sr-only">Buscar producto</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted"
            />
          </label>
        </div>
      )}

      <ul className="max-h-72 min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 lg:max-h-none">
        {visible.map((product) => {
          const result = results.get(product.id);
          const active = product.id === selectedId;
          return (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onSelect(product.id)}
                aria-current={active ? "true" : undefined}
                className={cx(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-accent",
                  active ? "bg-accent-soft ring-1 ring-accent/25" : "hover:bg-surface-2",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {product.name || "Sin nombre"}
                  </span>
                  <span className="block text-xs text-muted tabular-nums">
                    Venta {formatCOP(product.price)}
                  </span>
                </span>
                {result?.viable ? (
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {formatCOP(result.cpaMax)}
                    </span>
                    <span className="block text-[11px] text-muted">CPA máx.</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-ink-2">
                    <ToneIcon tone="critical" className="size-3.5" />
                    No rentable
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {visible.length === 0 && products.length > 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted">
            Ningún producto coincide con “{query}”.
          </li>
        )}
      </ul>
    </Card>
  );
}
