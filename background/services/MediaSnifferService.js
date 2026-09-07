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
    this.requestHeaderCache = new Map();
  }

  /**
   * Registers a detected media item for a specific tab
   * @param {number} tabId
   * @param {Object} item
   */
  async registerMedia(tabId, item) {
    if (!tabId || tabId < 0 || !item.url) return;
    if (item.url.startsWith('chrome://') || item.url.startsWith('chrome-extension://')) return;

    const isManifest =
      item.format === 'M3U8' ||
      item.format === 'MPD' ||
      MediaClassifier.isHlsStream(item.format, item.url);

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
        pageUrl: item.pageUrl || existing.pageUrl,
        referer: item.referer || existing.referer,
        initiator: item.initiator || existing.initiator
      };
      await this.storageService.saveTabMedia(tabId, currentMedia);
      return;
    }

    // Resolve fallback title and page URL from tab
    let tab = null;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      tab = null;
    }

    if (tab) {
      if (!item.pageUrl && tab.url) {
        item.pageUrl = tab.url;
      }
      if (
        !item.title ||
        item.title === 'Web Medyası' ||
        item.title === 'Web Video' ||
        item.title.endsWith('.txt') ||
        item.title.startsWith('master') ||
        item.title.startsWith('sublist')
      ) {
        if (tab.title) {
          item.title = tab.title.split(' - ')[0].trim();
        }
      }
    }

    if (!item.title) {
      try {
        item.title = new URL(item.url).pathname.split('/').pop() || 'Web Medyası';
      } catch {
        item.title = 'Web Medyası';
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
    item.referer = item.referer || item.pageUrl || '';

    currentMedia.unshift(item);
    await this.storageService.saveTabMedia(tabId, currentMedia);
  }

  /**
   * Initializes network interception listeners
   */
  startListening() {
    // 1. Capture exact Referer and Origin headers sent by the browser
    if (chrome.webRequest.onBeforeSendHeaders) {
      try {
        chrome.webRequest.onBeforeSendHeaders.addListener(
          (details) => {
            if (!details.url || details.url.startsWith('chrome') || details.tabId < 0) return;

            let referer = '';
            let origin = '';

            if (details.requestHeaders) {
              for (const header of details.requestHeaders) {
                const hName = header.name.toLowerCase();
                if (hName === 'referer') referer = header.value;
                else if (hName === 'origin') origin = header.value;
              }
            }

            if (!referer && details.initiator) {
              referer = details.initiator;
            }

            if (referer || origin) {
              this.requestHeaderCache.set(details.url, {
                referer: referer || origin,
                origin: origin || (referer ? new URL(referer).origin : ''),
                timestamp: Date.now()
              });

              if (this.requestHeaderCache.size > 300) {
                const firstKey = this.requestHeaderCache.keys().next().value;
                this.requestHeaderCache.delete(firstKey);
              }
            }
          },
          { urls: ['<all_urls>'] },
          ['requestHeaders', 'extraHeaders']
        );
      } catch (err) {
        console.warn('MediaSnifferService: Failed to attach onBeforeSendHeaders extraHeaders:', err);
      }
    }

    // 2. Intercept response headers to detect media resources
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        if (!details.tabId || details.tabId < 0) return;
        if (details.type === 'stylesheet' || details.type === 'font') return;

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

        const url = details.url;
        const urlPath = url.split('?')[0].toLowerCase();

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
          (contentType.includes('text/plain') && (urlPath.endsWith('.vtt') || urlPath.endsWith('.srt')));

        const isHlsPath =
          urlPath.includes('/hls/') ||
          urlPath.includes('master.txt') ||
          urlPath.endsWith('.m3u8') ||
          urlPath.includes('.m3u8') ||
          urlPath.includes('sublist_');

        const hasMediaExt = /\.(mp4|m3u8|webm|mkv|mov|flv|ts|mp3|m4a|aac)$/i.test(urlPath);
        const hasSubExt = /\.(vtt|srt|ttml|dfxp)$/i.test(urlPath) || url.includes('/timedtext');

        if (isVideoMime || isHlsPath || (isAudioMime && contentLength > 100 * 1024) || isSubtitleMime || hasMediaExt || hasSubExt) {
          const format = isHlsPath ? 'M3U8' : MediaClassifier.detectFormat(url, contentType);
          const isSub = isSubtitleMime || hasSubExt || MediaClassifier.isSubtitle(format, contentType);

          const cachedHeader = this.requestHeaderCache.get(url);
          const referer = (cachedHeader && cachedHeader.referer) || details.initiator || '';

          this.registerMedia(details.tabId, {
            url: details.url,
            tabId: details.tabId,
            mimeType: contentType,
            format,
            size: contentLength,
            sizeFormatted: MediaClassifier.formatBytes(contentLength),
            isSubtitle: isSub,
            referer: referer,
            initiator: details.initiator || '',
            source: 'network'
          }).catch(console.error);
        }
      },
      { urls: ['<all_urls>'] },
      ['responseHeaders']
    );
  }
}
