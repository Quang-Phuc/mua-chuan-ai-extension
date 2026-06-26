import { Injectable } from '@angular/core';
import { TabUrlService } from './tab-url.service';
import { RatingsFetchResult } from '../models/ratings-fetch.model';

/** Lấy comment trên tab Shopee (tối đa 500), gửi lên BE qua /analyze */
@Injectable({ providedIn: 'root' })
export class ShopeeRatingsService {
  constructor(private tabUrlService: TabUrlService) {}

  async fetchCommentsForUrl(productUrl: string): Promise<RatingsFetchResult> {
    let url = productUrl?.trim() ?? '';
    let ids = this.tabUrlService.parseProductIds(url);

    if (!ids) {
      const pageUrl = await this.tabUrlService.fetchCurrentShopeeUrl();
      if (pageUrl) {
        ids = this.tabUrlService.parseProductIds(pageUrl);
        if (ids) url = pageUrl;
      }
    }

    if (!ids) {
      return {
        comments: [],
        error: 'Link không có mã sản phẩm. Mở trang Shopee và bấm ↻ lấy link.'
      };
    }

    return this.fetchComments(ids.shopId, ids.itemId, url);
  }

  async fetchComments(shopId: number, itemId: number, productUrl?: string): Promise<RatingsFetchResult> {
    const result = await this.fetchCommentsInBrowser(shopId, itemId, productUrl);
    if (result.comments.length) {
      return { comments: result.comments };
    }
    return {
      comments: [],
      error: result.error ?? 'Không lấy được comment Shopee. Mở trang sản phẩm, F5, thử lại.'
    };
  }

  private fetchCommentsInBrowser(
    shopId: number,
    itemId: number,
    productUrl?: string
  ): Promise<{ comments: string[]; error?: string }> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        resolve({ comments: [], error: 'Extension chưa sẵn sàng' });
        return;
      }
      chrome.runtime.sendMessage(
        { action: 'proxy-fetch-comments-browser', shopId, itemId, productUrl },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ comments: [], error: chrome.runtime.lastError.message });
            return;
          }
          if (!response?.ok) {
            resolve({
              comments: response?.comments ?? [],
              error: response?.error ?? 'Không lấy được comment từ tab Shopee'
            });
            return;
          }
          resolve({ comments: response.comments ?? [] });
        }
      );
    });
  }
}
