import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  sanitizeProduct,
  getPriceData,
  isOutOfStockGlobally,
  formatPrice
} from "./product-model.js";
import { getCart, setCart } from "./cart.js";
import { escapeHtml } from "./utils.js";
import { getLang, setLang, i18n } from "./i18n.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentProduct = null;
let selectedColor = "";
let selectedUsa = "";
let selectedEur = "";

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const detailMainImage = document.getElementById("detailMainImage");
const detailGallery = document.getElementById("detailGallery");
const detailName = document.getElementById("detailName");
const detailPrice = document.getElementById("detailPrice");
const detailCategory = document.getElementById("detailCategory");
const detailTagText = document.getElementById("detailTagText");
const detailDescription = document.getElementById("detailDescription");
const colorOptions = document.getElementById("colorOptions");
const sizeOptionsUsa = document.getElementById("sizeOptionsUsa");
const sizeOptionsEur = document.getElementById("sizeOptionsEur");
const colorGroup = document.getElementById("labelColor")?.closest(".option-group");
const selectionError = document.getElementById("selectionError");
const stockMsg = document.getElementById("stockMsg");
const addToCartBtn = document.getElementById("addToCartBtn");
const langToggleBtn = document.getElementById("langToggleBtn");
const langMenu = document.getElementById("langMenu");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const similarProductsContainer = document.getElementById("similarProductsContainer");
const similarProductsSection = document.getElementById("similarProductsSection");

function applyI18n() {
  const lang = getLang();
  document.documentElement.lang = lang === "ar" ? "ar" : "fr";
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  const keys = [
    ["navHome", "navHome"],
    ["navShop", "navShop"],
    ["navCategories", "navCategories"],
    ["navContact", "navContact"],
    ["btnAllProducts", "navAllProducts"],
    ["labelColor", "colorLabel"],
    ["labelSizeUsa", "sizeUsa"],
    ["labelSizeEur", "sizeEur"],
    ["addToCartBtn", "addToCart"],
    ["backLink", "backShop"]
  ];
  keys.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = i18n[lang][key];
  });

  langToggleBtn.innerHTML =
    lang === "ar"
      ? `<span dir="rtl" style="font-weight:800;">العربية</span>`
      : `<span style="font-weight:800;">Français</span>`;

  document.getElementById("langOptionFr").textContent = i18n.fr.langFr;
  document.getElementById("langOptionAr").textContent = i18n.ar.langAr;

  document.getElementById("cartLabelText").textContent = i18n[lang].cartLabel;
  document.querySelectorAll(".nav-lang-opt").forEach((b) => b.classList.toggle("active-lang", b.dataset.lang === lang));

  if (currentProduct) {
    addToCartBtn.textContent = isOutOfStockGlobally(currentProduct)
      ? i18n[lang].productOos
      : i18n[lang].addToCart;
    updateStockMessage();
  }
}

function isUsaOos(size) {
  if (!currentProduct || !size) return false;
  return currentProduct.ruptureUSA.has(size);
}

function isEurOos(size) {
  if (!currentProduct || !size) return false;
  return currentProduct.ruptureEUR.has(size);
}

function updateStockMessage() {
  const lang = getLang();
  stockMsg.textContent = "";
  if (!currentProduct) return;
  const parts = [];
  if (selectedUsa && isUsaOos(selectedUsa)) {
    parts.push(`${i18n[lang].sizeUsa}: ${i18n[lang].outOfStock}`);
  }
  if (selectedEur && isEurOos(selectedEur)) {
    parts.push(`${i18n[lang].sizeEur}: ${i18n[lang].outOfStock}`);
  }
  stockMsg.textContent = parts.join(" · ");
}

function renderOptionButtons(container, values, type) {
  container.innerHTML = "";
  values.forEach((value) => {
    const btn = document.createElement("button");
    const isColor = type === "color";
    btn.className = isColor ? "color-btn" : "option-btn";
    if (!isColor) btn.textContent = value;
    if (isColor) {
      btn.style.background = value;
      btn.title = value;
      btn.setAttribute("aria-label", value);
    }
    btn.type = "button";
    btn.addEventListener("click", () => {
      const alreadySelected = btn.classList.contains("selected");
      if (alreadySelected) {
        btn.classList.remove("selected");
        if (type === "color") selectedColor = "";
        if (type === "usa") selectedUsa = "";
        if (type === "eur") selectedEur = "";
        updateStockMessage();
        return;
      }
      container.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      if (type === "color") selectedColor = value;
      if (type === "usa") selectedUsa = value;
      if (type === "eur") selectedEur = value;
      selectionError.textContent = "";
      updateStockMessage();
    });
    container.appendChild(btn);
  });
}

function renderGallery(images) {
  detailGallery.innerHTML = "";
  images.forEach((imgUrl, index) => {
    const thumb = document.createElement("button");
    thumb.className = `thumb ${index === 0 ? "active" : ""}`;
    thumb.type = "button";
    thumb.innerHTML = `<img src="${escapeHtml(imgUrl)}" alt="" />`;
    thumb.addEventListener("click", () => {
      detailMainImage.src = imgUrl;
      detailGallery.querySelectorAll(".thumb").forEach((t) => t.classList.remove("active"));
      thumb.classList.add("active");
    });
    detailGallery.appendChild(thumb);
  });
}

