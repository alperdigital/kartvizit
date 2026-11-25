# Kartvizit

Kartvizit, fiziksel kartvizitleri Türkçe ve İngilizce OCR ile okuyup yerel bir arşive dönüştüren mobil öncelikli bir PWA’dır.

- [Kaynak deposu](https://github.com/alperdigital/kartvizit)
- [GitHub Pages yayın hedefi](https://alperdigital.github.io/kartvizit/)

## Kullanım

1. **Kartvizit Tara** ile kamerayı açın veya galeriden JPEG, PNG ya da WebP seçin. Masaüstünde dosya bırakabilir, birden fazla kartvizit ekleyebilir ve her karta arka yüz ekleyebilirsiniz.
2. Gerekirse kenarları kırpın, fotoğrafı döndürün ve taramayı başlatın. Düşük güvenli alanları ham OCR metniyle karşılaştırın.
3. Kaydetmeden önce formu düzenleyin. Benzer kayıt bulunduğunda mevcut kaydı güncelleme, birleştirme veya ayrı kayıt oluşturma seçeneğini kullanın.
4. Arşivde ad veya iletişim bilgileriyle arayın. Şirket ve etiket filtreleri, favoriler, çoklu seçim ve toplu işlemler kullanılabilir.
5. Kayıtları Excel, CSV, vCard veya JSON olarak indirin. Kartvizit detayında vCard dosyasını paylaşabilir veya telefonunuzun rehber uygulamasıyla açabilirsiniz.

## Kurulum ve çevrimdışı kullanım

- **iPhone Safari** üzerinden Paylaş → Ana Ekrana Ekle → Ekle.
- **Android Chrome** üzerinden üç nokta → Uygulamayı yükle veya Ana ekrana ekle.
- İnternete bağlıyken **Ayarlar → OCR kaynaklarını indir** seçeneğini kullanın. Yaklaşık 17 MB OCR kaynağı indirilir. **Çevrimdışı tarama hazır** durumu göründüğünde uygulamayı bağlantısız açabilir, tarayabilir ve dışa aktarabilirsiniz.

## Claude ile sunucusuz kullanım

1. Ayarlar → Claude ile kartvizit okuma bölümünden Artifact kurulum talimatını indirin.
2. Claude hesabınızda AI destekli bir Artifact oluşturmak veya mevcut Artifact'ı güncellemek için talimatı kullanın. Kişisel depolamayı seçin.
3. Artifact bağlantısını Ayarlar'a girin ve Claude’da açın. Görselleri Claude ortamında analiz edin; izin ve plan koşulları Claude'a aittir.
4. Artifact'tan Kartvizit JSON dosyasını alın, PWA'da dosyayı seçin veya JSON'u yapıştırın. Önizlemeyi kontrol edip arşive aktarın.
5. Offline eklediğiniz kartları Claude’a taşımak için fotoğrafsız JSON indirin ve Artifact'a aktarın.

Her iki yönde mevcut Kartvizit v1 yedek biçimi kullanılır, ancak fotoğraf ve ham OCR metni gönderilmez. Aynı kimlikli daha yeni kayıtlar güncellenir; eşit tarihli çakışmalar ve farklı kimlikli benzer kayıtlar atlanır. Silmeler aktarılmaz. İçe aktarma otomatik eşitleme değildir. PWA Claude hesap oturumuna erişmez; kullanıcı Claude içinde giriş yapar. Artifact'ın AI görsel girişi ve kişisel depolama özellikleri hedef hesap/cihazda doğrulanmalıdır. PWA'nın mevcut offline tarama ve tam yedekleme özellikleri değişmez.

## Veri ve yedekleme

Tesseract.js, WASM motorunu bir Web Worker içinde çalıştırır. Görsel işleme ve kural tabanlı alan ayrıştırma cihazda yapılır. Kartvizitler Dexie üzerinden IndexedDB’ye yazılır. Fotoğraf saklama tercihi varsayılan olarak kapalıdır. Etkinleştirildiğinde yeni taramaların küçültülmüş JPEG kopyaları saklanır.

Ayarlar → Dışa aktar ve yedekle → JSON yoluyla tam bir arşiv yedeği alın. Yedeği uygulama dışında saklayın. Geri yükleme mevcut kimlikleri korur ve yeni kimlikleri ekler. Uygulama cihazlar arasında eşitleme yapmaz. Tarayıcı verileri silindiğinde veya yer açmak için boşaltıldığında yerel arşiv kaybolabilir.

[Gizlilik politikası / Privacy policy](public/privacy.html) · [Üçüncü taraf lisansları](THIRD_PARTY_NOTICES.md)

## Geliştirme ve test

Node.js 24 ve npm ile:

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run e2e
```

Geliştirme ve önizleme adresi `/kartvizit/` altındadır. Playwright üretim önizlemesinde masaüstü ve mobil Chromium profilleriyle çalışır. Sentetik Türkçe ve İngilizce kartvizitler test sırasında Canvas ile üretilir. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` mevcut bir Chromium ikilisine işaret edebilir.

## Yayın

GitHub Pages kaynağı **GitHub Actions** olarak ayarlandığında `main` dalına yapılan push, kilitli kurulum, lint, TypeScript, Vitest, üretim derlemesi, Playwright ve Pages dağıtımı adımlarını çalıştırır. Depo görünürlüğü ve Pages erişimi GitHub hesabının planına bağlıdır. Uygulama içi gezinme aynı `/kartvizit/` sayfasında yürür.

## Bilinen kısıtlamalar

- HEIC/HEIF açılması tarayıcının görüntü çözümleyicisine bağlıdır. JPEG’e dönüştürmek eşdeğer bir giriş yoludur.
- OCR doğruluğu baskıya, odak ve ışığa göre değişir. Alan ayrıştırma bir tahmindir ve kaydetmeden önce kullanıcı onayı gerekir.
- Mobil Chromium emülasyonu fiziksel kamera, iOS Safari kurulum akışı veya cihazın rehber uygulamasını doğrulamaz.
- JSON içe aktarma üst sınırı 50 MB ve 25.000 kayıttır. Çok sayıda saklanan fotoğraf varsa arşivi seçili kayıt grupları halinde yedekleyin.

## Teknik bileşenler

React, strict TypeScript, Vite, Tailwind CSS, Lucide, Tesseract.js, Dexie, Zod, write-excel-file ve Workbox. OCR sağlayıcısı ile ayrıştırıcı ayrı modüllerdir.

