// src/pages/Timeline.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import KudosModal from "../components/KudosModal";

import {
  fetchCurrentUserForTimeline,
  subscribeCollaborators,
  fetchTimelineEvents,
} from "../services/timelineService";


function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function startEndOfMonth(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1); 
  return { start, end };
}
function toBrDate(x) {
  try {
    if (!x) return "-";
    const dt = x instanceof Date ? x : new Date(x);
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}
function isoDay(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}


const TYPE_LABEL = {
  goal_done: "Meta concluída",
  kudos_in: "Kudos recebido",
  kudos_out: "Kudos enviado",
  feedback_in: "Feedback recebido",
  badge: "Conquista",
};
const TYPE_ICON = {
  goal_done: "🎯",
  kudos_in: "👏",
  kudos_out: "🙌",
  feedback_in: "📝",
  badge: "🏅",
};

export default function Timeline() {
  const navigate = useNavigate();
  useEffect(
    () => auth.onAuthStateChanged((u) => !u && navigate("/auth")),
    [navigate]
  );

  const [me, setMe] = useState(null);
  const [isManager, setIsManager] = useState(false);

  // seleção de colaborador (gestor escolhe; colaborador vê a si mesmo)
  const [users, setUsers] = useState([]);
  const [subjectUid, setSubjectUid] = useState("");

  // filtros
  const [monthKey, setMonthKey] = useState(monthKeyFromDate());
  const [types, setTypes] = useState({
    goal_done: true,
    kudos_in: true,
    kudos_out: true,
    feedback_in: true,
    badge: true,
  });

  // feed
  const [events, setEvents] = useState([]);
  const [kudosOpen, setKudosOpen] = useState(false);
  const [presetTo, setPresetTo] = useState(null); 

  
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setMe(null);
        setIsManager(false);
        setSubjectUid("");
        return;
      }
      const base = await fetchCurrentUserForTimeline(u.uid);
      setMe(base);
      const isGestor = base?.role === "gestor";
      setIsManager(isGestor);
      setSubjectUid(isGestor ? "" : u.uid);
    });
    return () => unsub();
  }, []);

  //Carregar lista de colaboradores (apenas gestor)
  useEffect(() => {
    if (!isManager) return;
    const unsub = subscribeCollaborators(setUsers);
    return () => unsub && unsub();
  }, [isManager]);

  // Montar feed do mês
  const { start, end } = useMemo(() => {
    const [y, m] = monthKey.split("-").map((n) => parseInt(n, 10));
    const ref = new Date(y, (m || 1) - 1, 1);
    return startEndOfMonth(ref);
  }, [monthKey]);

  useEffect(() => {
    if (!subjectUid) {
      setEvents([]);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const list = await fetchTimelineEvents({
          subjectUid,
          monthKey,
          start,
          end,
        });
        if (!cancelled) setEvents(list);
      } catch (e) {
        console.error("fetchTimelineEvents error:", e);
        if (!cancelled) setEvents([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subjectUid, monthKey, start, end]);

  // Resumo Gamificado do Mês
  const summary = useMemo(() => {
    if (!events || events.length === 0) {
      return {
        totalPoints: 0,
        goalsDone: 0,
        kudosInCount: 0,
        kudosInValue: 0,
        kudosOutCount: 0,
        kudosOutValue: 0,
        feedbackCount: 0,
        badgeCount: 0,
        pdiBadges: 0,
        activeDays: 0,
        bestStreak: 0,
      };
    }

    let totalPoints = 0;
    let goalsDone = 0;
    let kudosInCount = 0;
    let kudosInValue = 0;
    let kudosOutCount = 0;
    let kudosOutValue = 0;
    let feedbackCount = 0;
    let badgeCount = 0;
    let pdiBadges = 0;

    const daySet = new Set();

    events.forEach((ev) => {
      if (!ev.at) return;
      daySet.add(isoDay(ev.at));

      if (ev.type === "goal_done") {
        goalsDone += 1;
        totalPoints += Number(ev.points || 0);
      }
      if (ev.type === "kudos_in") {
        kudosInCount += 1;
        kudosInValue += Number(ev.value || 0);
      }
      if (ev.type === "kudos_out") {
        kudosOutCount += 1;
        kudosOutValue += Number(ev.value || 0);
      }
      if (ev.type === "feedback_in") {
        feedbackCount += 1;
      }
      if (ev.type === "badge") {
        badgeCount += 1;
        if (ev.badge?.key && String(ev.badge.key).startsWith("pdi_")) {
          pdiBadges += 1;
        }
      }
    });

    // streak simples no mês
    const daysArr = Array.from(daySet.values()).sort();
    let bestStreak = 0;
    let currentStreak = 0;
    let prev = null;

    daysArr.forEach((dStr) => {
      const d = new Date(dStr + "T00:00:00");
      if (!prev) {
        currentStreak = 1;
      } else {
        const diff = (d - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      }
      prev = d;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    });

    return {
      totalPoints,
      goalsDone,
      kudosInCount,
      kudosInValue,
      kudosOutCount,
      kudosOutValue,
      feedbackCount,
      badgeCount,
      pdiBadges,
      activeDays: daySet.size,
      bestStreak,
    };
  }, [events]);

  // Render
  if (!me) {
    return (
      <div className="card">
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  const filteredEvents = events.filter((ev) => types[ev.type]);

  return (
    <>
      <h2 className="section-title">Timeline Pessoal</h2>

      {/* Controles */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: isManager ? "1fr 1fr" : "1fr",
            gap: 10,
          }}
        >
          {isManager && (
            <div>
              <label className="label">Colaborador</label>
              <select
                className="select"
                value={subjectUid}
                onChange={(e) => setSubjectUid(e.target.value)}
              >
                <option value="">— Selecione —</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Mês</label>
            <MonthPicker monthKey={monthKey} setMonthKey={setMonthKey} />
          </div>
        </div>

        {/* Filtros por tipo */}
        <div
          className="btn-row"
          style={{ marginTop: 10, flexWrap: "wrap" }}
        >
          {Object.keys(TYPE_LABEL).map((k) => (
            <button
              key={k}
              className="btn"
              onClick={() =>
                setTypes((t) => ({ ...t, [k]: !t[k] }))
              }
              style={types[k] ? activeBtn : undefined}
              title={TYPE_LABEL[k]}
            >
              {TYPE_ICON[k]} {TYPE_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo Gamificado do Mês */}
      {subjectUid && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            borderLeft: "4px solid #c8a848",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Resumo do mês</h3>
              <p className="muted" style={{ marginTop: 4 }}>
                Visão geral do impacto e engajamento neste mês.
              </p>
            </div>
            {summary.bestStreak > 0 && (
              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid #e9e1d8",
                  background: "rgba(200,168,72,.08)",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                🔥 Melhor streak: {summary.bestStreak} dia(s) seguidos
              </div>
            )}
          </div>

          <div
            className="grid"
            style={{
              marginTop: 10,
              gridTemplateColumns:
                "repeat(auto-fit,minmax(160px,1fr))",
              gap: 10,
            }}
          >
            <ResumoItem
              label="Pontos conquistados (metas)"
              value={`${summary.totalPoints} pts`}
              icon="⭐"
            />
            <ResumoItem
              label="Metas concluídas"
              value={summary.goalsDone}
              icon="🎯"
            />
            <ResumoItem
              label="Kudos recebidos"
              value={`${summary.kudosInCount} (${summary.kudosInValue} pts)`}
              icon="👏"
            />
            <ResumoItem
              label="Kudos enviados"
              value={`${summary.kudosOutCount} (${summary.kudosOutValue} pts)`}
              icon="🙌"
            />
            <ResumoItem
              label="Feedbacks formais"
              value={summary.feedbackCount}
              icon="📝"
            />
            <ResumoItem
              label="Conquistas desbloqueadas"
              value={summary.badgeCount}
              icon="🏅"
            />
            <ResumoItem
              label="Conquistas de PDI"
              value={summary.pdiBadges}
              icon="📚"
            />
            <ResumoItem
              label="Dias ativos no mês"
              value={summary.activeDays}
              icon="📆"
            />
          </div>
        </div>
      )}

      {/* Feed */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "1fr", gap: 12 }}
      >
        {subjectUid ? (
          filteredEvents.map((ev, idx) => (
            <FeedItem
              key={idx}
              ev={ev}
              onThank={(to) => {
                setPresetTo(to); 
                setKudosOpen(true);
              }}
            />
          ))
        ) : (
          <div className="card">
            <p className="muted">Selecione um colaborador.</p>
          </div>
        )}

        {subjectUid && filteredEvents.length === 0 && (
          <div className="card">
            <p className="muted">
              Sem eventos neste mês para os filtros selecionados.
            </p>
          </div>
        )}
      </div>

      {/*Kudos (agradecer de volta) */}
      <KudosModal
        open={kudosOpen}
        onClose={() => {
          setKudosOpen(false);
          setPresetTo(null);
        }}
        presetToUid={presetTo?.uid || ""}
      />
    </>
  );
}

/**Componentes*/

function ResumoItem({ label, value, icon }) {
  return (
    <div
      className="card"
      style={{ padding: 10, display: "grid", gap: 4 }}
    >
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div className="muted" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 16 }}>{value}</div>
    </div>
  );
}

function FeedItem({ ev, onThank }) {
  const base = {
    display: "grid",
    gap: 6,
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "var(--shadow)",
    padding: 12,
    background: "var(--surface)",
  };
  const header = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  if (ev.type === "goal_done") {
    return (
      <div
        className="card"
        style={{ ...base, borderLeft: "4px solid #c8a848" }}
      >
        <div style={header}>
          <div style={{ fontWeight: 900 }}>
            {TYPE_ICON.goal_done} {TYPE_LABEL.goal_done}
          </div>
          <div className="muted">{toBrDate(ev.at)}</div>
        </div>
        <div>
          <strong>{ev.title}</strong> •{" "}
          <span
            style={{
              fontWeight: 800,
              color: "#c8a848",
            }}
          >
            +{ev.points} pts
          </span>
        </div>
        {ev.desc && (
          <div
            className="muted"
            style={{ whiteSpace: "pre-wrap", marginTop: 4 }}
          >
            {ev.desc}
          </div>
        )}
      </div>
    );
  }

  if (ev.type === "kudos_in") {
    return (
      <div
        className="card"
        style={{ ...base, background: "#fff8e6" }}
      >
        <div style={header}>
          <div style={{ fontWeight: 900 }}>
            {TYPE_ICON.kudos_in} {TYPE_LABEL.kudos_in}
          </div>
          <div className="muted">{toBrDate(ev.at)}</div>
        </div>
        <div>
          <strong>De:</strong> {ev.fromName} •{" "}
          <strong>Valor:</strong> {ev.value}
        </div>
        {ev.message && (
          <div style={{ marginTop: 4 }}>{ev.message}</div>
        )}

        {ev.fromUid && (
          <div className="btn-row" style={{ marginTop: 6 }}>
            <button
              className="btn btn-primary"
              onClick={() =>
                onThank?.({
                  uid: ev.fromUid,
                  name: ev.fromName,
                })
              }
            >
              Agradecer de volta
            </button>
          </div>
        )}
      </div>
    );
  }

  if (ev.type === "kudos_out") {
    return (
      <div className="card" style={base}>
        <div style={header}>
          <div style={{ fontWeight: 900 }}>
            {TYPE_ICON.kudos_out} {TYPE_LABEL.kudos_out}
          </div>
          <div className="muted">{toBrDate(ev.at)}</div>
        </div>
        <div>
          <strong>Para:</strong> {ev.toName} •{" "}
          <strong>Valor:</strong> {ev.value}
        </div>
        {ev.message && (
          <div style={{ marginTop: 4 }}>{ev.message}</div>
        )}
      </div>
    );
  }

  if (ev.type === "feedback_in") {
    return (
      <div className="card" style={base}>
        <div style={header}>
          <div style={{ fontWeight: 900 }}>
            {TYPE_ICON.feedback_in} {TYPE_LABEL.feedback_in}
          </div>
          <div className="muted">{toBrDate(ev.at)}</div>
        </div>
        <div>
          <strong>Gestor:</strong>{" "}
          {ev.managerName || "—"}
          {ev.department ? ` • ${ev.department}` : ""}
        </div>
        <div
          className="muted"
          style={{ marginTop: 4 }}
        >
          Feedback formal registrado neste mês.
        </div>
      </div>
    );
  }

  if (ev.type === "badge") {
    const isPdiBadge =
      ev.badge?.key && String(ev.badge.key).startsWith("pdi_");

    return (
      <div
        className="card"
        style={{
          ...base,
          background: "rgba(200,168,72,.06)",
        }}
      >
        <div style={header}>
          <div style={{ fontWeight: 900 }}>
            {TYPE_ICON.badge} {TYPE_LABEL.badge}
            {isPdiBadge && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid #e9e1d8",
                  background: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                PDI
              </span>
            )}
          </div>
          <div className="muted">{toBrDate(ev.at)}</div>
        </div>
        <div style={{ fontWeight: 800 }}>
          {ev.badge?.label || "Conquista desbloqueada"}
        </div>
      </div>
    );
  }

  return null;
}

function MonthPicker({ monthKey, setMonthKey }) {
  // lista dos últimos 12 meses
  const now = new Date();
  const items = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    items.push({
      key: monthKeyFromDate(d),
      label: d.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    });
  }

  return (
    <select
      className="select"
      value={monthKey}
      onChange={(e) => setMonthKey(e.target.value)}
    >
      {items.map((it) => (
        <option key={it.key} value={it.key}>
          {it.label}
        </option>
      ))}
    </select>
  );
}


const activeBtn = {
  borderColor: "#e9e1d8",
  boxShadow: "0 0 0 4px rgba(200,168,72,.25)",
};
