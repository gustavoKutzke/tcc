// src/pages/Dashboard.js
import { useEffect, useMemo, useState } from "react";
import { computeLevel, computeBadges } from "../lib/gamification";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

/* === Kudos === */
import KudosModal from "../components/KudosModal";
import KudosBudgetCard from "../components/KudosBudgetCard";
import { monthKeyFromDate } from "../lib/date";

// 🔹 Services
import { listenCurrentUser, listenUsersByPoints } from "../services/userService";
import { listenUserGoals } from "../services/goalsService";
import { listenKudosForUserMonth } from "../services/kudosService";

export default function Dashboard() {
  const [userData, setUserData] = useState(null);
  const [goals, setGoals] = useState([]);
  const [badges, setBadges] = useState([]);
  const [chartWeekly, setChartWeekly] = useState([]);
  const [chartCumulative, setChartCumulative] = useState([]);
  const [rank, setRank] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersSorted, setUsersSorted] = useState([]);

  // Kudos do mês (lista completa)
  const [kudosOpen, setKudosOpen] = useState(false);
  const [kudosMe, setKudosMe] = useState([]);
  const monthKey = monthKeyFromDate();
  const totalKudos = useMemo(
    () => kudosMe.reduce((s, k) => s + Number(k.value || 0), 0),
    [kudosMe]
  );

  /* ===================== LISTENERS via SERVICES ===================== */

  // Usuário logado + documento em tempo real
  useEffect(() => {
    const unsub = listenCurrentUser(setUserData);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Metas do usuário
  useEffect(() => {
    if (!userData?.uid) return;
    const unsub = listenUserGoals(userData.uid, setGoals);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [userData?.uid]);

  // Kudos recebidos no mês (lista completa)
  useEffect(() => {
    if (!userData?.uid) return;
    const unsub = listenKudosForUserMonth(userData.uid, monthKey, setKudosMe);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [userData?.uid, monthKey]);

  // Ranking (todos usuários ordenados por pontos)
  useEffect(() => {
    const unsub = listenUsersByPoints((users) => {
      setUsersSorted(users);
      setTotalUsers(users.length);

      if (!userData?.uid) {
        setRank(null);
        return;
      }
      const pos = users.findIndex((u) => u.id === userData.uid);
      setRank(pos >= 0 ? pos + 1 : null);
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [userData?.uid]);

  /* ===================== DERIVADOS ===================== */

  useEffect(() => {
    if (userData) {
      const b = computeBadges({ totalPoints: userData.points, goals });
      setBadges(b);
      setChartWeekly(calcWeeklyProgress(goals));
      setChartCumulative(calcCumulativePoints(goals));
    }
  }, [userData, goals]);

  if (!userData) {
    return (
      <div className="card">
        <p className="muted">Carregando informações...</p>
      </div>
    );
  }

  const level = computeLevel(userData.points);
  const { next, progress } = nextLevelProgress(userData.points);
  const isManager = userData.role === "gestor";
  const top3 = usersSorted.slice(0, 3);

  // resumo de metas de carreira do usuário
  const careerGoals = goals.filter((g) => g.source === "career");
  const careerOpen = careerGoals.filter((g) => g.status !== "concluida").length;
  const careerDone = careerGoals.filter((g) => g.status === "concluida").length;

  return (
    <>
      <h2 className="section-title">Dashboard</h2>

      {isManager && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Top 3 Colaboradores</h3>
          {top3.length === 0 ? (
            <p className="muted">Ainda não há dados suficientes.</p>
          ) : (
            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}
            >
              {top3.map((u, i) => (
                <div
                  key={u.id}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <Avatar name={u.name || u.email} photoURL={u.photoURL} size={44} />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <strong>{u.name || u.email}</strong>
                      <span style={{ fontSize: 22 }}>{medal(i + 1)}</span>
                    </div>
                    <div className="muted" style={{ marginTop: 2 }}>
                      {Number(u.points || 0)} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ marginTop: 8 }}>
            * Ordenado por pontos totais (todas as metas concluídas).
          </p>
        </div>
      )}

      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h3>Bem-vindo(a), {userData.name || "Colaborador"} 👋</h3>
          <p className="muted">
            Você está em{" "}
            <strong>
              {rank}º {getMedal(rank)}
            </strong>{" "}
            lugar de {totalUsers} usuários.
          </p>
        </div>
        <div style={levelBadgeStyle(level.key)}>{level.label}</div>
      </div>

      {/* Kudos do mês */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <div className="muted">Kudos recebidos neste mês</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>
              {kudosMe.length} entradas • soma de valores: {totalKudos}
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => setKudosOpen(true)}>
              Dar Kudos
            </button>
          </div>
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          {kudosMe.slice(0, 3).map((k) => (
            <div key={k.id} className="card" style={{ background: "#fff8e6" }}>
              <div style={{ fontWeight: 900 }}>{k.fromName || k.fromUid}</div>
              <div className="muted">
                Valor: <strong>{k.value}</strong>
              </div>
              {k.message && (
                <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{k.message}</div>
              )}
            </div>
          ))}
          {kudosMe.length === 0 && (
            <div className="muted">Nenhum kudos recebido neste mês.</div>
          )}
        </div>
      </div>

      {/* Resumo Metas de Carreira */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <h3 style={{ margin: 0 }}>Metas de Carreira</h3>
          <span className="chip-career">Carreira</span>
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            marginTop: 10,
            gap: 10,
          }}
        >
          <div className="card" style={{ background: "#fff" }}>
            <div className="muted">Total (todas)</div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>{careerGoals.length}</div>
          </div>
          <div className="card" style={{ background: "#fff" }}>
            <div className="muted">Abertas</div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>{careerOpen}</div>
          </div>
          <div className="card" style={{ background: "#fff" }}>
            <div className="muted">Concluídas</div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>{careerDone}</div>
          </div>
        </div>
      </div>

      <KudosBudgetCard />

      <div
        className="grid"
        style={{ marginBottom: 20, gridTemplateColumns: "1fr 1fr" }}
      >
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Evolução Semanal (Metas)</h3>
          {chartWeekly.length === 0 ? (
            <p className="muted">Sem dados suficientes para gerar o gráfico.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartWeekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9e1d8" />
                <XAxis dataKey="semana" tick={{ fill: "#7b6c64" }} />
                <YAxis tick={{ fill: "#7b6c64" }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="pontos"
                  stroke="#c8a848"
                  strokeWidth={3}
                  dot={{ fill: "#3e2c22" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Progresso Acumulado (Pontos)</h3>
          {chartCumulative.length === 0 ? (
            <p className="muted">Sem dados de pontos ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartCumulative}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c8a848" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#f2df9c" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9e1d8" />
                <XAxis dataKey="dia" tick={{ fill: "#7b6c64" }} />
                <YAxis tick={{ fill: "#7b6c64" }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#c8a848"
                  strokeWidth={2}
                  fill="url(#goldGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" style={{ textAlign: "center", marginBottom: 20 }}>
        <h3 style={{ marginBottom: 6 }}>Seu Nível Atual</h3>
        <div style={levelBadgeStyle(level.key)}>{level.label}</div>
        <p style={{ marginTop: 10 }}>
          <strong>{userData.points}</strong> pontos
        </p>

        <div
          style={{
            marginTop: 12,
            background: "#f0e8de",
            borderRadius: 10,
            height: 14,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 10,
              background: "linear-gradient(135deg,var(--gold),#f2df9c)",
              width: `${progress}%`,
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Próximo nível: {next.label} ({next.min} pts)
        </p>
      </div>

      <div className="card">
        <h3>Conquistas Desbloqueadas</h3>
        {badges.length === 0 ? (
          <p className="muted">
            Nenhuma conquista ainda. Continue completando metas!
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 10,
            }}
          >
            {badges.map((b) => (
              <div key={b.key} style={badgeCard}>
                <span style={{ fontSize: 22 }}>🏅</span>
                <span style={{ fontWeight: 700, marginTop: 4 }}>{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <KudosModal open={kudosOpen} onClose={() => setKudosOpen(false)} />

      {/* pequeno CSS do chip carreira (caso Goals.js ainda não tenha sido montado na tela) */}
      <CareerChipStylesOnce />
    </>
  );
}

/* ==== utils e componentes auxiliares ==== */

function Avatar({ name, photoURL, size = 40 }) {
  const initials = getInitials(name);
  return photoURL ? (
    <img
      src={photoURL}
      alt={name}
      width={size}
      height={size}
      style={{ borderRadius: "50%", objectFit: "cover", border: "1px solid #e9e1d8" }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg,#3e2c22,#4a352b)",
        color: "#f7ead2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,.18)",
      }}
    >
      {initials}
    </div>
  );
}
function getInitials(str = "") {
  const s = (str || "").trim();
  if (!s) return "U";
  const parts = s.split(" ").filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}
function medal(pos) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return "🏅";
}
function getMedal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🎯";
}

function calcWeeklyProgress(goals) {
  const done = goals
    .filter((g) => g.status === "concluida" && g.completedAt?.toDate)
    .map((g) => g.completedAt.toDate());
  if (done.length === 0) return [];

  const grouped = {};
  for (const d of done) {
    const week = getWeekLabel(d);
    grouped[week] = (grouped[week] || 0) + 1;
  }
  return Object.entries(grouped).map(([semana, pontos]) => ({ semana, pontos }));
}

function calcCumulativePoints(goals) {
  const done = goals
    .filter((g) => g.status === "concluida" && g.completedAt?.toDate)
    .map((g) => ({ date: g.completedAt.toDate(), points: g.points || 0 }));
  if (done.length === 0) return [];

  done.sort((a, b) => a.date - b.date);
  let total = 0;
  return done.map((g) => {
    total += g.points;
    return { dia: g.date.toLocaleDateString("pt-BR"), total };
  });
}
function getWeekLabel(date) {
  const d = new Date(date);
  const week = getWeekNumber(d);
  return `Sem ${week}`;
}
function getWeekNumber(d) {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const numberOfDays = Math.floor((d - oneJan) / (24 * 60 * 60 * 1000));
  return Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
}

function nextLevelProgress(points) {
  const p = Number(points || 0);
  const levels = [
    { min: 0, label: "Bronze", key: "bronze" },
    { min: 100, label: "Prata", key: "prata" },
    { min: 250, label: "Ouro", key: "ouro" },
    { min: 500, label: "Diamante", key: "diamante" },
  ];
  let current = levels[0];
  let next = levels[1];
  for (let i = 0; i < levels.length - 1; i++) {
    if (p >= levels[i].min) {
      current = levels[i];
      next = levels[i + 1] || levels[i];
    }
  }
  const range = next.min - current.min;
  const progress = Math.min(100, ((p - current.min) / range) * 100);
  return { next, progress, current };
}

function levelBadgeStyle(levelKey) {
  const bg = {
    bronze: "linear-gradient(135deg,#caa07a,#f1d1b0)",
    prata: "linear-gradient(135deg,#c8c8c8,#efefef)",
    ouro: "linear-gradient(135deg,#c8a848,#f2df9c)",
    diamante: "linear-gradient(135deg,#9be7ff,#e6fbff)",
  }[levelKey] || "linear-gradient(135deg,#eee,#fff)";

  return {
    display: "inline-block",
    padding: "8px 18px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 16,
    color: levelKey === "diamante" ? "#183a4a" : "#3e2c22",
    background: bg,
    border: "1px solid #e9e1d8",
    boxShadow: "0 6px 12px rgba(0,0,0,.08)",
  };
}
const badgeCard = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "12px 16px",
  width: 140,
  textAlign: "center",
  boxShadow: "var(--shadow)",
};

function CareerChipStylesOnce() {
  if (typeof document === "undefined" || document.getElementById("career-chip-css-dash"))
    return null;
  const style = document.createElement("style");
  style.id = "career-chip-css-dash";
  style.innerHTML = `
  .chip-career{
    display:inline-flex; align-items:center; gap:6px;
    padding: 4px 10px; border-radius: 999px; font-weight: 800; font-size: 12px;
    color: #4a352b;
    background: linear-gradient(135deg, var(--gold, #c8a848), var(--gold-light, #f2df9c));
    border: 1px solid rgba(200,168,72,.35);
    box-shadow: 0 6px 12px rgba(200,168,72,.18);
    white-space: nowrap;
  }`;
  document.head.appendChild(style);
  return null;
}
