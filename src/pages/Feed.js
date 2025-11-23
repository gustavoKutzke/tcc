// src/pages/Feed.js
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Util: YYYY-MM (p/ filtrar kudos do mês atual) */
function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function Feed() {
  const [me, setMe] = useState(null);
  const [kudos, setKudos] = useState([]);
  const [goals, setGoals] = useState([]);
  const [filter, setFilter] = useState("all"); // all | 7days | mine
  const mk = monthKeyFromDate();

  /* ===== Auth (para filtro "Meu feed") ===== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u || null));
    return () => unsub?.();
  }, []);

  /* ===== Streams SIMPLES (sem fallback dentro do onSnapshot) ===== */
  useEffect(() => {
    // KUDOS: mês atual
    const qK = query(
      collection(db, "kudos"),
      where("monthKey", "==", mk),
      orderBy("createdAt", "desc")
    );

    const unsubKudos = onSnapshot(qK, (snap) => {
      const arr = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: `k_${d.id}`,
          type: "kudo",
          fromUid: data.fromUid,
          fromName: data.fromName,
          toUid: data.toUid,
          toName: data.toName,
          value: data.value || 0,
          message: data.message || "",
          createdAt: data.createdAt,
          date: data.createdAt?.toDate?.() || new Date(0),
        };
      });
      setKudos(arr);
    });

    // GOALS: apenas concluídas
    const qG = query(
      collection(db, "goals"),
      where("status", "==", "concluida"),
      orderBy("completedAt", "desc")
    );

    const unsubGoals = onSnapshot(qG, (snap) => {
      const arr = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: `g_${d.id}`,
          type: "goal",
          ownerUid: data.ownerUid,
          ownerName: data.ownerName,
          title: data.title || "Meta",
          points: Number(data.points || 0),
          completedAt: data.completedAt,
          date: data.completedAt?.toDate?.() || new Date(0),
        };
      });
      setGoals(arr);
    });

    return () => {
      unsubKudos?.();
      unsubGoals?.();
    };
  }, [mk]);

  /* ===== Feed combinado + filtros ===== */
  const items = useMemo(() => {
    let combined = [...kudos, ...goals];

    // filtro últimos 7 dias
    if (filter === "7days") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      combined = combined.filter((it) => it.date >= weekAgo);
    }

    // filtro "Meu feed": envolve eu reconhecer / ser reconhecido / metas minhas
    if (filter === "mine" && me) {
      combined = combined.filter(
        (it) =>
          it.fromUid === me.uid ||
          it.toUid === me.uid ||
          it.ownerUid === me.uid
      );
    }

    // ordena por data (desc)
    combined.sort((a, b) => b.date - a.date);
    return combined;
  }, [kudos, goals, filter, me]);

  return (
    <div>
      <h2 className="section-title">📋 Mural de Feedbacks</h2>

      {/* Filtros */}
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button
          className={`btn ${filter === "all" ? "btn-primary" : ""}`}
          onClick={() => setFilter("all")}
        >
          Todos
        </button>
        <button
          className={`btn ${filter === "7days" ? "btn-primary" : ""}`}
          onClick={() => setFilter("7days")}
        >
          Últimos 7 dias
        </button>
        <button
          className={`btn ${filter === "mine" ? "btn-primary" : ""}`}
          onClick={() => setFilter("mine")}
          disabled={!me}
          title={!me ? "Entre para ver seu feed" : ""}
        >
          Meu feed
        </button>
      </div>

      {items.length === 0 ? (
        <p className="muted">Nenhuma atividade encontrada.</p>
      ) : (
        <div className="feed-grid">
          {items.map((it) =>
            it.type === "kudo" ? (
              <KudoCard key={it.id} it={it} />
            ) : (
              <GoalCard key={it.id} it={it} />
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ====== Cards ====== */

function KudoCard({ it }) {
  return (
    <div className="card kudo">
      <div style={{ fontWeight: 900 }}>
        👏 {it.fromName || it.fromUid} elogiou {it.toName || it.toUid}
      </div>
      {it.message && (
        <div style={{ marginTop: 4 }}>
          <q>{it.message}</q>
        </div>
      )}
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        +{it.value} ⭐ • {format(it.date, "dd/MM/yyyy, HH:mm:ss", { locale: ptBR })}
      </div>
    </div>
  );
}

function GoalCard({ it }) {
  return (
    <div className="card">
      <div style={{ fontWeight: 900 }}>
        🎯 {it.ownerName || it.ownerUid} concluiu a meta:
      </div>
      <div style={{ marginTop: 4 }}>{it.title}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        +{it.points} pts • {format(it.date, "dd/MM/yyyy, HH:mm:ss", { locale: ptBR })}
      </div>
    </div>
  );
}

/* ===== CSS do feed (injetado uma única vez) ===== */
const css = `
.feed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 16px;
}

/* Card base */
.card {
  background: #fff;
  border: 1px solid #e6d6b8;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 10px rgba(0,0,0,.05);
  transition: transform .2s ease, box-shadow .2s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,.1);
}

/* === Estilo ESPECIAL dos KUDOS === */
.card.kudo {
  position: relative;
  background: linear-gradient(180deg, #fff9e6, #fffdf6);
  border: 1px solid #f1e3b6;
  box-shadow: 0 8px 18px rgba(200, 168, 72, 0.15);
  transition: transform .2s ease, box-shadow .2s ease, background .25s ease;
}

/* selo "Kudos" */
.card.kudo::before {
  content: "⭐ Kudos";
  position: absolute;
  top: -10px;
  left: 12px;
  font-size: 12px;
  font-weight: 900;
  color: #4a352b;
  background: linear-gradient(135deg, #f7e7a6, #f1d97a);
  border: 1px solid #e9d37a;
  border-radius: 999px;
  padding: 4px 10px;
  box-shadow: 0 6px 12px rgba(200,168,72,.18);
}

/* borda animada */
.card.kudo::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 12px;
  padding: 1px;
  background: linear-gradient(135deg, #e8c85a, #f2df9c, #e8c85a);
  background-size: 200% 200%;
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  opacity: 0;
  transition: opacity .25s ease;
}
.card.kudo:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(200, 168, 72, 0.22);
  background: linear-gradient(180deg, #fff7dc, #fffdf8);
}
.card.kudo:hover::after {
  opacity: 1;
  animation: goldFlow 2s linear infinite;
}
@keyframes goldFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.card.kudo .muted { color: #6e5e3f; }
.card.kudo strong { color: #3e2c22; }
`;

/* injeta o CSS inline uma única vez */
if (typeof document !== "undefined" && !document.getElementById("feed-css")) {
  const style = document.createElement("style");
  style.id = "feed-css";
  style.innerHTML = css;
  document.head.appendChild(style);
}
