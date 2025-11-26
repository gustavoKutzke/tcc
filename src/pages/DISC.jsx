// src/pages/DISC.js
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";


import { saveDiscResultService } from "../services/discService";



const GOLD = "#E5CFA3";
const BROWN = "#4e3620";

const ITEMS = [
  // D (Executor)
  { id: 1, text: "Tomo decisões com rapidez mesmo sob pressão.", dim: "D" },
  { id: 2, text: "Sinto-me confortável assumindo liderança.", dim: "D" },
  { id: 3, text: "Prefiro agir logo a ficar debatendo por muito tempo.", dim: "D" },
  { id: 4, text: "Gosto de desafios competitivos.", dim: "D" },
  { id: 5, text: "Sou direto(a) e objetivo(a) na comunicação.", dim: "D" },
  { id: 6, text: "Busco metas agressivas e mensuráveis.", dim: "D" },
  { id: 7, text: "Tendo a cobrar velocidade e eficiência do time.", dim: "D" },

  // I (Comunicador)
  { id: 8, text: "Gosto de motivar e influenciar pessoas.", dim: "I" },
  { id: 9, text: "Sou sociável e crio conexões facilmente.", dim: "I" },
  { id: 10, text: "Gosto de apresentar ideias em público.", dim: "I" },
  { id: 11, text: "Tendo a ser otimista e entusiasmado(a).", dim: "I" },
  { id: 12, text: "Prefiro conversar a resolver tudo por escrito.", dim: "I" },
  { id: 13, text: "Valorizo o clima leve e engajador.", dim: "I" },
  { id: 14, text: "Consigo persuadir pessoas para uma direção.", dim: "I" },

  // S (Planejador)
  { id: 15, text: "Sou paciente e mantenho um ritmo constante.", dim: "S" },
  { id: 16, text: "Busco harmonia e cooperação no time.", dim: "S" },
  { id: 17, text: "Prefiro mudanças graduais e bem combinadas.", dim: "S" },
  { id: 18, text: "Sou confiável e previsível no cumprimento de rotinas.", dim: "S" },
  { id: 19, text: "Tenho facilidade em ouvir e apoiar colegas.", dim: "S" },
  { id: 20, text: "Gosto de instruções claras antes de começar.", dim: "S" },
  { id: 21, text: "Procuro evitar conflitos desnecessários.", dim: "S" },

  // C (Analista)
  { id: 22, text: "Valorizo precisão, dados e fatos verificados.", dim: "C" },
  { id: 23, text: "Reviso detalhes antes de concluir uma tarefa.", dim: "C" },
  { id: 24, text: "Sigo padrões, normas e processos com rigor.", dim: "C" },
  { id: 25, text: "Analiso riscos e implicações antes de decidir.", dim: "C" },
  { id: 26, text: "Prefiro qualidade à velocidade.", dim: "C" },
  { id: 27, text: "Documentação bem-feita é essencial.", dim: "C" },
  { id: 28, text: "Gosto de medir, comparar e melhorar continuamente.", dim: "C" },
];

const FACT_LABEL = {
  D: "Executor",
  I: "Comunicador",
  S: "Planejador",
  C: "Analista",
};

