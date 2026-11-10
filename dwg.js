// DWG：用 libredwg-web (WASM) 解析；DXF：用自己的解析器（dxf.js），失敗才退回 libredwg
import { parseDxf } from './dxf.js';

let libP = null;
export function getLib(wasmDir) {
  if (!libP) libP = import('./lib/index.js').then(m => m.LibreDwg.create(wasmDir || new URL('./wasm', import.meta.url).href).then(lib => ({ lib, T: m.Dwg_File_Type })));
  return libP;
}

export async function readCad(buf, kind, wasmDir) {
  if (kind === 'dxf') {
    let r = null;
    try { r = convertDb(parseDxf(buf)); } catch (err) { console.warn('DXF 解析失敗，改用 libredwg', err); }
    if (r && r.ents.length) return r;
  }
  const { lib, T } = await getLib(wasmDir);
  const ptr = lib.dwg_read_data(buf, kind === 'dxf' ? T.DXF : T.DWG);
  if (!ptr) throw new Error('無法解析這個檔案');
  let db;
  try { db = lib.convert(ptr); } finally { try { lib.dwg_free(ptr); } catch (_) {} }
  return convertDb(db);
}

/* ---------- 顏色 ---------- */
function hsv(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  const to = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + to(f(5)) + to(f(3)) + to(f(1));
}
const ACI_BASE = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#ffffff', 8: '#808080', 9: '#c0c0c0',
  250: '#333333', 251: '#505050', 252: '#696969', 253: '#828282', 254: '#bebebe', 255: '#ffffff' };
export function aci(i) {
  i = Math.abs(i | 0);
  if (ACI_BASE[i]) return ACI_BASE[i];
  if (i >= 10 && i <= 249) {
    const h = Math.floor((i - 10) / 10) * 15, k = (i - 10) % 10;
    const v = [1, 1, .8, .8, .6, .6, .5, .5, .3, .3][k];
    return hsv(h, k % 2 ? .5 : 1, v);
  }
  return '#ffffff';
}

/* ---------- 矩陣 [a,b,c,d,e,f]: x'=a x + c y + e, y'=b x + d y + f ---------- */
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const det = m => m[0] * m[3] - m[1] * m[2];
const uniform = m => Math.abs(Math.hypot(m[0], m[1]) - Math.hypot(m[2], m[3])) < 1e-9 * Math.max(1, Math.hypot(m[0], m[1])) && Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-9 * Math.max(1, m[0] * m[0] + m[1] * m[1]);
const mscale = m => Math.sqrt(Math.abs(det(m)));
const mrot = m => Math.atan2(m[1], m[0]);
const ocs = (e, m) => (e.extrusionDirection && e.extrusionDirection.z < -0.5) ? mul(m, [-1, 0, 0, 1, 0, 0]) : m;
const P = p => [p.x || 0, p.y || 0];

