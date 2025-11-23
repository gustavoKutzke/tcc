// src/components/WeeklyMissionsCard.js
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp
} from "firebase/firestore";
import { WEEKLY_MISSIONS } from "../lib/missions";
import { startOfWeek, endOfWeek, weekKey } from "../lib/week";

export default function WeeklyMissionsCard() {
  const [me, setMe] = useState(null);
  const [progress, setProgress] = useState({}); // {missionKey: number}
  const [claims, setClaims] = useState({});     // {missionKey: true}
  const [loading, setLoading] = useState(false);

  // usuário logado + escuta claims desta semana
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) { setMe(null); return; }
      setMe({ uid: u.uid });
      const wk = weekKey();
      const ref = doc(collection(db, "users", u.uid, "missionsClaims"), wk);
      const unsub2 = onSnapshot(ref, (s) => {
        setClaims(s.exists() ? (s.data() || {}) : {});
      });
      return () => unsub2();
    });
    return () => unsub();
  }, []);

  // calcula progresso das missões
  useEffect(() => {
    if (!me) return;
    let isCancelled = false;

    async function calcAll() {
      setLoading(true);
      const result = {};
      for (const m of WEEKLY_MISSIONS) {
        try {
          const v = await m.progressFn(db, me.uid);
          if (!isCancelled) result[m.key] = v;
        } catch (e) {
          if (!isCancelled) result[m.key] = 0;
          console.error("Mission progress error", m.key, e);
        }
      }
      if (!isCancelled) setProgress(result);
      setLoading(false);
    }
    calcAll();

    return () => { isCancelled = true; };
  }, [me]);

  async function claim(m) {
    if (!me) return;
    const current = Number(progress[m.key] || 0);
    if (current < m.target) return;

    const wk = weekKey();
    const claimRef = doc(collection(db, "users", me.uid, "missionsClaims"), wk);
    const userRef  = doc(db, "users", me.uid);

    try {
      await runTransaction(db, async (tx) => {
        const [claimSnap, userSnap] = await Promise.all([tx.get(claimRef), tx.get(userRef)]);

        const claimedAlready = claimSnap.exists() && !!claimSnap.data()?.[m.key];
        if (claimedAlready) throw new Error("Recompensa já resgatada para esta semana.");

        const pts = Number((userSnap.data() || {}).points || 0);
        tx.set(claimRef, { [m.key]: true, updatedAt: serverTimestamp() }, { merge: true });
        tx.update(userRef, { points: pts + Number(m.reward || 0) });
      });

      alert(`Parabéns! +${m.reward} pts adicionados 🥳`);
    } catch (e) {
      console.error(e);
      alert(e.message || "Não foi possível resgatar a recompensa.");
    }
  }

  if (!me) return null;

  const wkStart = startOfWeek();
  const wkEnd = new Date(endOfWeek() - 1);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>Missões da Semana</h3>
        <div className="muted" style={{ fontSize: 13 }}>
          {wkStart.toLocaleDateString("pt-BR")} — {wkEnd.toLocaleDateString("pt-BR")}
        </div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {WEEKLY_MISSIONS.map((m) => {
          const cur = Number(progress[m.key] || 0);
          const pct = Math.min(100, Math.round((cur / m.target) * 100));
          const done = cur >= m.target;
          const claimed = !!claims[m.key];

          return (
            <div key={m.key} className="card"
              style={{
                border: "1px solid var(--border)",
                background: "#fffdfa",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{m.title}</div>
                  <div className="muted">{m.desc}</div>
                </div>
                <div style={{
                  alignSelf: "start",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontWeight: 800,
                  background: "linear-gradient(135deg,#c8a848,#f2df9c)",
                  color: "#3e2c22",
                  border: "1px solid #e9e1d8",
                }}>
                  +{m.reward} pts
                </div>
              </div>

              {/* barra de progresso */}
              <div style={{
                marginTop: 10,
                background: "#f3ede3",
                borderRadius: 10,
                height: 12,
                position: "relative",
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: done ? "linear-gradient(135deg,#63c174,#bdf3c7)" :
                    "linear-gradient(135deg,#e6cf8e,#f7eec4)",
                  transition: "width .4s ease"
                }} />
              </div>

              <div style={{
                marginTop: 6,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div className="muted">
                  Progresso: <strong>{cur}</strong>/<strong>{m.target}</strong> ({pct}%)
                </div>

                <button
                  className="btn"
                  onClick={() => claim(m)}
                  disabled={!done || claimed || loading}
                  style={done && !claimed ? {
                    borderColor: "#e9e1d8",
                    boxShadow: "0 0 0 4px rgba(99,193,116,.18)",
                    background: "#fff",
                    fontWeight: 800
                  } : undefined}
                >
                  {claimed ? "Resgatado" : done ? "Resgatar recompensa" : "Em progresso"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {loading && <div className="muted" style={{ marginTop: 8 }}>Atualizando progresso…</div>}
    </div>
  );
}
