# Kartvizit mimarisi

```mermaid
flowchart LR
  P["Statik Kartvizit PWA"] --> O["Yerel Tesseract OCR"]
  P --> I["IndexedDB / Dexie"]
  P -. "Doğrulanmış bağlantı varsa" .-> A["Claude Artifact"]
  A -. "Belgelenmiş ve doğrulanmış yetenek varsa" .-> M["Claude görsel analizi"]
  A -. "Yalnızca kişisel, desteklenirse" .-> S["Personal Storage"]
  A --> R["Geçici oturum arşivi"]
  P <-->|"Kullanıcı onaylı fotoğrafsız JSON v1"| A
```

PWA ve Artifact aynı kart şemasını, telefon normalizasyonunu ve aktarım motorunu kullanır. PWA kendi servis çalışanını, OCR worker'ını ve tam yerel yedeğini korur. Artifact paketi ayrı derlenir, Pages hizmetine dağıtılmaz. Üretim backend'i, otomatik eşitleme veya silme yayılımı yoktur. Çakışma kararları aktarım yazılırken IndexedDB işlemi içinde yeniden denetlenir.
