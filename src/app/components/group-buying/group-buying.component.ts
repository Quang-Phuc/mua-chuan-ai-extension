import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabUrlService } from '../../services/tab-url.service';
import { GroupBuyingApiService } from '../../services/group-buying-api.service';
import { AffiliatePurchaseService } from '../../services/affiliate-purchase.service';
import { BundleDealDetect, CampaignLobby } from '../../models/group-buying.model';

type ViewMode = 'create' | 'lobby';

@Component({
  selector: 'mca-group-buying',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group-buying.component.html',
  styleUrl: './group-buying.component.scss'
})
export class GroupBuyingComponent implements OnInit {
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
    private affiliatePurchase: AffiliatePurchaseService
  ) {}

  async ngOnInit(): Promise<void> {
    const hashId = this.parseCampaignIdFromHash();
    if (hashId) {
      this.loadLobby(hashId);
      return;
    }
    this.productUrl = await this.tabUrl.getDefaultProductUrl();
    this.productName = this.tabUrl.extractProductName(this.productUrl);
  }

  private parseCampaignIdFromHash(): number | null {
    const hash = window.location.hash || '';
    const m = hash.match(/keo\/(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  async refreshUrl(): Promise<void> {
    const url = await this.tabUrl.fetchCurrentShopeeUrl();
    if (url) {
      this.productUrl = url;
      this.productName = this.tabUrl.extractProductName(url);
      this.resetCreateState();
    }
  }

  startDetect(): void {
    if (!this.productUrl || this.detecting) return;
    this.error = null;
    this.detecting = true;
    this.isAutoDetectSuccess = false;
    this.autoDetectMessage = null;

    this.groupBuyApi.detect(this.productUrl).subscribe({
      next: (res) => {
        this.detecting = false;
        this.detected = res;
        if (res.success) {
          this.isAutoDetectSuccess = true;
          this.manualTargetQty = res.targetQuantity || 3;
          this.manualDiscount = res.discountInfo || '15%';
          this.manualUnitPrice = res.unitPrice || 200000;
          this.autoDetectMessage =
            `Hệ thống tự động phát hiện mã giảm ${res.discountInfo} khi gom đủ ${res.targetQuantity} người!`;
        } else {
          this.isAutoDetectSuccess = false;
          this.autoDetectMessage = null;
        }
      },
      error: () => {
        this.detecting = false;
        this.isAutoDetectSuccess = false;
      }
    });
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
    if (!this.lobby?.shareUrl) return;
    navigator.clipboard?.writeText(this.lobby.shareUrl).then(() => {
      this.copyHint = 'Đã copy link chia sẻ!';
      setTimeout(() => (this.copyHint = null), 2000);
    });
  }

  backToCreate(): void {
    this.view = 'create';
    this.lobby = null;
    this.resetCreateState();
  }

  formatVnd(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  }

  progressBlocks(): string {
    if (!this.lobby) return '';
    const total = 10;
    const filled = Math.round((this.lobby.progressPercent / 100) * total);
    return '█'.repeat(filled) + '░'.repeat(total - filled);
  }

  private showLobby(lobby: CampaignLobby): void {
    this.lobby = lobby;
    this.view = 'lobby';
    window.location.hash = `keo/${lobby.campaignId}`;
  }

  private resetCreateState(): void {
    this.detecting = false;
    this.isAutoDetectSuccess = false;
    this.autoDetectMessage = null;
    this.detected = null;
    this.error = null;
  }
}
