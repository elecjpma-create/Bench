// 自己的 ASCII DXF 解析器：輸出跟 libredwg-web convert() 相同形狀的資料，交給 convertDb() 轉換
const D2R = Math.PI / 180;

export function decodeDxf(buf) {
  const bytes = new Uint8Array(buf);
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 200000)));
  const cp = (head.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*(\S+)/) || [])[1] || '';
  const ver = (head.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/) || [])[1] || '';
  const map = { ANSI_950: 'big5', ANSI_936: 'gbk', ANSI_932: 'shift_jis', ANSI_949: 'euc-kr', ANSI_1252: 'windows-1252' };
  let txt;
  if (ver >= 'AC1021') txt = new TextDecoder('utf-8').decode(bytes);
  else {
    try { txt = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (_) { txt = new TextDecoder(map[cp.toUpperCase()] || 'big5').decode(bytes); }
  }
  return txt.replace(/^﻿/, '').replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
}

function pairsOf(txt) {
  const L = txt.split(/\r?\n/), out = [];
  for (let i = 0; i + 1 < L.length; i += 2) {
    const c = parseInt(L[i].trim(), 10);
    if (isNaN(c)) { i -= 1; continue; }
    out.push([c, L[i + 1]]);
  }
  return out;
}

const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

function entityFrom(type, g) {
  // g: 該物件的 [code,value] 陣列
  const e = { type, layer: '0', lineType: '', colorIndex: 256, lineTypeScale: 1 };
  const f = (c, d) => { for (const [k, v] of g) if (k === c) return v; return d; };
  const fn = (c, d = 0) => { const v = f(c); return v === undefined ? d : num(v); };
  const pt = (cx) => ({ x: fn(cx), y: fn(cx + 10), z: fn(cx + 20) });
  e.layer = (f(8, '0') || '0').trim();
  e.lineType = (f(6, '') || '').trim();
  e.colorIndex = f(62) !== undefined ? fn(62) : 256;
  e.lineTypeScale = fn(48, 1) || 1;
  if (fn(60) === 1) e.isVisible = false;
  if (fn(67) === 1) e.paper = true;
  if (f(230) !== undefined) e.extrusionDirection = { x: fn(210), y: fn(220), z: fn(230, 1) };
  switch (type) {
    case 'LINE': e.startPoint = pt(10); e.endPoint = pt(11); break;
    case 'POINT': e.position = pt(10); break;
    case 'CIRCLE': e.center = pt(10); e.radius = fn(40); break;
    case 'ARC': e.center = pt(10); e.radius = fn(40); e.startAngle = fn(50) * D2R; e.endAngle = fn(51) * D2R; break;
    case 'ELLIPSE': e.center = pt(10); e.majorAxisEndPoint = pt(11); e.axisRatio = fn(40, 1); e.startAngle = fn(41, 0); e.endAngle = fn(42, Math.PI * 2); break;
    case 'LWPOLYLINE': {
      e.flag = fn(70); e.dxfFlag = true; e.vertices = []; let v = null;
      for (const [k, val] of g) {
        if (k === 10) { v = { x: num(val), y: 0, bulge: 0 }; e.vertices.push(v); }
        else if (v && k === 20) v.y = num(val);
        else if (v && k === 42) v.bulge = num(val);
      }
      break;
    }
    case 'SPLINE': {
      e.flag = fn(70); e.degree = fn(71, 3); e.knots = []; e.controlPoints = []; e.fitPoints = []; const w = [];
      let cp = null, fp = null;
      for (const [k, val] of g) {
        if (k === 40) e.knots.push(num(val));
        else if (k === 41) w.push(num(val));
        else if (k === 10) { cp = { x: num(val), y: 0 }; e.controlPoints.push(cp); }
        else if (k === 20 && cp) cp.y = num(val);
        else if (k === 11) { fp = { x: num(val), y: 0 }; e.fitPoints.push(fp); }
        else if (k === 21 && fp) fp.y = num(val);
      }
      w.forEach((x, i) => { if (e.controlPoints[i]) e.controlPoints[i].weight = x; });
      break;
    }
    case 'TEXT': case 'ATTRIB': case 'ATTDEF':
      e.styleName = (f(7, '') || '').trim(); e.text = f(1, ''); e.startPoint = pt(10); e.endPoint = pt(11); e.textHeight = fn(40);
      e.rotation = fn(50) * D2R; e.xScale = fn(41, 1) || 1; e.halign = fn(72);
      e.valign = type === 'TEXT' ? fn(73) : fn(74);
      if (type !== 'TEXT' && (fn(70) & 1)) e.isVisible = false;
      break;
    case 'MTEXT': {
      let s = ''; for (const [k, v] of g) if (k === 3) s += v; s += f(1, '');
      e.styleName = (f(7, '') || '').trim(); e.text = s; e.insertionPoint = pt(10); e.textHeight = fn(40); e.attachmentPoint = fn(71, 1) || 1;
      e.rotation = fn(50) * D2R; e.lineSpacing = fn(44, 1) || 1;
      if (f(11) !== undefined) e.direction = { x: fn(11), y: fn(21) };
      break;
    }
    case 'INSERT':
      e.name = (f(2, '') || '').trim(); e.insertionPoint = pt(10); e.xScale = fn(41, 1); e.yScale = fn(42, 1);
      e.rotation = fn(50) * D2R; e.columnCount = fn(70, 1); e.rowCount = fn(71, 1); e.columnSpacing = fn(44); e.rowSpacing = fn(45);
      break;
    case 'DIMENSION': e.name = (f(2, '') || '').trim(); break;
    case 'SOLID': case 'TRACE': case '3DFACE':
      e.corner1 = pt(10); e.corner2 = pt(11); e.corner3 = pt(12); e.corner4 = pt(13); break;
    case 'LEADER': {
      e.vertices = []; let v = null;
      for (const [k, val] of g) { if (k === 10) { v = { x: num(val), y: 0 }; e.vertices.push(v); } else if (k === 20 && v) v.y = num(val); }
      break;
    }
    case 'HATCH': parseHatch(e, g); break;
  }
  return e;
}

