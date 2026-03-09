import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/STLLoader.js';

const state = {
  models: [],
  filteredModels: [],
  featured: null,
  activeTag: null,
  search: '',
  format: 'all',
  sort: 'featured',
};

const els = {
  galleryGrid: document.getElementById('gallery-grid'),
  emptyState: document.getElementById('empty-state'),
  popularTags: document.getElementById('popular-tags'),
  gallerySearch: document.getElementById('gallery-search'),
  heroSearch: document.getElementById('hero-search'),
  heroSearchButton: document.getElementById('hero-search-button'),
  formatSelect: document.getElementById('format-select'),
  sortSelect: document.getElementById('sort-select'),
  featuredBadge: document.getElementById('featured-badge'),
  featuredTitle: document.getElementById('featured-title'),
  featuredBlurb: document.getElementById('featured-blurb'),
  featuredTags: document.getElementById('featured-tags'),
  featuredViewLink: document.getElementById('featured-view-link'),
  featuredDownloadLink: document.getElementById('featured-download-link'),
  featuredPreview: document.getElementById('featured-preview'),
};

const previewCleanup = new Map();

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isUsableThumbnail(value) {
  return typeof value === 'string' && value.trim() !== '' && !value.endsWith('/');
}

function getPreviewMode(model) {
  if (isUsableThumbnail(model.thumbnail)) return 'Thumbnail';
  if (model.previewable) return 'Live Preview';
  return 'Placeholder';
}

