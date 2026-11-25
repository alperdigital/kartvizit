# Artifact oluşturma ve yayınlama

1. Node.js 24 ile `npm ci` ve `npm run build:artifact` çalıştırın. Ayrı ve tek dosyalık paket: `work-artifact/kartvizit-artifact.html`.
2. Geliştirme hesabında Claude'un resmî girişini kullanın. Yeni özel Kartvizit Artifact için paket ve `public/claude-artifact-prompt.txt` kullanılır. Özel veya iç endpoint, API anahtarı, hesabı PWA'ya bağlayan form yoktur.
3. Gerçek Artifact'ı açıp çalıştırın. Host tarafında görsel destek yoksa sohbet-JSON geri dönüşünü test edin; kişisel yazım yoksa açıkça geçici oturum kullanın.
4. Üretimden önce ikinci hesapla güvenli erişimi, AI ve Personal Storage izolasyonunu; telefonda dosya seçimi ve indirmeyi test edin. Onaysız ücretli işlem yoktur. Kartvizit fotoğrafını hiçbir kalıcı arşiv denemesine eklemeyin.
5. Doğrulanmış yeni Artifact bağlantısı alındığında `VITE_CLAUDE_ARTIFACT_URL` değerini Pages build ortamına verin. Doğrulanmış paylaşım bağlantısı olmadan bunu boş bırakın. Özel test bağlantısı isteğe bağlı Ayarlar alanına girilebilir. Eski örnek link yayınlanmaz.
6. GitHub Actions PR'da doğrular; Pages dağıtımı yalnızca main'e geçince çalışır. Gerçek entegrasyon doğrulanmadan PR'ı taslak tutun.
