"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Calculator,
  ChartColumn,
  ChevronDown,
  Download,
  Gauge,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Plus,
  FlaskConical,
  X,
  type LucideIcon,
} from "lucide-react";
import type { CpaResult, Product } from "@/lib/cpa";
import { formatCOP } from "@/lib/format";
import { AnimatedNumber } from "./animated-number";
import type { SaveStatus } from "@/lib/store";
import { TIER_COLOR } from "./palette";
import { ThemeToggle } from "./theme-toggle";
import { Swatch, ToneIcon, cx } from "./ui";

/**
 * Secciones del panel en el orden de la página; el `id` es el del elemento al que se desplaza.
 * La primera es la entrada del menú y las demás forman su submenú.
 */
export const SECTIONS = [
  { id: "editor", label: "Costos y CPA", icon: Calculator },
  { id: "proyeccion", label: "Proyección por %", icon: Percent },
  { id: "simulador", label: "Simulador de pauta", icon: Gauge },
  { id: "comparativo", label: "Comparativo", icon: ChartColumn },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>;

type SectionId = (typeof SECTIONS)[number]["id"];

const [MAIN_SECTION, ...SUB_SECTIONS] = SECTIONS;

const SECTION_IDS = SECTIONS.map((section) => section.id);
const COLLAPSED_KEY = "calculadora-cpa:sidebar-collapsed";
const WIDE_QUERY = "(min-width: 80rem)";
/** Desde aquí el menú es fijo (`lg:`) y el panel móvil sobra. */
const DESKTOP_QUERY = "(min-width: 64rem)";

export const SIDEBAR_WIDTH = { expanded: "16rem", rail: "4.5rem" } as const;

// ---------------------------------------------------------------------------
// Estado del menú

function subscribeWide(onChange: () => void) {
  const query = matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * En pantallas ≥ 1280 px el menú se muestra completo salvo que el usuario lo contraiga;
 * entre 1024 y 1280 px siempre va contraído para no apretar el contenido.
 */
export function useSidebarLayout() {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => matchMedia(WIDE_QUERY).matches,
    () => true,
  );
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggleCollapsed() {
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, current ? "0" : "1");
      } catch {}
      return !current;
    });
  }

  return { rail: !wide || collapsed, canToggle: wide, collapsed, toggleCollapsed };
}

/** Sección visible: la última cuyo borde superior ya pasó el 30 % de la ventana. */
function useActiveSection(enabled: boolean): SectionId | null {
  const [active, setActive] = useState<SectionId>(SECTION_IDS[0]);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current: SectionId = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) current = id;
      }
      const atBottom =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setActive(atBottom ? SECTION_IDS[SECTION_IDS.length - 1] : current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled]);

  return enabled ? active : null;
}

function scrollToSection(id: SectionId) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------------
// Componentes

interface SidebarProps {
  product: Product | null;
  result: CpaResult | null;
  productCount: number;
  rail: boolean;
  canToggle: boolean;
  onToggleRail: () => void;
  onAdd: () => void;
  onExport: () => void;
  onAddSample: () => void;
  saveStatus: SaveStatus;
}

/** Menú fijo a la izquierda en escritorio (≥ 1024 px). */
export function AppSidebar(props: SidebarProps) {
  return (
    <aside
      aria-label="Menú principal"
      style={{ width: props.rail ? SIDEBAR_WIDTH.rail : SIDEBAR_WIDTH.expanded }}
      className="fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-surface transition-[width] duration-200 motion-reduce:transition-none lg:flex"
    >
      <SidebarContent {...props} />
    </aside>
  );
}

/** Barra superior en móvil con el botón que abre el menú como panel lateral. */
export function MobileMenu(props: Omit<SidebarProps, "rail" | "canToggle" | "onToggleRail">) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  // Si la ventana crece con el panel abierto, se cierra: oculto seguiría bloqueando la página.
  useEffect(() => {
    const query = matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (query.matches) dialogRef.current?.close();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <MobileBar>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          aria-label="Abrir menú"
          aria-haspopup="dialog"
          className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Menu aria-hidden className="size-5" />
        </button>
      </MobileBar>

      <dialog
        ref={dialogRef}
        aria-label="Menú principal"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className={cx(
          "fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-line bg-surface p-0 text-ink shadow-2xl",
          "backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
          "translate-x-0 transition-transform duration-200 starting:open:-translate-x-full motion-reduce:transition-none lg:hidden",
        )}
      >
        <div className="flex h-full">
          <SidebarContent
            {...props}
            rail={false}
            canToggle={false}
            onToggleRail={close}
            onNavigate={close}
            closeButton={
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar menú"
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X aria-hidden className="size-4" />
              </button>
            }
          />
        </div>
      </dialog>
    </>
  );
}

export function MobileBar({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md lg:hidden">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {children}
        <Logo />
        <Brand />
      </div>
    </header>
  );
}

