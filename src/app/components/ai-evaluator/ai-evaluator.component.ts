import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabUrlService } from '../../services/tab-url.service';
import { AnalysisApiService } from '../../services/analysis-api.service';
import { ShopeeRatingsService } from '../../services/shopee-ratings.service';
import { AffiliateApiService } from '../../services/affiliate-api.service';
import { AffiliateSilentService } from '../../services/affiliate-silent.service';
import { AffiliatePurchaseService } from '../../services/affiliate-purchase.service';
import { SidebarNavService } from '../../services/sidebar-nav.service';
import { AnalysisResponse, ProductAnalysis, SmartTag } from '../../models/analysis.model';
import { CommentFetchProgress } from '../../models/ratings-fetch.model';
import { buildTagSampleList } from '../../utils/tag-comment-matcher';

@Component({
  selector: 'mca-ai-evaluator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-evaluator.component.html',
  styleUrl: './ai-evaluator.component.scss'
})
export class AiEvaluatorComponent implements OnInit, OnDestroy {
  productUrl = '';
  productName: string | null = null;
  loading = false;
  loadingComments = false;
  loadingAnalyze = false;
  fetchProgress: CommentFetchProgress | null = null;
  loadingTipIndex = 0;
  refreshingUrl = false;
  urlRefreshHint: string | null = null;
  urlRefreshIsWarn = false;
  result: ProductAnalysis | null = null;
  error: string | null = null;
  showDetailExpanded = false;
  activeTag: SmartTag | null = null;
  /** 1–5 sao được chọn; mặc định tất cả */
  selectedStars: number[] = [1, 2, 3, 4, 5];

  sourceComments: string[] = [];
  activeTagSamples: string[] = [];

  private tipTimer: ReturnType<typeof setInterval> | null = null;

  private static readonly FETCH_TIPS = [
    'Đang gom review có chữ — bỏ qua đánh giá trống…',
    'Càng nhiều bình luận, AI càng bắt phốt chuẩn hơn.',
    'Đọc từng review như bạn lướt feed — nhưng không mỏi tay.',
    'Lọc đúng số sao bạn chọn — chỉ lấy comment có nội dung.',
    'Seeding hay thật? Để AI đọc hộ trước khi bạn quyết định.'
  ];

  private static readonly ANALYZE_TIPS = [
    'AI đang tìm tag tiêu cực — né size sai, chất lượng kém…',
    'Tính độ tin cậy review — phát hiện comment ảo, copy-paste.',
    'Gom ưu / nhược từ hàng loạt bình luận thật.',
    'Sắp xong — chuẩn bị xem điểm, độ tin cậy và bộ lọc né phốt.',
    'Một chút nữa thôi — đáng để đợi hơn mua nhầm hàng.'
  ];

  constructor(
    private tabUrlService: TabUrlService,
    private analysisApi: AnalysisApiService,
    private shopeeRatings: ShopeeRatingsService,
    private affiliateApi: AffiliateApiService,
    private affiliateSilent: AffiliateSilentService,
    private affiliatePurchase: AffiliatePurchaseService,
    private sidebarNav: SidebarNavService
  ) {}

  async ngOnInit(): Promise<void> {
    this.productUrl = await this.tabUrlService.getDefaultProductUrl();
    this.updateProductName();
  }

  ngOnDestroy(): void {
    this.stopLoadingTips();
  }

  get currentLoadingTip(): string {
    const tips = this.loadingAnalyze
      ? AiEvaluatorComponent.ANALYZE_TIPS
      : AiEvaluatorComponent.FETCH_TIPS;
    return tips[this.loadingTipIndex % tips.length];
  }

