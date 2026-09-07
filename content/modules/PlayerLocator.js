/**
 * PlayerLocator
 * Single Responsibility: Universally identifies the primary video player container on ANY website
 * using geometric bounds, ARIA roles, and standard media wrapper heuristics.
 */
class PlayerLocator {
  /**
   * Discovers the optimal positioning container for a video element
   * @param {HTMLVideoElement} video
   * @returns {HTMLElement|null}
   */
  static locatePlayerContainer(video) {
    if (!video || !video.isConnected) return null;

    // Ignore tiny or invisible background video elements
    const vRect = video.getBoundingClientRect();
    if (vRect.width < 160 || vRect.height < 100) return null;

    // 1. Check Fullscreen element
    const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreenEl && (fullscreenEl === video || fullscreenEl.contains(video))) {
      return fullscreenEl;
    }

    // 2. Platform-specific smart identification (e.g. YouTube main player)
    if (location.hostname.includes('youtube.com')) {
      // Discard thumbnail hover previews and shorts background elements
      if (video.closest('ytd-thumbnail, #inline-preview-player, ytd-video-preview, .ytd-video-preview, ytd-rich-grid-media')) {
        return null;
      }
      const ytMain = video.closest('#movie_player, .html5-video-player');
      if (ytMain) return ytMain;
      if (video.classList.contains('html5-main-video') && video.parentElement) {
        return video.parentElement;
      }
      return null;
    }

    // 3. Universal Player Frameworks (VideoJS, JWPlayer, Plyr, DPlayer, Artplayer, Clappr, etc.)
    const frameworkSelector = [
      '.video-js',
      '.jwplayer',
      '.plyr',
      '.dplayer',
      '.artplayer',
      '[class*="player-container"]',
      '[class*="player-wrap"]',
      '[class*="player_container"]',
      '[class*="player_wrap"]',
      '[id*="player-container"]',
      '[id*="player_container"]',
      '[id*="playerContainer"]',
      '[data-player]',
      '[role="region"][aria-label*="video" i]',
      '[role="region"][aria-label*="player" i]'
    ].join(',');

    const matchedWrapper = video.closest(frameworkSelector);
    if (matchedWrapper && matchedWrapper.offsetWidth >= 200 && matchedWrapper.offsetHeight >= 140) {
      return matchedWrapper;
    }

    // 4. Geometric Parent Inspection
    // Ascend up to 4 parent levels to find an element with comparable or enclosing dimensions and controls
    let current = video.parentElement;
    let levels = 0;
    while (current && current !== document.body && current !== document.documentElement && levels < 4) {
      const cRect = current.getBoundingClientRect();
      const style = window.getComputedStyle(current);

      // Check if parent looks like a player shell (has relative/absolute position, or controls)
      const hasPlayerTraits =
        current.querySelector('button, [class*="control"], [class*="play"], [class*="bar"]') ||
        style.position === 'relative' ||
        style.position === 'absolute';

      if (hasPlayerTraits && cRect.width >= vRect.width * 0.85 && cRect.height >= vRect.height * 0.85) {
        return current;
      }

      current = current.parentElement;
      levels++;
    }

    // 5. Fallback directly to the video element itself
    return video;
  }

  /**
   * Calculates safe absolute screen coordinates to avoid overlapping fixed headers or navigation bars
   * @param {HTMLElement} targetContainer
   * @returns {{top: number, left: number}}
   */
  static calculateSafeCoordinates(targetContainer, widgetWidth = 180) {
    const r = targetContainer.getBoundingClientRect();
    let top = window.scrollY + r.top + 14;

    // Detect fixed headers, mastheads, or top bars
    const fixedHeader = document.querySelector(
      '#masthead-container, #masthead, ytd-masthead, header.fixed, header[style*="fixed"], [class*="header--fixed"]'
    );
    if (fixedHeader) {
      const hRect = fixedHeader.getBoundingClientRect();
      if (hRect.bottom > 0 && r.top < hRect.bottom) {
        top = window.scrollY + hRect.bottom + 10;
      }
    }

    const left = window.scrollX + r.right - widgetWidth - 16;
    return {
      top: Math.max(10, top),
      left: Math.max(10, Math.min(left, window.innerWidth - widgetWidth - 14))
    };
  }
}

// Attach to window for content script usage
window.PlayerLocator = PlayerLocator;
