import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { sanitizeProduct, getPriceData, isOutOfStockGlobally, formatPrice } from "./product-model.js";
import { getCart, setCart, cartLineTotal, cartCount } from "./cart.js";
import { escapeHtml } from "./utils.js";
import { getLang, setLang, i18n } from "./i18n.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const validCat = [];
let currentFilter = "all";

let allProducts = [];
let currentSearch = "";
let availableMinPrice = 0;
let availableMaxPrice = 1000;
let currentMinPrice = 0;
let currentMaxPrice = 1000;
let previewVertical = false;

const productsContainer = document.getElementById("productsContainer");
const stateBox = document.getElementById("stateBox");
const filterBar = document.getElementById("filterBar");
const searchInput = document.getElementById("searchInput");
const priceMinInput = document.getElementById("priceMinInput");
const priceMaxInput = document.getElementById("priceMaxInput");
const priceMinRange = document.getElementById("priceMinRange");
const priceMaxRange = document.getElementById("priceMaxRange");
const rangeProgress = document.getElementById("rangeProgress");
const priceResetBtn = document.getElementById("priceResetBtn");
const layoutKebab = document.getElementById("layoutKebab");
const loopTrack = document.getElementById("loopTrack");
const cartDrawer = document.getElementById("cartDrawer");
const cartDim = document.getElementById("cartDim");
const openCartBtn = document.getElementById("openCartBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const checkoutBtn = document.getElementById("checkoutBtn");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const langToggleBtn = document.getElementById("langToggleBtn");
const langMenu = document.getElementById("langMenu");

function applyI18n() {
  const lang = getLang();
  document.documentElement.lang = lang === "ar" ? "ar" : "fr";
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  const map = [
    ["navHome", "navHome"],
    ["navShop", "navShop"],
    ["navCategories", "navCategories"],
    ["navContact", "navContact"],
    ["btnAllProducts", "navAllProducts"],
    ["pageCatalogTitle", "catalogPageTitle", true],
    ["pageCatalogSub", "catalogPageSub"],
    ["searchInput", "searchPlaceholder", false, "placeholder"],
    ["priceFilterLabel", "priceFilter"],
    ["cartHeadLabel", "cartTitle"],
    ["cartTotalLabel", "total"],
    ["checkoutBtn", "validatePurchases"],
    ["footerNote", "footer"]
  ];

  for (const row of map) {
    const el = document.getElementById(row[0]);
    if (!el) continue;
    const key = row[1];
    const html = row[2] === true;
    const attr = row[3];
    const val = i18n[lang][key] || i18n.fr[key];
    if (attr === "placeholder") el.setAttribute("placeholder", val);
    else if (html) el.innerHTML = val;
    else el.textContent = val;
  }

  langToggleBtn.innerHTML =
    lang === "ar"
      ? `<span dir="rtl" style="font-weight:800;">العربية</span>`
      : `<span style="font-weight:800;">Français</span>`;

  document.getElementById("langOptionFr").textContent = i18n.fr.langFr;
  document.getElementById("langOptionAr").textContent = i18n.ar.langAr;

  updateCartLabel();
  applyFilter();
  const _lang = getLang();
  document.querySelectorAll(".nav-lang-opt").forEach((b) => b.classList.toggle("active-lang", b.dataset.lang === _lang));
}

function updateCartLabel() {
  document.getElementById("cartLabelText").textContent = i18n[getLang()].cartLabel;
}

function showState(msg) {
  stateBox.style.display = "block";
  stateBox.textContent = msg;
}

function hideState() {
  stateBox.style.display = "none";
  stateBox.textContent = "";
}

function parseDiscountTag(tag) {
  if (!tag) return null;
  const match = tag.match(/-?\s*(\d{1,2})\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value >= 100) return null;
  return value;
}

function getTagMeta(tag = "") {
  const normalized = tag.toLowerCase();
  if (!tag) return { cardClass: "", text: "" };
  if (parseDiscountTag(tag)) return { cardClass: "promo", text: tag };
  if (normalized.includes("out of stock") || normalized.includes("rupture")) return { cardClass: "stock", text: tag };
  return { cardClass: "", text: tag };
}

function updatePriceUi() {
  priceMinInput.value = String(currentMinPrice);
  priceMaxInput.value = String(currentMaxPrice);
  const minPercent = ((currentMinPrice - availableMinPrice) / Math.max(1, availableMaxPrice - availableMinPrice)) * 100;
  const maxPercent = ((currentMaxPrice - availableMinPrice) / Math.max(1, availableMaxPrice - availableMinPrice)) * 100;
  rangeProgress.style.left = `${Math.max(0, minPercent)}%`;
  rangeProgress.style.right = `${Math.max(0, 100 - maxPercent)}%`;
}

function getCategoryProducts() {
  return allProducts;
}

function syncPriceBoundsForCurrentCategory(resetValues = true) {
  const baseProducts = getCategoryProducts();
  const prices = baseProducts.map((product) => getPriceData(product).finalPrice).filter((x) => Number.isFinite(x));
  availableMinPrice = 0;
  availableMaxPrice = prices.length ? Math.max(...prices) : 1000;
  if (availableMaxPrice < 1) availableMaxPrice = 1;
  if (resetValues) {
    currentMinPrice = 0;
    currentMaxPrice = availableMaxPrice;
  } else {
    currentMinPrice = Math.max(0, Math.min(currentMinPrice, availableMaxPrice));
    currentMaxPrice = Math.max(currentMinPrice, Math.min(currentMaxPrice, availableMaxPrice));
  }
  priceMinInput.min = "0";
  priceMinInput.max = String(availableMaxPrice);
  priceMaxInput.min = "0";
  priceMaxInput.max = String(availableMaxPrice);
  priceMinRange.min = String(availableMinPrice);
  priceMinRange.max = String(availableMaxPrice);
  priceMaxRange.min = String(availableMinPrice);
  priceMaxRange.max = String(availableMaxPrice);
  priceMinRange.value = String(currentMinPrice);
  priceMaxRange.value = String(currentMaxPrice);
  updatePriceUi();
}

function renderLoopGallery() {
  if (!allProducts.length) {
    loopTrack.innerHTML = "";
    return;
  }
  const loopItems = allProducts;
  const chunk = loopItems
    .map(
      (product) => `
    <div class="loop-item">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
      <span>${escapeHtml(product.name)}</span>
    </div>
  `
    )
    .join("");
  loopTrack.innerHTML = chunk + chunk;
}

function bagSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" width="16" height="16">
    <path d="M6 7h15l-1.5 9h-12z"/><path d="M6 7 5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg>`;
}

