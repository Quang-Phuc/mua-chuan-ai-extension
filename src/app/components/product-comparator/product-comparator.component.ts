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
import { CommentFetchProgress } from '../../models/ratings-fetch.model';

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
  selectedStars: number[] = [1, 2, 3, 4, 5];
  fetchProgress: CommentFetchProgress | null = null;

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

  compare(): void {
    if (!this.urlA || !this.urlB || this.loading) return;
    void this.runCompare();
  }

  private async runCompare(): Promise<void> {
    this.loading = true;
    this.loadingComments = true;
    this.error = null;
    this.result = null;
    this.fetchProgress = { phase: 'fetch', pagesFetched: 0, totalPages: 0, commentsCount: 0 };

    this.pinAffiliateSilently(this.urlA);
    this.pinAffiliateSilently(this.urlB);

    const opts = {
      starFilters: this.selectedStars.length >= 5 ? undefined : [...this.selectedStars],
      onProgress: (p: CommentFetchProgress) => { this.fetchProgress = p; }
    };
    const starOpts = this.selectedStars.length >= 5
      ? { onProgress: opts.onProgress }
      : { starFilters: opts.starFilters, onProgress: opts.onProgress };

    const [resultA, resultB] = await Promise.all([
      this.shopeeRatings.fetchCommentsForUrl(this.urlA, starOpts),
      this.shopeeRatings.fetchCommentsForUrl(this.urlB, starOpts)
    ]);
    const commentsA = resultA.comments;
    const commentsB = resultB.comments;
    this.loadingComments = false;
    this.fetchProgress = { phase: 'analyze', commentsCount: commentsA.length + commentsB.length };

    if (!commentsA.length && !commentsB.length) {
      this.error = resultA.error ?? resultB.error
        ?? 'Không lấy được comment. Mở trang sản phẩm Shopee, F5 trang rồi thử lại.';
      this.loading = false;
      this.fetchProgress = null;
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
        this.fetchProgress = null;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Không thể so sánh. Vui lòng thử lại.';
        this.loading = false;
        this.fetchProgress = null;
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
