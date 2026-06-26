import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabUrlService } from '../../services/tab-url.service';
import { AnalysisApiService } from '../../services/analysis-api.service';
import { ShopeeRatingsService } from '../../services/shopee-ratings.service';
import { AffiliateApiService } from '../../services/affiliate-api.service';
import { AffiliateSilentService } from '../../services/affiliate-silent.service';
import { AffiliatePurchaseService } from '../../services/affiliate-purchase.service';
import { AnalysisResponse, ProductAnalysis } from '../../models/analysis.model';

@Component({
  selector: 'mca-product-comparator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-comparator.component.html',
  styleUrl: './product-comparator.component.scss'
})
export class ProductComparatorComponent implements OnInit {
  urlA = '';
  urlB = '';
  loading = false;
  loadingComments = false;
  refreshingUrlA = false;
  urlRefreshHint: string | null = null;
  result: AnalysisResponse | null = null;
  error: string | null = null;

  constructor(
    private tabUrlService: TabUrlService,
    private analysisApi: AnalysisApiService,
    private shopeeRatings: ShopeeRatingsService,
    private affiliateApi: AffiliateApiService,
    private affiliateSilent: AffiliateSilentService,
    private affiliatePurchase: AffiliatePurchaseService
  ) {}

  async ngOnInit(): Promise<void> {
    this.urlA = await this.tabUrlService.getDefaultProductUrl();
  }

  async refreshUrlAFromTab(): Promise<void> {
    this.refreshingUrlA = true;
    this.urlRefreshHint = null;
    const url = await this.tabUrlService.fetchCurrentShopeeUrl();
    this.refreshingUrlA = false;

    if (url) {
      this.urlA = url;
      this.result = null;
      this.error = null;
      this.urlRefreshHint = 'Đã lấy link trang đang xem';
    } else {
      this.urlRefreshHint = 'Tab hiện tại không phải trang Shopee';
    }
  }

  async compare(): Promise<void> {
    if (!this.urlA || !this.urlB || this.loading) return;

    this.loading = true;
    this.loadingComments = true;
    this.error = null;
    this.result = null;

    this.pinAffiliateSilently(this.urlA);
    this.pinAffiliateSilently(this.urlB);

    const [resultA, resultB] = await Promise.all([
      this.shopeeRatings.fetchCommentsForUrl(this.urlA),
      this.shopeeRatings.fetchCommentsForUrl(this.urlB)
    ]);
    const commentsA = resultA.comments;
    const commentsB = resultB.comments;
    this.loadingComments = false;

    if (!commentsA.length && !commentsB.length) {
      this.error = resultA.error ?? resultB.error
        ?? 'Không lấy được comment. Mở trang sản phẩm Shopee, F5 trang rồi thử lại.';
      this.loading = false;
      return;
    }

    this.analysisApi.analyze({
      urls: [this.urlA, this.urlB],
      comments: [commentsA, commentsB],
      triggerSource: 'PRODUCT_COMPARATOR'
    }).subscribe({
      next: (res) => {
        this.result = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Không thể so sánh. Vui lòng thử lại.';
        this.loading = false;
      }
    });
  }

  getProduct(index: number): ProductAnalysis | null {
    return this.result?.products[index] ?? null;
  }

  isWinner(index: number): boolean {
    return this.result?.comparison?.winnerIndex === index;
  }

  buyProduct(affiliateUrl: string | undefined, fallbackUrl: string): void {
    this.affiliatePurchase.buyOnPc(affiliateUrl || fallbackUrl);
  }

  private pinAffiliateSilently(productUrl: string): void {
    this.affiliateApi.convert(productUrl).subscribe({
      next: (res) => {
        if (res.configured && res.affiliateUrl) {
          this.affiliateSilent.activateSilently(res.affiliateUrl);
        }
      },
      error: () => {}
    });
  }
}
