/** Tính giá sau giảm từ chuỗi discount (15%, 50k, ...) */
export function applyDiscount(unitPrice: number, discountInfo: string): number {
  if (!discountInfo?.trim()) return unitPrice;
  const info = discountInfo.trim().toLowerCase();
  if (info.endsWith('%')) {
    const pct = parseFloat(info.replace('%', '').trim());
    if (!isNaN(pct)) return Math.round(unitPrice * (1 - pct / 100));
  }
  let fixed = 0;
  if (info.endsWith('k')) fixed = parseFloat(info.replace('k', '')) * 1000;
  else if (info.endsWith('tr')) fixed = parseFloat(info.replace('tr', '')) * 1_000_000;
  else {
    const digits = info.replace(/[^0-9]/g, '');
    if (digits) fixed = parseInt(digits, 10);
  }
  if (fixed > 0) return Math.max(0, unitPrice - fixed);
  return unitPrice;
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

export function buildShareUrl(baseUrl: string, campaignId: number): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/keo/${campaignId}`;
}
