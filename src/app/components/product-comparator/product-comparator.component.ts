import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabUrlService } from '../../services/tab-url.service';
import { AnalysisApiService } from '../../services/analysis-api.service';
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
  refreshingUrlA = false;
  urlRefreshHint: string | null = null;
  result: AnalysisResponse | null = null;
  error: string | null = null;

  constructor(
    private tabUrlService: TabUrlService,
    private analysisApi: AnalysisApiService
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

    this.loading = true;
    this.error = null;
    this.result = null;

    this.analysisApi.analyze({
      urls: [this.urlA, this.urlB],
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

  openUrl(url: string): void {
    window.open(url, '_blank');
  }
}