function renderProducts(list) {
  const lang = getLang();
  const buyLabel = lang === "ar" ? i18n.ar.buyAr : i18n.fr.buy;
  productsContainer.innerHTML = "";
  if (!list.length) {
    showState(i18n[lang].noProducts);
    return;
  }
  hideState();

  list.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = `product-card ${isOutOfStockGlobally(product) ? "is-out" : ""}`;
    card.style.animationDelay = `${index * 60}ms`;
    const pd = getPriceData(product);
    const tagM = getTagMeta(product.tag);
    const href = `product.html?id=${encodeURIComponent(product.id)}`;
    const sizesLabel = product.tailleUSA.length
      ? `Tailles: ${product.tailleUSA.join(", ")}`
      : "";

    card.innerHTML = `
      <a class="product-image-wrap" href="${href}">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
        ${tagM.cardClass ? `<span class="product-tag ${tagM.cardClass}">${escapeHtml(product.tag)}</span>` : ""}
      </a>
      <div class="product-info">
        <span class="badge">${escapeHtml(product.category)}</span>
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <div class="price-wrap">
          <span class="price">${formatPrice(pd.finalPrice)}</span>
          ${pd.oldPrice ? `<span class="old-price">${formatPrice(pd.oldPrice)}</span>` : ""}
        </div>
        ${sizesLabel ? `<div class="product-sizes-line">${escapeHtml(sizesLabel)}</div>` : ""}
        <div class="product-actions">
          <a class="mini-btn" href="${href}">Choisir taille</a>
          <a class="mini-btn btn-primary" href="${href}">Aperçu</a>
        </div>
      </div>
    `;
    productsContainer.appendChild(card);
  });
}

function setActiveFilterButton(category) {
  if (!filterBar) return;
  filterBar.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.category === category);
  });
}

function applyFilter() {
  const lang = getLang();
  const filteredByCategory = getCategoryProducts();
  const filtered = filteredByCategory.filter((item) => {
    const text = `${item.name} ${item.category}`.toLowerCase();
    const price = getPriceData(item).finalPrice;
    return text.includes(currentSearch.toLowerCase()) && price >= currentMinPrice && price <= currentMaxPrice;
  });
  renderProducts(filtered);
  setActiveFilterButton(currentFilter);
}

function openCart() {
  cartDrawer.classList.add("open");
  cartDim.classList.add("show");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartDim.classList.remove("show");
  cartDrawer.setAttribute("aria-hidden", "true");
}

