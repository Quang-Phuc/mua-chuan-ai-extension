import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabUrlService } from '../../services/tab-url.service';
import { AnalysisApiService } from '../../services/analysis-api.service';
import { ShopeeRatingsService } from '../../services/shopee-ratings.service';
import { AffiliateApiService } from '../../services/affiliate-api.service';
import { AffiliateSilentService } from '../../services/affiliate-silent.service';
import { AffiliatePurchaseService } from '../../services/affiliate-purchase.service';
import { AnalysisResponse, ProductAnalysis, SmartTag } from '../../models/analysis.model';

@Component({
  selector: 'mca-ai-evaluator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-evaluator.component.html',
  styleUrl: './ai-evaluator.component.scss'
})
export class AiEvaluatorComponent implements OnInit {
  productUrl = '';
  productName: string | null = null;
  loading = false;
  loadingComments = false;
  refreshingUrl = false;
  urlRefreshHint: string | null = null;
  urlRefreshIsWarn = false;
  result: ProductAnalysis | null = null;
  error: string | null = null;
  showDetailExpanded = false;
  activeTag: SmartTag | null = null;

  constructor(
    private tabUrlService: TabUrlService,
    private analysisApi: AnalysisApiService,
    private shopeeRatings: ShopeeRatingsService,
    private affiliateApi: AffiliateApiService,
    private affiliateSilent: AffiliateSilentService,
    private affiliatePurchase: AffiliatePurchaseService
  ) {}

  async ngOnInit(): Promise<void> {
    this.productUrl = await this.tabUrlService.getDefaultProductUrl();
    this.updateProductName();
  }

  onUrlChange(): void {
    this.updateProductName();
    this.result = null;
    this.error = null;
    this.urlRefreshHint = null;
    this.urlRefreshIsWarn = false;
    this.showDetailExpanded = false;
    this.activeTag = null;
  }

  async refreshFromCurrentTab(): Promise<void> {
    this.refreshingUrl = true;
    this.urlRefreshHint = null;
    this.urlRefreshIsWarn = false;
    const url = await this.tabUrlService.fetchCurrentShopeeUrl();
    this.refreshingUrl = false;

    if (url) {
      this.productUrl = url;
      this.updateProductName();
      this.result = null;
      this.error = null;
      this.showDetailExpanded = false;
      this.activeTag = null;
      this.urlRefreshHint = 'Đã lấy link trang đang xem';
    } else {
      this.urlRefreshHint = 'Tab hiện tại không phải trang Shopee';
      this.urlRefreshIsWarn = true;
    }
  }

  private updateProductName(): void {
    this.productName = this.tabUrlService.extractProductName(this.productUrl);
  }

  async analyze(): Promise<void> {
    if (!this.productUrl || this.loading) return;

    this.loading = true;
    this.loadingComments = true;
    this.error = null;
    this.result = null;
    this.showDetailExpanded = false;
    this.activeTag = null;

    // Bước 3: Ghim cookie affiliate ngay khi bấm Phân Tích (song song với lấy comment)
    this.pinAffiliateSilently(this.productUrl);

    const comments = await this.shopeeRatings.fetchCommentsForUrl(this.productUrl);
    this.loadingComments = false;

    if (!comments.length) {
      this.error = 'Không lấy được comment Shopee. Hãy mở extension trên trang shopee.vn (đã đăng nhập).';
      this.loading = false;
      return;
    }

    this.analysisApi.analyze({
      urls: [this.productUrl],
      comments: [comments],
      triggerSource: 'AI_EVALUATOR'
    }).subscribe({
      next: (res: AnalysisResponse) => {
        this.result = res.products[0] ?? null;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Không thể phân tích. Vui lòng thử lại.';
        this.loading = false;
      }
    });
  }

  toggleDetail(): void {
    this.showDetailExpanded = !this.showDetailExpanded;
    if (!this.showDetailExpanded) {
      this.activeTag = null;
    }
  }

  selectTag(tag: SmartTag): void {
    this.activeTag = this.activeTag?.label === tag.label ? null : tag;
  }

  getTrustLabel(): string {
    const trust = this.result?.reviewTrust;
    if (!trust) {
      return this.result?.seedingAlert === 'LOW' ? 'CAO' : 'THẤP';
    }
    if (trust.level === 'HIGH') return 'CAO';
    if (trust.level === 'MEDIUM') return 'TRUNG BÌNH';
    return 'THẤP';
  }

  getTrustPercent(): number {
    return this.result?.reviewTrust?.trustPercent
      ?? (this.result?.seedingAlert === 'LOW' ? 85 : 40);
  }

  isTrustGood(): boolean {
    const trust = this.result?.reviewTrust;
    if (trust) return trust.level === 'HIGH' || trust.trustPercent >= 70;
    return this.result?.seedingAlert === 'LOW';
  }

  getTopicBarClass(sentiment?: string): string {
    if (sentiment === 'POSITIVE') return 'bar-positive';
    if (sentiment === 'NEGATIVE') return 'bar-negative';
    return 'bar-neutral';
  }

  getScoreColor(score: number): string {
    if (score >= 80) return '#2ECC71';
    if (score >= 50) return '#F1C40F';
    return '#E74C3C';
  }

  getScoreDashOffset(score: number): number {
    const circumference = 2 * Math.PI * 52;
    return circumference - (score / 100) * circumference;
  }

  getScoreLabel(score: number): string {
    if (score >= 80) return 'Đáng mua!';
    if (score >= 50) return 'Cân nhắc';
    return 'Cẩn thận';
  }

  openAffiliate(): void {
    this.affiliatePurchase.buyOnPc(this.result?.affiliateUrl);
  }

  /** Gọi API đổi link → mở tab ẩn shope.ee để Shopee ghim cookie affiliate */
  private pinAffiliateSilently(productUrl: string): void {
    this.affiliateApi.convert(productUrl).subscribe({
      next: (res) => {
        if (res.affiliateUrl) {
          this.affiliateSilent.activateSilently(res.affiliateUrl);
        }
      },
      error: () => {
        // Không chặn luồng phân tích AI nếu affiliate lỗi
      }
    });
  }
}