const INSIGHTS = {
  D: {
    headline: "Executor (D) — foco em resultados",
    strengths: [
      "Toma decisões rápidas e com clareza.",
      "Proatividade para resolver problemas.",
      "Coragem para assumir metas e desafios.",
    ],
    risks: [
      "Pode soar direto(a) demais ao comunicar.",
      "Impaciência com detalhes e reuniões longas.",
      "Pode atropelar o time sem perceber.",
    ],
    tips: [
      "Antes de agir, pergunte: “Preciso envolver alguém?”.",
      "Inclua checkpoints de qualidade para equilibrar velocidade e precisão.",
      "Pratique feedback com mais escuta e empatia.",
    ],
  },

  I: {
    headline: "Comunicador (I) — influência e engajamento",
    strengths: [
      "Motiva pessoas e cria bom clima de trabalho.",
      "Facilidade para se comunicar e apresentar ideias.",
      "Transmite energia e entusiasmo.",
    ],
    risks: [
      "Pode perder foco e prazos.",
      "Tende a evitar conversas difíceis.",
      "Pode deixar detalhes passarem.",
    ],
    tips: [
      "Use listas e lembretes para organizar tarefas.",
      "Combine criatividade com dados e fatos.",
      "Antes de aceitar algo, pergunte: “Cabe na minha agenda?”.",
    ],
  },

  S: {
    headline: "Planejador (S) — consistência e estabilidade",
    strengths: [
      "Calma e equilíbrio em momentos de pressão.",
      "Boa escuta e apoio ao time.",
      "Confiável em rotinas e acordos.",
    ],
    risks: [
      "Pode evitar conflitos necessários.",
      "Relutância em mudanças rápidas.",
      "Tende a sobrecarregar-se por não dizer 'não'.",
    ],
    tips: [
      "Use critérios objetivos para tomar decisões mais rápidas.",
      "Divida mudanças grandes em etapas menores.",
      "Pratique conversas difíceis com mais assertividade.",
    ],
  },

  C: {
    headline: "Analista (C) — qualidade e precisão",
    strengths: [
      "Alto nível de organização e rigor.",
      "Decisão baseada em dados.",
      "Redução de riscos por prevenção.",
    ],
    risks: [
      "Perfeccionismo pode atrasar entregas.",
      "Dificuldade com improvisos.",
      "Pode ser crítico(a) demais sem perceber.",
    ],
    tips: [
      "Defina claramente o “bom o suficiente”.",
      "Trabalhe com versões incrementais (v1, v2, v3...).",
      "Reserve tempo de revisão, mas com limite para não atrasar entregas.",
    ],
  },
};

function ScoreBar({ label, value, max = 35 }) {
  const pct = Math.round((value / max) * 100);

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 700,
          color: BROWN,
        }}
      >
        <span>{label}</span>
        <span>{value} / {max}</span>
      </div>

      <div style={{ height: 9, background: "#f2f2f2", borderRadius: 999 }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: GOLD,
            borderRadius: 999,
            transition: "width .3s ease",
          }}
        />
      </div>
    </div>
  );
}



