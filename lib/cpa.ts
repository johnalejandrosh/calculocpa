// Modelo y fórmulas de la calculadora de CPA.
//
// Replica la hoja de cálculo original:
//   gastos operativos = suma de costos por venta + ganancia mínima
//   CPA máximo        = venta − gastos operativos
//   CPA medio         = CPA máximo × 50 %
//   CPA mínimo        = CPA máximo × 25 %

export type CostGroup = "producto" | "flete" | "riesgo" | "operacion";

export interface CostItem {
  id: string;
  label: string;
  amount: number;
  group: CostGroup;
}

export interface Product {
  id: string;
  name: string;
  /** Precio de venta al cliente. */
  price: number;
  costs: CostItem[];
  /** Ganancia mínima que se quiere obtener por venta. */
  minProfit: number;
  /** CPA real de la campaña para el simulador; `null` usa el CPA medio. */
  adCpa: number | null;
  /** Ventas al mes para la proyección del simulador. */
  monthlyOrders: number;
}

export const TIER_RATIO = { max: 1, med: 0.5, min: 0.25 } as const;

export const COST_GROUP_LABEL: Record<CostGroup, string> = {
  producto: "Proveedor",
  flete: "Flete",
  riesgo: "Cancelaciones y devoluciones",
  operacion: "Operación y otros",
};

const DEFAULT_COSTS: ReadonlyArray<Omit<CostItem, "id">> = [
  { label: "Proveedor", amount: 0, group: "producto" },
  { label: "Flete", amount: 0, group: "flete" },
  { label: "CPA cancelación", amount: 3_000, group: "riesgo" },
  { label: "CPA devolución", amount: 4_000, group: "riesgo" },
  { label: "Devolución", amount: 3_000, group: "riesgo" },
  { label: "Sistemas", amount: 2_000, group: "operacion" },
  { label: "Asesor", amount: 10_000, group: "operacion" },
];

export const DEFAULT_MIN_PROFIT = 10_000;

