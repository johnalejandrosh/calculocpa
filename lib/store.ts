import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { saveProducts } from "@/app/actions";
import type { CostItem, Product } from "./cpa";
import type { ProductChanges } from "./product-schema";

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
  | { type: "removeCost"; id: string; costId: string };

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
  }
}

// ---------------------------------------------------------------------------
// Guardado en la base de datos

export type SaveStatus = "saved" | "saving" | "error";

/** Espera tras el último cambio antes de guardar, para no escribir en cada tecla. */
const SAVE_DELAY_MS = 600;
const RETRY_DELAY_MS = 5_000;
/** Clave de la versión anterior, que guardaba los productos en el navegador. */
const LEGACY_STORAGE_KEY = "calculadora-cpa:v1";

interface Pending {
  /** Productos creados o modificados desde el último guardado. */
  dirty: Set<string>;
  removed: Set<string>;
  /** Cambió el orden de la lista (alta o baja de productos). */
  reorder: boolean;
}

const emptyPending = (): Pending => ({ dirty: new Set(), removed: new Set(), reorder: false });
const hasPending = (p: Pending) => p.dirty.size > 0 || p.removed.size > 0 || p.reorder;

function track(pending: Pending, action: Action) {
  switch (action.type) {
    case "select":
      return;
    case "add":
      pending.removed.delete(action.product.id);
      pending.dirty.add(action.product.id);
      pending.reorder = true;
      return;
    case "remove":
      pending.dirty.delete(action.id);
      pending.removed.add(action.id);
      pending.reorder = true;
      return;
    default:
      pending.dirty.add(action.id);
  }
}

/**
 * Estado de la app a partir de los productos leídos de la base de datos.
 * Los cambios se aplican al instante en pantalla y se guardan en segundo plano.
 */
export function useProductsState(initialProducts: Product[]) {
  const [state, rawDispatch] = useReducer(reducer, initialProducts, (products) => ({
    products,
    selectedId: products[0]?.id ?? null,
  }));
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [retryTick, setRetryTick] = useState(0);
  const pending = useRef<Pending>(emptyPending());
  const products = useRef(state.products);
  // Los guardados se encadenan para que lleguen al servidor en orden.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const dispatch = useCallback((action: Action) => {
    track(pending.current, action);
    rawDispatch(action);
    if (action.type !== "select") setStatus("saving");
  }, []);

  const sendPending = useCallback(async () => {
    const batch = pending.current;
    if (!hasPending(batch)) return;
    pending.current = emptyPending();

    const list = products.current;
    const changes: ProductChanges = {
      upsert: list.flatMap((product, position) =>
        batch.dirty.has(product.id) ? [{ ...product, position }] : [],
      ),
      remove: [...batch.removed],
      order: batch.reorder ? list.map((product) => product.id) : null,
    };

    let failed = false;
    try {
      const result = await saveProducts(changes);
      failed = !result.ok;
    } catch {
      failed = true;
    }

    if (failed) {
      // Se devuelven al pendiente, sin pisar lo que cambió mientras tanto.
      const current = pending.current;
      for (const id of batch.dirty) if (!current.removed.has(id)) current.dirty.add(id);
      for (const id of batch.removed) if (!current.dirty.has(id)) current.removed.add(id);
      current.reorder ||= batch.reorder;
      setStatus("error");
      setTimeout(() => setRetryTick((tick) => tick + 1), RETRY_DELAY_MS);
    } else if (!hasPending(pending.current)) {
      setStatus("saved");
    }
  }, []);

  const flush = useCallback(() => {
    queue.current = queue.current.then(sendPending);
    return queue.current;
  }, [sendPending]);

  useEffect(() => {
    products.current = state.products;
    if (!hasPending(pending.current)) return;
    const timer = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.products, retryTick, flush]);

  useEffect(() => {
    // Los productos ya no se guardan en el navegador; se borra la copia antigua.
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}

    // Al ocultar la pestaña se guarda de inmediato; al cerrarla se avisa si falta guardar.
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasPending(pending.current)) event.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flush]);

  return [state, dispatch, status] as const;
}
