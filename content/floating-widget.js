/**
 * Internet Video Download Assistant - Floating Widget
 * Attaches an IDM-style "Videoyu İndir" button cleanly to video players.
 */

window.__IDA_FLOATING__ = (function () {
  const trackedVideos = new WeakMap();
  let isEnabled = true;

  // Read settings
  chrome.storage.local.get({ enableFloatingButton: true }, (res) => {
    isEnabled = res.enableFloatingButton;
  });

  // Listen for settings change
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enableFloatingButton) {
      isEnabled = changes.enableFloatingButton.newValue;
      if (!isEnabled) {
        document.querySelectorAll('.ida-floating-btn-container').forEach(el => el.remove());
      }
    }
  });

  function showToast(message, isSuccess = true) {
    const existing = document.querySelector('.ida-toast-notice');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'ida-toast-notice';
    toast.innerHTML = `
      <span style="color: ${isSuccess ? '#34d399' : '#f87171'}; font-size: 16px;">
        ${isSuccess ? '✓' : '✕'}
      </span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  function getQualityLabel(video) {
    const h = video.videoHeight;
    if (h >= 2160) return '4K';
    if (h >= 1440) return '2K';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    if (h > 0) return `${h}p`;
    return 'HD';
  }

  /**
   * Find the optimal container element (Player wrapper) for positioning the button
   */
  function getPlayerContainer(video) {
    if (!video) return null;

    // 1. YouTube specific logic
    if (location.hostname.includes('youtube.com')) {
      // Ignore thumbnails, hover previews, shorts background videos
      if (video.closest('ytd-thumbnail, #inline-preview-player, ytd-video-preview, .ytd-video-preview, ytd-rich-grid-media')) {
        return null;
      }
      // Main YouTube player element
      const ytPlayer = video.closest('#movie_player, .html5-video-player');
      if (ytPlayer) return ytPlayer;

      // Only allow main video stream
      if (video.classList.contains('html5-main-video') && video.parentElement) {
        return video.parentElement;
      }
      return null;
    }

    // 2. Generic video player wrappers (VideoJS, JWPlayer, Plyr, DPlayer, Animecix, etc.)
    const playerWrapper = video.closest(
      '.video-js, .jwplayer, .plyr, .dplayer, [class*="player-container"], [class*="player-wrap"], [class*="player_container"], [id*="player-container"], [id*="player_container"], [class*="artplayer"], [class*="vjs-tech"]'
    );
    if (playerWrapper && playerWrapper.offsetWidth >= 200 && playerWrapper.offsetHeight >= 150) {
      return playerWrapper;
    }

    // 3. Direct parent if appropriately sized
    const parent = video.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement) {
      const pr = parent.getBoundingClientRect();
      const vr = video.getBoundingClientRect();
      if (pr.width >= 200 && pr.height >= 140 && pr.width >= vr.width * 0.8) {
        return parent;
      }
    }

    return video;
  }

  function attachToVideo(video) {
    if (!isEnabled || !video) return;
    if (trackedVideos.has(video)) return;

    const targetContainer = getPlayerContainer(video);
    if (!targetContainer) return; // Ignore preview or invalid videos

    // Check size - don't attach to tiny hidden video players or background sounds
    const rect = video.getBoundingClientRect();
    if (rect.width < 180 || rect.height < 120) {
      const onMeta = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        attachToVideo(video);
      };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
      return;
    }

    const container = document.createElement('div');
    container.className = 'ida-floating-btn-container';

    const quality = getQualityLabel(video);

    container.innerHTML = `
      <div class="ida-floating-btn" title="Bu videoyu indir (IDM Asistanı)">
        <svg viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
        </svg>
        <span>Videoyu İndir</span>
        <span class="ida-badge-quality">${quality}</span>
        <span class="ida-close-btn" title="Gizle">
          <svg viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </span>
      </div>
    `;

    // Mounting strategy:
    // When targetContainer is an element that can hold child nodes (e.g. #movie_player or a div wrapper)
    const canAppendInside = targetContainer !== video && targetContainer.nodeType === Node.ELEMENT_NODE;

    if (canAppendInside) {
      // Ensure targetContainer is a positioning context
      const compPos = window.getComputedStyle(targetContainer).position;
      if (compPos === 'static') {
        targetContainer.style.position = 'relative';
      }
      targetContainer.appendChild(container);
      container.classList.add('ida-attached-to-player');
    } else {
      // Fallback: append to document.body and manage coordinates strictly
      document.body.appendChild(container);

      function updatePosition() {
        if (!video.isConnected) {
          container.remove();
          return;
        }
        const r = targetContainer.getBoundingClientRect();
        if (r.width < 140 || r.height < 90 || r.bottom <= 0 || r.top >= window.innerHeight) {
          container.style.display = 'none';
          return;
        }
        container.style.display = 'block';

        let top = window.scrollY + r.top + 14;

        // Prevent overlapping fixed headers / mastheads
        const masthead = document.querySelector('#masthead-container, #masthead, ytd-masthead, header.fixed');
        if (masthead) {
          const mRect = masthead.getBoundingClientRect();
          if (mRect.bottom > 0 && r.top < mRect.bottom) {
            top = window.scrollY + mRect.bottom + 10;
          }
        }

        const left = window.scrollX + r.right - container.offsetWidth - 16;
        container.style.top = `${Math.max(10, top)}px`;
        container.style.left = `${Math.max(10, Math.min(left, window.innerWidth - container.offsetWidth - 14))}px`;
      }

      updatePosition();
      window.addEventListener('scroll', updatePosition, { passive: true });
      window.addEventListener('resize', updatePosition, { passive: true });
    }

    trackedVideos.set(video, container);

    // Draggable support so user can move it anywhere on the player if needed
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initLeft = 0;
    let initTop = 0;

    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.ida-close-btn')) return;
      isDragging = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = container.getBoundingClientRect();
      const parentRect = canAppendInside ? targetContainer.getBoundingClientRect() : { left: 0, top: 0 };
      initLeft = rect.left - parentRect.left;
      initTop = rect.top - parentRect.top;

      function onMouseMove(moveEvent) {
        const dx = moveEvent.clientX - dragStartX;
        const dy = moveEvent.clientY - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          isDragging = true;
          container.classList.remove('ida-attached-to-player');
          container.style.left = `${initLeft + dx}px`;
          container.style.top = `${initTop + dy}px`;
          container.style.right = 'auto';
          container.style.bottom = 'auto';
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Handle close button
    const closeBtn = container.querySelector('.ida-close-btn');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.remove();
    });

    // Handle download button click
    const btn = container.querySelector('.ida-floating-btn');
    btn.addEventListener('click', async (e) => {
      if (isDragging) {
        isDragging = false;
        return;
      }
      e.stopPropagation();

      const mediaSrc = video.currentSrc || video.src || '';
      const docTitle = document.title ? document.title.split(' - ')[0].trim() : 'Video';
      const effectiveUrl = mediaSrc || (video.querySelector('source') ? video.querySelector('source').src : '');

      if (!effectiveUrl) {
        showToast('Video bağlantısı henüz yüklenmedi, lütfen oynatın.', false);
        return;
      }

      const isHls = effectiveUrl.includes('.m3u8') || effectiveUrl.includes('/hls/') || effectiveUrl.includes('/master.') || effectiveUrl.includes('master.txt');

      chrome.runtime.sendMessage(
        {
          type: 'DOWNLOAD_MEDIA',
          url: effectiveUrl,
          title: docTitle,
          pageUrl: window.location.href,
          format: isHls ? 'M3U8' : 'MP4'
        },
        (res) => {
          if (res && res.success) {
            if (res.openedDownloader) {
              showToast('M3U8 Akış İndiricisi açıldı!');
            } else {
              showToast(`İndirme başlatıldı: ${docTitle}`);
            }
          } else {
            showToast(`İndirme başlatılamadı: ${res ? res.error : 'Hata'}`, false);
          }
        }
      );
    });

    // Update quality badge on metadata or playback
    const updateQuality = () => {
      const q = getQualityLabel(video);
      const b = container.querySelector('.ida-badge-quality');
      if (b) b.textContent = q;
    };

    video.addEventListener('loadedmetadata', updateQuality);
    video.addEventListener('play', updateQuality);
  }

  return {
    attach: attachToVideo
  };
})();
