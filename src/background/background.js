/**
 * Background Service Worker — Luồng Affiliate ngầm (Silent Activation)
 * Mở tab ẩn shope.ee → chờ load xong → đóng sau 300ms để ghim cookie
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
