/**
 * Background — Affiliate ngầm + proxy lấy comment trên tab Shopee
 */
const AFFILIATE_TAB_LIFETIME_MS = 300;
const AFFILIATE_LOAD_TIMEOUT_MS = 8000;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Mua Chuẩn AI] Extension đã cài đặt');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === 'silent-affiliate' && message.url) {
    activateAffiliateSilently(message.url)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.warn('[Mua Chuẩn AI] Silent affiliate failed:', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (message?.action === 'proxy-fetch-comments-browser') {
    proxyFetchCommentsInBrowser(
      message.shopId,
      message.itemId,
      message.productUrl,
      message.starFilters,
      message.requestId
    )
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, comments: [], error: String(err) }));
    return true;
  }

  if (message?.action === 'proxy-fetch-bundle-deal') {
    proxyFetchBundleDeal(message.shopId, message.itemId, message.productUrl)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, deal: { success: false }, error: String(err) }));
    return true;
  }

  return false;
});

function activateAffiliateSilently(affiliateUrl) {
  return new Promise((resolve, reject) => {
    if (!affiliateUrl || typeof affiliateUrl !== 'string') {
      reject(new Error('Invalid affiliate URL'));
      return;
    }

    chrome.tabs.create({ url: affiliateUrl, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (!tab?.id) {
        reject(new Error('Tab creation failed'));
        return;
      }

      const tabId = tab.id;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(fallbackTimer);
        chrome.tabs.remove(tabId, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Mua Chuẩn AI] Tab remove:', chrome.runtime.lastError.message);
          }
          resolve();
        });
      };

      const onUpdated = (id, info) => {
        if (id === tabId && info.status === 'complete') {
          setTimeout(finish, AFFILIATE_TAB_LIFETIME_MS);
        }
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
      const fallbackTimer = setTimeout(finish, AFFILIATE_LOAD_TIMEOUT_MS);
    });
  });
}

async function findShopeeTab(shopId, itemId, productUrl) {
  const shop = String(shopId);
  const item = String(itemId);
  const patterns = [
    new RegExp(`[-.]i\\.${shop}\\.${item}(?:[/?#]|$)`, 'i'),
    new RegExp(`/product/${shop}/${item}(?:[/?#]|$)`, 'i')
  ];

  const matchesProduct = (url) => url && patterns.some((p) => p.test(url));

  const [activeTabs, shopeeTabs] = await Promise.all([
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    chrome.tabs.query({ url: ['https://shopee.vn/*', 'https://*.shopee.vn/*'] })
  ]);

  for (const tab of activeTabs) {
    if (tab.id && matchesProduct(tab.url)) {
      return tab.id;
    }
  }

  if (productUrl && matchesProduct(productUrl)) {
    for (const tab of shopeeTabs) {
      if (tab.id && tab.url === productUrl) {
        return tab.id;
      }
    }
  }

  for (const tab of shopeeTabs) {
    if (tab.id && matchesProduct(tab.url)) {
      return tab.id;
    }
  }

  const activeOnShopee = activeTabs.find((t) => t.id && isShopeeUrl(t.url));
  if (activeOnShopee?.id) {
    return activeOnShopee.id;
  }

  return shopeeTabs[0]?.id ?? null;
}

function isShopeeUrl(url) {
  return !!url && /https?:\/\/([\w-]+\.)?shopee\.vn/i.test(url);
}

function sendToTab(tabId, payload) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          comments: [],
          error: 'Content script chưa sẵn sàng — F5 tải lại trang Shopee.'
        });
        return;
      }
      resolve(response ?? { ok: false, comments: [], error: 'Không có phản hồi từ trang Shopee.' });
    });
  });
}

async function proxyFetchCommentsInBrowser(shopId, itemId, productUrl, starFilters, requestId) {
  const tabId = await findShopeeTab(shopId, itemId, productUrl);
  if (!tabId) {
    return { ok: false, comments: [], error: 'Không tìm thấy tab Shopee.' };
  }
  return sendToTab(tabId, {
    action: 'fetch-comments-browser',
    requestId,
    shopId,
    itemId,
    referer: productUrl,
    starFilters
  });
}

async function proxyFetchBundleDeal(shopId, itemId, productUrl) {
  const tabId = await findShopeeTab(shopId, itemId, productUrl);
  if (!tabId) {
    return { ok: false, deal: { success: false }, error: 'Không tìm thấy tab Shopee.' };
  }
  return sendToTab(tabId, { action: 'fetch-bundle-deal', shopId, itemId });
}
