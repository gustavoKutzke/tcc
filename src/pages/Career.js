// src/pages/Career.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import {
  careerLevels,
  computeLevel,
  nextLevelProgress,
  computeBadges,
  levelBadgeStyle,
  computeGoalStreak,
  suggestDailyMissions,
  describeDiscStyle,
} from "../lib/gamification";


import {
  listenCurrentUser,
  updateDailyMissionsBonus,
} from "../services/userService";
import { listenUserGoals } from "../services/goalsService";
import {
  listenKudosReceivedThisMonth,
  listenKudosSentToday,
} from "../services/kudosService";
import {
  listenPdiPlanByOwnerUid,
  listenPdiItems,
  calculateProgressFromItems,
} from "../services/pdiService";

import { listenXpHistory } from "../services/xpService";


const DAILY_MISSIONS_BONUS = 10;


function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}


const DISC_LABEL = {
  D: "Executor",
  I: "Comunicador",
  S: "Planejador",
  C: "Analista",
};

export default function Career() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [goals, setGoals] = useState([]);
  const [kudosThisMonth, setKudosThisMonth] = useState(0);
  const [kudosSentToday, setKudosSentToday] = useState(0);

  // PDI do colaborador
  const [pdiPlan, setPdiPlan] = useState(null);
  const [pdiItems, setPdiItems] = useState([]);

  // ----celebração ----
  const prevLevelKeyRef = useRef(null);
  const prevMissionsAllDoneRef = useRef(false);
  const prevHasDiscRef = useRef(false);

  const [celebrate, setCelebrate] = useState(false); 
  const [pulseBadge, setPulseBadge] = useState(false); 

  const isManager = me?.role === "gestor";

  
  const [activeTab, setActiveTab] = useState("overview");

  //Histórico de XP
  const [xpHistory, setXpHistory] = useState([]);
  const lastXpIdRef = useRef(null);
  const [xpToast, setXpToast] = useState(null);

  
  useEffect(
    () =>
      auth.onAuthStateChanged((u) => {
        if (!u) navigate("/auth");
      }),
    [navigate]
  );

 
  useEffect(() => {
    const unsub = listenCurrentUser(setMe);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  //Metas do usuário
  useEffect(() => {
    if (!me?.uid) return;
    const unsub = listenUserGoals(me.uid, setGoals);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [me?.uid]);

  // Kudos recebidos no mês
  useEffect(() => {
    if (!me?.uid) return;
    const unsub = listenKudosReceivedThisMonth(me.uid, setKudosThisMonth);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [me?.uid]);

  //Kudos ENVIADOS hoje
  useEffect(() => {
    if (!me?.uid) return;
    const unsub = listenKudosSentToday(me.uid, setKudosSentToday);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [me?.uid]);

  //PDI
  useEffect(() => {
    if (!me?.uid || isManager) {
      setPdiPlan(null);
      setPdiItems([]);
      return;
    }

    const unsub = listenPdiPlanByOwnerUid(me.uid, (plan) => {
      setPdiPlan(plan);
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [me?.uid, isManager]);

  // PDI
  useEffect(() => {
    setPdiItems([]);
    if (!pdiPlan?.id) return;

    const unsub = listenPdiItems(pdiPlan.id, setPdiItems);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [pdiPlan?.id]);

  //Histórico de XP (evolução)
  useEffect(() => {
    if (!me?.uid) return;
    const unsub = listenXpHistory(me.uid, setXpHistory, { limit: 50 });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [me?.uid]);

  const level = computeLevel(me?.points || 0);
  const { next, progress, remain } = nextLevelProgress(me?.points || 0);

  
  const streak = useMemo(
    () => computeGoalStreak(goals, new Date()),
    [goals]
  );

  // Perfil DISC 
  const discProfile = me?.discProfile || null;
  const discDominant = discProfile?.dominant || null;
  const discSecondary = discProfile?.secondary || null;

  // Estatísticas do PDI atual
  const pdiStats = useMemo(() => {
    if (!pdiPlan) {
      return {
        hasPlan: false,
        progress: 0,
        totalItems: 0,
        completedItems: 0,
        statusText: "Nenhum PDI criado ainda.",
      };
    }

    const totalItems = pdiItems.length;
    const completedItems = pdiItems.filter(
      (i) => i.status === "concluida"
    ).length;

    const pct = totalItems
      ? calculateProgressFromItems(pdiItems)
      : typeof pdiPlan.progress === "number"
      ? pdiPlan.progress
      : 0;

    let statusText = "PDI em andamento.";
    if (pct >= 100) statusText = "PDI concluído 🎉";
    else if (pct === 0) statusText = "PDI ainda não iniciado.";

    return {
      hasPlan: true,
      progress: pct,
      totalItems,
      completedItems,
      statusText,
    };
  }, [pdiPlan, pdiItems]);

  // Missões do dia / semana 
  const missions = useMemo(
    () =>
      suggestDailyMissions({
        points: me?.points || 0,
        goals,
        streak,
        kudosSentToday, 
        disc: discDominant, 
        hasPdiPlan: pdiStats.hasPlan,
        pdiProgress: pdiStats.progress,
      }),
    [
      me?.points,
      goals,
      streak,
      kudosSentToday,
      discDominant,
      pdiStats.hasPlan,
      pdiStats.progress,
    ]
  );

  // Todas as missões do dia concluídas?
  const missionsAllDone = useMemo(
    () => missions.length > 0 && missions.every((m) => m.done),
    [missions]
  );

  
  const pdiItemsCompleted = me?.pdiItemsCompleted || 0;
  const pdiPlansCompleted = me?.pdiPlansCompleted || 0;

  const badges = useMemo(
    () =>
      computeBadges({
        totalPoints: me?.points || 0,
        goals,
        kudosReceivedThisMonth: kudosThisMonth,
        goalStreakDays:
          typeof streak === "number"
            ? streak
            : streak?.current || streak?.currentStreak || 0,
        
        pdiItemsCompleted,
        pdiPlansCompleted,
      }),
    [
      me?.points,
      goals,
      kudosThisMonth,
      streak,
      pdiItemsCompleted,
      pdiPlansCompleted,
    ]
  );

  //detectar subida de nível----
  useEffect(() => {
    if (!me) return;
    const currentKey = level.key;
    const prevKey = prevLevelKeyRef.current;

    if (prevKey && prevKey !== currentKey) {
      // Subiu (ou desceu) de nível -> celebra!
      setCelebrate(true);
      setPulseBadge(true);
      setTimeout(() => setCelebrate(false), 2200);
      setTimeout(() => setPulseBadge(false), 3200);
    }

    prevLevelKeyRef.current = currentKey;
  }, [me, level.key]);

  // Confete 
  useEffect(() => {
    if (!missionsAllDone || !me?.uid) {
      prevMissionsAllDoneRef.current = false;
      return;
    }

    const todayKey = todayLocalISO();

    // Evita rodar de novo caso já tenha dado o bônus hoje
    if (me.lastDailyMissionsBonusDate === todayKey) {
      prevMissionsAllDoneRef.current = true;
      return;
    }

    
    if (!prevMissionsAllDoneRef.current) {
      // animação
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2200);

      
      (async () => {
        try {
          const currentPoints = Number(me.points || 0);
          await updateDailyMissionsBonus(
            me.uid,
            currentPoints,
            DAILY_MISSIONS_BONUS,
            todayKey
          );
          console.log(
            `Bônus diário aplicado: +${DAILY_MISSIONS_BONUS} pontos para ${me.uid}`
          );
        } catch (e) {
          console.error(
            "Falha ao aplicar bônus diário de missões:",
            e
          );
        }
      })();
    }

    prevMissionsAllDoneRef.current = true;
  }, [missionsAllDone, me]);

 
  useEffect(() => {
    const hasDiscNow = !!discDominant;
    if (!prevHasDiscRef.current && hasDiscNow) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2200);
    }
    prevHasDiscRef.current = hasDiscNow;
  }, [discDominant]);

  
  useEffect(() => {
    if (!xpHistory || xpHistory.length === 0) return;
    const latest = xpHistory[0];
    if (!latest) return;

    
    if (!lastXpIdRef.current) {
      lastXpIdRef.current = latest.id;
      return;
    }

   
    if (lastXpIdRef.current !== latest.id) {
      lastXpIdRef.current = latest.id;

      const pts = Number(latest.finalPoints || 0);

      setXpToast({
        id: latest.id,
        points: pts,
        source: latest.source,
      });

      const t = setTimeout(() => setXpToast(null), 3200);
      return () => clearTimeout(t);
    }
  }, [xpHistory]);

  if (!me) {
    return (
      <div className="card">
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  return (
    <>
      {}
      <StyleAnimations />
      {celebrate && <ConfettiOverlay />}
      {xpToast && <XpToast event={xpToast} />}

      <h2 className="section-title">Mapa de Carreira</h2>

      {}
      <div
        className="card"
        style={{
          marginBottom: 12,
          padding: 8,
          display: "inline-flex",
          gap: 6,
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "4px 10px",
            fontSize: 13,
            borderRadius: 999,
            border:
              activeTab === "overview"
                ? "1px solid #c8a848"
                : "1px solid transparent",
            background:
              activeTab === "overview"
                ? "rgba(200,168,72,.10)"
                : "transparent",
          }}
        >
          Resumo
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setActiveTab("history")}
          style={{
            padding: "4px 10px",
            fontSize: 13,
            borderRadius: 999,
            border:
              activeTab === "history"
                ? "1px solid #c8a848"
                : "1px solid transparent",
            background:
              activeTab === "history"
                ? "rgba(200,168,72,.10)"
                : "transparent",
          }}
        >
          Evolução (XP)
        </button>
      </div>

      {activeTab === "history" ? (
        <XpEvolutionTab events={xpHistory} />
      ) : (
        <>
          {}
          <div
            className="card"
            style={{ marginBottom: 16, position: "relative" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="muted">Seu nível atual</div>
                <div
                  style={{
                    ...levelBadgeStyle(level.key),
                    ...(pulseBadge
                      ? { animation: "pulseGold 1.1s ease-in-out 3" }
                      : {}),
                  }}
                >
                  {level.label}
                </div>
                <div
                  className="muted"
                  style={{ marginTop: 8, fontSize: 12 }}
                >
                  Pontos totais:{" "}
                  <strong>{Number(me.points || 0)}</strong>
                </div>
              </div>

              <div style={{ minWidth: 260, flex: 1 }}>
                <div
                  className="muted"
                  style={{ marginBottom: 6 }}
                >
                  Progresso até o próximo nível{" "}
                  {next ? `(${next.label})` : "(nível máximo)"}
                </div>
                <div
                  style={{
                    background: "#f0e8de",
                    borderRadius: 10,
                    height: 14,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progress}%`,
                      background:
                        "linear-gradient(135deg,var(--gold),#f2df9c)",
                      borderRadius: 10,
                      transition: "width .5s ease",
                    }}
                  />
                </div>
                <div
                  className="muted"
                  style={{ marginTop: 6 }}
                >
                  {next ? (
                    <>
                      Faltam <strong>{remain}</strong> pts para{" "}
                      {next.label}.
                    </>
                  ) : (
                    "Você chegou ao topo da trilha atual!"
                  )}
                </div>
              </div>
            </div>
          </div>

          {}
          <div
            className="grid"
            style={{
              gridTemplateColumns:
                "minmax(0,2fr) minmax(0,1.4fr)",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>
                Trilha de Evolução
              </h3>
              <CareerTrack points={Number(me.points || 0)} />
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>
                Seu Ritmo (Streaks)
              </h3>
              <p
                className="muted"
                style={{ marginTop: 0, marginBottom: 8 }}
              >
                Quanto mais dias seguidos você mantém
                atividade, mais consistente fica sua evolução.
              </p>

              <div style={{ display: "grid", gap: 8 }}>
                <StreakPill
                  label="Sequência atual de dias com metas concluídas"
                  value={streak.current || 0}
                  highlight={(streak.current || 0) >= 3}
                />
                <StreakPill
                  label="Melhor sequência nos últimos 30 dias"
                  value={streak.bestLast30 || 0}
                />
                <StreakPill
                  label="Metas concluídas nesta semana"
                  value={streak.completedThisWeek || 0}
                />
              </div>
            </div>
          </div>

          {}
          <div
            className="card"
            style={{ marginBottom: 16 }}
          >
            {discDominant ? (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                  Seu estilo DISC
                </h3>
                <p
                  className="muted"
                  style={{ marginTop: 0, marginBottom: 10 }}
                >
                  Seu perfil comportamental foi salvo a partir do
                  teste DISC. Use essas informações para alinhar
                  metas, feedbacks e recompensas com o seu jeito
                  natural de trabalhar.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div
                      className="muted"
                      style={{ fontSize: 12 }}
                    >
                      Perfil principal
                    </div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 16,
                      }}
                    >
                      {DISC_LABEL[discDominant]} ({discDominant})
                    </div>
                    <p
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {describeDiscStyle(discDominant)}
                    </p>

                    {discSecondary && (
                      <p
                        className="muted"
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                        }}
                      >
                        Perfil de apoio:{" "}
                        <b>
                          {DISC_LABEL[discSecondary]} (
                          {discSecondary})
                        </b>
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      minWidth: 220,
                      maxWidth: 320,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Como usar esse resultado na prática
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 13,
                        lineHeight: 1.4,
                      }}
                    >
                      <li>
                        Escolha metas que aproveitem suas{" "}
                        <b>forças</b> naturais.
                      </li>
                      <li>
                        Use o DISC para combinar melhor com seu
                        gestor o <b>tipo de entrega</b> que faz
                        mais sentido.
                      </li>
                      <li>
                        Observe os riscos do seu perfil e inclua
                        ações de <b>equilíbrio</b> no seu PDI.
                      </li>
                    </ul>

                    <button
                      className="btn btn-primary"
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                      }}
                      onClick={() => navigate("/disc")}
                    >
                      Ver detalhes do meu DISC
                    </button>
                  </div>
                </div>

                <p
                  className="muted"
                  style={{ marginTop: 10, fontSize: 12 }}
                >
                  Dica: ao concluir o DISC pela primeira vez, você
                  ganha <b>+100 pontos</b> no Mapa de Carreira.
                  Novos resultados servem para atualizar seu
                  perfil, não para somar mais bônus.
                </p>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                  Descubra seu estilo DISC
                </h3>
                <p
                  className="muted"
                  style={{ marginTop: 0, marginBottom: 10 }}
                >
                  Você ainda não concluiu o teste DISC na
                  plataforma. Ele revela como você tende a se
                  comunicar, decidir e executar — e, na primeira
                  conclusão, funciona como um{" "}
                  <b>ritual de passagem</b> liberando{" "}
                  <b>+100 pontos</b> no seu Mapa de Carreira.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate("/disc")}
                >
                  Fazer o teste DISC (+100 pts na 1ª vez)
                </button>
              </>
            )}
          </div>

          {}
          <div
            className="card"
            style={{ marginBottom: 16 }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>
              Campanha de Desenvolvimento (PDI)
            </h3>

            {isManager && !pdiStats.hasPlan && (
              <p
                className="muted"
                style={{ marginTop: 0, marginBottom: 8 }}
              >
                Você é gestor. Use o módulo de PDI para criar
                planos para a sua equipe.
              </p>
            )}

            {!isManager && !pdiStats.hasPlan && (
              <>
                <p
                  className="muted"
                  style={{ marginTop: 0, marginBottom: 8 }}
                >
                  Seu PDI ainda não foi criado. Assim que o seu
                  gestor abrir um plano, ele aparece aqui como uma{" "}
                  <strong>campanha de evolução</strong>.
                </p>
                <button
                  className="btn"
                  type="button"
                  onClick={() => navigate("/pdi")}
                >
                  Ver área de PDI
                </button>
              </>
            )}

            {pdiStats.hasPlan && !isManager && (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {}
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: "50%",
                    background: `conic-gradient(var(--gold) ${
                      Math.min(pdiStats.progress, 100) * 3.6
                    }deg, #f0e8de 0deg)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 18,
                    color: "#3e2c22",
                    position: "relative",
                  }}
                >
                  <span>{Math.round(pdiStats.progress)}%</span>
                  {pdiStats.progress >= 100 && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: -18,
                        fontSize: 20,
                      }}
                    >
                      🏆
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {pdiStats.statusText}
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3, minmax(0,1fr))",
                      gap: 8,
                      marginTop: 10,
                      fontSize: 12,
                    }}
                  >
                    <PdiMiniStat
                      label="Itens concluídos"
                      value={`${pdiStats.completedItems}/${pdiStats.totalItems || 0}`}
                    />
                    <PdiMiniStat
                      label="Data inicial"
                      value={pdiPlan?.startDate || "—"}
                    />
                    <PdiMiniStat
                      label="Data final"
                      value={pdiPlan?.endDate || "—"}
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                    }}
                    type="button"
                    onClick={() => navigate("/pdi")}
                  >
                    Abrir meu PDI
                  </button>

                  {pdiStats.progress >= 100 && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #e5d7b8",
                        background:
                          "rgba(200,168,72,.08)",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>🎖️</span>
                      <span>
                        Parabéns! Você concluiu seu PDI atual. Essa
                        conquista conta como um{" "}
                        <b>troféu de desenvolvimento</b> na sua
                        jornada.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Missões do dia / semana */}
          <div
            className="card"
            style={{ marginBottom: 16 }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>
              Missões do Dia
            </h3>
            <p
              className="muted"
              style={{ marginTop: 0, marginBottom: 8 }}
            >
              Pequenas tarefas desenhadas para manter seu foco e
              ajudar a construir consistência.
            </p>

            {missions.length === 0 ? (
              <p className="muted">
                Nenhuma missão disponível no momento.
              </p>
            ) : (
              <>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {missions.map((m) => (
                    <li
                      key={m.key}
                      className="card"
                      style={{
                        padding: "10px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: m.done
                          ? "rgba(200,168,72,.08)"
                          : "var(--surface)",
                        border: m.done
                          ? "1px solid #e5d7b8"
                          : "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          border: "2px solid #c8a848",
                          background: m.done
                            ? "linear-gradient(135deg,#f2df9c,#c8a848)"
                            : "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                        }}
                      >
                        {m.done ? "✓" : ""}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14 }}>
                          {m.label}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: ".04em",
                            color: "#a08d7e",
                          }}
                        >
                          Missão • Gamificação
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {}
                {missionsAllDone && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e5d7b8",
                      background: "rgba(200,168,72,.09)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🔥</span>
                    <span>
                      <strong>Parabéns!</strong> Você concluiu todas
                      as missões do dia e ganhou{" "}
                      <strong>+{DAILY_MISSIONS_BONUS} pontos</strong>.
                      🚀
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {}
          <div
            className="card"
            style={{ marginBottom: 16 }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>
              Benefícios do seu nível
            </h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {(computeLevel(me.points).perks || []).map((p, i) => (
                <li
                  key={i}
                  style={{ margin: "6px 0", color: "var(--subtle)" }}
                >
                  {p}
                </li>
              ))}
              {(!computeLevel(me.points).perks ||
                computeLevel(me.points).perks.length === 0) && (
                <li className="muted">
                  Sem benefícios específicos cadastrados.
                </li>
              )}
            </ul>
          </div>

          {}
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>
              Conquistas (marcos)
            </h3>
            {badges.length === 0 ? (
              <p className="muted">
                Você ainda não desbloqueou marcos. Continue
                avançando!
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                {badges.map((b) => (
                  <div
                    key={b.key}
                    className="card"
                    style={{
                      width: 170,
                      textAlign: "center",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "12px 10px",
                      background: "var(--surface)",
                      boxShadow: "var(--shadow)",
                      animation: celebrate ? "popIn 420ms ease" : "none",
                    }}
                  >
                    <div style={{ fontSize: 22 }}>🏅</div>
                    <div
                      style={{
                        fontWeight: 800,
                        marginTop: 6,
                      }}
                    >
                      {b.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

/**Componente de Streak*/
function StreakPill({ label, value, highlight }) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "8px 10px",
        background: highlight
          ? "rgba(200,168,72,.08)"
          : "var(--surface)",
      }}
    >
      <div>
        <div style={{ fontSize: 13 }}>{label}</div>
        <div
          className="muted"
          style={{ fontSize: 11 }}
        >
          Mantendo consistência aumenta sua evolução.
        </div>
      </div>
      <div
        style={{
          minWidth: 44,
          textAlign: "center",
          padding: "4px 8px",
          borderRadius: 999,
          border: "1px solid #e5d7b8",
          fontWeight: 800,
          background: "#fffdf7",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/**estatísticas do PDI*/
function PdiMiniStat({ label, value }) {
  return (
    <div
      style={{
        padding: "6px 8px",
        borderRadius: 10,
        border: "1px solid #e5d7b8",
        background: "#fffcf5",
      }}
    >
      <div
        className="muted"
        style={{ fontSize: 11 }}
      >
        {label}
      </div>
      <div
        style={{ fontWeight: 800, fontSize: 13 }}
      >
        {value}
      </div>
    </div>
  );
}

/**Trilha visual de níveis*/
function CareerTrack({ points = 0 }) {
  const activeIdx = careerLevels.reduce(
    (acc, lv, idx) => (points >= lv.min ? idx : acc),
    0
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {}
      <div style={{ display: "grid", gap: 10 }}>
        {careerLevels.map((lv, i) => {
          const active = i <= activeIdx;
          return (
            <div
              key={lv.key}
              className="card"
              style={{
                border: "1px solid var(--border)",
                background: active
                  ? "rgba(200,168,72,.06)"
                  : "var(--surface)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 900 }}>{lv.label}</div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontWeight: 800,
                    border: "1px solid #e5d7b8",
                    color: active ? "#4a342a" : "#7b6c64",
                    background: active
                      ? "rgba(200,168,72,.15)"
                      : "#fff",
                  }}
                >
                  {active
                    ? "Atingido"
                    : `Faltam ${Math.max(0, lv.min - points)} pts`}
                </span>
              </div>
              {lv.perks?.length > 0 && (
                <ul
                  style={{
                    margin: "8px 0 0 18px",
                    color: "var(--subtle)",
                  }}
                >
                  {lv.perks.map((p, i2) => (
                    <li key={i2} style={{ margin: "4px 0" }}>
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Histórico de XP */
function XpEvolutionTab({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="card">
        <p className="muted">
          Ainda não há eventos de XP registrados.  
          Assim que você concluir metas, PDI, kudos ou DISC, sua evolução
          aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>
        Evolução de XP
      </h3>
      <p
        className="muted"
        style={{ marginTop: 0, marginBottom: 10, fontSize: 13 }}
      >
        Últimos eventos que somaram (ou removeram) pontos no seu Mapa
        de Carreira.
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        {events.map((e) => {
          const pts = Number(e.finalPoints || 0);
          const positive = pts >= 0;
          const sign = positive ? "+" : "";
          const createdAtStr = e.createdAt?.toDate
            ? e.createdAt
                .toDate()
                .toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
            : "-";

          return (
            <div
              key={e.id}
              className="card"
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: "var(--surface)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {xpSourceDescription(e)}
                </div>
                <div
                  className="muted"
                  style={{ fontSize: 11 }}
                >
                  {createdAtStr}
                </div>
              </div>
              <div
                style={{
                  minWidth: 70,
                  textAlign: "right",
                  fontWeight: 800,
                  fontSize: 13,
                  color: positive ? "#1a7f3c" : "#b3261e",
                }}
              >
                {sign}
                {pts} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function xpSourceDescription(e) {
  const src = e.source || "custom";
  const pts = Number(e.finalPoints || 0);

  switch (src) {
    case "goal_completed":
      return "Meta concluída";
    case "goal_reopen":
      return "Reabertura de meta (ajuste de XP)";
    case "kudos_received":
      return "Kudos recebido";
    case "kudos_sent":
      return "Kudos enviado";
    case "feedback_received":
      return "Feedback recebido";
    case "feedback_sent":
      return "Feedback enviado";
    case "daily_missions":
      return "Bônus por missões diárias";
    case "weekly_missions":
      return "Bônus por missões semanais";
    case "pdi_completed":
    
      return pts > 0
        ? "Progresso no PDI"
        : "Ajuste de XP do PDI";
    case "disc_completed":
      return "Conclusão do teste DISC";
    default:
      return "Ação gamificada";
  }
}

/*Toast de XP*/
function XpToast({ event }) {
  const pts = Number(event.points || 0);
  const positive = pts >= 0;
  const sign = positive ? "+" : "";

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 80,
        pointerEvents: "none",
      }}
    >
      <div
        className="card"
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          boxShadow: "0 10px 24px rgba(0,0,0,.15)",
          background: "#fffdf7",
          border: "1px solid #e5d7b8",
          minWidth: 220,
          animation: "popIn 260ms ease",
        }}
      >
        <div style={{ fontSize: 14, marginBottom: 2 }}>
          🎉{" "}
          <strong>
            {sign}
            {pts} pontos
          </strong>
        </div>
        <div
          className="muted"
          style={{ fontSize: 12 }}
        >
          {xpSourceLabel(event.source)}
        </div>
      </div>
    </div>
  );
}

function xpSourceLabel(source) {
  switch (source) {
    case "goal_completed":
      return "Por concluir uma meta";
    case "goal_reopen":
      return "Ajuste por reabrir meta";
    case "kudos_received":
      return "Por receber um kudos";
    case "kudos_sent":
      return "Por enviar um kudos";
    case "feedback_received":
      return "Por receber um feedback";
    case "feedback_sent":
      return "Por enviar um feedback";
    case "daily_missions":
      return "Bônus de missões diárias";
    case "weekly_missions":
      return "Bônus de missões semanais";
    case "pdi_completed":
      return "Progresso no PDI";
    case "disc_completed":
      return "Primeira conclusão do DISC";
    default:
      return "Ação gamificada";
  }
}

/*Confete leve */
function ConfettiOverlay({ pieces = 36, duration = 2000 }) {
  
  const items = useMemo(() => {
    const arr = [];
    for (let i = 0; i < pieces; i++) {
      arr.push({
        id: i,
        left: Math.random() * 100, 
        delay: Math.random() * 120, 
        rot: Math.random() * 360, 
        size: 6 + Math.random() * 10, 
        fall: 60 + Math.random() * 20, 
        emoji:
          Math.random() < 0.4
            ? "⭐"
            : Math.random() < 0.5
            ? "✨"
            : "🟡",
      });
    }
    return arr;
  }, [pieces]);

  useEffect(() => {
    const t = setTimeout(() => {
     
    }, duration + 400);
    return () => clearTimeout(t);
  }, [duration]);

  return (
    <div style={confettiWrap}>
      {items.map((it) => (
        <span
          key={it.id}
          style={{
            position: "absolute",
            top: "-4vh",
            left: `${it.left}%`,
            fontSize:
              it.emoji === "🟡"
                ? `${Math.round(it.size / 1.2)}px`
                : `${it.size}px`,
            transform: `rotate(${it.rot}deg)`,
            animation: `fall ${
              1200 + it.fall * 10
            }ms ease-in forwards`,
            animationDelay: `${it.delay}ms`,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {it.emoji}
        </span>
      ))}
    </div>
  );
}

/* CSS Animations  */
function StyleAnimations() {
  return (
    <style>
      {`
@keyframes pulseGold {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(200,168,72,.0);
  }
  50% {
    transform: scale(1.04);
    box-shadow: 0 8px 22px rgba(200,168,72,.25);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(200,168,72,.0);
  }
}
@keyframes fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translateY(72vh) rotate(360deg);
    opacity: 0;
  }
}
@keyframes popIn {
  0% {
    transform: scale(.85);
    opacity: 0;
  }
  60% {
    transform: scale(1.05);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}
`}
    </style>
  );
}

const confettiWrap = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  pointerEvents: "none",
};
