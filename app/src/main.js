// Vice Panel Studio — the editor.
//
// State is one plain object (see `state` below); every control edits it and repaints through
// render.js. Panels remember their photo, zoom and drag offset per layout, the photo tray
// holds the two bundled samples plus anything the visitor uploads, and exports re-render the
// same state at print sizes. A ?shot= query hands control to ./shots.js for fixed scenes.

import { GRADES } from './grades.js';
import { LAYOUTS, layoutById } from './layouts.js';
import { computeDraw, renderCover } from './render.js';
import { runShotMode } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const state = {
  layout: 'hero',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'Neon Shores',
  tagline: 'Every panel tells a story',
  fx: { grain: 0.6, vignette: 0.7, halftone: false },
  photos: [], // { id, img, name }
  panels: [], // { photo: index into photos, zoom, dx, dy } for the current layout
  highlight: 0,
};

let selected = 0;
const assignments = new Map(); // layoutId -> panels, so layouts remember their casting
let uploadCount = 0;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function photoIndex(id) {
  return state.photos.findIndex((p) => p.id === id);
}

/** Default casting for a layout: the samples alternate, each framed a little differently. */
function defaultPanels(layoutId) {
  const count = layoutById(layoutId).panels.length;
  const zooms = [1.0, 1.2, 1.45, 1.15];
  return Array.from({ length: count }, (_, i) => ({
    photo: state.photos.length ? i % Math.min(2, state.photos.length) : 0,
    zoom: zooms[i % zooms.length],
    dx: 0,
    dy: 0,
  }));
}

function useLayout(layoutId) {
  if (state.layout && state.panels.length) assignments.set(state.layout, state.panels);
  state.layout = layoutId;
  state.panels = assignments.get(layoutId) ?? defaultPanels(layoutId);
  if (selected >= state.panels.length) selected = 0;
  state.highlight = selected;
}

function render() {
  renderCover(ctx, canvas.width, canvas.height, state);
}

/* ---------- controls ---------- */

const layoutChips = document.getElementById('layouts');
const gradeChips = document.getElementById('grades');
const tray = document.getElementById('tray');
const zoomInput = document.getElementById('zoom');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const taglineInput = document.getElementById('tagline');
const grainInput = document.getElementById('grain');
const vignetteInput = document.getElementById('vignette');
const halftoneInput = document.getElementById('halftone');

function buildChips() {
  layoutChips.innerHTML = '';
  for (const layout of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = layout.name;
    b.className = 'chip' + (layout.id === state.layout ? ' on' : '');
    b.addEventListener('click', () => {
      useLayout(layout.id);
      buildChips();
      syncPanelControls();
      render();
    });
    layoutChips.appendChild(b);
  }
  gradeChips.innerHTML = '';
  for (const grade of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip grade' + (grade.id === state.grade ? ' on' : '');
    b.innerHTML = `<span class="sw" style="background:${grade.swatch}"></span>${grade.name}`;
    b.addEventListener('click', () => {
      state.grade = grade.id;
      buildChips();
      render();
    });
    gradeChips.appendChild(b);
  }
}

function buildTray() {
  tray.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb' + (state.panels[selected] && state.panels[selected].photo === i ? ' on' : '');
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    const label = document.createElement('span');
    label.textContent = photo.name;
    b.append(img, label);
    b.title = `Put ${photo.name} in the selected panel`;
    b.addEventListener('click', () => {
      if (!state.panels[selected]) return;
      state.panels[selected].photo = i;
      buildTray();
      render();
    });
    tray.appendChild(b);
  });
}

function syncPanelControls() {
  const slot = state.panels[selected];
  if (slot) zoomInput.value = String(slot.zoom);
}

function syncControls() {
  buildChips();
  buildTray();
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  taglineInput.value = state.tagline;
  grainInput.value = String(state.fx.grain);
  vignetteInput.value = String(state.fx.vignette);
  halftoneInput.checked = state.fx.halftone;
  syncPanelControls();
}

