import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";


function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function KudosBudgetCard() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);

  // valores do colaborador selecionado
  const [budget, setBudget] = useState(10);
  const [used, setUsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const mk = useMemo(() => monthKeyFromDate(), []);
  const isManager = me?.role === "gestor";

  // pega meu perfil 
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return setMe(null);
      const snap = await getDoc(doc(db, "users", u.uid));
      setMe(snap.exists() ? { uid: u.uid, ...(snap.data() || {}) } : { uid: u.uid });
    });
    return () => unsub();
  }, []);

  // carrega lista de colaboradores (gestor)
  useEffect(() => {
    if (!isManager) return;
    const q = query(
      collection(db, "users"),
      where("role", "==", "colaborador"),
      orderBy("name")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }));
      setUsers(arr);
      if (!uid && arr.length) setUid(arr[0].uid);
      setLoading(false);
    });
    return () => unsub();
  }, [isManager, uid]);

  // quando trocar colaborador, ler orçamento/uso do mês
  useEffect(() => {
    if (!uid) return;
    let stop = false;
    (async () => {
      setErr("");
      try {
        const s = await getDoc(doc(db, "users", uid));
        const u = s.data() || {};
        const b = Number(u.kudosBudgetByMonth?.[mk] ?? 10);
        const g = Number(u.kudosGivenByMonth?.[mk] ?? 0);
        if (!stop) {
          setBudget(b);
          setUsed(g);
        }
      } catch (e) {
        if (!stop) setErr("Não foi possível carregar os dados deste colaborador.");
      }
    })();
    return () => { stop = true; };
  }, [uid, mk]);

  async function save() {
    if (!uid) return;
    const v = Number(budget);
    if (!Number.isFinite(v) || v < 0) {
      setErr("Informe um valor numérico ≥ 0.");
      return;
    }
    setSaving(true); setErr("");
    try {
      await updateDoc(doc(db, "users", uid), {
        [`kudosBudgetByMonth.${mk}`]: v
      });
      alert("Orçamento atualizado!");
    } catch (e) {
      console.error(e);
      setErr("Falha ao salvar. Verifique as regras do Firestore.");
    } finally {
      setSaving(false);
    }
  }

  if (!isManager) return null; // só gestores veem o card

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Orçamento de Kudos (mês atual)</h3>
        <div className="muted">Mês: <strong>{mk}</strong></div>
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: 8 }}>Carregando colaboradores…</p>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "1fr 160px 160px", gap: 10, marginTop: 10 }}>
            <div>
              <label className="label">Colaborador</label>
              <select className="select" value={uid} onChange={e => setUid(e.target.value)}>
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>{u.name || u.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Orçamento do mês</label>
              <input
                className="input"
                type="number"
                min={0}
                step="1"
                value={budget}
                onChange={e => setBudget(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Usado no mês</label>
              <input className="input" value={used} disabled />
            </div>
          </div>

          <div className="muted" style={{ marginTop: 8 }}>
            Restante: <strong>{Math.max(0, Number(budget) - Number(used))}</strong>
          </div>

          {err && <div className="error" style={{ marginTop: 8 }}>{err}</div>}

          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving || !uid}>
              {saving ? "Salvando…" : "Salvar orçamento"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
