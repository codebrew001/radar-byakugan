const CONFIG = {
  mapCenter: [-22.9068, -43.1729],
  mapZoom: 9,
  apiUrl: 'https://api.rainviewer.com/public/weather-maps.json',
  palette: 2,
  options: '1_0',
  refreshMs: 5 * 60 * 1000,
};

const CAPITALS = [
  { code: 'SE', name: 'Aracaju', coordinates: [-10.9472, -37.0731] },
  { code: 'PA', name: 'Belém', coordinates: [-1.4558, -48.4902] },
  { code: 'MG', name: 'Belo Horizonte', coordinates: [-19.9167, -43.9345] },
  { code: 'RR', name: 'Boa Vista', coordinates: [2.8235, -60.6758] },
  { code: 'DF', name: 'Brasília', coordinates: [-15.7939, -47.8828] },
  { code: 'MS', name: 'Campo Grande', coordinates: [-20.4697, -54.6201] },
  { code: 'MT', name: 'Cuiabá', coordinates: [-15.6014, -56.0979] },
  { code: 'PR', name: 'Curitiba', coordinates: [-25.4284, -49.2733] },
  { code: 'SC', name: 'Florianópolis', coordinates: [-27.5954, -48.548] },
  { code: 'CE', name: 'Fortaleza', coordinates: [-3.7319, -38.5267] },
  { code: 'GO', name: 'Goiânia', coordinates: [-16.6869, -49.2648] },
  { code: 'PB', name: 'João Pessoa', coordinates: [-7.1195, -34.845] },
  { code: 'AP', name: 'Macapá', coordinates: [0.0356, -51.0705] },
  { code: 'AL', name: 'Maceió', coordinates: [-9.6658, -35.7353] },
  { code: 'AM', name: 'Manaus', coordinates: [-3.119, -60.0217] },
  { code: 'RN', name: 'Natal', coordinates: [-5.7945, -35.211] },
  { code: 'TO', name: 'Palmas', coordinates: [-10.184, -48.3336] },
  { code: 'RS', name: 'Porto Alegre', coordinates: [-30.0346, -51.2177] },
  { code: 'RO', name: 'Porto Velho', coordinates: [-8.7612, -63.9004] },
  { code: 'PE', name: 'Recife', coordinates: [-8.0476, -34.877] },
  { code: 'AC', name: 'Rio Branco', coordinates: [-9.9754, -67.8249] },
  { code: 'RJ', name: 'Rio de Janeiro', coordinates: CONFIG.mapCenter },
  { code: 'BA', name: 'Salvador', coordinates: [-12.9777, -38.5016] },
  { code: 'MA', name: 'São Luís', coordinates: [-2.5307, -44.3068] },
  { code: 'SP', name: 'São Paulo', coordinates: [-23.5505, -46.6333] },
  { code: 'PI', name: 'Teresina', coordinates: [-5.0919, -42.8034] },
  { code: 'ES', name: 'Vitória', coordinates: [-20.3155, -40.3128] },
];

const state = {
  api: null,
  frames: [],
  activeIndex: -1,
  radarReady: false,
  animationTimer: null,
  toastTimer: null,
};

const els = {
  mapLoading: document.querySelector('#mapLoading'),
  refreshButton: document.querySelector('#refreshButton'),
  recenterButton: document.querySelector('#recenterButton'),
  capitalPicker: document.querySelector('#capitalPicker'),
  capitalSelect: document.querySelector('#capitalSelect'),
  capitalSelectedLabel: document.querySelector('#capitalSelectedLabel'),
  capitalOptions: document.querySelector('#capitalOptions'),
  playButton: document.querySelector('#playButton'),
  playIcon: document.querySelector('#playIcon'),
  playLabel: document.querySelector('#playLabel'),
  timelineSlider: document.querySelector('#timelineSlider'),
  timelineTicks: document.querySelector('#timelineTicks'),
  frameTitle: document.querySelector('#frameTitle'),
  frameTime: document.querySelector('#frameTime'),
  frameCount: document.querySelector('#frameCount'),
  latestReading: document.querySelector('#latestReading'),
  sourceStatus: document.querySelector('#sourceStatus'),
  topStatusText: document.querySelector('#topStatusText'),
  topStatusDot: document.querySelector('#topStatusDot'),
  footerClock: document.querySelector('#footerClock'),
  toast: document.querySelector('#toast'),
};

const map = L.map('map', {
  center: CONFIG.mapCenter,
  zoom: CONFIG.mapZoom,
  zoomControl: false,
  minZoom: 7,
  maxZoom: 16,
  preferCanvas: true,
});

const maplibreLayer = L.maplibreGL({
  style: 'https://tiles.openfreemap.org/styles/dark',
}).addTo(map);
const maplibreMap = maplibreLayer.getMaplibreMap();

const RADAR_SOURCE_ID = 'rainviewer-radar-source';
const RADAR_LAYER_ID = 'rainviewer-radar-layer';

