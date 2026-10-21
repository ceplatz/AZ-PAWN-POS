// Minimal accessible bar chart (inline SVG, no library). Single series: thin bars anchored to the baseline with a 4px
// rounded data end, recessive grid, selective labels, hover/focus tooltip, and a "Show table" alternative.
const NS = 'http://www.w3.org/2000/svg', css = (v) => `var(${v})`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nice = (max) => { if (max <= 0) return 1; const p = 10 ** Math.floor(Math.log10(max)), f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

/** data: [{ label, value, sub? }]; opts: { fmt(value), title }. */
export function barChart(el, data, { fmt = (v) => String(v), title = 'Chart' } = {}) {
  const W = 720, H = 230, m = { l: 56, r: 10, t: 12, b: 28 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const top = nice(Math.max(...data.map((d) => d.value), 0)), step = pw / Math.max(data.length, 1), bw = Math.max(2, Math.min(22, step * 0.62));
  const y = (v) => m.t + ph - (v / top) * ph, every = Math.max(1, Math.ceil(data.length / 8));
  const grid = [0, 0.5, 1].map((f) => { const v = top * f; return `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${esc(fmt(v))}</text>`; }).join('');
  const bars = data.map((d, i) => {
    const x = m.l + step * i + (step - bw) / 2, h = Math.max(d.value > 0 ? 2 : 0, ph - (y(d.value) - m.t)), top0 = m.t + ph - h, r = Math.min(4, bw / 2, h);
    // rounded top, square bottom (anchored to the baseline)
    const path = h ? `M${x},${m.t + ph} V${top0 + r} Q${x},${top0} ${x + r},${top0} H${x + bw - r} Q${x + bw},${top0} ${x + bw},${top0 + r} V${m.t + ph} Z` : '';
    return `<g data-i="${i}" tabindex="0" role="img" aria-label="${esc(d.label)}: ${esc(fmt(d.value))}"><rect x="${m.l + step * i}" y="${m.t}" width="${step}" height="${ph + 0}" fill="transparent"/><path d="${path}" fill="var(--accent)"/></g>`
      + (i % every === 0 ? `<text x="${m.l + step * i + step / 2}" y="${H - 8}" text-anchor="middle" fill="var(--muted)" font-size="11">${esc(d.label)}</text>` : '');
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(title)}">${grid}<line x1="${m.l}" x2="${W - m.r}" y1="${m.t + ph}" y2="${m.t + ph}" stroke="var(--line-2)"/>${bars}</svg><div class="tip" hidden></div>
    <button class="ghost" type="button" style="margin-top:8px;padding:6px 10px;font-size:.8rem" data-tv>Show table</button><div data-tbl hidden style="margin-top:8px;max-height:260px;overflow:auto"></div>`;
  const tip = el.querySelector('.tip'), svg = el.querySelector('svg');
  const show = (g) => { const d = data[+g.dataset.i]; tip.innerHTML = `<b>${esc(fmt(d.value))}</b><br><span class="muted">${esc(d.label)}${d.sub ? ' · ' + esc(d.sub) : ''}</span>`; tip.hidden = false;
    const bb = g.getBoundingClientRect(), eb = el.getBoundingClientRect(); tip.style.left = `${bb.left - eb.left + bb.width / 2}px`; tip.style.top = `${Math.max(24, bb.top - eb.top + (bb.height * (1 - data[+g.dataset.i].value / top)))}px`; };
  svg.addEventListener('pointermove', (e) => { const g = e.target.closest('g[data-i]'); g ? show(g) : (tip.hidden = true); }); svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.addEventListener('focusin', (e) => { const g = e.target.closest('g[data-i]'); if (g) show(g); }); svg.addEventListener('focusout', () => { tip.hidden = true; });
  const tb = el.querySelector('[data-tbl]');
  tb.innerHTML = `<table><thead><tr><th>${esc(title)}</th><th class="n">Value</th></tr></thead><tbody>${data.map((d) => `<tr><td>${esc(d.label)}</td><td class="n">${esc(fmt(d.value))}</td></tr>`).join('')}</tbody></table>`;
  el.querySelector('[data-tv]').onclick = (e) => { tb.hidden = !tb.hidden; e.target.textContent = tb.hidden ? 'Show table' : 'Hide table'; };
}
