/**
 * Content script: inject sidebar 380px trượt từ cạnh phải màn hình Shopee
 */
(function () {
  const SIDEBAR_WIDTH = 380;
  let isOpen = false;
  let sidebar = null;

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

  // Luôn đăng ký listener (kể cả khi DOM đã tồn tại)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'toggle-sidebar') {
      toggleSidebar();
      sendResponse({ ok: true, isOpen });
      return true;
    }
    return false;
  });

  // Khởi tạo sidebar khi trang Shopee load
  initSidebar();

  // Expose cho background inject fallback
  window.__mcaToggleSidebar = toggleSidebar;

  // Sidebar iframe hỏi URL trang Shopee hiện tại (khi user chuyển sang SP khác)
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'mca-get-page-url') {
      event.source.postMessage(
        { type: 'mca-page-url', url: window.location.href },
        '*'
      );
    }
  });
})();
