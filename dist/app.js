const CONFIG = {
  mapCenter: [-22.9068, -43.1729],
  mapZoom: 9,
  apiUrl: 'https://api.rainviewer.com/public/weather-maps.json',
  officialAlertsUrl: 'https://apiprevmet3.inmet.gov.br/avisos/ativos',
  palette: 2,
  options: '1_0',
  refreshMs: 5 * 60 * 1000,
  radarSampleZoom: 7,
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
  radarTileCache: new Map(),
  location: {
    kind: 'capital',
    name: 'Rio de Janeiro',
    coordinates: CONFIG.mapCenter,
  },
  radarAlert: null,
  officialAlerts: [],
  officialAlertsStatus: 'loading',
  officialAlertsUpdatedAt: null,
  notifiedKeys: new Set(),
  notificationsEnabled: false,
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
  locationButton: document.querySelector('#locationButton'),
  notificationButton: document.querySelector('#notificationButton'),
  alertsTitle: document.querySelector('#alertsTitle'),
  alertsSubtitle: document.querySelector('#alertsSubtitle'),
  radarAlertStatus: document.querySelector('#radarAlertStatus'),
  radarAlertTitle: document.querySelector('#radarAlertTitle'),
  radarAlertText: document.querySelector('#radarAlertText'),
  officialAlertStatus: document.querySelector('#officialAlertStatus'),
  officialAlertTitle: document.querySelector('#officialAlertTitle'),
  officialAlertText: document.querySelector('#officialAlertText'),
  officialAlertsList: document.querySelector('#officialAlertsList'),
  alertsUpdated: document.querySelector('#alertsUpdated'),
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
let userLocationMarker = null;
let officialAlertsLayer = null;

const setMonitoredLocation = ({ kind, name, coordinates }, { moveMap = false } = {}) => {
  state.location = { kind, name, coordinates: [...coordinates] };
  els.alertsTitle.textContent = name;
  els.alertsSubtitle.textContent = kind === 'current'
    ? 'Monitorando chuva detectada e avisos oficiais na sua localização atual.'
    : 'Monitorando chuva detectada e avisos oficiais nesta capital.';

  if (kind === 'current') {
    if (userLocationMarker) map.removeLayer(userLocationMarker);
    userLocationMarker = L.circleMarker(coordinates, {
      radius: 7,
      color: '#071110',
      weight: 2,
      fillColor: '#b8e65d',
      fillOpacity: 0.95,
    }).addTo(map);
    userLocationMarker.bindTooltip('Minha localização');
  } else if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
    userLocationMarker = null;
  }

  if (moveMap) {
    map.flyTo(coordinates, map.getZoom(), { duration: 0.8 });
    runLocationMonitoring();
  }
};

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
  setMonitoredLocation({ kind: 'capital', name: capital.name, coordinates: capital.coordinates }, { moveMap });

  if (moveMap) {
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

const TILE_SIZE = 256;

const normalizeText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const latLngToWorldPixel = ([latitude, longitude], zoom) => {
  const scale = 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale * TILE_SIZE,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale * TILE_SIZE,
  };
};

const wrapTileX = (x, zoom) => {
  const scale = 2 ** zoom;
  return ((x % scale) + scale) % scale;
};

const loadRadarTile = (frame, tileX, tileY) => {
  const zoom = CONFIG.radarSampleZoom;
  const scale = 2 ** zoom;
  if (tileY < 0 || tileY >= scale) return Promise.resolve(null);

  const wrappedX = wrapTileX(tileX, zoom);
  const cacheKey = `${frame.path}:${zoom}:${wrappedX}:${tileY}`;
  if (state.radarTileCache.has(cacheKey)) return state.radarTileCache.get(cacheKey);

  const tileUrl = tileUrlFor(frame)
    .replace('{z}', String(zoom))
    .replace('{x}', String(wrappedX))
    .replace('{y}', String(tileY));
  const tilePromise = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = tileUrl;
  });
  state.radarTileCache.set(cacheKey, tilePromise);
  return tilePromise;
};

