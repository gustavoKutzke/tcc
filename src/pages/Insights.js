// src/pages/Insights.js
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

// pega usuário logado + role
import { listenCurrentUser } from "../services/userService";

// services de insights
import {
  loadTeams,
  loadInsightsForManager,
} from "../services/insightsService";

// utils de datas
import {
  monthKeyFromDate,
  lastNMonths,
  brMonthLabel,
  formatBr,
} from "../utils/dateUtils";

/* ===== Página ===== */
export default function Insights() {
  const navigate = useNavigate();

  // redireciona se não estiver logado (padrão das outras telas)
  useEffect(
    () => auth.onAuthStateChanged((u) => !u && navigate("/auth")),
    [navigate]
  );

  const [me, setMe] = useState(null);
  const [teams, setTeams] = useState(["all"]);
  const [team, setTeam] = useState("all");
  const [month, setMonth] = useState(monthKeyFromDate());
  const months = lastNMonths(6);

  const [kpi, setKpi] = useState({
    kudosCount: 0,
    kudosValueSum: 0,
    metasCount: 0,
    pontosMes: 0,
    usersCount: 0,
  });
  const [topRecognized, setTopRecognized] = useState([]);
  const [topSupporters, setTopSupporters] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [dailyPoints, setDailyPoints] = useState([]);
  const [dailyKudos, setDailyKudos] = useState([]);
  const [loading, setLoading] = useState(true);

  /* Auth + papel (via service) */
  useEffect(() => {
    const unsub = listenCurrentUser(setMe);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);
  const isManager = me?.role === "gestor";

  /* Times para filtro (via service) */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await loadTeams();
        if (!active) return;
        setTeams(["all", ...list]);
      } catch (e) {
        console.error("Erro ao carregar times:", e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /* Carga principal (aplica mês + time via service) */
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await loadInsightsForManager({ month, team });
        if (!active) return;
        setKpi(data.kpi);
        setTopScorers(data.topScorers);
        setTopRecognized(data.topRecognized);
        setTopSupporters(data.topSupporters);
        setDailyPoints(data.dailyPoints);
        setDailyKudos(data.dailyKudos);
      } catch (e) {
        console.error("Erro ao carregar insights:", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [month, team]);

  if (!me)
    return (
      <div className="card">
        <p className="muted">Carregando…</p>
      </div>
    );

  if (!isManager)
    return (
      <div className="card">
        <h3>Insights</h3>
        <p className="muted">Apenas gestores podem visualizar este painel.</p>
      </div>
    );

  return (
    <>
      <h2 className="section-title">Insights do Gestor</h2>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="btn-row" style={{ alignItems: "center" }}>
          <div className="muted">Mês</div>
          <select
            className="select"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            {months.map((mk) => (
              <option key={mk} value={mk}>
                {brMonthLabel(mk)}
              </option>
            ))}
          </select>

          <div className="muted" style={{ marginLeft: 12 }}>
            Time
          </div>
          <select
            className="select"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            {teams.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "Todos" : t}
              </option>
            ))}
          </select>

          <button
            className="btn"
            style={{ marginLeft: "auto" }}
            onClick={() =>
              exportCSV({
                kpi,
                topScorers,
                topRecognized,
                topSupporters,
                dailyPoints,
                dailyKudos,
                month,
                team,
              })
            }
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          marginBottom: 12,
        }}
      >
        <KpiCard
          label="Colaboradores (filtro)"
          value={kpi.usersCount}
          hint="Com base no time selecionado"
        />
        <KpiCard label="Metas concluídas" value={kpi.metasCount} />
        <KpiCard label="Pontos (metas)" value={kpi.pontosMes} />
        <KpiCard label="Kudos (qtd)" value={kpi.kudosCount} />
        <KpiCard label="Kudos (soma de valores)" value={kpi.kudosValueSum} />
      </div>

      {/* Evoluções diárias */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Metas — Pontos por dia</h3>
          {loading ? (
            <p className="muted">Carregando…</p>
          ) : dailyPoints.length === 0 ? (
            <p className="muted">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9e1d8" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatBr}
                  tick={{ fill: "#7b6c64" }}
                />
                <YAxis allowDecimals={false} tick={{ fill: "#7b6c64" }} />
                <Tooltip labelFormatter={(v) => formatBr(v)} />
                <Line
                  type="monotone"
                  dataKey="points"
                  stroke="#c8a848"
                  strokeWidth={3}
                  dot={{ fill: "#3e2c22" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Kudos — Valor por dia</h3>
          {loading ? (
            <p className="muted">Carregando…</p>
          ) : dailyKudos.length === 0 ? (
            <p className="muted">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyKudos}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9e1d8" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatBr}
                  tick={{ fill: "#7b6c64" }}
                />
                <YAxis allowDecimals={false} tick={{ fill: "#7b6c64" }} />
                <Tooltip labelFormatter={(v) => formatBr(v)} />
                <Line
                  type="monotone"
                  dataKey="kudos"
                  stroke="#7b6c64"
                  strokeWidth={3}
                  dot={{ fill: "#3e2c22" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Barras por colaborador */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}
      >
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Top Pontuadores (metas)</h3>
          {loading ? (
            <p className="muted">Carregando…</p>
          ) : topScorers.length === 0 ? (
            <p className="muted">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topScorers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9e1d8" />
                <XAxis dataKey="name" tick={{ fill: "#7b6c64" }} />
                <YAxis allowDecimals={false} tick={{ fill: "#7b6c64" }} />
                <Tooltip />
                <Bar dataKey="points" fill="#c8a848" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Top Reconhecidos (kudos recebidos)</h3>
          {loading ? (
            <p className="muted">Carregando…</p>
          ) : topRecognized.length === 0 ? (
            <p className="muted">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topRecognized}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3e1d8" />
                <XAxis dataKey="name" tick={{ fill: "#7b6c64" }} />
                <YAxis allowDecimals={false} tick={{ fill: "#7b6c64" }} />
                <Tooltip />
                <Bar dataKey="value" fill="#9d7b5a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabelas resumidas */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 12 }}
      >
        <TableCard title="Top Pontuadores (metas)">
          <Table
            headers={["#", "Colaborador", "Pontos", "Metas"]}
            rows={topScorers.map((r, i) => [
              i + 1,
              r.name,
              r.points,
              r.tasks,
            ])}
          />
        </TableCard>

        <TableCard title="Top Reconhecidos (kudos recebidos)">
          <Table
            headers={["#", "Colaborador", "Valor", "Qtd"]}
            rows={topRecognized.map((r, i) => [
              i + 1,
              r.name,
              r.value,
              r.count,
            ])}
          />
        </TableCard>

        <TableCard title="Top Apoiadores (kudos enviados)">
          <Table
            headers={["#", "Colaborador", "Valor", "Qtd"]}
            rows={topSupporters.map((r, i) => [
              i + 1,
              r.name,
              r.value,
              r.count,
            ])}
          />
        </TableCard>
      </div>
    </>
  );
}

/* ===== Componentes básicos ===== */
function KpiCard({ label, value, hint }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="muted">{label}</div>
      <div
        style={{ fontWeight: 900, fontSize: 24, marginTop: 4 }}
      >
        {value}
      </div>
      {hint && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
function TableCard({ title, children }) {
  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  );
}
function Table({ headers = [], rows = [] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={table}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                style={{ padding: 12 }}
                className="muted"
              >
                Sem dados.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} style={td}>
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ===== Export CSV ===== */
function exportCSV({
  kpi,
  topScorers,
  topRecognized,
  topSupporters,
  dailyPoints,
  dailyKudos,
  month,
  team,
}) {
  const lines = [];
  lines.push(`Mes,${month}`);
  lines.push(`Time,${team === "all" ? "Todos" : team}`);
  lines.push("");
  lines.push("KPIs");
  lines.push("Colaboradores,Metas,PontosMes,KudosQtd,KudosValor");
  lines.push(
    `${kpi.usersCount},${kpi.metasCount},${kpi.pontosMes},${kpi.kudosCount},${kpi.kudosValueSum}`
  );

  lines.push("");
  lines.push("Evolucao diaria (Metas - Pontos)");
  lines.push("Data,Pontos");
  dailyPoints.forEach((d) => lines.push(`${formatBr(d.date)},${d.points}`));

  lines.push("");
  lines.push("Evolucao diaria (Kudos - Valor)");
  lines.push("Data,Valor");
  dailyKudos.forEach((d) => lines.push(`${formatBr(d.date)},${d.kudos}`));

  lines.push("");
  lines.push("Top Pontuadores (metas)");
  lines.push("Pos,Colaborador,Pontos,Metas");
  topScorers.forEach((r, i) =>
    lines.push(
      `${i + 1},"${(r.name || "").replace(/"/g, '""')}",${r.points},${
        r.tasks
      }`
    )
  );

  lines.push("");
  lines.push("Top Reconhecidos (kudos recebidos)");
  lines.push("Pos,Colaborador,Valor,Qtd");
  topRecognized.forEach((r, i) =>
    lines.push(
      `${i + 1},"${(r.name || "").replace(/"/g, '""')}",${r.value},${
        r.count
      }`
    )
  );

  lines.push("");
  lines.push("Top Apoiadores (kudos enviados)");
  lines.push("Pos,Colaborador,Valor,Qtd");
  topSupporters.forEach((r, i) =>
    lines.push(
      `${i + 1},"${(r.name || "").replace(/"/g, '""')}",${r.value},${
        r.count
      }`
    )
  );

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `insights_${month}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ===== estilos básicos de tabela ===== */
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
