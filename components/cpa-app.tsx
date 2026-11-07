"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Package, Plus, Undo2, X } from "lucide-react";
import { calculate, createProduct, duplicateProduct, sampleProduct, type Product } from "@/lib/cpa";
import { downloadCsv, productsToCsv } from "@/lib/csv";
import { useProductsState } from "@/lib/store";
import { AppSidebar, MobileBar, MobileMenu, SIDEBAR_WIDTH, useSidebarLayout } from "./app-sidebar";
import { Comparison } from "./comparison";
import { ProductEditor } from "./product-editor";
import { ProductList } from "./product-list";
import { KpiStrip } from "./kpi-strip";
import { ProjectionPanel } from "./projection";
import { Simulator } from "./simulator";
import { Button, Card } from "./ui";

const MAIN_GRID =
  "mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start";

const subscribeNoop = () => () => {};

/**
 * Recibe los productos leídos de la base de datos. El espacio de trabajo depende del
 * tamaño de la ventana y de preferencias del navegador, así que solo se pinta en el cliente.
 */
export function CpaApp({ initialProducts }: { initialProducts: Product[] }) {
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  return hydrated ? <Workspace initialProducts={initialProducts} /> : <WorkspaceSkeleton />;
}

function Workspace({ initialProducts }: { initialProducts: Product[] }) {
  const [state, dispatch, saveStatus] = useProductsState(initialProducts);
  const sidebar = useSidebarLayout();
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

  function addSample() {
    dispatch({ type: "add", product: sampleProduct() });
  }

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`cpa-productos-${date}.csv`, productsToCsv(products));
  }

  const menu = {
    product: selected,
    result: selectedResult,
    productCount: products.length,
    onAdd: addProduct,
    onExport: exportCsv,
    onAddSample: addSample,
    saveStatus,
  };

  return (
    <div
      style={{ "--sidebar-w": sidebar.rail ? SIDEBAR_WIDTH.rail : SIDEBAR_WIDTH.expanded } as CSSProperties}
      className="flex flex-1 flex-col transition-[padding] duration-200 motion-reduce:transition-none lg:pl-(--sidebar-w)"
    >
      <h1 className="sr-only">Calculadora de CPA</h1>
      <MobileMenu {...menu} />
      <AppSidebar {...menu} rail={sidebar.rail} canToggle={sidebar.canToggle} onToggleRail={sidebar.toggleCollapsed} />

      <main className={MAIN_GRID}>
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
              <KpiStrip product={selected} result={selectedResult} />
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
              <div id="proyeccion" className="animate-enter scroll-mt-22 [animation-delay:70ms] lg:scroll-mt-6">
                <ProjectionPanel product={selected} result={selectedResult} dispatch={dispatch} />
              </div>
              <div id="simulador" className="animate-enter scroll-mt-22 [animation-delay:140ms] lg:scroll-mt-6">
                <Simulator product={selected} result={selectedResult} dispatch={dispatch} />
              </div>
              <div id="comparativo" className="animate-enter scroll-mt-22 [animation-delay:210ms] lg:scroll-mt-6">
                <Comparison
                  products={products}
                  results={results}
                  selectedId={selected.id}
                  onSelect={(id) => selectProduct(id, true)}
                />
              </div>
            </>
          ) : (
            <EmptyState onAdd={addProduct} onAddSample={addSample} />
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1440px] px-4 pb-8 text-xs text-muted sm:px-6">
        Tus productos se guardan automáticamente en la base de datos. Usa “Exportar CSV” para llevarlos a Excel.
      </footer>

      {deleted && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md animate-toast items-center gap-3 rounded-xl bg-ink py-2.5 pr-2 pl-4 text-sm text-surface shadow-pop lg:left-[calc(var(--sidebar-w)+1rem)]"
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
    </div>
  );
}

function EmptyState({ onAdd, onAddSample }: { onAdd: () => void; onAddSample: () => void }) {
  return (
    <Card className="flex animate-enter flex-col items-center px-6 py-16 text-center">
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
        <Button onClick={onAddSample}>Agregar ejemplo</Button>
      </div>
    </Card>
  );
}

export function WorkspaceSkeleton() {
  // Brillo que recorre cada bloque mientras llegan los datos.
  const block =
    "relative overflow-hidden rounded-xl border border-line bg-surface before:absolute before:inset-0 before:animate-shimmer before:bg-linear-to-r before:from-transparent before:via-surface-2 before:to-transparent";
  return (
    <div className="flex flex-1 flex-col lg:pl-[4.5rem] xl:pl-64">
      <MobileBar />
      <main aria-busy="true" aria-label="Cargando" className={MAIN_GRID}>
        <div className={`${block} h-72 lg:h-[28rem]`} />
        <div className="flex flex-col gap-6">
          <div className={`${block} h-[36rem]`} />
          <div className={`${block} h-80`} />
        </div>
      </main>
      <div aria-hidden className="fixed inset-y-0 left-0 hidden w-[4.5rem] border-r border-line bg-surface lg:block xl:w-64" />
    </div>
  );
}
