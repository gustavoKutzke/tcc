// src/utils/dateUtils.js

/**
 * Gera uma chave de mês no formato YYYY-MM (ex.: 2025-11)
 */
export function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Retorna o range de um mês (apenas com Date):
 * - start: primeiro dia do mês 00:00
 * - end: primeiro dia do mês seguinte 00:00 (exclusivo)
 */
export function getMonthRange(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { start, end };
}

/**
 * Últimos N meses (inclui o mês atual)
 * Retorna array de monthKey (YYYY-MM)
 */
export function lastNMonths(n = 6) {
  const arr = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(monthKeyFromDate(d));
  }
  return arr;
}

/**
 * Label de mês no padrão brasileiro: MMM/AA (ex.: Nov/25)
 */
export function brMonthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const names = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${names[m - 1]}/${String(y).slice(-2)}`;
}

/**
 * Converte Date -> "YYYY-MM-DD"
 */
export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Lista todos os dias entre start (inclusivo) e endExcl (exclusivo),
 * no formato "YYYY-MM-DD"
 */
export function enumerateDays(start, endExcl) {
  const days = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(
    endExcl.getFullYear(),
    endExcl.getMonth(),
    endExcl.getDate()
  );

  while (d < end) {
    days.push(isoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/**
 * Converte "YYYY-MM-DD" -> "DD/MM"
 */
export function formatBr(iso) {
  if (!iso || typeof iso !== "string") return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}