  onUrlChange(): void {
    this.updateProductName();
    this.result = null;
    this.error = null;
    this.urlRefreshHint = null;
    this.urlRefreshIsWarn = false;
    this.showDetailExpanded = false;
    this.activeTag = null;
    this.activeTagSamples = [];
    this.sourceComments = [];
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
    this.activeTagSamples = [];
    this.sourceComments = [];
      this.urlRefreshHint = 'Đã lấy link trang đang xem';
    } else {
      this.urlRefreshHint = 'Tab hiện tại không phải trang Shopee';
      this.urlRefreshIsWarn = true;
    }
  }

  private updateProductName(): void {
    this.productName = this.tabUrlService.extractProductName(this.productUrl);
  }

  analyze(): void {
    if (!this.productUrl || this.loading) return;
    void this.runAnalyzePipeline();
  }

  get fetchProgressPercent(): number {
    if (!this.fetchProgress?.totalPages) return 8;
    const p = Math.round((this.fetchProgress.pagesFetched ?? 0) * 100 / this.fetchProgress.totalPages);
    return Math.min(100, Math.max(8, p));
  }

  private async runAnalyzePipeline(): Promise<void> {
    this.loading = true;
    this.loadingComments = true;
    this.loadingAnalyze = false;
    this.fetchProgress = { phase: 'fetch', pagesFetched: 0, totalPages: 0, commentsCount: 0 };
    this.startLoadingTips();
    this.error = null;
    this.result = null;
    this.showDetailExpanded = false;
    this.activeTag = null;
    this.activeTagSamples = [];
    this.sourceComments = [];

    const liveUrl = await this.tabUrlService.fetchCurrentShopeeUrl();
    if (liveUrl) {
      this.productUrl = liveUrl;
      this.updateProductName();
    }

    this.pinAffiliateSilently(this.productUrl);

    const comments = await this.shopeeRatings.fetchCommentsForUrl(this.productUrl, {
      starFilters: this.getActiveStarFilters(),
      onProgress: (p) => {
        this.fetchProgress = p;
      }
    });

    this.loadingComments = false;

    if (!comments.comments.length) {
      this.stopLoadingTips();
      this.error = comments.error
        ?? 'Không lấy được comment Shopee. Mở trang sản phẩm trên shopee.vn, bấm ↻ lấy link, F5 trang rồi thử lại.';
      this.loading = false;
      this.loadingComments = false;
      this.fetchProgress = null;
      return;
    }

    this.sourceComments = comments.comments;
    this.loadingAnalyze = true;
    this.loadingTipIndex = 0;
    this.fetchProgress = { phase: 'analyze', commentsCount: comments.comments.length };

    this.analysisApi.analyze({
      urls: [this.productUrl],
      comments: [comments.comments],
      triggerSource: 'AI_EVALUATOR'
    }).subscribe({
      next: (res: AnalysisResponse) => {
        this.result = res.products[0] ?? null;
        this.finishLoading();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Không thể phân tích. Vui lòng thử lại.';
        this.finishLoading();
      }
    });
  }

  private finishLoading(): void {
    this.stopLoadingTips();
    this.loading = false;
    this.loadingAnalyze = false;
    this.fetchProgress = null;
  }

  private startLoadingTips(): void {
    this.stopLoadingTips();
    this.loadingTipIndex = 0;
    this.tipTimer = setInterval(() => {
      this.loadingTipIndex++;
    }, 3200);
  }

  private stopLoadingTips(): void {
    if (this.tipTimer) {
      clearInterval(this.tipTimer);
      this.tipTimer = null;
    }
  }

  toggleDetail(): void {
    this.showDetailExpanded = !this.showDetailExpanded;
    if (!this.showDetailExpanded) {
      this.activeTag = null;
      this.activeTagSamples = [];
    }
  }

  selectTag(tag: SmartTag): void {
    if (this.activeTag?.label === tag.label) {
      this.activeTag = null;
      this.activeTagSamples = [];
      return;
    }
    this.activeTag = tag;
    this.activeTagSamples = buildTagSampleList(tag, this.sourceComments);
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

  openCreateGroupBuy(): void {
    this.sidebarNav.openGroupBuy(this.productUrl, true);
  }

  isStarSelected(star: number): boolean {
    return this.selectedStars.includes(star);
  }

  toggleStar(star: number): void {
    if (this.selectedStars.includes(star)) {
      if (this.selectedStars.length <= 1) return;
      this.selectedStars = this.selectedStars.filter((s) => s !== star);
    } else {
      this.selectedStars = [...this.selectedStars, star].sort((a, b) => a - b);
    }
  }

  selectAllStars(): void {
    this.selectedStars = [1, 2, 3, 4, 5];
  }

  private getActiveStarFilters(): number[] {
    return this.selectedStars.length >= 5 ? [] : [...this.selectedStars];
  }

  /** Ghim cookie affiliate — chỉ khi BE đã cấu hình Shopee Affiliate API */
  private pinAffiliateSilently(productUrl: string): void {
    this.affiliateApi.convert(productUrl).subscribe({
      next: (res) => {
        if (res.configured && res.affiliateUrl) {
          this.affiliateSilent.activateSilently(res.affiliateUrl);
        }
      },
      error: () => { /* bypass — dùng link Shopee gốc */ }
    });
  }
}
