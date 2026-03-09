import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/STLLoader.js';

const state = {
  models: [],
  filteredModels: [],
  featured: null,
  activeTag: null,
  search: "",
  format: "all",
  sort: "featured",
};

const els = {
  galleryGrid: document.getElementById("gallery-grid"),
  emptyState: document.getElementById("empty-state"),
  popularTags: document.getElementById("popular-tags"),
  gallerySearch: document.getElementById("gallery-search"),
  heroSearch: document.getElementById("hero-search"),
  heroSearchButton: document.getElementById("hero-search-button"),
  formatSelect: document.getElementById("format-select"),
  sortSelect: document.getElementById("sort-select"),
  featuredBadge: document.getElementById("featured-badge"),
  featuredTitle: document.getElementById("featured-title"),
  featuredBlurb: document.getElementById("featured-blurb"),
  featuredTags: document.getElementById("featured-tags"),
  featuredViewLink: document.getElementById("featured-view-link"),
  featuredDownloadLink: document.getElementById("featured-download-link"),
  featuredPreview: document.getElementById("featured-preview"),
};

const previewObservers = new WeakMap();
const activePreviewCleanup = new WeakMap();

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeThumbnail(value) {
  const v = String(value || "").trim();
  if (!v || v === "/thumbnails/" || v === "thumbnails/") return "";
  return v;
}

function computePopularTags(models, limit = 8) {
  const counts = new Map();
  for (const model of models) {
    for (const tag of model.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([tag]) => tag);
}

function renderPopularTags(models) {
  const tags = computePopularTags(models);
  els.popularTags.innerHTML = "";
  for (const tag of tags) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${state.activeTag === tag ? " active" : ""}`;
    button.textContent = tag;
    button.addEventListener("click", () => {
      state.activeTag = state.activeTag === tag ? null : tag;
      applyFilters();
    });
    els.popularTags.appendChild(button);
  }
}

function getPreviewMode(model) {
  if (normalizeThumbnail(model.thumbnail)) return "Thumbnail";
  if ((model.format || '').toLowerCase() === 'stl') return "Preview";
  return "Placeholder";
}

function sortModels(models) {
  const items = [...models];
  if (state.sort === "newest") {
    items.sort((a, b) => new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime());
    return items;
  }
  if (state.sort === "az") {
    items.sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }
  items.sort((a, b) => {
    const diff = (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    if (diff) return diff;
    return new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime();
  });
  return items;
}

function modelMatches(model) {
  const query = normalizeText(state.search);
  const haystack = [model.title, model.filename, ...(model.tags || []), model.description || ""].join(" ").toLowerCase();
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createCard(model) {
  const article = document.createElement("article");
  article.className = "card";
  article.id = `model-${model.slug}`;
  const thumbnail = normalizeThumbnail(model.thumbnail);
  const tagsHtml = (model.tags || []).map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`).join("");
  const previewContent = thumbnail
    ? `<img src="${thumbnail}" alt="${escapeHtml(model.title)} preview" loading="lazy" />`
    : `<div class="card-preview-placeholder"></div>`;

  article.innerHTML = `
    <div class="card-preview" data-model-format="${escapeHtml(model.format || '')}" data-model-url="${escapeHtml(model.previewUrl || model.downloadUrl || '')}">
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
        <a class="button button-primary" href="${escapeHtml(model.downloadUrl || model.previewUrl || '#')}" target="_blank" rel="noreferrer">Download</a>
        <a class="button" href="${escapeHtml(model.sourceUrl || model.downloadUrl || '#')}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </div>
  `;
  return article;
}

function renderGallery(models) {
  for (const cleanup of activePreviewCleanup.values?.() || []) cleanup?.();
  els.galleryGrid.innerHTML = "";
  if (!models.length) {
    els.emptyState.classList.remove("hidden");
    return;
  }
  els.emptyState.classList.add("hidden");
  for (const model of models) els.galleryGrid.appendChild(createCard(model));
  setupVisiblePreviews();
}

