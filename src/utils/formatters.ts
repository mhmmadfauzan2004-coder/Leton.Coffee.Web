export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function cleanWhatsAppNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

export function createWhatsAppLink(phone: string, text: string): string {
  const cleanPhone = cleanWhatsAppNumber(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Format date in Indonesian locale with Asia/Jakarta (UTC+7 / WIB) timezone
 * Example: "24 September 2026"
 */
export function formatOrderDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}

/**
 * Format time in Indonesian locale with Asia/Jakarta (UTC+7 / WIB) timezone
 * Example: "21:45 WIB"
 */
export function formatOrderTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const timeStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(d)
      .replace('.', ':');
    return `${timeStr} WIB`;
  } catch {
    return '-';
  }
}

/**
 * Format full datetime in Indonesian locale with Asia/Jakarta (UTC+7 / WIB) timezone
 * Example: "24 September 2026 • 21:45 WIB"
 */
export function formatOrderDateTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';
  const dateStr = formatOrderDate(dateInput);
  const timeStr = formatOrderTime(dateInput);
  if (dateStr === '-' || timeStr === '-') return '-';
  return `${dateStr} • ${timeStr}`;
}

