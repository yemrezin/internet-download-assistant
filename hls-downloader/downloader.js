/**
 * Internet Video Download Assistant - HLS / M3U8 Segment Downloader
 * Fetches, concatenates TS segments, and triggers download directly in browser.
 */

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const streamUrl = params.get('url') || '';
  const initialTitle = params.get('title') || 'video_stream';

  const inputTitle = document.getElementById('inputTitle');
  const inputUrl = document.getElementById('inputUrl');
  const qualityGroup = document.getElementById('qualitySelectorGroup');
  const selStreamQuality = document.getElementById('selStreamQuality');
  const btnStartDownload = document.getElementById('btnStartDownload');
  const btnCopyFFmpeg = document.getElementById('btnCopyFFmpeg');
  const btnCopyUrl = document.getElementById('btnCopyUrl');

  const progressArea = document.getElementById('progressArea');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  const statSegments = document.getElementById('statSegments');
  const statSize = document.getElementById('statSize');

  const successArea = document.getElementById('successArea');
  const btnSaveDirect = document.getElementById('btnSaveDirect');
  const logBox = document.getElementById('logBox');
  const btnClearLog = document.getElementById('btnClearLog');

  inputTitle.value = initialTitle;
  inputUrl.value = streamUrl;

  let isDownloading = false;
  let currentPlaylistUrl = streamUrl;

  function log(msg, type = '') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }

  btnClearLog.addEventListener('click', () => {
    logBox.innerHTML = '';
  });

  btnCopyUrl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(inputUrl.value);
      btnCopyUrl.textContent = 'Kopyalandı!';
      setTimeout(() => btnCopyUrl.textContent = 'Kopyala', 2000);
    } catch {
      alert('Kopyalanamadı');
    }
  });

  btnCopyFFmpeg.addEventListener('click', async () => {
    const cleanTitle = (inputTitle.value || 'video').replace(/[/\\?%*:|"<>]/g, '_');
    const cmd = `ffmpeg -i "${currentPlaylistUrl}" -c copy -bsf:a aac_adtstoasc "${cleanTitle}.mp4"`;
    try {
      await navigator.clipboard.writeText(cmd);
      btnCopyFFmpeg.textContent = 'FFmpeg Komutu Kopyalandı!';
      setTimeout(() => btnCopyFFmpeg.textContent = 'FFmpeg Komutunu Kopyala', 2000);
    } catch {
      alert('Kopyalanamadı');
    }
  });

  function resolveUrl(relative, base) {
    try {
      return new URL(relative, base).href;
    } catch {
      return relative;
    }
  }

  const audioGroup = document.getElementById('audioSelectorGroup');
  const selAudioTrack = document.getElementById('selAudioTrack');
  const btnDownloadAudioOnly = document.getElementById('btnDownloadAudioOnly');

  const subtitleGroup = document.getElementById('subtitleSelectorGroup');
  const selSubtitleTrack = document.getElementById('selSubtitleTrack');
  const btnDownloadSubOnly = document.getElementById('btnDownloadSubOnly');

  let currentAudioUrl = '';
  let currentSubtitleUrl = '';

  // Download Audio Only (Dubbing track)
  btnDownloadAudioOnly.addEventListener('click', async () => {
    if (!currentAudioUrl) return;
    log(`Seçilen ses/dublaj parçası indiriliyor: ${selAudioTrack.selectedOptions[0]?.textContent}`);
    if (chrome.downloads) {
      const cleanTitle = (inputTitle.value || 'audio').replace(/[/\\?%*:|"<>]/g, '_');
      chrome.downloads.download({
        url: currentAudioUrl,
        filename: `${cleanTitle}_ses.m3u8`,
        saveAs: true
      });
    } else {
      window.open(currentAudioUrl, '_blank');
    }
  });

  // Download Subtitle Only
  btnDownloadSubOnly.addEventListener('click', async () => {
    if (!currentSubtitleUrl) return;
    log(`Seçilen altyazı indiriliyor: ${selSubtitleTrack.selectedOptions[0]?.textContent}`);
    try {
      const resp = await fetch(currentSubtitleUrl);
      const text = await resp.text();
      const blob = new Blob([text], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);
      const cleanTitle = (inputTitle.value || 'altyazi').replace(/[/\\?%*:|"<>]/g, '_');

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${cleanTitle}_altyazi.vtt`;
      a.click();
      log('Altyazı dosyası (.vtt) indirildi.', 'success');
    } catch (err) {
      log(`Altyazı indirilemedi: ${err.message}`, 'error');
    }
  });

  // Parse M3U8 Master or Media Playlist
  async function inspectPlaylist(url) {
    log(`M3U8 çalma listesi yükleniyor: ${url}`);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const text = await resp.text();

      const lines = text.split('\n');
      const streams = [];
      const audioTracks = [];
      const subtitleTracks = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check Video stream resolutions
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
          if (nextLine && !nextLine.startsWith('#')) {
            let res = 'Otomatik';
            const resMatch = line.match(/RESOLUTION=(\d+x\d+)/i);
            if (resMatch) res = resMatch[1];
            const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
            const bw = bwMatch ? `(${Math.round(parseInt(bwMatch[1], 10) / 1000)} kbps)` : '';

            streams.push({
              label: `${res} ${bw}`.trim(),
              url: resolveUrl(nextLine, url)
            });
          }
        }

        // Check Dubbing / Audio tracks (#EXT-X-MEDIA:TYPE=AUDIO)
        // Check Subtitles (#EXT-X-MEDIA:TYPE=SUBTITLES)
        if (line.startsWith('#EXT-X-MEDIA:')) {
          const typeMatch = line.match(/TYPE=([A-Z]+)/i);
          const nameMatch = line.match(/NAME="([^"]+)"/i);
          const langMatch = line.match(/LANGUAGE="([^"]+)"/i);
          const uriMatch = line.match(/URI="([^"]+)"/i);

          if (typeMatch && uriMatch) {
            const type = typeMatch[1].toUpperCase();
            const name = nameMatch ? nameMatch[1] : (langMatch ? langMatch[1] : 'Bilinmeyen');
            const fullUri = resolveUrl(uriMatch[1], url);

            if (type === 'AUDIO') {
              audioTracks.push({ label: `${name} (Dublaj/Ses)`, url: fullUri });
            } else if (type === 'SUBTITLES') {
              subtitleTracks.push({ label: `${name} (Altyazı)`, url: fullUri });
            }
          }
        }
      }

      // Populate Video Streams
      if (streams.length > 0) {
        selStreamQuality.innerHTML = '';
        streams.forEach((s) => {
          const opt = document.createElement('option');
          opt.value = s.url;
          opt.textContent = s.label;
          selStreamQuality.appendChild(opt);
        });
        qualityGroup.classList.remove('hidden');
        currentPlaylistUrl = streams[0].url;

        selStreamQuality.addEventListener('change', () => {
          currentPlaylistUrl = selStreamQuality.value;
          log(`Seçilen video kalite akışı: ${selStreamQuality.selectedOptions[0].textContent}`);
        });

        log(`${streams.length} farklı video kalite seçeneği bulundu.`, 'success');
      }

      // Populate Audio Tracks (Dubbing)
      if (audioTracks.length > 0) {
        selAudioTrack.innerHTML = '';
        audioTracks.forEach((a) => {
          const opt = document.createElement('option');
          opt.value = a.url;
          opt.textContent = a.label;
          selAudioTrack.appendChild(opt);
        });
        audioGroup.classList.remove('hidden');
        currentAudioUrl = audioTracks[0].url;

        selAudioTrack.addEventListener('change', () => {
          currentAudioUrl = selAudioTrack.value;
          log(`Seçilen ses parçası: ${selAudioTrack.selectedOptions[0].textContent}`);
        });

        log(`${audioTracks.length} farklı ses / dublaj dili bulundu.`, 'success');
      }

      // Populate Subtitle Tracks
      if (subtitleTracks.length > 0) {
        selSubtitleTrack.innerHTML = '';
        subtitleTracks.forEach((s) => {
          const opt = document.createElement('option');
          opt.value = s.url;
          opt.textContent = s.label;
          selSubtitleTrack.appendChild(opt);
        });
        subtitleGroup.classList.remove('hidden');
        currentSubtitleUrl = subtitleTracks[0].url;

        selSubtitleTrack.addEventListener('change', () => {
          currentSubtitleUrl = selSubtitleTrack.value;
          log(`Seçilen altyazı: ${selSubtitleTrack.selectedOptions[0].textContent}`);
        });

        log(`${subtitleTracks.length} farklı altyazı bulundu.`, 'success');
      }

      log('Çalma listesi analizi tamamlandı.', 'success');
    } catch (err) {
      log(`M3U8 okuma hatası: ${err.message}`, 'error');
    }
  }

  // Parse media playlist to extract TS segment URLs
  async function extractSegments(mediaPlaylistUrl) {
    const resp = await fetch(mediaPlaylistUrl);
    if (!resp.ok) throw new Error(`Çalma listesi indirilemedi (HTTP ${resp.status})`);
    const text = await resp.text();
    const lines = text.split('\n');
    const segments = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#')) {
        segments.push(resolveUrl(line, mediaPlaylistUrl));
      }
    }
    return segments;
  }

  // Start Downloading Segments
  btnStartDownload.addEventListener('click', async () => {
    if (isDownloading) return;
    isDownloading = true;
    btnStartDownload.disabled = true;
    progressArea.classList.remove('hidden');
    successArea.classList.add('hidden');

    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    progressText.textContent = 'Parça listesi analiz ediliyor...';

    try {
      const segments = await extractSegments(currentPlaylistUrl);
      if (segments.length === 0) {
        throw new Error('Çalma listesinde parça bulunamadı veya canlı yayın.');
      }

      log(`Toplam ${segments.length} video parçası bulundu. İndirme başlıyor...`, 'success');

      const downloadedChunks = new Array(segments.length);
      let completedCount = 0;
      let totalBytes = 0;

      // Concurrency batch runner (up to 4 parallel segment downloads)
      const CONCURRENCY = 4;
      let nextIndex = 0;

      async function worker() {
        while (nextIndex < segments.length) {
          const index = nextIndex++;
          const segUrl = segments[index];

          let attempt = 0;
          let success = false;
          while (attempt < 3 && !success) {
            attempt++;
            try {
              const res = await fetch(segUrl);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const buffer = await res.arrayBuffer();
              downloadedChunks[index] = new Uint8Array(buffer);
              totalBytes += buffer.byteLength;
              completedCount++;
              success = true;

              // Update progress UI
              const pct = Math.round((completedCount / segments.length) * 100);
              progressBar.style.width = `${pct}%`;
              progressPercent.textContent = `${pct}%`;
              progressText.textContent = `İndiriliyor: ${completedCount} / ${segments.length} parça`;
              statSegments.textContent = `${completedCount} / ${segments.length} parça`;
              statSize.textContent = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
            } catch (err) {
              if (attempt >= 3) {
                log(`Parça #${index + 1} indirilemedi: ${err.message}`, 'warn');
              } else {
                await new Promise(r => setTimeout(r, 400));
              }
            }
          }
        }
      }

      // Run workers in parallel
      const workers = [];
      for (let i = 0; i < Math.min(CONCURRENCY, segments.length); i++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      // Concatenate all chunks into a single Blob
      log('Tüm parçalar indirildi. Video dosyası birleştiriliyor...');
      progressText.textContent = 'Dosya birleştiriliyor...';

      const validChunks = downloadedChunks.filter(Boolean);
      const mergedBlob = new Blob(validChunks, { type: 'video/mp2t' });
      const blobUrl = URL.createObjectURL(mergedBlob);

      const rawTitle = inputTitle.value.trim() || 'video';
      const cleanTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '_') + '.ts';

      log(`Birleştirme tamamlandı! Boyut: ${(mergedBlob.size / (1024 * 1024)).toFixed(2)} MB`, 'success');

      // Trigger download via Chrome Downloads API or direct link click
      if (chrome.downloads) {
        chrome.downloads.download({
          url: blobUrl,
          filename: cleanTitle,
          saveAs: true
        }, () => {
          log('İndirme tarayıcı tarafından başlatıldı.', 'success');
        });
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = cleanTitle;
        a.click();
      }

      btnSaveDirect.href = blobUrl;
      btnSaveDirect.download = cleanTitle;
      btnSaveDirect.classList.remove('hidden');
      successArea.classList.remove('hidden');

    } catch (err) {
      log(`İndirme başarısız: ${err.message}`, 'error');
      alert(`İndirme başarısız: ${err.message}`);
    } finally {
      isDownloading = false;
      btnStartDownload.disabled = false;
    }
  });

  // Run initial playlist inspect
  if (streamUrl) {
    inspectPlaylist(streamUrl);
  } else {
    log('Akış adresi bulunamadı. Lütfen üstteki alana geçerli bir M3U8 adresi girin.', 'warn');
  }
});
