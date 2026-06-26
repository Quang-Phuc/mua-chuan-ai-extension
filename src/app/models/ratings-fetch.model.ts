export interface CommentFetchOptions {
  /** 1–5; để trống hoặc đủ 5 sao = lấy tất cả */
  starFilters?: number[];
  onProgress?: (progress: CommentFetchProgress) => void;
}

export interface CommentFetchProgress {
  phase: 'fetch' | 'analyze';
  pagesFetched?: number;
  totalPages?: number;
  commentsCount?: number;
}

export interface RatingsFetchResult {
  comments: string[];
  error?: string;
  meta?: {
    rcountWithContext?: number;
    pagesFetched?: number;
    totalPages?: number;
    capped?: boolean;
    starFilters?: number[];
  };
}