function renderCart() {
  const lang = getLang();
  const cart = getCart();
  cartItems.innerHTML = "";
  if (!cart.length) {
    cartItems.innerHTML = `<div class="state-box">${i18n[lang].cartEmpty}</div>`;
  } else {
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <img src="${escapeHtml(item.image)}" alt="" />
        <div>
          <div style="font-weight:700;">${escapeHtml(item.name)}</div>
          <div style="font-size:0.86rem;color:#666;">${escapeHtml(item.color)} · USA ${escapeHtml(item.tailleUSA || "-")} / EUR ${escapeHtml(item.tailleEUR || "-")}</div>
          <div style="font-weight:700;">${formatPrice(item.unitPrice * item.qty)}</div>
          <div class="qty-wrap">
            <button class="qty-btn" type="button" data-action="minus" data-id="${escapeHtml(item.cartId)}">-</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" type="button" data-action="plus" data-id="${escapeHtml(item.cartId)}">+</button>
            <button class="remove-btn" type="button" data-action="remove" data-id="${escapeHtml(item.cartId)}">${i18n[lang].remove}</button>
          </div>
        </div>
      `;
      cartItems.appendChild(row);
    });
  }
  cartTotal.textContent = formatPrice(cartLineTotal(cart));
  cartCountEl.textContent = String(cartCount(cart));
}

function loadProducts() {
  const lang = getLang();
  showState(i18n[lang].loading);
  onSnapshot(
    collection(db, "products"),
    (snapshot) => {
      const fetched = [];
      snapshot.forEach((docSnap) => {
        fetched.push(sanitizeProduct(docSnap.id, docSnap.data()));
      });
      allProducts = fetched;
      if (!allProducts.length) {
        showState(i18n[lang].noFirestore);
        productsContainer.innerHTML = "";
        loopTrack.innerHTML = "";
        return;
      }
      hideState();
      syncPriceBoundsForCurrentCategory(true);
      renderLoopGallery();
      applyFilter();
    },
    () => showState(i18n[lang].loadError)
  );
}

if (filterBar) {
  filterBar.addEventListener("click", (event) => {
    const btn = event.target.closest(".filter-btn");
    if (!btn) return;
    currentFilter = btn.dataset.category;
    syncPriceBoundsForCurrentCategory(true);
    applyFilter();
  });
}

searchInput.addEventListener("input", () => {
  currentSearch = searchInput.value.trim();
  applyFilter();
});

priceMinRange.addEventListener("input", () => {
  currentMinPrice = Number(priceMinRange.value);
  if (currentMinPrice > currentMaxPrice) currentMinPrice = currentMaxPrice;
  priceMinRange.value = String(currentMinPrice);
  updatePriceUi();
  applyFilter();
});

priceMaxRange.addEventListener("input", () => {
  currentMaxPrice = Number(priceMaxRange.value);
  if (currentMaxPrice < currentMinPrice) currentMaxPrice = currentMinPrice;
  priceMaxRange.value = String(currentMaxPrice);
  updatePriceUi();
  applyFilter();
});

priceMinInput.addEventListener("input", () => {
  currentMinPrice = Number(priceMinInput.value || 0);
  if (currentMinPrice < 0) currentMinPrice = 0;
  if (currentMinPrice > currentMaxPrice) currentMinPrice = currentMaxPrice;
  priceMinRange.value = String(currentMinPrice);
  updatePriceUi();
  applyFilter();
});

priceMaxInput.addEventListener("input", () => {
  currentMaxPrice = Number(priceMaxInput.value || 0);
  if (currentMaxPrice > availableMaxPrice) currentMaxPrice = availableMaxPrice;
  if (currentMaxPrice < currentMinPrice) currentMaxPrice = currentMinPrice;
  priceMaxRange.value = String(currentMaxPrice);
  updatePriceUi();
  applyFilter();
});

priceResetBtn.addEventListener("click", () => {
  currentMinPrice = 0;
  currentMaxPrice = availableMaxPrice;
  priceMinRange.value = String(currentMinPrice);
  priceMaxRange.value = String(currentMaxPrice);
  updatePriceUi();
  applyFilter();
});

layoutKebab.addEventListener("click", () => {
  previewVertical = !previewVertical;
  productsContainer.classList.toggle("vertical", previewVertical);
  layoutKebab.classList.toggle("is-vertical", previewVertical);
  layoutKebab.setAttribute("aria-pressed", previewVertical ? "true" : "false");
});

openCartBtn.addEventListener("click", openCart);
closeCartBtn.addEventListener("click", closeCart);
cartDim.addEventListener("click", closeCart);
cartItems.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-id]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const cart = getCart();
  const itemIndex = cart.findIndex((x) => x.cartId === id);
  if (itemIndex === -1) return;

  if (action === "plus") cart[itemIndex].qty = Number(cart[itemIndex].qty || 0) + 1;
  if (action === "minus") {
    const currentQty = Number(cart[itemIndex].qty || 0);
    cart[itemIndex].qty = Math.max(1, currentQty - 1);
  }
  if (action === "remove") cart.splice(itemIndex, 1);
  setCart(cart);
  renderCart();
});

checkoutBtn.addEventListener("click", () => {
  if (!getCart().length) return;
  window.location.href = "checkout.html";
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

function updateMobileLangActive() {
  const lang = getLang();
  document.querySelectorAll(".nav-lang-opt").forEach((btn) => {
    btn.classList.toggle("active-lang", btn.dataset.lang === lang);
  });
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("show");
  });
});
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

document.getElementById("year").textContent = String(new Date().getFullYear());

setActiveFilterButton(currentFilter);
applyI18n();
renderCart();
loadProducts();

if (sessionStorage.getItem("gca_open_cart")) {
  sessionStorage.removeItem("gca_open_cart");
  setTimeout(() => openCart(), 400);
}
