import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { STLLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/STLLoader.js';

const state = {
  models: [],
  filteredModels: [],
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
  featuredPreview: document.getElementById('featured-preview'),
  featuredDownloadLink: document.getElementById('featured-download-link'),
  featuredSourceLink: document.getElementById('featured-source-link'),
};

const activeViewers = new Set();
const loader = new STLLoader();

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

function renderPopularTags(models) {
  els.popularTags.innerHTML = '';
  for (const tag of computePopularTags(models)) {
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
    const featuredDiff = (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    if (featuredDiff) return featuredDiff;
    return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
  });
  return items;
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

function cleanupViewers() {
  for (const destroy of activeViewers) destroy();
  activeViewers.clear();
}

function showFallbackPreview(container, label = 'Preview unavailable') {
  container.innerHTML = '<div class="card-preview-placeholder"></div>';
  const pill = document.createElement('div');
  pill.className = 'preview-placeholder-label';
  pill.textContent = label;
  container.appendChild(pill);
}

async function mountStlPreview(container, url) {
  container.innerHTML = '';
  const shell = document.createElement('div');
  shell.className = 'viewer-shell';
  shell.style.width = '100%';
  shell.style.height = '100%';
  container.appendChild(shell);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  shell.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 1.2);
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(3, 5, 6);
  scene.add(hemi, dir);

  let mesh;
  try {
    const geometry = await loader.loadAsync(url);
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: 0xdbe4ff, metalness: 0.12, roughness: 0.72 });
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const box = geometry.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    mesh.position.sub(center);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    camera.position.set(maxDim * 1.4, maxDim * 0.9, maxDim * 1.6);
    camera.lookAt(0, 0, 0);

    const resize = () => {
      const width = shell.clientWidth || 320;
      const height = shell.clientHeight || 320;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(shell);

    let frameId = 0;
    const animate = () => {
      if (mesh) mesh.rotation.y += 0.008;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const destroy = () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      shell.remove();
    };
    activeViewers.add(destroy);
  } catch (error) {
    console.error('STL preview failed:', url, error);
    renderer.dispose();
    shell.remove();
    showFallbackPreview(container);
  }
}

function previewLabelFor(model) {
  if (model.thumbnail) return 'Thumbnail';
  if (model.previewable && normalizeText(model.format) === 'stl') return 'Live Preview';
  return 'Placeholder';
}

function createCard(model) {
  const article = document.createElement('article');
  article.className = 'card';
  article.id = `model-${model.slug}`;
  const tagsHtml = (model.tags || []).map(tag => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('');

  article.innerHTML = `
    <div class="card-preview"><span class="badge card-badge">${escapeHtml(previewLabelFor(model))}</span></div>
    <div class="card-body">
      <div class="card-title-row">
        <h3>${escapeHtml(model.title)}</h3>
        <span class="card-meta">${escapeHtml((model.format || '').toUpperCase())}</span>
      </div>
      <p class="card-text">${escapeHtml(model.description || 'No description yet.')}</p>
      <div class="card-tags">${tagsHtml}</div>
      <div class="card-actions">
        <a class="button button-primary" href="${escapeHtml(model.downloadUrl)}" target="_blank" rel="noreferrer" download>Download</a>
        <a class="button" href="${escapeHtml(model.sourceUrl || model.downloadUrl)}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </div>
  `;

  const previewEl = article.querySelector('.card-preview');
  if (model.thumbnail) {
    const img = document.createElement('img');
    img.src = model.thumbnail;
    img.alt = `${model.title} preview`;
    previewEl.appendChild(img);
  } else if (model.previewable && normalizeText(model.format) === 'stl') {
    mountStlPreview(previewEl, model.downloadUrl);
  } else {
    showFallbackPreview(previewEl);
  }
  return article;
}

function renderGallery(models) {
  cleanupViewers();
  els.galleryGrid.innerHTML = '';
  if (!models.length) {
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');
  for (const model of models) {
    els.galleryGrid.appendChild(createCard(model));
  }
}

function renderFeatured(featuredConfig, models) {
  const fallback = models.find(m => m.featured) || models[0];
  const featuredModel = models.find(m => m.slug === featuredConfig?.slug) || fallback;
  if (!featuredModel) return;

  els.featuredBadge.textContent = featuredConfig?.headline || 'Featured';
  els.featuredTitle.textContent = featuredConfig?.titleOverride || featuredModel.title;
  els.featuredBlurb.textContent = featuredConfig?.blurb || featuredModel.description || 'Featured model.';
  els.featuredDownloadLink.href = featuredModel.downloadUrl;
  els.featuredDownloadLink.textContent = featuredConfig?.ctaLabel || 'Download';
  els.featuredSourceLink.href = featuredModel.sourceUrl || featuredModel.downloadUrl;

  els.featuredTags.innerHTML = '';
  for (const tag of (featuredModel.tags || []).slice(0, 4)) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    els.featuredTags.appendChild(span);
  }

  if (featuredModel.thumbnail) {
    els.featuredPreview.innerHTML = `<img src="${escapeHtml(featuredModel.thumbnail)}" alt="${escapeHtml(featuredModel.title)} preview" />`;
  } else if (featuredModel.previewable && normalizeText(featuredModel.format) === 'stl') {
    mountStlPreview(els.featuredPreview, featuredModel.downloadUrl);
  } else {
    showFallbackPreview(els.featuredPreview);
  }
}

async function init() {
  try {
    const [manifest, featured] = await Promise.all([
      fetchJson('./data/manifest.json'),
      fetchJson('./data/featured.json')
    ]);
    state.models = Array.isArray(manifest.models) ? manifest.models : [];
    renderFeatured(featured, state.models);
    applyFilters();

    els.gallerySearch.addEventListener('input', (e) => handleSearchInput(e.target.value));
    els.heroSearch.addEventListener('input', (e) => handleSearchInput(e.target.value));
    els.heroSearchButton.addEventListener('click', () => document.getElementById('browse').scrollIntoView({ behavior: 'smooth' }));
    els.formatSelect.addEventListener('change', (e) => { state.format = e.target.value; applyFilters(); });
    els.sortSelect.addEventListener('change', (e) => { state.sort = e.target.value; applyFilters(); });
  } catch (error) {
    console.error(error);
    els.galleryGrid.innerHTML = '<div class="empty-state"><h3>Failed to load catalog</h3><p>Check that data/manifest.json and data/featured.json exist and contain valid JSON.</p></div>';
  }
}

init();
