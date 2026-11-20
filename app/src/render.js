// The cover renderer: panels, keylines, title block and print finishes, painted resolution-
// independently so the editor preview and every export size share one code path.
//
// A cover is: paper-coloured ground, graded photos laid into the layout's panels with white
// keylines between them, a legibility scrim, then the words — a script subtitle, the big
// condensed title with a gradient fill and a dark stroke, a letter-spaced tagline — and the
// small print a real poster carries: our own rating badge, a barcode strip, studio microtext.
// Finishes (grain, vignette, halftone) are seeded, so a given state always paints the same
// cover, in the editor, in exports and in screenshots alike.

import { gradeById, gradedCanvas } from './grades.js';
import { layoutById } from './layouts.js';

/** Small deterministic PRNG (mulberry32) so grain and barcodes never change between paints. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string, for seeding artwork details from the cover's own words. */
export function hashText(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const gradedCache = new Map();

function graded(photo, grade) {
  const key = `${photo.id}|${grade.id}`;
  let canvas = gradedCache.get(key);
  if (!canvas) {
    canvas = gradedCanvas(photo.img, grade);
    gradedCache.set(key, canvas);
  }
  return canvas;
}

export function clearGradeCache() {
  gradedCache.clear();
}

/**
 * Where a panel's photo lands: the cover-fit rect for `img` inside panel rect `p` (pixels),
 * scaled by `zoom` and shifted by `dx`/`dy` in -1..1 across the spare room. The editor uses
 * the same maths to turn pointer drags into dx/dy.
 */
export function computeDraw(p, img, zoom, dx, dy) {
  const s0 = Math.max(p.w / img.naturalWidth, p.h / img.naturalHeight);
  const s = s0 * zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const ox = p.x + (p.w - dw) / 2 + (dx * (dw - p.w)) / 2;
  const oy = p.y + (p.h - dh) / 2 + (dy * (dh - p.h)) / 2;
  return { dw, dh, ox, oy };
}

function panelRect(norm, W, H, gap) {
  return {
    x: norm.x * W + gap / 2,
    y: norm.y * H + gap / 2,
    w: norm.w * W - gap,
    h: norm.h * H - gap,
  };
}

/** Paints the whole cover described by `state` onto `ctx` at W x H. */
export function renderCover(ctx, W, H, state) {
  const grade = gradeById(state.grade);
  const layout = layoutById(state.layout);
  const gap = Math.max(3, Math.round(W * 0.007));

  // Paper ground — shows through the keyline gaps.
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(0, 0, W, H);

  // Panels.
  layout.panels.forEach((norm, i) => {
    const p = panelRect(norm, W, H, gap);
    const slot = state.panels[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, p.h);
    ctx.clip();
    ctx.fillStyle = '#241631';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    const photo = slot && state.photos[slot.photo];
    if (photo) {
      const src = graded(photo, grade);
      const d = computeDraw(p, photo.img, slot.zoom, slot.dx, slot.dy);
      ctx.drawImage(src, d.ox, d.oy, d.dw, d.dh);
    }
    ctx.restore();
    if (state.highlight === i) {
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = Math.max(3, W * 0.004);
      ctx.strokeRect(p.x + ctx.lineWidth / 2, p.y + ctx.lineWidth / 2, p.w - ctx.lineWidth, p.h - ctx.lineWidth);
    }
  });

  // Legibility scrims, top and bottom.
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.16);
  top.addColorStop(0, 'rgba(10, 3, 20, 0.42)');
  top.addColorStop(1, 'rgba(10, 3, 20, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.16);
  const bottom = ctx.createLinearGradient(0, H * 0.52, 0, H);
  bottom.addColorStop(0, 'rgba(10, 3, 20, 0)');
  bottom.addColorStop(0.62, 'rgba(10, 3, 20, 0.38)');
  bottom.addColorStop(1, 'rgba(10, 3, 20, 0.78)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * 0.52, W, H * 0.48);

  drawMicrotext(ctx, W, H);
  drawTitleBlock(ctx, W, H, state, grade);
  drawBadge(ctx, W, H);
  drawBarcode(ctx, W, H, state.title);

  if (state.fx.halftone) drawHalftone(ctx, W, H);
  if (state.fx.vignette > 0) drawVignette(ctx, W, H, state.fx.vignette);
  if (state.fx.grain > 0) drawGrain(ctx, W, H, state.fx.grain);
}

/** Studio line at the top corners, the way a poster carries its banner credits. */
function drawMicrotext(ctx, W, H) {
  const size = Math.max(10, W * 0.016);
  ctx.font = `${size}px Anton, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(size * 0.32)}px`; } catch { /* older engines */ }
  ctx.fillStyle = 'rgba(255, 250, 238, 0.92)';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.35;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('VICE PANEL STUDIO', W * 0.032, H * 0.024);
  ctx.textAlign = 'right';
  ctx.fillText('ORIGINAL COVER ART', W * 0.968, H * 0.024);
  try { ctx.letterSpacing = '0px'; } catch { /* older engines */ }
  ctx.shadowBlur = 0;
}

/** Subtitle, title and tagline, centred in the lower band. */
function drawTitleBlock(ctx, W, H, state, grade) {
  const title = (state.title || '').trim().toUpperCase();
  const cx = W / 2;

  // Fit the title: one line if it sits well, otherwise two balanced lines.
  let size = W * 0.155;
  const fit = (text, s) => {
    ctx.font = `${s}px Anton, sans-serif`;
    return ctx.measureText(text).width;
  };
  let lines = [title];
  if (title) {
    while (size > W * 0.05 && fit(title, size) > W * 0.92) size -= W * 0.004;
    if (fit(title, size) > W * 0.92 || (title.includes(' ') && fit(title, size) > W * 0.78)) {
      const words = title.split(/\s+/);
      let best = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' ');
        const b = words.slice(i).join(' ');
        const s = Math.min(size, size * (W * 0.92) / Math.max(fit(a, size), fit(b, size)));
        if (!best || s > best.s) best = { a, b, s };
      }
      if (best && best.s > size * 0.72) {
        lines = [best.a, best.b];
        size = best.s;
      }
    }
  }
  const lineH = size * 1.04;
  const blockH = lineH * lines.length;
  const titleBottom = H * 0.955;
  const titleTop = titleBottom - blockH;

  // Tagline under the title.
  const tag = (state.tagline || '').trim().toUpperCase();
  if (tag) {
    const ts = Math.max(10, W * 0.021);
    ctx.font = `${ts}px Anton, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(ts * 0.55)}px`; } catch { /* older engines */ }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 244, 214, 0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = ts * 0.4;
    ctx.fillText(tag, cx, titleBottom + H * 0.012);
    try { ctx.letterSpacing = '0px'; } catch { /* older engines */ }
    ctx.shadowBlur = 0;
  }

  // The title itself: dark stroke, soft shadow, gradient face in the grade's palette.
  if (title) {
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#150722';
    ctx.lineWidth = size * 0.16;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.14;
    ctx.shadowOffsetY = size * 0.05;
    const grad = ctx.createLinearGradient(0, titleTop, 0, titleBottom);
    grad.addColorStop(0, grade.title[0]);
    grad.addColorStop(0.55, grade.title[1]);
    grad.addColorStop(1, grade.title[2]);
    lines.forEach((line, i) => {
      const y = titleTop + size + i * lineH - size * 0.06;
      ctx.strokeText(line, cx, y);
      ctx.fillStyle = grad;
      ctx.fillText(line, cx, y);
    });
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // Script subtitle, tipped at a slight angle over the title's shoulder.
  const sub = (state.subtitle || '').trim();
  if (sub) {
    const ss = Math.max(12, W * 0.043);
    ctx.save();
    ctx.translate(cx, titleTop - ss * 0.28);
    ctx.rotate(-0.045);
    ctx.font = `${ss}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(21, 7, 34, 0.85)';
    ctx.lineWidth = ss * 0.16;
    ctx.strokeText(sub, 0, 0);
    const grad = ctx.createLinearGradient(0, -ss, 0, ss * 0.3);
    grad.addColorStop(0, grade.title[0]);
    grad.addColorStop(1, grade.title[1]);
    ctx.fillStyle = grad;
    ctx.fillText(sub, 0, 0);
    ctx.restore();
  }
}

/** Our own rating badge: a black box, a bold 18, and two lines of microprint. */
function drawBadge(ctx, W, H) {
  const bw = W * 0.088;
  const bh = bw * 1.24;
  const x = W * 0.034;
  const y = H - H * 0.03 - bh;
  ctx.fillStyle = '#0c0c0e';
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = '#f5f2ea';
  ctx.lineWidth = Math.max(2, W * 0.0032);
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, bw - ctx.lineWidth, bh - ctx.lineWidth);
  ctx.fillStyle = '#f5f2ea';
  ctx.textAlign = 'center';
  const big = bw * 0.52;
  ctx.font = `${big}px Anton, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText('18', x + bw / 2, y + bh * 0.08);
  const plus = bw * 0.2;
  ctx.font = `${plus}px Anton, sans-serif`;
  ctx.fillText('MATURE', x + bw / 2, y + bh * 0.60);
  const micro = bw * 0.115;
  ctx.font = `${micro}px Anton, sans-serif`;
  ctx.fillText('VICE PANEL STUDIO', x + bw / 2, y + bh * 0.80);
}

/** A barcode strip whose bars are grown from the title's hash — same title, same barcode. */
function drawBarcode(ctx, W, H, title) {
  const bw = W * 0.155;
  const bh = W * 0.048;
  const x = W * 0.966 - bw;
  const y = H - H * 0.03 - bh;
  ctx.fillStyle = '#f7f4ec';
  ctx.fillRect(x, y, bw, bh);
  const rand = mulberry32(hashText(`barcode:${title}`));
  ctx.fillStyle = '#101014';
  let bx = x + bw * 0.05;
  const barArea = bw * 0.9;
  const barH = bh * 0.68;
  while (bx < x + barArea) {
    const wdt = (0.4 + rand() * 1.5) * (bw * 0.012);
    if (rand() > 0.32) ctx.fillRect(bx, y + bh * 0.08, wdt, barH);
    bx += wdt + bw * 0.008;
  }
  const digits = String(hashText(title) % 1000000000000).padStart(12, '0');
  const ts = bh * 0.24;
  ctx.font = `${ts}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${digits.slice(0, 1)} ${digits.slice(1, 7)} ${digits.slice(7)}`, x + bw / 2, y + bh * 0.95);
}

