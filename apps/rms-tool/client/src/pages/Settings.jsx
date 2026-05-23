import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Settings({ tenantId }) {
  const [tenant, setTenant] = useState(null);
  const [form, setForm] = useState({
    name: "",
    rakutenShopUrl: "",
    signatureBlock: "",
    rakutenServiceSecret: "",
    rakutenLicenseKey: "",
    geminiApiKey: "",
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    api.listTenants().then(({ tenants }) => {
      const t = tenants.find((x) => x.id === tenantId);
      setTenant(t);
      if (t) {
        setForm((f) => ({
          ...f,
          name: t.name || "",
          rakutenShopUrl: t.rakuten_shop_url || "",
          signatureBlock: t.signature_block || "",
        }));
      }
    });
  }, [tenantId]);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const payload = {
        name: form.name,
        rakutenShopUrl: form.rakutenShopUrl,
        signatureBlock: form.signatureBlock,
      };
      // Only send credentials if user filled them in (avoid overwriting with empty).
      if (form.rakutenServiceSecret) payload.rakutenServiceSecret = form.rakutenServiceSecret;
      if (form.rakutenLicenseKey) payload.rakutenLicenseKey = form.rakutenLicenseKey;
      if (form.geminiApiKey) payload.geminiApiKey = form.geminiApiKey;
      await api.updateCurrentTenant(tenantId, payload);
      setMsg("保存しました");
      setForm((f) => ({ ...f, rakutenServiceSecret: "", rakutenLicenseKey: "", geminiApiKey: "" }));
    } catch (e) {
      setMsg(`保存失敗: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!tenant) return <p>読み込み中…</p>;

  return (
    <section>
      <h2>設定</h2>
      <div className="card">
        <h3>店舗情報</h3>
        <label>店舗名<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>店舗URL<input value={form.rakutenShopUrl} onChange={(e) => setForm({ ...form, rakutenShopUrl: e.target.value })} /></label>
        <label>返信末尾の署名<textarea rows={4} value={form.signatureBlock} onChange={(e) => setForm({ ...form, signatureBlock: e.target.value })} /></label>
      </div>

      <div className="card">
        <h3>楽天 RMS API 認証情報</h3>
        <p className="muted small">
          入力値は AES-256-GCM で暗号化して保管されます。再表示はできないため、変更時のみ入力してください。
          空欄のまま保存すると現在の値は維持されます。
        </p>
        <label>serviceSecret<input type="password" autoComplete="off" value={form.rakutenServiceSecret} onChange={(e) => setForm({ ...form, rakutenServiceSecret: e.target.value })} placeholder="変更しない場合は空欄" /></label>
        <label>licenseKey<input type="password" autoComplete="off" value={form.rakutenLicenseKey} onChange={(e) => setForm({ ...form, rakutenLicenseKey: e.target.value })} placeholder="変更しない場合は空欄" /></label>
      </div>

      <div className="card">
        <h3>Gemini API キー（店舗独自で利用する場合）</h3>
        <p className="muted small">設定しない場合はプラットフォーム標準キーが使われます。</p>
        <label>GEMINI_API_KEY<input type="password" autoComplete="off" value={form.geminiApiKey} onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })} placeholder="変更しない場合は空欄" /></label>
      </div>

      <div className="actions">
        <button onClick={save} disabled={busy} className="primary">保存</button>
      </div>
      {msg && <p className="notice">{msg}</p>}
    </section>
  );
}
