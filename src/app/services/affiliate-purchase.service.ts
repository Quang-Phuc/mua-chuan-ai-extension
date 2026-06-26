import { Injectable } from '@angular/core';
import { AffiliateSilentService } from './affiliate-silent.service';

/**
 * Mua hàng trên PC: ghim cookie affiliate + chuyển tab Shopee hiện tại sang link shope.ee.
 */
@Injectable({ providedIn: 'root' })
export class AffiliatePurchaseService {

  constructor(private affiliateSilent: AffiliateSilentService) {}

  buyOnPc(affiliateUrl: string | undefined | null): void {
    const url = affiliateUrl?.trim();
    if (!url) {
      return;
    }

    this.affiliateSilent.activateSilently(url);

    // Sidebar iframe trên shopee.vn → chuyển trang cha (tab PC user đang xem)
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'mca-navigate-affiliate', url }, '*');
      return;
    }

    // Popup extension: cập nhật tab Shopee đang active
    if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.update) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id && tab.url && /shopee\.vn/i.test(tab.url)) {
          chrome.tabs.update(tab.id, { url });
        } else {
          chrome.tabs.create({ url, active: true });
        }
      });
      return;
    }

    window.location.href = url;
  }
}
