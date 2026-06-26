/**
 * Background Service Worker — Luồng Affiliate ngầm (Silent Activation)
 */
const AFFILIATE_TAB_LIFETIME_MS = 300;

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
    return true; // async sendResponse
  }
  return false;
});

/**
 * Mở tab ẩn với link Affiliate → chờ load cookie → đóng tab
 */
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

      setTimeout(() => {
        chrome.tabs.remove(tab.id, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Mua Chuẩn AI] Tab remove:', chrome.runtime.lastError.message);
          }
          resolve();
        });
      }, AFFILIATE_TAB_LIFETIME_MS);
    });
  });
}
