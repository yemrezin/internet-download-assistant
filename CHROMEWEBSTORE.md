# Chrome Web Store & Edge Add-ons Listing — Internet Video Download Assistant

> Last Updated: 2026-09-07

## Store Listing

**Extension Name** [REQUIRED]
Internet Video Download Assistant

**Short Description** [REQUIRED]
IDM tarzı yüzen buton ve açılır pencere ile web sayfalarında açık olan videoları kolayca tespit edip yüksek kalitede indirin.

**Detailed Description** [REQUIRED]
Internet Video Download Assistant, web sayfalarında izlediğiniz videoları Internet Download Manager (IDM) tarzında otomatik olarak tespit eden ve tek tıkla bilgisayarınıza indirmenizi sağlayan modern bir Manifest V3 tarayıcı eklentisidir.

ÖNE ÇIKAN ÖZELLİKLER:
• IDM Tarzı Yüzen İndirme Butonu: Sayfada video oynatıldığında veya fare video üzerine getirildiğinde videonun sağ üst köşesinde "Videoyu İndir" butonu belirir.
• Çift Yönlü Algılama: Hem web sitesi ağ trafiğini (network sniffing) hem de sayfa içi HTML5 oynatıcıları (DOM) tarayarak en yüksek kalitedeki video akışlarını yakalar.
• Akıllı Kalite ve Boyut Göstergesi: Videoların çözünürlüklerini (4K, 1080p, 720p vb.) ve yaklaşık dosya boyutlarını indirmeden önce gösterir.
• HLS ve M3U8 Akış Desteği: Modern video sitelerinin parçalı akışlarını (HLS/M3U8) yerleşik segment indirici ile tek bir video dosyasında birleştirir.
• Önizleme Oynatıcısı: İndirmeden önce videonun doğru video olduğundan emin olmak için açılır pencere içinde mini video önizleme desteği.
• Reklam ve Ses Filtresi: Arka plan ses efektlerini ve küçük reklamları filtreleyerek sadece gerçek videoları listeler.
• %100 Yerel ve Güvenli: Hiçbir veriniz üçüncü taraf sunuculara gönderilmez, tüm işlemler doğrudan tarayıcınız içinde yerel olarak gerçekleşir.

NASIL KULLANILIR?
1. İzlemek istediğiniz videonun bulunduğu web sayfasına gidin.
2. Videoyu oynatmaya başladığınızda sağ üstte IDM tarzı "Videoyu İndir" butonu belirecektir.
3. İster bu butona tıklayarak, ister tarayıcı araç çubuğundaki eklenti simgesine tıklayarak tespit edilen videoları listeleyip indirebilirsiniz.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Web sayfalarında oynatılan video ve ses dosyalarını tespit ederek kullanıcının doğrudan indirmesini sağlar.

**Primary Language** [REQUIRED]
Turkish

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Small Icon | 48×48 PNG | ✅ Ready | `icons/icon-48.png` |
| Action Icon | 32×32 PNG | ✅ Ready | `icons/icon-32.png` |
| Mini Icon | 16×16 PNG | ✅ Ready | `icons/icon-16.png` |

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `downloads` | permissions | Kullanıcının indirmek istediği video dosyalarını tarayıcının indirme yöneticisi aracılığıyla yerel diske kaydetmek için gereklidir. |
| `storage` | permissions | Tespit edilen medya bilgilerini sekmelere göre geçici olarak hafızada tutmak ve kullanıcının tercih ettiği ayarları (filtreleme, buton görünürlüğü vb.) saklamak için gereklidir. |
| `tabs` | permissions | Aktif sekmenin URL'sini, başlığını okumak ve sekmeler arası geçişte video sayacını (badge) güncellemek için gereklidir. |
| `webRequest` | permissions | Web sayfasında yüklenen video akışlarını (video/mp4, m3u8, webm) ağ başlıkları üzerinden pasif olarak tespit etmek için gereklidir. |
| `scripting` | permissions | Kullanıcı açılır pencereden "Sayfayı Tara" butonuna bastığında sayfadaki video etiketlerini taramak için gereklidir. |
| `<all_urls>` | host_permissions | Eklentinin herhangi bir web sitesinde (video portalları, haber siteleri, eğitim platformları) oynatılan videoları tespit edebilmesi için gereklidir. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Distribution

**Visibility**: Public  
**Regions**: All regions  
**Pricing**: Free  

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0.0 | 2026-09-07 | İlk kararlı sürüm: Ağ ve DOM koklama, IDM yüzen buton, HLS/M3U8 indirici, modern popup. | Draft |
