/**
 * Internet Video Download Assistant - Content Script
 * Scans DOM for video/audio players and coordinates with background worker & floating widget.
 */

(function () {
  const scannedUrls = new Set();

  function getQualityFromDimensions(w, h) {
    if (!h && !w) return '';
    if (h >= 2160 || w >= 3840) return '4K';
    if (h >= 1440 || w >= 2560) return '2K';
    if (h >= 1080 || w >= 1920) return '1080p';
    if (h >= 720 || w >= 1280) return '720p';
    if (h >= 480) return '480p';
    if (h > 0) return `${h}p`;
    return '';
  }

  function reportMedia(url, mediaEl, extra = {}) {
    if (!url || typeof url !== 'string') return;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('javascript:')) {
      // If it's blob, we still note it or check for source elements
      if (url.startsWith('blob:') && mediaEl) {
        // Many blob players have an underlying m3u8 or video source, or network sniffer catches it
      }
      return;
    }
    if (scannedUrls.has(url)) return;
    scannedUrls.add(url);

    const isVideo = mediaEl && mediaEl.tagName.toLowerCase() === 'video';
    const quality = isVideo ? getQualityFromDimensions(mediaEl.videoWidth, mediaEl.videoHeight) : '';
    const duration = mediaEl && !isNaN(mediaEl.duration) ? Math.round(mediaEl.duration) : 0;
    const poster = isVideo ? mediaEl.poster : '';
    const title = document.title ? document.title.split(' - ')[0].trim() : 'Web Medyası';

    chrome.runtime.sendMessage({
      type: 'REGISTER_DOM_MEDIA',
      media: {
        url,
        title,
        quality,
        duration,
        poster,
        format: url.includes('.m3u8') ? 'M3U8' : isVideo ? 'MP4' : 'AUDIO',
        ...extra
      }
    }).catch(() => {
      // Context might be invalid during navigation
    });
  }

  function inspectMediaElement(el) {
    if (!el) return;
    const tagName = el.tagName.toLowerCase();
    if (tagName !== 'video' && tagName !== 'audio') return;

    // Attach floating IDM button if it's a video
    if (tagName === 'video' && window.__IDA_FLOATING__) {
      window.__IDA_FLOATING__.attach(el);
    }

    // Check direct src
    const src = el.currentSrc || el.src;
    if (src) {
      reportMedia(src, el);
    }

    // Check <source> children
    const sources = el.querySelectorAll('source');
    sources.forEach(s => {
      if (s.src) {
        reportMedia(s.src, el);
      }
    });

    // Check <track> children for subtitles / captions
    const tracks = el.querySelectorAll('track');
    tracks.forEach(t => {
      if (t.src) {
        const lang = t.label || t.srclang || 'Altyazı';
        const pageTitle = document.title ? document.title.split(' - ')[0].trim() : 'Video';
        reportMedia(t.src, el, {
          format: t.src.includes('.srt') ? 'SRT' : 'VTT',
          title: `${pageTitle} - [${lang.toUpperCase()}] Altyazı`,
          isSubtitle: true
        });
      }
    });

    // Listen for playback / metadata events to capture dynamically loaded streams
    const onPlayOrLoaded = () => {
      const current = el.currentSrc || el.src;
      if (current) {
        reportMedia(current, el);
      }
    };

    el.addEventListener('loadedmetadata', onPlayOrLoaded, { passive: true });
    el.addEventListener('play', onPlayOrLoaded, { passive: true });
    el.addEventListener('playing', onPlayOrLoaded, { passive: true });
  }

  // Scan all existing media elements on the page
  function scanAll() {
    document.querySelectorAll('video, audio').forEach(inspectMediaElement);
  }

  // Monitor DOM additions using MutationObserver for dynamic players
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches && node.matches('video, audio')) {
            inspectMediaElement(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('video, audio').forEach(inspectMediaElement);
          }
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Initial scan
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAll);
  } else {
    scanAll();
  }

  // Also re-scan on window load for delayed players
  window.addEventListener('load', scanAll);

  // Listen for manual scan request from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCAN_PAGE_MEDIA') {
      scanAll();
      sendResponse({ success: true, count: scannedUrls.size });
    }
    return true;
  });
})();
