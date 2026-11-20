// Panel layouts for the cover, in normalised 0..1 coordinates over the whole canvas.
// Panels are drawn inset by a thin keyline gap, so the paper colour shows through as the
// white separators a printed poster has. Every layout leaves the lower band to the title
// block the renderer paints over the art.

export const LAYOUTS = [
  {
    id: 'hero', name: 'Hero',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.60 },
      { x: 0, y: 0.60, w: 0.5, h: 0.40 },
      { x: 0.5, y: 0.60, w: 0.5, h: 0.40 },
    ],
  },
  {
    id: 'mosaic', name: 'Mosaic',
    panels: [
      { x: 0, y: 0, w: 0.58, h: 1 },
      { x: 0.58, y: 0, w: 0.42, h: 0.34 },
      { x: 0.58, y: 0.34, w: 0.42, h: 0.33 },
      { x: 0.58, y: 0.67, w: 0.42, h: 0.33 },
    ],
  },
  {
    id: 'quad', name: 'Quad',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'triptych', name: 'Triptych',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  {
    id: 'strip', name: 'Strip',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.52 },
      { x: 0, y: 0.52, w: 1 / 3, h: 0.48 },
      { x: 1 / 3, y: 0.52, w: 1 / 3, h: 0.48 },
      { x: 2 / 3, y: 0.52, w: 1 / 3, h: 0.48 },
    ],
  },
  {
    id: 'showcase', name: 'Showcase',
    panels: [
      { x: 0, y: 0, w: 1, h: 1 },
    ],
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
