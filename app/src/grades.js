// Per-pixel colour grades for Vice Panel Studio.
//
// Each grade is a small set of photographic parameters — saturation, contrast, a gamma bend, and a
// per-channel lift/gain pair (the colourist's printer lights). From those we build three 256-entry
// lookup tables, one per channel, and run every pixel of a photo through saturation mixing plus the
// tables. The result is cached per photo + grade, so the editor stays responsive while dragging.

export const GRADES = [
  {
    id: 'sunset', name: 'Sunset',
    sat: 1.28, contrast: 1.09, gamma: 1.00,
    lift: [0.030, 0.004, 0.034], gain: [1.07, 0.98, 0.90],
    title: ['#fff6d8', '#ffb347', '#ff5e7a'], swatch: 'linear-gradient(135deg,#ffd76e,#ff7a59 55%,#c62b7d)',
  },
  {
    id: 'neon', name: 'Neon Nights',
    sat: 1.46, contrast: 1.16, gamma: 0.95,
    lift: [0.028, 0.012, 0.062], gain: [0.94, 1.06, 1.09],
    title: ['#e8fdff', '#4fe3ff', '#ff4fd8'], swatch: 'linear-gradient(135deg,#19d3ff,#3155ff 55%,#ff2fb3)',
  },
  {
    id: 'golden', name: 'Golden Hour',
    sat: 1.16, contrast: 0.98, gamma: 1.06,
    lift: [0.034, 0.020, 0.000], gain: [1.09, 1.00, 0.84],
    title: ['#fffbe8', '#ffd76e', '#ff8a3d'], swatch: 'linear-gradient(135deg,#ffe9a3,#f5a83d 60%,#a85b1e)',
  },
  {
    id: 'pastel', name: 'Vice Pastel',
    sat: 0.92, contrast: 0.82, gamma: 1.00,
    lift: [0.105, 0.072, 0.105], gain: [1.00, 0.99, 1.03],
    title: ['#ffffff', '#ffd7ef', '#8fe8ff'], swatch: 'linear-gradient(135deg,#ffe3f4,#f7a8d8 55%,#8fd8f2)',
  },
  {
    id: 'noir', name: 'Noir',
    sat: 0.00, contrast: 1.32, gamma: 0.92,
    lift: [0.000, 0.000, 0.004], gain: [1.03, 1.00, 0.96],
    title: ['#ffffff', '#cfd4dc', '#5d6673'], swatch: 'linear-gradient(135deg,#e8eaee,#6b7280 60%,#111318)',
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

/** Builds the three channel lookup tables for a grade. */
function buildLuts(grade) {
  const luts = [];
  for (let ch = 0; ch < 3; ch++) {
    const lut = new Uint8ClampedArray(256);
    const lift = grade.lift[ch];
    const gain = grade.gain[ch];
    for (let v = 0; v < 256; v++) {
      let x = v / 255;
      x = (x - 0.5) * grade.contrast + 0.5;
      x = Math.pow(Math.max(0, x), grade.gamma);
      x = lift + x * (gain - lift);
      lut[v] = Math.round(Math.min(1, Math.max(0, x)) * 255);
    }
    luts.push(lut);
  }
  return luts;
}

const MAX_DIM = 1600;

/**
 * Returns a canvas holding `img` with `grade` applied, at the image's own size capped to
 * MAX_DIM on the long edge. Every pixel is saturation-mixed then pushed through the LUTs.
 */
export function gradedCanvas(img, grade) {
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const [lr, lg, lb] = buildLuts(grade);
  const sat = grade.sat;
  const mix = (luma, c) => Math.max(0, Math.min(255, Math.round(luma + (c - luma) * sat)));
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    px[i] = lr[mix(luma, r)];
    px[i + 1] = lg[mix(luma, g)];
    px[i + 2] = lb[mix(luma, b)];
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}
