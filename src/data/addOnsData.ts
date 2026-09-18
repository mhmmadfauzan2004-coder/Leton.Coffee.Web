import { AddOnOption, CustomizationOption, ProductSizeOption } from '../types';

export const DEFAULT_SIZES: ProductSizeOption[] = [
  { name: 'Regular', price: 0 },
  { name: 'Large', price: 5000 },
];

export const DEFAULT_MASTER_TOPPINGS: CustomizationOption[] = [
  { id: 'top-no-topping', name: 'No Topping', price: 0, isActive: true, order: 1 },
  { id: 'top-float', name: 'Float', price: 6000, isActive: true, order: 2 },
  { id: 'top-jelly', name: 'Jelly', price: 6000, isActive: true, order: 3 },
  { id: 'top-smoking-barels-xtrashot', name: 'Smoking Barels Xtrashot', price: 6000, isActive: true, order: 4 },
  { id: 'top-leton-blend-xtrashot', name: 'Leton Blend Xtra Shot', price: 6000, isActive: true, order: 5 },
  { id: 'top-oat-milk', name: 'Oat-milk', price: 10000, isActive: true, order: 6 },
];

export const DEFAULT_MASTER_SYRUPS: CustomizationOption[] = [
  { id: 'syr-no-syrup', name: 'No Syrup', price: 0, isActive: true, order: 1 },
  { id: 'syr-vanilla', name: 'Vanilla', price: 6000, isActive: true, order: 2 },
  { id: 'syr-caramel', name: 'Caramel', price: 6000, isActive: true, order: 3 },
  { id: 'syr-almond', name: 'Almond', price: 6000, isActive: true, order: 4 },
  { id: 'syr-hazelnut', name: 'Hazelnut', price: 6000, isActive: true, order: 5 },
];

// Fallback legacy arrays for backward compatibility
export const TOPPING_OPTIONS: AddOnOption[] = DEFAULT_MASTER_TOPPINGS.map((t) => ({
  id: t.id,
  name: t.name,
  price: t.price,
}));

export const SYRUP_OPTIONS: AddOnOption[] = DEFAULT_MASTER_SYRUPS.map((s) => ({
  id: s.id,
  name: s.name,
  price: s.price,
}));

export const DEFAULT_SIZE: AddOnOption = { name: 'Regular', price: 0 };
export const DEFAULT_TOPPING: AddOnOption = { id: 'top-no-topping', name: 'No Topping', price: 0 };
export const DEFAULT_SYRUP: AddOnOption = { id: 'syr-no-syrup', name: 'No Syrup', price: 0 };

export function calculateItemUnitPrice(
  basePrice: number,
  size?: AddOnOption | null,
  topping?: AddOnOption | null,
  syrup?: AddOnOption | null
): number {
  const sizePrice = size?.price || 0;
  const topPrice = topping?.price || 0;
  const syrPrice = syrup?.price || 0;
  return basePrice + sizePrice + topPrice + syrPrice;
}

export function generateCartItemId(
  productId: string,
  sizeName?: string,
  toppingName?: string,
  syrupName?: string
): string {
  const safeSize = (sizeName || 'Regular').trim().toLowerCase().replace(/\s+/g, '-');
  const safeTop = (toppingName || 'No Topping').trim().toLowerCase().replace(/\s+/g, '-');
  const safeSyr = (syrupName || 'No Syrup').trim().toLowerCase().replace(/\s+/g, '-');
  return `${productId}__sz_${safeSize}__top_${safeTop}__syr_${safeSyr}`;
}

