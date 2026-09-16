import { AddOnOption } from '../types';

export const TOPPING_OPTIONS: AddOnOption[] = [
  { name: 'No Topping', price: 0 },
  { name: 'Float', price: 6000 },
  { name: 'Jelly', price: 6000 },
  { name: 'Smoking Barels Xtrashot', price: 6000 },
  { name: 'Leton Blend Xtra Shot', price: 6000 },
  { name: 'Oat-milk', price: 10000 },
];

export const SYRUP_OPTIONS: AddOnOption[] = [
  { name: 'No Syrup', price: 0 },
  { name: 'Syrup Vanila', price: 6000 },
  { name: 'Syrup Caramel', price: 6000 },
  { name: 'Syrup Almond', price: 6000 },
  { name: 'Syrup Hazelnut', price: 6000 },
];

export const DEFAULT_TOPPING: AddOnOption = TOPPING_OPTIONS[0];
export const DEFAULT_SYRUP: AddOnOption = SYRUP_OPTIONS[0];

export function calculateItemUnitPrice(
  basePrice: number,
  topping?: AddOnOption,
  syrup?: AddOnOption
): number {
  const topPrice = topping?.price || 0;
  const syrPrice = syrup?.price || 0;
  return basePrice + topPrice + syrPrice;
}

export function generateCartItemId(
  productId: string,
  toppingName?: string,
  syrupName?: string
): string {
  const safeTop = (toppingName || 'No Topping').trim().toLowerCase().replace(/\s+/g, '-');
  const safeSyr = (syrupName || 'No Syrup').trim().toLowerCase().replace(/\s+/g, '-');
  return `${productId}__top_${safeTop}__syr_${safeSyr}`;
}
