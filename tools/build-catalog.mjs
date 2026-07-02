import fs from "node:fs";
import path from "node:path";

const workspace = path.resolve(import.meta.dirname, "..");
const sourceRoot = "C:/Users/stewa/OneDrive/Escritorio/MayoristaEliteCostaRica";
const costs = JSON.parse(fs.readFileSync(path.join(workspace, "perfumes.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(sourceRoot, "perfumes.json"), "utf8"));

const stop = new Set(["DE", "DEL", "LA", "EL", "BY", "FOR", "THE", "PERFUME", "SPRAY"]);
const attributeTokens = new Set(["HOMBRE", "MUJER", "UNISEX", "EDP", "EDT", "EDC", "PARFUM", "EXTRAIT", "COLOGNE"]);

function normalize(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[-_]/g, " ")
    .replace(/\b\d{2,4}X\d{2,4}\b/g, " ")
    .replace(/\.(PNG|JPE?G|WEBP)$/g, "")
    .replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function imageName(image) {
  return normalize(path.basename(String(image || "")));
}

function tokens(value) {
  return normalize(value).split(" ").filter(token => token && !stop.has(token));
}

const brandTokens = new Set(catalog.flatMap(item => tokens(item.marca)).filter(token => token.length > 2));

function coreTokens(value) {
  return tokens(value).filter(token =>
    !attributeTokens.has(token) &&
    !brandTokens.has(token) &&
    !/^\d{1,4}ML$/.test(token) &&
    !/^\d{1,4}PZS?$/.test(token)
  );
}

function tokenScore(left, right) {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  let common = 0;
  for (const token of a) if (b.has(token)) common++;
  return a.size + b.size ? (2 * common) / (a.size + b.size) : 0;
}

function dice(left, right) {
  const a = normalize(left).replace(/ /g, "");
  const b = normalize(right).replace(/ /g, "");
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const pair = a.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const pair = b.slice(i, i + 2);
    const count = pairs.get(pair) || 0;
    if (count) { overlap++; pairs.set(pair, count - 1); }
  }
  return (2 * overlap) / (a.length + b.length - 2);
}

function volumes(value) {
  return [...normalize(value).matchAll(/\b(\d{1,4})\s*ML\b/g)].map(match => Number(match[1]));
}

function price(cost) {
  const value = typeof cost === "number" ? cost : Number(String(cost || "").replace(/[^\d]/g, ""));
  if (value < 25000) return value + 4000;
  if (value < 45000) return value + 5000;
  if (value <= 70000) return value + 6000;
  return Math.ceil((value * 1.10) / 1000) * 1000;
}

const indexedCosts = costs.map((item, index) => ({
  ...item,
  index,
  normalized: normalize(item.nombre),
  itemVolumes: volumes(item.nombre),
  tokenSet: new Set(tokens(item.nombre)),
  core: coreTokens(item.nombre).join(" ")
}));

const indexedCatalog = catalog.map(product => ({
  ...product,
  signatures: [normalize(product.Title), imageName(product.Image)].filter(Boolean),
  signatureTokenSets: [normalize(product.Title), imageName(product.Image)].filter(Boolean).map(value => new Set(tokens(value))),
  productVolumes: volumes(`${product.Title} ${imageName(product.Image)}`),
  productTokens: new Set(tokens(`${product.Title} ${imageName(product.Image)} ${product.marca || ""}`)),
  productBrandTokens: tokens(product.marca).filter(token => token.length > 2 && token !== "OTROS"),
  productGender: tokens(`${product.Title} ${imageName(product.Image)} ${product.categoria || ""}`).find(token => token === "HOMBRE" || token === "MUJER") || "",
  coreSignatures: [normalize(product.Title), imageName(product.Image)].filter(Boolean).map(value => coreTokens(value).join(" "))
}));

const tokenIndex = new Map();
for (const cost of indexedCosts) {
  for (const token of new Set(tokens(cost.nombre))) {
    if (token.length < 3) continue;
    if (!tokenIndex.has(token)) tokenIndex.set(token, []);
    tokenIndex.get(token).push(cost.index);
  }
}

function compare(product, cost) {
  if (product.signatures.includes(cost.normalized)) return 1;

  const volumeConflict = product.productVolumes.length && cost.itemVolumes.length &&
    !product.productVolumes.some(value => cost.itemVolumes.includes(value));
  const costGender = cost.tokenSet.has("HOMBRE") ? "HOMBRE" : cost.tokenSet.has("MUJER") ? "MUJER" : "";
  const genderConflict = product.productGender && costGender && product.productGender !== costGender;
  const brandConflict = product.productBrandTokens.length &&
    !product.productBrandTokens.some(token => cost.tokenSet.has(token));

  if (!volumeConflict && !genderConflict && !brandConflict && product.coreSignatures.includes(cost.core) && cost.core) return 0.985;

  let best = 0;
  for (let signatureIndex = 0; signatureIndex < product.signatures.length; signatureIndex++) {
    const signature = product.signatures[signatureIndex];
    const signatureTokens = product.signatureTokenSets[signatureIndex];
    let common = 0;
    for (const token of signatureTokens) if (cost.tokenSet.has(token)) common++;
    const token = signatureTokens.size + cost.tokenSet.size ?
      (2 * common) / (signatureTokens.size + cost.tokenSet.size) : 0;
    const contained = signature.includes(cost.normalized) || cost.normalized.includes(signature);
    best = Math.max(best, token * 0.88 + (contained ? 0.09 : 0));
  }

  for (const core of product.coreSignatures) {
    if (!core || !cost.core) continue;
    const left = new Set(core.split(" "));
    const right = new Set(cost.core.split(" "));
    const smaller = left.size <= right.size ? left : right;
    const larger = left.size <= right.size ? right : left;
    const subset = smaller.size >= 2 && [...smaller].every(token => larger.has(token));
    if (subset) best = Math.max(best, 0.89);
  }

  const brand = normalize(product.marca);
  if (brand && brand !== "OTROS" && cost.normalized.includes(brand)) best += 0.03;
  if (volumeConflict) best -= 0.28;
  if (genderConflict) best -= 0.24;
  if (brandConflict) best -= 0.30;
  return Math.max(0, Math.min(1, best));
}

const matches = indexedCatalog.map((product, catalogIndex) => {
  const productTokens = product.productTokens;
  const poolIndexes = new Set();
  for (const token of productTokens) {
    if (token.length < 3) continue;
    const indexes = tokenIndex.get(token) || [];
    if (indexes.length > 120) continue;
    for (const index of indexes) poolIndexes.add(index);
  }
  const pool = poolIndexes.size ? [...poolIndexes].map(index => indexedCosts[index]) : indexedCosts;
  const candidates = pool
    .map(cost => ({ cost, score: compare(product, cost) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const best = candidates[0];
  const gap = best.score - (candidates[1]?.score || 0);
  const status = best.score >= 0.86 && gap >= 0.035 ? "seguro" : best.score >= 0.70 ? "revisar" : "sin_match";
  return { product, catalogIndex, best, candidates, gap, status };
});

const accepted = matches.filter(match => match.status === "seguro");
const output = accepted.map(({ product, best }) => ({
  Title: best.cost.nombre,
  Image: product.Image,
  categoria: product.categoria || "Todos",
  tipo: product.tipo || product.categoria || "Todos",
  marca: product.marca || "Otros",
  precio: price(best.cost.costo)
}));

fs.writeFileSync(path.join(workspace, "catalogo-mayorista.json"), JSON.stringify(output, null, 2));

const report = matches.map(match => ({
  estado: match.status,
  puntaje: match.best.score.toFixed(4),
  diferencia: match.gap.toFixed(4),
  catalogo: match.product.Title,
  imagen: match.product.Image,
  calculadora: match.best.cost.nombre,
  costo: match.best.cost.costo,
  precio: price(match.best.cost.costo),
  alternativa_2: match.candidates[1]?.cost.nombre || "",
  puntaje_2: (match.candidates[1]?.score || 0).toFixed(4)
}));

fs.writeFileSync(path.join(workspace, "match-report.json"), JSON.stringify(report, null, 2));
const summary = Object.groupBy(matches, match => match.status);
console.log({
  catalogo: catalog.length,
  costos: costs.length,
  seguros: summary.seguro?.length || 0,
  revisar: summary.revisar?.length || 0,
  sinMatch: summary.sin_match?.length || 0
});
