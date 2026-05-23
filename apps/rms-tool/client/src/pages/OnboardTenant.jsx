import { useState } from "react";
import { api } from "../api.js";

export default function OnboardTenant({ onCreated }) {
  const [name, setName] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [signature, setSignature] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { tenant } = await api.createTenant({
        name,
        rakutenShopUrl: shopUrl,
        signatureBlock: signature,
      });
      onCreated(tenant);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form onSubmit={submit} className="auth-card wide">
        <h1>店舗の初期登録</h1>
        <p className="muted">
          このツールを利用する店舗（テナント）の基本情報を登録してください。<br />
          楽天 RMS と Gemini の API キーは、登録後に「設定」画面から入力できます。
        </p>
        <label>
          店舗名
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          楽天市場の店舗URL（任意）
          <input value={shopUrl} onChange={(e) => setShopUrl(e.target.value)} placeholder="https://www.rakuten.co.jp/your-shop/" />
        </label>
        <label>
          返信末尾の署名（任意）
          <textarea value={signature} onChange={(e) => setSignature(e.target.value)} rows={4} placeholder={"例:\n〇〇ショップ カスタマーサポート\nhttps://www.rakuten.co.jp/your-shop/"} />
        </label>
        <button type="submit" disabled={busy}>{busy ? "登録中…" : "登録して開始"}</button>
        {err && <p className="auth-msg">{err}</p>}
      </form>
    </div>
  );
}
