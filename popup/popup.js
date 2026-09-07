/**
 * MediaCardRenderer
 * Single Responsibility: Renders individual media items into clean, accessible DOM card components.
 */
class MediaCardRenderer {
  static escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  static render(item, index, callbacks) {
    const card = document.createElement('div');
    card.className = 'media-card';

    const rawUrl = (item.url || '').toLowerCase();
    const isM3u8 =
      (item.format || '').toUpperCase() === 'M3U8' ||
      rawUrl.includes('.m3u8') ||
      rawUrl.includes('/hls/') ||
      rawUrl.includes('master.txt') ||
      rawUrl.includes('sublist_');
    const format = isM3u8 ? 'M3U8' : (item.format || 'MP4').toUpperCase();
    const isSub = item.isSubtitle || format === 'VTT' || format === 'SRT' || format === 'TTML';
    const isAudio = format === 'MP3' || format === 'AAC' || format === 'M4A' || format === 'SES';

    const formatClass = isM3u8 ? 'm3u8' : isSub ? 'subtitle' : isAudio ? 'audio' : '';
    const displayFormat = isSub ? 'ALTYAZI' : isAudio ? 'DUBLAJ/SES' : format;
    const sizeText = item.sizeFormatted || (isM3u8 ? 'Akış (HLS)' : isSub ? 'Metin' : 'Bilinmiyor');
    const qualityText = isSub
      ? item.format || 'VTT'
      : isAudio
      ? item.format || 'AUDIO'
      : item.quality || (isM3u8 ? 'Canlı / HLS' : 'HD');
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
        <div class="card-title" title="${MediaCardRenderer.escapeHtml(titleText)}">${MediaCardRenderer.escapeHtml(titleText)}</div>
      </div>
      <div class="card-actions">
        <button class="btn-download" data-index="${index}">
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          <span>İndir</span>
        </button>
        <div class="card-icon-actions">
          <button class="action-icon-btn btn-preview" data-index="${index}" title="Önizle">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="action-icon-btn btn-copy" data-url="${MediaCardRenderer.escapeHtml(item.url)}" title="Bağlantıyı Kopyala">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="action-icon-btn btn-open-tab" data-url="${MediaCardRenderer.escapeHtml(item.url)}" title="Yeni Sekmede Aç">
            <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          </button>
        </div>
      </div>
      <div class="card-progress-wrapper hidden">
        <div class="card-progress-bar">
          <div class="card-progress-fill"></div>
        </div>
        <div class="card-progress-status">
          <span class="status-text">Hazırlanıyor...</span>
          <span class="status-percent">0%</span>
        </div>
      </div>
    `;

    // Event bindings
    const dlBtn = card.querySelector('.btn-download');
    dlBtn.addEventListener('click', () => callbacks.onDownload(item, dlBtn, card));

    const previewBtn = card.querySelector('.btn-preview');
    previewBtn.addEventListener('click', () => callbacks.onPreview(item));

    const copyBtn = card.querySelector('.btn-copy');
    copyBtn.addEventListener('click', () => callbacks.onCopy(item.url, copyBtn));

    const openTabBtn = card.querySelector('.btn-open-tab');
    openTabBtn.addEventListener('click', () => callbacks.onOpenTab(item.url));

    return card;
  }
}

/**
 * PopupUIManager
 * Single Responsibility: Coordinates popup view state, tab discovery, preview video modal, and messaging.
 */
class PopupUIManager {
  constructor() {
    this.mediaListEl = document.getElementById('mediaList');
    this.emptyStateEl = document.getElementById('emptyState');
    this.mediaCountEl = document.getElementById('mediaCount');
    this.tabDomainEl = document.getElementById('tabDomain');
    this.btnRescan = document.getElementById('btnRescan');
    this.btnScanNow = document.getElementById('btnScanNow');
    this.btnOptions = document.getElementById('btnOptions');
    this.btnDownloadAll = document.getElementById('btnDownloadAll');

    this.previewContainer = document.getElementById('previewContainer');
    this.previewVideo = document.getElementById('previewVideo');
    this.previewTitle = document.getElementById('previewTitle');
    this.btnClosePreview = document.getElementById('btnClosePreview');

    this.currentTab = null;
    this.mediaItems = [];
  }

  async initialize() {
    await this.resolveActiveTab();
    this.bindEvents();
    await this.fetchMedia();
  }

  async resolveActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      if (tab && tab.url) {
        try {
          const u = new URL(tab.url);
          this.tabDomainEl.textContent = u.hostname || tab.title || 'Aktif Sayfa';
        } catch {
          this.tabDomainEl.textContent = tab.title || 'Aktif Sayfa';
        }
      }
    } catch (err) {
      console.error('PopupUIManager: Failed to query active tab:', err);
      this.tabDomainEl.textContent = 'Sayfa bilgisi alınamadı';
    }
  }

  bindEvents() {
    this.btnRescan.addEventListener('click', () => this.rescan());
    this.btnScanNow.addEventListener('click', () => this.rescan());
    this.btnDownloadAll.addEventListener('click', () => this.downloadAll());
    this.btnClosePreview.addEventListener('click', () => this.closePreview());

    this.btnOptions.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
      }
    });
  }

  async fetchMedia() {
    if (!this.currentTab || !this.currentTab.id) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TAB_MEDIA',
        tabId: this.currentTab.id
      });

      this.mediaItems = response && response.success ? response.media || [] : [];
      this.render();
    } catch (error) {
      console.warn('PopupUIManager: Error fetching media:', error);
      this.mediaItems = [];
      this.render();
    }
  }

  render() {
    this.mediaListEl.innerHTML = '';

    if (!this.mediaItems || this.mediaItems.length === 0) {
      this.emptyStateEl.classList.remove('hidden');
      this.mediaCountEl.textContent = '0 video';
      this.btnDownloadAll.classList.add('hidden');
      return;
    }

    this.emptyStateEl.classList.add('hidden');
    this.mediaCountEl.textContent = `${this.mediaItems.length} medya bulundu`;
    this.btnDownloadAll.classList.remove('hidden');

    this.mediaItems.forEach((item, index) => {
      const card = MediaCardRenderer.render(item, index, {
        onDownload: (m, btn, c) => this.downloadItem(m, btn, c),
        onPreview: (m) => this.playPreview(m),
        onCopy: (url, btn) => this.copyUrl(url, btn),
        onOpenTab: (url) => chrome.tabs.create({ url })
      });
      this.mediaListEl.appendChild(card);
    });
  }

  async downloadItem(item, buttonEl, cardEl) {
    const progressWrapper = cardEl ? cardEl.querySelector('.card-progress-wrapper') : null;
    const progressFill = cardEl ? cardEl.querySelector('.card-progress-fill') : null;
    const statusText = cardEl ? cardEl.querySelector('.status-text') : null;
    const statusPercent = cardEl ? cardEl.querySelector('.status-percent') : null;

    buttonEl.disabled = true;
    buttonEl.classList.add('btn-download--active');
    const originalText = buttonEl.innerHTML;
    buttonEl.innerHTML = `<span>Hazırlanıyor...</span>`;

    if (progressWrapper) {
      progressWrapper.classList.remove('hidden');
      if (progressFill) progressFill.style.width = '0%';
      if (statusPercent) statusPercent.textContent = '0%';
      if (statusText) statusText.textContent = 'Başlatılıyor...';
    }

    const onProgress = ({ percent, status }) => {
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (statusPercent) statusPercent.textContent = `${percent}%`;
      if (statusText) statusText.textContent = status || '';
      buttonEl.innerHTML = `<span>%${percent} İndiriliyor</span>`;
    };

    const effectivePageUrl = item.pageUrl || (this.currentTab ? this.currentTab.url : '');
    const effectiveReferer = item.referer || effectivePageUrl;
    const itemWithContext = { ...item, referer: effectiveReferer, pageUrl: effectivePageUrl };

    try {
      const rawUrl = (item.url || '').toLowerCase();
      const isM3u8 =
        (item.format || '').toUpperCase() === 'M3U8' ||
        rawUrl.includes('.m3u8') ||
        rawUrl.includes('/hls/') ||
        rawUrl.includes('master.txt') ||
        rawUrl.includes('sublist_');

      const isSub = item.isSubtitle || (item.format || '').toUpperCase() === 'VTT' || (item.format || '').toUpperCase() === 'SRT';

      if (isM3u8 && window.StreamDownloadEngine) {
        // Direct in-popup HLS segment downloading and assembly
        const engine = new window.StreamDownloadEngine(6);
        await engine.downloadHlsStream(itemWithContext, onProgress);
      } else if (isSub && window.StreamDownloadEngine) {
        // Direct in-popup subtitle downloading
        const engine = new window.StreamDownloadEngine();
        await engine.downloadSubtitle(itemWithContext, onProgress);
      } else {
        // Direct media download via background service worker
        onProgress({ percent: 50, status: 'İndirme tarayıcıya iletiliyor...' });
        const res = await chrome.runtime.sendMessage({
          type: 'DOWNLOAD_MEDIA',
          url: item.url,
          title: item.title,
          pageUrl: effectivePageUrl,
          referer: effectiveReferer,
          format: item.format,
          tabId: this.currentTab ? this.currentTab.id : undefined
        });

        if (!res || !res.success) {
          throw new Error(res ? res.error : 'İndirme başlatılamadı');
        }
        onProgress({ percent: 100, status: '✓ İndirme başlatıldı!' });
      }

      buttonEl.classList.remove('btn-download--active');
      buttonEl.classList.add('btn-download--success');
      buttonEl.innerHTML = `<span>✓ İndirildi</span>`;

      setTimeout(() => {
        buttonEl.disabled = false;
        buttonEl.classList.remove('btn-download--success');
        buttonEl.innerHTML = originalText;
        if (progressWrapper) progressWrapper.classList.add('hidden');
      }, 4500);

    } catch (err) {
      console.error('Download error:', err);
      buttonEl.classList.remove('btn-download--active');
      buttonEl.classList.add('btn-download--error');
      buttonEl.innerHTML = `<span>✕ Hata</span>`;
      if (statusText) statusText.textContent = `Hata: ${err.message}`;
      if (statusPercent) statusPercent.textContent = '!';

      setTimeout(() => {
        buttonEl.disabled = false;
        buttonEl.classList.remove('btn-download--error');
        buttonEl.innerHTML = originalText;
      }, 4000);
    }
  }

  async downloadAll() {
    if (this.mediaItems.length === 0) return;
    this.btnDownloadAll.disabled = true;
    this.btnDownloadAll.textContent = 'İndiriliyor...';

    const cards = Array.from(this.mediaListEl.children);

    for (let i = 0; i < this.mediaItems.length; i++) {
      const item = this.mediaItems[i];
      const card = cards[i];
      const btn = card ? card.querySelector('.btn-download') : null;

      if (btn) {
        await this.downloadItem(item, btn, card);
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    this.btnDownloadAll.textContent = 'Tümü Tamamlandı';
    setTimeout(() => {
      this.btnDownloadAll.disabled = false;
      this.btnDownloadAll.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Tümünü İndir`;
    }, 2500);
  }

  playPreview(item) {
    if (!item || !item.url) return;
    this.previewTitle.textContent = `Önizleme: ${item.title || 'Video'}`;
    this.previewVideo.src = item.url;
    this.previewContainer.classList.remove('hidden');
    this.previewVideo.play().catch(() => {});
  }

  closePreview() {
    this.previewVideo.pause();
    this.previewVideo.src = '';
    this.previewContainer.classList.add('hidden');
  }

  async copyUrl(url, buttonEl) {
    try {
      await navigator.clipboard.writeText(url);
      buttonEl.innerHTML = `<svg viewBox="0 0 24 24" style="fill:#34d399;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
      setTimeout(() => {
        buttonEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
      }, 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  }

  async rescan() {
    if (!this.currentTab || !this.currentTab.id) return;
    this.btnRescan.style.transform = 'rotate(180deg)';
    setTimeout(() => {
      this.btnRescan.style.transform = 'none';
    }, 400);

    try {
      await chrome.tabs.sendMessage(this.currentTab.id, { type: 'SCAN_PAGE_MEDIA' });
    } catch {}

    await this.fetchMedia();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const popupManager = new PopupUIManager();
  popupManager.initialize();
});
