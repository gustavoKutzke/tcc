// src/pages/Kudos.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import KudosModal from "../components/KudosModal";

// utils de data (já estamos usando no Insights)
import { monthKeyFromDate } from "../utils/dateUtils";

// user centralizado
import { listenCurrentUser } from "../services/userService";

// serviços de kudos
import {
  listenKudosByMonth,
  listenKudosForUserMonth,
  listenKudosSentByUserMonth,
} from "../services/kudosService";

export default function Kudos() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [kudos, setKudos] = useState([]);
  const [tab, setTab] = useState("recebidos"); // recebidos | enviados | geral (gestor)
  const [modalOpen, setModalOpen] = useState(false);
  const [month, setMonth] = useState(monthKeyFromDate());

  // redireciona se não estiver logado (mesmo padrão das outras telas)
  useEffect(
    () => auth.onAuthStateChanged((u) => !u && navigate("/auth")),
    [navigate]
  );

  // carrega usuário logado + role via /users
  useEffect(() => {
    const unsub = listenCurrentUser(setMe);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const isManager = me?.role === "gestor";

  // carregar kudos conforme aba selecionada
  useEffect(() => {
    if (!me) return;

    let unsub;
    if (isManager && tab === "geral") {
      // gestor vendo tudo do mês
      unsub = listenKudosByMonth(month, setKudos);
    } else if (tab === "enviados") {
      // kudos que eu enviei no mês
      unsub = listenKudosSentByUserMonth(me.uid, month, setKudos);
    } else {
      // aba padrão: kudos recebidos por mim no mês
      unsub = listenKudosForUserMonth(me.uid, month, setKudos);
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [me, tab, isManager, month]);

  const totalValue = useMemo(
    () => kudos.reduce((s, k) => s + Number(k.value || 0), 0),
    [kudos]
  );

  function exportCSV() {
    if (!kudos.length) return alert("Sem dados para exportar.");

    const rows = kudos.map((k) => ({
      id: k.id,
      de: k.fromName,
      para: k.toName,
      valor: k.value,
      mensagem: k.message || "",
      mes: k.monthKey,
      criado_em: k.createdAt?.toDate
        ? k.createdAt.toDate().toLocaleString("pt-BR")
        : "",
    }));

    const headers = Object.keys(rows[0]);

    const esc = (s) => {
      const v = String(s ?? "");
      return /[;"\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };

    const csv =
      headers.join(";") +
      "\n" +
      rows.map((r) => headers.map((h) => esc(r[h])).join(";")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kudos_${tab}_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!me) {
    return (
      <>
        <h2 className="section-title">Kudos</h2>
        <div className="card">
          <p className="muted">Carregando...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="section-title">Kudos</h2>

      <div className="card" style={{ marginBottom: 12 }}>
        <div
          className="btn-row"
          style={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <div className="btn-row">
            <button
              className={`btn ${
                tab === "recebidos" ? "btn-primary" : ""
              }`}
              onClick={() => setTab("recebidos")}
            >
              Recebidos
            </button>
            <button
              className={`btn ${
                tab === "enviados" ? "btn-primary" : ""
              }`}
              onClick={() => setTab("enviados")}
            >
              Enviados
            </button>
            {isManager && (
              <button
                className={`btn ${
                  tab === "geral" ? "btn-primary" : ""
                }`}
                onClick={() => setTab("geral")}
              >
                Geral (Gestor)
              </button>
            )}
          </div>

          <div className="btn-row">
            {/* monthKey é texto (YYYY-MM), então um input simples funciona */}
            <input
              className="input"
              style={{ maxWidth: 140 }}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button className="btn" onClick={exportCSV}>
              CSV
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setModalOpen(true)}
            >
              Dar Kudos
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="muted">Total de entradas nesta aba</div>
          <div style={{ fontWeight: 900 }}>
            {kudos.length} itens • soma de valores: {totalValue}
          </div>
        </div>
      </div>

      <div className="grid">
        {kudos.map((k) => (
          <KudoItem key={k.id} k={k} meUid={me?.uid} />
        ))}
        {!kudos.length && (
          <div className="card">
            <p className="muted">Nada por aqui neste mês.</p>
          </div>
        )}
      </div>

      <KudosModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

function KudoItem({ k, meUid }) {
  const dt = k.createdAt?.toDate
    ? k.createdAt.toDate().toLocaleString("pt-BR")
    : "-";
  const mineSent = k.fromUid === meUid;

  return (
    <div className="card" style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>
            {mineSent ? "Você → " : ""}
            {k.toName}
            <span className="muted"> • de {k.fromName}</span>
          </div>
          <div className="muted">
            Valor: <strong>{k.value}</strong> • {dt}
          </div>
        </div>
        <span
          style={{
            alignSelf: "start",
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid #e5d7b8",
            background: "rgba(200,168,72,.12)",
            fontWeight: 700,
            color: "#4a342a",
            height: 28,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Kudos
        </span>
      </div>
      {k.message && <div style={{ marginTop: 4 }}>{k.message}</div>}
    </div>
  );
}