function parseHatch(e, g) {
  let i = 0;
  const at = c => { while (i < g.length && g[i][0] !== c) i++; return i < g.length ? num(g[i++][1]) : 0; };
  e.solidFill = 0; e.boundaryPaths = [];
  for (const [k, v] of g) if (k === 70) { e.solidFill = num(v); break; }
  const np = at(91);
  for (let p = 0; p < np && i < g.length; p++) {
    const flag = at(92), path = {};
    if (flag & 2) {
      const hasBulge = at(72), closed = at(73), nv = at(93); path.vertices = [];
      for (let k = 0; k < nv; k++) { const x = at(10), y = at(20), b = hasBulge ? at(42) : 0; path.vertices.push({ x, y, bulge: b }); }
      void closed;
    } else {
      const ne = at(93); path.edges = [];
      for (let k = 0; k < ne; k++) {
        const t = at(72);
        if (t === 1) path.edges.push({ type: 1, start: { x: at(10), y: at(20) }, end: { x: at(11), y: at(21) } });
        else if (t === 2) path.edges.push({ type: 2, center: { x: at(10), y: at(20) }, radius: at(40), startAngle: at(50) * D2R, endAngle: at(51) * D2R, isCCW: at(73) !== 0 });
        else if (t === 3) path.edges.push({ type: 3, center: { x: at(10), y: at(20) }, end: { x: at(11), y: at(21) }, lengthOfMinorAxis: at(40), startAngle: at(50) * D2R, endAngle: at(51) * D2R, isCCW: at(73) !== 0 });
        else if (t === 4) {
          const deg = at(94); at(73); at(74); const nk = at(95), nc = at(96); const knots = [], cps = [];
          for (let j = 0; j < nk; j++) knots.push(at(40));
          for (let j = 0; j < nc; j++) cps.push({ x: at(10), y: at(20) });
          path.edges.push({ type: 4, degree: deg, knots, controlPoints: cps });
        } else break;
      }
    }
    e.boundaryPaths.push(path);
  }
}

