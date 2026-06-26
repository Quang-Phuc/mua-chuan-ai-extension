import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabUrlService } from '../../services/tab-url.service';
import { GroupBuyingApiService } from '../../services/group-buying-api.service';
import { AffiliatePurchaseService } from '../../services/affiliate-purchase.service';
import { ShopeeBundleDealService } from '../../services/shopee-bundle-deal.service';
import { SidebarNavService } from '../../services/sidebar-nav.service';
import { BundleDealDetect, CampaignLobby } from '../../models/group-buying.model';
import { buildShareUrl, formatVnd } from '../../utils/group-buy.utils';
import { environment } from '../../../environments/environment';

type ViewMode = 'create' | 'lobby';

@Component({
  selector: 'mca-group-buying',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group-buying.component.html',
  styleUrl: './group-buying.component.scss'
})
export class GroupBuyingComponent implements OnInit {
  @Input() lobbyOnly = false;

  view: ViewMode = 'create';
  productUrl = '';
  productName: string | null = null;

  detecting = false;
  isAutoDetectSuccess = false;
  autoDetectMessage: string | null = null;
  detected: BundleDealDetect | null = null;

  manualTargetQty = 3;
  manualDiscount = '15%';
  manualUnitPrice = 200000;
  manualShipping = 30000;

  creating = false;
  lobby: CampaignLobby | null = null;
  error: string | null = null;

  joinName = '';
  joining = false;
  joinCampaignIdInput = '';
  copyHint: string | null = null;

  private hostUserId = 'host-' + Math.random().toString(36).slice(2, 10);

  constructor(
    private tabUrl: TabUrlService,
    private groupBuyApi: GroupBuyingApiService,
    private affiliatePurchase: AffiliatePurchaseService,
    private bundleDeal: ShopeeBundleDealService,
    private nav: SidebarNavService
  ) {}

  async ngOnInit(): Promise<void> {
    const campaignId = this.parseCampaignId();
    if (campaignId) {
      this.loadLobby(campaignId);
      return;
    }

    const prefill = this.nav.groupBuyPrefillUrl();
    if (prefill) {
      this.productUrl = prefill;
      this.productName = this.tabUrl.extractProductName(prefill);
      const autoDetect = this.nav.groupBuyAutoDetect();
      this.nav.groupBuyPrefillUrl.set(null);
      this.nav.groupBuyAutoDetect.set(false);
      if (autoDetect) {
        await this.startDetect();
      }
      return;
    }

    if (!this.lobbyOnly) {
      this.productUrl = await this.tabUrl.getDefaultProductUrl();
      this.productName = this.tabUrl.extractProductName(this.productUrl);
    }
  }

  private parseCampaignId(): number | null {
    const pathMatch = window.location.pathname.match(/\/keo\/(\d+)/i);
    if (pathMatch) return Number(pathMatch[1]);
    const hashMatch = (window.location.hash || '').match(/keo\/(\d+)/i);
    return hashMatch ? Number(hashMatch[1]) : null;
  }

  async refreshUrl(): Promise<void> {
    const url = await this.tabUrl.fetchCurrentShopeeUrl();
    if (url) {
      this.productUrl = url;
      this.productName = this.tabUrl.extractProductName(url);
      this.resetCreateState();
    }
  }

  async startDetect(): Promise<void> {
    if (!this.productUrl || this.detecting) return;
    this.error = null;
    this.detecting = true;
    this.isAutoDetectSuccess = false;
    this.autoDetectMessage = null;
    this.detected = null;

    const browserDeal = await this.bundleDeal.detectForUrl(this.productUrl);
    if (browserDeal?.success) {
      this.applyDetectResult(browserDeal);
      this.detecting = false;
      return;
    }

    this.groupBuyApi.detect(this.productUrl).subscribe({
      next: (res) => {
        this.detecting = false;
        this.applyDetectResult(res);
      },
      error: () => {
        this.detecting = false;
        this.isAutoDetectSuccess = false;
        this.detected = { success: false, targetQuantity: 0, discountInfo: '', unitPrice: 0, productName: '' };
      }
    });
  }

  private applyDetectResult(res: BundleDealDetect): void {
    this.detected = res;
    if (res.success) {
      this.isAutoDetectSuccess = true;
      this.manualTargetQty = res.targetQuantity || 3;
      this.manualDiscount = res.discountInfo || '15%';
      if (res.unitPrice > 0) this.manualUnitPrice = res.unitPrice;
      if (res.productName) this.productName = res.productName;
      this.autoDetectMessage =
        `Hệ thống tự động phát hiện mã giảm ${res.discountInfo} khi gom đủ ${res.targetQuantity} người!`;
    } else {
      this.isAutoDetectSuccess = false;
      this.autoDetectMessage = null;
    }
  }

