// src/lib/week.js
export function startOfWeek(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); 
  const diff = (day === 0 ? -6 : 1 - day); 
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfWeek(d = new Date()) {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(0, 0, 0, 0); 
  return end;
}

export function weekKey(d = new Date()) {
  
  const s = startOfWeek(d);
  const y = s.getFullYear();
  const m = String(s.getMonth() + 1).padStart(2, "0");
  const dd = String(s.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatBrDateTime(dt) {
  try {
    return new Date(dt).toLocaleString("pt-BR");
  } catch {
    return "";
  }
}
