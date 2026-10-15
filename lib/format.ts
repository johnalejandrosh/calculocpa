const LOCALE = "es-CO";

const copFormat = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const intFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const decimalFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormat = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 1,
});

// `|| 0` evita mostrar "-$ 0" cuando el redondeo produce -0.
const round = (n: number) => Math.round(n) || 0;

export const formatCOP = (n: number) => copFormat.format(round(n));
export const formatInt = (n: number) => intFormat.format(round(n));
export const formatCompactCOP = (n: number) => `$${compactFormat.format(round(n))}`;
export const formatRoas = (n: number | null) => (n === null ? "—" : `${decimalFormat.format(n)}x`);
export const formatPct = (n: number) => percentFormat.format(n);
