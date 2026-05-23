/**
 * Evaluates per-tenant delivery rules against an order.
 *
 * Rule schema (rule jsonb on rms_delivery_rules):
 *   {
 *     "order_before": "14:00",            // optional HH:MM JST cutoff
 *     "ship_within_business_days": 1,     // ship in N business days from order
 *     "ship_within_calendar_days": null,  // alternative to business-days
 *     "exclude_weekends": true,
 *     "exclude_holidays": false,          // (holidays calendar not loaded in MVP)
 *     "item_codes": ["shop:item-aaa-123"],// optional restrict
 *     "categories": []                    // optional restrict (reserved)
 *   }
 *
 * Returns the first matching rule's computed shipping window:
 *   { ruleId, ruleName, shipDate, message }
 */

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function addBusinessDays(start, n, { excludeWeekends }) {
  const d = new Date(start);
  let remaining = n;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (excludeWeekends && isWeekend(d)) continue;
    remaining -= 1;
  }
  return d;
}

function parseHHMM(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function ruleAppliesToOrder(rule, order) {
  const itemCodes = rule.item_codes || [];
  if (itemCodes.length > 0) {
    const orderCodes = (order.items || []).map((i) => i.itemCode);
    const hit = itemCodes.some((c) => orderCodes.includes(c));
    if (!hit) return false;
  }
  return true;
}

export function evaluateDeliveryRules(rules, order, { now = new Date() } = {}) {
  if (!order) return null;
  const sorted = [...(rules || [])]
    .filter((r) => r.enabled !== false)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const r of sorted) {
    const rule = r.rule || {};
    if (!ruleAppliesToOrder(rule, order)) continue;

    const orderedAt = new Date(order.orderedAt || now);
    let basis = new Date(orderedAt);

    // Apply order-before cutoff: orders after cutoff are treated as next-day orders.
    const cutoff = parseHHMM(rule.order_before);
    if (cutoff) {
      const cutoffDate = new Date(orderedAt);
      cutoffDate.setHours(cutoff.h, cutoff.m, 0, 0);
      if (orderedAt > cutoffDate) {
        basis.setDate(basis.getDate() + 1);
        basis.setHours(0, 0, 0, 0);
      }
    }

    let shipDate;
    if (rule.ship_within_business_days != null) {
      shipDate = addBusinessDays(basis, rule.ship_within_business_days, {
        excludeWeekends: rule.exclude_weekends !== false,
      });
    } else if (rule.ship_within_calendar_days != null) {
      shipDate = new Date(basis);
      shipDate.setDate(shipDate.getDate() + rule.ship_within_calendar_days);
    } else {
      continue;
    }

    return {
      ruleId: r.id,
      ruleName: r.name,
      shipDate: shipDate.toISOString(),
      message: `「${r.name}」ルールに基づき、${shipDate.getFullYear()}年${shipDate.getMonth() + 1}月${shipDate.getDate()}日 発送予定`,
    };
  }

  return null;
}
