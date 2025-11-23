// src/components/KudosModal.js
import { useEffect, useMemo, useState } from "react";
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

// ✅ TROCA: agora usa o service que já aplica XP e loga no xpLog
import { sendKudosWithXp } from "../services/kudosService";

/**
 * Props:
 *  - open: boolean
 *  - onClose: fn
 *  - presetToUid?: string   // opcional: trava destinatário
 */
export default function KudosModal({ open, onClose, presetToUid }) {
  const [me, setMe] = useState(null);            // {uid, name, email}
  const [users, setUsers] = useState([]);        // [{uid, name, email}]
  const [toUid, setToUid] = useState("");
  const [value, setValue] = useState(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ===== Meu perfil (com NOME quando existir) =====
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return setMe(null);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const base = snap.exists() ? snap.data() : {};
        setMe({
          uid: u.uid,
          name: base.name || "",
          email: base.email || u.email || "",
        });
      } catch {
        setMe({ uid: u.uid, name: "", email: u.email || "" });
      }
    });
    return () => unsub();
  }, []);

  // ===== Lista de colaboradores (para combo) =====
  useEffect(() => {
    if (!open) return;
    const q = query(
      collection(db, "users"),
      where("role", "==", "colaborador"),
      orderBy("name")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }));
      setUsers(arr);
      if (presetToUid) setToUid(presetToUid);
    });
    return () => unsub();
  }, [open, presetToUid]);

  // evita listar o próprio usuário no select
  const selectableUsers = useMemo(
    () => users.filter((u) => u.uid !== me?.uid),
    [users, me?.uid]
  );

  function reset() {
    setToUid(presetToUid || "");
    setValue(1);
    setMessage("");
    setErr("");
  }
  function close() {
    reset();
    onClose?.();
  }

  async function submit(e) {
    e.preventDefault();
    if (!me || !toUid) return;

    // validações locais
    if (toUid === me.uid) {
      setErr("Você não pode enviar kudos para você mesmo.");
      return;
    }
    const v = Number(value);
    if (isNaN(v) || v < 1 || v > 5) {
      setErr("O valor deve estar entre 1 e 5.");
      return;
    }

    setLoading(true);
    setErr("");

    const to = users.find((u) => u.uid === toUid);
    if (!to) {
      setErr("Colaborador inválido.");
      setLoading(false);
      return;
    }

    try {
      // ✅ TROCA: agora chama sendKudosWithXp
      await sendKudosWithXp({
        fromUid: me.uid,
        fromName: me.name || me.email,
        toUid: to.uid,
        toName: to.name || to.email || to.uid,
        value: v,
        message: message.trim().slice(0, 240),
      });

      close();
      alert("Kudos enviado! 👏");
    } catch (e2) {
      setErr(e2?.message || "Falha ao enviar kudos.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const lockedUser =
    (presetToUid &&
      users.find((u) => u.uid === presetToUid)?.name) ||
    users.find((u) => u.uid === presetToUid)?.email ||
    "Colaborador";

  return (
    <div style={backdrop}>
      <div className="card" style={{ width: 520, maxWidth: "90vw" }}>
        <h3 style={{ marginTop: 0 }}>Dar Kudos</h3>

        <form
          onSubmit={submit}
          className="grid"
          style={{ gridTemplateColumns: "1fr 120px", gap: 10 }}
        >
          {/* Destinatário */}
          <div style={{ gridColumn: "1 / 3" }}>
            <label className="label">Para</label>
            {presetToUid ? (
              <input className="input" value={lockedUser} disabled />
            ) : (
              <select
                className="select"
                value={toUid}
                onChange={(e) => setToUid(e.target.value)}
                required
              >
                <option value="">Selecione um colaborador</option>
                {selectableUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="label">Valor (1–5)</label>
            <input
              className="input"
              type="number"
              min={1}
              max={5}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>

          {/* Mensagem */}
          <div style={{ gridColumn: "1 / 3" }}>
            <label className="label">Mensagem (até 240)</label>
            <textarea
              className="textarea"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex.: Obrigado pela ajuda no deploy!"
              maxLength={240}
            />
          </div>

          {/* Erro */}
          {err && (
            <div className="error" style={{ gridColumn: "1 / 3" }}>
              {err}
            </div>
          )}

          {/* Ações */}
          <div className="btn-row" style={{ gridColumn: "1 / 3" }}>
            <button type="button" className="btn" onClick={close}>
              Cancelar
            </button>
            <button className="btn btn-primary" disabled={loading || !toUid}>
              {loading ? "Enviando..." : "Enviar kudos"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.25)",
  display: "grid",
  placeItems: "center",
  zIndex: 50,
};
