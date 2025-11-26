// src/lib/date.js
export function monthKeyFromDate(d = new Date()) {
 
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, "0")}`;
}
export function startOfToday() {
  const d = new Date(); d.setHours(0,0,0,0); return d;
}
