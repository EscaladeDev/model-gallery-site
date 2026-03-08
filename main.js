
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/STLLoader.js';

const ASSET_REPO = 'EscaladeDev/model-library-assets';
const ASSET_BRANCH = 'main';

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

const stlLoader = new STLLoader();
const previewObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const host = entry.target;
    previewObserver.unobserve(host);
    const model = JSON.parse(host.dataset.model || '{}');
    renderStlPreview(host, model, host.classList.contains('spotlight-preview'));
  }
}, { rootMargin: '150px' });

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function deriveAssetPath(model) {
  if (model.assetPath) return model.assetPath.replace(/^\/+/, '');
  const format = normalizeText(model.format || '').replace(/[^a-z0-9]/g, '') || 'stl';
  return `assets/${format}/${model.filename}`;
}

function rawUrlForAssetPath(assetPath) {
  return `https://raw.githubusercontent.com/${ASSET_REPO}/${ASSET_BRANCH}/${assetPath}`;
}

function browserUrlForAssetPath(assetPath) {
  return `https://github.com/${ASSET_REPO}/blob/${ASSET_BRANCH}/${assetPath}`;
}

function getModelDownloadUrl(model) {
  if (model.downloadUrl && /^https?:\/\//.test(model.downloadUrl) && !/github\.com\/[^/]+\/assets\//.test(model.downloadUrl)) {
    return model.downloadUrl;
  }
  return rawUrlForAssetPath(deriveAssetPath(model));
}

function getModelBrowserUrl(model) {
  return model.browserUrl || browserUrlForAssetPath(deriveAssetPath(model));
}

