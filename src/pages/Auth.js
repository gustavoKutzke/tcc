import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../lib/firebase";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

// 👇 import correto do service
import { upsertUserProfile } from "../services/userService";

export default function Auth() {
  const [params] = useSearchParams();
  const initialTab = params.get("tab") === "signup" ? "signup" : "login";
  const [tab, setTab] = useState(initialTab);

  const [name, setName] = useState("");
  const [role, setRole] = useState("colaborador");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) navigate("/dashboard", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  async function handleSignup(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }

      // 🔹 cria/atualiza doc do usuário via service (assinatura: uid, data)
      await upsertUserProfile(cred.user.uid, {
        name,
        email,
        role,
        photoURL: cred.user.photoURL || null,
      });

      navigate("/dashboard");
    } catch (e) {
      setErr(traduzErro(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      navigate("/dashboard");
    } catch (e) {
      setErr(traduzErro(e));
    } finally {
      setLoading(false);
    }
  }

  async function loginGoogle() {
    setErr("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);

      // 🔹 mesma assinatura: uid, data
      await upsertUserProfile(user.uid, {
        name: user.displayName || "",
        email: user.email || "",
        role: "colaborador", // padrão para login Google
        photoURL: user.photoURL || null,
      });

      navigate("/dashboard");
    } catch (e) {
      setErr(traduzErro(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-auth">
      <div className="card">
        {/* Marca */}
        <div className="brand-auth">
          <span className="badge" />
          <span>meu-tcc</span>
        </div>

        {/* Abas */}
        <div className="tabs">
          <button
            className={`tab ${tab === "login" ? "active" : ""}`}
            onClick={() => setTab("login")}
          >
            Entrar
          </button>
          <button
            className={`tab ${tab === "signup" ? "active" : ""}`}
            onClick={() => setTab("signup")}
          >
            Cadastrar
          </button>
        </div>

        {/* Formulários */}
        {tab === "login" ? (
          <form
            className="form"
            onSubmit={handleLogin}
            style={{ marginTop: 14, display: "grid", gap: 12 }}
          >
            <div>
              <div className="label">E-mail</div>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="label">Senha</div>
              <input
                className="input"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
              />
            </div>
            {err && <div className="error">{err}</div>}
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button className="btn" type="button" onClick={loginGoogle}>
              Entrar com Google
            </button>
            <p className="help">
              Dica: você pode alternar para “Cadastrar” na aba acima.
            </p>
          </form>
        ) : (
          <form
            className="form"
            onSubmit={handleSignup}
            style={{ marginTop: 14, display: "grid", gap: 12 }}
          >
            <div>
              <div className="label">Nome</div>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="label">Papel</div>
              <select
                className="select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="colaborador">Colaborador</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>
            <div>
              <div className="label">E-mail</div>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="label">Senha</div>
              <input
                className="input"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
              />
            </div>
            {err && <div className="error">{err}</div>}
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Cadastrando..." : "Criar conta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function traduzErro(e) {
  const msg = e?.code || e?.message || "";
  if (msg.includes("auth/invalid-email")) return "E-mail inválido.";
  if (msg.includes("auth/missing-password")) return "Informe a senha.";
  if (msg.includes("auth/weak-password"))
    return "Senha fraca (mín. 6 caracteres).";
  if (msg.includes("auth/email-already-in-use"))
    return "E-mail já cadastrado.";
  if (msg.includes("auth/invalid-credential"))
    return "Credenciais inválidas.";
  return "Erro ao autenticar. Tente novamente.";
}
