/**
 * Internet Video Download Assistant - Service Worker (Manifest V3)
 * Handles network sniffing, storage management, download orchestration, and badge updates.
 */

// Storage helper functions using chrome.storage.local (or chrome.storage.session)
const storage = chrome.storage.session || chrome.storage.local;

// In-memory debounce / deduplication cache per tab
const recentUrls = new Map();

/**
 * Format bytes into human readable string (KB, MB, GB)
 */
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return 'Bilinmiyor';
  const k = 1024;
  const sizes = ['Bayt', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Clean and sanitize a filename for safe download
 */
function sanitizeFilename(name, fallbackExt = 'mp4') {
  if (!name || typeof name !== 'string') {
    return `video_${Date.now()}.${fallbackExt}`;
  }
  // Replace illegal filename characters
  let clean = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  clean = clean.replace(/\s+/g, ' ');
  if (clean.length > 80) {
    clean = clean.substring(0, 80);
  }
  if (!clean.includes('.')) {
    clean = `${clean}.${fallbackExt}`;
  }
  return clean;
}

/**
 * Determine file format from MIME type or URL
 */
function detectFormat(url, mime = '') {
  mime = (mime || '').toLowerCase();
  const urlPath = url.split('?')[0].toLowerCase();

  if (mime.includes('vtt') || urlPath.endsWith('.vtt')) return 'VTT';
  if (mime.includes('subrip') || urlPath.endsWith('.srt')) return 'SRT';
  if (mime.includes('ttml') || urlPath.endsWith('.ttml') || urlPath.endsWith('.dfxp')) return 'TTML';
  if (url.includes('/timedtext')) return 'VTT';
  if (mime.includes('mpegurl') || urlPath.endsWith('.m3u8') || url.includes('.m3u8')) return 'M3U8';
  if (mime.includes('dash+xml') || urlPath.endsWith('.mpd')) return 'MPD';
  if (mime.includes('mp4') || urlPath.endsWith('.mp4') || urlPath.endsWith('.m4v')) return 'MP4';
  if (mime.includes('webm') || urlPath.endsWith('.webm')) return 'WEBM';
  if (mime.includes('x-matroska') || urlPath.endsWith('.mkv')) return 'MKV';
  if (mime.includes('quicktime') || urlPath.endsWith('.mov')) return 'MOV';
  if (mime.includes('x-flv') || urlPath.endsWith('.flv')) return 'FLV';
  if (mime.includes('mp2t') || urlPath.endsWith('.ts')) return 'TS';
  if (mime.includes('audio/mpeg') || urlPath.endsWith('.mp3')) return 'MP3';
  if (mime.includes('audio/aac') || urlPath.endsWith('.aac')) return 'AAC';
  if (mime.includes('audio/mp4') || urlPath.endsWith('.m4a')) return 'M4A';
  if (mime.includes('audio/ogg') || urlPath.endsWith('.ogg')) return 'OGG';
  if (mime.includes('audio')) return 'SES';
  if (mime.includes('video')) return 'VIDEO';

  return 'MP4';
}

/**
 * Get media items for a given tab
 */
async function getTabMedia(tabId) {
  const key = `tab_${tabId}`;
  const data = await storage.get(key);
  return data[key] || [];
}

/**
 * Save media items for a given tab and update badge
 */
async function saveTabMedia(tabId, mediaList) {
  const key = `tab_${tabId}`;
  await storage.set({ [key]: mediaList });
  await updateBadge(tabId, mediaList.length);
}

/**
 * Update the extension icon badge counter for a tab
 */
async function updateBadge(tabId, count) {
  try {
    if (count > 0) {
      await chrome.action.setBadgeText({ text: String(count), tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#0284c7', tabId });
    } else {
      await chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch (err) {
    // Tab might be closed or invalid
  }
}

/**
 * Add or update a media item for a tab
 */
async function registerMedia(tabId, item) {
  if (!tabId || tabId < 0 || !item.url) return;

  // Ignore chrome:// or extension internal urls
  if (item.url.startsWith('chrome://') || item.url.startsWith('chrome-extension://')) return;

  // Ignore very small segments / files (< 150KB) unless it's an M3U8/MPD manifest or Subtitle
  const isManifest = item.format === 'M3U8' || item.format === 'MPD' || item.url.includes('.m3u8');
  const isSubtitle = item.format === 'VTT' || item.format === 'SRT' || item.format === 'TTML' || item.isSubtitle;
  if (!isManifest && !isSubtitle && item.size && item.size > 0 && item.size < 150 * 1024) {
    return;
  }

  const currentMedia = await getTabMedia(tabId);

  // Check if URL is already detected for this tab
  const existingIndex = currentMedia.findIndex(m => m.url === item.url);
  if (existingIndex >= 0) {
    // Merge new metadata if available (e.g. better size, quality or title)
    const existing = currentMedia[existingIndex];
    currentMedia[existingIndex] = {
      ...existing,
      size: item.size || existing.size,
      sizeFormatted: item.sizeFormatted || existing.sizeFormatted,
      quality: item.quality || existing.quality,
      duration: item.duration || existing.duration,
      title: item.title && !existing.title.includes('.') ? item.title : existing.title,
      poster: item.poster || existing.poster,
      isSubtitle: item.isSubtitle || existing.isSubtitle
    };
    await saveTabMedia(tabId, currentMedia);
    return;
  }

  // Get tab details for smart title fallback
  if (!item.title) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.title) {
        item.title = tab.title.split(' - ')[0].trim();
      }
    } catch {
      // Fallback from URL
      try {
        const u = new URL(item.url);
        item.title = u.pathname.split('/').pop() || 'Video';
      } catch {
        item.title = 'Web Medyası';
      }
    }
  }

  if (isSubtitle && !item.title.toLowerCase().includes('altyazı') && !item.title.toLowerCase().includes('subtitle')) {
    item.title = `${item.title} (Altyazı)`;
  }

  item.id = `media_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  item.timestamp = Date.now();
  if (!item.sizeFormatted && item.size) {
    item.sizeFormatted = formatBytes(item.size);
  }

  currentMedia.unshift(item); // Add to beginning of list
  await saveTabMedia(tabId, currentMedia);
}

// -------------------------------------------------------------
// Network Sniffing: Passive webRequest monitoring
// -------------------------------------------------------------
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    // Only inspect main web requests from valid tabs
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

    const isVideoMime = contentType.startsWith('video/') ||
      contentType.includes('application/x-mpegurl') ||
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/dash+xml') ||
      contentType.includes('video/mp2t');

    const isAudioMime = contentType.startsWith('audio/');

    const isSubtitleMime = contentType.includes('text/vtt') ||
      contentType.includes('application/x-subrip') ||
      contentType.includes('application/ttml+xml') ||
      (contentType.includes('text/plain') && (details.url.includes('.vtt') || details.url.includes('.srt')));

    const url = details.url;
    const urlPath = url.split('?')[0].toLowerCase();
    const hasMediaExtension = /\.(mp4|m3u8|webm|mkv|mov|flv|ts|mp3|m4a|aac)$/i.test(urlPath);
    const hasSubtitleExtension = /\.(vtt|srt|ttml|dfxp)$/i.test(urlPath) || url.includes('/timedtext');

    if (isVideoMime || (isAudioMime && contentLength > 100 * 1024) || isSubtitleMime || hasMediaExtension || hasSubtitleExtension) {
      const format = detectFormat(url, contentType);
      const isSub = format === 'VTT' || format === 'SRT' || format === 'TTML' || isSubtitleMime || hasSubtitleExtension;

      registerMedia(details.tabId, {
        url: details.url,
        tabId: details.tabId,
        mimeType: contentType,
        format,
        size: contentLength,
        sizeFormatted: formatBytes(contentLength),
        isSubtitle: isSub,
        source: 'network'
      }).catch(console.error);
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// -------------------------------------------------------------
// Tab Lifecycle Listeners
// -------------------------------------------------------------

// Reset tab media on navigation (loading status)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    await storage.remove(`tab_${tabId}`);
    await updateBadge(tabId, 0);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await storage.remove(`tab_${tabId}`);
});

// Update badge when user switches active tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const mediaList = await getTabMedia(activeInfo.tabId);
  await updateBadge(activeInfo.tabId, mediaList.length);
});

// -------------------------------------------------------------
// Message Passing Handler
// -------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const tabId = sender.tab ? sender.tab.id : message.tabId;

      switch (message.type) {
        // Content script reports media found in DOM
        case 'REGISTER_DOM_MEDIA': {
          if (tabId && message.media) {
            await registerMedia(tabId, {
              ...message.media,
              source: 'dom'
            });
            sendResponse({ success: true });
          }
          break;
        }

        // Popup requests detected media list for active tab
        case 'GET_TAB_MEDIA': {
          const targetTabId = message.tabId || tabId;
          const media = await getTabMedia(targetTabId);
          sendResponse({ success: true, media });
          break;
        }

        // Trigger file download
        case 'DOWNLOAD_MEDIA': {
          const { url, title, format } = message;
          if (!url) {
            sendResponse({ success: false, error: 'URL boş olamaz' });
            return;
          }

          // If M3U8 stream, route to built-in HLS Downloader tab
          if (format === 'M3U8' || url.includes('.m3u8')) {
            const hlsUrl = chrome.runtime.getURL(
              `hls-downloader/downloader.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || 'video')}`
            );
            await chrome.tabs.create({ url: hlsUrl });
            sendResponse({ success: true, openedDownloader: true });
            return;
          }

          // Direct file download using Chrome Downloads API
          const ext = (format || 'mp4').toLowerCase();
          const cleanName = sanitizeFilename(title, ext);

          chrome.downloads.download(
            {
              url: url,
              filename: cleanName,
              saveAs: false,
              conflictAction: 'uniquify'
            },
            (downloadId) => {
              if (chrome.runtime.lastError) {
                console.warn('Download error:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse({ success: true, downloadId });
              }
            }
          );
          break;
        }

        // Clear media list for a tab
        case 'CLEAR_TAB_MEDIA': {
          if (tabId) {
            await storage.remove(`tab_${tabId}`);
            await updateBadge(tabId, 0);
            sendResponse({ success: true });
          }
          break;
        }

        default:
          sendResponse({ success: false, error: 'Bilinmeyen işlem' });
      }
    } catch (err) {
      console.error('Service worker message error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
});
