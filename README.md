# Internet Video Download Assistant v2.0 (IDM Tarzı Tarayıcı Video İndiricisi)

**Internet Video Download Assistant**, web sayfalarında izlediğiniz videoları **Internet Download Manager (IDM)** benzeri bir deneyimle otomatik olarak tespit eden ve tek tıkla indirmenizi sağlayan modern ve kurumsal bir **Manifest V3** tarayıcı eklentisidir.

Google Chrome, Microsoft Edge, Brave, Opera ve Vivaldi dahil olmak üzere tüm **Chromium tabanlı tarayıcılarda** eksiksiz, kesintisiz ve sıfır ek yazılım gereksinimiyle çalışır.

---

## 🚀 Sürüm 2.0 ile Gelen Yenilikler

- **🏗️ SOLID Prensiplerine Dayalı Kurumsal Mimari:** Modüler servis tasarımı (`MediaClassifier`, `MediaSnifferService`, `DownloadService`, `HeaderRuleService`, `StorageService`).
- **🔄 Arka Planda Kesintisiz İndirme (Offscreen Engine):** İndirmeyi başlattıktan sonra popup kapatılsa, sekme değiştirilse veya başka sitelere gidilse dahi indirme işlemi arka planda kesintisiz devam eder. Eklenti rozetinde (badge) canlı yüzde gösterilir.
- **✕ İndirmeyi İptal Etme Seçeneği:** Devam eden indirmeleri dilediğiniz an tek tıkla iptal etme ve temizleme desteği.
- **📊 Net ve Kesin Boyut Gösterimi:** Aralıklar (`~1.8 - 2.4 GB`) tamamen kaldırıldı; videoların ve altyazıların kesin ve tekil boyutları gösterilir.
- **🎨 Sade ve Minimalist Koyu Monokrom Arayüz:** Göz yoran mor, yeşil ve turuncu renkler kaldırılarak profesyonel koyu tema uygulandı.
- **🛡️ Güvenli ve Kapsamlı Ağ Koruma Kalkanı:** YouTube, Google, Netflix gibi servislerin bağlantısını koruyan, yalnızca hedef CDN alan adlarına özel çalışan akıllı Declarative Net Request (DNR) motoru.
- **⚡ Anında Tarayıcı İndirmesi:** Altyazılar (`.vtt`, `.srt`) ve doğrudan MP4 medyaları bekleme olmadan anında tarayıcının yerel indirme yöneticisine iletilir.

---

## 📌 Öne Çıkan Özellikler

- **🎥 IDM Tarzı Yüzen İndirme Butonu:** Sayfada herhangi bir video oynatıldığında videonun sağ üst köşesinde zarif bir *"Videoyu İndir"* düğmesi belirir.
- **⚡ Çift Yönlü Medya Tespiti (Dual Sniffing):**
  - **Ağ Trafiği (Network Sniffer):** Arka planda yüklenen MP4, WebM, M3U8, TS ve ses akışlarını anında yakalar.
  - **Sayfa İçi Oynatıcılar (DOM Scanner):** HTML5 video/audio etiketlerini analiz ederek çözünürlük (4K, 1080p, 720p vb.), süre ve altyazıları çıkarır.
- **📦 HLS / M3U8 Parçalı Akış Birleştiricisi:** Parçalı `.m3u8` akışlarını arka planda otomatik indirip eksiksiz video dosyası (`.ts`) olarak birleştirir.
- **🎬 Mini Önizleme Oynatıcısı:** Videoyu indirmeden önce açılır pencere içinde anında önizleme imkanı.
- **📋 Tek Tıkla Bağlantı ve FFmpeg Kopyalama:** Doğrudan video URL'sini kopyalayabilme.
- **🎯 Reklam ve Ses Efekti Filtreleme:** Küçük reklam ve buton seslerini filtreleyerek listeyi temiz tutar.
- **🔒 Güvenli ve Gizlilik Odaklı:** Hiçbir veri harici sunucuya gitmez, tüm analiz ve indirme yerel olarak tarayıcınızda gerçekleşir.

---

## 🌐 Desteklenen Tarayıcılar

| Tarayıcı | Uyumluluk | Kurulum Sayfası |
|---|---|---|
| **Google Chrome** | ✅ %100 Uyumlu | `chrome://extensions` |
| **Microsoft Edge** | ✅ %100 Uyumlu | `edge://extensions` |
| **Brave Browser** | ✅ %100 Uyumlu | `brave://extensions` |
| **Opera / Opera GX** | ✅ %100 Uyumlu | `opera://extensions` |
| **Vivaldi / Arc** | ✅ %100 Uyumlu | `vivaldi://extensions` |

---

## 🛠️ Kurulum Kılavuzu (Adım Adım)

Eklenti standart Manifest V3 formatında hazırlandığı için herhangi bir derleme (`build`) işlemine ihtiyaç duymaz. Doğrudan klasör olarak yüklenebilir:

