import { calculate, type Product } from "./cpa";

// Punto y coma: Excel en español usa la coma como separador decimal.
const SEPARATOR = ";";

function cell(value: string | number): string {
  let text = String(value);
  // Evita que Excel interprete nombres como fórmulas.
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const decimal = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));

export function productsToCsv(products: Product[]): string {
  const costLabels: string[] = [];
  for (const product of products) {
    for (const cost of product.costs) {
      if (!costLabels.includes(cost.label)) costLabels.push(cost.label);
    }
  }

  const header = [
    "Producto",
    "Venta",
    ...costLabels,
    "Ganancia mínima",
    "Gastos operativos",
    "CPA máximo",
    "CPA medio",
    "CPA mínimo",
    "ROAS mínimo",
  ];

  const rows = products.map((product) => {
    const r = calculate(product);
    const byLabel = new Map<string, number>();
    for (const cost of product.costs) {
      byLabel.set(cost.label, (byLabel.get(cost.label) ?? 0) + cost.amount);
    }
    return [
      product.name,
      product.price,
      ...costLabels.map((label) => byLabel.get(label) ?? 0),
      product.minProfit,
      r.operating,
      Math.round(r.cpaMax),
      Math.round(r.cpaMed),
      Math.round(r.cpaMin),
      decimal(r.roasMax),
    ];
  });

  return [header, ...rows].map((row) => row.map(cell).join(SEPARATOR)).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM para que Excel reconozca UTF-8 (tildes y ñ).
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
