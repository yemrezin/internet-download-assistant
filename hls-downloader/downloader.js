/**
 * HlsPlaylistParser
 * Single Responsibility: Parses M3U8 master and media playlists, extracting variant streams,
 * audio dubbing tracks, subtitles, and segment chunk URLs.
 */
class HlsPlaylistParser {
  static resolveUrl(relative, base) {
    try {
      return new URL(relative, base).href;
    } catch {
      return relative;
    }
  }

  static async parseMasterPlaylist(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    const text = await resp.text();

    const lines = text.split('\n');
    const videoStreams = [];
    const audioTracks = [];
    const subtitleTracks = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Video variant streams
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        let nextLine = '';
        for (let j = i + 1; j < lines.length; j++) {
          const candidate = lines[j].trim();
          if (candidate && !candidate.startsWith('#')) {
            nextLine = candidate;
            break;
          }
        }
        if (nextLine) {
          let res = 'Otomatik';
          const resMatch = line.match(/RESOLUTION=(\d+x\d+)/i);
          if (resMatch) res = resMatch[1];
          const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
          const bw = bwMatch ? `(${Math.round(parseInt(bwMatch[1], 10) / 1000)} kbps)` : '';

          videoStreams.push({
            label: `${res} ${bw}`.trim(),
            url: HlsPlaylistParser.resolveUrl(nextLine, url)
          });
        }
      }

      // Audio dubbing and subtitle tracks
      if (line.startsWith('#EXT-X-MEDIA:')) {
        const typeMatch = line.match(/TYPE=([A-Z]+)/i);
        const nameMatch = line.match(/NAME="([^"]+)"/i);
        const langMatch = line.match(/LANGUAGE="([^"]+)"/i);
        const uriMatch = line.match(/URI="([^"]+)"/i);

        if (typeMatch && uriMatch) {
          const type = typeMatch[1].toUpperCase();
          const name = nameMatch ? nameMatch[1] : langMatch ? langMatch[1] : 'Bilinmeyen';
          const fullUri = HlsPlaylistParser.resolveUrl(uriMatch[1], url);

          if (type === 'AUDIO') {
            audioTracks.push({ label: `${name} (Dublaj/Ses)`, url: fullUri });
          } else if (type === 'SUBTITLES') {
            subtitleTracks.push({ label: `${name} (Altyazı)`, url: fullUri });
          }
        }
      }
    }

    return {
      isMaster: videoStreams.length > 0 || audioTracks.length > 0 || subtitleTracks.length > 0,
      videoStreams,
      audioTracks,
      subtitleTracks
    };
  }

  static async extractSegments(mediaPlaylistUrl) {
    const resp = await fetch(mediaPlaylistUrl);
    if (!resp.ok) throw new Error(`Çalma listesi indirilemedi (HTTP ${resp.status})`);
    const text = await resp.text();
    const lines = text.split('\n');
    const segments = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#')) {
        segments.push(HlsPlaylistParser.resolveUrl(line, mediaPlaylistUrl));
      }
    }
    return segments;
  }
}

/**
 * SegmentDownloadEngine
 * Single Responsibility: Orchestrates concurrent segment fetching, retry logic, and array buffer assembly.
 */
class SegmentDownloadEngine {
  constructor(concurrency = 4) {
    this.concurrency = concurrency;
    this.isAborted = false;
  }

  abort() {
    this.isAborted = true;
  }

  async downloadSegments(segments, onProgress, onLog) {
    this.isAborted = false;
    const downloadedChunks = new Array(segments.length);
    let completedCount = 0;
    let totalBytes = 0;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < segments.length && !this.isAborted) {
        const index = nextIndex++;
        const segUrl = segments[index];

        let attempt = 0;
        let success = false;

        while (attempt < 3 && !success && !this.isAborted) {
          attempt++;
          try {
            const res = await fetch(segUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = await res.arrayBuffer();
            downloadedChunks[index] = new Uint8Array(buffer);
            totalBytes += buffer.byteLength;
            completedCount++;
            success = true;

            if (onProgress) {
              onProgress({
                completedCount,
                totalSegments: segments.length,
                totalBytes,
                percent: Math.round((completedCount / segments.length) * 100)
              });
            }
          } catch (err) {
            if (attempt >= 3) {
              if (onLog) onLog(`Parça #${index + 1} indirilemedi: ${err.message}`, 'warn');
            } else {
              await new Promise((r) => setTimeout(r, 400));
            }
          }
        }
      }
    };

