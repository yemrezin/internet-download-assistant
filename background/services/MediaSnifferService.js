import { MediaClassifier } from './MediaClassifier.js';

/**
 * MediaSnifferService
 * Single Responsibility: Passively inspects network response headers to detect media streams and files.
 */
export class MediaSnifferService {
  /**
   * @param {import('./StorageService.js').StorageService} storageService
   */
  constructor(storageService) {
    this.storageService = storageService;
  }

  /**
   * Registers a detected media item for a specific tab
   * @param {number} tabId
   * @param {Object} item
   */
  async registerMedia(tabId, item) {
    if (!tabId || tabId < 0 || !item.url) return;
    if (item.url.startsWith('chrome://') || item.url.startsWith('chrome-extension://')) return;

    const isManifest = item.format === 'M3U8' || item.format === 'MPD' || item.url.includes('.m3u8');
    const isSubtitle = item.isSubtitle || MediaClassifier.isSubtitle(item.format, item.mimeType);

    // Filter tiny non-manifest, non-subtitle resources (< 150KB)
    if (!isManifest && !isSubtitle && item.size && item.size > 0 && item.size < 150 * 1024) {
      return;
    }

    const currentMedia = await this.storageService.getTabMedia(tabId);

    // Merge or update existing entry
    const existingIndex = currentMedia.findIndex((m) => m.url === item.url);
    if (existingIndex >= 0) {
      const existing = currentMedia[existingIndex];
      currentMedia[existingIndex] = {
        ...existing,
        size: item.size || existing.size,
        sizeFormatted: item.sizeFormatted || existing.sizeFormatted,
        quality: item.quality || existing.quality,
        duration: item.duration || existing.duration,
        title: item.title && !existing.title.includes('.') ? item.title : existing.title,
        poster: item.poster || existing.poster,
        isSubtitle: isSubtitle || existing.isSubtitle,
        pageUrl: item.pageUrl || existing.pageUrl
      };
      await this.storageService.saveTabMedia(tabId, currentMedia);
      return;
    }

    // Resolve fallback title and page URL from tab
    if (!item.title || !item.pageUrl) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab) {
          if (!item.title && tab.title) {
            item.title = tab.title.split(' - ')[0].trim();
          }
          if (!item.pageUrl && tab.url) {
            item.pageUrl = tab.url;
          }
        }
      } catch {
        if (!item.title) {
          try {
            item.title = new URL(item.url).pathname.split('/').pop() || 'Web Video';
          } catch {
            item.title = 'Web Medyası';
          }
        }
      }
    }

    if (isSubtitle && !item.title.toLowerCase().includes('altyazı') && !item.title.toLowerCase().includes('subtitle')) {
      item.title = `${item.title} (Altyazı)`;
    }

    item.id = `media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    item.timestamp = Date.now();
    if (!item.sizeFormatted && item.size) {
      item.sizeFormatted = MediaClassifier.formatBytes(item.size);
    }
    item.isSubtitle = isSubtitle;

    currentMedia.unshift(item);
    await this.storageService.saveTabMedia(tabId, currentMedia);
  }

  /**
   * Initializes network interception listener
   */
  startListening() {
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        if (!details.tabId || details.tabId < 0) return;
        if (details.type === 'image' || details.type === 'stylesheet' || details.type === 'font') return;

        let contentType = '';
        let contentLength = 0;

        if (details.responseHeaders) {
          for (const header of details.responseHeaders) {
            const name = header.name.toLowerCase();
            if (name === 'content-type') {
              contentType = header.value.toLowerCase();
            } else if (name === 'content-length') {
              contentLength = parseInt(header.value, 10) || 0;
            }
          }
        }

        const isVideoMime =
          contentType.startsWith('video/') ||
          contentType.includes('application/x-mpegurl') ||
          contentType.includes('application/vnd.apple.mpegurl') ||
          contentType.includes('application/dash+xml') ||
          contentType.includes('video/mp2t');

        const isAudioMime = contentType.startsWith('audio/');
        const isSubtitleMime =
          contentType.includes('text/vtt') ||
          contentType.includes('application/x-subrip') ||
          contentType.includes('application/ttml+xml') ||
          (contentType.includes('text/plain') && (details.url.includes('.vtt') || details.url.includes('.srt')));

        const url = details.url;
        const urlPath = url.split('?')[0].toLowerCase();
        const hasMediaExt = /\.(mp4|m3u8|webm|mkv|mov|flv|ts|mp3|m4a|aac)$/i.test(urlPath);
        const hasSubExt = /\.(vtt|srt|ttml|dfxp)$/i.test(urlPath) || url.includes('/timedtext');

        if (isVideoMime || (isAudioMime && contentLength > 100 * 1024) || isSubtitleMime || hasMediaExt || hasSubExt) {
          const format = MediaClassifier.detectFormat(url, contentType);
          const isSub = isSubtitleMime || hasSubExt || MediaClassifier.isSubtitle(format, contentType);

          this.registerMedia(details.tabId, {
            url: details.url,
            tabId: details.tabId,
            mimeType: contentType,
            format,
            size: contentLength,
            sizeFormatted: MediaClassifier.formatBytes(contentLength),
            isSubtitle: isSub,
            source: 'network'
          }).catch(console.error);
        }
      },
      { urls: ['<all_urls>'] },
      ['responseHeaders']
    );
  }
}
