# Claude entegrasyonu

[Artifact yetenekleri ve planlar](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) · [Paylaşım ve embed](https://support.claude.com/en/articles/9547008-share-artifacts) · [Claude hesabı kimlik bilgileri](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use)

Yeni Artifact'lar Free hesapta oluşturulabilir, ancak belgelerde Free için kalıcı depolama ve yeni Artifact bağlantısı paylaşımı yer almıyor. Belge, dışarıdan “Anyone with the link” ile gelen ziyaretçilere Claude kullanan bölümlerin çalışmayabileceğini de açıkça belirtiyor; Pro sahibi olmak, dış Free hesap için çalışan AI anlamına gelmez. Embed talimatı eski ve yayımlanmış chat Artifact'ları için belgelenmiş; yeni Artifact için kimlik, AI, dosya ve depolama zincirini doğrulamadan iframe kullanmayız.

`ClaudeImagePort` ve `PersonalPort` uygulamanın kendi tipleridir; Anthropic SDK veya global nesne iddiası değildir. Host bağlayıcısı ancak Claude'da sağlanan yöntem ve izinler doğrulanırsa eklenir. Görsel bağlayıcısı yoksa Artifact önizlemesi kullanıcıya gerçek Claude sohbetinde, kendi hesabıyla görseli işleterek yapılandırılmış sonucu yapıştırma yolu sunar. Sonuç ayrıştırılır ve kayıt için açık onay gerekir. Sahte model sonucu üretilmez. Shared Storage bağlayıcısı yoktur.