/** Print halftone: dots that swell in the shadows, sampled off a downscaled copy of the art. */
function drawHalftone(ctx, W, H) {
  const cells = 110;
  const cw = W / cells;
  const ch = cw;
  const rows = Math.ceil(H / ch);
  const small = document.createElement('canvas');
  small.width = cells;
  small.height = rows;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(ctx.canvas, 0, 0, cells, rows);
  const data = sctx.getImageData(0, 0, cells, rows).data;
  ctx.fillStyle = 'rgba(12, 4, 22, 0.20)';
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const i = (gy * cells + gx) * 4;
      const luma = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      if (luma > 0.55) continue;
      const r = (0.55 - luma) * cw * 0.62;
      if (r < 0.4) continue;
      ctx.beginPath();
      ctx.arc(gx * cw + cw / 2, gy * ch + ch / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawVignette(ctx, W, H, amount) {
  const r = Math.hypot(W, H) / 2;
  const grad = ctx.createRadialGradient(W / 2, H / 2, r * 0.52, W / 2, H / 2, r);
  grad.addColorStop(0, 'rgba(8, 2, 14, 0)');
  grad.addColorStop(1, `rgba(8, 2, 14, ${0.52 * amount})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

let grainTile = null;

function drawGrain(ctx, W, H, amount) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 256;
    grainTile.height = 256;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(256, 256);
    const rand = mulberry32(0x9e3779b9);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rand() * 256);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.16 * amount;
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