const setCapitalMenuOpen = (isOpen) => {
  els.capitalPicker.classList.toggle('is-open', isOpen);
  els.capitalSelect.setAttribute('aria-expanded', String(isOpen));

  const selectedOption = els.capitalOptions.querySelector('.capital-option.is-selected');
  els.capitalOptions.querySelectorAll('.capital-option').forEach((option) => {
    option.tabIndex = isOpen && option === selectedOption ? 0 : -1;
  });

  if (isOpen) selectedOption?.focus();
};

const selectCapital = (capital, { moveMap = false } = {}) => {
  els.capitalSelectedLabel.textContent = `${capital.name} · ${capital.code}`;
  els.capitalSelect.setAttribute('aria-label', `Capital selecionada: ${capital.name}`);
  els.capitalOptions.querySelectorAll('.capital-option').forEach((option) => {
    const isSelected = option.dataset.code === capital.code;
    option.classList.toggle('is-selected', isSelected);
    option.setAttribute('aria-selected', String(isSelected));
  });

  if (moveMap) {
    map.flyTo(capital.coordinates, map.getZoom(), { duration: 0.8 });
    showToast(`Mapa centralizado em ${capital.name}`);
  }
};

const focusCapitalOption = (currentOption, direction) => {
  const options = [...els.capitalOptions.querySelectorAll('.capital-option')];
  const currentIndex = options.indexOf(currentOption);
  const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + direction));
  options[nextIndex]?.focus();
};

CAPITALS.forEach((capital) => {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'capital-option';
  option.dataset.code = capital.code;
  option.setAttribute('role', 'option');
  option.setAttribute('aria-selected', 'false');
  option.tabIndex = -1;
  option.innerHTML = `<span>${capital.name}</span><small>${capital.code}</small>`;
  option.addEventListener('click', () => {
    selectCapital(capital, { moveMap: true });
    setCapitalMenuOpen(false);
    els.capitalSelect.focus();
  });
  option.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      focusCapitalOption(option, 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCapitalOption(option, -1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setCapitalMenuOpen(false);
      els.capitalSelect.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      option.click();
    }
  });
  els.capitalOptions.appendChild(option);
});

selectCapital(CAPITALS.find(({ code }) => code === 'RJ'));
els.capitalSelect.addEventListener('click', () => {
  setCapitalMenuOpen(!els.capitalPicker.classList.contains('is-open'));
});
els.capitalSelect.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    setCapitalMenuOpen(true);
  } else if (event.key === 'Escape') {
    setCapitalMenuOpen(false);
  }
});
document.addEventListener('click', (event) => {
  if (!els.capitalPicker.contains(event.target)) setCapitalMenuOpen(false);
});

const formatTime = (unixSeconds, options = {}) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  ...options,
}).format(new Date(unixSeconds * 1000));

const formatFrameTitle = (unixSeconds) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(unixSeconds * 1000)).replace('.', '');

const setStatus = (status, message) => {
  const statusMap = {
    live: { label: 'Conectado', dotClass: 'is-live' },
    loading: { label: 'Atualizando', dotClass: 'is-live' },
    warning: { label: 'Indisponível', dotClass: 'is-warn' },
  };
  const next = statusMap[status] || statusMap.warning;
  els.sourceStatus.textContent = next.label;
  els.topStatusText.textContent = message;
  els.topStatusDot.className = `status-dot ${next.dotClass}`;
};

const showToast = (message) => {
  window.clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  state.toastTimer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 3600);
};

const setLoading = (isLoading) => {
  els.mapLoading.classList.toggle('is-hidden', !isLoading);
  els.refreshButton.classList.toggle('is-loading', isLoading);
  els.refreshButton.disabled = isLoading;
};

const tileUrlFor = (frame) => `${state.api.host}${frame.path}/256/{z}/{x}/{y}/${CONFIG.palette}/${CONFIG.options}.png`;

const syncRadarLayer = (frame) => {
  if (!frame || !maplibreMap.isStyleLoaded()) return;

  const tiles = [tileUrlFor(frame)];
  const existingSource = maplibreMap.getSource(RADAR_SOURCE_ID);

  if (!existingSource) {
    maplibreMap.addSource(RADAR_SOURCE_ID, {
      type: 'raster',
      tiles,
      tileSize: 256,
      minzoom: 0,
      maxzoom: 7,
    });
    const firstLabelLayer = maplibreMap.getStyle().layers?.find((layer) => layer.type === 'symbol');
    maplibreMap.addLayer({
      id: RADAR_LAYER_ID,
      type: 'raster',
      source: RADAR_SOURCE_ID,
      paint: {
        'raster-opacity': 0.62,
        'raster-resampling': 'linear',
      },
    }, firstLabelLayer?.id);
    state.radarReady = true;
    return;
  }

  if (typeof existingSource.setTiles === 'function') {
    existingSource.setTiles(tiles);
  } else {
    maplibreMap.removeLayer(RADAR_LAYER_ID);
    maplibreMap.removeSource(RADAR_SOURCE_ID);
    state.radarReady = false;
    syncRadarLayer(frame);
  }
  state.radarReady = true;
};