const sampleRadarAtLocation = async (frame, coordinates) => {
  const zoom = CONFIG.radarSampleZoom;
  const worldPoint = latLngToWorldPixel(coordinates, zoom);
  const radius = 18;
  const step = 3;
  const samples = [];
  const tileKeys = new Set();

  for (let offsetY = -radius; offsetY <= radius; offsetY += step) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += step) {
      const worldX = worldPoint.x + offsetX;
      const worldY = worldPoint.y + offsetY;
      const tileX = Math.floor(worldX / TILE_SIZE);
      const tileY = Math.floor(worldY / TILE_SIZE);
      const pixelX = Math.floor(worldX - tileX * TILE_SIZE);
      const pixelY = Math.floor(worldY - tileY * TILE_SIZE);
      const key = `${tileX}:${tileY}`;
      samples.push({ key, pixelX, pixelY });
      tileKeys.add(key);
    }
  }

  const tileEntries = [...tileKeys].map((key) => key.split(':').map(Number));
  const tileImages = await Promise.all(tileEntries.map(([tileX, tileY]) => loadRadarTile(frame, tileX, tileY)));
  const canvases = new Map();

  tileEntries.forEach(([tileX, tileY], index) => {
    const image = tileImages[index];
    if (!image) return;
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    canvases.set(`${tileX}:${tileY}`, context);
  });

  if (!canvases.size) return { available: false };

  let rainPixels = 0;
  let strongestLevel = 0;
  try {
    samples.forEach(({ key, pixelX, pixelY }) => {
      const context = canvases.get(key);
      if (!context) return;
      const [red, green, blue, alpha] = context.getImageData(pixelX, pixelY, 1, 1).data;
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (alpha < 24 || saturation < 18) return;

      rainPixels += 1;
      const level = red > 170 && green < 160 ? 3 : red > 150 && green > 130 ? 2 : 1;
      strongestLevel = Math.max(strongestLevel, level);
    });
  } catch (error) {
    console.warn('Não foi possível ler o tile do radar no navegador', error);
    return { available: false };
  }

  const coverage = Math.round((rainPixels / samples.length) * 100);
  return {
    available: true,
    detected: rainPixels >= 2,
    coverage,
    level: strongestLevel >= 3 ? 'forte' : strongestLevel === 2 ? 'moderada' : 'fraca',
  };
};

const parseJsonValue = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const extractGeometry = (value) => {
  const parsed = parseJsonValue(value);
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.type === 'Feature') return parsed.geometry || null;
  if (parsed.type === 'FeatureCollection') return null;
  if (parsed.type && parsed.coordinates) return parsed;
  if (parsed.geometry) return extractGeometry(parsed.geometry);
  return null;
};

const pointInRing = ([x, y], ring) => {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    const intersects = ((currentY > y) !== (previousY > y))
      && (x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX);
    if (intersects) inside = !inside;
  }
  return inside;
};

const pointInGeometry = (point, geometry) => {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    const [outer, ...holes] = geometry.coordinates || [];
    return Boolean(outer && pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole)));
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).some((polygon) => pointInGeometry(point, { type: 'Polygon', coordinates: polygon }));
  }
  return false;
};

const normalizeSeverity = (value) => {
  const severity = normalizeText(value);
  if (severity.includes('perigo potencial')) return 'warning';
  if (severity.includes('perigo') || severity.includes('grave')) return 'danger';
  return 'notice';
};

const severityLabel = (severity) => ({ danger: 'PERIGO', warning: 'PERIGO POTENCIAL', notice: 'AVISO' }[severity] || 'AVISO');

const formatAlertDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'período não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const normalizeAlert = (rawAlert, index) => {
  const raw = rawAlert || {};
  const description = raw.descricao || raw.description || raw.evento || raw.event || 'Aviso meteorológico';
  const municipalities = Array.isArray(raw.municipios)
    ? raw.municipios.map((municipality) => typeof municipality === 'string' ? municipality : municipality?.nome || municipality?.name || '').filter(Boolean)
    : [];
  const geometry = extractGeometry(raw.poligono || raw.polygon || raw.geometry);
  const start = raw.data_inicio || raw.inicio || raw.start || raw.onset;
  const end = raw.data_fim || raw.fim || raw.end || raw.expires;
  const id = String(raw.id || raw.codigo || raw.code || `${description}-${start || index}`);

  return {
    id,
    title: description,
    severity: normalizeSeverity(raw.severidade || raw.severity),
    start,
    end,
    geometry,
    municipalities,
    risks: raw.riscos || raw.risk || '',
    instructions: raw.instrucoes || raw.instructions || '',
    sourceUrl: raw.id ? `https://avisos.inmet.gov.br/${raw.id}` : 'https://avisos.inmet.gov.br/',
  };
};

const alertAppliesToLocation = (alert) => {
  const [latitude, longitude] = state.location.coordinates;
  if (alert.geometry) return pointInGeometry([longitude, latitude], alert.geometry);
  const locationName = normalizeText(state.location.name);
  return alert.municipalities.some((municipality) => normalizeText(municipality).includes(locationName));
};

const appendText = (parent, tagName, className, textContent) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = textContent;
  parent.appendChild(element);
  return element;
};

const renderOfficialAlertPolygons = () => {
  if (officialAlertsLayer) map.removeLayer(officialAlertsLayer);
  const features = state.officialAlerts
    .filter((alert) => alert.geometry)
    .map((alert) => ({
      type: 'Feature',
      id: alert.id,
      properties: { title: alert.title, severity: alert.severity, sourceUrl: alert.sourceUrl },
      geometry: alert.geometry,
    }));
  if (!features.length) {
    officialAlertsLayer = null;
    return;
  }

  officialAlertsLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    style: (feature) => {
      const isDanger = feature.properties?.severity === 'danger';
      return {
        color: isDanger ? '#fb5ea0' : '#ffb36c',
        weight: 1.5,
        opacity: 0.8,
        fillColor: isDanger ? '#fb5ea0' : '#ffb36c',
        fillOpacity: 0.1,
        dashArray: '5 5',
      };
    },
    onEachFeature: (feature, layer) => {
      const popup = document.createElement('div');
      appendText(popup, 'strong', '', feature.properties?.title || 'Aviso meteorológico');
      appendText(popup, 'p', '', `Severidade: ${severityLabel(feature.properties?.severity)}`);
      const link = document.createElement('a');
      link.href = feature.properties?.sourceUrl || 'https://avisos.inmet.gov.br/';
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Ver detalhes no INMET ↗';
      popup.appendChild(link);
      layer.bindPopup(popup);
    },
  }).addTo(map);
};

const renderRadarAlert = () => {
  const result = state.radarAlert;
  els.radarAlertStatus.classList.remove('is-rain', 'is-warning', 'is-danger');

  if (!result) {
    els.radarAlertTitle.textContent = 'Verificando chuva próxima';
    els.radarAlertText.textContent = 'Aguardando o último frame do radar para analisar esta localização.';
    return;
  }
  if (!result.available) {
    els.radarAlertTitle.textContent = 'Leitura local indisponível';
    els.radarAlertText.textContent = 'O navegador não permitiu analisar os pixels do tile; o mapa continua disponível normalmente.';
    return;
  }
  if (result.detected) {
    els.radarAlertStatus.classList.add(result.level === 'forte' ? 'is-danger' : 'is-rain');
    els.radarAlertTitle.textContent = `Chuva ${result.level} detectada próxima`;
    els.radarAlertText.textContent = `O mosaico identificou precipitação em aproximadamente ${result.coverage}% da área analisada ao redor de ${state.location.name}.`;
  } else {
    els.radarAlertTitle.textContent = 'Sem chuva detectada próxima';
    els.radarAlertText.textContent = `Nenhuma precipitação foi identificada na área analisada ao redor de ${state.location.name}.`;
  }
};

