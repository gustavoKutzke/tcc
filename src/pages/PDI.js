// src/pages/PDI.js
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  listenCurrentUser,
  listenCollaborators,
  listenPdiPlanByOwnerUid,
  listenPdiItems,
  savePdiHeader,
  createPdiItem,
  duplicatePdiItem,
  deletePdiItem,
  updatePdiItem,
  syncPlanProgress,
  calculateProgressFromItems,
} from "../services/pdiService";



const SectionTitle = ({ children }) => (
  <h2 className="section-title" style={{ marginBottom: 10 }}>
    {children}
  </h2>
);

const Card = (p) => (
  <div
    className="card"
    style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    {...p}
  />
);

const FOLLOWUPS = ["Semanal", "Quinzenal", "Mensal"];

const STATUSES = [
  { k: "nao_iniciada", label: "Não iniciada" },
  { k: "em_andamento", label: "Em andamento" },
  { k: "atrasada", label: "Atrasada" },
  { k: "concluida", label: "Concluída" },
  { k: "cancelada", label: "Cancelada" },
];


function AutoGrowTextArea({
  value,
  onChange,
  disabled,
  placeholder,
  minRows = 2,
}) {
  const [rows, setRows] = useState(minRows);

  return (
    <textarea
      className="textarea textarea-lg"
      rows={rows}
      value={value || ""}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val);
        const n = val.split("\n").length;
        setRows(Math.max(minRows, Math.min(8, n)));
      }}
      disabled={!!disabled}
      placeholder={placeholder}
      style={{ width: "100%", resize: "vertical" }}
    />
  );
}

function Field({ label, value, onChange, disabled, placeholder }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!!disabled}
        placeholder={placeholder}
      />
    </div>
  );
}

