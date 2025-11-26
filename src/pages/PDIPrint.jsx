// src/pages/PDIPrint.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";


export default function PDIPrint() {
  const { planId } = useParams();
  const navigate = useNavigate();

  const [plan, setPlan] = useState(null);
  const [items, setItems] = useState([]);
  const [collabName, setCollabName] = useState("—");

  useEffect(() => {
    if (!planId) return;

    // Carrega cabeçalho do plano
    getDoc(doc(db, "pdiPlans", planId)).then(async (snap) => {
      if (!snap.exists()) return;
      const p = { id: snap.id, ...snap.data() };
      setPlan(p);

      // Nome do colaborador
      const fromPlan =
        (p.collaboratorName && String(p.collaboratorName).trim()) ||
        (p.ownerName && String(p.ownerName).trim());
      if (fromPlan) {
        setCollabName(fromPlan);
      } else if (p.ownerUid) {
        try {
          const uSnap = await getDoc(doc(db, "users", p.ownerUid));
          if (uSnap.exists()) {
            const u = uSnap.data() || {};
            const name =
              (u.name && String(u.name).trim()) ||
              (u.email && String(u.email).trim());
            if (name) setCollabName(name);
          }
        } catch {/* noop */}
      }
    });

    
    const unsub = onSnapshot(
      query(collection(db, "pdiPlans", planId, "items"), orderBy("createdAt", "asc")),
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })))
    );
    return () => unsub();
  }, [planId]);

  const checkpoints = useMemo(
    () => buildCheckpoints(plan?.startDate, plan?.endDate, plan?.followUp),
    [plan]
  );

  if (!plan) {
    return (
      <div style={{ padding: 24, fontFamily: "Inter, Segoe UI, Roboto, sans-serif" }}>
        <button onClick={() => navigate(-1)} className="btn" style={{ marginBottom: 12 }}>
          Voltar
        </button>
        Carregando folha…
      </div>
    );
  }

  return (
    <div className="pdi-print-wrap">
      {/* Barra topo (não imprime) */}
      <div className="print-toolbar no-print">
        <button onClick={() => navigate(-1)} className="btn">Voltar</button>
        <button onClick={() => window.print()} className="btn btn-primary">Imprimir / Salvar PDF</button>
      </div>

      {/* Folha A4 paisagem */}
      <div className="pdi-sheet a4-landscape">
        {/* Cabeçalho */}
        <div className="sheet-header">
          <div className="brand">ACELERADOR EMPRESARIAL</div>
          <div className="title">PLANO DE DESENVOLVIMENTO INDIVIDUAL — PDI</div>
        </div>

        {/* Metadados */}
        <div className="meta-grid">
          <div><span>Colaborador:</span> {collabName}</div>
          <div><span>Perfil:</span> {plan.profile || "—"}</div>
          <div><span>Cargo:</span> {plan.roleTitle || "—"}</div>
          <div><span>Gestor:</span> {plan.managerName || "—"}</div>
          <div><span>Data inicial:</span> {plan.startDate || "—"}</div>
          <div><span>Data final:</span> {plan.endDate || "—"}</div>
          <div><span>Acompanhamento:</span> {plan.followUp || "—"}</div>
          <div><span>Status geral:</span> {typeof plan.progress === "number" ? `${plan.progress}%` : "—"}</div>
        </div>

        {/* Título tabela */}
        <div className="block-title">PLANO DE DESENVOLVIMENTO</div>

        {/* Cabeçalho da grade*/}
        <div className="grid header">
          <div className="col-n">#</div>
          <div>Ponto de desenvolvimento</div>
          <div>Evidência (esperada)</div>
          <div>O quê?</div>
          <div>Quem?</div>
          <div className="exec-header">
            <div className="exec-title">Execução</div>
            <div className="exec-sub">Previsto</div>
            <div className="exec-sub">Realizado</div>
          </div>
          <div>Evidência realizada</div>
          <div>Status</div>
        </div>

        {/* Linhas */}
        {items.length === 0 ? (
          <div className="no-rows">Sem linhas cadastradas.</div>
        ) : (
          items.map((r, idx) => (
            <div key={r.id} className="grid row">
              <div className="cell col-n">{idx + 1}</div>
              <div className="cell large">{r.devPoint || ""}</div>
              <div className="cell large">{r.evidenceExpected || ""}</div>
              <div className="cell large">{r.what || ""}</div>
              <div className="cell">{r.who || ""}</div>
              <div className="cell exec">
                <div>{r.whenPlanned || ""}</div>
                <div>{r.whenRealized || ""}</div>
              </div>
              <div className="cell large">{r.evidenceActual || ""}</div>
              <div className="cell">{labelStatus(r.status)}</div>
            </div>
          ))
        )}

        {/* Rodapé: Execução/Status resumidos */}
        <div className="block-title" style={{ marginTop: 10 }}>EXECUÇÃO</div>
        <div className="exec-footer">
          <div><span>Previsto:</span> {plan.startDate || "—"} — {plan.endDate || "—"}</div>
          <div><span>Status:</span> {typeof plan.progress === "number" ? `${plan.progress}%` : "—"}</div>
        </div>

        {/* Checklist de acompanhamento */}
        <div className="block-title" style={{ marginTop: 10 }}>ACOMPANHAMENTO</div>
        <div className="checklist">
          {checkpoints.length ? (
            checkpoints.map((d, i) => (
              <span key={i} className="chip">
                <span className="box" /> {d}
              </span>
            ))
          ) : (
            <span className="muted">Sem datas geradas.</span>
          )}
        </div>

        {/* Assinaturas */}
        <div className="block-title" style={{ marginTop: 10 }}>ASSINATURAS</div>
        <div className="signatures">
          <div className="sig">
            <div className="line" />
            <div className="who">Colaborador(a)</div>
            <div className="hint muted">Assinatura / carimbo</div>
          </div>
          <div className="sig">
            <div className="line" />
            <div className="who">Gestor(a)</div>
            <div className="hint muted">Assinatura / carimbo</div>
          </div>
        </div>

        <div className="sig-extra">
          <div className="ld">
            <div className="lbl muted">Local / Data:</div>
            <div className="line-thin" />
          </div>
          <div className="obs">
            <div className="lbl muted">Observações:</div>
            <div className="box-area" />
          </div>
        </div>
      </div>

      {/* Estilos locais para impressão */}
      <style>{styles}</style>
    </div>
  );
}


