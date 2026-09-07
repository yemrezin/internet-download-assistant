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

    const format = (item.format || 'MP4').toUpperCase();
    const isM3u8 = format === 'M3U8';
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
          <span>${isM3u8 ? 'HLS İndiriciyi Aç' : 'İndir'}</span>
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
    `;

    // Event bindings
    const dlBtn = card.querySelector('.btn-download');
    dlBtn.addEventListener('click', () => callbacks.onDownload(item, dlBtn));

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
        onDownload: (m, btn) => this.downloadItem(m, btn),
        onPreview: (m) => this.playPreview(m),
        onCopy: (url, btn) => this.copyUrl(url, btn),
        onOpenTab: (url) => chrome.tabs.create({ url })
      });
      this.mediaListEl.appendChild(card);
    });
  }

  async downloadItem(item, buttonEl) {
    buttonEl.disabled = true;
    const originalText = buttonEl.innerHTML;
    buttonEl.innerHTML = `<span>Başlatılıyor...</span>`;

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_MEDIA',
        url: item.url,
        title: item.title,
        pageUrl: item.pageUrl || (this.currentTab ? this.currentTab.url : ''),
        format: item.format
      });

      if (res && res.success) {
        buttonEl.innerHTML = `<span>✓ Başlatıldı</span>`;
        setTimeout(() => {
          buttonEl.disabled = false;
          buttonEl.innerHTML = originalText;
        }, 2500);
      } else {
        alert(`İndirme başlatılamadı: ${res ? res.error : 'Hata oluştu'}`);
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalText;
      }
    } catch (err) {
      alert(`İndirme hatası: ${err.message}`);
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalText;
    }
  }

  async downloadAll() {
    if (this.mediaItems.length === 0) return;
    this.btnDownloadAll.disabled = true;
    this.btnDownloadAll.textContent = 'İndiriliyor...';

    for (const item of this.mediaItems) {
      await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_MEDIA',
        url: item.url,
        title: item.title,
        pageUrl: item.pageUrl || (this.currentTab ? this.currentTab.url : ''),
        format: item.format
      });
      await new Promise((r) => setTimeout(r, 600));
    }

    this.btnDownloadAll.textContent = 'Tamamlandı';
    setTimeout(() => {
      this.btnDownloadAll.disabled = false;
      this.btnDownloadAll.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Tümünü İndir`;
    }, 2000);
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
