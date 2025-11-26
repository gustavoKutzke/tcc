// src/pages/Ranking.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";

import {
  fetchCurrentUser,
  fetchGoalsInRange,
  fetchKudosForMonth,
} from "../services/rankingService";



export default function Ranking() {
  const navigate = useNavigate();


  useEffect(
    () => auth.onAuthStateChanged((u) => !u && navigate("/auth")),
    [navigate]
  );

 
  const [me, setMe] = useState(null);
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setMe(null);
        return;
      }
      const meData = await fetchCurrentUser(u.uid);
      setMe(meData);
    });
    return () => unsub();
  }, []);

  const isManager = me?.role === "gestor";

  
  const [view, setView] = useState("ranking"); 

  //Estados do modo Ranking 
  const [period, setPeriod] = useState("weekly"); 
  const [data, setData] = useState([]); 
  const [dailySeries, setDailySeries] = useState([]); 
  const [dailyPrevSeries, setDailyPrevSeries] = useState([]); 
  const [metric, setMetric] = useState("points"); 
  const [loading, setLoading] = useState(true);

 
  const { startDate, endDate, title } = useMemo(() => {
    const now = new Date();
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    let start;
    if (period === "weekly") {
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6
      ); 
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1); 
    }
    return {
      startDate: start,
      endDate: end,
      title:
        period === "weekly"
          ? "Ranking Semanal (últimos 7 dias)"
          : "Ranking Mensal (mês atual)",
    };
  }, [period]);

 
  useEffect(() => {
    async function load() {
      if (!me) return; 
      setLoading(true);
      try {
        const goals = await fetchGoalsInRange({
          start: startDate,
          end: endDate,
          ownerUid: isManager ? null : me.uid,
        });

        
        const map = new Map();
        const rows = [];
        goals.forEach((g) => {
          if (g.status !== "concluida") return;
          rows.push(g);

          const uid = g.ownerUid;
          const name = g.ownerName || g.ownerUid || "—";
          const prev = map.get(uid) || { uid, name, points: 0, tasks: 0 };
          prev.points += Number(g.points || 0);
          prev.tasks += 1;
          map.set(uid, prev);
        });

        const list = Array.from(map.values()).sort(
          (a, b) => b.points - a.points
        );
        setData(list);

        // série diária do período atual
        const days = enumerateDays(startDate, endDate);
        const dayMap = new Map(
          days.map((d) => [d, { date: d, points: 0, tasks: 0 }])
        );
        rows.forEach((g) => {
          if (!g.completedAt?.toDate) return;
          const d = g.completedAt.toDate();
          const key = isoDate(d);
          if (dayMap.has(key)) {
            const it = dayMap.get(key);
            it.points += Number(g.points || 0);
            it.tasks += 1;
          }
        });
        setDailySeries(Array.from(dayMap.values()));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate, me, isManager]);

 
  useEffect(() => {
    async function loadPrev() {
      if (!me) return;

      const start = startDate;
      const end = endDate;
      const daysCount = Math.max(
        1,
        Math.round((end - start) / (1000 * 60 * 60 * 24))
      );

      const prevEnd = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
      ); 
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - daysCount);

      const goalsPrev = await fetchGoalsInRange({
        start: prevStart,
        end: prevEnd,
        ownerUid: isManager ? null : me.uid,
      });

      const days = enumerateDays(prevStart, prevEnd);
      const dayMap = new Map(
        days.map((d) => [d, { date: d, points: 0, tasks: 0 }])
      );
      goalsPrev.forEach((g) => {
        if (g.status !== "concluida" || !g.completedAt?.toDate) return;
        const d = g.completedAt.toDate();
        const key = isoDate(d);
        if (dayMap.has(key)) {
          const it = dayMap.get(key);
          it.points += Number(g.points || 0);
          it.tasks += 1;
        }
      });
      setDailyPrevSeries(Array.from(dayMap.values()));
    }
    loadPrev();
  }, [startDate, endDate, me, isManager]);

  //Destaques
  const [hlLoading, setHlLoading] = useState(false);
  const [topPointsMonth, setTopPointsMonth] = useState([]); 
  const [topKudosMonth, setTopKudosMonth] = useState([]); 
  const [topTasksMonth, setTopTasksMonth] = useState([]); 

  useEffect(() => {
    if (view !== "highlights" || !me) return;

    async function loadHighlights() {
      setHlLoading(true);
      try {
        
        const now = new Date();
        const startM = new Date(now.getFullYear(), now.getMonth(), 1);
        const endM = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        
        const goalsMonth = await fetchGoalsInRange({
          start: startM,
          end: endM,
          ownerUid: isManager ? null : me.uid,
        });

        const mapPoints = new Map();
        const mapTasks = new Map(); 
        goalsMonth.forEach((g) => {
          if (g.status !== "concluida") return;
          const uid = g.ownerUid;
          const name = g.ownerName || g.ownerUid || "—";
          const pPrev = mapPoints.get(uid) || { uid, name, points: 0 };
          const tPrev = mapTasks.get(uid) || { uid, name, tasks: 0 };
          pPrev.points += Number(g.points || 0);
          tPrev.tasks += 1;
          mapPoints.set(uid, pPrev);
          mapTasks.set(uid, tPrev);
        });

        const listPoints = Array.from(mapPoints.values())
          .sort((a, b) => b.points - a.points)
          .slice(0, 3);
        const listTasks = Array.from(mapTasks.values())
          .sort((a, b) => b.tasks - a.tasks)
          .slice(0, 3);
        setTopPointsMonth(listPoints);
        setTopTasksMonth(listTasks);

        
        const monthKey = monthKeyFromDate(now);
        const kudosRows = await fetchKudosForMonth({
          monthKey,
          toUid: isManager ? null : me.uid,
        });

        const mapK = new Map(); 
        kudosRows.forEach((k) => {
          const uid = k.toUid;
          const name = k.toName || k.toUid || "—";
          const prev = mapK.get(uid) || { uid, name, total: 0 };
          prev.total += Number(k.value || 0);
          mapK.set(uid, prev);
        });
        const listKudos = Array.from(mapK.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 3);
        setTopKudosMonth(listKudos);
      } finally {
        setHlLoading(false);
      }
    }

    loadHighlights();
  }, [view, me, isManager]);

  //Meu desempenho no período
  const myRow = useMemo(
    () => (me && data ? data.find((r) => r.uid === me.uid) || null : null),
    [me, data]
  );
  const myPosition = useMemo(
    () => (myRow ? data.findIndex((r) => r.uid === myRow.uid) + 1 : null),
    [myRow, data]
  );
  const myLevelLabel = useMemo(
    () => levelFromPoints(myRow?.points || 0),
    [myRow]
  );

  return (
    <>
      <h2 className="section-title">Ranking / Destaques</h2>

      {}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => setView("ranking")}
            style={view === "ranking" ? activeBtn : undefined}
          >
            Ranking
          </button>
          <button
            className="btn"
            onClick={() => setView("highlights")}
            style={view === "highlights" ? activeBtn : undefined}
          >
            Destaques do Mês
          </button>

          {view === "ranking" && (
            <>
              <span style={{ width: 12 }} />
              <button
                className="btn"
                onClick={() => setPeriod("weekly")}
                style={period === "weekly" ? activeBtn : undefined}
              >
                Semanal
              </button>
              <button
                className="btn"
                onClick={() => setPeriod("monthly")}
                style={period === "monthly" ? activeBtn : undefined}
              >
                Mensal
              </button>

              <button
                className="btn"
                onClick={() => exportCSV(data, dailySeries, period)}
                style={{ marginLeft: "auto" }}
              >
                Exportar CSV
              </button>
            </>
          )}
        </div>

        {view === "ranking" && (
          <div className="muted" style={{ marginTop: 6 }}>
            {title}
          </div>
        )}
      </div>

      {view === "ranking" ? (
        <>
          {}
          {me && (
            <div
              className="card"
              style={{
                marginBottom: 12,
                borderLeft: "4px solid #c8a848",
                background: "rgba(200,168,72,.04)",
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
                  <div style={{ fontSize: 13 }}>Meu desempenho no período</div>
                  <div style={{ fontWeight: 900 }}>
                    {me.name || me.email || "Você"}
                  </div>
                  {myRow ? (
                    <div
                      className="muted"
                      style={{ fontSize: 13, marginTop: 2 }}
                    >
                      Você é o <strong>#{myPosition}</strong> no ranking com{" "}
                      <strong>{myRow.points} pts</strong> em{" "}
                      <strong>{myRow.tasks} metas concluídas</strong>.
                      {!isManager && " (visão individual)"}
                    </div>
                  ) : (
                    <div
                      className="muted"
                      style={{ fontSize: 13, marginTop: 2 }}
                    >
                      Ainda sem metas concluídas neste período. Comece a
                      bater metas para entrar no ranking! 💪
                    </div>
                  )}
                </div>
                {myRow && (
                  <div style={{ textAlign: "right" }}>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Nível no período
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid #e9e1d8",
                        fontWeight: 800,
                        background: "rgba(248,242,230,.8)",
                      }}
                    >
                      {myLevelLabel}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top 3 */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            }}
          >
            {loading && (
              <div className="card">
                <p className="muted">Carregando...</p>
              </div>
            )}
            {!loading &&
              data.slice(0, 3).map((u, i) => (
                <div
                  key={u.uid}
                  className="card"
                  style={{ textAlign: "center", paddingTop: 22 }}
                >
                  <div style={{ fontSize: 36 }}>{medal(i)}</div>
                  <div style={{ fontWeight: 900, marginTop: 6 }}>{u.name}</div>
                  <div className="muted" style={{ marginTop: 2 }}>
                    {u.tasks} metas concluídas
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontWeight: 900,
                      fontSize: 18,
                    }}
                  >
                    {u.points} pts
                  </div>
                  <div
                    className="muted"
                    style={{ marginTop: 4, fontSize: 12 }}
                  >
                    Nível: <strong>{levelFromPoints(u.points)}</strong>
                  </div>
                </div>
              ))}
          </div>

          {}
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 6 }}>Pontos por Colaborador</h3>
            {loading ? (
              <p className="muted">Carregando...</p>
            ) : (
              <BarChart data={data} height={280} />
            )}
            <p className="muted" style={{ marginTop: 8 }}>
              * Total de pontos por colaborador considerando metas{" "}
              <strong>concluídas</strong> no período.
              {!isManager &&
                " (no seu caso, apenas suas próprias metas devido às regras de segurança)"}
            </p>
          </div>

          {}
          <div className="card" style={{ marginTop: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <h3 style={{ marginBottom: 6 }}>Evolução diária</h3>
              <div className="btn-row">
                <button
                  className="btn"
                  onClick={() => setMetric("points")}
                  style={metric === "points" ? activeBtn : undefined}
                >
                  Pontos
                </button>
                <button
                  className="btn"
                  onClick={() => setMetric("tasks")}
                  style={metric === "tasks" ? activeBtn : undefined}
                >
                  Metas
                </button>
              </div>
            </div>
            {loading ? (
              <p className="muted">Carregando...</p>
            ) : (
              <LineChartDaily
                data={dailySeries}
                metric={metric}
                height={260}
              />
            )}
            <p className="muted" style={{ marginTop: 8 }}>
              * Soma diária de{" "}
              <strong>
                {metric === "points" ? "pontos" : "metas concluídas"}
              </strong>{" "}
              no período selecionado.
            </p>
          </div>

          {/* Comparativo histórico */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 6 }}>
              Comparativo histórico (período anterior)
            </h3>
            {loading ? (
              <p className="muted">Carregando...</p>
            ) : (
              <LineChartCompare
                dataNow={dailySeries}
                dataPrev={dailyPrevSeries}
                metric={metric}
                height={260}
              />
            )}
            <p className="muted" style={{ marginTop: 8 }}>
              * Linha sólida = período atual • Linha tracejada = período
              anterior (mesma duração).
            </p>
          </div>

          {/* Tabela completa */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 10 }}>Classificação Geral</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Pos.</th>
                    <th style={th}>Colaborador</th>
                    <th style={th}>Metas</th>
                    <th style={th}>Pontos</th>
                    <th style={th}>Nível</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && data.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 14 }} className="muted">
                        Sem dados para o período.
                      </td>
                    </tr>
                  )}
                  {data.map((u, idx) => (
                    <tr key={u.uid} style={idx < 3 ? rowTop : undefined}>
                      <td style={td}>{idx + 1}</td>
                      <td
                        style={{
                          ...td,
                          fontWeight: idx < 3 ? 800 : 600,
                        }}
                      >
                        {u.name}
                      </td>
                      <td style={td}>{u.tasks}</td>
                      <td style={td}>{u.points}</td>
                      <td style={td}>{levelFromPoints(u.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        //Destaques do Mês
        <>
          <div className="card" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Destaques do Mês</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Top 3 por categoria — pontos (metas), kudos recebidos e metas
              concluídas no mês atual.
              {!isManager &&
                " (para colaboradores, os dados são baseados apenas na sua própria atuação, conforme regras de segurança do sistema)."}
            </p>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 12,
            }}
          >
            <HighlightCard
              title={isManager ? "Top Pontos (mês)" : "Meus Pontos (mês)"}
              loading={hlLoading}
              items={topPointsMonth}
              valueKey="points"
              valueLabel="pts"
              color="#c8a848"
              icon="🏆"
            />
            <HighlightCard
              title={
                isManager
                  ? "Mais Kudos Recebidos (mês)"
                  : "Meus Kudos Recebidos (mês)"
              }
              loading={hlLoading}
              items={topKudosMonth}
              valueKey="total"
              valueLabel="kudos"
              color="#4a8f5f"
              icon="👏"
            />
            <HighlightCard
              title={
                isManager
                  ? "Quem Mais Concluiu Metas (mês)"
                  : "Minhas Metas Concluídas (mês)"
              }
              loading={hlLoading}
              items={topTasksMonth}
              valueKey="tasks"
              valueLabel="metas"
              color="#3f78a2"
              icon="🎯"
            />
          </div>
        </>
      )}
    </>
  );
}

