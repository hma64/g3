import { getCart, setCart } from "./cart.js";
import { formatPrice } from "./product-model.js";
import { escapeHtml } from "./utils.js";
import { getLang, setLang, i18n } from "./i18n.js";

const ORDER_EMAIL = "mouhamedamineyousfi10@gmail.com";
const SHIPPING_DT = 7;

const GOVERNORATES = [
  "Tunis",
  "Bizerte",
  "Ariana",
  "Beja",
  "Ben Arous",
  "Gabes",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kebili",
  "Kef",
  "Mahdia",
  "Mannouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Zaghouan"
];

const govSelect = document.getElementById("governorateSelect");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutError = document.getElementById("checkoutError");
const checkoutStatus = document.getElementById("checkoutStatus");
const cartReview = document.getElementById("cartReview");
const subtotalEl = document.getElementById("subtotalEl");
const shippingEl = document.getElementById("shippingEl");
const grandTotalEl = document.getElementById("grandTotalEl");
const confirmBtn = document.getElementById("confirmBtn");
const langToggleBtn = document.getElementById("langToggleBtn");
const langMenu = document.getElementById("langMenu");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

GOVERNORATES.forEach((g) => {
  const opt = document.createElement("option");
  opt.value = g;
  opt.textContent = g;
  govSelect.appendChild(opt);
});

function buildOrderEmailBody({
  firstName,
  lastName,
  phone,
  address,
  addressExtra,
  governorate,
  items,
  subtotal,
  shipping,
  total,
  orderedAt
}) {
  const lines = items.map(
    (item, i) =>
      `${i + 1}. ${item.name}
   Couleur: ${item.color} | USA: ${item.tailleUSA || "-"} | EUR: ${item.tailleEUR || "-"}
   Qté: ${item.qty} × ${item.unitPrice} DT = ${item.unitPrice * item.qty} DT`
  );

  const images = items.map((item, i) => `${i + 1}. ${item.name} — ${item.image}`).join("\n");

  return `BON DE COMMANDE — GCA STYMODE
────────────────────────────
Date de la commande : ${orderedAt}

CLIENT
Prénom / Nom : ${firstName} ${lastName}
Téléphone : ${phone}

LIVRAISON
Adresse : ${address}
Complément : ${addressExtra || "—"}
Gouvernorat : ${governorate}

DÉTAIL DES ARTICLES
${lines.join("\n\n")}

LIENS VERS LES IMAGES DES PRODUITS
(copiez-collez dans un navigateur pour voir chaque article)
${images}

MONTANTS
Prix total articles : ${subtotal} DT
Livraison : ${shipping} DT
TOTAL À PAYER : ${total} DT

—
Message généré depuis le site GCA styMode.`;
}

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
    ["pageTitle", "checkoutTitle"],
    ["pageSub", "checkoutSub"],
    ["labelFirst", "firstName"],
    ["labelLast", "lastName"],
    ["labelPhone", "phone"],
    ["labelAddress", "address"],
    ["labelExtra", "addressExtra"],
    ["labelGov", "governorate"],
    ["lblSubtotal", "subtotal"],
    ["lblShip", "shipping"],
    ["lblGrand", "grandTotal"],
    ["confirmBtn", "confirmOrder"],
    ["recapTitle", "recapTitle"]
  ];
  map.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = i18n[lang][key];
  });
  const first = govSelect.querySelector("option[value='']");
  if (first) first.textContent = i18n[lang].selectGov;

  langToggleBtn.innerHTML =
    lang === "ar"
      ? `<span dir="rtl" style="font-weight:800;">العربية</span>`
      : `<span style="font-weight:800;">Français</span>`;
  document.getElementById("langOptionFr").textContent = i18n.fr.langFr;
  document.getElementById("langOptionAr").textContent = i18n.ar.langAr;
  document.getElementById("cartLabelText").textContent = i18n[lang].cartLabel;
  document.querySelectorAll(".nav-lang-opt").forEach((b) => b.classList.toggle("active-lang", b.dataset.lang === lang));

  renderReview();
}

function renderReview() {
  const lang = getLang();
  const cart = getCart();
  cartReview.innerHTML = "";

  if (!cart.length) {
    cartReview.innerHTML = `<div class="state-box">${i18n[lang].checkoutEmpty}</div>`;
    checkoutForm.style.display = "none";
    return;
  }
  checkoutForm.style.display = "";

  const subtotal = cart.reduce((s, it) => s + Number(it.unitPrice) * Number(it.qty || 1), 0);
  const ship = SHIPPING_DT;
  const total = subtotal + ship;

  subtotalEl.textContent = formatPrice(subtotal);
  shippingEl.textContent = formatPrice(ship);
  grandTotalEl.textContent = formatPrice(total);

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-mini-row";
    row.innerHTML = `
      <img src="${escapeHtml(item.image)}" alt="" />
      <div>
        <div style="font-weight:800;">${escapeHtml(item.name)}</div>
        <div style="color:#666;font-size:0.88rem;">${escapeHtml(item.color)} · USA ${escapeHtml(item.tailleUSA || "-")} / EUR ${escapeHtml(item.tailleEUR || "-")}</div>
        <div>${i18n[lang].total}: ${formatPrice(item.unitPrice * item.qty)} × ${item.qty}</div>
      </div>
    `;
    cartReview.appendChild(row);
  });
}

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const lang = getLang();
  checkoutError.textContent = "";
  checkoutStatus.textContent = "";

  const cart = getCart();
  if (!cart.length) {
    checkoutError.textContent = i18n[lang].checkoutEmpty;
    return;
  }

  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const addressExtra = document.getElementById("addressExtra").value.trim();
  const governorate = govSelect.value;

  if (!firstName || !lastName || !phone || !address || !governorate) {
    checkoutError.textContent = i18n[lang].fieldError;
    return;
  }

  const phoneRegex = /^[2579]\d{7}$/;
  if (!phoneRegex.test(phone)) {
    checkoutError.textContent = i18n[lang].phoneError;
    return;
  }

  const subtotal = cart.reduce((s, it) => s + Number(it.unitPrice) * Number(it.qty || 1), 0);
  const ship = SHIPPING_DT;
  const total = subtotal + ship;
  const orderedAt = new Date().toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short"
  });

  const items = cart.map((item) => ({
    name: item.name,
    color: item.color,
    tailleUSA: item.tailleUSA,
    tailleEUR: item.tailleEUR,
    qty: item.qty,
    unitPrice: item.unitPrice,
    image: item.image
  }));

  const body = buildOrderEmailBody({
    firstName,
    lastName,
    phone,
    address,
    addressExtra,
    governorate,
    items,
    subtotal,
    shipping: ship,
    total,
    orderedAt
  });

  const subject = `Bon de commande GCA styMode — ${firstName} ${lastName} — ${orderedAt}`;
  confirmBtn.disabled = true;
  checkoutStatus.textContent = i18n[lang].sending;

  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ORDER_EMAIL)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        _subject: subject,
        _template: "table",
        _captcha: "false",
        name: `${firstName} ${lastName}`,
        email: ORDER_EMAIL.replace("@", "+luxorders@"),
        phone,
        governorate,
        address,
        addressExtra,
        message: body
      })
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && (data.success === true || data.success === "true" || data.success === "OK");
    if (!ok || data.error) {
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }
    checkoutStatus.textContent = i18n[lang].sentOk;
    setCart([]);
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1800);
  } catch (err) {
    console.error(err);
    checkoutError.textContent = i18n[lang].sendError;
    checkoutStatus.textContent = "";
    confirmBtn.disabled = false;
  }
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
