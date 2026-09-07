/**
 * Internet Video Download Assistant - Floating Widget
 * Attaches an IDM-style "Videoyu İndir" button to HTML5 video players on the page.
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

  function attachToVideo(video) {
    if (!isEnabled || !video) return;
    if (trackedVideos.has(video)) return;

    // Check size - don't attach to tiny hidden video players or background sounds
    const rect = video.getBoundingClientRect();
    if (rect.width < 180 || rect.height < 120) {
      // Re-check when video plays or metadata loads
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

    document.body.appendChild(container);
    trackedVideos.set(video, container);

    function updatePosition() {
      if (!video.isConnected) {
        container.remove();
        return;
      }
      const r = video.getBoundingClientRect();
      // Only show if video is visible on screen
      if (r.width < 100 || r.height < 80 || r.bottom < 0 || r.top > window.innerHeight) {
        container.style.display = 'none';
        return;
      }
      container.style.display = 'block';
      const top = window.scrollY + r.top + 12;
      const left = window.scrollX + r.right - container.offsetWidth - 14;
      container.style.top = `${Math.max(0, top)}px`;
      container.style.left = `${Math.max(0, left)}px`;
    }

    // Initial position
    updatePosition();

    // Position updates on scroll / resize / animation frame
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    // Handle close button
    const closeBtn = container.querySelector('.ida-close-btn');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.remove();
    });

    // Handle download button click
    const btn = container.querySelector('.ida-floating-btn');
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mediaSrc = video.currentSrc || video.src || '';
      const docTitle = document.title ? document.title.split(' - ')[0].trim() : 'Video';

      if (!mediaSrc && !video.querySelector('source')) {
        showToast('Video bağlantısı henüz yüklenmedi, lütfen oynatın.', false);
        return;
      }

      const effectiveUrl = mediaSrc || (video.querySelector('source') ? video.querySelector('source').src : '');

      chrome.runtime.sendMessage(
        {
          type: 'DOWNLOAD_MEDIA',
          url: effectiveUrl,
          title: docTitle,
          format: effectiveUrl.includes('.m3u8') ? 'M3U8' : 'MP4'
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

    // Video metadata update
    video.addEventListener('loadedmetadata', () => {
      const q = getQualityLabel(video);
      const b = container.querySelector('.ida-badge-quality');
      if (b) b.textContent = q;
      updatePosition();
    });
  }

  return {
    attach: attachToVideo
  };
})();