function openProductDetails(product) {
  const lang = getLang();
  const L = i18n[lang];
  document.getElementById("labelColor").textContent = L.colorLabel;
  document.getElementById("labelSizeUsa").textContent = L.sizeUsa;
  document.getElementById("labelSizeEur").textContent = L.sizeEur;
  currentProduct = product;
  selectedColor = "";
  selectedUsa = "";
  selectedEur = "";
  selectionError.textContent = "";
  stockMsg.textContent = "";

  detailName.textContent = product.name;
  const priceData = getPriceData(product);
  detailPrice.innerHTML = `${formatPrice(priceData.finalPrice)}${
    priceData.oldPrice ? ` <span class="old-price">${formatPrice(priceData.oldPrice)}</span>` : ""
  }`;
  detailCategory.textContent = product.category;
  detailTagText.textContent = product.tag || "";
  detailDescription.textContent = product.description;
  detailMainImage.src = product.image;
  detailMainImage.alt = product.name;

  const oos = isOutOfStockGlobally(product);
  addToCartBtn.disabled = oos || false;
  addToCartBtn.textContent = oos ? i18n[lang].productOos : i18n[lang].addToCart;

  renderGallery(product.images);
  if (colorGroup) colorGroup.style.display = product.colors.length ? "" : "none";
  renderOptionButtons(colorOptions, product.colors, "color");
  const usaEl = document.getElementById("usaGroup");
  const eurEl = document.getElementById("eurGroup");
  if (usaEl) usaEl.style.display = product.tailleUSA.length ? "" : "none";
  if (eurEl) eurEl.style.display = product.tailleEUR.length ? "" : "none";
  renderOptionButtons(sizeOptionsUsa, product.tailleUSA, "usa");
  renderOptionButtons(sizeOptionsEur, product.tailleEUR, "eur");
  loadSimilarProducts(product);
}

function renderSimilarProducts(items) {
  if (!similarProductsContainer || !similarProductsSection) return;
  similarProductsContainer.innerHTML = "";
  if (!items.length) {
    similarProductsSection.style.display = "none";
    return;
  }
  similarProductsSection.style.display = "";
  items.forEach((product) => {
    const card = document.createElement("article");
    const pd = getPriceData(product);
    card.className = "product-card";
    card.innerHTML = `
      <a class="product-image-wrap" href="product.html?id=${encodeURIComponent(product.id)}">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
      </a>
      <div class="product-info">
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <div class="price-wrap"><span class="price">${formatPrice(pd.finalPrice)}</span></div>
      </div>
    `;
    similarProductsContainer.appendChild(card);
  });
}

async function loadSimilarProducts(product) {
  if (!product || !product.category) return;
  try {
    const q = query(collection(db, "products"), where("category", "==", product.category), limit(8));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach((docSnap) => {
      if (docSnap.id !== product.id) items.push(sanitizeProduct(docSnap.id, docSnap.data()));
    });
    renderSimilarProducts(items.slice(0, 4));
  } catch (error) {
    console.error(error);
    if (similarProductsSection) similarProductsSection.style.display = "none";
  }
}

async function loadOneProduct() {
  const lang = getLang();
  if (!productId) {
    document.getElementById("productRoot").prepend(Object.assign(document.createElement("p"), { className: "state-box", textContent: i18n[lang].productNotFound }));
    return;
  }
  try {
    const ref = doc(db, "products", productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      document.getElementById("productRoot").prepend(Object.assign(document.createElement("p"), { className: "state-box", textContent: i18n[lang].productNotFound }));
      return;
    }
    const product = sanitizeProduct(snap.id, snap.data());
    openProductDetails(product);
  } catch (e) {
    console.error(e);
    document.getElementById("productRoot").prepend(Object.assign(document.createElement("p"), { className: "state-box", textContent: i18n[lang].loadError }));
  }
}

function addProductToCart(product, color, tailleUSA, tailleEUR) {
  const priceData = getPriceData(product);
  const cart = getCart();
  cart.push({
    cartId: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    productId: product.id,
    name: product.name,
    image: product.image,
    color: color || "-",
    tailleUSA: tailleUSA || "-",
    tailleEUR: tailleEUR || "-",
    unitPrice: priceData.finalPrice,
    qty: 1
  });
  setCart(cart);
}

addToCartBtn.addEventListener("click", () => {
  const lang = getLang();
  if (!currentProduct) return;

  const needColor = currentProduct.colors.length > 0;
  const needUsa = currentProduct.tailleUSA.length > 0;
  const needEur = currentProduct.tailleEUR.length > 0;

  if ((needColor && !selectedColor) || (needUsa && !selectedUsa) || (needEur && !selectedEur)) {
    selectionError.textContent = i18n[lang].needSelections;
    return;
  }
  if (isOutOfStockGlobally(currentProduct)) {
    selectionError.textContent = i18n[lang].productOos;
    return;
  }
  if (selectedUsa && isUsaOos(selectedUsa)) {
    selectionError.textContent = i18n[lang].outOfStock;
    return;
  }
  if (selectedEur && isEurOos(selectedEur)) {
    selectionError.textContent = i18n[lang].outOfStock;
    return;
  }

  addProductToCart(currentProduct, selectedColor, selectedUsa, selectedEur);
  selectionError.textContent = "";
  sessionStorage.setItem("gca_open_cart", "1");
  window.location.href = "produits.html";
});

langToggleBtn.addEventListener("click", () => langMenu.classList.toggle("open"));
langMenu.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-lang]");
  if (!btn) return;
  setLang(btn.dataset.lang);
  langMenu.classList.remove("open");
  applyI18n();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".lang-dropdown")) langMenu.classList.remove("open");
});

// Mobile nav lang buttons
document.querySelectorAll(".nav-lang-opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    setLang(btn.dataset.lang);
    menuBtn.classList.remove("open");
    navLinks.classList.remove("open");
    applyI18n();
  });
});

menuBtn.addEventListener("click", () => {
  menuBtn.classList.toggle("open");
  navLinks.classList.toggle("open");
});
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuBtn.classList.remove("open");
    navLinks.classList.remove("open");
  });
});

document.getElementById("year").textContent = String(new Date().getFullYear());

applyI18n();
loadOneProduct();
