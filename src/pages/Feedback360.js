// src/pages/Feedback360.js
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import SignaturePad from "signature_pad";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// 🔹 usamos o mesmo helper de usuário que já está sendo usado no Career
import { listenCurrentUser } from "../services/userService";

// 🔹 novo service específico da tela
import {
  listenFeedbacksForManager,
  listenFeedbacksForCollaborator,
  createFeedbackWithManagerSignature,
  saveCollaboratorSignature as saveCollaboratorSignatureService,
  loadFeedbackSignatures,
} from "../services/feedback360Service";

/* ================= Helpers visuais ================= */
function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <input className="input" {...props} />
    </div>
  );
}
function TextArea({ label, rows = 4, ...props }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea className="textarea" rows={rows} {...props} />
    </div>
  );
}
function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select className="select" {...props}>
        {children}
      </select>
    </div>
  );
}
function Card({ children, style }) {
  return (
    <div className="card" style={style}>
      {children}
    </div>
  );
}

/* ================= Componente de Assinatura ================= */
function SignatureBox({ title, value, onChange, disabled }) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const pad = new SignaturePad(canvasRef.current, {
      minWidth: 0.8,
      maxWidth: 2.0,
      penColor: "#2b211b",
      backgroundColor: "rgba(255,255,255,0)",
    });
    padRef.current = pad;

    // desenha imagem existente (quando houver)
    if (value) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );
        ctx.drawImage(
          img,
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );
      };
      img.src = value;
    }

    const handler = () =>
      onChange && onChange(pad.isEmpty() ? "" : pad.toDataURL());
    canvasRef.current.addEventListener("mouseup", handler);
    canvasRef.current.addEventListener("touchend", handler);

    return () => {
      try {
        pad.off();
      } catch {}
    };
  }, [value, onChange]);

  // resize responsivo simples
  useEffect(() => {
    function fit() {
      const c = canvasRef.current;
      if (!c) return;
      const parent = c.parentElement;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      c.width = parent.clientWidth * ratio;
      c.height = 140 * ratio;
      c.style.width = "100%";
      c.style.height = "140px";
      // limpar após resize
      if (padRef.current) padRef.current.clear();
      if (value) {
        const img = new Image();
        img.onload = () => {
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, c.width, c.height);
        };
        img.src = value;
      }
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [value]);

  function clearSig() {
    if (padRef.current) {
      padRef.current.clear();
      onChange("");
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div className="label" style={{ margin: 0 }}>
          {title}
        </div>
        {!disabled && (
          <button className="btn" type="button" onClick={clearSig}>
            Limpar
          </button>
        )}
      </div>
      <div
        style={{
          border: "1px dashed var(--border)",
          borderRadius: 12,
          padding: 8,
          background: "#fff",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: 140, display: "block", borderRadius: 8 }}
        />
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Assine com o mouse (computador) ou com o dedo (touch).
      </div>
    </div>
  );
}

/* ================= PDF ================= */
async function exportFeedbackPDF(feedbackDoc, signatures) {
  // container temporário para print (replica o layout do papel)
  const wrapper = document.createElement("div");
  wrapper.style.width = "794px"; // ~A4 width @96dpi
  wrapper.style.padding = "24px";
  wrapper.style.fontFamily = "Arial, sans-serif";
  wrapper.style.color = "#2b211b";
  wrapper.style.background = "#ffffff";
  wrapper.style.border = "1px solid #eee";

  const h = (txt) =>
    `<div style="font-size:20px;font-weight:800;margin:8px 0 16px">${txt}</div>`;
  const row = (k, v) => `
    <div style="display:flex; gap:12px; margin:6px 0">
      <div style="flex:1"><div style="font-size:12px;color:#7b6c64">${k}</div><div style="font-weight:700">${v || "-"}</div></div>
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
  const imgWidth = pageWidth - 48; // margins
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, "PNG", 24, 24, imgWidth, imgHeight, "", "FAST");
  pdf.save(`feedback_${feedbackDoc.collaboratorName || "colaborador"}.pdf`);
}

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

/* ================= PÁGINA ================= */
export default function Feedback360() {
  const [me, setMe] = useState(null); // user + role
  const [users, setUsers] = useState([]); // colaboradores para seleção do gestor
  const [items, setItems] = useState([]); // listagem

  // form
  const [collabUid, setCollabUid] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [behavior, setBehavior] = useState("");

  // signatures on form (gestor e, depois, colaborador no viewer)
  const [sigManager, setSigManager] = useState("");
  const [saving, setSaving] = useState(false);

  // viewer
  const [selected, setSelected] = useState(null);
  const [sigCollab, setSigCollab] = useState("");

  const isManager = me?.role === "gestor";

  /* === auth + role via userService === */
  useEffect(() => {
    const unsub = listenCurrentUser(setMe);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  /* === colaboradores (para gestor) === */
  useEffect(() => {
    if (!isManager) return;
    const qUsers = query(
      collection(db, "users"),
      where("role", "==", "colaborador"),
      orderBy("name")
    );
    const unsub = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) })));
    });
    return () => unsub();
  }, [isManager]);

  /* === listagem (gestor: todos; colaborador: só os dele) === */
  useEffect(() => {
    if (!me) return;
    const unsub = isManager
      ? listenFeedbacksForManager(setItems)
      : listenFeedbacksForCollaborator(me.uid, setItems);

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [me, isManager]);

  const canSave = useMemo(
    () =>
      isManager &&
      collabUid &&
      department.trim() &&
      startDate &&
      endDate,
    [isManager, collabUid, department, startDate, endDate]
  );

  async function handleCreate(e) {
    e.preventDefault();
    if (!canSave || !me) return;
    setSaving(true);
    try {
      const collab = users.find((u) => u.uid === collabUid) || {};
      await createFeedbackWithManagerSignature({
        collaboratorUid: collabUid,
        collaboratorName: collab.name || collab.email || "",
        department: department.trim(),
        managerUid: me.uid,
        managerName: me.name || me.email || "",
        startDate,
        endDate,
        deliverables: deliverables.trim(),
        behavior: behavior.trim(),
        managerSignature: sigManager,
      });

      // limpa form
      setCollabUid("");
      setDepartment("");
      setStartDate("");
      setEndDate("");
      setDeliverables("");
      setBehavior("");
      setSigManager("");
      alert("Feedback criado com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar feedback.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCollaboratorSignature() {
    if (!selected || !me || !sigCollab) return;

    try {
      await saveCollaboratorSignatureService(selected.id, {
        byUid: me.uid,
        name: me.name || me.email || "",
        imageData: sigCollab,
      });
      alert("Assinatura salva!");
    } catch (e) {
      console.error(e);
      alert("Não foi possível salvar a assinatura.");
    }
  }

  async function handleExportPDF(it) {
    const signatures = await loadFeedbackSignatures(it.id);
    await exportFeedbackPDF(it, signatures);
  }

  return (
    <>
      <h2 className="section-title">Feedback 360º</h2>

      {/* ====== Coluna esquerda: Form (gestor) ====== */}
      {isManager && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>
            Novo feedback / contrato de expectativa
          </h3>
          <form
            className="grid"
            style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}
            onSubmit={handleCreate}
          >
            <div style={{ gridColumn: "1 / 3" }}>
              <Select
                label="Colaborador"
                value={collabUid}
                onChange={(e) => setCollabUid(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name || u.email}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="Departamento"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />
            <div />

            <Input
              label="Início"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Fim"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />

            <div style={{ gridColumn: "1 / 3" }}>
              <TextArea
                label="Entregáveis / Metas"
                rows={5}
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: "1 / 3" }}>
              <TextArea
                label="Comportamento / Atitude / Postura"
                rows={5}
                value={behavior}
                onChange={(e) => setBehavior(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: "1 / 3" }}>
              <SignatureBox
                title="Assinatura do Gestor"
                value={sigManager}
                onChange={setSigManager}
              />
            </div>

            <div className="btn-row" style={{ gridColumn: "1 / 3" }}>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setCollabUid("");
                  setDepartment("");
                  setStartDate("");
                  setEndDate("");
                  setDeliverables("");
                  setBehavior("");
                  setSigManager("");
                }}
              >
                Limpar
              </button>
              <button className="btn btn-primary" disabled={!canSave || saving}>
                {saving ? "Salvando..." : "Salvar feedback"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* ====== Lista / Histórico ====== */}
      <Card>
        <h3 style={{ marginBottom: 8 }}>
          {isManager ? "Feedbacks cadastrados" : "Meus feedbacks"}
        </h3>
        {items.length === 0 ? (
          <p className="muted">Nenhum feedback encontrado.</p>
        ) : (
          <div className="grid">
            {items.map((it) => (
              <ItemFeedback
                key={it.id}
                it={it}
                isManager={isManager}
                onView={() => setSelected(it)}
                onExport={() => handleExportPDF(it)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ====== Modalzinho simples (viewer) ====== */}
      {selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 900,
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0 }}>Visualizar feedback</h3>
              <div className="btn-row">
                <button
                  className="btn"
                  onClick={() => handleExportPDF(selected)}
                >
                  Exportar PDF
                </button>
                <button className="btn" onClick={() => setSelected(null)}>
                  Fechar
                </button>
              </div>
            </div>

            <ViewerFeedback it={selected} />

            {/* assinatura do colaborador (se for o dono) */}
            {me && selected.collaboratorUid === me.uid && (
              <div style={{ marginTop: 14 }}>
                <SignatureBox
                  title="Assinatura do Colaborador"
                  value={sigCollab}
                  onChange={setSigCollab}
                />
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    disabled={!sigCollab}
                    onClick={handleSaveCollaboratorSignature}
                  >
                    Salvar minha assinatura
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ====== Itens da lista ====== */
function ItemFeedback({ it, isManager, onView, onExport }) {
  const start = toBr(it.startDate);
  const end = toBr(it.endDate);
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
          <div style={{ fontWeight: 900 }}>
            {it.collaboratorName || it.collaboratorUid}
          </div>
          <div className="muted">
            Depto: <strong>{it.department || "-"}</strong> • Período:{" "}
            <strong>{start}</strong> - <strong>{end}</strong>
          </div>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={onView}>
          Visualizar
        </button>
        <button className="btn" onClick={onExport}>
          Exportar PDF
        </button>
      </div>
    </div>
  );
}

/* ====== Viewer (somente leitura) ====== */
function ViewerFeedback({ it }) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}
    >
      <div style={{ gridColumn: "1 / 3" }} className="muted">
        Colaborador:{" "}
        <strong>{it.collaboratorName || it.collaboratorUid}</strong> • Depto:{" "}
        <strong>{it.department || "-"}</strong>
        <br />
        Gestor: <strong>{it.managerName || it.managerUid}</strong> • Início:{" "}
        <strong>{toBr(it.startDate)}</strong> • Fim:{" "}
        <strong>{toBr(it.endDate)}</strong>
      </div>

      <div style={{ gridColumn: "1 / 3" }}>
        <div className="label" style={{ marginBottom: 6 }}>
          Entregáveis / Metas
        </div>
        <div className="card" style={{ whiteSpace: "pre-wrap" }}>
          {it.deliverables || "-"}
        </div>
      </div>

      <div style={{ gridColumn: "1 / 3" }}>
        <div className="label" style={{ marginBottom: 6 }}>
          Comportamento / Atitude / Postura
        </div>
        <div className="card" style={{ whiteSpace: "pre-wrap" }}>
          {it.behavior || "-"}
        </div>
      </div>
    </div>
  );
}
