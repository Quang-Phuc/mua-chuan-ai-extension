export interface CommentFetchOptions {
  /** 1–5; để trống hoặc đủ 5 sao = lấy tất cả */
  starFilters?: number[];
}

export interface RatingsFetchResult {
  comments: string[];
  error?: string;
  meta?: {
    rcountWithContext?: number;
    pagesFetched?: number;
    capped?: boolean;
    starFilters?: number[];
  };
}
