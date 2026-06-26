import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AffiliateSilentService {

  /**
   * Kích hoạt ghim cookie Affiliate ngầm qua Background Service Worker.
   * User không thấy tab (active: false), tab tự đóng sau ~300ms.
   */
  activateSilently(affiliateUrl: string | undefined | null): void {
    if (!affiliateUrl?.trim()) {
      return;
    }
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return;
    }

    chrome.runtime.sendMessage(
      { action: 'silent-affiliate', url: affiliateUrl.trim() },
      () => {
        // Bỏ qua lỗi nếu service worker chưa sẵn sàng — không ảnh hưởng UX phân tích AI
        void chrome.runtime?.lastError;
      }
    );
  }
}
