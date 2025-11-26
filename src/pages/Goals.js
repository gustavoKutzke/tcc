// src/pages/Goals.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";


import { listenCurrentUser } from "../services/userService";


import {
  createGoal,
  deleteGoalById,
  listenGoalsForCollaborator,
  listenGoalsForManager,
  toggleGoalStatus,
} from "../services/goalsService";


const UPDATE_USER_POINTS = true;

export default function Goals() {
  const navigate = useNavigate();

  
  useEffect(
    () => auth.onAuthStateChanged((u) => !u && navigate("/auth")),
    [navigate]
  );

  // ---- DADOS DO USUÁRIO LOGADO ----
  const [userData, setUserData] = useState(null);
  useEffect(() => {
    const unsub = listenCurrentUser(setUserData);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // --- FORM (só gestor) ---
  const [ownerUid, setOwnerUid] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [points, setPoints] = useState(50);
  const [due, setDue] = useState(""); 
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  
  const [careerPreview, setCareerPreview] = useState(null);

  // --- DADOS ---
  const [users, setUsers] = useState([]);
  const [goals, setGoals] = useState([]);

  // --- FILTROS (gestor) ---
  const [fUser, setFUser] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  // Carrega colaboradores 
  useEffect(() => {
    if (userData?.role !== "gestor") return;
    const qUsers = query(
      collection(db, "users"),
      where("role", "==", "colaborador"),
      orderBy("name")
    );
    const unsub = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) })));
    });
    return () => unsub();
  }, [userData?.role]);

  // Carrega metas 
  useEffect(() => {
    if (!userData) return;

    let unsub;
    if (userData.role === "colaborador") {
      unsub = listenGoalsForCollaborator(userData.uid, setGoals);
    } else {
      unsub = listenGoalsForManager(
        { ownerUid: fUser, status: fStatus },
        setGoals
      );
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [userData, fUser, fStatus]);

  
  useEffect(() => {
    if (!ownerUid || userData?.role !== "gestor") {
      setCareerPreview(null);
      return;
    }
    (async () => {
      try {
        const s = await getDoc(doc(db, "users", ownerUid, "career", "current"));
        setCareerPreview(s.exists() ? s.data() : null);
      } catch {
        setCareerPreview(null);
      }
    })();
  }, [ownerUid, userData?.role]);

  const canSave = useMemo(
    () =>
      userData?.role === "gestor" &&
      ownerUid &&
      title.trim().length >= 3 &&
      Number(points) > 0 &&
      due,
    [userData?.role, ownerUid, title, points, due]
  );

  async function createGoalHandler(e) {
    e.preventDefault();
    if (!canSave || !userData) return;
    setSaving(true);
    setErr("");
    try {
      const user = users.find((u) => u.uid === ownerUid);
      await createGoal({
        title,
        description: desc,
        points: Number(points),
        dueDateISO: due,
        ownerUid,
        ownerName: user?.name || "",
        createdByUid: userData.uid,
      });

      setTitle("");
      setDesc("");
      setPoints(50);
      setDue("");
    } catch (e) {
      console.error(e);
      setErr("Erro ao salvar meta. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function prefillFromCareer() {
    if (!careerPreview) return;
   
    const suggestedTitle = careerPreview.role
      ? `Marco de Carreira: ${careerPreview.role}`
      : "Marco de Carreira";

    setTitle(suggestedTitle);
    setDesc(careerPreview.nextMilestone || "");
    
    if (!points) setPoints(100);
    if (!due) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setDue(`${yyyy}-${mm}-${dd}`);
    }
  }

  async function toggleStatus(g) {
    if (userData?.role !== "gestor") return;
    try {
      await toggleGoalStatus(g, { updateUserPoints: UPDATE_USER_POINTS });
    } catch (e) {
      console.error(e);
      alert("Não foi possível atualizar o status da meta.");
    }
  }

  async function removeGoal(id) {
    if (userData?.role !== "gestor") return;
    if (!window.confirm("Excluir esta meta?")) return;
    try {
      await deleteGoalById(id);
    } catch (e) {
      console.error(e);
      alert("Não foi possível excluir a meta.");
    }
  }

  if (!userData) {
    return (
      <div className="card">
        <p className="muted">Carregando...</p>
      </div>
    );
  }

  // ------- Vista do COLABORADOR -------
  if (userData.role === "colaborador") {
    return (
      <>
        <h2 className="section-title">Minhas Metas</h2>
        <div className="grid">
          {goals.map((g) => (
            <GoalItem key={g.id} goal={g} isManager={false} />
          ))}
          {goals.length === 0 && (
            <div className="card">
              <p className="muted">Você ainda não possui metas atribuídas.</p>
            </div>
          )}
        </div>
      </>
    );
  }

  // ------- Vista do GESTOR -------
  return (
    <>
      <h2 className="section-title">Metas (Gestor)</h2>

      {/* Formulário - apenas gestor */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 6 }}>
          Cadastrar nova meta para colaborador
        </h3>
        <form
          onSubmit={createGoalHandler}
          className="grid"
          style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div style={{ gridColumn: "1 / 3" }}>
            <label className="label">Colaborador</label>
            <select
              className="select"
              value={ownerUid}
              onChange={(e) => setOwnerUid(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name || u.email}
                </option>
              ))}
            </select>

            {}
            {careerPreview?.nextMilestone && (
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={prefillFromCareer}
                >
                  Preencher do Marco de Carreira
                </button>
                <span className="muted">
                  Ex.: “
                  {careerPreview.nextMilestone.slice(0, 70)}
                  {careerPreview.nextMilestone.length > 70 ? "…" : ""}”
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="label">Título</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Concluir relatório trimestral"
              required
            />
          </div>
          <div>
            <label className="label">Pontos</label>
            <input
              type="number"
              min={1}
              className="input"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>

          <div style={{ gridColumn: "1 / 3" }}>
            <label className="label">Descrição</label>
            <textarea
              className="textarea"
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Detalhes, critérios de aceite, links..."
            />
          </div>

          <div>
            <label className="label">Prazo</label>
            <input
              type="date"
              className="input"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              required
            />
          </div>

          <div className="btn-row" style={{ alignItems: "end" }}>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setTitle("");
                setDesc("");
                setPoints(50);
                setDue("");
              }}
            >
              Limpar
            </button>
            <button className="btn btn-primary" disabled={!canSave || saving}>
              {saving ? "Salvando..." : "Salvar meta"}
            </button>
          </div>

          {err && (
            <div className="error" style={{ gridColumn: "1 / 3" }}>
              {err}
            </div>
          )}
        </form>
      </div>

      {/* Filtros - apenas gestor */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Filtros</h3>
        <div className="btn-row">
          <select
            className="select"
            value={fUser}
            onChange={(e) => setFUser(e.target.value)}
            style={{ maxWidth: 300 }}
          >
            <option value="all">Todos os colaboradores</option>
            {users.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.name || u.email}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            style={{ maxWidth: 240 }}
          >
            <option value="all">Todos os status</option>
            <option value="aberta">Abertas</option>
            <option value="concluida">Concluídas</option>
          </select>
        </div>
      </div>

      {/* Lista de metas */}
      <div className="grid">
        {goals.map((g) => (
          <GoalItem
            key={g.id}
            goal={g}
            isManager={true}
            onToggle={() => toggleStatus(g)}
            onRemove={() => removeGoal(g.id)}
          />
        ))}
        {goals.length === 0 && (
          <div className="card">
            <p className="muted">
              Nenhuma meta encontrada com os filtros atuais.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function GoalItem({ goal, isManager, onToggle, onRemove }) {
  const dueStr = goal?.dueDate?.toDate
    ? goal.dueDate.toDate().toLocaleDateString("pt-BR")
    : "-";
  const completedStr = goal?.completedAt?.toDate
    ? goal.completedAt.toDate().toLocaleDateString("pt-BR")
    : null;

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
          <div style={{ fontWeight: 900 }}>{goal.title}</div>
          <div className="muted" style={{ marginTop: 2 }}>
            Para: <strong>{goal.ownerName || goal.ownerUid}</strong> • Pontos:{" "}
            <strong>{goal.points}</strong> • Prazo: <strong>{dueStr}</strong>
            {completedStr && (
              <>
                {" "}
                • Concluída em: <strong>{completedStr}</strong>
              </>
            )}
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
          {goal.status === "concluida" ? "Concluída" : "Aberta"}
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

      {isManager && (
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button className="btn" onClick={onToggle}>
            {goal.status === "concluida"
              ? "Reabrir"
              : "Marcar como concluída"}
          </button>
          <button className="btn" onClick={onRemove}>
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}