const renderOfficialAlerts = () => {
  els.officialAlertsList.replaceChildren();
  els.officialAlertStatus.classList.remove('is-warning', 'is-danger');
  renderOfficialAlertPolygons();

  if (state.officialAlertsStatus === 'loading') {
    els.officialAlertTitle.textContent = 'Consultando o INMET';
    els.officialAlertText.textContent = 'Buscando avisos meteorológicos ativos e futuros.';
    return;
  }
  if (state.officialAlertsStatus === 'error') {
    els.officialAlertTitle.textContent = 'Avisos oficiais indisponíveis';
    els.officialAlertText.textContent = 'O endpoint do INMET não respondeu diretamente no navegador. Consulte a fonte oficial abaixo.';
    return;
  }

  const relevantAlerts = state.officialAlerts
    .filter(alertAppliesToLocation)
    .sort((first, second) => ({ danger: 0, warning: 1, notice: 2 }[first.severity] - ({ danger: 0, warning: 1, notice: 2 }[second.severity])));
  if (relevantAlerts.length) {
    const mostSevere = relevantAlerts[0].severity;
    els.officialAlertStatus.classList.add(mostSevere === 'danger' ? 'is-danger' : 'is-warning');
    els.officialAlertTitle.textContent = `${relevantAlerts.length} aviso${relevantAlerts.length > 1 ? 's' : ''} atingindo a localização`;
    els.officialAlertText.textContent = 'Há avisos meteorológicos oficiais do INMET sobre a área monitorada.';
  } else {
    els.officialAlertTitle.textContent = 'Nenhum aviso oficial local';
    els.officialAlertText.textContent = state.officialAlerts.length
      ? `${state.officialAlerts.length} aviso${state.officialAlerts.length > 1 ? 's' : ''} ativo${state.officialAlerts.length > 1 ? 's' : ''} em outras áreas do Brasil.`
      : 'Nenhum aviso meteorológico ativo foi encontrado no Brasil.';
  }

  relevantAlerts.slice(0, 5).forEach((alert) => {
    const item = document.createElement('article');
    item.className = 'official-alert';
    const badge = appendText(item, 'span', `official-alert-badge${alert.severity === 'danger' ? ' is-danger' : ''}`, severityLabel(alert.severity));
    badge.setAttribute('aria-label', `Severidade: ${severityLabel(alert.severity)}`);
    const content = document.createElement('div');
    appendText(content, 'h3', '', alert.title);
    appendText(content, 'p', '', `Válido de ${formatAlertDate(alert.start)} até ${formatAlertDate(alert.end)}`);
    item.appendChild(content);
    const link = document.createElement('a');
    link.href = alert.sourceUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Detalhes ↗';
    item.appendChild(link);
    els.officialAlertsList.appendChild(item);
  });
};

