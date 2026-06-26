/**
 * MAIN world — paginate get_ratings (filter=1), fetch song song + báo tiến trình.
 */
(function () {
  if (window.__mcaPageBridge) return;
  window.__mcaPageBridge = true;
  document.documentElement.dataset.mcaBridgeReady = '1';

  const PAGE_SIZE = 6;
  const MAX_COMMENTS = 500;
  const MAX_PAGES = Math.ceil(MAX_COMMENTS / PAGE_SIZE);
  const FILTER_WITH_TEXT = 1;
  const FETCH_CONCURRENCY = 4;

  function getCsrf() {
    const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function productReferer(shopId, itemId, referer) {
    if (referer && String(referer).includes('shopee.vn')) return referer;
    return 'https://shopee.vn/product/' + shopId + '/' + itemId;
  }

  function buildRatingsUrl(shopId, itemId, offset, opts) {
    const type = opts && opts.type != null ? String(opts.type) : '0';
    const params = new URLSearchParams({
      filter: String(opts && opts.filter != null ? opts.filter : FILTER_WITH_TEXT),
      flag: '1',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      type: type,
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

  function extractCommentText(r) {
    return (r.comment || r.comment_region || r.cmt || r.review || '').trim();
  }

  function emitProgress(requestId, payload) {
    if (!requestId) return;
    document.dispatchEvent(new CustomEvent('mca-browser-comments-progress', {
      detail: Object.assign({ requestId: requestId, phase: 'fetch' }, payload)
    }));
  }

  function normalizeStarFilters(starFilters) {
    if (!Array.isArray(starFilters) || !starFilters.length) return [];
    const stars = starFilters
      .map(function (s) { return Number(s); })
      .filter(function (s) { return s >= 1 && s <= 5; });
    const unique = [];
    stars.forEach(function (s) {
      if (unique.indexOf(s) < 0) unique.push(s);
    });
    unique.sort();
    return unique.length === 5 ? [] : unique;
  }

  function countForStar(summary, star) {
    if (!summary || !star) return 0;
    const arr = summary.rating_count;
    if (Array.isArray(arr)) {
      const byIndex = Number(arr[star] ?? arr[star - 1] ?? 0);
      if (byIndex > 0) return byIndex;
    }
    return 0;
  }

  function buildFetchPlan(data, opts) {
    const summary = data.item_rating_summary || {};
    const rcountWithContext = Number(summary.rcount_with_context ?? 0);
    const ratingTotal = Number(summary.rating_total ?? data.item_rating_count ?? 0);
    const star = opts && opts.type ? Number(opts.type) : 0;

    let total = 0;
    if (opts && opts.filter === FILTER_WITH_TEXT && rcountWithContext > 0 && star === 0) {
      total = rcountWithContext;
    } else if (star >= 1 && star <= 5) {
      total = countForStar(summary, star) || rcountWithContext || ratingTotal;
    } else {
      total = rcountWithContext || ratingTotal;
    }

    const hasTotal = Number.isFinite(total) && total > 0;
    const targetRatings = hasTotal ? Math.min(total, MAX_COMMENTS) : MAX_COMMENTS;
    const totalPages = Math.min(Math.ceil(targetRatings / PAGE_SIZE), MAX_PAGES);
    return {
      ratingTotal: hasTotal ? total : null,
      rcountWithContext: rcountWithContext,
      totalPages: totalPages,
      capped: hasTotal && total > MAX_COMMENTS
    };
  }

  async function fetchRatingsPage(shopId, itemId, offset, ref, opts) {
    const res = await window.fetch(buildRatingsUrl(shopId, itemId, offset, opts), {
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

  function appendTextComments(comments, ratings) {
    ratings.forEach(function (r) {
      const text = extractCommentText(r);
      if (text) comments.push(text);
    });
  }

  async function fetchRemainingPages(shopId, itemId, ref, streamOpts, offsets, comments, cap, requestId, pagesFetched, totalPages) {
    for (let i = 0; i < offsets.length && comments.length < cap; i += FETCH_CONCURRENCY) {
      const batch = offsets.slice(i, i + FETCH_CONCURRENCY);
      const pages = await Promise.all(
        batch.map(function (off) {
          return fetchRatingsPage(shopId, itemId, off, ref, streamOpts);
        })
      );

      let shouldStop = false;
      pages.forEach(function (page) {
        if (shouldStop) return;
        if (!page.ratings.length) {
          shouldStop = true;
          return;
        }
        appendTextComments(comments, page.ratings);
        if (comments.length >= cap) shouldStop = true;
        if (page.data.has_more !== true || page.ratings.length < PAGE_SIZE) shouldStop = true;
      });

      pagesFetched += batch.length;
      emitProgress(requestId, {
        pagesFetched: pagesFetched,
        totalPages: totalPages,
        commentsCount: comments.length
      });

      if (shouldStop || comments.length >= cap) break;
    }
    return pagesFetched;
  }

  async function fetchCommentStream(shopId, itemId, referer, opts, maxComments, requestId) {
    const ref = productReferer(shopId, itemId, referer);
    const streamOpts = {
      filter: FILTER_WITH_TEXT,
      type: opts && opts.type != null ? opts.type : 0
    };
    const cap = Math.min(maxComments || MAX_COMMENTS, MAX_COMMENTS);
    const comments = [];

    const first = await fetchRatingsPage(shopId, itemId, 0, ref, streamOpts);
    appendTextComments(comments, first.ratings);

    const plan = buildFetchPlan(first.data, streamOpts);
    let pagesFetched = 1;
    const maxPages = Math.min(plan.totalPages, Math.ceil(cap / PAGE_SIZE));

    emitProgress(requestId, {
      pagesFetched: pagesFetched,
      totalPages: maxPages,
      commentsCount: comments.length
    });

    const offsets = [];
    for (let o = PAGE_SIZE; o < maxPages * PAGE_SIZE; o += PAGE_SIZE) {
      offsets.push(o);
    }

    if (offsets.length && comments.length < cap) {
      pagesFetched = await fetchRemainingPages(
        shopId, itemId, ref, streamOpts, offsets,
        comments, cap, requestId, pagesFetched, maxPages
      );
    }

    return {
      comments: comments.slice(0, cap),
      pagesFetched: pagesFetched,
      plan: plan
    };
  }

  async function fetchAllCommentsInBrowser(shopId, itemId, referer, options) {
    const requestId = options && options.requestId;
    const ref = productReferer(shopId, itemId, referer || location.href);
    const stars = normalizeStarFilters(options && options.starFilters);
    const allComments = [];
    let pagesFetched = 0;
    let meta = {};

    if (!stars.length) {
      const stream = await fetchCommentStream(shopId, itemId, ref, { type: 0 }, MAX_COMMENTS, requestId);
      if (!stream.comments.length) {
        throw new Error('Không có đánh giá có chữ — thử bỏ bớt lọc sao');
      }
      return {
        comments: stream.comments,
        meta: {
          ratingTotal: stream.plan.ratingTotal,
          rcountWithContext: stream.plan.rcountWithContext,
          totalPages: stream.plan.totalPages,
          pagesFetched: stream.pagesFetched,
          capped: stream.plan.capped,
          starFilters: [1, 2, 3, 4, 5],
          textOnly: true
        }
      };
    }

    const perStar = Math.ceil(MAX_COMMENTS / stars.length);
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const stream = await fetchCommentStream(shopId, itemId, ref, { type: star }, perStar, requestId);
      pagesFetched += stream.pagesFetched;
      stream.comments.forEach(function (c) {
        if (allComments.length < MAX_COMMENTS) {
          allComments.push('[' + star + '★] ' + c);
        }
      });
      if (i === 0) {
        meta = {
          ratingTotal: stream.plan.ratingTotal,
          rcountWithContext: stream.plan.rcountWithContext
        };
      }
      if (allComments.length >= MAX_COMMENTS) break;
    }

    if (!allComments.length) {
      throw new Error('Không có comment ở mức sao đã chọn');
    }

    return {
      comments: allComments.slice(0, MAX_COMMENTS),
      meta: Object.assign(meta, {
        totalPages: pagesFetched,
        pagesFetched: pagesFetched,
        capped: allComments.length >= MAX_COMMENTS,
        starFilters: stars,
        textOnly: true
      })
    };
  }

  document.addEventListener('mca-browser-fetch-comments', function (ev) {
    const detail = ev.detail || {};
    fetchAllCommentsInBrowser(
      detail.shopId,
      detail.itemId,
      detail.referer || location.href,
      { starFilters: detail.starFilters, requestId: detail.requestId }
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
