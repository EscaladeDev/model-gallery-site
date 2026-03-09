import * as THREE from 'https://esm.sh/three@0.160.0';
import { STLLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/STLLoader.js';

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
  featuredDownloadLink: document.getElementById('featured-download-link'),
  featuredSourceLink: document.getElementById('featured-source-link'),
  featuredViewer: document.getElementById('featured-viewer'),
  featuredLoading: document.getElementById('featured-loading'),
};

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function computePopularTags(models, limit = 8) {
  const counts = new Map();
  for (const model of models) {
    for (const tag of model.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
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
  const haystack = [model.title, model.filename, ...(model.tags || []), model.description || '']
    .join(' ')
    .toLowerCase();
  const matchesSearch = !query || haystack.includes(query);
  const matchesFormat = state.format === 'all' || normalizeText(model.format) === state.format;
  const matchesTag = !state.activeTag || (model.tags || []).includes(state.activeTag);
  return matchesSearch && matchesFormat && matchesTag;
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
  const format = normalizeText(model.format);
  if (model.thumbnail) return 'Thumbnail';
  if (format === 'stl') return 'Live Preview';
  return 'Placeholder';
}

function createCard(model) {
  const article = document.createElement('article');
  article.className = 'card';
  article.id = `model-${model.slug}`;
  const tagsHtml = (model.tags || []).map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('');
  const isPreviewable = normalizeText(model.format) === 'stl';
  const previewInner = isPreviewable
    ? `<div class="card-viewer" data-model-url="${escapeAttribute(model.downloadUrl)}" data-slug="${escapeAttribute(model.slug)}"></div><div class="viewer-status small">Loading preview…</div>`
    : `<div class="card-preview-placeholder"></div><div class="viewer-status small">Preview unavailable</div>`;

  article.innerHTML = `
    <div class="card-preview">
      <span class="badge card-badge">${escapeHtml(getPreviewMode(model))}</span>
      ${previewInner}
    </div>
    <div class="card-body">
      <div class="card-title-row">
        <h3>${escapeHtml(model.title)}</h3>
        <span class="card-meta">${escapeHtml((model.format || '').toUpperCase())}</span>
      </div>
      <p class="card-text">${escapeHtml(model.description || 'No description yet.')}</p>
      <div class="card-tags">${tagsHtml}</div>
      <div class="card-actions">
        <a class="button button-primary js-download" href="${escapeAttribute(model.downloadUrl)}" data-filename="${escapeAttribute(model.filename || "model")}" target="_blank" rel="noreferrer">Download</a>
        <a class="button" href="${escapeAttribute(model.sourceUrl || model.downloadUrl)}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </div>
  `;
  return article;
}

function renderGallery(models) {
  els.galleryGrid.innerHTML = '';
  if (!models.length) {
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');
  for (const model of models) {
    els.galleryGrid.appendChild(createCard(model));
  }
  els.galleryGrid.querySelectorAll('.js-download').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      triggerDownload(link.href, link.dataset.filename || 'model');
    });
  });
  mountGalleryViewers();
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
  const featuredModel = models.find((model) => model.slug === featuredConfig.slug) || models[0];
  if (!featuredModel) return;
  els.featuredBadge.textContent = featuredConfig.headline || 'Featured Model';
  els.featuredTitle.textContent = featuredConfig.titleOverride || featuredModel.title;
  els.featuredBlurb.textContent = featuredConfig.blurb || featuredModel.description || 'Featured model.';
  els.featuredDownloadLink.href = featuredModel.downloadUrl;
  els.featuredDownloadLink.addEventListener('click', (event) => {
    event.preventDefault();
    triggerDownload(featuredModel.downloadUrl, featuredModel.filename || 'model.stl');
  }, { once: true });
  els.featuredSourceLink.href = featuredModel.sourceUrl || featuredModel.downloadUrl;
  els.featuredTags.innerHTML = '';
  for (const tag of (featuredModel.tags || []).slice(0, 4)) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    els.featuredTags.appendChild(span);
  }
  mountStlViewer(els.featuredViewer, featuredModel.downloadUrl, els.featuredLoading);
}


function triggerDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || '';
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function mountGalleryViewers() {
  const viewers = document.querySelectorAll('.card-viewer[data-model-url]');
  viewers.forEach((node) => {
    const loading = node.nextElementSibling;
    mountStlViewer(node, node.dataset.modelUrl, loading);
  });
}

function mountStlViewer(container, url, statusEl) {
  if (!container || !url || container.dataset.mounted === 'true') return;
  container.dataset.mounted = 'true';

  const width = Math.max(container.clientWidth || 280, 180);
  const height = Math.max(container.clientHeight || 280, 180);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141b29);

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x223355, 1.7);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(1.5, 2.5, 3);
  scene.add(dir);

  const loader = new STLLoader();
  loader.load(
    url,
    (geometry) => {
      geometry.computeVertexNormals();
      geometry.center();
      const material = new THREE.MeshStandardMaterial({
        color: 0xc9d5ff,
        metalness: 0.1,
        roughness: 0.7,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      camera.position.set(maxDim * 1.15, maxDim * 0.8, maxDim * 1.4);
      camera.lookAt(0, 0, 0);

      if (statusEl) {
        statusEl.textContent = 'Drag-free auto preview';
        statusEl.classList.add('is-ready');
      }

      const animate = () => {
        mesh.rotation.y += 0.01;
        renderer.render(scene, camera);
        container._raf = requestAnimationFrame(animate);
      };
      animate();
    },
    undefined,
    (error) => {
      console.error('Preview failed for', url, error);
      if (statusEl) {
        statusEl.textContent = 'Preview failed';
      }
    }
  );
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
    });
    els.formatSelect.addEventListener('change', (event) => {
      state.format = event.target.value;
      applyFilters();
    });
    els.sortSelect.addEventListener('change', (event) => {
      state.sort = event.target.value;
      applyFilters();
    });
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
