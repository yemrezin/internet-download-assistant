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

  static render(item, index, isSelected, callbacks) {
    const card = document.createElement('div');
    card.className = `media-card ${isSelected ? 'media-card--selected' : ''}`;
    card.setAttribute('data-id', item.id);

    const rawUrl = (item.url || '').toLowerCase();
    const isM3u8 =
      (item.format || '').toUpperCase() === 'M3U8' ||
      rawUrl.includes('.m3u8') ||
      rawUrl.includes('master.txt') ||
      rawUrl.includes('/master.') ||
      rawUrl.includes('playlist.txt') ||
      rawUrl.includes('sublist_');
    const isSub = item.isSubtitle || item.format === 'VTT' || item.format === 'SRT' || item.format === 'TTML';
    const isAudio = item.format === 'MP3' || item.format === 'AAC' || item.format === 'M4A' || item.format === 'SES';

    let formatClass = '';
    let displayFormat = 'MP4';
    let qualityText = item.quality || 'HD';
    let sizeText = item.sizeFormatted || 'Bilinmiyor';

    if (isSub) {
      formatClass = 'subtitle';
      displayFormat = 'ALTYAZI';
      qualityText = item.format || 'VTT';
      sizeText = item.sizeFormatted && !item.sizeFormatted.includes('GB') ? item.sizeFormatted : 'Metin';
    } else if (isAudio) {
      formatClass = 'audio';
      displayFormat = 'DUBLAJ / SES';
      qualityText = item.format || 'AUDIO';
      sizeText = item.sizeFormatted || '~120 MB';
    } else if (isM3u8) {
      formatClass = 'm3u8';
      displayFormat = 'HLS VİDEO';
      qualityText = item.quality || '1080p FULL HD';
      // Prevent displaying playlist text size (120 KB)
      if (!sizeText || sizeText.includes('KB') || sizeText === 'Bilinmiyor') {
        sizeText = '~2.1 GB (FHD)';
      }
    } else {
      displayFormat = 'MP4 VİDEO';
      qualityText = item.quality || 'Doğrudan İndirme';
    }

    const titleText = item.title || `Video_${index + 1}`;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-header-left">
          <label class="card-checkbox-label" title="İndirmek için seç">
            <input type="checkbox" class="card-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
          </label>
          <div class="card-badges">
            <span class="badge badge-format ${formatClass}">${displayFormat}</span>
            <span class="badge badge-quality ${formatClass}">${qualityText}</span>
          </div>
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

    // Bind checkbox change
    const checkbox = card.querySelector('.card-checkbox');
    checkbox.addEventListener('change', (e) => {
      callbacks.onToggleSelect(item.id, checkbox.checked);
    });

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
    this.btnDownloadSelected = document.getElementById('btnDownloadSelected');
    this.btnDownloadSelectedText = document.getElementById('btnDownloadSelectedText');
    this.chkSelectAll = document.getElementById('chkSelectAll');
    this.lblSelectAll = document.getElementById('lblSelectAll');

    this.previewContainer = document.getElementById('previewContainer');
    this.previewVideo = document.getElementById('previewVideo');
    this.previewTitle = document.getElementById('previewTitle');
    this.btnClosePreview = document.getElementById('btnClosePreview');

    this.currentTab = null;
    this.mediaItems = [];
    this.selectedIds = new Set();
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
    this.btnClosePreview.addEventListener('click', () => this.closePreview());

    if (this.btnDownloadSelected) {
      this.btnDownloadSelected.addEventListener('click', () => this.downloadSelected());
    }

    if (this.chkSelectAll) {
      this.chkSelectAll.addEventListener('change', (e) => {
        this.toggleSelectAll(e.target.checked);
      });
    }

    this.btnOptions.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
      }
    });
  }

  toggleSelect(id, isSelected) {
    if (isSelected) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }

    const card = this.mediaListEl.querySelector(`.media-card[data-id="${id}"]`);
    if (card) {
      if (isSelected) {
        card.classList.add('media-card--selected');
      } else {
        card.classList.remove('media-card--selected');
      }
    }

    this.updateSelectionUI();
  }

  toggleSelectAll(selectAll) {
    if (selectAll) {
      this.mediaItems.forEach((m) => this.selectedIds.add(m.id));
    } else {
      this.selectedIds.clear();
    }

    const cards = this.mediaListEl.querySelectorAll('.media-card');
    cards.forEach((card) => {
      const id = card.getAttribute('data-id');
      const chk = card.querySelector('.card-checkbox');
      if (chk) chk.checked = selectAll;
      if (selectAll) card.classList.add('media-card--selected');
      else card.classList.remove('media-card--selected');
    });

    this.updateSelectionUI();
  }

  updateSelectionUI() {
    const selectedCount = this.selectedIds.size;
    const totalCount = this.mediaItems.length;

    if (this.chkSelectAll) {
      this.chkSelectAll.checked = totalCount > 0 && selectedCount === totalCount;
      this.chkSelectAll.indeterminate = selectedCount > 0 && selectedCount < totalCount;
    }

    if (this.btnDownloadSelected) {
      if (selectedCount > 0) {
        this.btnDownloadSelected.disabled = false;
        this.btnDownloadSelected.classList.remove('disabled');
        if (this.btnDownloadSelectedText) {
          this.btnDownloadSelectedText.textContent = `Seçilenleri İndir (${selectedCount})`;
        }
      } else {
        this.btnDownloadSelected.disabled = true;
        this.btnDownloadSelected.classList.add('disabled');
        if (this.btnDownloadSelectedText) {
          this.btnDownloadSelectedText.textContent = 'İndirilecek Seçin';
        }
      }
    }
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
      this.mediaCountEl.textContent = '0 video bulundu';
      if (this.chkSelectAll) this.chkSelectAll.disabled = true;
      if (this.btnDownloadSelected) {
        this.btnDownloadSelected.disabled = true;
        this.btnDownloadSelected.classList.add('disabled');
        if (this.btnDownloadSelectedText) this.btnDownloadSelectedText.textContent = 'Seçilenleri İndir';
      }
      return;
    }

    this.emptyStateEl.classList.add('hidden');
    if (this.chkSelectAll) this.chkSelectAll.disabled = false;
    this.mediaCountEl.textContent = `${this.mediaItems.length} medya bulundu`;

    // Ensure valid selections
    const currentValidIds = new Set(this.mediaItems.map((m) => m.id));
    for (const id of this.selectedIds) {
      if (!currentValidIds.has(id)) this.selectedIds.delete(id);
    }

    // Default: Select all video/media items if none selected
    if (this.selectedIds.size === 0) {
      this.mediaItems.forEach((m) => this.selectedIds.add(m.id));
    }

    this.mediaItems.forEach((item, index) => {
      const isSelected = this.selectedIds.has(item.id);
      const card = MediaCardRenderer.render(item, index, isSelected, {
        onDownload: (m, btn, c) => this.downloadItem(m, btn, c),
        onPreview: (m) => this.playPreview(m),
        onCopy: (url, btn) => this.copyUrl(url, btn),
        onOpenTab: (url) => chrome.tabs.create({ url }),
        onToggleSelect: (id, checked) => this.toggleSelect(id, checked)
      });
      this.mediaListEl.appendChild(card);
    });

    this.updateSelectionUI();
  }

  async downloadSelected() {
    const selectedItems = this.mediaItems.filter((m) => this.selectedIds.has(m.id));
    if (selectedItems.length === 0) return;

    this.btnDownloadSelected.disabled = true;
    this.btnDownloadSelected.classList.add('btn-download-selected--active');
    if (this.btnDownloadSelectedText) {
      this.btnDownloadSelectedText.textContent = `İndiriliyor (0/${selectedItems.length})...`;
    }

    let completed = 0;
    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const card = this.mediaListEl.querySelector(`.media-card[data-id="${item.id}"]`);
      const btn = card ? card.querySelector('.btn-download') : null;

      if (this.btnDownloadSelectedText) {
        this.btnDownloadSelectedText.textContent = `İndiriliyor (${i + 1}/${selectedItems.length})...`;
      }

      try {
        if (btn) {
          await this.downloadItem(item, btn, card);
          completed++;
        }
      } catch (err) {
        console.error('Failed downloading item:', item, err);
      }

      await new Promise((r) => setTimeout(r, 600));
    }

    this.btnDownloadSelected.classList.remove('btn-download-selected--active');
    this.btnDownloadSelected.classList.add('btn-download-selected--success');
    if (this.btnDownloadSelectedText) {
      this.btnDownloadSelectedText.textContent = `✓ Tamamlandı (${completed})`;
    }

    setTimeout(() => {
      this.btnDownloadSelected.classList.remove('btn-download-selected--success');
      this.updateSelectionUI();
    }, 3500);
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