function renderFeatured(featuredConfig, models) {
  const featuredModel = models.find((model) => model.slug === featuredConfig?.slug) || models.find((m) => m.featured) || models[0];
  if (!featuredModel) return;
  els.featuredBadge.textContent = featuredConfig?.headline || 'Featured Model';
  els.featuredTitle.textContent = featuredConfig?.titleOverride || featuredModel.title;
  els.featuredBlurb.textContent = featuredConfig?.blurb || featuredModel.description || 'Featured model.';
  els.featuredDownloadLink.href = featuredModel.downloadUrl || '#';
  els.featuredViewLink.onclick = (e) => {
    e.preventDefault();
    document.getElementById(`model-${featuredModel.slug}`)?.scrollIntoView({behavior:'smooth', block:'center'});
  };
  els.featuredTags.innerHTML = '';
  for (const tag of (featuredModel.tags || []).slice(0, 4)) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    els.featuredTags.appendChild(span);
  }
  if ((featuredModel.format || '').toLowerCase() === 'stl' && featuredModel.previewUrl) {
    mountStlPreview(els.featuredPreview, featuredModel.previewUrl, true);
  }
}

function setupVisiblePreviews() {
  const previews = document.querySelectorAll('.card-preview[data-model-format="stl"]');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      observer.unobserve(el);
      const url = el.dataset.modelUrl;
      if (url) mountStlPreview(el, url, false);
    }
  }, { rootMargin: '200px 0px' });

  previews.forEach((el) => observer.observe(el));
}

function mountStlPreview(container, url, isLarge) {
  container.innerHTML = '';
  container.classList.add('is-rendering');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth || 300, container.clientHeight || 300);
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 1.8);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 1.5);
  dir.position.set(4, 7, 6);
  scene.add(dir);

  const material = new THREE.MeshStandardMaterial({ color: 0xc9d5ff, metalness: 0.12, roughness: 0.72 });
  const loader = new STLLoader();

  let mesh;
  let frame = 0;
  let disposed = false;

  const cleanup = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    renderer.dispose();
    mesh?.geometry?.dispose?.();
    material.dispose();
    container.innerHTML = '<div class="card-preview-placeholder"></div>';
  };
  activePreviewCleanup.set(container, cleanup);

  loader.load(url, (geometry) => {
    if (disposed) return;
    geometry.computeVertexNormals();
    mesh = new THREE.Mesh(geometry, material);
    geometry.center();
    scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    camera.position.set(size * 0.45, size * 0.28, size * (isLarge ? 0.65 : 0.8));
    camera.lookAt(0, 0, 0);

    const animate = () => {
      if (disposed) return;
      if (mesh) mesh.rotation.y += isLarge ? 0.008 : 0.01;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
  }, undefined, () => {
    container.classList.remove('is-rendering');
    container.innerHTML = '<div class="card-preview-placeholder"></div>';
  });

  const resizeObserver = new ResizeObserver(() => {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);
}

async function init() {
  try {
    const [manifest, featured] = await Promise.all([
      fetchJson('./data/manifest.json'),
      fetchJson('./data/featured.json').catch(() => ({})),
    ]);

    state.models = Array.isArray(manifest.models) ? manifest.models.map((m) => ({
      ...m,
      thumbnail: normalizeThumbnail(m.thumbnail),
    })) : [];
    state.featured = featured;

    renderFeatured(featured, state.models);
    applyFilters();

    els.gallerySearch.addEventListener('input', (event) => handleSearchInput(event.target.value));
    els.heroSearch.addEventListener('input', (event) => handleSearchInput(event.target.value));
    els.heroSearchButton.addEventListener('click', () => document.getElementById('browse').scrollIntoView({ behavior: 'smooth' }));
    els.formatSelect.addEventListener('change', (event) => { state.format = event.target.value; applyFilters(); });
    els.sortSelect.addEventListener('change', (event) => { state.sort = event.target.value; applyFilters(); });
  } catch (error) {
    console.error(error);
    els.galleryGrid.innerHTML = `<div class="empty-state"><h3>Failed to load catalog</h3><p>Check that <code>data/manifest.json</code> and <code>data/featured.json</code> exist and are valid.</p></div>`;
  }
}

init();
