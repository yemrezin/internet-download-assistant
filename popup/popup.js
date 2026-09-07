/**
 * Internet Video Download Assistant - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const mediaListEl = document.getElementById('mediaList');
  const emptyStateEl = document.getElementById('emptyState');
  const mediaCountEl = document.getElementById('mediaCount');
  const tabDomainEl = document.getElementById('tabDomain');
  const btnRescan = document.getElementById('btnRescan');
  const btnScanNow = document.getElementById('btnScanNow');
  const btnOptions = document.getElementById('btnOptions');
  const btnDownloadAll = document.getElementById('btnDownloadAll');

  const previewContainer = document.getElementById('previewContainer');
  const previewVideo = document.getElementById('previewVideo');
  const previewTitle = document.getElementById('previewTitle');
  const btnClosePreview = document.getElementById('btnClosePreview');

  let currentTab = null;
  let currentMediaList = [];

  // Get active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    if (tab && tab.url) {
      try {
        const u = new URL(tab.url);
        tabDomainEl.textContent = u.hostname || tab.title || 'Aktif Sayfa';
      } catch {
        tabDomainEl.textContent = tab.title || 'Aktif Sayfa';
      }
    }
  } catch (err) {
    console.error('Tab query error:', err);
    tabDomainEl.textContent = 'Sayfa bilgisi alınamadı';
  }

  // Load media items from background worker
  async function loadMedia() {
    if (!currentTab || !currentTab.id) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TAB_MEDIA',
        tabId: currentTab.id
      });

      if (response && response.success) {
        currentMediaList = response.media || [];
        renderMediaList(currentMediaList);
      } else {
        renderMediaList([]);
      }
    } catch (err) {
      console.warn('Failed to fetch tab media:', err);
      renderMediaList([]);
    }
  }

  // Render cards for detected media items
  function renderMediaList(mediaItems) {
    mediaListEl.innerHTML = '';

    if (!mediaItems || mediaItems.length === 0) {
      emptyStateEl.classList.remove('hidden');
      mediaCountEl.textContent = '0 video';
      btnDownloadAll.classList.add('hidden');
      return;
    }

    emptyStateEl.classList.add('hidden');
    mediaCountEl.textContent = `${mediaItems.length} medya bulundu`;
    btnDownloadAll.classList.remove('hidden');

    mediaItems.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'media-card';

      const format = (item.format || 'MP4').toUpperCase();
      const isM3u8 = format === 'M3U8';
      const isSub = item.isSubtitle || format === 'VTT' || format === 'SRT' || format === 'TTML';
      const isAudio = format === 'MP3' || format === 'AAC' || format === 'M4A' || format === 'SES';

      const formatClass = isM3u8 ? 'm3u8' : isSub ? 'subtitle' : isAudio ? 'audio' : '';
      const displayFormat = isSub ? 'ALTYAZI' : isAudio ? 'DUBLAJ/SES' : format;
      const sizeText = item.sizeFormatted || (isM3u8 ? 'Akış (HLS)' : isSub ? 'Metin' : 'Bilinmiyor');
      const qualityText = isSub ? (item.format || 'VTT') : isAudio ? (item.format || 'AUDIO') : item.quality || (isM3u8 ? 'Canlı / HLS' : 'HD');
      const titleText = item.title || `Medya_${index + 1}`;

      card.innerHTML = `
        <div class="card-top">
          <div class="card-badges">
            <span class="badge badge-format ${formatClass}">${displayFormat}</span>
            <span class="badge badge-quality ${formatClass}">${qualityText}</span>
          </div>
          <span class="card-size">${sizeText}</span>
        </div>
        <div class="card-title-row">
          <div class="card-title" title="${escapeHtml(titleText)}">${escapeHtml(titleText)}</div>
        </div>
        <div class="card-actions">
          <button class="btn-download" data-index="${index}">
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            <span>${isM3u8 ? 'HLS İndiriciyi Aç' : 'İndir'}</span>
          </button>
          <div class="card-icon-actions">
            <button class="action-icon-btn btn-preview" data-index="${index}" title="Önizle">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button class="action-icon-btn btn-copy" data-url="${escapeHtml(item.url)}" title="Bağlantıyı Kopyala">
              <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            </button>
            <button class="action-icon-btn btn-open-tab" data-url="${escapeHtml(item.url)}" title="Yeni Sekmede Aç">
              <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
            </button>
          </div>
        </div>
      `;

      // Download Click
      const dlBtn = card.querySelector('.btn-download');
      dlBtn.addEventListener('click', async () => {
        dlBtn.disabled = true;
        const originalText = dlBtn.innerHTML;
        dlBtn.innerHTML = `<span>Başlatılıyor...</span>`;

        try {
          const res = await chrome.runtime.sendMessage({
            type: 'DOWNLOAD_MEDIA',
            url: item.url,
            title: item.title,
            pageUrl: item.pageUrl || (currentTab ? currentTab.url : ''),
            format: item.format
          });

          if (res && res.success) {
            dlBtn.innerHTML = `<span>✓ Başlatıldı</span>`;
            setTimeout(() => {
              dlBtn.disabled = false;
              dlBtn.innerHTML = originalText;
            }, 2500);
          } else {
            alert(`İndirme başlatılamadı: ${res ? res.error : 'Hata oluştu'}`);
            dlBtn.disabled = false;
            dlBtn.innerHTML = originalText;
          }
        } catch (err) {
          alert(`İndirme hatası: ${err.message}`);
          dlBtn.disabled = false;
          dlBtn.innerHTML = originalText;
        }
      });

      // Preview Click
      const previewBtn = card.querySelector('.btn-preview');
      previewBtn.addEventListener('click', () => {
        playPreview(item);
      });

      // Copy Link Click
      const copyBtn = card.querySelector('.btn-copy');
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.url);
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" style="fill:#34d399;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
          setTimeout(() => {
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
          }, 2000);
        } catch (err) {
          console.error('Clipboard copy failed:', err);
        }
      });

      // Open in Tab Click
      const openTabBtn = card.querySelector('.btn-open-tab');
      openTabBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: item.url });
      });

      mediaListEl.appendChild(card);
    });
  }

  // Play preview video
  function playPreview(item) {
    if (!item || !item.url) return;
    previewTitle.textContent = `Önizleme: ${item.title || 'Video'}`;
    previewVideo.src = item.url;
    previewContainer.classList.remove('hidden');
    previewVideo.play().catch(() => {
      // Autoplay might be blocked or format not supported directly by native HTML5 video
    });
  }

  // Close preview video
  btnClosePreview.addEventListener('click', () => {
    previewVideo.pause();
    previewVideo.src = '';
    previewContainer.classList.add('hidden');
  });

  // Rescan active tab
  async function rescan() {
    if (!currentTab || !currentTab.id) return;
    btnRescan.style.transform = 'rotate(180deg)';
    setTimeout(() => {
      btnRescan.style.transform = 'none';
    }, 400);

    try {
      // Trigger DOM scan in content script
      await chrome.tabs.sendMessage(currentTab.id, { type: 'SCAN_PAGE_MEDIA' });
    } catch {
      // Content script may not be injected or ready
    }

    // Refresh media list from service worker
    await loadMedia();
  }

  btnRescan.addEventListener('click', rescan);
  btnScanNow.addEventListener('click', rescan);

  // Download All
  btnDownloadAll.addEventListener('click', async () => {
    if (currentMediaList.length === 0) return;
    btnDownloadAll.disabled = true;
    btnDownloadAll.textContent = 'İndiriliyor...';

    for (const item of currentMediaList) {
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_MEDIA',
        url: item.url,
        title: item.title,
        pageUrl: item.pageUrl || (currentTab ? currentTab.url : ''),
        format: item.format
      });
      // Small pause between multiple downloads to avoid browser throttle
      await new Promise(r => setTimeout(r, 600));
    }

    btnDownloadAll.textContent = 'Tamamlandı';
    setTimeout(() => {
      btnDownloadAll.disabled = false;
      btnDownloadAll.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Tümünü İndir`;
    }, 2000);
  });

  // Open Options Page
  btnOptions.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initial load
  await loadMedia();
});
