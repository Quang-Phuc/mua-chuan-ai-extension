import { Injectable } from '@angular/core';
import { TabUrlService } from './tab-url.service';

@Injectable({ providedIn: 'root' })
export class ShopeeRatingsService {
  private readonly FETCH_TIMEOUT_MS = 60000;

  constructor(private tabUrlService: TabUrlService) {}

  async fetchCommentsForUrl(productUrl: string): Promise<string[]> {
    const ids = this.tabUrlService.parseProductIds(productUrl);
    if (!ids) {
      return [];
    }
    return this.fetchComments(ids.shopId, ids.itemId);
  }

  async fetchComments(shopId: number, itemId: number): Promise<string[]> {
    if (window.parent !== window) {
      const fromParent = await this.requestFromParent(shopId, itemId);
      if (fromParent.length > 0) {
        return fromParent;
      }
    }
    return this.requestViaContentScript(shopId, itemId);
  }

  private requestFromParent(shopId: number, itemId: number): Promise<string[]> {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data?.type === 'mca-ratings-result' &&
          event.data.shopId === shopId &&
          event.data.itemId === itemId
        ) {
          cleanup();
          resolve(event.data.comments ?? []);
        }
        if (
          event.data?.type === 'mca-ratings-error' &&
          event.data.shopId === shopId &&
          event.data.itemId === itemId
        ) {
          cleanup();
          resolve([]);
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve([]);
      }, this.FETCH_TIMEOUT_MS);

      const cleanup = () => {
        window.removeEventListener('message', handler);
        clearTimeout(timer);
      };

      window.addEventListener('message', handler);
      window.parent.postMessage({ type: 'mca-fetch-ratings', shopId, itemId }, '*');
    });
  }

  private requestViaContentScript(shopId: number, itemId: number): Promise<string[]> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
        resolve([]);
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        const tabUrl = tabs[0]?.url ?? '';
        if (!tabId || !this.tabUrlService.isShopeeUrl(tabUrl)) {
          resolve([]);
          return;
        }

        chrome.tabs.sendMessage(
          tabId,
          { action: 'fetch-ratings', shopId, itemId },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve([]);
              return;
            }
            resolve(response?.comments ?? []);
          }
        );
      });
    });
  }
}
