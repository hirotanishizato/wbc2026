import { useEffect, useState } from "react";
import { api } from "../api.js";

const EMPTY = { title: "", category: "", triggerKeywords: "", body: "", enabled: true };

export default function Templates({ tenantId }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  async function load() {
    const { templates } = await api.listTemplates(tenantId);
    setItems(templates);
  }
  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  function startNew() {
    setEditing("new");
    setForm(EMPTY);
  }
  function startEdit(t) {
    setEditing(t.id);
    setForm({
      title: t.title,
      category: t.category || "",
      triggerKeywords: (t.trigger_keywords || []).join(", "),
      body: t.body,
      enabled: t.enabled,
    });
  }
  async function save() {
    const payload = {
      title: form.title,
      category: form.category || null,
      triggerKeywords: form.triggerKeywords.split(",").map((s) => s.trim()).filter(Boolean),
      body: form.body,
      enabled: form.enabled,
    };
    if (editing === "new") await api.createTemplate(tenantId, payload);
    else await api.updateTemplate(tenantId, editing, payload);
    setEditing(null);
    await load();
  }
  async function remove(id) {
    if (!confirm("削除しますか？")) return;
    await api.deleteTemplate(tenantId, id);
    await load();
  }

  return (
    <section>
      <div className="page-header">
        <h2>返信テンプレート</h2>
        <button onClick={startNew}>新規作成</button>
      </div>
      <p className="muted">よくある問い合わせパターンの返信文を登録しておくと、AIが優先的に流用します。トリガーキーワードはカンマ区切り。</p>

      {editing && (
        <div className="card edit-form">
          <h3>{editing === "new" ? "新規テンプレート" : "編集"}</h3>
          <label>タイトル<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>カテゴリ<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label>トリガーキーワード（カンマ区切り）<input value={form.triggerKeywords} onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })} placeholder="発送, 配送, いつ届" /></label>
          <label>本文<textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
          <label className="row"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> 有効</label>
          <div className="actions">
            <button onClick={save} className="primary">保存</button>
            <button onClick={() => setEditing(null)}>キャンセル</button>
          </div>
        </div>
      )}

      <ul className="entry-list">
        {items.map((t) => (
          <li key={t.id} className="entry">
            <div className="entry-head">
              <h4>{t.title}{!t.enabled && <span className="badge">無効</span>}</h4>
              <div className="actions">
                <button onClick={() => startEdit(t)}>編集</button>
                <button onClick={() => remove(t.id)} className="danger">削除</button>
              </div>
            </div>
            {t.category && <p className="small muted">カテゴリ: {t.category}</p>}
            {t.trigger_keywords?.length > 0 && (
              <p className="small">キーワード: {t.trigger_keywords.join(", ")}</p>
            )}
            <pre className="body-text">{t.body}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}
