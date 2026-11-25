# Test

- `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run build:artifact`, `npx playwright install chromium`, `npm run e2e`.
- Playwright masaüstü ve Pixel 7 adlı Chromium profillerini kullanır. Cihaz benzetimi fiziksel kamera, mobil Claude uygulaması veya gerçek PWA kurulumu değildir.
- Ünite testleri: fotoğraf/OCR ayıklama, yerel fotoğraf koruması, geçersiz satır sayımı, eski v1 biçimi, çakışma, tekrar yükleme, kesin şema ve depolama hatası.
- Canlı kanıt kontrol listesi: özel Artifact açılış ve girişe dönüş; sentetik ön/arka yüz analizi; onay, kayıt ve yeniden açma; Artifact → PWA ve PWA → Artifact JSON; tekrar yükleme; PWA offline; iki hesapla izolasyon ve dış ziyaretçi AI; servis hatası/kota; fiziksel telefon. Oturum önizlemesi bunların yerine geçmez.