### 1. Google Chrome İçin Kurulum
1. Chrome tarayıcınızı açın ve adres çubuğuna `chrome://extensions` yazıp Enter'a basın.
2. Sağ üst köşedeki **"Geliştirici modu" (Developer mode)** anahtarını açık konuma getirin.
3. Sol üstte beliren **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın.
4. Açılan pencerede bu projenin bulunduğu klasörü seçin:
   `c:\Users\yunus\OneDrive\Documents\codes\Internet Download Assistant`
5. Eklenti anında tarayıcınıza eklenecek ve simgesi araç çubuğunda görünecektir. Sağ üstteki yapboz simgesinden raptiyeleyerek görünür kılabilirsiniz.

---

### 2. Microsoft Edge İçin Kurulum
1. Edge tarayıcınızı açın ve adres çubuğuna `edge://extensions` yazın.
2. Sol menüdeki **"Geliştirici Modu"** anahtarını açın.
3. Üstte beliren **"Paketlenmemiş öğeyi yükle"** butonuna tıklayın.
4. Klasörü seçin (`Internet Download Assistant`). Eklenti kullanıma hazırdır!

---

### 3. Brave Browser İçin Kurulum
1. Brave tarayıcınızı açın ve `brave://extensions` adresine gidin.
2. Sağ üstteki **"Geliştirici modu"** anahtarını açın.
3. **"Paketlenmemiş öğe yükle"** butonuna tıklayıp proje klasörünü seçin.

---

## 📖 Kullanım Rehberi

1. **Video İzleme:** İndirmek istediğiniz videonun bulunduğu web sayfasına gidin (haber siteleri, video portalları, sosyal medya vb.).
2. **Yüzen Buton:** Videoyu oynatmaya başladığınızda, videonun sağ üst köşesinde IDM tarzında **[ ⬇ Videoyu İndir ]** butonu görünecektir. Bu butona tıklayarak videoyu anında indirebilirsiniz.
3. **Açılır Pencere (Popup):** Tarayıcı araç çubuğundaki eklenti simgesine tıkladığınızda:
   - Tespit edilen tüm videolar çözünürlük (1080p, 720p vb.), dosya formatı ve dosya boyutuyla birlikte listelenir.
   - **İndir:** Videoyu varsayılan indirme klasörünüze kaydeder.
   - **Önizle:** Videoyu indirmeden önce mini oynatıcıda izlemenizi sağlar.
   - **Kopyala:** Video linkini panoya kopyalar.
   - **Tümünü İndir:** Sayfada bulunan tüm videoları sırayla indirir.
4. **M3U8 / HLS Akışları:** Parçalı yayınlarda eklenti otomatik olarak yerleşik segment indirici sekmesini açar; buradan kalite seçebilir, parçaları tarayıcı içinde birleştirip indirebilir veya FFmpeg komutunu kopyalayabilirsiniz.

---

## ⚙️ Ayarlar ve Özelleştirme

Eklenti simgesine sağ tıklayıp **"Seçenekler"** (veya popup içindeki çark simgesine) basarak:
- Video üzerindeki yüzen IDM butonunu açıp kapatabilir,
- Minimum dosya boyutu filtre sınırını değiştirebilir (örneğin yalnızca 1 MB üzeri videoları yakala),
- İsimlendirme şablonunu belirleyebilirsiniz.

---

## 📁 Dosya Yapısı

```
Internet Download Assistant/
├── manifest.json                  # Manifest V3 yapılandırması
├── background/
│   └── service-worker.js         # Ağ dinleyicisi (webRequest), indirme yöneticisi, rozet sayacı
├── content/
│   ├── content.js                # DOM medya tarayıcısı
│   ├── floating-widget.js        # IDM tarzı yüzen buton mekanizması
│   └── floating-widget.css       # Yüzen butonun modern tasarımı
├── popup/
│   ├── popup.html                # Açılır pencere arayüzü
│   ├── popup.css                 # Arayüz stilleri (karanlık tema, kart görünümü)
│   └── popup.js                  # Video listeleme, önizleme ve indirme mantığı
├── options/
│   ├── options.html              # Ayarlar sayfası
│   ├── options.css
│   └── options.js
├── hls-downloader/
│   ├── downloader.html           # HLS / M3U8 parçalı akış indirici konsolu
│   ├── downloader.css
│   └── downloader.js
├── icons/                        # 16, 32, 48, 128 px boyutlarında ikonlar
├── generate_icons.py             # İkon oluşturucu betik
├── CHROMEWEBSTORE.md             # Mağaza yayınlama ve gizlilik dökümanı
└── README.md                     # Kurulum ve kullanım kılavuzu
```

---

## 🛡️ Yasal ve Teknik Not

- Bu eklenti yalnızca kullanıcının erişim izni olan açık web akışlarını, standart HTML5 videolarını ve eğitim/içerik videolarını kişisel kullanım amacıyla indirmesini sağlar.
- DRM korumalı (şifreli, EME korumalı) akışlar (Netflix, Spotify, korumalı canlı yayınlar vb.) web standartları ve güvenlik gereği şifreli oynatıldığı için doğrudan indirilemez.
