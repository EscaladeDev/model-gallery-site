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

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function hasUsableThumbnail(model) {
  const thumb = String(model?.thumbnail || "").trim();
  return Boolean(thumb) && thumb !== "/thumbnails/";
}

function isPreviewable(model) {
  if (typeof model.previewable === "boolean") return model.previewable;
  return ["stl", "glb", "gltf"].includes(normalizeText(model.format));
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
  els.popularTags.innerHTML = "";
  const tags = computePopularTags(models);

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
  if (hasUsableThumbnail(model)) return "Thumbnail";
  if (isPreviewable(model)) return "Preview";
  return "Placeholder";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function safeLink(url, fallback) {
  const value = String(url || "").trim();
  return value || fallback;
}

function createPreviewMarkup(model) {
  if (hasUsableThumbnail(model)) {
    return `<img src="${escapeAttribute(model.thumbnail)}" alt="${escapeAttribute(model.title)} preview" loading="lazy" />`;
  }

  return `<div class="card-preview-placeholder"></div>`;
}

function createCard(model) {
  const article = document.createElement("article");
  article.className = "card";
  article.id = `model-${model.slug}`;

  const tagsHtml = (model.tags || [])
    .map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`)
    .join("");

  const releaseUrl = safeLink(
    model.releaseUrl,
    "https://github.com/EscaladeDev/model-library-assets/releases"
  );
  const downloadUrl = safeLink(model.downloadUrl, releaseUrl);

  article.innerHTML = `
    <div class="card-preview">
      <span class="badge card-badge">${escapeHtml(getPreviewMode(model))}</span>
      ${createPreviewMarkup(model)}
    </div>
    <div class="card-body">
      <div class="card-title-row">
        <h3>${escapeHtml(model.title || model.slug || "Untitled Model")}</h3>
        <span class="card-meta">${escapeHtml((model.format || "").toUpperCase())}</span>
      </div>
      <p class="card-text">${escapeHtml(model.description || "No description yet.")}</p>
      <div class="card-tags">${tagsHtml}</div>
      <div class="card-actions">
        <a class="button button-primary" href="${escapeAttribute(downloadUrl)}" target="_blank" rel="noreferrer">Download</a>
        <a class="button" href="${escapeAttribute(releaseUrl)}" target="_blank" rel="noreferrer">Release</a>
      </div>
    </div>
  `;

  return article;
}

function renderGallery(models) {
  els.galleryGrid.innerHTML = "";

  if (!models.length) {
    els.emptyState.classList.remove("hidden");
    return;
  }

  els.emptyState.classList.add("hidden");

  for (const model of models) {
    els.galleryGrid.appendChild(createCard(model));
  }
}

function sortModels(models) {
  const items = [...models];

  if (state.sort === "newest") {
    items.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
    return items;
  }

  if (state.sort === "az") {
    items.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    return items;
  }

  items.sort((a, b) => {
    const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredDiff !== 0) return featuredDiff;
    return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
  });

  return items;
}

function modelMatches(model) {
  const query = normalizeText(state.search);
  const haystack = [
    model.title,
    model.filename,
    ...(model.tags || []),
    model.description || "",
  ].join(" ").toLowerCase();

  const matchesSearch = !query || haystack.includes(query);
  const matchesFormat = state.format === "all" || normalizeText(model.format) === state.format;
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

  const releaseUrl = safeLink(
    featuredModel.releaseUrl,
    "https://github.com/EscaladeDev/model-library-assets/releases"
  );
  const downloadUrl = safeLink(featuredModel.downloadUrl, releaseUrl);

  els.featuredBadge.textContent = featuredConfig.headline || "Featured Model";
  els.featuredTitle.textContent = featuredConfig.titleOverride || featuredModel.title || "Featured Model";
  els.featuredBlurb.textContent = featuredConfig.blurb || featuredModel.description || "Featured model.";
  els.featuredDownloadLink.href = downloadUrl;
  els.featuredDownloadLink.textContent = featuredConfig.ctaLabel || "Download";
  els.featuredViewLink.href = `#model-${featuredModel.slug}`;
  els.featuredViewLink.textContent = "Find in Library";

  if (hasUsableThumbnail(featuredModel)) {
    els.featuredPreview.innerHTML = `<img src="${escapeAttribute(featuredModel.thumbnail)}" alt="${escapeAttribute(featuredModel.title)} preview" loading="lazy" />`;
  } else {
    els.featuredPreview.innerHTML = `<div class="preview-wireframe"></div>`;
  }

  els.featuredTags.innerHTML = "";
  for (const tag of (featuredModel.tags || []).slice(0, 6)) {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    els.featuredTags.appendChild(span);
  }
}

async function init() {
  try {
    const [manifest, featured] = await Promise.all([
      fetchJson("./data/manifest.json"),
      fetchJson("./data/featured.json"),
    ]);

    state.models = Array.isArray(manifest.models) ? manifest.models : [];
    state.featured = featured;

    renderFeatured(featured, state.models);
    applyFilters();

    els.gallerySearch.addEventListener("input", (event) => handleSearchInput(event.target.value));
    els.heroSearch.addEventListener("input", (event) => handleSearchInput(event.target.value));
    els.heroSearchButton.addEventListener("click", () => {
      document.getElementById("browse").scrollIntoView({ behavior: "smooth" });
      els.gallerySearch.focus();
    });
    els.formatSelect.addEventListener("change", (event) => {
      state.format = event.target.value;
      applyFilters();
    });
    els.sortSelect.addEventListener("change", (event) => {
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
    els.emptyState.classList.add("hidden");
  }
}

init();
