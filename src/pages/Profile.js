// src/pages/Profile.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

import { computeLevel, computeBadges } from "../lib/gamification";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* === Kudos === */
import KudosModal from "../components/KudosModal";
import { monthKeyFromDate } from "../lib/date";

/* === Seção de Carreira (apenas gestor vê) === */
import ProfileCareerCard from "../components/ProfileCareerCard";

/* === Services específicos da página === */
import {
  fetchUserByUid,
  listenCollaborators,
  listenProfileData,
  fetchFeedbackSignatures,
} from "../services/profileService";

/* ===== Helpers visuais ===== */
function Avatar({ name = "Usuário", photoURL, size = 48 }) {
  const initials = (name || "U")
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return photoURL ? (
    <img
      src={photoURL}
      alt={name}
      width={size}
      height={size}
      style={{
        borderRadius: "50%",
        objectFit: "cover",
        border: "1px solid #e9e1d8",
      }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#3e2c22,#4a352b)",
        color: "#f7ead2",
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,.18)",
      }}
    >
      {initials}
    </div>
  );
}

function levelBadgeStyle(levelKey) {
  const bg =
    {
      bronze: "linear-gradient(135deg,#caa07a,#f1d1b0)",
      prata: "linear-gradient(135deg,#c8c8c8,#efefef)",
      ouro: "linear-gradient(135deg,#c8a848,#f2df9c)",
      diamante: "linear-gradient(135deg,#9be7ff,#e6fbff)",
    }[levelKey] || "linear-gradient(135deg,#eee,#fff)";

  return {
    display: "inline-block",
    padding: "6px 14px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 14,
    color: levelKey === "diamante" ? "#183a4a" : "#3e2c22",
    background: bg,
    border: "1px solid #e9e1d8",
    boxShadow: "0 6px 12px rgba(0,0,0,.08)",
    whiteSpace: "nowrap",
  };
}

/* === DISC helpers === */
const DISC_LABELS = {
  D: "Executor",
  I: "Comunicador",
  S: "Estável",
  C: "Analítico",
};

const DISC_COLORS = {
  D: "#e74c3c",
  I: "#f1c40f",
  S: "#2ecc71",
  C: "#3498db",
};

function DiscChip({ code }) {
  if (!code || !DISC_LABELS[code]) return null;
  const label = DISC_LABELS[code];
  const color = DISC_COLORS[code];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 999,
        border: `1px solid ${color}33`,
        background: "#fff",
        fontSize: 12,
        fontWeight: 700,
        color: "#3e2c22",
        boxShadow: "0 1px 3px rgba(0,0,0,.08)",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
        }}
      />
      {label}
    </span>
  );
}

