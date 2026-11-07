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
  /** Monto fijo en pesos. Si hay `percent`, solo guarda el último equivalente calculado. */
  amount: number;
  /** % del precio de venta (0–100); `null` = monto fijo. Usa `costValue` para el valor real. */
  percent: number | null;
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
  /** Ganancia mínima como % del precio de venta; `null` = monto fijo `minProfit`. */
  minProfitPercent: number | null;
  /** CPA real de la campaña para el simulador; `null` usa el CPA medio. */
  adCpa: number | null;
  /** Ventas al mes para la proyección del simulador. */
  monthlyOrders: number;
  /** Pedidos generados, base (100 %) de la proyección por porcentajes. */
  projectedOrders: number;
  /** % de los pedidos generados que se envían (0–100). */
  shippedRate: number;
  /** % de los pedidos generados que se entregan y pagan (0–100, nunca más que `shippedRate`). */
  deliveredRate: number;
}

export const TIER_RATIO = { max: 1, med: 0.5, min: 0.25 } as const;

export const COST_GROUP_LABEL: Record<CostGroup, string> = {
  producto: "Proveedor",
  flete: "Flete",
  riesgo: "Cancelaciones y devoluciones",
  operacion: "Operación y otros",
};

const DEFAULT_COSTS: ReadonlyArray<Omit<CostItem, "id" | "percent">> = [
  { label: "Proveedor", amount: 0, group: "producto" },
  { label: "Flete", amount: 0, group: "flete" },
  { label: "CPA cancelación", amount: 3_000, group: "riesgo" },
  { label: "CPA devolución", amount: 4_000, group: "riesgo" },
  { label: "Devolución", amount: 3_000, group: "riesgo" },
  { label: "Sistemas", amount: 2_000, group: "operacion" },
  { label: "Asesor", amount: 10_000, group: "operacion" },
];

export const DEFAULT_MIN_PROFIT = 10_000;

/** Escenario inicial de la proyección: de 100 pedidos se envían 80 y se entregan 60. */
export const DEFAULT_PROJECTION = { projectedOrders: 100, shippedRate: 80, deliveredRate: 60 } as const;

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
  return { id: createId(), label: "Nuevo costo", amount: 0, percent: null, group: "operacion" };
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
      percent: null,
    })),
    minProfit,
    minProfitPercent: null,
    adCpa: null,
    monthlyOrders: 0,
    ...DEFAULT_PROJECTION,
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

/** Producto de ejemplo, con los valores del primero de la hoja original (Hoja1). */
export function sampleProduct(): Product {
  return createProduct("Producto de ejemplo", 89_900, [18_500, 20_000, 3_000, 4_000, 3_000, 0, 10_000]);
}

/** Valor en pesos de un monto que puede ser fijo o un % del precio de venta. */
export function valueOf(amount: number, percent: number | null, price: number): number {
  return percent === null ? amount : (price * percent) / 100;
}

/** Valor en pesos de un costo por venta. */
export const costValue = (cost: CostItem, price: number) => valueOf(cost.amount, cost.percent, price);

export interface CpaResult {
  price: number;
  /** Ganancia mínima por venta en pesos (ya convertida si se definió como %). */
  minProfit: number;
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
  for (const cost of product.costs) groups[cost.group] += costValue(cost, product.price);

  const costs = groups.producto + groups.flete + groups.riesgo + groups.operacion;
  const minProfit = valueOf(product.minProfit, product.minProfitPercent, product.price);
  const operating = costs + minProfit;
  const cpaMax = product.price - operating;
  const cpaMed = cpaMax * TIER_RATIO.med;
  const cpaMin = cpaMax * TIER_RATIO.min;
  const roasAt = (cpa: number) => (cpa > 0 ? product.price / cpa : null);

