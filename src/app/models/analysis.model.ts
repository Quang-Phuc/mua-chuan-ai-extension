export interface TopicSummary {
  topic: string;
  percentage: number;
  summary: string;
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface SmartTag {
  label: string;
  count: number;
  sentiment: 'POSITIVE' | 'NEGATIVE';
  sampleComments: string[];
}

export interface ReviewTrustInfo {
  trustPercent: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

export interface VariantInsight {
  title: string;
  summary: string;
}

export interface ProductHistoryWarning {
  detected: boolean;
  message: string;
}

export interface ProductAnalysis {
  url: string;
  productName: string;
  score: number;
  seedingAlert: 'LOW' | 'HIGH';
  price?: number;
  topicSummaries: TopicSummary[];
  pros: string[];
  cons: string[];
  affiliateUrl: string;
  negativeCommentCluster?: string;
  positiveCommentCluster?: string;
  reviewTrust?: ReviewTrustInfo;
  positiveTags?: SmartTag[];
  negativeTags?: SmartTag[];
  variantInsights?: VariantInsight[];
  productHistoryWarning?: ProductHistoryWarning;
}

export interface ComparisonResult {
  winnerIndex: number;
  reason: string;
}

export interface AnalysisResponse {
  products: ProductAnalysis[];
  comparison?: ComparisonResult;
}

export interface AnalysisRequest {
  urls: string[];
  triggerSource: string;
}
