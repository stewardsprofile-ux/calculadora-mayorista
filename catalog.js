const IMAGE_ORIGIN = "https://eliteparfumscr.com/";
const state = { products: [], query: "", category: "Todos", brand: "", visible: 24 };

const $ = selector => document.querySelector(selector);
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const money = value => `₡${Math.round(Number(value) || 0).toLocaleString("es-CR").replace(/,/g, ".")}`;

function imageUrl(path) {
  if (/^https?:/i.test(path || "")) return path;
  return new URL(String(path || "").replace(/^\//, ""), IMAGE_ORIGIN).href;
}

function productCard(product) {
  const article = document.createElement("article");
  article.className = "product-card";

  const image = document.createElement("img");
  image.loading = "lazy";
  image.src = imageUrl(product.Image);
  image.alt = product.Title;
  image.onerror = () => { image.src = "assets/logo.png"; article.classList.add("image-missing"); };

  const copy = document.createElement("div");
  copy.className = "product-copy";
  const title = document.createElement("h3");
  title.textContent = product.Title;
  const brand = document.createElement("span");
  brand.textContent = product.marca || "Elite Parfums";
  copy.append(title, brand);

  const price = document.createElement("strong");
  price.className = "product-price";
  price.textContent = money(product.precio);

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
  $("#brandCount").textContent = brands.length;
}

async function start() {
  const response = await fetch("catalogo-mayorista.json");
  if (!response.ok) throw new Error("No se pudo cargar el catálogo");
  state.products = await response.json();
  $("#productCount").textContent = state.products.length.toLocaleString("es-CR");
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
  state.visible = 24;
  document.querySelectorAll("#categoryFilters button").forEach(item => item.classList.toggle("active", item === button));
  render();
});
$("#loadMore").addEventListener("click", () => { state.visible += 24; render(); });
$("#toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
window.addEventListener("scroll", () => $("#toTop").classList.toggle("visible", scrollY > 500));

start().catch(error => { console.error(error); $("#emptyState").hidden = false; $("#emptyState").textContent = "No fue posible cargar el catálogo."; });
