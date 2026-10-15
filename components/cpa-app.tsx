"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Download, Package, Plus, RotateCcw, Undo2, X } from "lucide-react";
import { calculate, createProduct, duplicateProduct, sampleProducts, type Product } from "@/lib/cpa";
import { downloadCsv, productsToCsv } from "@/lib/csv";
import { usePersistentState } from "@/lib/store";
import { Comparison } from "./comparison";
import { ProductEditor } from "./product-editor";
import { ProductList } from "./product-list";
import { Simulator } from "./simulator";
import { ThemeToggle } from "./theme-toggle";
import { Button, Card } from "./ui";

const subscribeNoop = () => () => {};

/** Los datos viven en localStorage, así que el espacio de trabajo solo se pinta en el cliente. */
export function CpaApp() {
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  return hydrated ? <Workspace /> : <WorkspaceSkeleton />;
}

function Workspace() {
  const [state, dispatch] = usePersistentState();
  const [deleted, setDeleted] = useState<{ product: Product; index: number } | null>(null);
  const { products } = state;
  const results = useMemo(() => new Map(products.map((p) => [p.id, calculate(p)])), [products]);
  const selected = products.find((p) => p.id === state.selectedId) ?? products[0] ?? null;
  const selectedResult = selected ? (results.get(selected.id) ?? calculate(selected)) : null;

  useEffect(() => {
    if (!deleted) return;
    const timer = setTimeout(() => setDeleted(null), 6000);
    return () => clearTimeout(timer);
  }, [deleted]);

  function focusProductName() {
    requestAnimationFrame(() => {
      const input = document.getElementById("product-name");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    });
  }

  function addProduct() {
    dispatch({ type: "add", product: createProduct(`Producto ${products.length + 1}`) });
    focusProductName();
  }

  function selectProduct(id: string, scroll = false) {
    dispatch({ type: "select", id });
    if (scroll) document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function removeProduct(product: Product) {
    setDeleted({ product, index: products.indexOf(product) });
    dispatch({ type: "remove", id: product.id });
  }

  function undoRemove() {
    if (!deleted) return;
    dispatch({ type: "add", product: deleted.product, index: deleted.index });
    setDeleted(null);
  }

  function loadSamples() {
    if (
      products.length > 0 &&
      !window.confirm("¿Cargar los productos de ejemplo? Se reemplazarán todos tus productos actuales.")
    ) {
      return;
    }
    dispatch({ type: "replaceAll", products: sampleProducts() });
    setDeleted(null);
  }

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`cpa-productos-${date}.csv`, productsToCsv(products));
  }

  return (
    <>
      <AppHeader>
        <Button variant="ghost" onClick={exportCsv} disabled={products.length === 0} aria-label="Exportar CSV">
          <Download aria-hidden />
          <span className="hidden sm:inline">Exportar CSV</span>
        </Button>
        <Button variant="ghost" onClick={loadSamples} aria-label="Cargar productos de ejemplo">
          <RotateCcw aria-hidden />
          <span className="hidden md:inline">Ejemplos</span>
        </Button>
        <ThemeToggle />
      </AppHeader>

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <ProductList
          products={products}
          results={results}
          selectedId={selected?.id ?? null}
          onSelect={(id) => selectProduct(id)}
          onAdd={addProduct}
        />

        <div className="flex min-w-0 flex-col gap-6">
          {selected && selectedResult ? (
            <>
              <ProductEditor
                key={selected.id}
                product={selected}
                result={selectedResult}
                dispatch={dispatch}
                onDuplicate={() => {
                  dispatch({
                    type: "add",
                    product: duplicateProduct(selected),
                    index: products.indexOf(selected) + 1,
                  });
                  focusProductName();
                }}
                onRemove={() => removeProduct(selected)}
              />
              <Simulator product={selected} result={selectedResult} dispatch={dispatch} />
              <Comparison
                products={products}
                results={results}
                selectedId={selected.id}
                onSelect={(id) => selectProduct(id, true)}
              />
            </>
          ) : (
            <EmptyState onAdd={addProduct} onLoadSamples={loadSamples} />
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1440px] px-4 pb-8 text-xs text-muted sm:px-6">
        Tus productos se guardan automáticamente en este navegador. Usa “Exportar CSV” para llevarlos a Excel.
      </footer>

      {deleted && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-ink py-2.5 pr-2 pl-4 text-sm text-surface shadow-xl"
        >
          <span className="min-w-0 flex-1 truncate">
            Se eliminó “{deleted.product.name || "Sin nombre"}”
          </span>
          <button
            type="button"
            onClick={undoRemove}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-surface/15"
          >
            <Undo2 aria-hidden className="size-4" />
            Deshacer
          </button>
          <button
            type="button"
            onClick={() => setDeleted(null)}
            aria-label="Cerrar aviso"
            className="rounded-lg p-1.5 hover:bg-surface/15"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </>
  );
}

function EmptyState({ onAdd, onLoadSamples }: { onAdd: () => void; onLoadSamples: () => void }) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
        <Package aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Aún no tienes productos</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Crea tu primer producto con su precio de venta y costos para saber cuánto puedes pagar por
        cada venta en publicidad.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={onAdd}>
          <Plus aria-hidden />
          Crear producto
        </Button>
        <Button onClick={onLoadSamples}>Cargar ejemplos</Button>
      </div>
    </Card>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="size-9 shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--accent-strong)" />
      <path
        d="M8.5 21.5 13.5 16.5l3.5 3.5 6.5-7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18.5 13h5v5" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6">
        <Logo />
        <div className="min-w-0">
          <h1 className="truncate text-[15px] leading-tight font-semibold tracking-tight">Calculadora de CPA</h1>
          <p className="hidden truncate text-xs text-muted sm:block">
            Costo por adquisición máximo, medio y mínimo · COP
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">{children}</div>
      </div>
    </header>
  );
}

function WorkspaceSkeleton() {
  const block = "animate-pulse rounded-2xl border border-line bg-surface";
  return (
    <>
      <AppHeader />
      <main
        aria-busy="true"
        aria-label="Cargando"
        className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start"
      >
        <div className={`${block} h-72 lg:h-[28rem]`} />
        <div className="flex flex-col gap-6">
          <div className={`${block} h-[36rem]`} />
          <div className={`${block} h-80`} />
        </div>
      </main>
    </>
  );
}
