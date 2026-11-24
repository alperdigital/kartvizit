# Üçüncü taraf bileşenleri

Özgün Kartvizit kodunun hakları saklıdır. Aşağıdaki bileşenler kendi lisanslarıyla dağıtılır. Kesin sürümler `package-lock.json` içinde yer alır. Üretim paketindeki lisans metinleri Ayarlar ekranından erişilen `licenses.txt` dosyasındadır.

| Bileşen | Lisans |
| --- | --- |
| React, React DOM, Dexie, Tailwind CSS, libphonenumber-js, write-excel-file, Zod | MIT |
| Lucide | ISC ve ikon kaynağına göre MIT |
| Tesseract.js, Tesseract.js Core ve Tesseract OCR dil modelleri | Apache-2.0 |
| @tesseract.js-data/eng ve /tur npm sarmalayıcıları | MIT |
| Workbox, Playwright | Apache-2.0 |
| Vite, Vite React ve PWA eklentileri, Vitest, ESLint, typescript-eslint, fake-indexeddb | MIT |
| TypeScript | Apache-2.0 |

OCR JS/WASM ve sıkıştırılmış dil dosyaları build sırasında npm kilidindeki sürümlerden kopyalanır. `ocr/` dizini motorun Apache-2.0 lisans metinlerini de içerir. Dil paketleri Tesseract OCR proje modellerinin tarayıcı uyumlu dağıtımlarıdır. [Tesseract modelleri](https://github.com/tesseract-ocr/tessdata_best) · [Dil paketi dağıtımı](https://github.com/naptha/tessdata)
