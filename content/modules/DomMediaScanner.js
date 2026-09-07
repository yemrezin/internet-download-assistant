/**
 * DomMediaScanner
 * Single Responsibility: Observes and traverses the DOM for media elements (<video>, <audio>, <source>, <track>)
 * and reports them to the background service worker and overlay presenter.
 */
class DomMediaScanner {
  /**
   * @param {VideoOverlayPresenter} overlayPresenter
   */
  constructor(overlayPresenter) {
    this.overlayPresenter = overlayPresenter;
    this.discoveredUrls = new Set();
  }

  static getResolutionLabel(width, height) {
    if (!height && !width) return '';
    if (height >= 2160 || width >= 3840) return '4K';
    if (height >= 1440 || width >= 2560) return '2K';
    if (height >= 1080 || width >= 1920) return '1080p';
    if (height >= 720 || width >= 1280) return '720p';
    if (height >= 480) return '480p';
    if (height > 0) return `${height}p`;
    return '';
  }

  reportMediaItem(url, element, extra = {}) {
    if (!url || typeof url !== 'string') return;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('javascript:')) return;
    if (this.discoveredUrls.has(url)) return;
    this.discoveredUrls.add(url);

    const isVideo = element && element.tagName.toLowerCase() === 'video';
    const quality = isVideo ? DomMediaScanner.getResolutionLabel(element.videoWidth, element.videoHeight) : '';
    const duration = element && !isNaN(element.duration) ? Math.round(element.duration) : 0;
    const poster = isVideo ? element.poster : '';
    const pageTitle = document.title ? document.title.split(' - ')[0].trim() : 'Web Medyası';

    chrome.runtime
      .sendMessage({
        type: 'REGISTER_DOM_MEDIA',
        media: {
          url,
          title: pageTitle,
          quality,
          duration,
          poster,
          pageUrl: window.location.href,
          format: url.includes('.m3u8') ? 'M3U8' : isVideo ? 'MP4' : 'AUDIO',
          ...extra
        }
      })
      .catch(() => {});
  }

  inspectElement(element) {
    if (!element || !element.tagName) return;
    const tag = element.tagName.toLowerCase();
    if (tag !== 'video' && tag !== 'audio') return;

    // Attach overlay widget to video elements
    if (tag === 'video' && this.overlayPresenter) {
      this.overlayPresenter.attach(element);
    }

    // Inspect direct source
    const directSrc = element.currentSrc || element.src;
    if (directSrc) {
      this.reportMediaItem(directSrc, element);
    }

    // Inspect <source> children
    const sources = element.querySelectorAll('source');
    sources.forEach((s) => {
      if (s.src) this.reportMediaItem(s.src, element);
    });

    // Inspect <track> children for subtitles
    const tracks = element.querySelectorAll('track');
    tracks.forEach((t) => {
      if (t.src) {
        const lang = t.label || t.srclang || 'Altyazı';
        const pageTitle = document.title ? document.title.split(' - ')[0].trim() : 'Video';
        this.reportMediaItem(t.src, element, {
          format: t.src.includes('.srt') ? 'SRT' : 'VTT',
          title: `${pageTitle} - [${lang.toUpperCase()}] Altyazı`,
          isSubtitle: true
        });
      }
    });

    // Event listener for dynamically resolved playback sources
    const onPlayback = () => {
      const current = element.currentSrc || element.src;
      if (current) this.reportMediaItem(current, element);
    };

    element.addEventListener('loadedmetadata', onPlayback, { passive: true });
    element.addEventListener('play', onPlayback, { passive: true });
    element.addEventListener('playing', onPlayback, { passive: true });
  }

  scanAll() {
    document.querySelectorAll('video, audio').forEach((el) => this.inspectElement(el));
  }

  startObserving() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches && node.matches('video, audio')) {
              this.inspectElement(node);
            } else if (node.querySelectorAll) {
              node.querySelectorAll('video, audio').forEach((el) => this.inspectElement(el));
            }
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.scanAll());
    } else {
      this.scanAll();
    }

    window.addEventListener('load', () => this.scanAll());
  }
}

window.DomMediaScanner = DomMediaScanner;