maplibreMap.once('load', () => {
  if (state.activeIndex >= 0) syncRadarLayer(state.frames[state.activeIndex]);
});

const updateRangeProgress = () => {
  if (!state.frames.length) return;
  const percentage = state.frames.length === 1 ? 100 : (state.activeIndex / (state.frames.length - 1)) * 100;
  els.timelineSlider.style.setProperty('--range-progress', `${percentage}%`);
};

const renderFrame = (requestedIndex, animate = false) => {
  if (!state.frames.length || !state.api) return;
  const index = Math.max(0, Math.min(requestedIndex, state.frames.length - 1));
  const frame = state.frames[index];
  state.activeIndex = index;

  syncRadarLayer(frame);

  els.timelineSlider.value = String(index);
  els.frameTitle.textContent = formatFrameTitle(frame.time);
  els.frameTime.textContent = `${formatTime(frame.time)} · ${index === state.frames.length - 1 ? 'último frame' : 'histórico'}`;
  els.frameCount.textContent = `${index + 1} / ${state.frames.length}`;
  els.timelineSlider.setAttribute('aria-valuetext', formatFrameTitle(frame.time));
  updateRangeProgress();

  if (animate) els.frameTitle.classList.add('frame-pulse');
  window.setTimeout(() => els.frameTitle.classList.remove('frame-pulse'), 240);
};

const buildTimeline = () => {
  els.timelineSlider.disabled = state.frames.length === 0;
  els.timelineSlider.max = String(Math.max(0, state.frames.length - 1));
  els.timelineTicks.innerHTML = '';

  if (!state.frames.length) {
    els.frameTitle.textContent = 'Sem frames disponíveis';
    els.frameCount.textContent = '0 / 0';
    return;
  }

  const tickIndexes = [...new Set([0, Math.floor((state.frames.length - 1) / 2), state.frames.length - 1])];
  tickIndexes.forEach((index) => {
    const tick = document.createElement('span');
    tick.textContent = formatTime(state.frames[index].time);
    els.timelineTicks.appendChild(tick);
  });
};

const stopAnimation = () => {
  if (state.animationTimer) window.clearInterval(state.animationTimer);
  state.animationTimer = null;
  els.playLabel.textContent = 'Animar';
  els.playButton.setAttribute('aria-label', 'Reproduzir animação do radar');
  els.playButton.title = 'Reproduzir';
  els.playIcon.innerHTML = '<path d="m9 6 9 6-9 6V6Z" fill="currentColor" />';
};

const startAnimation = () => {
  if (!state.frames.length) return;
  if (state.activeIndex >= state.frames.length - 1) renderFrame(0);
  els.playLabel.textContent = 'Pausar';
  els.playButton.setAttribute('aria-label', 'Pausar animação do radar');
  els.playButton.title = 'Pausar';
  els.playIcon.innerHTML = '<path d="M8 6v12M16 6v12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />';
  state.animationTimer = window.setInterval(() => {
    const next = state.activeIndex >= state.frames.length - 1 ? 0 : state.activeIndex + 1;
    renderFrame(next, true);
  }, 900);
};

const loadRadar = async ({ manual = false } = {}) => {
  stopAnimation();
  setLoading(true);
  setStatus('loading', 'Atualizando dados do radar');

  try {
    const response = await fetch(`${CONFIG.apiUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`RainViewer respondeu ${response.status}`);
    const api = await response.json();
    const frames = Array.isArray(api?.radar?.past) ? api.radar.past.filter((frame) => frame?.path && frame?.time).sort((a, b) => a.time - b.time) : [];
    if (!api.host || !frames.length) throw new Error('Nenhum frame disponível');

    state.api = api;
    state.frames = frames;
    buildTimeline();
    renderFrame(frames.length - 1);
    const latest = frames[frames.length - 1].time;
    els.latestReading.textContent = formatTime(latest);
    setStatus('live', 'Monitorando Brasil');
    if (manual) showToast('Radar atualizado com sucesso');
  } catch (error) {
    console.error(error);
    setStatus('warning', 'Não foi possível atualizar agora');
    if (!state.frames.length) {
      els.frameTitle.textContent = 'Radar temporariamente indisponível';
      els.frameTime.textContent = 'Tente atualizar novamente';
    }
    showToast('Não foi possível buscar os dados agora');
  } finally {
    setLoading(false);
  }
};

els.timelineSlider.addEventListener('input', (event) => {
  stopAnimation();
  renderFrame(Number(event.target.value));
});

els.playButton.addEventListener('click', () => {
  if (state.animationTimer) stopAnimation();
  else startAnimation();
});

els.refreshButton.addEventListener('click', () => loadRadar({ manual: true }));
els.recenterButton.addEventListener('click', () => map.flyTo(CONFIG.mapCenter, CONFIG.mapZoom, { duration: 0.8 }));

const updateClock = () => {
  els.footerClock.textContent = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
};

updateClock();
window.setInterval(updateClock, 30 * 1000);
window.setInterval(() => loadRadar(), CONFIG.refreshMs);
loadRadar();