const notifyBrowser = (key, title, body) => {
  if (!state.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted' || state.notifiedKeys.has(key)) return;
  state.notifiedKeys.add(key);
  try {
    new Notification(title, { body, tag: key });
  } catch (error) {
    console.warn('Notificação não disponível', error);
  }
};

const checkRadarForLocation = async () => {
  const frame = state.frames[state.frames.length - 1];
  if (!frame) return;
  const locationSnapshot = `${state.location.name}:${state.location.coordinates.join(',')}:${frame.time}`;
  els.radarAlertTitle.textContent = 'Analisando o radar próximo';
  els.radarAlertText.textContent = `Lendo o último frame ao redor de ${state.location.name}.`;
  const result = await sampleRadarAtLocation(frame, state.location.coordinates);
  if (locationSnapshot !== `${state.location.name}:${state.location.coordinates.join(',')}:${frame.time}`) return;
  state.radarAlert = result;
  renderRadarAlert();
  if (result.available && result.detected) {
    notifyBrowser(`radar-${state.location.name}-${frame.time}`, `Chuva ${result.level} próxima`, `Precipitação detectada ao redor de ${state.location.name}.`);
  }
};

const loadOfficialAlerts = async () => {
  state.officialAlertsStatus = 'loading';
  renderOfficialAlerts();
  try {
    const response = await fetch(`${CONFIG.officialAlertsUrl}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`INMET respondeu ${response.status}`);
    const payload = await response.json();
    const rawAlerts = [
      ...(Array.isArray(payload?.hoje) ? payload.hoje : []),
      ...(Array.isArray(payload?.futuro) ? payload.futuro : []),
    ];
    const uniqueAlerts = [...new Map(rawAlerts.map((alert, index) => {
      const normalized = normalizeAlert(alert, index);
      return [normalized.id, normalized];
    })).values()];
    state.officialAlerts = uniqueAlerts;
    state.officialAlertsStatus = 'ready';
    state.officialAlertsUpdatedAt = new Date();
    renderOfficialAlerts();

    uniqueAlerts.filter(alertAppliesToLocation).forEach((alert) => {
      notifyBrowser(`inmet-${alert.id}`, `Aviso do INMET: ${alert.title}`, `Há um aviso ${severityLabel(alert.severity).toLowerCase()} para ${state.location.name}.`);
    });
  } catch (error) {
    console.warn('Avisos do INMET indisponíveis no navegador', error);
    state.officialAlertsStatus = 'error';
    renderOfficialAlerts();
  }
  els.alertsUpdated.textContent = state.officialAlertsUpdatedAt
    ? `Avisos atualizados às ${formatTime(Math.floor(state.officialAlertsUpdatedAt.getTime() / 1000))}`
    : 'Atualização automática a cada 5 min';
};

const runLocationMonitoring = async () => {
  renderOfficialAlerts();
  await checkRadarForLocation();
  renderOfficialAlerts();
};

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
    void loadOfficialAlerts();
    void runLocationMonitoring();
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

const updateNotificationButton = () => {
  const label = els.notificationButton.querySelector('span');
  if (!('Notification' in window)) {
    label.textContent = 'Não disponível';
    els.notificationButton.disabled = true;
    return;
  }
  if (state.notificationsEnabled && Notification.permission === 'granted') {
    label.textContent = 'Notificações ativas';
    els.notificationButton.classList.add('is-active');
  } else if (Notification.permission === 'denied') {
    label.textContent = 'Notificações bloqueadas';
    els.notificationButton.classList.remove('is-active');
  }
};

const enableNotifications = async () => {
  if (!('Notification' in window)) {
    showToast('Este navegador não oferece notificações');
    return;
  }
  if (!window.isSecureContext) {
    showToast('Notificações exigem HTTPS, como no GitHub Pages');
    return;
  }
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission === 'granted') {
    state.notificationsEnabled = true;
    updateNotificationButton();
    showToast('Notificações de alertas ativadas');
    void runLocationMonitoring();
  } else {
    updateNotificationButton();
    showToast('Permissão de notificações não concedida');
  }
};

const requestUserLocation = () => {
  if (!navigator.geolocation) {
    showToast('Geolocalização não disponível neste navegador');
    return;
  }

  const label = els.locationButton.querySelector('span');
  els.locationButton.disabled = true;
  label.textContent = 'Localizando…';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      setMonitoredLocation({
        kind: 'current',
        name: 'Minha localização',
        coordinates: [coords.latitude, coords.longitude],
      }, { moveMap: true });
      label.textContent = 'Minha localização';
      els.locationButton.disabled = false;
      showToast('Monitorando sua localização atual');
    },
    (error) => {
      console.warn('Não foi possível obter a localização', error);
      label.textContent = 'Minha localização';
      els.locationButton.disabled = false;
      showToast('Não foi possível acessar sua localização');
    },
    { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 12 * 1000 },
  );
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
els.recenterButton.addEventListener('click', () => {
  selectCapital(CAPITALS.find(({ code }) => code === 'RJ'), { moveMap: true });
});
els.locationButton.addEventListener('click', requestUserLocation);
els.notificationButton.addEventListener('click', enableNotifications);

const updateClock = () => {
  els.footerClock.textContent = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
};

updateClock();
updateNotificationButton();
window.setInterval(updateClock, 30 * 1000);
window.setInterval(() => loadRadar(), CONFIG.refreshMs);
void loadOfficialAlerts();
loadRadar();
