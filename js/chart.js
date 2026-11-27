// Eenvoudige lijngrafiek in SVG (één reeks, tijd op de x-as), zonder externe libraries.
// Tik of beweeg over de grafiek voor de waarde per datum.
import { h, fmtDate } from './ui.js';
import { fmt } from './calc.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 340;
const H = 160;
const PAD = { top: 12, right: 12, bottom: 22, left: 36 };

function s(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function niceTicks(min, max, count = 4) {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) || raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

const toMs = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/**
 * points: [{ date: 'YYYY-MM-DD', value: number, detail?: string }], oplopend op datum.
 * opts.unit: eenheid achter de waarde in de tooltip.
 */
export function lineChart(points, { unit = '', label = '' } = {}) {
  const wrap = h('div', { class: 'chart', role: 'img', 'aria-label': label });
  if (!points.length) return wrap;

  const xs = points.map((p) => toMs(p.date));
  const ys = points.map((p) => p.value);
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  if (x0 === x1) {
    x0 -= 3 * 864e5;
    x1 += 3 * 864e5;
  }
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1] === y0 ? y0 + 1 : ticks[ticks.length - 1];

  const px = (ms) => PAD.left + ((ms - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const py = (v) => H - PAD.bottom - ((v - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg' });

  // Rasterlijnen en y-labels (ingetogen)
  for (const t of ticks) {
    svg.append(s('line', { x1: PAD.left, x2: W - PAD.right, y1: py(t), y2: py(t), class: 'grid' }));
    const tx = s('text', { x: PAD.left - 6, y: py(t) + 3.5, class: 'axis', 'text-anchor': 'end' });
    tx.textContent = fmt(t);
    svg.append(tx);
  }
  // x-labels: eerste en laatste datum
  const dates = [...new Set([points[0].date, points[points.length - 1].date])];
  dates.forEach((d, i) => {
    const tx = s('text', {
      x: dates.length === 1 ? px(toMs(d)) : i === 0 ? PAD.left : W - PAD.right,
      y: H - 6,
      class: 'axis',
      'text-anchor': dates.length === 1 ? 'middle' : i === 0 ? 'start' : 'end',
    });
    tx.textContent = fmtDate(d, { day: 'numeric', month: 'short' });
    svg.append(tx);
  });

  // Lijn en punten
  if (points.length > 1) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(xs[i]).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ');
    svg.append(s('path', { d, class: 'line' }));
  }
  const dots = points.map((p, i) => {
    const c = s('circle', { cx: px(xs[i]), cy: py(p.value), r: 4, class: 'dot' });
    svg.append(c);
    return c;
  });

  // Hover/tik: dichtstbijzijnde punt met hulplijn en tooltip
  const cross = s('line', { y1: PAD.top, y2: H - PAD.bottom, class: 'cross', visibility: 'hidden' });
  svg.append(cross);
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const hit = s('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });
  svg.append(hit);

  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    xs.forEach((v, i) => {
      if (Math.abs(px(v) - x) < Math.abs(px(xs[best]) - x)) best = i;
    });
    const p = points[best];
    const cx = px(xs[best]);
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.setAttribute('visibility', 'visible');
    dots.forEach((d, i) => d.classList.toggle('active', i === best));
    tip.replaceChildren(
      h('div', { class: 'strong' }, `${fmt(p.value)} ${unit}`.trim()),
      h('div', { class: 'muted' }, fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })),
      p.detail ? h('div', { class: 'muted' }, p.detail) : null,
    );
    tip.hidden = false;
    const left = (cx / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 60), r.width - 60)}px`;
  };
  const hide = () => {
    cross.setAttribute('visibility', 'hidden');
    dots.forEach((d) => d.classList.remove('active'));
    tip.hidden = true;
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);

  wrap.append(svg, tip);
  return wrap;
}
