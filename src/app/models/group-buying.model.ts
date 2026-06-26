export interface BundleDealDetect {
  success: boolean;
  targetQuantity: number;
  discountInfo: string;
  unitPrice: number;
  productName: string;
}

export interface SplitBillRow {
  participantName: string;
  originalPrice: number;
  discountedPrice: number;
  shippingShare: number;
  totalPay: number;
  host: boolean;
}

export interface CampaignLobby {
  campaignId: number;
  shareUrl: string;
  productName: string;
  productUrl: string;
  affiliateUrl: string;
  targetQuantity: number;
  currentJoined: number;
  remaining: number;
  progressPercent: number;
  discountInfo: string;
  status: string;
  highlightMessage: string;
  expired: boolean;
  splitBill: SplitBillRow[];
  participants: string[];
}

export interface CreateCampaignPayload {
  productUrl: string;
  hostUserId?: string;
  hostDisplayName?: string;
  targetQuantity?: number;
  discountInfo?: string;
  unitPrice?: number;
  shippingFee?: number;
  manualMode: boolean;
}
