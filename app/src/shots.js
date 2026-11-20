// Fixed scenes for screenshots: ?shot=cover paints one finished cover full-frame;
// ?shot=editor shows the studio with a cover in progress. The scene is fully described by
// the query — photo picks the lead sample, caption becomes the title, and layout/grade may
// be given explicitly (the fourth screenshot does). window.__shotReady is set once painted.

const SCENES = {
  // Lead sample -> the composition that flatters it when the query names nothing else.
  pier: {
    layout: 'hero', grade: 'sunset', subtitle: 'Neon Shores',
    panels: [
      { photo: 'pier', zoom: 1.0, dx: 0, dy: 0 },
      { photo: 'boulevard', zoom: 1.15, dx: 0.15, dy: 0 },
      { photo: 'pier', zoom: 1.5, dx: -0.2, dy: 0.1 },
    ],
  },
  boulevard: {
    layout: 'mosaic', grade: 'golden', subtitle: 'Palm Avenue',
    panels: [
      { photo: 'boulevard', zoom: 1.0, dx: 0, dy: 0 },
      { photo: 'pier', zoom: 1.2, dx: 0.1, dy: 0 },
      { photo: 'boulevard', zoom: 1.45, dx: 0.25, dy: -0.1 },
      { photo: 'pier', zoom: 1.1, dx: -0.15, dy: 0 },
    ],
  },
};

function panelsFor(layout, leadId, otherId, count) {
  const order = [leadId, otherId, leadId, otherId];
  const zooms = [1.05, 1.2, 1.35, 1.15];
  return Array.from({ length: count }, (_, i) => ({
    photo: order[i % order.length], zoom: zooms[i % zooms.length], dx: 0.08 * (i - 1), dy: 0,
  }));
}

export async function runShotMode(params, api) {
  const { state, canvas } = api;
  const shot = params.get('shot');
  const lead = params.get('photo') ?? 'pier';
  const other = lead === 'pier' ? 'boulevard' : 'pier';
  state.title = params.get('caption') ?? 'Sunset Heist';

  await Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('40px Pacifico'),
    document.fonts.ready,
  ]);

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const scene = SCENES[lead] ?? SCENES.pier;
    state.layout = params.get('layout') ?? scene.layout;
    state.grade = params.get('grade') ?? scene.grade;
    state.subtitle = params.get('subtitle') ?? scene.subtitle;
    state.fx = { grain: 0.65, vignette: 0.75, halftone: params.get('grade') === 'noir' };
    const count = api.panelCount(state.layout);
    const specs = params.get('layout')
      ? panelsFor(state.layout, lead, other, count)
      : scene.panels.slice(0, count);
    api.setPanels(specs);
    state.highlight = -1;
  } else {
    // Editor: the studio mid-work — mosaic layout, neon grade, lead photo in the big panel.
    state.layout = 'mosaic';
    state.grade = 'neon';
    state.subtitle = 'Palm Avenue';
    state.fx = { grain: 0.5, vignette: 0.6, halftone: false };
    api.setPanels([
      { photo: lead, zoom: 1.0, dx: 0, dy: 0 },
      { photo: other, zoom: 1.25, dx: 0.1, dy: 0 },
      { photo: lead, zoom: 1.5, dx: -0.2, dy: 0.05 },
      { photo: other, zoom: 1.15, dx: 0, dy: 0 },
    ]);
    state.highlight = 0;
    api.syncControls();
  }

  api.render();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
