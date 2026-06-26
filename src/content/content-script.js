/**
 * Content script: inject sidebar 380px + lấy comment Shopee (same-origin, có cookie user)
 */
(function () {
  const SIDEBAR_WIDTH = 380;
  const MAX_COMMENTS = 300;
  const PAGE_SIZE = 50;
  let isOpen = false;
  let sidebar = null;

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  async function fetchRatingsPage(shopId, itemId, offset) {
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
      need_translation: '1',
      shopid: String(shopId),
      itemid: String(itemId),
      fe_toggle: '[2,3]',
      preferred_item_shop_id: String(shopId),
      preferred_item_item_id: String(itemId),
      preferred_item_include_type: '1',
      tag_filter: '',
      variation_filters: ''
    });

    const headers = {
      Accept: 'application/json',
      'X-API-Source': 'pc',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Shopee-Language': 'vi',
      Referer: window.location.href
    };

    const csrf = getCsrfToken();
    if (csrf) {
      headers['X-CSRFToken'] = csrf;
    }

    const res = await fetch(
      'https://shopee.vn/api/v2/item/get_ratings?' + params.toString(),
      { credentials: 'include', headers }
    );

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    return res.json();
  }

  async function fetchAllRatings(shopId, itemId) {
    const comments = [];
    let offset = 0;

    while (comments.length < MAX_COMMENTS) {
      const json = await fetchRatingsPage(shopId, itemId, offset);
      const ratings = json?.data?.ratings ?? [];

      if (!ratings.length) {
        break;
      }

      for (const r of ratings) {
        const text = (r.comment || '').trim();
        if (text) {
          comments.push(text);
        }
      }

      if (ratings.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }

    return comments.slice(0, MAX_COMMENTS);
  }

  function openSidebar() {
    if (!sidebar) return;
    isOpen = true;
    sidebar.classList.add('open');
    sidebar.setAttribute('aria-hidden', 'false');
    document.body.classList.add('mca-sidebar-open');
    document.body.style.marginRight = SIDEBAR_WIDTH + 'px';
    document.body.style.transition = 'margin-right 0.3s ease';
  }

  function closeSidebar() {
    if (!sidebar) return;
    isOpen = false;
    sidebar.classList.remove('open');
    sidebar.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('mca-sidebar-open');
    document.body.style.marginRight = '0';
  }

  function toggleSidebar() {
    if (!sidebar) {
      initSidebar();
    }
    isOpen ? closeSidebar() : openSidebar();
  }

  function initSidebar() {
    if (document.getElementById('mua-chuan-ai-root')) {
      sidebar = document.getElementById('mca-sidebar');
      const btn = document.getElementById('mca-toggle-btn');
      if (btn && !btn.dataset.mcaBound) {
        btn.dataset.mcaBound = '1';
        btn.addEventListener('click', toggleSidebar);
      }
      isOpen = sidebar.classList.contains('open');
      return;
    }

    const root = document.createElement('div');
    root.id = 'mua-chuan-ai-root';

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'mca-toggle-btn';
    toggleBtn.title = 'Mua Chuẩn AI';
    toggleBtn.innerHTML = '🤖';
    toggleBtn.setAttribute('aria-label', 'Mở Mua Chuẩn AI');
    toggleBtn.dataset.mcaBound = '1';
    toggleBtn.addEventListener('click', toggleSidebar);

    sidebar = document.createElement('aside');
    sidebar.id = 'mca-sidebar';
    sidebar.setAttribute('aria-hidden', 'true');

    const iframe = document.createElement('iframe');
    iframe.id = 'mca-sidebar-iframe';
    iframe.src = chrome.runtime.getURL('index.html');
    iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
    sidebar.appendChild(iframe);

    root.appendChild(toggleBtn);
    root.appendChild(sidebar);
    document.body.appendChild(root);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'toggle-sidebar') {
      toggleSidebar();
      sendResponse({ ok: true, isOpen });
      return true;
    }
    if (msg.action === 'fetch-ratings') {
      fetchAllRatings(msg.shopId, msg.itemId)
        .then((comments) => sendResponse({ ok: true, comments }))
        .catch((e) => sendResponse({ ok: false, error: e.message, comments: [] }));
      return true;
    }
    return false;
  });

  initSidebar();

  window.__mcaToggleSidebar = toggleSidebar;

  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'mca-get-page-url') {
      event.source.postMessage(
        { type: 'mca-page-url', url: window.location.href },
        '*'
      );
      return;
    }

    if (event.data?.type === 'mca-navigate-affiliate' && event.data.url) {
      window.location.href = event.data.url;
      return;
    }

    if (event.data?.type === 'mca-fetch-ratings') {
      const { shopId, itemId } = event.data;
      try {
        const comments = await fetchAllRatings(shopId, itemId);
        event.source.postMessage(
          { type: 'mca-ratings-result', shopId, itemId, comments },
          '*'
        );
      } catch (e) {
        event.source.postMessage(
          { type: 'mca-ratings-error', shopId, itemId, message: e.message || 'Lỗi không xác định' },
          '*'
        );
      }
    }
  });
})();
