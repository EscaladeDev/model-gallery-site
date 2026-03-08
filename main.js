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
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(dateString) {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
  if (model.thumbnail) return "Thumbnail";
  if (model.previewable) return "Live Preview";
  return "Placeholder";
}

function createCard(model) {
  const article = document.createElement("article");
  article.className = "card";

  const tagsHtml = (model.tags || [])
    .map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`)
    .join("");

  const previewContent = model.thumbnail
    ? `<img src="${escapeAttribute(model.thumbnail)}" alt="${escapeAttribute(model.title)} preview" loading="lazy" />`
    : `<div class="card-preview-placeholder"></div>`;

  article.innerHTML = `
    <div class="card-preview">
      <span class="badge card-badge">${escapeHtml(getPreviewMode(model))}</span>
      ${previewContent}
    </div>
    <div class="card-body">
      <div class="card-title-row">
        <h3>${escapeHtml(model.title)}</h3>
        <span class="card-meta">${escapeHtml((model.format || "").toUpperCase())}</span>
      </div>
      <p class="card-text">${escapeHtml(model.description || "No description yet.")}</p>
      <div class="card-tags">${tagsHtml}</div>
      <div class="card-actions">
        <a class="button button-primary" href="${escapeAttribute(model.downloadUrl)}" target="_blank" rel="noreferrer">Download</a>
        <a class="button" href="${escapeAttribute(model.releaseUrl || model.downloadUrl)}" target="_blank" rel="noreferrer">Release</a>
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
    items.sort((a, b) => {
      const aTime = new Date(a.dateAdded || 0).getTime();
      const bTime = new Date(b.dateAdded || 0).getTime();
      return bTime - aTime;
    });
    return items;
  }

  if (state.sort === "az") {
    items.sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }

  items.sort((a, b) => {
    const aFeatured = a.featured ? 1 : 0;
    const bFeatured = b.featured ? 1 : 0;

    if (bFeatured !== aFeatured) return bFeatured - aFeatured;

    const aTime = new Date(a.dateAdded || 0).getTime();
    const bTime = new Date(b.dateAdded || 0).getTime();
    return bTime - aTime;
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
  ]
    .join(" ")
    .toLowerCase();

  const matchesSearch = !query || haystack.includes(query);
  const matchesFormat =
    state.format === "all" || normalizeText(model.format) === state.format;
  const matchesTag =
    !state.activeTag || (model.tags || []).includes(state.activeTag);

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

  els.featuredBadge.textContent = featuredConfig.headline || "Featured Model";
  els.featuredTitle.textContent = featuredConfig.titleOverride || featuredModel.title;
  els.featuredBlurb.textContent =
    featuredConfig.blurb || featuredModel.description || "Featured model.";

  els.featuredViewLink.href = featuredModel.downloadUrl;
  els.featuredDownloadLink.href = featuredModel.downloadUrl;

  els.featuredTags.innerHTML = "";
  const tags = featuredModel.tags || [];
  for (const tag of tags.slice(0, 4)) {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    els.featuredTags.appendChild(span);
  }
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

    els.gallerySearch.addEventListener("input", (event) => {
      handleSearchInput(event.target.value);
    });

    els.heroSearch.addEventListener("input", (event) => {
      handleSearchInput(event.target.value);
    });

    els.heroSearchButton.addEventListener("click", () => {
      document.getElementById("browse").scrollIntoView({ behavior: "smooth" });
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
  }
}

init();
