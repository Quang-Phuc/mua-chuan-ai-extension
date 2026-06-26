import { Injectable } from '@angular/core';
import { TabUrlService } from './tab-url.service';
import { RatingsFetchResult } from '../models/ratings-fetch.model';

/** Lấy comment trực tiếp trên tab Shopee (page-bridge), gửi lên BE chỉ khi /analyze */
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
    const comments = await this.fetchCommentsInBrowser(shopId, itemId, productUrl);
    if (comments.length) {
      return { comments };
    }
    return {
      comments: [],
      error: 'Không lấy được comment Shopee. Mở trang sản phẩm, F5, thử lại.'
    };
  }

  private fetchCommentsInBrowser(
    shopId: number,
    itemId: number,
    productUrl?: string
  ): Promise<string[]> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        resolve([]);
        return;
      }
      chrome.runtime.sendMessage(
        { action: 'proxy-fetch-comments-browser', shopId, itemId, productUrl, maxComments: 300 },
        (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            resolve([]);
            return;
          }
          resolve(response.comments ?? []);
        }
      );
    });
  }
}
