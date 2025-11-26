// src/components/ProfileCareerCard.js
import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

const LEVELS = ["Estagiário", "Júnior", "Pleno", "Sênior", "Líder"];

export default function ProfileCareerCard({
  subjectUid,     
  isManager,      
}) {
  const meUid = auth.currentUser?.uid;
  const canEdit = isManager || subjectUid === meUid;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [role, setRole] = useState("");
  const [level, setLevel] = useState("Júnior");
  const [skillsText, setSkillsText] = useState("");
  const [nextMilestone, setNextMilestone] = useState("");

  const skills = useMemo(
    () =>
      skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [skillsText]
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!subjectUid) return;
      setLoading(true);
      try {
        
        const snap = await getDoc(doc(db, "users", subjectUid, "career", "current"));
        if (mounted && snap.exists()) {
          const data = snap.data();
          setRole(data.role || "");
          setLevel(data.level || "Júnior");
          setSkillsText(Array.isArray(data.skills) ? data.skills.join(", ") : "");
          setNextMilestone(data.nextMilestone || "");
        } else if (mounted) {
          setRole("");
          setLevel("Júnior");
          setSkillsText("");
          setNextMilestone("");
        }
      } finally {
        mounted && setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [subjectUid]);

  async function handleSave() {
    try {
      setSaving(true);
      await setDoc(
        doc(db, "users", subjectUid, "career", "current"),
        {
          role: (role || "").trim(),
          level: level || "Júnior",
          skills,
          nextMilestone: (nextMilestone || "").trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Carreira</h3>
        {!canEdit && <span className="muted" style={{ fontSize: 12 }}>Somente leitura</span>}
      </div>

      {loading ? (
        <p className="muted">Carregando…</p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          <div className="card" style={{ background: "#fff" }}>
            <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>Cargo atual</div>
            {canEdit ? (
              <input
                className="input"
                placeholder="Ex.: Desenvolvedor Full-Stack"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            ) : (
              <div style={{ fontWeight: 900 }}>{role || "—"}</div>
            )}

            <div className="muted" style={{ fontWeight: 700, margin: "12px 0 6px" }}>Nível</div>
            {canEdit ? (
              <select className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
              </select>
            ) : (
              <div style={{ fontWeight: 900 }}>{level}</div>
            )}

            <div className="muted" style={{ fontWeight: 700, margin: "12px 0 6px" }}>
              Habilidades (separe por vírgula)
            </div>
            {canEdit ? (
              <textarea
                className="input"
                rows={3}
                placeholder="React, Node.js, Firestore, Scrum…"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
              />
            ) : (
              <div style={{ marginTop: 4 }}>
                {skills.length ? skills.map((s, i) => (
                  <span key={i} style={chip}>{s}</span>
                )) : <span className="muted">—</span>}
              </div>
            )}
          </div>

          <div className="card" style={{ background: "#fff" }}>
            <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>
              Próximo marco (meta de carreira)
            </div>
            {canEdit ? (
              <textarea
                className="input"
                rows={6}
                placeholder="Ex.: Liderar um squad e entregar um projeto X com métricas Y."
                value={nextMilestone}
                onChange={(e) => setNextMilestone(e.target.value)}
              />
            ) : (
              <div style={{ whiteSpace: "pre-wrap" }}>{nextMilestone || "—"}</div>
            )}

            {canEdit && (
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  marginRight: 6,
  marginBottom: 6,
};
