import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TabUrlService {

  /**
   * Lấy URL tab đang mở để điền vào ô input (lúc mở popup/sidebar lần đầu).
   * - Trang Shopee: trả về link hiện tại
   * - Trang khác: trả về rỗng
   */
  getDefaultProductUrl(): Promise<string> {
    return this.queryActiveTabUrl();
  }

  /**
   * Lấy lại link mới nhất — ưu tiên URL trang Shopee đang xem (kể cả SPA chuyển SP).
   * Dùng khi user bấm nút "Lấy lại link".
   */
  async fetchCurrentShopeeUrl(): Promise<string> {
    // Sidebar iframe trên Shopee: hỏi trực tiếp trang cha (luôn đúng khi đổi SP)
    if (window.parent !== window) {
      const parentUrl = await this.requestUrlFromParentPage();
      if (parentUrl) {
        return parentUrl;
      }
    }
    return this.queryActiveTabUrl();
  }

  private requestUrlFromParentPage(): Promise<string> {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'mca-page-url') {
          window.removeEventListener('message', handler);
          clearTimeout(timer);
          const url = event.data.url ?? '';
          resolve(this.isShopeeUrl(url) ? url : '');
        }
      };

      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve('');
      }, 800);

      window.addEventListener('message', handler);
      window.parent.postMessage({ type: 'mca-get-page-url' }, '*');
    });
  }

  private queryActiveTabUrl(): Promise<string> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const url = tabs[0]?.url ?? '';
          resolve(this.isShopeeUrl(url) ? url : '');
        });
      } else {
        resolve('');
      }
    });
  }

  extractProductName(url: string): string | null {
    if (!url || !this.isShopeeUrl(url)) return null;

    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && (lastSegment.includes('.i.') || lastSegment.includes('-i.'))) {
        const namePart = lastSegment.split(/\.i\.|-i\./i)[0];
        if (namePart) {
          return decodeURIComponent(namePart.replace(/-/g, ' '));
        }
      }
      const productIdx = segments.indexOf('product');
      if (productIdx >= 0 && segments[productIdx + 2]) {
        return decodeURIComponent(segments[productIdx + 2].replace(/-/g, ' '));
      }
    } catch { /* ignore */ }

    return null;
  }

  isShopeeUrl(url: string): boolean {
    return !!url && /https?:\/\/([\w-]+\.)?shopee\.vn/i.test(url);
  }

  isShopeeProductUrl(url: string): boolean {
    return this.isShopeeUrl(url) && (url.includes('/product/') || /\.i\.\d+/i.test(url));
  }

  parseProductIds(url: string): { shopId: number; itemId: number } | null {
    if (!url) return null;
    try {
      const iid = url.match(/[-.]i\.(\d+)\.(\d+)/i);
      if (iid) {
        return { shopId: Number(iid[1]), itemId: Number(iid[2]) };
      }
      const product = url.match(/\/product\/(\d+)\/(\d+)/i);
      if (product) {
        return { shopId: Number(product[1]), itemId: Number(product[2]) };
      }
    } catch {
      return null;
    }
    return null;
  }
}
