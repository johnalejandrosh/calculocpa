// Validación de los productos que llegan del navegador antes de guardarlos.
// Los límites coinciden con las columnas de prisma/schema.prisma.
import { DEFAULT_PROJECTION, inferCostGroup, normalizeRates, type CostGroup, type CostItem, type Product } from "./cpa";

/** Cambios pendientes que el navegador envía para guardar en la base de datos. */
export interface ProductChanges {
  /** Productos nuevos o modificados, completos y con su posición en la lista. */
  upsert: Array<Product & { position: number }>;
  /** Ids de productos eliminados. */
  remove: string[];
  /** Orden completo de la lista cuando cambió (alta o baja de productos). */
  order: string[] | null;
}

const MAX_AMOUNT = 999_999_999_999; // Decimal(14, 2)
const MAX_INT = 2_147_483_647; // Int de PostgreSQL
const MAX_TEXT = 200;
const MAX_COSTS = 100;
const MAX_ITEMS = 1_000;
const GROUPS: readonly CostGroup[] = ["producto", "flete", "riesgo", "operacion"];
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isId = (v: unknown): v is string => typeof v === "string" && ID_PATTERN.test(v);
const toText = (v: unknown, fallback: string) => (typeof v === "string" ? v.slice(0, MAX_TEXT) : fallback);
const toAmount = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(MAX_AMOUNT, Math.max(0, Math.round(v * 100) / 100)) : 0;
const toInt = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(MAX_INT, Math.max(0, Math.round(v))) : 0;
const toRate = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : fallback;
/** % del precio entre 0 y 100, o `null` si el valor es un monto fijo. */
const toPercent = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v * 100) / 100)) : null;

function parseCost(data: unknown): CostItem | null {
  if (!isRecord(data) || !isId(data.id)) return null;
  const label = toText(data.label, "Costo");
  return {
    id: data.id,
    label,
    amount: toAmount(data.amount),
    percent: toPercent(data.percent),
    group: GROUPS.includes(data.group as CostGroup) ? (data.group as CostGroup) : inferCostGroup(label),
  };
}

function parseProduct(data: unknown): (Product & { position: number }) | null {
  if (!isRecord(data) || !isId(data.id)) return null;
  if (!Array.isArray(data.costs) || data.costs.length > MAX_COSTS) return null;
  const costs = data.costs.map(parseCost);
  // Un costo inválido invalida el producto: descartarlo en silencio lo borraría de la base.
  if (costs.some((cost) => cost === null)) return null;
  const rates = normalizeRates(
    toRate(data.shippedRate, DEFAULT_PROJECTION.shippedRate),
    toRate(data.deliveredRate, DEFAULT_PROJECTION.deliveredRate),
  );
  return {
    id: data.id,
    name: toText(data.name, "Producto"),
    price: toAmount(data.price),
    costs: costs.filter((c): c is CostItem => c !== null),
    minProfit: toAmount(data.minProfit),
    minProfitPercent: toPercent(data.minProfitPercent),
    adCpa: data.adCpa === null || data.adCpa === undefined ? null : toAmount(data.adCpa),
    monthlyOrders: toInt(data.monthlyOrders),
    projectedOrders:
      data.projectedOrders === undefined ? DEFAULT_PROJECTION.projectedOrders : toInt(data.projectedOrders),
    ...rates,
    position: toInt(data.position),
  };
}

/** `null` si la forma no es válida; los valores fuera de rango se ajustan. */
export function parseProductChanges(data: unknown): ProductChanges | null {
  if (!isRecord(data) || !Array.isArray(data.upsert) || !Array.isArray(data.remove)) return null;
  if (data.order !== null && !Array.isArray(data.order)) return null;
  if (data.upsert.length > MAX_ITEMS || data.remove.length > MAX_ITEMS) return null;
  if (Array.isArray(data.order) && data.order.length > MAX_ITEMS) return null;

  const upsert = data.upsert.map(parseProduct);
  if (upsert.some((p) => p === null)) return null;
  if (!data.remove.every(isId)) return null;
  if (Array.isArray(data.order) && !data.order.every(isId)) return null;

  return {
    upsert: upsert as Array<Product & { position: number }>,
    remove: data.remove,
    order: data.order as string[] | null,
  };
}
