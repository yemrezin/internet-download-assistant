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
  /**
   * Registers a detected media item for a specific tab
   * @param {number} tabId
   * @param {Object} item
   */
  async registerMedia(tabId, item) {
    if (!tabId || tabId < 0 || !item.url) return;
    if (item.url.startsWith('chrome://') || item.url.startsWith('chrome-extension://')) return;

    // Filter segment chunks unconditionally
    if (MediaClassifier.isSegmentChunk(item.url, item.mimeType)) {
      return;
    }

    const isManifest =
      item.format === 'M3U8' ||
      item.format === 'MPD' ||
      MediaClassifier.isHlsStream(item.format, item.url);

    const isSubtitle = item.isSubtitle || MediaClassifier.isSubtitle(item.format, item.mimeType);
    const isAudio = item.format === 'MP3' || item.format === 'AAC' || item.format === 'M4A' || item.format === 'SES';

    // Filter tiny non-manifest, non-subtitle resources (< 150KB)
    if (!isManifest && !isSubtitle && !isAudio && item.size && item.size > 0 && item.size < 150 * 1024) {
      return;
    }

    const currentMedia = await this.storageService.getTabMedia(tabId);

    // Resolve tab context for title
    let tab = null;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      tab = null;
    }

    let cleanTitle = item.title || '';
    if (tab && tab.title) {
      if (
        !cleanTitle ||
        cleanTitle === 'Web Medyası' ||
        cleanTitle === 'Web Video' ||
        cleanTitle.endsWith('.txt') ||
        cleanTitle.endsWith('.m3u8') ||
        cleanTitle.startsWith('master') ||
        cleanTitle.startsWith('sublist') ||
        cleanTitle.startsWith('playlist')
      ) {
        cleanTitle = tab.title.split(' - ')[0].trim();
      }
    }

    if (!cleanTitle) {
      try {
        cleanTitle = new URL(item.url).pathname.split('/').pop() || 'Video';
      } catch {
        cleanTitle = 'Video';
      }
    }

    // Master / Sublist filtering and deduplication for HLS
    const isMaster = MediaClassifier.isMasterPlaylist(item.url);
    const isSub = MediaClassifier.isSublist(item.url);

    if (isSub) {
      // If a master playlist is already registered for this tab, do NOT add sublist as another card
      const hasMaster = currentMedia.some((m) => MediaClassifier.isMasterPlaylist(m.url));
      if (hasMaster) {
        return;
      }
    }

    if (isMaster) {
      // If this is a master playlist, remove any previously captured secondary sublists
      const sublistIdx = currentMedia.findIndex((m) => MediaClassifier.isSublist(m.url));
      if (sublistIdx >= 0) {
        currentMedia.splice(sublistIdx, 1);
      }
    }

    // Accurate size & quality calculation
    let sizeFormatted = item.sizeFormatted;
    let quality = item.quality || (isManifest ? '1080p Full HD' : 'HD');

    if (isManifest) {
      // Do not display 120 KB text file size; estimate true video file size
      sizeFormatted = MediaClassifier.estimateHlsSize(item.bandwidth || 0, item.duration || 0, quality);
    } else if (!sizeFormatted && item.size) {
      sizeFormatted = MediaClassifier.formatBytes(item.size);
    }

    // Merge or update existing entry
    const existingIndex = currentMedia.findIndex((m) => m.url === item.url);
    if (existingIndex >= 0) {
      const existing = currentMedia[existingIndex];
      currentMedia[existingIndex] = {
        ...existing,
        size: isManifest ? existing.size : (item.size || existing.size),
        sizeFormatted: sizeFormatted || existing.sizeFormatted,
        quality: quality || existing.quality,
        duration: item.duration || existing.duration,
        title: cleanTitle || existing.title,
        poster: item.poster || existing.poster,
        isSubtitle: isSubtitle || existing.isSubtitle,
        pageUrl: item.pageUrl || existing.pageUrl,
        referer: item.referer || existing.referer,
        initiator: item.initiator || existing.initiator
      };
      await this.storageService.saveTabMedia(tabId, currentMedia);
      return;
    }

    // Check if there is already a primary video from the same video stream on this page
    if (isManifest && !isSubtitle && !isAudio) {
      const existingVideoIdx = currentMedia.findIndex(
        (m) => (m.format === 'M3U8' || MediaClassifier.isHlsStream(m.format, m.url)) && !m.isSubtitle
      );
      if (existingVideoIdx >= 0) {
        // If current is master and existing is not master, upgrade existing
        if (isMaster && !MediaClassifier.isMasterPlaylist(currentMedia[existingVideoIdx].url)) {
          currentMedia[existingVideoIdx].url = item.url;
          currentMedia[existingVideoIdx].quality = quality;
          currentMedia[existingVideoIdx].sizeFormatted = sizeFormatted;
          await this.storageService.saveTabMedia(tabId, currentMedia);
        }
        return;
      }
    }

    if (isSubtitle && !cleanTitle.toLowerCase().includes('altyazı') && !cleanTitle.toLowerCase().includes('subtitle')) {
      cleanTitle = `${cleanTitle} (Altyazı)`;
    }

    item.id = `media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    item.timestamp = Date.now();
    item.title = cleanTitle;
    item.quality = quality;
    item.sizeFormatted = sizeFormatted || 'Bilinmiyor';
    item.isSubtitle = isSubtitle;
    item.referer = item.referer || (tab && tab.url) || item.pageUrl || '';
    if (tab && !item.pageUrl) {
      item.pageUrl = tab.url;
    }

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

        // Fast reject: Never process segment chunks or image files as media entries
        if (contentType.startsWith('image/') || MediaClassifier.isSegmentChunk(url, contentType)) {
          return;
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
          (contentType.includes('text/plain') && (urlPath.endsWith('.vtt') || urlPath.endsWith('.srt')));

        const isHlsPlaylist =
          urlPath.endsWith('.m3u8') ||
          urlPath.includes('.m3u8') ||
          urlPath.includes('master.txt') ||
          urlPath.includes('/master.') ||
          urlPath.includes('playlist.txt') ||
          urlPath.includes('playlist.m3u8') ||
          (urlPath.includes('sublist_') && urlPath.endsWith('.txt')) ||
          contentType.includes('mpegurl');

        const hasMediaExt = /\.(mp4|webm|mkv|mov|flv|mp3|m4a|aac)$/i.test(urlPath);
        const hasSubExt = /\.(vtt|srt|ttml|dfxp)$/i.test(urlPath) || url.includes('/timedtext');

        if (isVideoMime || isHlsPlaylist || (isAudioMime && contentLength > 100 * 1024) || isSubtitleMime || hasMediaExt || hasSubExt) {
          const format = isHlsPlaylist ? 'M3U8' : MediaClassifier.detectFormat(url, contentType);
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
