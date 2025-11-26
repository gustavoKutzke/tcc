// src/lib/api.js
import { auth } from "./firebase";

const FUNCTIONS_BASE =
  "https://us-meutcc-5bacf.cloudfunctions.net"; 


async function getIdToken() {
  const u = auth.currentUser;
  if (!u) throw new Error("Usuário não autenticado");
  return u.getIdToken();
}

export async function callGrantXp(body) {
  const token = await getIdToken();

  const res = await fetch(`${FUNCTIONS_BASE}/grantXp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Falha no grantXp");
  }

  return res.json();
}