function SidebarContent({
  product,
  result,
  productCount,
  rail,
  canToggle,
  onToggleRail,
  onAdd,
  onExport,
  onAddSample,
  saveStatus,
  onNavigate,
  closeButton,
}: SidebarProps & { onNavigate?: () => void; closeButton?: ReactNode }) {
  const hasProduct = product !== null;
  const active = useActiveSection(hasProduct);

  function run(action: () => void) {
    onNavigate?.();
    action();
  }

  return (
    <div className="flex min-h-0 w-full flex-col">
      {/* Marca */}
      <div className={cx("flex h-16 shrink-0 items-center gap-3 border-b border-line", rail ? "justify-center" : "px-4")}>
        <Logo />
        {!rail && <Brand />}
        {!rail && <div className="ml-auto">{closeButton}</div>}
      </div>

      <div className={cx("flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto py-4", rail ? "px-2" : "px-3")}>
        <MenuGroup title="Panel" rail={rail}>
          <SectionNav
            rail={rail}
            active={active}
            disabled={!hasProduct}
            productCount={productCount}
            onGo={(id) => {
              onNavigate?.();
              // Al cerrar el panel móvil se devuelve el foco; se desplaza después.
              requestAnimationFrame(() => scrollToSection(id));
            }}
          />
        </MenuGroup>

        {!rail && product && result && <ActiveProduct product={product} result={result} />}

        <MenuGroup title="Acciones" rail={rail}>
          <MenuItem icon={Plus} label="Nuevo producto" rail={rail} onClick={() => run(onAdd)} />
          <MenuItem
            icon={Download}
            label="Exportar CSV"
            rail={rail}
            disabled={productCount === 0}
            onClick={() => run(onExport)}
          />
          <MenuItem icon={FlaskConical} label="Agregar ejemplo" rail={rail} onClick={() => run(onAddSample)} />
        </MenuGroup>
      </div>

      {/* Pie */}
      <div className={cx("shrink-0 space-y-1 border-t border-line py-3", rail ? "px-2" : "px-3")}>
        <ThemeToggle withLabel={!rail} className={cx("w-full", rail ? "h-10" : "justify-start")} />
        {canToggle && (
          <MenuItem
            icon={rail ? PanelLeftOpen : PanelLeftClose}
            label={rail ? "Expandir menú" : "Contraer menú"}
            rail={rail}
            onClick={onToggleRail}
          />
        )}
        <SaveIndicator status={saveStatus} rail={rail} />
      </div>
    </div>
  );
}

const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: "Guardado en la base de datos",
  saving: "Guardando…",
  error: "No se pudo guardar · reintentando",
};

const SAVE_DOT: Record<SaveStatus, string> = {
  saved: "bg-good",
  saving: "animate-pulse bg-accent",
  error: "bg-critical",
};

function SaveIndicator({ status, rail }: { status: SaveStatus; rail: boolean }) {
  const label = SAVE_LABEL[status];
  return (
    <p
      title={rail ? label : undefined}
      className={cx(
        "flex items-center gap-2 pt-2 text-xs",
        rail ? "justify-center" : "px-3",
        status === "error" ? "font-medium text-critical-ink" : "text-muted",
      )}
    >
      <span aria-hidden className={cx("size-1.5 shrink-0 rounded-full", SAVE_DOT[status])} />
      <span className={rail ? "sr-only" : undefined}>{label}</span>
      {/* Solo se anuncian los errores; "Guardando…" en cada tecla sería ruido. */}
      {status === "error" && (
        <span role="alert" className="sr-only">
          No se pudieron guardar los cambios en la base de datos.
        </span>
      )}
    </p>
  );
}