function labelStatus(k) {
  const map = {
    nao_iniciada: "Não iniciada",
    em_andamento: "Em andamento",
    atrasada: "Atrasada",
    concluida: "Concluída",
    cancelada: "Cancelada",
  };
  return map[k] || "";
}

function buildCheckpoints(start, end, followUp) {
  if (!start || !end) return [];
  try {
    const parse = (s) => {
      const [d, m, y] = (s || "").split("/").map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    const s = parse(start);
    const e = parse(end);
    const step = followUp === "Semanal" ? 7 : followUp === "Quinzenal" ? 14 : 30;
    const out = [];
    for (let cur = new Date(s); cur <= e && out.length < 32; cur.setDate(cur.getDate() + step)) {
      out.push(new Date(cur).toLocaleDateString("pt-BR"));
    }
    return out;
  } catch {
    return [];
  }
}

/*CSS*/
const styles = `
.pdi-print-wrap {
  font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;
  color: #3e2c22;
  background: #f8f5ef;
  min-height: 100vh;
  padding: 12px;
}
.no-print { display: flex; gap: 8px; margin-bottom: 10px; }
.print-toolbar .btn { padding: 8px 14px; font-weight: 700; border-radius: 10px; border: none; cursor: pointer; }
.print-toolbar .btn { background: #4a352b; color: #fff; }
.print-toolbar .btn:hover { background: #2b211b; }
.print-toolbar .btn.btn-primary {
  background: linear-gradient(135deg, #c8a848, #f2df9c);
  color: #2b211b;
}

.a4-landscape {
  width: 1122px;            /* preview ~ 96dpi de A4 landscape (11.69in x 8.27in) */
  min-height: 794px;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
  border: 1px solid rgba(0,0,0,.05);
  padding: 16px 18px;
  box-sizing: border-box;
}

.sheet-header {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  text-align: center;
  margin-bottom: 8px;
}
.sheet-header .brand { font-weight: 900; letter-spacing: .5px; color: #2b211b; }
.sheet-header .title { font-weight: 900; font-size: 18px; color: #2b211b; }

.meta-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px 12px;
  font-size: 13px;
  margin-bottom: 10px;
}
.meta-grid span { font-weight: 800; color: #4a342a; }

.block-title {
  font-weight: 900;
  font-size: 14px;
  color: #4a342a;
  border-left: 6px solid #c8a848;
  padding-left: 8px;
  margin: 6px 0;
}

.grid.header {
  display: grid;
  grid-template-columns: 0.5fr 2.4fr 2.0fr 1.8fr 1.1fr 2.2fr 2.6fr 1.2fr;
  gap: 6px;
  font-weight: 800;
  border-bottom: 1px solid #e9e1d8;
  padding: 6px 0;
}
.grid.row {
  display: grid;
  grid-template-columns: 0.5fr 2.4fr 2.0fr 1.8fr 1.1fr 2.2fr 2.6fr 1.2fr;
  gap: 6px;
  border-bottom: 1px solid #f0e9dc;
  padding: 6px 0;
  page-break-inside: avoid;   /* evita quebrar linha no meio ao imprimir */
}
.col-n { text-align: center; font-weight: 800; }
.cell { font-size: 12px; line-height: 1.25; white-space: pre-wrap; word-break: break-word; }
.cell.large { min-height: 34px; }
.exec { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.exec-header {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.exec-title { grid-column: 1 / 3; font-weight: 900; color: #4a342a; }
.exec-sub { font-weight: 700; color: #7b6c64; }

.no-rows {
  font-size: 12px; color: #7b6c64; padding: 6px 0; border-bottom: 1px solid #f0e9dc;
}

/* Execução/Status compactos */
.exec-footer {
  display: grid; grid-template-columns: 2fr 1fr; gap: 12px;
  font-size: 12px; padding: 6px 0; border-bottom: 1px solid #e9e1d8;
}
.exec-footer span { font-weight: 800; color: #4a342a; }

/* Checklist */
.checklist { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid #e5d7b8; background: #fff;
  color: #3e2c22; border-radius: 999px;
  padding: 3px 10px; font-size: 11px; font-weight: 700;
}
.chip .box {
  width: 10px; height: 10px; border: 1px solid #3e2c22;
  display: inline-block; background: #fff;
}

/* Assinaturas */
.signatures {
  display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: end;
}
.sig .line { height: 56px; border-bottom: 1px solid #333; }
.sig .who { font-weight: 800; margin-top: 6px; }
.sig .hint { font-size: 11px; }

.sig-extra { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px; }
.sig-extra .lbl { font-size: 12px; margin-bottom: 4px; }
.line-thin { height: 24px; border-bottom: 1px solid #e9e1d8; }
.box-area { height: 64px; border: 1px solid #e9e1d8; border-radius: 8px; }

/* Impressão */
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  .no-print { display: none !important; }
  .a4-landscape {
    width: auto; min-height: auto; box-shadow: none; border: none; padding: 0;
  }
}
`;