titleInput.addEventListener('input', () => { state.title = titleInput.value; render(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; render(); });
taglineInput.addEventListener('input', () => { state.tagline = taglineInput.value; render(); });
grainInput.addEventListener('input', () => { state.fx.grain = Number(grainInput.value); render(); });
vignetteInput.addEventListener('input', () => { state.fx.vignette = Number(vignetteInput.value); render(); });
halftoneInput.addEventListener('change', () => { state.fx.halftone = halftoneInput.checked; render(); });
zoomInput.addEventListener('input', () => {
  const slot = state.panels[selected];
  if (!slot) return;
  slot.zoom = Number(zoomInput.value);
  render();
});
document.getElementById('center').addEventListener('click', () => {
  const slot = state.panels[selected];
  if (!slot) return;
  slot.dx = 0;
  slot.dy = 0;
  render();
});

document.getElementById('upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  uploadCount += 1;
  state.photos.push({ id: `upload-${uploadCount}`, img, name: file.name.replace(/\.[^.]+$/, '') || `Upload ${uploadCount}` });
  if (state.panels[selected]) state.panels[selected].photo = state.photos.length - 1;
  buildTray();
  render();
  status.textContent = `Added ${file.name} to the tray and the selected panel.`;
});

/* ---------- canvas: click to select a panel, drag to reframe it ---------- */

let drag = null;

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const layout = layoutById(state.layout);
  const idx = layout.panels.findIndex((p) =>
    pt.x >= p.x * canvas.width && pt.x <= (p.x + p.w) * canvas.width &&
    pt.y >= p.y * canvas.height && pt.y <= (p.y + p.h) * canvas.height);
  if (idx === -1) return;
  selected = idx;
  state.highlight = idx;
  const slot = state.panels[selected];
  const photo = state.photos[slot.photo];
  const rect = {
    x: layout.panels[idx].x * canvas.width, y: layout.panels[idx].y * canvas.height,
    w: layout.panels[idx].w * canvas.width, h: layout.panels[idx].h * canvas.height,
  };
  const d = computeDraw(rect, photo.img, slot.zoom, slot.dx, slot.dy);
  drag = { x: e.clientX, y: e.clientY, dx: slot.dx, dy: slot.dy, roomX: (d.dw - rect.w) / 2, roomY: (d.dh - rect.h) / 2, scale: canvas.width / canvas.getBoundingClientRect().width };
  canvas.setPointerCapture(e.pointerId);
  buildTray();
  syncPanelControls();
  render();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const slot = state.panels[selected];
  const mx = (e.clientX - drag.x) * drag.scale;
  const my = (e.clientY - drag.y) * drag.scale;
  if (drag.roomX > 0.5) slot.dx = Math.max(-1, Math.min(1, drag.dx + mx / drag.roomX));
  if (drag.roomY > 0.5) slot.dy = Math.max(-1, Math.min(1, drag.dy + my / drag.roomY));
  render();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

/* ---------- export ---------- */

for (const btn of document.querySelectorAll('[data-export]')) {
  btn.addEventListener('click', () => {
    const [w, h] = btn.dataset.export.split('x').map(Number);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    renderCover(out.getContext('2d'), w, h, { ...state, highlight: -1 });
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-panel-cover-${w}x${h}.png`;
      a.click();
      status.textContent = `Saved vice-panel-cover-${w}x${h}.png`;
    }, 'image/png');
  });
}

/* ---------- boot ---------- */

const api = {
  state,
  canvas,
  render,
  panelCount: (layoutId) => layoutById(layoutId).panels.length,
  setPanels: (specs) => {
    state.panels = specs.map((s) => ({
      photo: Math.max(0, photoIndex(s.photo)),
      zoom: s.zoom ?? 1,
      dx: s.dx ?? 0,
      dy: s.dy ?? 0,
    }));
    assignments.set(state.layout, state.panels);
  },
  syncControls,
};

(async () => {
  const [pier, boulevard] = await Promise.all([
    loadImage('samples/pier.jpg'),
    loadImage('samples/boulevard.jpg'),
  ]);
  state.photos = [
    { id: 'pier', img: pier, name: 'Pier' },
    { id: 'boulevard', img: boulevard, name: 'Boulevard' },
  ];
  useLayout(state.layout);
  syncControls();
  render();

  const params = new URLSearchParams(location.search);
  if (params.get('shot')) {
    await runShotMode(params, api);
  }
})();