function computePopularTags(models, limit = 8) {
  const counts = new Map();
  for (const model of models) {
    for (const tag of model.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function renderPopularTags(models) {
  const tags = computePopularTags(models);
  els.popularTags.innerHTML = '';
  for (const tag of tags) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chip${state.activeTag === tag ? ' active' : ''}`;
    button.textContent = tag;
    button.addEventListener('click', () => {
      state.activeTag = state.activeTag === tag ? null : tag;
      applyFilters();
    });
    els.popularTags.appendChild(button);
  }
}

function modelMatches(model) {
  const query = normalizeText(state.search);
  const haystack = [model.title, model.filename, ...(model.tags || []), model.description || '']
    .join(' ')
    .toLowerCase();
  const matchesSearch = !query || haystack.includes(query);
  const matchesFormat = state.format === 'all' || normalizeText(model.format) === state.format;
  const matchesTag = !state.activeTag || (model.tags || []).includes(state.activeTag);
  return matchesSearch && matchesFormat && matchesTag;
}

function sortModels(models) {
  const items = [...models];
  if (state.sort === 'newest') {
    items.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
    return items;
  }
  if (state.sort === 'az') {
    items.sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }
  items.sort((a, b) => {
    const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredDiff) return featuredDiff;
    return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
  });
  return items;
}

function syncSearchInputs(value) {
  els.gallerySearch.value = value;
  els.heroSearch.value = value;
}

function handleSearchInput(value) {
  state.search = value;
  syncSearchInputs(value);
  applyFilters();
}

async function downloadModel(model) {
  const url = model.downloadUrl || model.sourceUrl;
  if (!url) return;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = model.filename || `${model.slug}.${model.format || 'stl'}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    console.error(error);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function createCard(model) {
  const article = document.createElement('article');
  article.className = 'card';
  article.id = `model-${model.slug}`;

  const tagsHtml = (model.tags || []).map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('');
  const previewMarkup = isUsableThumbnail(model.thumbnail)
    ? `<img src="${escapeHtml(model.thumbnail)}" alt="${escapeHtml(model.title)} preview" loading="lazy" />`
    : `<div class="card-preview-placeholder"></div>`;

  article.innerHTML = `
    <div class="card-preview" data-preview-host="${escapeHtml(model.slug)}">
      <span class="badge card-badge">${escapeHtml(getPreviewMode(model))}</span>
      ${previewMarkup}
    </div>
    <div class="card-body">
      <div class="card-title-row">
        <h3>${escapeHtml(model.title)}</h3>
        <span class="card-meta">${escapeHtml((model.format || '').toUpperCase())}</span>
      </div>
      <p class="card-text">${escapeHtml(model.description || 'No description yet.')}</p>
      <div class="card-tags">${tagsHtml}</div>
      <div class="card-actions">
        <button class="button button-primary" data-download-slug="${escapeHtml(model.slug)}" type="button">Download</button>
        <a class="button" href="${escapeHtml(model.sourceUrl || model.downloadUrl || '#')}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </div>
  `;

  article.querySelector('[data-download-slug]')?.addEventListener('click', () => downloadModel(model));
  return article;
}

function renderGallery(models) {
  for (const cleanup of previewCleanup.values()) cleanup?.();
  previewCleanup.clear();
  els.galleryGrid.innerHTML = '';
  if (!models.length) {
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');
  for (const model of models) els.galleryGrid.appendChild(createCard(model));
  mountVisiblePreviews();
}

function applyFilters() {
  state.filteredModels = sortModels(state.models.filter(modelMatches));
  renderPopularTags(state.models);
  renderGallery(state.filteredModels);
}

function renderFeatured(featuredConfig, models) {
  if (!featuredConfig) return;
  const featuredModel = models.find((model) => model.slug === featuredConfig.slug);
  if (!featuredModel) return;
  els.featuredBadge.textContent = featuredConfig.headline || 'Featured Model';
  els.featuredTitle.textContent = featuredConfig.titleOverride || featuredModel.title;
  els.featuredBlurb.textContent = featuredConfig.blurb || featuredModel.description || 'Featured model.';
  els.featuredTags.innerHTML = '';
  for (const tag of (featuredModel.tags || []).slice(0, 4)) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    els.featuredTags.appendChild(span);
  }
  els.featuredViewLink.onclick = () => {
    document.getElementById(`model-${featuredModel.slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  els.featuredDownloadLink.onclick = () => downloadModel(featuredModel);
  mountStlPreview(els.featuredPreview, featuredModel);
}

function mountVisiblePreviews() {
  const hosts = [...document.querySelectorAll('[data-preview-host]')];
  for (const host of hosts) {
    const slug = host.getAttribute('data-preview-host');
    const model = state.models.find((item) => item.slug === slug);
    if (!model || !model.previewable || normalizeText(model.format) !== 'stl') continue;
    mountStlPreview(host, model);
  }
}

function mountStlPreview(host, model) {
  if (!host || !model?.downloadUrl || normalizeText(model.format) !== 'stl') return;
  host.innerHTML = `<span class="badge card-badge">Live Preview</span><div class="preview-loading">Loading preview…</div>`;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, host.clientWidth / host.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x334466, 1.6);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 1.2);
  directional.position.set(2, 3, 4);
  scene.add(directional);

  const loader = new STLLoader();
  let animationId = null;
  let mesh = null;
  let disposed = false;

  loader.load(
    model.downloadUrl,
    (geometry) => {
      if (disposed) return;
      geometry.computeVertexNormals();
      geometry.center();
      geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      geometry.boundingBox?.getSize(size);
      const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);

      const material = new THREE.MeshStandardMaterial({ color: 0xc8d4ff, metalness: 0.1, roughness: 0.7 });
      mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);

      camera.position.set(maxDim * 1.8, maxDim * 1.2, maxDim * 1.8);
      camera.lookAt(0, 0, 0);

      host.querySelector('.preview-loading')?.remove();

      const animate = () => {
        if (disposed) return;
        if (mesh) mesh.rotation.z += 0.01;
        renderer.render(scene, camera);
        animationId = requestAnimationFrame(animate);
      };
      animate();
    },
    undefined,
    () => {
      host.innerHTML = `<div class="preview-fallback">Preview unavailable</div>`;
    }
  );

  function onResize() {
    if (disposed) return;
    const width = host.clientWidth || 300;
    const height = host.clientHeight || 300;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  window.addEventListener('resize', onResize);
  onResize();

  const cleanup = () => {
    disposed = true;
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    mesh?.geometry?.dispose?.();
    mesh?.material?.dispose?.();
  };

  previewCleanup.set(host, cleanup);
}

async function init() {
  try {
    const [manifest, featured] = await Promise.all([
      fetchJson('./data/manifest.json'),
      fetchJson('./data/featured.json'),
    ]);

    state.models = Array.isArray(manifest.models) ? manifest.models : [];
    state.featured = featured;
    renderFeatured(featured, state.models);
    applyFilters();

    els.gallerySearch.addEventListener('input', (event) => handleSearchInput(event.target.value));
    els.heroSearch.addEventListener('input', (event) => handleSearchInput(event.target.value));
    els.heroSearchButton.addEventListener('click', () => {
      document.getElementById('browse').scrollIntoView({ behavior: 'smooth' });
      els.gallerySearch.focus();
    });
    els.formatSelect.addEventListener('change', (event) => { state.format = event.target.value; applyFilters(); });
    els.sortSelect.addEventListener('change', (event) => { state.sort = event.target.value; applyFilters(); });
  } catch (error) {
    console.error(error);
    els.galleryGrid.innerHTML = `
      <div class="empty-state">
        <h3>Failed to load catalog</h3>
        <p>Check that <code>data/manifest.json</code> and <code>data/featured.json</code> exist and are valid.</p>
      </div>
    `;
  }
}

init();