    const workers = [];
    const poolSize = Math.min(this.concurrency, segments.length);
    for (let i = 0; i < poolSize; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    const validChunks = downloadedChunks.filter(Boolean);
    return new Blob(validChunks, { type: 'video/mp2t' });
  }
}

/**
 * DownloaderUIManager
 * Single Responsibility: Coordinates DOM elements, event listeners, and download actions for the HLS downloader.
 */
class DownloaderUIManager {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.streamUrl = params.get('url') || '';
    this.initialTitle = params.get('title') || 'video_stream';
    this.refererUrl = params.get('referer') || '';

    this.inputTitle = document.getElementById('inputTitle');
    this.inputUrl = document.getElementById('inputUrl');
    this.qualityGroup = document.getElementById('qualitySelectorGroup');
    this.selStreamQuality = document.getElementById('selStreamQuality');
    this.btnStartDownload = document.getElementById('btnStartDownload');
    this.btnCopyFFmpeg = document.getElementById('btnCopyFFmpeg');
    this.btnCopyUrl = document.getElementById('btnCopyUrl');

    this.audioGroup = document.getElementById('audioSelectorGroup');
    this.selAudioTrack = document.getElementById('selAudioTrack');
    this.btnDownloadAudioOnly = document.getElementById('btnDownloadAudioOnly');

    this.subtitleGroup = document.getElementById('subtitleSelectorGroup');
    this.selSubtitleTrack = document.getElementById('selSubtitleTrack');
    this.btnDownloadSubOnly = document.getElementById('btnDownloadSubOnly');

    this.progressArea = document.getElementById('progressArea');
    this.progressBar = document.getElementById('progressBar');
    this.progressText = document.getElementById('progressText');
    this.progressPercent = document.getElementById('progressPercent');
    this.statSegments = document.getElementById('statSegments');
    this.statSize = document.getElementById('statSize');

    this.successArea = document.getElementById('successArea');
    this.btnSaveDirect = document.getElementById('btnSaveDirect');
    this.logBox = document.getElementById('logBox');
    this.btnClearLog = document.getElementById('btnClearLog');

    this.currentPlaylistUrl = this.streamUrl;
    this.currentAudioUrl = '';
    this.currentSubtitleUrl = '';