/* Destaques*/
function HighlightCard({
  title,
  loading,
  items,
  valueKey,
  valueLabel,
  color,
  icon,
}) {
  return (
    <div className="card" style={{ minHeight: 180 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      {loading ? (
        <p className="muted" style={{ marginTop: 10 }}>
          Carregando…
        </p>
      ) : items.length === 0 ? (
        <p className="muted" style={{ marginTop: 10 }}>
          Sem dados neste mês.
        </p>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {items.map((it, i) => (
            <div
              key={it.uid || i}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#fffdf3",
              }}
            >
              <div style={{ fontSize: 22 }}>{medal(i)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900 }}>{it.name}</div>
                <div className="muted">
                  {Number(it[valueKey] || 0)} {valueLabel}
                </div>
              </div>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: color,
                  opacity: 0.8,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/*Export CSV*/
function exportCSV(rankRows, dailyRows, period) {
  const lines = [];
  lines.push(`Periodo,${period === "weekly" ? "Semanal" : "Mensal"}`);
  lines.push("");
  lines.push("Ranking (por colaborador)");
  lines.push("Posicao,Colaborador,Metas,Pontos,Nivel");
  rankRows.forEach((r, i) => {
    lines.push(
      `${i + 1},"${(r.name || "").replace(/"/g, '""')}",${r.tasks},${
        r.points
      },${levelFromPoints(r.points)}`
    );
  });

  lines.push("");
  lines.push("Evolucao diaria");
  lines.push("Data,Metas,Pontos");
  dailyRows.forEach((d) => {
    lines.push(`${formatBr(d.date)},${d.tasks},${d.points}`);
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ranking_${period}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/*Gráficos*/
function BarChart({ data, height = 260, padding = 32 }) {
  const top = data.slice(0, 10);
  const labels = top.map((d) => d.name || "—");
  const values = top.map((d) => Number(d.points || 0));
  const maxVal = Math.max(1, ...values);

  const width = 800;
  const barAreaW = width - padding * 2;
  const barAreaH = height - padding * 2;
  const barW = barAreaW / (top.length || 1);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={Math.max(width, padding * 2 + barW * top.length)}
        height={height}
        style={{ display: "block", maxWidth: "100%" }}
      >
        <rect x="0" y="0" width="100%" height="100%" fill="#fff" rx="12" />
        {Array.from({ length: 4 }).map((_, i) => {
          const y = padding + (barAreaH * i) / 4;
          return (
            <line
              key={i}
              x1={padding}
              x2={padding + barAreaW}
              y1={y}
              y2={y}
              stroke="#e9e1d8"
            />
          );
        })}
        {top.map((d, i) => {
          const v = values[i];
          const h = (v / maxVal) * (barAreaH - 8);
          const x = padding + i * barW + barW * 0.15;
          const y = padding + (barAreaH - h);
          const w = barW * 0.7;

          return (
            <g key={d.uid || i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="#c8a848"
                opacity="0.85"
                stroke="#e9e1d8"
              />
              <text
                x={x + w / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="12"
                fill="#3e2c22"
                fontWeight="700"
              >
                {v}
              </text>
              <text
                x={x + w / 2}
                y={padding + barAreaH + 14}
                textAnchor="middle"
                fontSize="12"
                fill="#7b6c64"
              >
                {shorten(labels[i], 14)}
              </text>
            </g>
          );
        })}
        <text x={padding} y={padding - 10} fontSize="12" fill="#7b6c64">
          Pontos
        </text>
      </svg>
    </div>
  );
}

function LineChartDaily({ data, metric = "points", height = 240, padding = 32 }) {
  const values = data.map((d) => Number(d[metric] || 0));
  const maxVal = Math.max(1, ...values);
  const width = Math.max(680, padding * 2 + Math.max(0, data.length - 1) * 40);
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const points = data.map((d, i) => {
    const x =
      padding +
      (data.length <= 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
    const y = padding + (plotH - (values[i] / maxVal) * plotH);
    return { x, y, v: values[i], label: d.date };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
    .join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={width}
        height={height}
        style={{ display: "block", maxWidth: "100%" }}
      >
        <rect x="0" y="0" width="100%" height="100%" fill="#ffffff" rx="12" />
        {Array.from({ length: 4 }).map((_, i) => {
          const y = padding + (plotH * i) / 4;
          return (
            <line
              key={i}
              x1={padding}
              x2={padding + plotW}
              y1={y}
              y2={y}
              stroke="#e9e1d8"
            />
          );
        })}

        <path d={pathD} fill="none" stroke="#c8a848" strokeWidth="2.5" />
        {points.length > 1 && (
          <path
            d={`${pathD} L ${padding + plotW},${
              padding + plotH
            } L ${padding},${padding + plotH} Z`}
            fill="rgba(200,168,72,0.10)"
          />
        )}

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#c8a848" stroke="#4a352b" />
            <text
              x={p.x}
              y={p.y - 8}
              fontSize="11"
              textAnchor="middle"
              fill="#3e2c22"
              fontWeight="700"
            >
              {p.v}
            </text>
            {(i === 0 ||
              i === points.length - 1 ||
              points.length <= 10 ||
              i % Math.ceil(points.length / 8) === 0) && (
              <text
                x={p.x}
                y={padding + plotH + 14}
                fontSize="11"
                textAnchor="middle"
                fill="#7b6c64"
              >
                {formatBr(p.label)}
              </text>
            )}
          </g>
        ))}

        <text x={padding} y={padding - 10} fontSize="12" fill="#7b6c64">
          {metric === "points" ? "Pontos/dia" : "Metas/dia"}
        </text>
      </svg>
    </div>
  );
}

function LineChartCompare({
  dataNow,
  dataPrev,
  metric = "points",
  height = 240,
  padding = 32,
}) {
  const len = Math.max(dataNow.length, dataPrev.length);
  const padArray = (arr) => {
    if (arr.length === len) return arr;
    const last = arr[arr.length - 1] || {
      date: "",
      points: 0,
      tasks: 0,
    };
    return [
      ...arr,
      ...Array.from({ length: len - arr.length }, () => last),
    ];
  };
  const now = padArray(dataNow);
  const prev = padArray(dataPrev);

  const vals = [...now, ...prev].map((d) => Number(d[metric] || 0));
  const maxVal = Math.max(1, ...vals);
  const width = Math.max(680, padding * 2 + Math.max(0, len - 1) * 40);
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const toPoints = (arr) =>
    arr.map((d, i) => {
      const x =
        padding + (len <= 1 ? plotW / 2 : (plotW * i) / (len - 1));
      const y =
        padding +
        (plotH - (Number(d[metric] || 0) / maxVal) * plotH);
      return { x, y, v: Number(d[metric] || 0), label: d.date };
    });

  const pNow = toPoints(now);
  const pPrev = toPoints(prev);

  const path = (pts) =>
    pts
      .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
      .join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={width}
        height={height}
        style={{ display: "block", maxWidth: "100%" }}
      >
        <rect x="0" y="0" width="100%" height="100%" fill="#ffffff" rx="12" />
        {Array.from({ length: 4 }).map((_, i) => {
          const y = padding + (plotH * i) / 4;
          return (
            <line
              key={i}
              x1={padding}
              x2={padding + plotW}
              y1={y}
              y2={y}
              stroke="#e9e1d8"
            />
          );
        })}

        {}
        <path
          d={path(pPrev)}
          fill="none"
          stroke="#7b6c64"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        {}
        <path d={path(pNow)} fill="none" stroke="#c8a848" strokeWidth="2.5" />

        {}
        {pNow.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill="#c8a848"
              stroke="#4a352b"
            />
            {(i === 0 ||
              i === pNow.length - 1 ||
              pNow.length <= 10 ||
              i % Math.ceil(pNow.length / 8) === 0) && (
              <text
                x={p.x}
                y={padding + plotH + 14}
                fontSize="11"
                textAnchor="middle"
                fill="#7b6c64"
              >
                {formatBr(p.label)}
              </text>
            )}
          </g>
        ))}

        <text x={padding} y={padding - 10} fontSize="12" fill="#7b6c64">
          {metric === "points" ? "Pontos/dia" : "Metas/dia"}
        </text>
      </svg>
    </div>
  );
}

/*Utils*/
function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function enumerateDays(start, endExcl) {
  const days = [];
  const d = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
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
function formatBr(iso) {
  if (!iso || typeof iso !== "string") return "";
  const [, m, d] = iso.split("-"); 
  return `${d}/${m}`;
}
function shorten(str, max) {
  if (!str) return "—";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}


const table = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};
const th = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e9e1d8",
  color: "#7b6c64",
  fontWeight: 800,
};
const td = {
  padding: "10px 12px",
  borderBottom: "1px solid #f0e8de",
};
const rowTop = { background: "rgba(200,168,72,.06)" };
const activeBtn = {
  borderColor: "#e9e1d8",
  boxShadow: "0 0 0 4px rgba(200,168,72,.25)",
};


function medal(i) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "🏅";
}

/* níveis gamificados por pontos do período */
function levelFromPoints(points) {
  const p = Number(points || 0);
  if (p >= 700) return "Lenda";
  if (p >= 400) return "Avançado";
  if (p >= 200) return "Engajado";
  if (p > 0) return "Iniciante";
  return "Sem atividade";
}
