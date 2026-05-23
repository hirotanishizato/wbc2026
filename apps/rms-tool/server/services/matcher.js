/**
 * Lightweight keyword-based matcher for templates and manuals.
 *
 * MVP uses substring + trigger-keyword scoring. Future versions should
 * upgrade this to pgvector + embeddings for true semantic retrieval.
 */

function normalize(s) {
  return (s || "").toLowerCase();
}

function scoreEntry(entry, bodyText) {
  const text = normalize(bodyText);
  const keywords = entry.trigger_keywords || [];
  let score = 0;
  for (const kw of keywords) {
    const k = normalize(kw);
    if (!k) continue;
    if (text.includes(k)) score += 3;
  }
  if (entry.title && text.includes(normalize(entry.title))) score += 1;
  if (entry.category && text.includes(normalize(entry.category))) score += 1;
  return score;
}

export function rankTemplates(templates, inquiryBody, { limit = 3 } = {}) {
  const scored = (templates || [])
    .filter((t) => t.enabled !== false)
    .map((t) => ({ entry: t, score: scoreEntry(t, inquiryBody) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((s) => s.entry);
}

export function rankManuals(manuals, inquiryBody, { itemCode, limit = 5 } = {}) {
  const scored = (manuals || [])
    .filter((m) => m.enabled !== false)
    .map((m) => {
      let score = scoreEntry(m, inquiryBody);
      if (itemCode && m.item_code === itemCode) score += 5;
      return { entry: m, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((s) => s.entry);
}