export default function DISC() {
  const navigate = useNavigate();

  useEffect(() => auth.onAuthStateChanged((u) => !u && navigate("/auth")), [navigate]);

  const [answers, setAnswers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("disc.answers") || "{}");
    } catch {
      return {};
    }
  });

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const total = ITEMS.length;
  const answeredCount = useMemo(
    () => ITEMS.reduce((acc, it) => acc + (answers[it.id] ? 1 : 0), 0),
    [answers]
  );

  const allAnswered = answeredCount === total;
  const progressPct = Math.round((answeredCount / total) * 100);

  useEffect(() => {
    localStorage.setItem("disc.answers", JSON.stringify(answers));
  }, [answers]);

  const scores = useMemo(() => {
    const s = { D: 0, I: 0, S: 0, C: 0 };
    for (const it of ITEMS) {
      const v = Number(answers[it.id] || 0);
      if (v) s[it.dim] += v;
    }
    return s;
  }, [answers]);

  const ranking = useMemo(() => {
    return ["D", "I", "S", "C"]
      .map((k) => ({ k, v: scores[k] ?? 0 }))
      .sort((a, b) => b.v - a.v);
  }, [scores]);

  const dominant = ranking[0]?.k;
  const secondary = ranking[1]?.k;

 
  async function handleSubmit() {
    if (!allAnswered) return;

    const user = auth.currentUser;
    if (!user) {
      alert("Faça login para salvar seu resultado.");
      return;
    }

    setSaving(true);
    try {
      await saveDiscResultService({
        scores,
        dominant,
        secondary,
      });

      setResult({ scores, dominant, secondary });

      localStorage.removeItem("disc.answers");
    } catch (e) {
      console.error(e);
      alert("Não foi possível salvar o resultado do DISC.");
    } finally {
      setSaving(false);
    }
  }

  

  if (result) {
    const d = INSIGHTS[dominant];
    const s2 = secondary ? INSIGHTS[secondary] : null;

    return (
      <div className="card" style={{ maxWidth: 980, margin: "0 auto", background: "#fff" }}>
        <h2 className="section-title" style={{ color: BROWN }}>Resultado DISC</h2>

        <p className="muted" style={{ color: "#6b6b6b", lineHeight: "1.5", marginTop: 0 }}>
          Seu resultado foi salvo no seu <b>Mapa de Carreira</b>.  
          Na <b>primeira vez</b> que você conclui o DISC na plataforma, ele libera  
          <b> +100 pontos</b> como ritual de passagem da trilha.
        </p>

        {}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ border: "1px solid #eae0d3", padding: 16 }}>
            <h3 style={{ color: BROWN, marginTop: 0 }}>Perfis</h3>

            <p><b>Principal:</b> {FACT_LABEL[dominant]} ({dominant})</p>
            {secondary && (
              <p><b>Secundário:</b> {FACT_LABEL[secondary]} ({secondary})</p>
            )}

            <div style={{ marginTop: 8 }}>
              <ScoreBar label="Executor (D)" value={scores.D} />
              <ScoreBar label="Comunicador (I)" value={scores.I} />
              <ScoreBar label="Planejador (S)" value={scores.S} />
              <ScoreBar label="Analista (C)" value={scores.C} />
            </div>
          </div>

          {}
          <div className="card" style={{ border: "1px solid #eae0d3", padding: 16 }}>
            <h3 style={{ color: BROWN, marginTop: 0 }}>{d.headline}</h3>
            <SectionList title="Forças" items={d.strengths} />
            <SectionList title="Riscos de excesso" items={d.risks} />
            <SectionList title="Como aproveitar este perfil" items={d.tips} />
          </div>
        </div>

        {}
        {s2 && (
          <div className="card" style={{ marginTop: 16, border: "1px solid #eae0d3", padding: 16 }}>
            <h3 style={{ color: BROWN, marginTop: 0 }}>{s2.headline} (secundário)</h3>
            <SectionList title="Como aproveitar este perfil" items={s2.tips} />
          </div>
        )}

        {}
        <div className="btn-row" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={() => navigate(-1)}>Voltar</button>
          <button className="btn" onClick={() => setResult(null)}>Refazer</button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Imprimir / Salvar PDF
          </button>
        </div>

        <p className="muted" style={{ marginTop: 8, color: "#7d7d7d" }}>
          *O teste é autoavaliativo e serve para desenvolvimento. O bônus de +100
          só é liberado na primeira conclusão pelo sistema.
        </p>
      </div>
    );
  }

 

  return (
    <div className="card" style={{ maxWidth: 980, margin: "0 auto", background: "#fff" }}>
      <h2 className="section-title" style={{ color: BROWN }}>Teste DISC</h2>

      <p className="muted" style={{ color: "#6b6b6b", lineHeight: "1.5" }}>
        O DISC identifica como você age, decide e se comunica.  
        Não existem respostas certas ou erradas — responda honestamente.  
        Ao concluir pela <b>primeira vez</b>, você recebe <b>+100 pontos</b> no Mapa de Carreira.
      </p>

      {}
      <div style={{ margin: "6px 0 12px" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 700,
          color: BROWN,
        }}>
          <span>Progresso</span>
          <span>{answeredCount}/{total} — {progressPct}%</span>
        </div>

        <div style={{ height: 8, background: "#eee3d3", borderRadius: 999 }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: GOLD,
              borderRadius: 999,
              transition: "width .3s ease",
            }}
          />
        </div>
      </div>

      <p className="muted" style={{ marginBottom: 8, color: "#666" }}>
        Responda de 1 (discordo totalmente) a 5 (concordo totalmente).
      </p>

      {}
      <div className="grid" style={{ gap: 12 }}>
        {ITEMS.map((it) => (
          <div
            key={it.id}
            className="card"
            style={{
              padding: 14,
              border: "1px solid #eae0d3",
              background: "#fff",
              borderRadius: 10,
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: 700, color: BROWN }}>
              {it.id}. {it.text}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <label key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name={`q${it.id}`}
                    checked={answers[it.id] === v}
                    onChange={() => setAnswers({ ...answers, [it.id]: v })}
                  />
                  {v}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {}
      <div className="btn-row" style={{ marginTop: 12, gap: 8 }}>
        <button
          className="btn"
          onClick={() => {
            localStorage.removeItem("disc.answers");
            setAnswers({});
          }}
        >
          Limpar respostas
        </button>

        <button
          className="btn btn-primary"
          disabled={!allAnswered || saving}
          onClick={handleSubmit}
        >
          {saving ? "Salvando..." : "Ver resultado"}
        </button>
      </div>
    </div>
  );
}



function SectionList({ title, items }) {
  return (
    <>
      <div style={{ fontWeight: 800, marginTop: 6, color: BROWN }}>
        {title}
      </div>
      <ul style={{ marginTop: 6, paddingLeft: 20 }}>
        {items.map((t, i) => (
          <li key={i} style={{ marginBottom: 4, lineHeight: "1.4" }}>
            {t}
          </li>
        ))}
      </ul>
    </>
  );
}