/** Grupo de un costo según su nombre, para datos guardados sin grupo. */
export function inferCostGroup(label: string): CostGroup {
  return DEFAULT_COSTS.find((cost) => cost.label === label)?.group ?? "operacion";
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newCost(): CostItem {
  return { id: createId(), label: "Nuevo costo", amount: 0, group: "operacion" };
}

/** `amounts` sigue el orden de DEFAULT_COSTS. */
export function createProduct(
  name: string,
  price = 0,
  amounts: readonly number[] = [],
  minProfit = DEFAULT_MIN_PROFIT,
): Product {
  return {
    id: createId(),
    name,
    price,
    costs: DEFAULT_COSTS.map((cost, i) => ({
      ...cost,
      id: createId(),
      amount: amounts[i] ?? cost.amount,
    })),
    minProfit,
    adCpa: null,
    monthlyOrders: 0,
  };
}

export function duplicateProduct(product: Product): Product {
  return {
    ...product,
    id: createId(),
    name: `${product.name} (copia)`,
    costs: product.costs.map((cost) => ({ ...cost, id: createId() })),
  };
}

// Los cinco productos de la hoja original (Hoja1).
const SAMPLES: ReadonlyArray<[name: string, price: number, amounts: number[]]> = [
  ["Producto 1", 89_900, [18_500, 20_000, 3_000, 4_000, 3_000, 0, 10_000]],
  ["Producto 2", 100_000, [30_000, 20_000, 3_000, 4_000, 3_000, 2_000, 10_000]],
  ["Producto 3", 69_900, [16_000, 10_000, 3_000, 4_000, 3_000, 2_000, 10_000]],
  ["Producto 4", 99_900, [23_000, 18_000, 3_000, 4_000, 3_000, 2_000, 10_000]],
  ["Producto 5", 129_900, [74_000, 20_000, 3_000, 4_000, 3_000, 0, 0]],
];

export function sampleProducts(): Product[] {
  return SAMPLES.map(([name, price, amounts]) => createProduct(name, price, amounts));
}

export interface CpaResult {
  price: number;
  /** Suma de costos por venta, sin la ganancia mínima. */
  costs: number;
  /** Costos + ganancia mínima ("gastos operativos" en la hoja). */
  operating: number;
  /** CPA con el que la ganancia por venta es exactamente $0. */
  breakEven: number;
  cpaMax: number;
  cpaMed: number;
  cpaMin: number;
  /** Hay margen para pagar publicidad cumpliendo la ganancia mínima. */
  viable: boolean;
  /** ROAS que necesita la campaña para no superar cada nivel de CPA. */
  roasMax: number | null;
  roasMed: number | null;
  roasMin: number | null;
  /** CPA máximo como fracción del precio de venta. */
  cpaShare: number;
  groups: Record<CostGroup, number>;
}

export function calculate(product: Product): CpaResult {
  const groups: Record<CostGroup, number> = { producto: 0, flete: 0, riesgo: 0, operacion: 0 };
  for (const cost of product.costs) groups[cost.group] += cost.amount;

  const costs = groups.producto + groups.flete + groups.riesgo + groups.operacion;
  const operating = costs + product.minProfit;
  const cpaMax = product.price - operating;
  const cpaMed = cpaMax * TIER_RATIO.med;
  const cpaMin = cpaMax * TIER_RATIO.min;
  const roasAt = (cpa: number) => (cpa > 0 ? product.price / cpa : null);

  return {
    price: product.price,
    costs,
    operating,
    breakEven: product.price - costs,
    cpaMax,
    cpaMed,
    cpaMin,
    viable: cpaMax > 0,
    roasMax: roasAt(cpaMax),
    roasMed: roasAt(cpaMed),
    roasMin: roasAt(cpaMin),
    cpaShare: product.price > 0 ? cpaMax / product.price : 0,
    groups,
  };
}

export type Health = "excelente" | "saludable" | "limite" | "bajo-minimo" | "perdida";
export type Tone = "good" | "warning" | "serious" | "critical";

export const HEALTH: Record<Health, { label: string; hint: string; tone: Tone }> = {
  excelente: {
    label: "Excelente",
    hint: "Tu CPA está por debajo del CPA mínimo. Hay espacio para escalar la campaña.",
    tone: "good",
  },
  saludable: {
    label: "Saludable",
    hint: "Tu CPA está entre el mínimo y el medio. La campaña es rentable.",
    tone: "good",
  },
  limite: {
    label: "En el límite",
    hint: "Tu CPA está entre el medio y el máximo. Aún cumples tu ganancia mínima, pero con poco margen.",
    tone: "warning",
  },
  "bajo-minimo": {
    label: "Bajo tu ganancia mínima",
    hint: "Superas el CPA máximo: ganas dinero, pero menos de lo que te propusiste.",
    tone: "serious",
  },
  perdida: {
    label: "Pérdida",
    hint: "La publicidad cuesta más de lo que deja cada venta. Cada venta te resta dinero.",
    tone: "critical",
  },
};

export interface Simulation {
  health: Health;
  /** Ganancia real por venta después de pagar la publicidad. */
  profit: number;
  /** Diferencia contra la ganancia mínima (positiva = por encima). */
  overMin: number;
  roas: number | null;
}

export function simulate(result: CpaResult, adCpa: number): Simulation {
  const profit = result.breakEven - adCpa;
  let health: Health;
  if (profit < 0) health = "perdida";
  else if (!result.viable || adCpa > result.cpaMax) health = "bajo-minimo";
  else if (adCpa <= result.cpaMin) health = "excelente";
  else if (adCpa <= result.cpaMed) health = "saludable";
  else health = "limite";

  return {
    health,
    profit,
    overMin: result.cpaMax - adCpa,
    roas: adCpa > 0 ? result.price / adCpa : null,
  };
}

/** CPA que usa el simulador cuando el usuario aún no ha ingresado uno. */
export function effectiveAdCpa(product: Product, result: CpaResult): number {
  return product.adCpa ?? Math.max(0, Math.round(result.cpaMed));
}
