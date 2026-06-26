import { Injectable } from '@angular/core';
import { TabUrlService } from './tab-url.service';
import { BundleDealDetect } from '../models/group-buying.model';

@Injectable({ providedIn: 'root' })
export class ShopeeBundleDealService {
  constructor(private tabUrl: TabUrlService) {}

  async detectForUrl(productUrl: string): Promise<BundleDealDetect | null> {
    const ids = this.tabUrl.parseProductIds(productUrl);
    if (!ids) return null;
    return this.detect(ids.shopId, ids.itemId);
  }

  async detect(shopId: number, itemId: number): Promise<BundleDealDetect | null> {
    if (window.parent !== window) {
      const fromParent = await this.requestFromParent(shopId, itemId);
      if (fromParent) return fromParent;
    }
    return this.requestViaContentScript(shopId, itemId);
  }

  private requestFromParent(shopId: number, itemId: number): Promise<BundleDealDetect | null> {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data?.type === 'mca-bundle-deal-result' &&
          event.data.shopId === shopId &&
          event.data.itemId === itemId
        ) {
          cleanup();
          resolve(event.data.deal ?? null);
        }
      };
      const timer = setTimeout(() => { cleanup(); resolve(null); }, 20000);
      const cleanup = () => {
        window.removeEventListener('message', handler);
        clearTimeout(timer);
      };
      window.addEventListener('message', handler);
      window.parent.postMessage({ type: 'mca-fetch-bundle-deal', shopId, itemId }, '*');
    });
  }

  private requestViaContentScript(shopId: number, itemId: number): Promise<BundleDealDetect | null> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
        resolve(null);
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (!tabId || !this.tabUrl.isShopeeUrl(tabs[0]?.url ?? '')) {
          resolve(null);
          return;
        }
        chrome.tabs.sendMessage(
          tabId,
          { action: 'fetch-bundle-deal', shopId, itemId },
          (res) => resolve(res?.deal ?? null)
        );
      });
    });
  }
}
