const CART_KEY = "lux_vip_cart";

export function getCart() {
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      tailleUSA: item.tailleUSA ?? item.size ?? "-",
      tailleEUR: item.tailleEUR ?? "-"
    }));
  } catch {
    return [];
  }
}

export function setCart(items) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addLine(line) {
  const cart = getCart();
  cart.push(line);
  setCart(cart);
}

export function cartLineTotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.unitPrice) * Number(item.qty || 1), 0);
}

export function cartCount(cart) {
  return cart.reduce((sum, item) => sum + Number(item.qty || 1), 0);
}
