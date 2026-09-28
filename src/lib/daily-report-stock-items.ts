// The fixed set of sellable items tracked on the Daily Report's stock
// reconciliation table — a mix of real Products (finished menu items) and
// Toppings (tracked here under their raw-ingredient name, e.g. "Extra Keju"
// shows as "Cheese"). Pure/zero-import so it's shared unchanged between the
// server-side preview computation and the submit API's server-side
// recomputation of `terjualSistem`.
export type StockItemSpec =
  | { kind: "PRODUCT"; productName: string }
  | { kind: "TOPPING"; toppingName: string; displayName: string };

export const DAILY_REPORT_STOCK_ITEMS: StockItemSpec[] = [
  { kind: "PRODUCT", productName: "Kebab Small" },
  { kind: "PRODUCT", productName: "Kebab Medium" },
  { kind: "PRODUCT", productName: "Kebab Super" },
  { kind: "PRODUCT", productName: "Kebab Jumbo" },
  { kind: "PRODUCT", productName: "Kebab Cheesy Black" },
  { kind: "PRODUCT", productName: "Shawarma" },
  { kind: "PRODUCT", productName: "American Hotdog" },
  { kind: "PRODUCT", productName: "Mexican Hotdog" },
  { kind: "PRODUCT", productName: "Clasic Beef Burger" },
  { kind: "TOPPING", toppingName: "Extra Beef", displayName: "Beef Patty" },
  { kind: "TOPPING", toppingName: "Extra Chilimeat", displayName: "Chilimeat" },
  { kind: "TOPPING", toppingName: "Extra Keju", displayName: "Cheese" },
  { kind: "TOPPING", toppingName: "Extra Sosis", displayName: "Sosis" },
  { kind: "PRODUCT", productName: "Air Mineral Prima" },
  { kind: "PRODUCT", productName: "Teh Botol Sosro" },
  { kind: "PRODUCT", productName: "Fruit Tea" },
];
