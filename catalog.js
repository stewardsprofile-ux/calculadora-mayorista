const state = { products: [], query: "", category: "Todos", categoryTouched: false, brand: "", visible: 24 };

const $ = selector => document.querySelector(selector);
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const money = value => value == null
  ? "Consultar precio"
  : `₡${Math.round(Number(value) || 0).toLocaleString("es-CR").replace(/,/g, ".")}`;

function imageUrl(path) {
  if (/^https?:/i.test(path || "")) return path;
  return new URL(String(path || "").replace(/^\//, ""), document.baseURI).href;
}

function whatsappUrl(product, absoluteImageUrl) {
  const message = `Hola, quiero cotizar este producto: ${product.Title} ${absoluteImageUrl}`;
  return `https://wa.me/50662104761?text=${encodeURIComponent(message)}`;
}

function openProductModal(product, absoluteImageUrl) {
  const modal = $("#productModal");
  $("#modalImage").src = absoluteImageUrl;
  $("#modalImage").alt = product.Title;
  $("#modalBrand").textContent = product.marca || "Elite Parfums";
  $("#modalTitle").textContent = product.Title;
  $("#modalAction").href = whatsappUrl(product, absoluteImageUrl);
  modal.showModal();
}

function productCard(product) {
  const article = document.createElement("article");
  article.className = "product-card";

  const image = document.createElement("img");
  image.loading = "lazy";
  image.src = imageUrl(product.Image);
  image.alt = product.Title;
  image.className = "product-image";
  image.tabIndex = 0;
  image.setAttribute("role", "button");
  image.setAttribute("aria-label", `Ampliar imagen de ${product.Title}`);
  image.onclick = () => openProductModal(product, image.src);
  image.onkeydown = event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProductModal(product, image.src);
    }
  };
  image.onerror = () => { image.src = "assets/logo.png"; article.classList.add("image-missing"); };

  const copy = document.createElement("div");
  copy.className = "product-copy";
  const title = document.createElement("h3");
  title.textContent = product.Title;
  const brand = document.createElement("span");
  brand.textContent = product.marca || "Elite Parfums";
  copy.append(title, brand);

  const price = document.createElement("a");
  price.className = "product-price";
  price.textContent = money(product.precio);
  price.classList.toggle("price-pending", product.precio == null);
  price.href = whatsappUrl(product, image.src);
  price.target = "_blank";
  price.rel = "noopener noreferrer";
  price.style.textDecoration = "none";
  price.setAttribute("aria-label", `Pedir ${product.Title} por WhatsApp`);

  article.append(image, copy, price);
  return article;
}

function filteredProducts() {
  const query = normalize(state.query);
  return state.products.filter(product => {
    const searchable = normalize(`${product.Title} ${product.marca}`);
    const category = normalize(`${product.categoria} ${product.tipo} ${product.Title}`);
    return (!query || searchable.includes(query)) &&
      (state.category === "Todos" || category.includes(normalize(state.category))) &&
      (!state.brand || product.marca === state.brand);
  });
}

function paint(container, products) {
  container.replaceChildren(...products.map(productCard));
}

function render() {
  const filtered = filteredProducts();
  const visible = filtered.slice(0, state.visible);
  $("#featuredSection").hidden = Boolean(state.brand) || state.categoryTouched;
  paint($("#catalogGrid"), visible);
  $("#emptyState").hidden = filtered.length > 0;
  $("#loadMore").hidden = visible.length >= filtered.length;
  $("#resultsTitle").childNodes[1].textContent = state.query || state.category !== "Todos" || state.brand ? "Resultados" : "Catálogo mayorista";
}

function renderBrands() {
  const brands = [...new Set(state.products.map(product => product.marca).filter(brand => brand && brand !== "Otros"))]
    .sort((a, b) => a.localeCompare(b, "es"));
  const selected = ["Todas", ...brands.slice(0, 18)];
  $("#brandFilters").replaceChildren(...selected.map(brand => {
    const button = document.createElement("button");
    button.textContent = brand;
    button.classList.toggle("active", (brand === "Todas" && !state.brand) || brand === state.brand);
    button.onclick = () => { state.brand = brand === "Todas" ? "" : brand; state.visible = 24; renderBrands(); render(); };
    return button;
  }));
}

async function start() {
  const response = await fetch("catalogo-mayorista.json");
  if (!response.ok) throw new Error("No se pudo cargar el catálogo");
  state.products = await response.json();
  paint($("#featuredGrid"), state.products.slice(0, 8));
  renderBrands();
  render();
}

$("#searchForm").addEventListener("submit", event => { event.preventDefault(); state.query = $("#search").value.trim(); state.visible = 24; render(); $("#resultsTitle").scrollIntoView({ behavior: "smooth" }); });
$("#search").addEventListener("input", event => { state.query = event.target.value.trim(); state.visible = 24; render(); });
$("#categoryFilters").addEventListener("click", event => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  state.category = button.dataset.filter;
  state.categoryTouched = true;
  state.visible = 24;
  document.querySelectorAll("#categoryFilters button").forEach(item => item.classList.toggle("active", item === button));
  render();
});
$("#loadMore").addEventListener("click", () => { state.visible += 24; render(); });
$("#toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
$("#modalClose").addEventListener("click", () => $("#productModal").close());
$("#productModal").addEventListener("click", event => {
  if (event.target === $("#productModal")) $("#productModal").close();
});
window.addEventListener("scroll", () => $("#toTop").classList.toggle("visible", scrollY > 500));

start().catch(error => { console.error(error); $("#emptyState").hidden = false; $("#emptyState").textContent = "No fue posible cargar el catálogo."; });
