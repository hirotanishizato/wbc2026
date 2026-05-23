import { useState } from "react";
import { supabase } from "../supabase.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error } = await fn({ email, password });
      if (error) setMsg(error.message);
      else if (mode === "signup") setMsg("確認メールを送信しました。受信箱をご確認ください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <form onSubmit={submit} className="auth-card">
        <h1>RMS問い合わせ管理</h1>
        <p className="muted">楽天 R-Messe 問い合わせを AI で下書きするツール</p>
        <label>
          メールアドレス
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          パスワード
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "処理中…" : mode === "signin" ? "ログイン" : "新規登録"}
        </button>
        <button type="button" className="link" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "新規登録はこちら" : "ログインはこちら"}
        </button>
        {msg && <p className="auth-msg">{msg}</p>}
      </form>
    </div>
  );
}