export default function PDI() {
  const [me, setMe] = useState(null);
  const [isManager, setIsManager] = useState(false);
  const [users, setUsers] = useState([]);
  const [subjectUid, setSubjectUid] = useState("");
  const [planId, setPlanId] = useState(null);
  const [items, setItems] = useState([]);

 
  const [profile, setProfile] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [managerName, setManagerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [followUp, setFollowUp] = useState("Mensal");

  
  const savingRef = useRef(false);

  
  useEffect(() => {
    const unsub = listenCurrentUser((user) => {
      setMe(user);
      if (!user) {
        setIsManager(false);
        setSubjectUid("");
        return;
      }
      const manager = user.role === "gestor";
      setIsManager(manager);
      setSubjectUid(manager ? "" : user.uid);
    });
    return () => unsub && unsub();
  }, []);


  useEffect(() => {
    if (!isManager) return;
    const unsub = listenCollaborators(setUsers);
    return () => unsub && unsub();
  }, [isManager]);

  function resetHeader() {
    setProfile("");
    setRoleTitle("");
    setManagerName("");
    setStartDate("");
    setEndDate("");
    setFollowUp("Mensal");
  }

  
  useEffect(() => {
    if (!subjectUid) {
      setPlanId(null);
      setItems([]);
      resetHeader();
      return;
    }

    const unsub = listenPdiPlanByOwnerUid(subjectUid, (plan) => {
      if (!plan) {
        setPlanId(null);
        setItems([]);
        resetHeader();
        return;
      }
      setPlanId(plan.id);
      setProfile(plan.profile || "");
      setRoleTitle(plan.roleTitle || "");
      setManagerName(plan.managerName || "");
      setStartDate(plan.startDate || "");
      setEndDate(plan.endDate || "");
      setFollowUp(plan.followUp || "Mensal");
    });

    return () => unsub && unsub();
  }, [subjectUid]);

  
  useEffect(() => {
    setItems([]);
    if (!planId) return;
    const unsub = listenPdiItems(planId, setItems);
    return () => unsub && unsub();
  }, [planId]);

  // permissões
  const canEditHeader = isManager && !!subjectUid; 
  const canManageRows = isManager; 
  const isOwner = !!me && !!subjectUid && me.uid === subjectUid;

  /* === Nome exibível do colaborador === */
  const subjectDisplayName = useMemo(() => {
    if (!subjectUid) return "";
    const u = users.find((x) => x.uid === subjectUid);
    if (u) return u.name || u.email || subjectUid;
    if (me && me.uid === subjectUid) return me.name || me.email || subjectUid;
    return subjectUid;
  }, [subjectUid, users, me]);

  /* === Progresso === */
  const progress = useMemo(
    () => calculateProgressFromItems(items),
    [items]
  );

  /* === Salvar PDI (create/update) === */
  const handleSavePDI = useCallback(async () => {
    if (!canEditHeader) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      const newPlanId = await savePdiHeader({
        planId,
        ownerUid: subjectUid,
        ownerName: subjectDisplayName || "",
        collaboratorName: subjectDisplayName || "",
        profile,
        roleTitle,
        managerName,
        startDate,
        endDate,
        followUp,
      });
      setPlanId(newPlanId);
    } catch (e) {
      console.error("savePDI error:", e);
      alert(
        e?.code === "permission-denied"
          ? "Sem permissão para salvar o PDI (confira seu papel/Rules)."
          : "Não foi possível salvar o PDI."
      );
    } finally {
      savingRef.current = false;
    }
  }, [
    canEditHeader,
    planId,
    subjectUid,
    subjectDisplayName,
    profile,
    roleTitle,
    managerName,
    startDate,
    endDate,
    followUp,
  ]);

  /* === Linhas === */

  const addRow = async () => {
    if (!canManageRows || !planId) return;
    try {
      const newRow = await createPdiItem(planId, items);
      const next = [...items, newRow];
      await syncPlanProgress(planId, next);
    } catch (e) {
      console.error("addRow error:", e);
      alert(
        e?.code === "permission-denied"
          ? "Sem permissão para adicionar linha."
          : "Não foi possível adicionar a linha."
      );
    }
  };

  const duplicateRow = async (row) => {
    if (!canManageRows || !planId) return;
    try {
      await duplicatePdiItem(planId, row);
    } catch (e) {
      console.error("duplicateRow error:", e);
      alert(
        e?.code === "permission-denied"
          ? "Sem permissão para duplicar."
          : "Não foi possível duplicar a linha."
      );
    }
  };

  const removeRow = async (id) => {
    if (!canManageRows || !planId) return;
    if (!window.confirm("Excluir esta linha do plano?")) return;
    try {
      await deletePdiItem(planId, id);
      const next = items.filter((i) => i.id !== id);
      await syncPlanProgress(planId, next);
    } catch (e) {
      console.error("removeRow error:", e);
      alert(
        e?.code === "permission-denied"
          ? "Sem permissão para excluir linha."
          : "Não foi possível excluir a linha."
      );
    }
  };

  
  const updateCell = async (row, patch) => {
    if (!planId) return;

    const allowedOwnerKeys = ["whenRealized", "evidenceActual", "status"];
    const patchKeys = Object.keys(patch || {});

    if (!isManager) {
      if (!isOwner) return;
      if (!patchKeys.every((k) => allowedOwnerKeys.includes(k))) {
        return;
      }
    }

    try {
      await updatePdiItem(planId, row.id, patch);

      const next = items.map((i) =>
        i.id === row.id ? { ...i, ...patch } : i
      );

      await syncPlanProgress(planId, next);
    } catch (e) {
      console.error("updateCell error:", e);
      alert(
        e?.code === "permission-denied"
          ? "Sem permissão para alterar este campo."
          : "Falha ao salvar o campo."
      );
    }
  };

  /* === Checkpoints acompanhamento === */
  const checkpoints = useMemo(() => {
    if (!startDate || !endDate) return [];
    try {
      const [d, m, y] = startDate.split("/").map(Number);
      const [d2, m2, y2] = endDate.split("/").map(Number);

      let cur = new Date(y, (m || 1) - 1, d || 1);
      const end = new Date(y2, (m2 || 1) - 1, d2 || 1);

      const step =
        followUp === "Semanal" ? 7 : followUp === "Quinzenal" ? 14 : 30;

      const arr = [];
      while (cur <= end && arr.length < 32) {
        arr.push(cur.toLocaleDateString("pt-BR"));
        cur = new Date(
          cur.getFullYear(),
          cur.getMonth(),
          cur.getDate() + step
        );
      }
      return arr;
    } catch {
      return [];
    }
  }, [startDate, endDate, followUp]);

  /* === UI === */
  return (
    <>
      <SectionTitle>Plano de Desenvolvimento Individual (PDI)</SectionTitle>

      {isManager && (
        <Card style={{ marginBottom: 12 }}>
          <div className="btn-row" style={{ alignItems: "center" }}>
            <select
              value={subjectUid}
              onChange={(e) => setSubjectUid(e.target.value)}
              className="select"
              style={{ minWidth: 320 }}
            >
              <option value="">— Selecione um colaborador —</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name || u.email}
                </option>
              ))}
            </select>

            {planId !== null && (
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div className="muted">Progresso</div>
                <div
                  style={{
                    width: 180,
                    height: 10,
                    background: "#eee",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background:
                        "linear-gradient(90deg,var(--gold),var(--gold-light))",
                    }}
                  />
                </div>
                <strong>{progress}%</strong>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, marginBottom: 10 }}>Cabeçalho</h3>
        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 12,
          }}
        >
          <Field
            label="Perfil"
            value={profile}
            onChange={setProfile}
            disabled={!canEditHeader}
          />
          <Field
            label="Cargo"
            value={roleTitle}
            onChange={setRoleTitle}
            disabled={!canEditHeader}
          />
          <Field
            label="Gestor"
            value={managerName}
            onChange={setManagerName}
            disabled={!canEditHeader}
          />
          <div>
            <label className="label">Acompanhamento</label>
            <select
              className="select"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              disabled={!canEditHeader}
            >
              {FOLLOWUPS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Data inicial"
            value={startDate}
            onChange={setStartDate}
            disabled={!canEditHeader}
            placeholder="dd/mm/aaaa"
          />
          <Field
            label="Data final"
            value={endDate}
            onChange={setEndDate}
            disabled={!canEditHeader}
            placeholder="dd/mm/aaaa"
          />
        </div>

        {canEditHeader && (
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button
              className="btn btn-primary"
              onClick={handleSavePDI}
              type="button"
            >
              {planId ? "Salvar PDI" : "Criar PDI"}
            </button>

            {planId && (
              <a
                className="btn"
                href={`/pdi/print/${planId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Imprimir / Salvar PDF
              </a>
            )}
          </div>
        )}
      </Card>

      {!!checkpoints.length && (
        <Card style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0, marginBottom: 10 }}>
            Acompanhamento ({followUp})
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {checkpoints.map((d, i) => (
              <span key={i} style={chip}>
                <input type="checkbox" disabled style={{ marginRight: 6 }} />
                {d}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ marginBottom: 8 }}>Plano de Desenvolvimento</h3>
          <div className="btn-row" style={{ gap: 8 }}>
            {canManageRows && planId && (
              <button
                className="btn btn-primary"
                onClick={addRow}
                type="button"
              >
                + Adicionar linha
              </button>
            )}
            {planId && (
              <a
                className="btn"
                href={`/pdi/print/${planId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Imprimir / Salvar PDF
              </a>
            )}
          </div>
        </div>

        <div className="pdi-scroll">
          <div className="pdi-grid">
            <div className="grid" style={gridHeader}>
              <div>Ponto de desenvolvimento</div>
              <div>Evidência (esperada)</div>
              <div>O quê?</div>
              <div>Quem?</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 800, color: "#4a342a" }}>
                  Execução
                </div>
                <div />
                <div className="muted" style={{ fontWeight: 700 }}>
                  Previsto
                </div>
                <div className="muted" style={{ fontWeight: 700 }}>
                  Realizado
                </div>
              </div>
              <div>Evidência realizada</div>
              <div>Status</div>
              {canManageRows && <div>Ações</div>}
            </div>

            {!planId ? (
              <p className="muted" style={{ marginTop: 8 }}>
                Salve o PDI para liberar as linhas.
              </p>
            ) : items.length === 0 ? (
              <p className="muted" style={{ marginTop: 8 }}>
                Nenhuma linha ainda.{" "}
                {canManageRows
                  ? "Clique em “Adicionar linha” para começar."
                  : ""}
              </p>
            ) : (
              items.map((row) => (
                <div key={row.id} className="grid" style={gridRow}>
                  <AutoGrowTextArea
                    value={row.devPoint}
                    onChange={(v) => updateCell(row, { devPoint: v })}
                    disabled={!isManager}
                    minRows={2}
                  />

                  <AutoGrowTextArea
                    value={row.evidenceExpected}
                    onChange={(v) => updateCell(row, { evidenceExpected: v })}
                    disabled={!isManager}
                    minRows={2}
                  />

                  <AutoGrowTextArea
                    value={row.what}
                    onChange={(v) => updateCell(row, { what: v })}
                    disabled={!isManager}
                    minRows={2}
                  />

                  <input
                    className="input input-lg"
                    value={row.who || ""}
                    onChange={(e) => updateCell(row, { who: e.target.value })}
                    disabled={!isManager}
                    placeholder="Responsável"
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <input
                      className="input input-lg"
                      value={row.whenPlanned || ""}
                      onChange={(e) =>
                        updateCell(row, { whenPlanned: e.target.value })
                      }
                      placeholder="dd/mm/aaaa"
                      disabled={!isManager}
                    />

                    <input
                      className="input input-lg"
                      value={row.whenRealized || ""}
                      onChange={(e) =>
                        updateCell(row, { whenRealized: e.target.value })
                      }
                      placeholder="dd/mm/aaaa"
                      disabled={!(isManager || isOwner)}
                    />
                  </div>

                  <AutoGrowTextArea
                    value={row.evidenceActual || ""}
                    onChange={(v) => updateCell(row, { evidenceActual: v })}
                    placeholder="Descreva a evidência entregue"
                    minRows={2}
                    disabled={!(isManager || isOwner)}
                  />

                  <select
                    className="select"
                    value={row.status || "nao_iniciada"}
                    onChange={(e) => updateCell(row, { status: e.target.value })}
                    disabled={!(isManager || isOwner)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.k} value={s.k}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  {canManageRows && (
                    <div className="btn-row" style={{ justifyContent: "flex-start" }}>
                      <button
                        className="btn"
                        onClick={() => duplicateRow(row)}
                        type="button"
                      >
                        Duplicar
                      </button>
                      <button
                        className="btn"
                        onClick={() => removeRow(row.id)}
                        type="button"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </>
  );
}

/* ===== estilos da grade ===== */

const gridHeader = {
  gridTemplateColumns: "3fr 2.4fr 2fr 1.2fr 2.2fr 2.2fr 1.2fr 1fr",
  gap: 10,
  padding: "10px 0",
  fontWeight: 800,
  color: "var(--ink-2,#3e2c22)",
  borderBottom: "1px solid var(--border)",
};

const gridRow = {
  gridTemplateColumns: "3fr 2.4fr 2fr 1.2fr 2.2fr 2.2fr 1.2fr 1fr",
  gap: 10,
  padding: "10px 0",
  alignItems: "stretch",
  borderBottom: "1px solid #eee",
};

const chip = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #e5d7b8",
  background: "#fff",
  color: "#3e2c22",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 700,
};