export function parseDxf(buf) {
  const P = pairsOf(decodeDxf(buf));
  const db = { header: {}, tables: { LAYER: { entries: [] }, LTYPE: { entries: [] }, BLOCK_RECORD: { entries: [] } }, entities: [] };
  let i = 0, section = '';
  // 把一串 pairs 切成物件：每個 code 0 開頭
  function readObjects(stopAt) {
    const objs = [];
    while (i < P.length) {
      const [c, v] = P[i];
      if (c === 0) {
        const t = v.trim();
        if (stopAt.includes(t)) return objs;
        const g = []; i++;
        while (i < P.length && P[i][0] !== 0) g.push(P[i++]);
        objs.push([t, g]);
      } else i++;
    }
    return objs;
  }
  function buildEntities(objs) {
    const out = []; let poly = null, ins = null;
    for (const [t, g] of objs) {
      if (t === 'VERTEX') {
        if (poly) { const v = entityFrom('POINT', g); const ff = g.find(x => x[0] === 70), bb = g.find(x => x[0] === 42);
          poly.vertices.push({ x: v.position.x, y: v.position.y, bulge: bb ? num(bb[1]) : 0, flag: ff ? num(ff[1]) : 0 }); }
        continue;
      }
      if (t === 'ATTRIB') { if (ins) ins.attribs.push(entityFrom('ATTRIB', g)); continue; }
      if (t === 'SEQEND') { poly = null; ins = null; continue; }
      if (t === 'POLYLINE') {
        const e = entityFrom('POLYLINE2D', g); const fl = g.find(x => x[0] === 70); e.flag = fl ? num(fl[1]) : 0;
        if (e.flag & (16 | 64)) { poly = { vertices: [] }; continue; } // 網格/多面網格略過
        if (e.flag & 8) e.type = 'POLYLINE3D';
        e.vertices = []; poly = e; out.push(e); continue;
      }
      const e = entityFrom(t, g);
      if (t === 'INSERT') { e.attribs = []; const af = g.find(x => x[0] === 66); ins = af && num(af[1]) ? e : null; }
      out.push(e);
    }
    return out;
  }
  while (i < P.length) {
    const [c, v] = P[i];
    if (c === 0 && v.trim() === 'SECTION') { i++; section = (P[i] && P[i][1] || '').trim(); i++; continue; }
    if (c === 0 && v.trim() === 'ENDSEC') { section = ''; i++; continue; }
    if (c === 0 && v.trim() === 'EOF') break;
    if (section === 'HEADER') {
      if (c === 9 && v.trim() === '$LTSCALE') { db.header.LTSCALE = num(P[i + 1][1]); i += 2; continue; }
      i++; continue;
    }
    if (section === 'TABLES') {
      const objs = readObjects(['ENDSEC']);
      for (const [t, g] of objs) {
        const f = c2 => { const x = g.find(p => p[0] === c2); return x ? x[1] : undefined; };
        if (t === 'LAYER') {
          const ci = num(f(62) ?? 7);
          db.tables.LAYER.entries.push({ name: (f(2) || '0').trim(), colorIndex: ci, lineType: (f(6) || 'CONTINUOUS').trim(), off: ci < 0, frozen: !!(num(f(70) || 0) & 1) });
        } else if (t === 'STYLE') {
          db.tables.STYLE = db.tables.STYLE || { entries: [] };
          db.tables.STYLE.entries.push({ handle: (f(5) || '').trim(), name: (f(2) || '').trim(), font: (f(3) || '').trim(), bigFont: (f(4) || '').trim(), standardFlag: num(f(70) || 0) });
        } else if (t === 'LTYPE') {
          const pat = []; let cur = null;
          for (const [k, val] of g) {
            if (k === 49) { cur = { elementLength: num(val), elementTypeFlag: 0 }; pat.push(cur); }
            else if (cur && k === 74) cur.elementTypeFlag = num(val);
            else if (cur && k === 9) cur.text = val;
            else if (cur && k === 75) cur.shapeNumber = num(val);
            else if (cur && k === 340) cur.styleObjectId = val.trim();
            else if (cur && k === 46) cur.scale = num(val);
            else if (cur && k === 50) cur.rotation = num(val) * D2R;
            else if (cur && k === 44) cur.offsetX = num(val);
            else if (cur && k === 45) cur.offsetY = num(val);
          }
          db.tables.LTYPE.entries.push({ name: (f(2) || '').trim(), description: f(3) || '', pattern: pat });
        }
      }
      continue;
    }
    if (section === 'BLOCKS') {
      const objs = readObjects(['ENDSEC']);
      let cur = null, buf2 = [];
      for (const o of objs) {
        if (o[0] === 'BLOCK') { const g = o[1], f = c2 => { const x = g.find(p => p[0] === c2); return x ? x[1] : undefined; };
          cur = { name: (f(2) || '').trim(), basePoint: { x: num(f(10) || 0), y: num(f(20) || 0) }, entities: [] }; buf2 = []; }
        else if (o[0] === 'ENDBLK') { if (cur) { cur.entities = buildEntities(buf2); db.tables.BLOCK_RECORD.entries.push(cur); } cur = null; }
        else if (cur) buf2.push(o);
      }
      continue;
    }
    if (section === 'ENTITIES') {
      db.entities = buildEntities(readObjects(['ENDSEC'])).filter(e => !e.paper);
      continue;
    }
    i++;
  }
  return db;
}
