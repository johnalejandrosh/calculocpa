import { useEffect, useReducer } from "react";
import { inferCostGroup, sampleProducts, type CostGroup, type CostItem, type Product } from "./cpa";

export interface AppState {
  products: Product[];
  selectedId: string | null;
}

export type Action =
  | { type: "select"; id: string }
  | { type: "add"; product: Product; index?: number }
  | { type: "remove"; id: string }
  | { type: "update"; id: string; patch: Partial<Omit<Product, "id" | "costs">> }
  | { type: "addCost"; id: string; cost: CostItem }
  | { type: "updateCost"; id: string; costId: string; patch: Partial<Omit<CostItem, "id">> }
  | { type: "removeCost"; id: string; costId: string }
  | { type: "replaceAll"; products: Product[] };

function mapProduct(state: AppState, id: string, fn: (product: Product) => Product): AppState {
  return { ...state, products: state.products.map((p) => (p.id === id ? fn(p) : p)) };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };
    case "add": {
      const products = [...state.products];
      products.splice(action.index ?? products.length, 0, action.product);
      return { products, selectedId: action.product.id };
    }
    case "remove": {
      const index = state.products.findIndex((p) => p.id === action.id);
      if (index === -1) return state;
      const products = state.products.filter((p) => p.id !== action.id);
      const selectedId =
        state.selectedId === action.id
          ? (products[Math.min(index, products.length - 1)]?.id ?? null)
          : state.selectedId;
      return { products, selectedId };
    }
    case "update":
      return mapProduct(state, action.id, (p) => ({ ...p, ...action.patch }));
    case "addCost":
      return mapProduct(state, action.id, (p) => ({ ...p, costs: [...p.costs, action.cost] }));
    case "updateCost":
      return mapProduct(state, action.id, (p) => ({
        ...p,
        costs: p.costs.map((c) => (c.id === action.costId ? { ...c, ...action.patch } : c)),
      }));
    case "removeCost":
      return mapProduct(state, action.id, (p) => ({
        ...p,
        costs: p.costs.filter((c) => c.id !== action.costId),
      }));
    case "replaceAll":
      return { products: action.products, selectedId: action.products[0]?.id ?? null };
  }
}

// ---------------------------------------------------------------------------
// Persistencia en localStorage

const STORAGE_KEY = "calculadora-cpa:v1";
const GROUPS: readonly CostGroup[] = ["producto", "flete", "riesgo", "operacion"];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const toAmount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0);
const toText = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

function parseCost(data: unknown): CostItem | null {
  if (!isRecord(data) || typeof data.id !== "string") return null;
  const label = toText(data.label, "Costo");
  return {
    id: data.id,
    label,
    amount: toAmount(data.amount),
    group: GROUPS.includes(data.group as CostGroup) ? (data.group as CostGroup) : inferCostGroup(label),
  };
}

function parseProduct(data: unknown): Product | null {
  if (!isRecord(data) || typeof data.id !== "string") return null;
  const costs = Array.isArray(data.costs) ? data.costs.map(parseCost) : [];
  return {
    id: data.id,
    name: toText(data.name, "Producto"),
    price: toAmount(data.price),
    costs: costs.filter((c): c is CostItem => c !== null),
    minProfit: toAmount(data.minProfit),
    adCpa: data.adCpa === null || data.adCpa === undefined ? null : toAmount(data.adCpa),
    monthlyOrders: toAmount(data.monthlyOrders),
  };
}

export function defaultState(): AppState {
  const products = sampleProducts();
  return { products, selectedId: products[0]?.id ?? null };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || !Array.isArray(data.products)) return defaultState();
    const products = data.products
      .map(parseProduct)
      .filter((p): p is Product => p !== null);
    const selectedId = products.some((p) => p.id === data.selectedId)
      ? (data.selectedId as string)
      : (products[0]?.id ?? null);
    return { products, selectedId };
  } catch {
    return defaultState();
  }
}

/** Estado de la app persistido en este navegador. Solo debe usarse en el cliente. */
export function usePersistentState() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Almacenamiento lleno o bloqueado: la app sigue funcionando sin guardar.
    }
  }, [state]);

  return [state, dispatch] as const;
}
