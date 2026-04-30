export function sanitizeProduct(docId, product) {
  const fallbackImage =
    "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80";
  const source = product || {};

  const readField = (keys, fallback = "") => {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
    }
    return fallback;
  };

  const readArray = (keys, fallback = []) => {
    for (const key of keys) {
      if (Array.isArray(source[key])) return source[key];
    }
    return fallback;
  };

  const readStringSet = (keys) => {
    for (const key of keys) {
      const val = source[key];
      if (Array.isArray(val)) return new Set(val.filter(Boolean).map(String));
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const s = new Set();
        for (const [k, v] of Object.entries(val)) {
          if (v === false || v === 0 || v === "rupture" || v === "out" || v === "outOfStock") {
            s.add(String(k));
          }
        }
        return s;
      }
    }
    return new Set();
  };

  const categoryRaw = String(readField(["category", "Category"], "artisanat")).trim().toLowerCase();
  const nameRaw = String(readField(["name", "Name", "title", "Title"], "Produit sans nom")).trim();

  const tailleUSA = readArray(["tailleUSA", "Taille USA", "sizesUSA", "sizes", "Sizes"])
    .filter(Boolean)
    .map(String);
  const tailleEUR = readArray(["tailleEUR", "Taille EUR", "sizesEUR"]).filter(Boolean).map(String);

  const ruptureUSA = readStringSet(["ruptureUSA", "rupture_taille_usa", "outOfStockUSA"]);
  const ruptureEUR = readStringSet(["ruptureEUR", "rupture_taille_eur", "outOfStockEUR"]);

  const item = {
    id: docId || "",
    name: nameRaw || "Produit sans nom",
    price: Number(readField(["price", "Price"], 0)),
    image: String(readField(["image", "Image"], fallbackImage)),
    images: readArray(["images", "Images"]).filter(Boolean).map(String),
    description: String(readField(["description", "Description"], "Aucune description.")),
    category: categoryRaw || "artisanat",
    colors: readArray(["colors", "Colors"]).filter(Boolean).map(String),
    tailleUSA,
    tailleEUR: tailleEUR.length ? tailleEUR : [],
    ruptureUSA,
    ruptureEUR,
    tag: String(readField(["tag", "Tag"], "")).trim()
  };

  if (item.images.length === 0) item.images = [item.image];
  return item;
}

export function parseDiscountTag(tag) {
  if (!tag) return null;
  const match = tag.match(/-?\s*(\d{1,2})\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value >= 100) return null;
  return value;
}

export function getPriceData(product) {
  const discount = parseDiscountTag(product.tag);
  const base = Number(product.price || 0);
  if (!discount) return { finalPrice: base, oldPrice: null };
  const finalPrice = Math.max(0, Math.round(base * (1 - discount / 100)));
  return { finalPrice, oldPrice: base };
}

export function isOutOfStockGlobally(product) {
  return (
    String(product.tag || "").toLowerCase().includes("out of stock") ||
    String(product.tag || "").toLowerCase().includes("rupture")
  );
}

export function formatPrice(price) {
  return `${Number(price).toFixed(0)} DT`;
}