function computePopularTags(models, limit = 8) {
  const counts = new Map();
  for (const model of models) {
    for (const tag of model.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([tag]) => tag);
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

function getPreviewMode(model) {
  const thumb = normalizeText(model.thumbnail);
  if (thumb && !thumb.endsWith('/')) return 'Thumbnail';
  if (normalizeText(model.format) === 'stl') return 'Live Preview';
  return 'Placeholder';
}

function createPreviewContent(model, uniqueId) {
  const thumb = normalizeText(model.thumbnail);
  if (thumb && !thumb.endsWith('/')) {
    return `<img src="${escapeAttribute(model.thumbnail)}" alt="${escapeAttribute(model.title)} preview" loading="lazy" />`;
  }
  if (normalizeText(model.format) === 'stl') {
    return `<div class="stl-preview-host" id="preview-${uniqueId}" data-model='${escapeAttribute(JSON.stringify(model))}'></div>`;
  }
  return `<div class="fallback-label">Preview unavailable</div>`;
}

function createCard(model, index) {
  const article = document.createElement('article');
  article.className = 'card';
  article.id = `model-${slugify(model.slug || model.title || index)}`;

  const tagsHtml = (model.tags || []).map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('');
  const downloadUrl = getModelDownloadUrl(model);
  const browserUrl = getModelBrowserUrl(model);
  const previewContent = createPreviewContent(model, `${index}-${slugify(model.slug || model.title)}`);

  article.innerHTML = `
    <div class="card-preview">
      <span class="badge card-badge">${escapeHtml(getPreviewMode(model))}</span>
      ${previewContent}
    </div>
    <div class="card-body">
      <div class="card-title-row">
        <h3>${escapeHtml(model.title)}</h3>
        <span class="card-meta">${escapeHtml((model.format || '').toUpperCase())}</span>
      </div>
      <p class="card-text">${escapeHtml(model.description || 'No description yet.')}</p>
      <div class="card-tags">${tagsHtml}</div>
      <div class="card-actions">
        <a class="button button-primary" href="${escapeAttribute(downloadUrl)}" target="_blank" rel="noreferrer">Download File</a>
        <a class="button" href="${escapeAttribute(browserUrl)}" target="_blank" rel="noreferrer">View Source</a>
      </div>
    </div>`;

  const host = article.querySelector('.stl-preview-host');
  if (host) previewObserver.observe(host);
  return article;
}

function renderGallery(models) {
  els.galleryGrid.innerHTML = '';
  if (!models.length) {
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');
  models.forEach((model, index) => els.galleryGrid.appendChild(createCard(model, index)));
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
    const aFeatured = a.featured ? 1 : 0;
    const bFeatured = b.featured ? 1 : 0;
    if (bFeatured !== aFeatured) return bFeatured - aFeatured;
    return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
  });
  return items;
}

function modelMatches(model) {
  const query = normalizeText(state.search);
  const haystack = [model.title, model.filename, ...(model.tags || []), model.description || ''].join(' ').toLowerCase();
  const matchesSearch = !query || haystack.includes(query);
  const matchesFormat = state.format === 'all' || normalizeText(model.format) === state.format;
  const matchesTag = !state.activeTag || (model.tags || []).includes(state.activeTag);
  return matchesSearch && matchesFormat && matchesTag;
}

function applyFilters() {
  state.filteredModels = sortModels(state.models.filter(modelMatches));
  renderPopularTags(state.models);
  renderGallery(state.filteredModels);
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

function renderFeatured(featuredConfig, models) {
  if (!featuredConfig) return;
  const featuredModel = models.find((model) => model.slug === featuredConfig.slug);
  if (!featuredModel) return;
  els.featuredBadge.textContent = featuredConfig.headline || 'Featured Model';
  els.featuredTitle.textContent = featuredConfig.titleOverride || featuredModel.title;
  els.featuredBlurb.textContent = featuredConfig.blurb || featuredModel.description || 'Featured model.';
  els.featuredViewLink.textContent = 'Find in Library';
  els.featuredViewLink.href = `#model-${slugify(featuredModel.slug || featuredModel.title)}`;
  els.featuredDownloadLink.textContent = featuredConfig.ctaLabel || 'Download File';
  els.featuredDownloadLink.href = getModelDownloadUrl(featuredModel);

  els.featuredTags.innerHTML = '';
  (featuredModel.tags || []).slice(0, 4).forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    els.featuredTags.appendChild(span);
  });

  if (normalizeText(featuredModel.format) === 'stl') {
    els.featuredPreview.innerHTML = `<div class="featured-preview-host spotlight-preview" data-model='${escapeAttribute(JSON.stringify(featuredModel))}'></div>`;
    const host = els.featuredPreview.firstElementChild;
    if (host) previewObserver.observe(host);
  } else {
    els.featuredPreview.innerHTML = '<div class="fallback-label">Preview unavailable</div>';
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) { return escapeHtml(value); }

function renderStlPreview(host, model, isLarge = false) {
  const url = getModelDownloadUrl(model);
  const rect = host.getBoundingClientRect();
  const width = Math.max(220, Math.floor(rect.width || (isLarge ? 360 : 280)));
  const height = Math.max(220, Math.floor(rect.height || (isLarge ? 320 : 280)));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.domElement.className = 'stl-preview-canvas';
  host.innerHTML = '';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 2000);
  scene.add(camera);

  const ambient = new THREE.AmbientLight(0xffffff, 1.8);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.3);
  rim.position.set(-3, 2, -4);
  scene.add(rim);

  const material = new THREE.MeshStandardMaterial({
    color: 0xd7def5,
    metalness: 0.08,
    roughness: 0.75,
  });

  stlLoader.load(url, (geometry) => {
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();
    geometry.center();

    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    const mesh = new THREE.Mesh(geometry, material);
    const scale = 100 / maxDim;
    mesh.scale.setScalar(scale);
    scene.add(mesh);

    camera.position.set(0, 18, 140);
    camera.lookAt(0, 0, 0);

    const animate = () => {
      mesh.rotation.y += 0.01;
      mesh.rotation.x = -0.25;
      renderer.render(scene, camera);
      host.__raf = requestAnimationFrame(animate);
    };
    animate();
  }, undefined, () => {
    host.innerHTML = '<div class="fallback-label">Could not load STL preview</div>';
  });
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
    els.galleryGrid.innerHTML = `<div class="empty-state"><h3>Failed to load catalog</h3><p>Check that <code>data/manifest.json</code> and <code>data/featured.json</code> exist and are valid.</p></div>`;
  }
}

init();
