/**
 * Content script: inject sidebar 380px + lấy comment Shopee (same-origin, có cookie user)
 */
(function () {
  const SIDEBAR_WIDTH = 380;
  const FETCH_TIMEOUT_MS = 120000;
  let isOpen = false;
  let sidebar = null;

  function waitForPageBridge(timeoutMs) {
    return new Promise((resolve, reject) => {
      if (document.documentElement.dataset.mcaBridgeReady) {
        resolve();
        return;
      }
      const deadline = Date.now() + (timeoutMs || 5000);
      const tick = setInterval(() => {
        if (document.documentElement.dataset.mcaBridgeReady) {
          clearInterval(tick);
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          clearInterval(tick);
          reject(new Error('Page bridge chưa sẵn sàng — F5 trang Shopee.'));
        }
      }, 50);
    });
  }

  function parseProductIdsFromPage() {
    const href = window.location.href;
    const fromUrl = href.match(/[-.]i\.(\d+)\.(\d+)/i);
    if (fromUrl) {
      return { shopId: Number(fromUrl[1]), itemId: Number(fromUrl[2]) };
    }
    const product = href.match(/\/product\/(\d+)\/(\d+)/i);
    if (product) {
      return { shopId: Number(product[1]), itemId: Number(product[2]) };
    }
    return null;
  }

  async function fetchCommentsViaPageBridge(shopId, itemId, referer, starFilters) {
    await waitForPageBridge(8000);
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        document.removeEventListener('mca-browser-comments-response', handler);
        reject(new Error('Hết thời gian chờ lấy comment (quá 2 phút)'));
      }, FETCH_TIMEOUT_MS);

      function handler(ev) {
        if (ev.detail?.requestId !== requestId) return;
        clearTimeout(timer);
        document.removeEventListener('mca-browser-comments-response', handler);
        resolve(ev.detail);
      }

      document.addEventListener('mca-browser-comments-response', handler);
      document.dispatchEvent(new CustomEvent('mca-browser-fetch-comments', {
        detail: {
          requestId,
          shopId: Number(shopId),
          itemId: Number(itemId),
          referer: referer || window.location.href,
          starFilters: starFilters
        }
      }));
    });
  }

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function toVnd(raw) {
    if (!raw) return 0;
    if (raw > 100000000) return Math.round(raw / 100000);
    return raw;
  }

  async function fetchBundleDeal(shopId, itemId) {
    const headers = {
      Accept: 'application/json',
      'X-API-Source': 'pc',
      'X-Shopee-Language': 'vi',
      Referer: window.location.href
    };
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRFToken'] = csrf;

    const res = await fetch(
      `https://shopee.vn/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`,
      { credentials: 'include', headers }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const data = json?.data ?? json;

    let bundleDeal = null;
    if (data?.bundle_deal_info?.bundle_deal) {
      bundleDeal = data.bundle_deal_info.bundle_deal;
    } else if (data?.bundle_deal) {
      bundleDeal = data.bundle_deal;
    }

    const productName = data?.name || data?.item?.title || 'Sản phẩm Shopee';
    const unitPrice = toVnd(data?.price ?? data?.price_min ?? data?.item?.price ?? 0);

    if (!bundleDeal || !bundleDeal.bundle_deal_id || bundleDeal.bundle_deal_id <= 0) {
      return { success: false, targetQuantity: 0, discountInfo: '', unitPrice, productName };
    }

    const minAmount = bundleDeal.min_amount || bundleDeal.rule_min_amount || 3;
    let discountInfo = '';
    if (bundleDeal.discount_value) {
      discountInfo = bundleDeal.discount_percentage === 1
        ? bundleDeal.discount_value + '%'
        : (bundleDeal.discount_value <= 100 ? bundleDeal.discount_value + '%' : bundleDeal.discount_value + 'đ');
    }

    return {
      success: true,
      targetQuantity: minAmount,
      discountInfo,
      unitPrice,
      productName
    };
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
    if (msg.action === 'fetch-comments-browser') {
      const resolved = parseProductIdsFromPage();
      const sid = resolved?.shopId || Number(msg.shopId);
      const iid = resolved?.itemId || Number(msg.itemId);
      const ref = msg.referer || window.location.href;
      fetchCommentsViaPageBridge(sid, iid, ref, msg.starFilters)
        .then((result) => sendResponse({
          ok: !!result.ok,
          comments: result.comments || [],
          error: result.error,
          meta: result.meta
        }))
        .catch((e) => sendResponse({ ok: false, comments: [], error: e.message }));
      return true;
    }
    if (msg.action === 'fetch-bundle-deal') {
      fetchBundleDeal(msg.shopId, msg.itemId)
        .then((deal) => sendResponse({ ok: true, deal }))
        .catch((e) => sendResponse({ ok: false, deal: { success: false }, error: e.message }));
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

    if (event.data?.type === 'mca-fetch-bundle-deal') {
      const { shopId, itemId } = event.data;
      try {
        const deal = await fetchBundleDeal(shopId, itemId);
        event.source.postMessage(
          { type: 'mca-bundle-deal-result', shopId, itemId, deal },
          '*'
        );
      } catch (e) {
        event.source.postMessage(
          { type: 'mca-bundle-deal-result', shopId, itemId, deal: { success: false } },
          '*'
        );
      }
    }
  });
})();