/* ---------- 曲線取樣 ---------- */
function bulgePts(p1, p2, b, out) {
  const th = 4 * Math.atan(b), dx = p2[0] - p1[0], dy = p2[1] - p1[1], c = Math.hypot(dx, dy);
  if (!c) return;
  const r = c / (2 * Math.sin(th / 2)), h = r * Math.cos(th / 2);
  const cx = (p1[0] + p2[0]) / 2 - dy / c * h, cy = (p1[1] + p2[1]) / 2 + dx / c * h;
  const a0 = Math.atan2(p1[1] - cy, p1[0] - cx), n = Math.max(4, Math.ceil(Math.abs(th) / (Math.PI / 36))), R = Math.abs(r);
  for (let i = 1; i < n; i++) { const a = a0 + th * i / n; out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
}
function arcPts(cx, cy, r, a0, a1, ccw = true) {
  let sweep = ccw ? a1 - a0 : a0 - a1;
  while (sweep <= 0) sweep += Math.PI * 2;
  while (sweep > Math.PI * 2 + 1e-9) sweep -= Math.PI * 2;
  const n = Math.max(8, Math.ceil(sweep / (Math.PI / 48))), pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (ccw ? 1 : -1) * sweep * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
function ellipsePts(c, maj, ratio, t0, t1, ccw = true) {
  const ux = maj[0], uy = maj[1], vx = -uy * ratio, vy = ux * ratio;
  let sweep = ccw ? t1 - t0 : t0 - t1;
  while (sweep <= 0) sweep += Math.PI * 2;
  while (sweep > Math.PI * 2 + 1e-9) sweep -= Math.PI * 2;
  const n = Math.max(16, Math.ceil(sweep / (Math.PI / 48))), pts = [];
  for (let i = 0; i <= n; i++) { const t = t0 + (ccw ? 1 : -1) * sweep * i / n, ct = Math.cos(t), st = Math.sin(t); pts.push([c[0] + ux * ct + vx * st, c[1] + uy * ct + vy * st]); }
  return pts;
}
function bspline(cps, knots, deg) {
  const n = cps.length;
  if (n < 2) return cps.map(P);
  if (!knots || knots.length !== n + deg + 1) { knots = []; for (let i = 0; i < n + deg + 1; i++) knots.push(i <= deg ? 0 : i >= n ? n - deg : i - deg); }
  const lo = knots[deg], hi = knots[n], steps = Math.max(16, (n - 1) * 10), out = [];
  for (let s = 0; s <= steps; s++) {
    const t = lo + (hi - lo) * s / steps;
    let k = deg; while (k < n - 1 && t >= knots[k + 1]) k++;
    const d = [];
    for (let j = 0; j <= deg; j++) { const c = cps[k - deg + j], w = c.weight || 1; d.push([c.x * w, c.y * w, w]); }
    for (let r = 1; r <= deg; r++) for (let j = deg; j >= r; j--) {
      const i = j + k - deg, den = knots[i + deg - r + 1] - knots[i], a = den ? (t - knots[i]) / den : 0;
      d[j] = [d[j - 1][0] * (1 - a) + d[j][0] * a, d[j - 1][1] * (1 - a) + d[j][1] * a, d[j - 1][2] * (1 - a) + d[j][2] * a];
    }
    out.push([d[deg][0] / d[deg][2], d[deg][1] / d[deg][2]]);
  }
  return out;
}
function catmull(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let s = 1; s <= 10; s++) {
      const t = s / 10, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  return out;
}

/* ---------- 文字 ---------- */
function cleanText(s) {
  return String(s || '').replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/%%[uUoOkK]/g, '').replace(/%%%/g, '%');
}
function cleanMText(s) {
  s = String(s || '');
  s = s.replace(/\\\\/g, '\u0001').replace(/\\\{/g, '\u0002').replace(/\\\}/g, '\u0003');
  s = s.replace(/\\S([^;]*);/g, (m, a) => a.replace(/[\^#]/, '/'));
  s = s.replace(/\\[ACFfHQTWpc][^;]*;/g, '');
  s = s.replace(/\\[LlOoKkNn]/g, '').replace(/\\~/g, ' ').replace(/\\P/g, '\n').replace(/[{}]/g, '');
  s = s.replace(/\u0001/g, '\\').replace(/\u0002/g, '{').replace(/\u0003/g, '}');
  return cleanText(s).split('\n');
}

/* ---------- 主轉換 ---------- */
export function convertDb(db) {
  const out = [], skipped = {}, layers = new Map(), lts = [];
  for (const L of (db.tables.LAYER && db.tables.LAYER.entries) || []) {
    layers.set(L.name, { name: L.name, c: aci(L.colorIndex == null ? 7 : L.colorIndex), lt: (L.lineType || 'CONTINUOUS').toUpperCase(),
      off: !!(L.off || L.colorIndex < 0), frozen: !!L.frozen, hidden: !!(L.off || L.frozen || L.colorIndex < 0), n: 0 });
  }
  const styles = new Map();
  for (const S of (db.tables.STYLE && db.tables.STYLE.entries) || []) if (S.handle != null) styles.set(String(S.handle).toUpperCase(), String(S.font || '').replace(/^.*[\\/]/, ''));
  for (const T of (db.tables.LTYPE && db.tables.LTYPE.entries) || []) {
    const els = [];
    for (const p of T.pattern || []) {
      els.push({ k: 'len', v: p.elementLength || 0 });
      if ((p.elementTypeFlag & 2) && p.text) els.push({ k: 'text', str: p.text, s: p.scale || 1, r: (p.rotation || 0) * 180 / Math.PI, abs: !!(p.elementTypeFlag & 1), up: false, x: p.offsetX || 0, y: p.offsetY || 0 });
      else if (p.elementTypeFlag & 4) els.push({ k: 'shape', num: p.shapeNumber, file: styles.get(String(p.styleObjectId || '').toUpperCase()) || '', s: p.scale || 1, r: (p.rotation || 0) * 180 / Math.PI, abs: !!(p.elementTypeFlag & 1), up: false, x: p.offsetX || 0, y: p.offsetY || 0 });
    }
    if (els.some(e => e.k === 'len' && e.v)) lts.push({ name: T.name.toUpperCase(), desc: T.description || '', els });
  }
  const styleMap = new Map();
  for (const S of (db.tables.STYLE && db.tables.STYLE.entries) || []) if (S.name != null) styleMap.set(String(S.name).toUpperCase(), { font: String(S.font || '').trim(), big: String(S.bigFont || '').trim(), vert: !!((S.standardFlag || S.flag || 0) & 4) });
  const sty = n => styleMap.get(String(n || 'STANDARD').toUpperCase()) || {};
  const blocks = new Map();
  for (const b of (db.tables.BLOCK_RECORD && db.tables.BLOCK_RECORD.entries) || []) blocks.set(b.name, b);
  const ms = [...blocks.values()].find(b => /^\*model_space$/i.test(b.name));
  let top = db.entities || [];
  if (ms) { const t2 = top.filter(e => e.ownerBlockRecordSoftId === ms.handle); if (t2.length) top = t2; }
  top = top.filter(e => e.type !== 'ATTRIB');

  function props(e, inh) {
    const lname = (e.layer === '0' && inh) ? inh.ly : (e.layer || '0');
    let L = layers.get(lname);
    if (!L) { L = { name: lname, c: '#ffffff', lt: 'CONTINUOUS', off: false, frozen: false, hidden: false, n: 0 }; layers.set(lname, L); }
    const ci = e.colorIndex;
    let c;
    if (ci == null || ci === 256) c = (e.layer === '0' && inh) ? inh.c : L.c;
    else if (ci === 0) c = inh ? inh.c : '#ffffff';
    else c = aci(ci);
    let lt = (e.lineType || '').toUpperCase();
    if (!lt || lt === 'BYLAYER') lt = (e.layer === '0' && inh) ? inh.lt : L.lt;
    else if (lt === 'BYBLOCK') lt = inh ? inh.lt : 'CONTINUOUS';
    return { c, lt, ly: lname, lts: (e.lineTypeScale || 1) * (inh ? inh.lts : 1) };
  }
  let grp = 0;// 目前所屬圖塊（最上層 INSERT）編號，複製時整個圖塊一起選
  function push(o, pr) {
    Object.assign(o, pr); o.imp = 1; if (grp) o.g = grp;
    const L = layers.get(pr.ly); if (L) L.n++;
    out.push(o);
  }
  function pline(pts, closed, pr, kv) {
    if (pts.length < 2) return;
    push({ t: 'pline', pts, closed: !!closed, kv: kv || null }, pr);
  }

  function conv(e, M, inh, depth) {
    if (e.isVisible === false) return;
    const pr = props(e, inh);
    switch (e.type) {
      case 'LINE': push({ t: 'line', a: ap(M, ...P(e.startPoint)), b: ap(M, ...P(e.endPoint)) }, pr); break;
      case 'POINT': push({ t: 'point', p: ap(M, ...P(e.position)) }, pr); break;
      case 'CIRCLE': {
        const m = ocs(e, M), c = P(e.center);
        if (uniform(m)) push({ t: 'circle', o: ap(m, ...c), r: e.radius * mscale(m) }, pr);
        else pline(arcPts(c[0], c[1], e.radius, 0, Math.PI * 2).map(p => ap(m, ...p)), true, pr, []);
        break;
      }
      case 'ARC': {
        const m = ocs(e, M), c = P(e.center), r = e.radius;
        if (uniform(m)) {
          const o = ap(m, ...c), ang = a => { const q = ap(m, c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)); return Math.atan2(q[1] - o[1], q[0] - o[0]); };
          let a0 = ang(e.startAngle), a1 = ang(e.endAngle);
          if (det(m) < 0) [a0, a1] = [a1, a0];
          push({ t: 'arc', o, r: r * mscale(m), a0, a1 }, pr);
        } else pline(arcPts(c[0], c[1], r, e.startAngle, e.endAngle).map(p => ap(m, ...p)), false, pr, []);
        break;
      }
      case 'ELLIPSE': {
        const pts = ellipsePts(P(e.center), P(e.majorAxisEndPoint), e.axisRatio || 1, e.startAngle || 0, e.endAngle || Math.PI * 2);
        pline(pts.map(p => ap(M, ...p)), Math.abs((e.endAngle - e.startAngle) - Math.PI * 2) < 1e-6, pr, []);
        break;
      }
      case 'LWPOLYLINE': case 'POLYLINE2D': case 'POLYLINE3D': {
        const m = e.type === 'POLYLINE3D' ? M : ocs(e, M);
        const vs = (e.vertices || []).filter(v => !(v.flag & 16));
        // DXF 的 LWPOLYLINE 閉合是 bit 1；DWG（libredwg）裡是 bit 512，bit 1 另有用途
        const closed = e.type === 'LWPOLYLINE' && !e.dxfFlag ? (e.flag & 512) !== 0 : (e.flag & 1) === 1;
        const raw = [], kv = [];
        for (let i = 0; i < vs.length; i++) {
          const p = P(vs[i]); kv.push(raw.length); raw.push(p);
          const nx = i + 1 < vs.length ? vs[i + 1] : (closed ? vs[0] : null);
          if (nx && vs[i].bulge) bulgePts(p, P(nx), vs[i].bulge, raw);
        }
        if (closed && vs.length > 1 && vs[vs.length - 1].bulge) { /* 收尾弧已加入 */ }
        pline(raw.map(p => ap(m, ...p)), closed, pr, kv);
        break;
      }
      case 'SPLINE': {
        let pts;
        if (e.controlPoints && e.controlPoints.length >= 2) pts = bspline(e.controlPoints, e.knots, e.degree || 3);
        else if (e.fitPoints && e.fitPoints.length >= 2) pts = catmull(e.fitPoints.map(P));
        if (pts) pline(pts.map(p => ap(M, ...p)), (e.flag & 1) === 1, pr, []);
        break;
      }
      case 'LEADER': if (e.vertices) pline(e.vertices.map(v => ap(M, ...P(v))), false, pr); break;
      case 'SOLID': case 'TRACE': case '3DFACE': {
        const m = e.type === '3DFACE' ? M : ocs(e, M);
        const c = [e.corner1, e.corner2, e.corner3, e.corner4].filter(Boolean).map(p => ap(m, ...P(p)));
        if (e.type === '3DFACE') pline(c, true, pr);
        else if (c.length >= 3) push({ t: 'fill', rings: [c.length === 4 ? [c[0], c[1], c[3], c[2]] : c] }, pr);
        break;
      }
      case 'HATCH': {
        if (!e.solidFill) { skipped['HATCH（圖案填充）'] = (skipped['HATCH（圖案填充）'] || 0) + 1; break; }
        const m = ocs(e, M), rings = [];
        for (const path of e.boundaryPaths || []) {
          const ring = [];
          if (path.vertices) {
            const vs = path.vertices;
            for (let i = 0; i < vs.length; i++) { const p = P(vs[i]); ring.push(p); if (vs[i].bulge) bulgePts(p, P(vs[(i + 1) % vs.length]), vs[i].bulge, ring); }
          } else for (const ed of path.edges || []) {
            if (ed.type === 1) { ring.push(P(ed.start), P(ed.end)); }
            else if (ed.type === 2) { const ccw = ed.isCCW !== false; ring.push(...arcPts(ed.center.x, ed.center.y, ed.radius, ccw ? ed.startAngle : -ed.startAngle, ccw ? ed.endAngle : -ed.endAngle, ccw)); }
            else if (ed.type === 3) { const ccw = ed.isCCW !== false; ring.push(...ellipsePts(P(ed.center), P(ed.end), ed.lengthOfMinorAxis || 1, ccw ? ed.startAngle : -ed.startAngle, ccw ? ed.endAngle : -ed.endAngle, ccw)); }
            else if (ed.type === 4 && ed.controlPoints) ring.push(...bspline(ed.controlPoints, ed.knots, ed.degree || 3));
          }
          if (ring.length >= 3) rings.push(ring.map(p => ap(m, ...p)));
        }
        if (rings.length) push({ t: 'fill', rings }, pr);
        break;
      }
      case 'TEXT': case 'ATTRIB': case 'ATTDEF': {
        if (e.type === 'ATTDEF') break;
        const T = (e.text && typeof e.text === 'object') ? e.text : e;
        const str = cleanText(T.text);
        if (!str.trim() || !T.textHeight) break;
        const m = ocs(T.extrusionDirection ? T : e, M);
        let ha = T.halign || 0; const va = T.valign || 0;
        const useEnd = !(ha === 0 && va === 0) && ha !== 3 && ha !== 5;
        if (ha === 3 || ha === 5) ha = 0;
        const base = useEnd ? P(T.endPoint) : P(T.startPoint);
        const h = T.textHeight * mscale(m);
        const y0 = ha === 4 ? h / 2 : [0, -0.2 * h, h / 2, h][va] || 0;
        push({ t: 'text', font: sty(T.styleName).font, big: sty(T.styleName).big, vert: sty(T.styleName).vert, p: ap(m, ...base), h, rot: (T.rotation || 0) + mrot(m) * Math.sign(det(m) || 1), lines: [str], ha: ha === 4 ? 1 : Math.min(ha, 2), y0, ls: h * 1.667, wf: T.xScale || 1 }, pr);
        break;
      }
      case 'MTEXT': {
        const lines = cleanMText(e.text).filter((l, i, a) => l.trim() || i < a.length - 1);
        if (!lines.length || !e.textHeight) break;
        const m = M, h = e.textHeight * mscale(m), ls = h * 1.667 * (e.lineSpacing || 1), ap1 = e.attachmentPoint || 1;
        const col = (ap1 - 1) % 3, row = Math.floor((ap1 - 1) / 3), Hb = h + (lines.length - 1) * ls;
        const y0 = row === 0 ? h : row === 1 ? h - Hb / 2 : h - Hb;
        const dir = e.direction && (e.direction.x || e.direction.y) ? Math.atan2(e.direction.y, e.direction.x) : (e.rotation || 0);
        push({ t: 'text', font: sty(e.styleName).font, big: sty(e.styleName).big, vert: sty(e.styleName).vert, p: ap(m, ...P(e.insertionPoint)), h, rot: dir + mrot(m), lines, ha: col, y0, ls, wf: 1 }, pr);
        break;
      }
      case 'INSERT': case 'DIMENSION': {
        if (depth > 12) break;
        const b = blocks.get(e.name);
        if (b && b.entities) {
          let base;
          if (e.type === 'DIMENSION') base = [M];
          else {
            const m0 = ocs(e, M), ip = P(e.insertionPoint), bp = P(b.basePoint || {}), rot = e.rotation || 0;
            const cs = Math.cos(rot), sn = Math.sin(rot), sx = e.xScale || 1, sy = e.yScale || 1;
            const loc = mul([cs * sx, sn * sx, -sn * sy, cs * sy, ip[0], ip[1]], [1, 0, 0, 1, -bp[0], -bp[1]]);
            base = [];
            const nc = Math.max(1, e.columnCount || 1), nr = Math.max(1, e.rowCount || 1);
            for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
              const off = ap([cs, sn, -sn, cs, 0, 0], c * (e.columnSpacing || 0), r * (e.rowSpacing || 0));
              base.push(mul(m0, [loc[0], loc[1], loc[2], loc[3], loc[4] + off[0], loc[5] + off[1]]));
            }
          }
          const inh2 = { c: pr.c, lt: pr.lt, ly: pr.ly, lts: pr.lts };
          for (const m of base) for (const be of b.entities) conv(be, m, inh2, depth + 1);
        } else if (e.type === 'DIMENSION') skipped['DIMENSION'] = (skipped['DIMENSION'] || 0) + 1;
        if (e.attribs) for (const a of e.attribs) conv({ ...a, type: 'ATTRIB' }, M, inh, depth + 1);
        break;
      }
      case 'VIEWPORT': case 'XLINE': case 'RAY': break;
      default: skipped[e.type] = (skipped[e.type] || 0) + 1;
    }
  }
  let gid = 0;
  for (const e of top) { grp = e.type === 'INSERT' ? ++gid : 0; try { conv(e, I, null, 0); } catch (err) { skipped['錯誤'] = (skipped['錯誤'] || 0) + 1; } }
  const H = db.header || {};
  return { ents: out, layers: [...layers.values()].filter(l => l.n > 0), lts, ltscale: H.LTSCALE || 1, skipped };
}
