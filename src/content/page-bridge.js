/**
 * MAIN world — paginate get_ratings trên tab Shopee.
 * Trang 1: đọc rating_total → tính số trang; tối đa 500 comment.
 */
(function () {
  if (window.__mcaPageBridge) return;
  window.__mcaPageBridge = true;
  document.documentElement.dataset.mcaBridgeReady = '1';

  const PAGE_SIZE = 6;
  const MAX_COMMENTS = 500;
  const MAX_PAGES = Math.ceil(MAX_COMMENTS / PAGE_SIZE);

  function getCsrf() {
    const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function productReferer(shopId, itemId, referer) {
    if (referer && String(referer).includes('shopee.vn')) return referer;
    return 'https://shopee.vn/product/' + shopId + '/' + itemId;
  }

  function buildRatingsUrl(shopId, itemId, offset) {
    const params = new URLSearchParams({
      filter: '0',
      flag: '1',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      type: '0',
      exclude_filter: '1',
      filter_size: '0',
      fold_filter: '0',
      relevant_reviews: 'false',
      request_source: '2',
      tag_filter: '',
      variation_filters: '',
      need_translation: '1',
      shopid: String(shopId),
      itemid: String(itemId),
      fe_toggle: '[2,3]',
      preferred_item_shop_id: String(shopId),
      preferred_item_item_id: String(itemId),
      preferred_item_include_type: '1'
    });
    return 'https://shopee.vn/api/v2/item/get_ratings?' + params.toString();
  }

  function buildBaseHeaders(referer) {
    const headers = {
      accept: 'application/json',
      'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
      'content-type': 'application/json',
      'x-api-source': 'pc',
      'x-requested-with': 'XMLHttpRequest',
      'x-shopee-language': 'vi',
      referer: referer
    };
    const csrf = getCsrf();
    if (csrf) headers['x-csrftoken'] = csrf;
    return headers;
  }

  function isShopeeApiError(json) {
    if (!json || typeof json !== 'object') return true;
    if (json.error != null && Number(json.error) !== 0) return true;
    if (json.err != null && Number(json.err) !== 0) return true;
    return false;
  }

  function extractComment(r) {
    const text = (r.comment || r.comment_region || r.cmt || r.review || '').trim();
    if (text) return text;
    const star = r.rating_star != null ? r.rating_star : r.rating;
    const user = r.author_username || r.username || 'Người mua';
    if (star) return '[' + star + ' sao] ' + user;
    return '';
  }

  /** Tính số trang cần gọi từ rating_total; không có total → tối đa MAX_PAGES */
  function buildFetchPlan(data) {
    const summary = data.item_rating_summary || {};
    const ratingTotal = Number(
      summary.rating_total ?? data.item_rating_count ?? 0
    );
    const rcountWithContext = Number(summary.rcount_with_context ?? 0);
    const hasTotal = Number.isFinite(ratingTotal) && ratingTotal > 0;
    const targetRatings = hasTotal ? Math.min(ratingTotal, MAX_COMMENTS) : MAX_COMMENTS;
    const totalPages = Math.min(Math.ceil(targetRatings / PAGE_SIZE), MAX_PAGES);
    return {
      ratingTotal: hasTotal ? ratingTotal : null,
      rcountWithContext: rcountWithContext,
      totalPages: totalPages,
      capped: hasTotal && ratingTotal > MAX_COMMENTS
    };
  }

  async function fetchRatingsPage(shopId, itemId, offset, ref) {
    const res = await window.fetch(buildRatingsUrl(shopId, itemId, offset), {
      credentials: 'include',
      headers: buildBaseHeaders(ref)
    });
    if (!res.ok) {
      throw new Error('Shopee HTTP ' + res.status + (res.status === 403 ? ' — F5 trang rồi thử lại' : ''));
    }
    const json = await res.json();
    if (isShopeeApiError(json)) {
      const msg = json.error_msg || json.message || ('Shopee error ' + json.error);
      throw new Error(msg);
    }
    const data = json.data || {};
    return { data: data, ratings: data.ratings || [] };
  }

  function appendRatings(comments, ratings) {
    ratings.forEach(function (r) {
      const t = extractComment(r);
      if (t) comments.push(t);
    });
  }

  async function fetchAllCommentsInBrowser(shopId, itemId, referer) {
    const ref = productReferer(shopId, itemId, referer || location.href);
    const comments = [];
    let pagesFetched = 0;

    const first = await fetchRatingsPage(shopId, itemId, 0, ref);
    pagesFetched++;
    appendRatings(comments, first.ratings);

    if (!first.ratings.length && !comments.length) {
      throw new Error('Shopee không trả đánh giá — kiểm tra đã mở đúng trang sản phẩm');
    }

    const plan = buildFetchPlan(first.data);
    let offset = PAGE_SIZE;

    while (pagesFetched < plan.totalPages && comments.length < MAX_COMMENTS) {
      const page = await fetchRatingsPage(shopId, itemId, offset, ref);
      pagesFetched++;

      if (!page.ratings.length) break;
      appendRatings(comments, page.ratings);

      if (comments.length >= MAX_COMMENTS) break;
      if (page.data.has_more !== true) break;
      if (page.ratings.length < PAGE_SIZE) break;

      offset += PAGE_SIZE;
    }

    const result = comments.slice(0, MAX_COMMENTS);
    if (!result.length) {
      throw new Error('Không parse được nội dung đánh giá');
    }

    return {
      comments: result,
      meta: {
        ratingTotal: plan.ratingTotal,
        rcountWithContext: plan.rcountWithContext,
        totalPages: plan.totalPages,
        pagesFetched: pagesFetched,
        capped: plan.capped || result.length >= MAX_COMMENTS
      }
    };
  }

  document.addEventListener('mca-browser-fetch-comments', function (ev) {
    const detail = ev.detail || {};
    fetchAllCommentsInBrowser(
      detail.shopId,
      detail.itemId,
      detail.referer || location.href
    )
      .then(function (result) {
        document.dispatchEvent(new CustomEvent('mca-browser-comments-response', {
          detail: {
            requestId: detail.requestId,
            ok: true,
            comments: result.comments,
            meta: result.meta
          }
        }));
      })
      .catch(function (err) {
        document.dispatchEvent(new CustomEvent('mca-browser-comments-response', {
          detail: {
            requestId: detail.requestId,
            ok: false,
            error: err.message || 'Lỗi lấy comment',
            comments: []
          }
        }));
      });
  });
})();
