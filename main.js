import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/STLLoader.js';

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
  featuredSourceLink: document.getElementById('featured-source-link'),
  featuredDownloadLink: document.getElementById('featured-download-link'),
  featuredPreview: document.querySelector('.js-featured-preview'),
};

const stlLoader = new STLLoader();

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function computePopularTags(models, limit = 8) {
  const counts = new Map();
  for (const model of models) {
    for (const tag of model.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,limit).map(([tag])=>tag);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function sortModels(models) {
  const items = [...models];
  if (state.sort === 'newest') return items.sort((a,b)=> new Date(b.dateAdded||0) - new Date(a.dateAdded||0));
  if (state.sort === 'az') return items.sort((a,b)=> a.title.localeCompare(b.title));
  return items.sort((a,b)=> (b.featured?1:0) - (a.featured?1:0) || new Date(b.dateAdded||0) - new Date(a.dateAdded||0));
}

function modelMatches(model) {
  const query = normalizeText(state.search);
  const haystack = [model.title, model.filename, ...(model.tags||[]), model.description||''].join(' ').toLowerCase();
  const matchesSearch = !query || haystack.includes(query);
  const matchesFormat = state.format === 'all' || normalizeText(model.format) === state.format;
  const matchesTag = !state.activeTag || (model.tags || []).includes(state.activeTag);
  return matchesSearch && matchesFormat && matchesTag;
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
  try {
    const response = await fetch(model.downloadUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = model.filename || `${model.slug}.${model.format || 'stl'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (err) {
    console.error(err);
    window.open(model.downloadUrl, '_blank', 'noopener,noreferrer');
  }
}

function mountStlPreview(container, model) {
  container.innerHTML = '<div class="preview-overlay">Loading preview...</div>';
  const overlay = container.firstElementChild;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 320;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101521);

  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 2000);
  camera.position.set(0, 0, 140);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.domElement.className = 'preview-canvas';
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 1.6);
  const dir1 = new THREE.DirectionalLight(0xffffff, 1.6);
  const dir2 = new THREE.DirectionalLight(0x88aaff, 0.9);
  dir1.position.set(1, 1, 2);
  dir2.position.set(-1, -0.5, 1.5);
  scene.add(ambient, dir1, dir2);

  stlLoader.load(model.downloadUrl, (geometry) => {
    geometry.computeVertexNormals();
    geometry.center();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    const material = new THREE.MeshStandardMaterial({
      color: 0xc7d2fe,
      metalness: 0.15,
      roughness: 0.7,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -0.5;
    mesh.rotation.y = 0.7;
    const scale = 70 / maxDim;
    mesh.scale.setScalar(scale);
    scene.add(mesh);

    camera.position.set(0, 0, 150);

    const animate = () => {
      mesh.rotation.z += 0.005;
      mesh.rotation.y += 0.0035;
      renderer.render(scene, camera);
      mesh.userData.raf = requestAnimationFrame(animate);
    };
    animate();
  }, undefined, (error) => {
    console.error('STL preview failed', error);
    container.innerHTML = '<div class="preview-overlay">Preview unavailable</div>';
  });
}

function createCard(model) {
  const article = document.createElement('article');
  article.className = 'card';
  article.id = `model-${model.slug}`;
  article.innerHTML = `
    <div class="card-preview js-model-preview"><span class="badge card-badge">${escapeHtml((model.format || '').toUpperCase() || 'FILE')}</span></div>
    <div class="card-body">
      <div class="card-title-row">
        <h3>${escapeHtml(model.title)}</h3>
        <span class="card-meta">${escapeHtml((model.format || '').toUpperCase())}</span>
      </div>
      <p class="card-text">${escapeHtml(model.description || 'No description yet.')}</p>
      <div class="card-tags">${(model.tags || []).map(tag => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="card-actions">
        <button class="button button-primary js-download-button" type="button">Download</button>
        <a class="button" href="${escapeHtml(model.sourceUrl || model.downloadUrl)}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </div>`;

  article.querySelector('.js-download-button').addEventListener('click', () => downloadModel(model));
  mountStlPreview(article.querySelector('.js-model-preview'), model);
  return article;
}

function renderGallery(models) {
  els.galleryGrid.innerHTML = '';
  if (!models.length) {
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');
  for (const model of models) els.galleryGrid.appendChild(createCard(model));
}

function applyFilters() {
  state.filteredModels = sortModels(state.models.filter(modelMatches));
  renderPopularTags(state.models);
  renderGallery(state.filteredModels);
}

function renderFeatured(featuredConfig, models) {
  const featuredModel = models.find(m => m.slug === featuredConfig?.slug) || models[0];
  if (!featuredModel) return;

  els.featuredBadge.textContent = featuredConfig?.headline || 'Featured Model';
  els.featuredTitle.textContent = featuredConfig?.titleOverride || featuredModel.title;
  els.featuredBlurb.textContent = featuredConfig?.blurb || featuredModel.description || 'Featured model.';
  els.featuredSourceLink.href = featuredModel.sourceUrl || featuredModel.downloadUrl;
  els.featuredDownloadLink.onclick = () => downloadModel(featuredModel);

  els.featuredTags.innerHTML = '';
  for (const tag of (featuredModel.tags || []).slice(0, 4)) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    els.featuredTags.appendChild(span);
  }

  mountStlPreview(els.featuredPreview, featuredModel);
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

    els.gallerySearch.addEventListener('input', e => handleSearchInput(e.target.value));
    els.heroSearch.addEventListener('input', e => handleSearchInput(e.target.value));
    els.heroSearchButton.addEventListener('click', () => document.getElementById('browse').scrollIntoView({ behavior: 'smooth' }));
    els.formatSelect.addEventListener('change', e => { state.format = e.target.value; applyFilters(); });
    els.sortSelect.addEventListener('change', e => { state.sort = e.target.value; applyFilters(); });
  } catch (error) {
    console.error(error);
    els.galleryGrid.innerHTML = '<div class="empty-state"><h3>Failed to load catalog</h3><p>Check that <code>data/manifest.json</code> and <code>data/featured.json</code> exist and are valid.</p></div>';
  }
}

init();
