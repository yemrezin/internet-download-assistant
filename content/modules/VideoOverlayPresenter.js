/**
 * VideoOverlayPresenter
 * Single Responsibility: Manages presentation, mounting, dragging, and download interactions
 * for the on-video floating download widget.
 */
class VideoOverlayPresenter {
  constructor() {
    this.trackedVideos = new WeakMap();
    this.isEnabled = true;

    this.loadSettings();
  }

  loadSettings() {
    chrome.storage.local.get({ enableFloatingButton: true }, (res) => {
      this.isEnabled = res.enableFloatingButton;
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enableFloatingButton) {
        this.isEnabled = changes.enableFloatingButton.newValue;
        if (!this.isEnabled) {
          document.querySelectorAll('.vda-player-widget').forEach((el) => el.remove());
        }
      }
    });
  }

  static getResolutionBadge(video) {
    const height = video.videoHeight;
    if (height >= 2160) return '4K';
    if (height >= 1440) return '2K';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height > 0) return `${height}p`;
    return 'HD';
  }

  showToast(message, isSuccess = true) {
    const existing = document.querySelector('.vda-toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `vda-toast-notification ${isSuccess ? 'vda-toast-notification--success' : 'vda-toast-notification--error'}`;
    toast.innerHTML = `
      <span class="vda-toast-notification__status-icon">${isSuccess ? '✓' : '✕'}</span>
      <span class="vda-toast-notification__message">${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  attach(video) {
    if (!this.isEnabled || !video) return;
    if (this.trackedVideos.has(video)) return;

    const targetContainer = window.PlayerLocator.locatePlayerContainer(video);
    if (!targetContainer) return;

    const vRect = video.getBoundingClientRect();
    if (vRect.width < 160 || vRect.height < 100) {
      const onMetadata = () => {
        video.removeEventListener('loadedmetadata', onMetadata);
        this.attach(video);
      };
      video.addEventListener('loadedmetadata', onMetadata, { once: true });
      return;
    }

    const container = document.createElement('div');
    container.className = 'vda-player-widget';

    const quality = VideoOverlayPresenter.getResolutionBadge(video);

    container.innerHTML = `
      <div class="vda-player-widget__action-btn" title="Bu videoyu indir (IDM Asistanı)">
        <svg class="vda-player-widget__icon" viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
        </svg>
        <span class="vda-player-widget__label">Videoyu İndir</span>
        <span class="vda-player-widget__quality-badge">${quality}</span>
        <span class="vda-player-widget__dismiss-btn" title="Gizle">
          <svg viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </span>
      </div>
    `;

    // Mounting strategy
    const canMountInside = targetContainer !== video && targetContainer.nodeType === Node.ELEMENT_NODE;

    if (canMountInside) {
      const computedPos = window.getComputedStyle(targetContainer).position;
      if (computedPos === 'static') {
        targetContainer.style.position = 'relative';
      }
      targetContainer.appendChild(container);
      container.classList.add('vda-player-widget--attached');
    } else {
      document.body.appendChild(container);

      const updateCoordinates = () => {
        if (!video.isConnected) {
          container.remove();
          return;
        }
        const coords = window.PlayerLocator.calculateSafeCoordinates(targetContainer, container.offsetWidth || 180);
        container.style.top = `${coords.top}px`;
        container.style.left = `${coords.left}px`;
      };

      updateCoordinates();
      window.addEventListener('scroll', updateCoordinates, { passive: true });
      window.addEventListener('resize', updateCoordinates, { passive: true });
    }

    this.trackedVideos.set(video, container);

    // Draggable interaction
    this.bindDragListeners(container, targetContainer, canMountInside);

    // Close button interaction
    const dismissBtn = container.querySelector('.vda-player-widget__dismiss-btn');
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.remove();
    });

    // Download action interaction
    const actionBtn = container.querySelector('.vda-player-widget__action-btn');
    actionBtn.addEventListener('click', (e) => {
      if (container.dataset.isDragging === 'true') {
        container.dataset.isDragging = 'false';
        return;
      }
      e.stopPropagation();
      this.triggerDownload(video);
    });

    // Resolution badge updates
    const updateQualityBadge = () => {
      const q = VideoOverlayPresenter.getResolutionBadge(video);
      const badge = container.querySelector('.vda-player-widget__quality-badge');
      if (badge) badge.textContent = q;
    };

    video.addEventListener('loadedmetadata', updateQualityBadge);
    video.addEventListener('play', updateQualityBadge);
  }

  bindDragListeners(container, targetContainer, isMountedInside) {
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.vda-player-widget__dismiss-btn')) return;
      container.dataset.isDragging = 'false';
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = container.getBoundingClientRect();
      const parentRect = isMountedInside ? targetContainer.getBoundingClientRect() : { left: 0, top: 0 };
      initialLeft = rect.left - parentRect.left;
      initialTop = rect.top - parentRect.top;

      const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - dragStartX;
        const dy = moveEvent.clientY - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          container.dataset.isDragging = 'true';
          container.classList.remove('vda-player-widget--attached');
          container.style.left = `${initialLeft + dx}px`;
          container.style.top = `${initialTop + dy}px`;
          container.style.right = 'auto';
          container.style.bottom = 'auto';
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  async triggerDownload(video) {
    let mediaSource = video.currentSrc || video.src || '';
    const sourceEl = video.querySelector('source');
    let effectiveUrl = mediaSource || (sourceEl ? sourceEl.src : '');
    const docTitle = document.title ? document.title.split(' - ')[0].trim() : 'Video';
    let targetFormat = 'MP4';
    let targetReferer = window.location.href;

    // Resolve active media from background if MSE Blob URL or empty
    if (!effectiveUrl || effectiveUrl.startsWith('blob:')) {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'RESOLVE_ACTIVE_MEDIA_FOR_TAB' }, resolve);
        });

        if (response && response.success && response.media) {
          effectiveUrl = response.media.url;
          targetFormat = response.media.format || 'MP4';
          targetReferer = response.media.referer || window.location.href;
        }
      } catch (err) {
        console.warn('VideoOverlayPresenter: Failed to resolve active stream:', err);
      }
    }

    if (!effectiveUrl || effectiveUrl.startsWith('blob:')) {
      this.showToast('Video akışı henüz yakalanmadı. Lütfen videoyu 1-2 saniye oynatın.', false);
      return;
    }

    const isHls =
      targetFormat === 'M3U8' ||
      effectiveUrl.includes('.m3u8') ||
      effectiveUrl.includes('/hls/') ||
      effectiveUrl.includes('/master.') ||
      effectiveUrl.includes('master.txt') ||
      effectiveUrl.includes('sublist_');

    chrome.runtime.sendMessage(
      {
        type: 'DOWNLOAD_MEDIA',
        url: effectiveUrl,
        title: docTitle,
        pageUrl: window.location.href,
        referer: targetReferer,
        format: isHls ? 'M3U8' : targetFormat
      },
      (res) => {
        if (res && res.success) {
          if (res.openedDownloader) {
            this.showToast('M3U8 Akış İndiricisi açıldı!');
          } else {
            this.showToast(`İndirme başlatıldı: ${docTitle}`);
          }
        } else {
          this.showToast(`İndirme başlatılamadı: ${res ? res.error : 'Bilinmeyen hata'}`, false);
        }
      }
    );
  }
}

window.VideoOverlayPresenter = VideoOverlayPresenter;