  activateCampaign(): void {
    if (!this.productUrl || this.creating) return;
    this.creating = true;
    this.error = null;

    const manualMode = !this.isAutoDetectSuccess;
    this.groupBuyApi.create({
      productUrl: this.productUrl,
      hostUserId: this.hostUserId,
      hostDisplayName: 'Bạn (Người tạo)',
      targetQuantity: manualMode ? this.manualTargetQty : undefined,
      discountInfo: manualMode ? this.manualDiscount : undefined,
      unitPrice: this.manualUnitPrice,
      shippingFee: this.manualShipping,
      manualMode
    }).subscribe({
      next: (lobby) => {
        this.creating = false;
        this.showLobby(lobby);
      },
      error: (err) => {
        this.creating = false;
        const msg = err?.error?.message ?? '';
        if (msg.includes('MANUAL_REQUIRED')) {
          this.isAutoDetectSuccess = false;
          this.error = 'AI không tìm thấy mã gom đơn tự động. Nhập tay số lượng và % giảm bên dưới.';
        } else {
          this.error = msg || 'Không thể tạo kèo. Thử lại sau.';
        }
      }
    });
  }

  loadLobbyByInput(): void {
    const id = Number(this.joinCampaignIdInput.trim());
    if (!id) {
      this.error = 'Nhập mã kèo hợp lệ';
      return;
    }
    this.loadLobby(id);
  }

  loadLobby(id: number): void {
    this.error = null;
    this.groupBuyApi.getLobby(id).subscribe({
      next: (lobby) => this.showLobby(lobby),
      error: (err) => {
        this.error = err?.error?.message ?? 'Không tìm thấy kèo';
      }
    });
  }

  joinLobby(): void {
    if (!this.lobby || this.joining) return;
    this.joining = true;
    this.groupBuyApi.join(this.lobby.campaignId, this.joinName || undefined).subscribe({
      next: (lobby) => {
        this.lobby = lobby;
        this.joining = false;
        this.joinName = '';
      },
      error: (err) => {
        this.joining = false;
        this.error = err?.error?.message ?? 'Không thể tham gia kèo';
      }
    });
  }

  buyOnShopee(): void {
    if (!this.lobby?.affiliateUrl) return;
    this.affiliatePurchase.buyOnPc(this.lobby.affiliateUrl);
  }

  copyShareLink(): void {
    const url = this.displayShareUrl;
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => {
      this.copyHint = 'Đã copy link chia sẻ!';
      setTimeout(() => (this.copyHint = null), 2000);
    });
  }

  async shareNative(): Promise<void> {
    const url = this.displayShareUrl;
    if (!url || !this.lobby) return;
    const payload = {
      title: `Kèo mua chung: ${this.lobby.productName}`,
      text: this.lobby.highlightMessage,
      url
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
      } catch {
        this.copyShareLink();
      }
    } else {
      this.copyShareLink();
    }
  }

  get displayShareUrl(): string {
    if (!this.lobby) return '';
    return buildShareUrl(environment.shareBaseUrl, this.lobby.campaignId);
  }

  backToCreate(): void {
    this.view = 'create';
    this.lobby = null;
    this.resetCreateState();
  }

  formatVnd(amount: number): string {
    return formatVnd(amount);
  }

  progressBlocks(): string {
    if (!this.lobby) return '';
    const total = 10;
    const filled = Math.round((this.lobby.progressPercent / 100) * total);
    return '█'.repeat(filled) + '░'.repeat(total - filled);
  }

  private showLobby(lobby: CampaignLobby): void {
    this.lobby = {
      ...lobby,
      shareUrl: buildShareUrl(environment.shareBaseUrl, lobby.campaignId)
    };
    this.view = 'lobby';
    if (this.lobbyOnly || /\/keo\/\d+/i.test(window.location.pathname)) {
      window.history.replaceState(null, '', `/keo/${lobby.campaignId}`);
    } else {
      window.location.hash = `keo/${lobby.campaignId}`;
    }
  }

  private resetCreateState(): void {
    this.detecting = false;
    this.isAutoDetectSuccess = false;
    this.autoDetectMessage = null;
    this.detected = null;
    this.error = null;
  }
}
