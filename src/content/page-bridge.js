/**
 * MAIN world — paginate get_ratings trên tab Shopee (cùng cookie user).
 */
(function () {
  if (window.__mcaPageBridge) return;
  window.__mcaPageBridge = true;
  document.documentElement.dataset.mcaBridgeReady = '1';

  const PAGE_SIZE = 6;
  const MAX_COMMENTS = 300;

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

  function extractComment(r) {
    const text = (r.comment || r.comment_region || r.cmt || r.review || '').trim();
    if (text) return text;
    const star = r.rating_star != null ? r.rating_star : r.rating;
    const user = r.author_username || r.username || 'Người mua';
    if (star) return '[' + star + ' sao] ' + user + ' — không có bình luận chữ';
    return '';
  }

  async function fetchAllCommentsInBrowser(shopId, itemId, referer, maxComments) {
    const ref = productReferer(shopId, itemId, referer || location.href);
    const max = maxComments || MAX_COMMENTS;
    const comments = [];
    let offset = 0;
    let hasMore = true;

    while (comments.length < max && hasMore) {
      const res = await window.fetch(buildRatingsUrl(shopId, itemId, offset), {
        credentials: 'include',
        headers: buildBaseHeaders(ref)
      });
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const json = await res.json();
      if (json.error || json.err) {
        throw new Error(json.error_msg || json.message || 'Shopee từ chối');
      }
      const data = json.data || {};
      const ratings = data.ratings || [];
      ratings.forEach(function (r) {
        const t = extractComment(r);
        if (t) comments.push(t);
      });
      hasMore = data.has_more === true;
      if (ratings.length < PAGE_SIZE) hasMore = false;
      offset += PAGE_SIZE;
      if (!ratings.length) break;
    }

    if (!comments.length) {
      throw new Error('Không có đánh giá chữ');
    }
    return comments.slice(0, max);
  }

  document.addEventListener('mca-browser-fetch-comments', function (ev) {
    const detail = ev.detail || {};
    fetchAllCommentsInBrowser(
      detail.shopId,
      detail.itemId,
      detail.referer || location.href,
      detail.maxComments || MAX_COMMENTS
    )
      .then(function (comments) {
        document.dispatchEvent(new CustomEvent('mca-browser-comments-response', {
          detail: { requestId: detail.requestId, ok: true, comments: comments }
        }));
      })
      .catch(function (err) {
        document.dispatchEvent(new CustomEvent('mca-browser-comments-response', {
          detail: { requestId: detail.requestId, ok: false, error: err.message, comments: [] }
        }));
      });
  });
})();