function MenuGroup({ title, rail, children }: { title: string; rail: boolean; children: ReactNode }) {
  return (
    <div>
      {rail ? (
        <h2 className="sr-only">{title}</h2>
      ) : (
        <h2 className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">{title}</h2>
      )}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

/** "Costos y CPA" con sus secciones como submenú desplegable. */
function SectionNav({
  rail,
  active,
  disabled,
  productCount,
  onGo,
}: {
  rail: boolean;
  active: SectionId | null;
  disabled: boolean;
  productCount: number;
  onGo: (id: SectionId) => void;
}) {
  const [open, setOpen] = useState(true);
  const submenuId = useId();
  const badgeFor = (id: SectionId) => (id === "comparativo" && productCount > 0 ? productCount : undefined);

  if (rail) {
    return (
      <li>
        <MenuButton
          icon={MAIN_SECTION.icon}
          label={MAIN_SECTION.label}
          rail
          current={active === MAIN_SECTION.id}
          disabled={disabled}
          onClick={() => onGo(MAIN_SECTION.id)}
        />
        <ul aria-label={`Secciones de ${MAIN_SECTION.label}`} className="mt-0.5 ml-2.5 space-y-0.5 border-l border-line pl-1">
          {SUB_SECTIONS.map(({ id, label, icon }) => (
            <MenuItem
              key={id}
              icon={icon}
              label={label}
              rail
              compact
              current={active === id}
              disabled={disabled}
              onClick={() => onGo(id)}
            />
          ))}
        </ul>
      </li>
    );
  }

  const childActive = SUB_SECTIONS.some((section) => section.id === active);

  return (
    <li>
      <div className="flex items-center gap-1">
        <MenuButton
          icon={MAIN_SECTION.icon}
          label={MAIN_SECTION.label}
          rail={false}
          current={active === MAIN_SECTION.id}
          disabled={disabled}
          emphasis={childActive}
          className="flex-1"
          onClick={() => {
            setOpen(true);
            onGo(MAIN_SECTION.id);
          }}
        />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={submenuId}
          aria-label={open ? `Ocultar secciones de ${MAIN_SECTION.label}` : `Mostrar secciones de ${MAIN_SECTION.label}`}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronDown
            aria-hidden
            className={cx("size-4 transition-transform motion-reduce:transition-none", !open && "-rotate-90")}
          />
        </button>
      </div>

      {/* Se pliega animando la altura (0fr ↔ 1fr); `inert` lo saca del foco y de los lectores al cerrarse. */}
      <div
        inert={!open}
        className={cx(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out-expo",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ul id={submenuId} className="mt-0.5 ml-5 space-y-0.5 border-l border-line pl-2">
            {SUB_SECTIONS.map(({ id, label }) => {
              const current = active === id;
              const badge = badgeFor(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onGo(id)}
                    disabled={disabled}
                    aria-current={current ? "location" : undefined}
                    className={cx(
                      "relative flex h-8 w-full items-center gap-2 rounded-md px-3 text-[13px] transition-colors focus-visible:-outline-offset-2",
                      "focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40",
                      current
                        ? "bg-accent-soft font-medium text-accent-strong dark:text-accent"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {/* Resalta el tramo de la línea guía que corresponde a la sección activa. */}
                    {current && <span aria-hidden className="absolute inset-y-1.5 -left-[9px] w-[2px] rounded-full bg-accent" />}
                    <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                    {badge !== undefined && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2 tabular-nums">{badge}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </li>
  );
}

interface MenuButtonProps {
  icon: LucideIcon;
  label: string;
  rail: boolean;
  /** Ícono más pequeño, para las subsecciones en la barra contraída. */
  compact?: boolean;
  current?: boolean;
  /** Contiene la sección activa (su submenú); se destaca sin fondo. */
  emphasis?: boolean;
  disabled?: boolean;
  badge?: number;
  className?: string;
  onClick: () => void;
}

function MenuItem(props: MenuButtonProps) {
  return (
    <li>
      <MenuButton {...props} />
    </li>
  );
}

function MenuButton({
  icon: Icon,
  label,
  rail,
  compact = false,
  current = false,
  emphasis = false,
  disabled = false,
  badge,
  className,
  onClick,
}: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={current ? "location" : undefined}
      aria-label={rail ? label : undefined}
      title={rail ? label : undefined}
      className={cx(
        "relative flex w-full items-center rounded-lg text-sm font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40",
        rail ? cx("justify-center", compact ? "h-8" : "h-10") : "h-9 gap-3 px-3",
        current
          ? "bg-accent-soft text-accent-strong dark:text-accent"
          : cx(emphasis ? "text-ink" : "text-ink-2", "hover:bg-surface-2 hover:text-ink"),
        className,
      )}
    >
      {/* Indicador de la sección activa. */}
      {current && <span aria-hidden className="absolute inset-y-2 -left-px w-[3px] rounded-full bg-accent" />}
      <Icon aria-hidden className={cx("shrink-0", compact ? "size-3.5" : "size-4")} />
      {!rail && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!rail && badge !== undefined && (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2 tabular-nums">{badge}</span>
      )}
    </button>
  );
}

function ActiveProduct({ product, result }: { product: Product; result: CpaResult }) {
  // El menú se monta dos veces (escritorio y panel móvil); el id debe ser único.
  const headingId = useId();
  const tiers = [
    { label: "CPA máximo", value: result.cpaMax, color: TIER_COLOR.max },
    { label: "CPA medio", value: result.cpaMed, color: TIER_COLOR.med },
    { label: "CPA mínimo", value: result.cpaMin, color: TIER_COLOR.min },
  ];

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-line bg-surface-2/60 p-3">
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Producto activo</p>
      <h2 id={headingId} className="mt-1 truncate text-sm font-semibold">
        {product.name || "Sin nombre"}
      </h2>
      <p className="text-xs text-muted tabular-nums">Venta {formatCOP(result.price)}</p>

      {result.viable ? (
        <dl className="mt-3 space-y-1.5">
          {tiers.map((tier) => (
            <div key={tier.label} className="flex items-center gap-2 text-xs">
              <Swatch color={tier.color} />
              <dt className="flex-1 text-ink-2">{tier.label}</dt>
              <dd className="font-semibold tabular-nums">
                <AnimatedNumber value={tier.value} format={formatCOP} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-2">
          <ToneIcon tone="critical" className="mt-px size-3.5" />
          No rentable: los costos y la ganancia mínima superan el precio de venta.
        </p>
      )}
    </section>
  );
}

function Brand() {
  return (
    <div className="min-w-0">
      <p className="truncate text-[15px] leading-tight font-semibold tracking-tight">Calculadora de CPA</p>
      <p className="truncate text-xs text-muted">Costos y pauta · COP</p>
    </div>
  );
}

export function Logo() {
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