/* ================= Helpers PDF ================= */
function toBr(d) {
  try {
    if (!d) return "-";
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}
function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
async function exportFeedbackPDF(feedbackDoc, signatures) {
  const wrapper = document.createElement("div");
  wrapper.style.width = "794px";
  wrapper.style.padding = "24px";
  wrapper.style.fontFamily = "Arial, sans-serif";
  wrapper.style.color = "#2b211b";
  wrapper.style.background = "#ffffff";
  wrapper.style.border = "1px solid #eee";

  const h = (txt) =>
    `<div style="font-size:20px;font-weight:800;margin:8px 0 16px">${txt}</div>`;
  const row = (k, v) => `
    <div style="display:flex; gap:12px; margin:6px 0">
      <div style="flex:1">
        <div style="font-size:12px;color:#7b6c64">${k}</div>
        <div style="font-weight:700">${v || "-"}</div>
      </div>
    </div>`;

  wrapper.innerHTML = `
    <div style="text-align:center;font-weight:900;letter-spacing:.5px;margin-bottom:6px">HOLDING  RAR</div>
    <div style="font-size:24px;font-weight:900;margin-bottom:10px">Contrato de expectativa</div>

    <div style="border:1px solid #e9e1d8;border-radius:10px;padding:12px">
      ${row("Colaborador(a)", feedbackDoc.collaboratorName)}
      ${row("Departamento", feedbackDoc.department)}
      ${row("Gestor", feedbackDoc.managerName)}
      <div style="display:flex; gap:12px">
        <div style="flex:1">${row("Início", toBr(feedbackDoc.startDate))}</div>
        <div style="flex:1">${row("Fim", toBr(feedbackDoc.endDate))}</div>
      </div>
    </div>

    ${h("Entregáveis/Metas")}
    <div style="min-height:120px;border:1px solid #e9e1d8;border-radius:10px;padding:12px;white-space:pre-wrap">
      ${escapeHtml(feedbackDoc.deliverables || "")}
    </div>

    ${h("Comportamento/Atitude/Postura")}
    <div style="min-height:120px;border:1px solid #e9e1d8;border-radius:10px;padding:12px;white-space:pre-wrap">
      ${escapeHtml(feedbackDoc.behavior || "")}
    </div>

    <div style="margin-top:12px;font-size:12px;color:#7b6c64">
      Espero que as expectativas acima alinhadas possam ser cumpridas com responsabilidade, a fim de mantermos a qualidade em nossos serviços prestados e para que possamos buscar constantemente o desenvolvimento, alcançando novos desafios e novas metas.
    </div>

    <div style="display:flex; gap:24px; margin-top:14px">
      <div style="flex:1">
        <div style="font-size:12px;color:#7b6c64">Data</div>
        <div>${toBr(new Date())}</div>
      </div>
      <div style="flex:1">
        <div style="font-size:12px;color:#7b6c64">Data do próximo alinhamento</div>
        <div>&nbsp;</div>
      </div>
    </div>

    <div style="display:flex; gap:24px; margin-top:24px; align-items:flex-end">
      <div style="flex:1; text-align:center">
        <div style="height:90px; display:flex; align-items:center; justify-content:center; border:1px dashed #e9e1d8; border-radius:8px;">
          ${
            signatures?.collaborator
              ? `<img src="${signatures.collaborator}" style="max-width:100%;max-height:88px" />`
              : "—"
          }
        </div>
        <div style="margin-top:6px">Colaborador(a)</div>
      </div>
      <div style="flex:1; text-align:center">
        <div style="height:90px; display:flex; align-items:center; justify-content:center; border:1px dashed #e9e1d8; border-radius:8px;">
          ${
            signatures?.manager
              ? `<img src="${signatures.manager}" style="max-width:100%;max-height:88px" />`
              : "—"
          }
        </div>
        <div style="margin-top:6px">Gestor(a)</div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);
  const canvas = await html2canvas(wrapper, { scale: 2 });
  document.body.removeChild(wrapper);

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "pt", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgWidth = pageWidth - 48;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  pdf.addImage(imgData, "PNG", 24, 24, imgWidth, imgHeight, "", "FAST");
  pdf.save(`feedback_${feedbackDoc.collaboratorName || "colaborador"}.pdf`);
}

/* ================= PAGE ================= */
export default function Profile() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [subjectUid, setSubjectUid] = useState(null);
  const [subject, setSubject] = useState(null);
  const [users, setUsers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");

  // Kudos
  const [kudosOpen, setKudosOpen] = useState(false);
  const [kudosMonth, setKudosMonth] = useState([]);
  const [kudosAll, setKudosAll] = useState([]);
  const monthKey = monthKeyFromDate();

  // 1) Usuário logado
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return navigate("/auth");

      const meData = await fetchUserByUid(u.uid);
      setMe(meData);
      setSubjectUid(meData.role === "gestor" ? "" : meData.uid);
    });
    return () => unsub();
  }, [navigate]);

  const isManager = me?.role === "gestor";

  // 2) Lista de colaboradores (somente gestor)
  useEffect(() => {
    if (!isManager) return;
    const unsub = listenCollaborators(setUsers);
    return () => unsub && unsub();
  }, [isManager]);

  // 3) Dados do colaborador selecionado + metas + feedbacks + kudos
  useEffect(() => {
    const unsub = listenProfileData(subjectUid, monthKey, {
      onUser: setSubject,
      onGoals: setGoals,
      onFeedbacks: setFeedbacks,
      onKudosAll: setKudosAll,
      onKudosMonth: setKudosMonth,
    });
    return () => unsub && unsub();
  }, [subjectUid, monthKey]);

  // 4) Filtro de metas
  const goalsFiltered = useMemo(() => {
    if (statusFilter === "all") return goals;
    return goals.filter((g) => g.status === statusFilter);
  }, [goals, statusFilter]);

  // 5) Conquistas
  const badges = useMemo(() => {
    if (!subject) return [];
    return computeBadges({
      totalPoints: subject.points || 0,
      goals,
    });
  }, [subject, goals]);

  // 6) Série mensal (metas concluídas por mês) — últimos 12 meses
  const monthlySeries = useMemo(() => buildMonthlySeries(goals), [goals]);

  if (!me) {
    return (
      <div className="card">
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  const level = computeLevel(subject?.points || 0);

  // PDF de um feedback específico (busca assinaturas via service)
  async function handleExportPDF(it) {
    try {
      const signatures = await fetchFeedbackSignatures(it.id);
      await exportFeedbackPDF(it, signatures);
    } catch (e) {
      console.error(e);
      alert("Não foi possível exportar o PDF deste feedback.");
    }
  }

  // Totais de kudos do mês
  const kudosMonthCount = kudosMonth.length;
  const kudosMonthSum = kudosMonth.reduce(
    (s, k) => s + Number(k.value || 0),
    0
  );

  // Perfil DISC vindo do doc do usuário
  const discDom = subject?.discProfile?.dominant || null;
  const discSec =
    subject?.discProfile?.secondary && subject.discProfile.secondary !== discDom
      ? subject.discProfile.secondary
      : null;

  return (
    <>
      <h2 className="section-title">Histórico do Colaborador</h2>

      {/* Top actions */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <button
          className="btn"
          onClick={() => navigate("/dashboard")}
          style={{
            background: "#f8f5ef",
            border: "1px solid #d5c5b0",
            borderRadius: 10,
            fontWeight: 700,
            padding: "8px 14px",
          }}
        >
          ← Voltar ao Início
        </button>

        {isManager ? (
          <div className="btn-row">
            <select
              className="select"
              value={subjectUid || ""}
              onChange={(e) => setSubjectUid(e.target.value)}
              style={{ maxWidth: 340 }}
            >
              <option value="">— Selecione um colaborador —</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => setKudosOpen(true)}
            >
              Dar Kudos
            </button>
          </div>
        ) : (
          <div className="btn-row">
            <div className="muted" style={{ fontSize: 14 }}>
              Visualizando seu histórico
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setKudosOpen(true)}
            >
              Dar Kudos
            </button>
          </div>
        )}
      </div>

      {/* Cabeçalho do perfil */}
      {subject && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <Avatar
              name={subject.name || subject.email}
              photoURL={subject.photoURL}
            />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 900 }}>
                {subject.name || subject.email}
              </div>
              <div className="muted">
                Pontos: <strong>{Number(subject.points || 0)}</strong>
              </div>

              {(discDom || discSec) && (
                <div style={{ marginTop: 6 }}>
                  <span
                    className="muted"
                    style={{ fontSize: 13, marginRight: 6 }}
                  >
                    Perfil DISC:
                  </span>
                  {discDom && <DiscChip code={discDom} />}
                  {discSec && (
                    <>
                      <span
                        style={{
                          fontSize: 12,
                          margin: "0 4px",
                          color: "#7b6c64",
                        }}
                      >
                        e
                      </span>
                      <DiscChip code={discSec} />
                    </>
                  )}
                </div>
              )}
            </div>
            <div style={levelBadgeStyle(level.key)}>{level.label}</div>
          </div>
        </div>
      )}

      {/* === CARREIRA (somente gestor vê) === */}
      {isManager && subject && (
        <ProfileCareerCard subjectUid={subject.uid} isManager={true} />
      )}

      {/* Gráfico mensal */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 10 }}>
          Metas concluídas por mês (últimos 12 meses)
        </h3>
        {monthlySeries.length === 0 ? (
          <p className="muted">Sem metas concluídas no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9e1d8" />
              <XAxis dataKey="mes" tick={{ fill: "#7b6c64" }} />
              <YAxis allowDecimals={false} tick={{ fill: "#7b6c64" }} />
              <Tooltip />
              <Bar dataKey="concluidas" fill="#c8a848" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Conquistas */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Conquistas</h3>
        {!subject || badges.length === 0 ? (
          <p className="muted">Sem conquistas ainda.</p>
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
              <div
                key={b.key}
                className="card"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  width: 160,
                  textAlign: "center",
                  boxShadow: "var(--shadow)",
                }}
              >
                <div style={{ fontSize: 22 }}>🏅</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>
                  {b.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metas */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>Metas</h3>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option value="all">Todos os status</option>
            <option value="aberta">Abertas</option>
            <option value="concluida">Concluídas</option>
          </select>
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          {goalsFiltered.length === 0 ? (
            <div className="card">
              <p className="muted">Nenhuma meta encontrada.</p>
            </div>
          ) : (
            goalsFiltered.map((g) => <GoalItem key={g.id} goal={g} />)
          )}
        </div>
      </div>

      {/* Feedbacks */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Feedbacks recebidos</h3>
        <div className="grid" style={{ marginTop: 12 }}>
          {feedbacks.length === 0 ? (
            <div className="card">
              <p className="muted">Nenhum feedback até o momento.</p>
            </div>
          ) : (
            feedbacks.map((f) => (
              <FeedbackItem
                key={f.id}
                fb={f}
                onExport={() => handleExportPDF(f)}
              />
            ))
          )}
        </div>
      </div>

      {/* Kudos (Reconhecimento) */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ marginBottom: 6 }}>Kudos (Reconhecimento)</h3>
          <button
            className="btn btn-primary"
            onClick={() => setKudosOpen(true)}
          >
            Dar Kudos
          </button>
        </div>

        {/* Resumo do mês */}
        <div className="card" style={{ marginTop: 10 }}>
          <div className="muted">Mês atual: {monthKey}</div>
          <div
            style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}
          >
            Recebidos: {kudosMonthCount} • Soma de valores: {kudosMonthSum}
          </div>
          <div className="grid" style={{ marginTop: 10 }}>
            {kudosMonth.slice(0, 3).map((k) => (
              <div
                key={k.id}
                className="card"
                style={{ background: "#fff8e6" }}
              >
                <div style={{ fontWeight: 900 }}>
                  {k.fromName || k.fromUid}
                </div>
                <div className="muted">
                  Valor: <strong>{k.value}</strong>
                </div>
                {k.message && (
                  <div
                    style={{
                      marginTop: 4,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {k.message}
                  </div>
                )}
              </div>
            ))}
            {kudosMonth.length === 0 && (
              <div className="muted">
                Sem kudos recebidos neste mês.
              </div>
            )}
          </div>
        </div>

        {/* Histórico completo */}
        <div className="card" style={{ marginTop: 10 }}>
          <h4 style={{ marginBottom: 6 }}>Histórico completo</h4>
          <div className="grid">
            {kudosAll.length === 0 && (
              <div className="muted">Sem registros de kudos.</div>
            )}
            {kudosAll.map((k) => (
              <div key={k.id} className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>
                    {k.fromName || k.fromUid}
                  </div>
                  <div className="muted">
                    {k.createdAt?.toDate
                      ? k.createdAt
                          .toDate()
                          .toLocaleString("pt-BR")
                      : ""}
                  </div>
                </div>
                <div className="muted">
                  Valor: <strong>{k.value}</strong>
                </div>
                {k.message && (
                  <div
                    style={{
                      marginTop: 4,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {k.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal para enviar Kudos */}
      <KudosModal
        open={kudosOpen}
        onClose={() => setKudosOpen(false)}
        presetToUid={subjectUid || me?.uid}
      />
    </>
  );
}

/* ===== Helpers de dados ===== */
function buildMonthlySeries(goals) {
  const done = (goals || []).filter(
    (g) => g.status === "concluida" && g.completedAt?.toDate
  );
  if (done.length === 0) return [];

  const now = new Date();
  const labels = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push({ y: d.getFullYear(), m: d.getMonth() });
  }

  const counts = new Map(labels.map((k) => [key(k.y, k.m), 0]));

  for (const g of done) {
    const d = g.completedAt.toDate();
    const k = key(d.getFullYear(), d.getMonth());
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
  }

  const monthsPt = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return labels.map(({ y, m }) => ({
    mes: `${monthsPt[m]}/${String(y).slice(-2)}`,
    concluidas: counts.get(key(y, m)) || 0,
  }));

  function key(yy, mm) {
    return `${yy}-${mm}`;
  }
}

/* ===== Itens ===== */
function GoalItem({ goal }) {
  const dueStr = goal?.dueDate?.toDate
    ? goal.dueDate.toDate().toLocaleDateString("pt-BR")
    : "-";
  const createdStr = goal?.createdAt?.toDate
    ? goal.createdAt.toDate().toLocaleDateString("pt-BR")
    : "-";
  const tag = goal.status === "concluida" ? "Concluída" : "Aberta";

  return (
    <div className="card" style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>{goal.title}</div>
          <div className="muted" style={{ marginTop: 2 }}>
            Pontos: <strong>{goal.points || 0}</strong> • Prazo:{" "}
            <strong>{dueStr}</strong> • Criada:{" "}
            <strong>{createdStr}</strong>
          </div>
        </div>
        <span
          style={{
            alignSelf: "start",
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid #e5d7b8",
            background:
              goal.status === "concluida"
                ? "rgba(200,168,72,.15)"
                : "#fff",
            fontWeight: 700,
            color:
              goal.status === "concluida" ? "#4a342a" : "#7b6c64",
            whiteSpace: "nowrap",
            height: 28,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          {tag}
        </span>
      </div>

      {goal.description && (
        <div
          className="muted"
          style={{ marginTop: 6, whiteSpace: "pre-wrap" }}
        >
          {goal.description}
        </div>
      )}
    </div>
  );
}

function FeedbackItem({ fb, onExport }) {
  const startStr = fb?.startDate
    ? new Date(fb.startDate).toLocaleDateString("pt-BR")
    : "-";
  const endStr = fb?.endDate
    ? new Date(fb.endDate).toLocaleDateString("pt-BR")
    : "-";
  const createdStr = fb?.createdAt?.toDate
    ? fb.createdAt.toDate().toLocaleDateString("pt-BR")
    : "-";

  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>
            {fb.department || "Departamento"}
          </div>
          <div className="muted">
            Início: <strong>{startStr}</strong> • Fim:{" "}
            <strong>{endStr}</strong> • Criado em:{" "}
            <strong>{createdStr}</strong>
          </div>
        </div>
      </div>

      {fb.deliverables && (
        <div>
          <div
            className="muted"
            style={{ fontWeight: 700, marginBottom: 4 }}
          >
            Entregáveis / Metas
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>
            {fb.deliverables}
          </div>
        </div>
      )}

      {fb.behavior && (
        <div>
          <div
            className="muted"
            style={{ fontWeight: 700, marginBottom: 4 }}
          >
            Comportamento / Atitude / Postura
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>
            {fb.behavior}
          </div>
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 6 }}>
        <button className="btn" onClick={onExport}>
          Exportar PDF
        </button>
      </div>
    </div>
  );
}
