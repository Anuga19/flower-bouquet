// Price logic. All sums are done in cents.

import { FLOWERS, FEES, LIMITS } from './config.js';

const cents = (dollars) => Math.round(dollars * 100);
export const money = (c) => `$${(c / 100).toFixed(2)}`;

export function totalStems(counts) {
  return FLOWERS.reduce((sum, f) => sum + (counts[f.id] || 0), 0);
}

export function quote(counts) {
  const lines = [];
  let total = 0;
  for (const f of FLOWERS) {
    const qty = counts[f.id] || 0;
    if (!qty) continue;
    const amount = qty * cents(f.price);
    lines.push({ id: f.id, label: f.name, qty, unit: cents(f.price), amount });
    total += amount;
  }
  const stems = totalStems(counts);
  const fees = [{ id: 'wrap', label: 'Wrapper and ribbon', amount: cents(FEES.wrap) }];
  if (stems > LIMITS.standardWrapMax) fees.push({ id: 'largeWrap', label: 'Larger wrap', amount: cents(FEES.largeWrap) });
  for (const f of fees) total += f.amount;
  return {
    lines, fees, total, stems,
    atStandardLimit: stems === LIMITS.standardWrapMax,
    largeWrap: stems > LIMITS.standardWrapMax,
    atMax: stems >= LIMITS.maxStems,
  };
}