    this.downloadEngine = new SegmentDownloadEngine(4);
  }

  async initialize() {
    this.inputTitle.value = this.initialTitle;
    this.inputUrl.value = this.streamUrl;

    this.bindEvents();

    if (this.streamUrl) {
      if (this.refererUrl) {
        try {
          await chrome.runtime.sendMessage({
            type: 'APPLY_HEADER_RULE',
            mediaUrl: this.streamUrl,
            referer: this.refererUrl
          });
        } catch (e) {
          console.warn('DownloaderUIManager: Failed to trigger APPLY_HEADER_RULE:', e);
        }
      }
      this.inspectPlaylist(this.streamUrl);
    } else {
      this.log('Akış adresi bulunamadı. Lütfen geçerli bir M3U8 adresi girin.', 'warn');
    }
  }

  log(msg, type = '') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    this.logBox.appendChild(entry);
    this.logBox.scrollTop = this.logBox.scrollHeight;
  }

  bindEvents() {
    this.btnClearLog.addEventListener('click', () => {
      this.logBox.innerHTML = '';
    });

    this.btnCopyUrl.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.inputUrl.value);
        this.btnCopyUrl.textContent = 'Kopyalandı!';
        setTimeout(() => (this.btnCopyUrl.textContent = 'Kopyala'), 2000);
      } catch {
        alert('Kopyalanamadı');
      }
    });

    this.btnCopyFFmpeg.addEventListener('click', async () => {
      const cleanTitle = (this.inputTitle.value || 'video').replace(/[/\\?%*:|"<>]/g, '_');
      const headerFlag = this.refererUrl ? `-headers "Referer: ${this.refererUrl}\\r\\n" ` : '';
      const cmd = `ffmpeg ${headerFlag}-i "${this.currentPlaylistUrl}" -c copy -bsf:a aac_adtstoasc "${cleanTitle}.mp4"`;
      try {
        await navigator.clipboard.writeText(cmd);
        this.btnCopyFFmpeg.textContent = 'FFmpeg Komutu Kopyalandı!';
        setTimeout(() => (this.btnCopyFFmpeg.textContent = 'FFmpeg Komutunu Kopyala'), 2000);
      } catch {
        alert('Kopyalanamadı');
      }
    });

    this.btnDownloadAudioOnly.addEventListener('click', () => this.downloadAudioOnly());
    this.btnDownloadSubOnly.addEventListener('click', () => this.downloadSubOnly());
    this.btnStartDownload.addEventListener('click', () => this.startDownload());
  }

  async inspectPlaylist(url) {
    this.log(`M3U8 çalma listesi analiz ediliyor: ${url}`);
    try {
      const result = await HlsPlaylistParser.parseMasterPlaylist(url);

      if (result.isMaster) {
        if (result.videoStreams.length > 0) {
          this.selStreamQuality.innerHTML = '';
          result.videoStreams.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s.url;
            opt.textContent = s.label;
            this.selStreamQuality.appendChild(opt);
          });
          this.qualityGroup.classList.remove('hidden');
          this.currentPlaylistUrl = result.videoStreams[0].url;

          this.selStreamQuality.addEventListener('change', () => {
            this.currentPlaylistUrl = this.selStreamQuality.value;
            this.log(`Seçilen video akışı: ${this.selStreamQuality.selectedOptions[0].textContent}`);
          });
          this.log(`${result.videoStreams.length} video çözünürlük seçeneği bulundu.`, 'success');
        }

        if (result.audioTracks.length > 0) {
          this.selAudioTrack.innerHTML = '';
          result.audioTracks.forEach((a) => {
            const opt = document.createElement('option');
            opt.value = a.url;
            opt.textContent = a.label;
            this.selAudioTrack.appendChild(opt);
          });
          this.audioGroup.classList.remove('hidden');
          this.currentAudioUrl = result.audioTracks[0].url;

          this.selAudioTrack.addEventListener('change', () => {
            this.currentAudioUrl = this.selAudioTrack.value;
            this.log(`Seçilen ses parçası: ${this.selAudioTrack.selectedOptions[0].textContent}`);
          });
          this.log(`${result.audioTracks.length} ses/dublaj parçası bulundu.`, 'success');
        }

        if (result.subtitleTracks.length > 0) {
          this.selSubtitleTrack.innerHTML = '';
          result.subtitleTracks.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s.url;
            opt.textContent = s.label;
            this.selSubtitleTrack.appendChild(opt);
          });
          this.subtitleGroup.classList.remove('hidden');
          this.currentSubtitleUrl = result.subtitleTracks[0].url;

          this.selSubtitleTrack.addEventListener('change', () => {
            this.currentSubtitleUrl = this.selSubtitleTrack.value;
            this.log(`Seçilen altyazı: ${this.selSubtitleTrack.selectedOptions[0].textContent}`);
          });
          this.log(`${result.subtitleTracks.length} altyazı parçası bulundu.`, 'success');
        }

        this.log('Çalma listesi analizi tamamlandı.', 'success');
      } else {
        this.log('Tekil akış çalma listesi yüklendi.', 'success');
      }
    } catch (err) {
      this.log(`M3U8 okuma hatası: ${err.message}`, 'error');
    }
  }

  async downloadAudioOnly() {
    if (!this.currentAudioUrl) return;
    const trackLabel = this.selAudioTrack.selectedOptions[0]?.textContent || 'Dublaj/Ses';
    this.log(`Ses parçası hazırlanıyor: ${trackLabel}`);
    let rawTitle = this.inputTitle.value.trim() || 'audio';
    rawTitle = rawTitle.replace(/\.(mp4|ts|m3u8|txt|aac|mp3)$/i, '');
    const cleanTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '_');

    try {
      // Check if audio source is an HLS playlist (e.g. sublist_aud1.txt or .m3u8)
      const isAudioHls =
        this.currentAudioUrl.includes('.txt') ||
        this.currentAudioUrl.includes('.m3u8') ||
        this.currentAudioUrl.includes('/hls/');

      if (isAudioHls) {
        this.log('Ses parçaları analiz ediliyor...');
        const segments = await HlsPlaylistParser.extractSegments(this.currentAudioUrl);
        if (segments && segments.length > 0) {
          this.log(`Toplam ${segments.length} ses parçası bulundu. İndiriliyor...`);
          const audioBlob = await this.downloadEngine.downloadSegments(
            segments,
            (progress) => {
              this.log(`Ses indiriliyor: ${progress.completedCount} / ${progress.totalSegments} parça (%${progress.percent})`);
            },
            (msg, type) => this.log(msg, type)
          );

          const audioBlobUrl = URL.createObjectURL(audioBlob);
          const audioFilename = `${cleanTitle}_ses.aac`;
          const a = document.createElement('a');
          a.href = audioBlobUrl;
          a.download = audioFilename;
          a.click();
          this.log(`Ses dosyası (${audioFilename}) başarıyla kaydedildi!`, 'success');
          return;
        }
      }

      if (chrome.downloads) {
        chrome.downloads.download({
          url: this.currentAudioUrl,
          filename: `${cleanTitle}_ses.aac`,
          saveAs: true
        });
      } else {
        window.open(this.currentAudioUrl, '_blank');
      }
    } catch (err) {
      this.log(`Ses parçası indirilemedi: ${err.message}`, 'error');
    }
  }

  async downloadSubOnly() {
    if (!this.currentSubtitleUrl) return;
    this.log(`Altyazı indiriliyor: ${this.selSubtitleTrack.selectedOptions[0]?.textContent}`);
    try {
      const resp = await fetch(this.currentSubtitleUrl);
      const text = await resp.text();
      const blob = new Blob([text], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);
      let rawTitle = this.inputTitle.value.trim() || 'altyazi';
      rawTitle = rawTitle.replace(/\.(mp4|ts|m3u8|txt|vtt|srt)$/i, '');
      const cleanTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '_');

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${cleanTitle}_altyazi.vtt`;
      a.click();
      this.log('Altyazı dosyası (.vtt) kaydedildi.', 'success');
    } catch (err) {
      this.log(`Altyazı indirilemedi: ${err.message}`, 'error');
    }
  }

  async startDownload() {
    this.btnStartDownload.disabled = true;
    this.progressArea.classList.remove('hidden');
    this.successArea.classList.add('hidden');
    this.progressBar.style.width = '0%';
    this.progressPercent.textContent = '0%';
    this.progressText.textContent = 'Parça listesi hazırlanıyor...';

    try {
      const segments = await HlsPlaylistParser.extractSegments(this.currentPlaylistUrl);
      if (segments.length === 0) {
        throw new Error('Çalma listesinde parça bulunamadı veya canlı yayın akışı.');
      }

      this.log(`Toplam ${segments.length} video parçası bulundu. İndirme başlıyor...`, 'success');

      const mergedBlob = await this.downloadEngine.downloadSegments(
        segments,
        (progress) => {
          this.progressBar.style.width = `${progress.percent}%`;
          this.progressPercent.textContent = `${progress.percent}%`;
          this.progressText.textContent = `İndiriliyor: ${progress.completedCount} / ${progress.totalSegments} parça`;
          this.statSegments.textContent = `${progress.completedCount} / ${progress.totalSegments} parça`;
          this.statSize.textContent = `${(progress.totalBytes / (1024 * 1024)).toFixed(1)} MB`;
        },
        (msg, type) => this.log(msg, type)
      );

      this.progressText.textContent = 'Video birleştirildi!';
      const blobUrl = URL.createObjectURL(mergedBlob);
      let rawTitle = this.inputTitle.value.trim() || 'video';
      rawTitle = rawTitle.replace(/\.(mp4|ts|m3u8|txt)$/i, '');
      const cleanFilename = rawTitle.replace(/[/\\?%*:|"<>]/g, '_') + '.ts';

      this.log(`Tamamlandı! Boyut: ${(mergedBlob.size / (1024 * 1024)).toFixed(2)} MB`, 'success');

      if (chrome.downloads) {
        chrome.downloads.download(
          {
            url: blobUrl,
            filename: cleanFilename,
            saveAs: true
          },
          () => {
            if (chrome.runtime.lastError) {
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = cleanFilename;
              a.click();
              this.log('İndirme doğrudan başlatıldı.', 'success');
            } else {
              this.log('İndirme tarayıcı tarafından başlatıldı.', 'success');
            }
          }
        );
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = cleanFilename;
        a.click();
      }

      this.btnSaveDirect.href = blobUrl;
      this.btnSaveDirect.download = cleanFilename;
      this.btnSaveDirect.classList.remove('hidden');
      this.successArea.classList.remove('hidden');
    } catch (err) {
      this.log(`İndirme başarısız: ${err.message}`, 'error');
      alert(`İndirme başarısız: ${err.message}`);
    } finally {
      this.btnStartDownload.disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const ui = new DownloaderUIManager();
  ui.initialize();
});
