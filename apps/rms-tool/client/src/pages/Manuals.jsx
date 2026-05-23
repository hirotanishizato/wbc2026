import { useEffect, useState } from "react";
import { api } from "../api.js";

const EMPTY = { title: "", category: "", itemCode: "", triggerKeywords: "", content: "", enabled: true };

export default function Manuals({ tenantId }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  async function load() {
    const { manuals } = await api.listManuals(tenantId);
    setItems(manuals);
  }
  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  function startNew() { setEditing("new"); setForm(EMPTY); }
  function startEdit(m) {
    setEditing(m.id);
    setForm({
      title: m.title,
      category: m.category || "",
      itemCode: m.item_code || "",
      triggerKeywords: (m.trigger_keywords || []).join(", "),
      content: m.content,
      enabled: m.enabled,
    });
  }
  async function save() {
    const payload = {
      title: form.title,
      category: form.category || null,
      itemCode: form.itemCode || null,
      triggerKeywords: form.triggerKeywords.split(",").map((s) => s.trim()).filter(Boolean),
      content: form.content,
      enabled: form.enabled,
    };
    if (editing === "new") await api.createManual(tenantId, payload);
    else await api.updateManual(tenantId, editing, payload);
    setEditing(null);
    await load();
  }
  async function remove(id) {
    if (!confirm("削除しますか？")) return;
    await api.deleteManual(tenantId, id);
    await load();
  }

  return (
    <section>
      <div className="page-header">
        <h2>マニュアル（商品補足情報）</h2>
        <button onClick={startNew}>新規作成</button>
      </div>
      <p className="muted">商品ページに載っていない補足仕様や運用情報を登録します。商品コードを指定すると、その商品の問い合わせ時に優先的に参照されます。</p>

      {editing && (
        <div className="card edit-form">
          <h3>{editing === "new" ? "新規マニュアル" : "編集"}</h3>
          <label>タイトル<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <div className="row-fields">
            <label>カテゴリ<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
            <label>商品コード（任意）<input value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} placeholder="shop:item-abc-123" /></label>
          </div>
          <label>トリガーキーワード（カンマ区切り）<input value={form.triggerKeywords} onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })} /></label>
          <label>本文<textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></label>
          <label className="row"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> 有効</label>
          <div className="actions">
            <button onClick={save} className="primary">保存</button>
            <button onClick={() => setEditing(null)}>キャンセル</button>
          </div>
        </div>
      )}

      <ul className="entry-list">
        {items.map((m) => (
          <li key={m.id} className="entry">
            <div className="entry-head">
              <h4>{m.title}{!m.enabled && <span className="badge">無効</span>}</h4>
              <div className="actions">
                <button onClick={() => startEdit(m)}>編集</button>
                <button onClick={() => remove(m.id)} className="danger">削除</button>
              </div>
            </div>
            <p className="small muted">
              {m.category && <>カテゴリ: {m.category} </>}
              {m.item_code && <>/ 商品: {m.item_code}</>}
            </p>
            <pre className="body-text">{m.content}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}