  return {
    price: product.price,
    minProfit,
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

// ---------------------------------------------------------------------------
// Proyección por porcentajes
//
// Sigue la secuencia de un pedido contraentrega sobre los pedidos generados (100 %):
//   generados → enviados → entregados
//   cancelados = generados − enviados   (no salen; solo se pierde la pauta)
//   devueltos  = enviados − entregados  (pagan flete y no dejan ingreso)
//
// Reutiliza los grupos de costos y el CPA del cálculo por precio:
//   pauta      = CPA × pedidos generados
//   flete      = costos del grupo "flete" × pedidos enviados
//   proveedor  = costos del grupo "producto" × entregas
//   operación  = costos del grupo "operacion" × entregas
// Los costos del grupo "riesgo" (cancelaciones y devoluciones) NO se suman: son el
// mismo riesgo prorrateado por venta, y aquí ya se calcula con los porcentajes.

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

/** Porcentajes coherentes con la secuencia: 0 ≤ entregas ≤ envíos ≤ 100. */
export function normalizeRates(shippedRate: number, deliveredRate: number) {
  const shipped = clamp(shippedRate, 0, 100);
  return { shippedRate: shipped, deliveredRate: clamp(deliveredRate, 0, shipped) };
}

export type ProjectionHealth = "ganancia" | "bajo-minimo" | "perdida";

export interface Projection {
  orders: number;
  shipped: number;
  delivered: number;
  canceled: number;
  returned: number;
  /** Lo que pagan los clientes de las entregas efectivas. */
  revenue: number;
  adSpend: number;
  supplier: number;
  freight: number;
  operating: number;
  netProfit: number;
  /** Ganancia neta repartida entre las entregas; `null` sin entregas. */
  profitPerDelivery: number | null;
  /** Ganancia mínima por venta × entregas. */
  minProfitGoal: number;
  /** Pauta de pedidos no entregados + flete de devoluciones, por cada entrega. */
  riskPerDelivery: number | null;
  /** % de entregas (0–1) para no perder dinero con los envíos actuales; `null` si no se alcanza. */
  breakEvenRate: number | null;
  /** % de entregas (0–1) para ganar la ganancia mínima por venta; `null` si no se alcanza. */
  goalRate: number | null;
  /** CPA por pedido con el que se gana justo la ganancia mínima en este escenario. */
  maxCpaPerOrder: number;
  health: ProjectionHealth;
}

/** % de entregas necesario para que `d × margen ≥ costos fijos por pedido`, o `null`. */
function requiredRate(fixedPerOrder: number, marginPerDelivery: number, maxRate: number) {
  if (marginPerDelivery <= 0) return null;
  const rate = Math.max(0, fixedPerOrder / marginPerDelivery);
  return rate <= maxRate ? rate : null;
}

export function project(product: Product, result: CpaResult, adCpa: number): Projection {
  const { shippedRate, deliveredRate } = normalizeRates(product.shippedRate, product.deliveredRate);
  const orders = Math.max(0, Math.round(product.projectedOrders));
  const shipped = Math.round((orders * shippedRate) / 100);
  const delivered = Math.min(shipped, Math.round((orders * deliveredRate) / 100));
  const canceled = orders - shipped;
  const returned = shipped - delivered;

  const { producto, flete, operacion } = result.groups;
  const revenue = delivered * product.price;
  const adSpend = orders * adCpa;
  const supplier = delivered * producto;
  const freight = shipped * flete;
  const operating = delivered * operacion;
  const netProfit = revenue - adSpend - supplier - freight - operating;
  const minProfitGoal = delivered * result.minProfit;

  // Por pedido generado: ganancia = d × (venta − proveedor − operación) − e × flete − CPA.
  const s = shippedRate / 100;
  const marginPerDelivery = product.price - producto - operacion;
  const fixedPerOrder = adCpa + s * flete;
  const breakEvenRate = requiredRate(fixedPerOrder, marginPerDelivery, s);
  const goalRate = requiredRate(fixedPerOrder, marginPerDelivery - result.minProfit, s);
  const maxCpaPerOrder =
    orders > 0 ? (delivered * (marginPerDelivery - result.minProfit) - freight) / orders : 0;

  return {
    orders,
    shipped,
    delivered,
    canceled,
    returned,
    revenue,
    adSpend,
    supplier,
    freight,
    operating,
    netProfit,
    profitPerDelivery: delivered > 0 ? netProfit / delivered : null,
    minProfitGoal,
    riskPerDelivery: delivered > 0 ? ((orders - delivered) * adCpa + returned * flete) / delivered : null,
    breakEvenRate,
    goalRate,
    maxCpaPerOrder,
    health: netProfit < 0 ? "perdida" : netProfit < minProfitGoal ? "bajo-minimo" : "ganancia",
  };
}
