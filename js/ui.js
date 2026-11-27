// Kleine DOM- en opmaakhelpers, gedeeld door alle schermen.
import { fmt } from './calc.js';


export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', opts);
}

export function setLabel(s, ex) {
  if (ex?.metric === 'time') return `${fmt(s.reps)} s${s.weight ? ` @ ${fmt(s.weight)} kg` : ''}`;
  return s.weight ? `${fmt(s.reps)} × ${fmt(s.weight)} kg` : `${fmt(s.reps)} reps`;
}

export function sortSessions(list) {
  return list.sort((a, b) => (b.date + b.startedAt).localeCompare(a.date + a.startedAt));
}

export function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2500);
}

/** Vervang de inhoud van een element; null/false worden overgeslagen (replaceChildren zou er "null" van maken). */
export function fill(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}
