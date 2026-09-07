/**
 * StreamDownloadEngine
 * Single Responsibility: Parses M3U8 master/media playlists, downloads TS/media segments concurrently,
 * assembles chunks into a single Blob, and initiates browser downloads without opening external tabs.
 */
class StreamDownloadEngine {
  constructor(concurrency = 6) {
    this.concurrency = concurrency;
    this.activeDownloads = new Map();
  }

  static resolveUrl(relative, base) {
    try {
      return new URL(relative, base).href;
    } catch {
      return relative;
    }
  }

  /**
   * Parses master playlist or detects media playlist directly
   * @param {string} url
   * @returns {Promise<{isMaster: boolean, bestStreamUrl: string, videoStreams: Array, audioTracks: Array}>}
   */
  static async parsePlaylist(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Çalma listesi alınamadı (HTTP ${resp.status})`);
    const text = await resp.text();

    const lines = text.split('\n');
    const videoStreams = [];
    const audioTracks = [];

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
          const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;

          videoStreams.push({
            label: res,
            bandwidth: bw,
            url: StreamDownloadEngine.resolveUrl(nextLine, url)
          });
        }
      }

      // Audio dubbing tracks
      if (line.startsWith('#EXT-X-MEDIA:')) {
        const typeMatch = line.match(/TYPE=([A-Z]+)/i);
        const nameMatch = line.match(/NAME="([^"]+)"/i);
        const uriMatch = line.match(/URI="([^"]+)"/i);

        if (typeMatch && uriMatch && typeMatch[1].toUpperCase() === 'AUDIO') {
          const name = nameMatch ? nameMatch[1] : 'Ses';
          audioTracks.push({
            label: name,
            url: StreamDownloadEngine.resolveUrl(uriMatch[1], url)
          });
        }
      }
    }

    const isMaster = videoStreams.length > 0;
    let bestStreamUrl = url;

    if (isMaster) {
      // Sort by bandwidth / resolution descending to get highest quality stream
      videoStreams.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
      bestStreamUrl = videoStreams[0].url;
    }

    return {
      isMaster,
      bestStreamUrl,
      videoStreams,
      audioTracks
    };
  }

  /**
   * Extracts segment URLs from a media playlist
   * @param {string} mediaPlaylistUrl
   * @returns {Promise<string[]>}
   */
  static async extractSegments(mediaPlaylistUrl) {
    const resp = await fetch(mediaPlaylistUrl);
    if (!resp.ok) throw new Error(`Parça listesi alınamadı (HTTP ${resp.status})`);
    const text = await resp.text();
    const lines = text.split('\n');
    const segments = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#')) {
        segments.push(StreamDownloadEngine.resolveUrl(line, mediaPlaylistUrl));
      }
    }
    return segments;
  }

  /**
   * Downloads segments concurrently with progress callbacks
   * @param {string[]} segments
   * @param {Function} onProgress
   * @returns {Promise<Blob>}
   */
  async fetchSegments(segments, onProgress) {
    const downloadedChunks = new Array(segments.length);
    let completedCount = 0;
    let totalBytes = 0;
    let nextIndex = 0;
    let isAborted = false;

    const worker = async () => {
      while (nextIndex < segments.length && !isAborted) {
        const index = nextIndex++;
        const segUrl = segments[index];

        let attempt = 0;
        let success = false;

        while (attempt < 3 && !success && !isAborted) {
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
              const percent = Math.min(95, 10 + Math.round((completedCount / segments.length) * 85));
              onProgress({
                percent,
                completedCount,
                totalSegments: segments.length,
                totalBytes,
                status: `İndiriliyor: ${completedCount} / ${segments.length} parça (%${percent})`
              });
            }
          } catch {
            if (attempt >= 3) {
              completedCount++;
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
    if (validChunks.length === 0) {
      throw new Error('Hiçbir parça indirilemedi.');
    }

    return new Blob(validChunks, { type: 'video/mp2t' });
  }

  /**
   * Full HLS stream download workflow: apply header rules, resolve stream, fetch segments, merge and save
   * @param {Object} item
   * @param {Function} onProgress
   * @returns {Promise<{success: boolean, filename: string}>}
   */
  async downloadHlsStream(item, onProgress) {
    const streamUrl = item.url;
    const referer = item.referer || item.pageUrl || '';

    // Step 1: Ensure DNR headers (Referer/Origin/CORS) are applied across all CDN domains
    if (referer && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        await chrome.runtime.sendMessage({
          type: 'APPLY_HEADER_RULE',
          mediaUrl: streamUrl,
          referer: referer
        });
      } catch (err) {
        console.warn('StreamDownloadEngine: Failed to apply header rule:', err);
      }
    }

    if (onProgress) onProgress({ percent: 5, status: 'Çalma listesi analiz ediliyor...' });

    // Step 2: Parse master or media playlist
    const playlistInfo = await StreamDownloadEngine.parsePlaylist(streamUrl);
    const targetMediaUrl = playlistInfo.bestStreamUrl;

    if (onProgress) onProgress({ percent: 10, status: 'Parça listesi hazırlanıyor...' });

    // Step 3: Extract segment URLs
    const segments = await StreamDownloadEngine.extractSegments(targetMediaUrl);
    if (!segments || segments.length === 0) {
      throw new Error('Çalma listesinde indirilebilir parça bulunamadı.');
    }

    if (onProgress) onProgress({ percent: 12, status: `Toplam ${segments.length} parça bulundu. İndiriliyor...` });

    // Step 4: Download segments concurrently
    const mergedBlob = await this.fetchSegments(segments, onProgress);

    if (onProgress) onProgress({ percent: 97, status: 'Parçalar birleştiriliyor...' });

    // Step 5: Save assembled video file
    let rawTitle = (item.title || 'video').trim();
    rawTitle = rawTitle.replace(/\.(mp4|ts|m3u8|txt)$/i, '');
    const cleanFilename = rawTitle.replace(/[/\\?%*:|"<>]/g, '_') + '.ts';
    const blobUrl = URL.createObjectURL(mergedBlob);

    return new Promise((resolve, reject) => {
      if (chrome.downloads && chrome.downloads.download) {
        chrome.downloads.download(
          {
            url: blobUrl,
            filename: cleanFilename,
            saveAs: false,
            conflictAction: 'uniquify'
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = cleanFilename;
              a.click();
            }
            if (onProgress) onProgress({ percent: 100, status: '✓ İndirildi!' });
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
            resolve({ success: true, filename: cleanFilename, downloadId });
          }
        );
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = cleanFilename;
        a.click();
        if (onProgress) onProgress({ percent: 100, status: '✓ İndirildi!' });
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        resolve({ success: true, filename: cleanFilename });
      }
    });
  }

  /**
   * Downloads a subtitle text file directly
   * @param {Object} item
   * @param {Function} onProgress
   * @returns {Promise<{success: boolean, filename: string}>}
   */
  async downloadSubtitle(item, onProgress) {
    if (onProgress) onProgress({ percent: 20, status: 'Altyazı indiriliyor...' });
    const resp = await fetch(item.url);
    if (!resp.ok) throw new Error(`Altyazı indirilemedi (HTTP ${resp.status})`);
    const text = await resp.text();
    const blob = new Blob([text], { type: 'text/vtt' });
    const blobUrl = URL.createObjectURL(blob);

    let rawTitle = (item.title || 'altyazi').trim();
    rawTitle = rawTitle.replace(/\.(vtt|srt|txt)$/i, '');
    const cleanFilename = rawTitle.replace(/[/\\?%*:|"<>]/g, '_') + '.vtt';

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = cleanFilename;
    a.click();

    if (onProgress) onProgress({ percent: 100, status: '✓ Altyazı kaydedildi!' });
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return { success: true, filename: cleanFilename };
  }
}

window.StreamDownloadEngine = StreamDownloadEngine;
