/* ═══════════════════════════════════════════════════════════
   Toolkit — client-side internationalisation
   English is the source locale. A visitor's explicit choice is
   saved locally and reused on every published page.
   ═══════════════════════════════════════════════════════════ */

(function initI18n() {
  'use strict';

  const DEFAULT_LANGUAGE = 'en';
  const STORAGE_KEY = 'toolkit-language';
  const SUPPORTED_LANGUAGES = new Set(['en', 'tr']);
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  let language = readLanguage();
  const originalDocumentTitle = document.title;

  /*
   * English source text is deliberately the key. This lets static pages,
   * generated controls and future tools share one dictionary without a
   * framework or a duplicate HTML tree. Add new UI copy here (or with
   * data-i18n) whenever a tool is added.
   */
  const translations = {
    tr: {
      // Navigation, footer and shared interface
      'Language': 'Dil',
      'Toolkit home': 'Toolkit ana sayfası',
      'View project license': 'Proje lisansını görüntüle',
      'Toolkit — 78 Free Developer Utilities': 'Toolkit — 78 Ücretsiz Geliştirici Aracı',
      'Toolkit — 101 Free Developer Utilities': 'Toolkit — 101 Ücretsiz Geliştirici Aracı',
      'License — Toolkit': 'Lisans — Toolkit',
      '404 — Page Not Found · Toolkit': '404 — Sayfa Bulunamadı · Toolkit',
      'Main navigation': 'Ana gezinme',
      'Open navigation menu': 'Gezinme menüsünü aç',
      'Close navigation menu': 'Gezinme menüsünü kapat',
      'Tools': 'Araçlar',
      'Browse All Tools': 'Tüm Araçlara Göz At',
      'Browse All 78 Tools': '78 Aracın Tümüne Göz At',
      'Home': 'Ana sayfa',
      'Back to home': 'Ana sayfaya dön',
      'Go Home': 'Ana Sayfa',
      'Privacy-first developer utilities. Everything runs in your browser.': 'Gizlilik odaklı geliştirici araçları. Her şey tarayıcınızda çalışır.',
      'No data leaves your device.': 'Verileriniz cihazınızdan ayrılmaz.',
      'Buy me a coffee': 'Bana kahve ısmarla',
      'GitHub profile of abel0x': 'abel0x GitHub profili',
      'Breadcrumb': 'Gezinti yolu',
      'License': 'Lisans',
      'Open Source': 'Açık kaynak',
      'Project license': 'Proje lisansı',
      'Toolkit is made available under the Apache License 2.0.': 'Toolkit, Apache License 2.0 kapsamında sunulmaktadır.',
      'Apache License 2.0': 'Apache Lisansı 2.0',
      'Copyright 2024–2026 abel0x.': 'Telif hakkı 2024–2026 abel0x.',
      'Download LICENSE': 'LICENSE dosyasını indir',
      "This page is a readable copy of the project's canonical LICENSE file.": 'Bu sayfa, projenin asıl LICENSE dosyasının okunabilir kopyasıdır.',
      'Third-party notices': 'Üçüncü taraf bildirimleri',
      'Some word-list data carries its own source and licence terms. Those terms remain in effect.': 'Bazı kelime listesi verilerinin kendi kaynak ve lisans koşulları vardır. Bu koşullar geçerliliğini korur.',
      'Full license text': 'Lisansın tam metni',
      'All 78 Tools': '78 Aracın Tümü',
      'Explore Tools': 'Araçları Keşfet',
      'Featured Tools': 'Öne Çıkan Araçlar',
      'All Tools': 'Tüm Araçlar',
      'All': 'Tümü',
      'Text': 'Metin',
      'Web': 'Web',
      'Open tool': 'Aracı aç',
      'Filter tools': 'Araçları filtrele',
      'Filter tools by category': 'Araçları kategoriye göre filtrele',
      'Search tools': 'Araç ara',
      'Search 78 tools…': '78 araç ara…',
      'Developer Utilities Suite': 'Geliştirici Araçları Paketi',
      'The Ultimate': 'En Kapsamlı',
      'A curated set of cryptographic & encoding utilities, built for precision. No tracking. No backend. Pure client-side.': 'Hassas kullanım için özenle seçilmiş kriptografi ve kodlama araçları. Takip yok. Sunucu yok. Tamamen tarayıcıda çalışır.',
      'Servers': 'Sunucu',
      'Private': 'Özel',
      'Click any card to open the tool on its own dedicated page. Press / to search.': 'Aracı kendi sayfasında açmak için herhangi bir karta tıklayın. Aramak için / tuşuna basın.',
      'Find tools': 'Araç bul',
      'Find a tool': 'Araç bul',
      'Find a tool (Ctrl/Cmd + K)': 'Araç bul (Ctrl/Cmd + K)',
      'Search all {{count}} utilities': '{{count}} aracın tümünde ara',
      'Clear recent': 'Son kullanılanları temizle',
      'Close tool finder': 'Araç bulucuyu kapat',
      'Try “JSON”, “password”, or “QR”…': '“JSON”, “parola” veya “QR” arayın…',
      'Matching tools': 'Eşleşen araçlar',
      'Recently used tools — stored only in this browser': 'Son kullanılan araçlar — yalnızca bu tarayıcıda saklanır',
      'No tools found. Try a different keyword.': 'Araç bulunamadı. Başka bir anahtar kelime deneyin.',
      'No matching tools': 'Eşleşen araç yok',
      '{{count}} matching tool': '{{count}} eşleşen araç',
      '{{count}} matching tools': '{{count}} eşleşen araç',
      '{{count}} suggested tools': '{{count}} önerilen araç',
      'navigate': 'gezin',
      'open': 'aç',
      'close': 'kapat',

      // Categories
      'Security': 'Güvenlik',
      'Security & Crypto': 'Güvenlik ve Kripto',
      'Encoding': 'Kodlama',
      'Encoding & Decoding': 'Kodlama ve Kod Çözme',
      'Dev Tools': 'Geliştirici Araçları',
      'Developer Tools': 'Geliştirici Araçları',
      'Text Tools': 'Metin Araçları',
      'Generators': 'Oluşturucular',
      'Converters': 'Dönüştürücüler',
      'Web Utils': 'Web Araçları',
      'Media': 'Medya',

      // Shared buttons, fields and messages
      'Input': 'Girdi',
      'Input Text': 'Girdi Metni',
      'Output': 'Çıktı',
      'Result': 'Sonuç',
      'Value': 'Değer',
      'Unit': 'Birim',
      'Format': 'Biçimlendir',
      'Minify': 'Küçült',
      'Validate': 'Doğrula',
      'Convert': 'Dönüştür',
      'Generate': 'Oluştur',
      'Calculate': 'Hesapla',
      'Preview': 'Önizle',
      'Copy': 'Kopyala',
      'Copy Output': 'Çıktıyı Kopyala',
      'Copy result': 'Sonucu kopyala',
      'Copy output': 'Çıktıyı kopyala',
      'Clear': 'Temizle',
      'Reset': 'Sıfırla',
      'Download': 'İndir',
      'Upload': 'Yükle',
      'Open': 'Aç',
      'Close': 'Kapat',
      'Save': 'Kaydet',
      'Load': 'Yükle',
      'Search': 'Ara',
      'Replace': 'Değiştir',
      'Remove': 'Kaldır',
      'Add': 'Ekle',
      'Random': 'Rastgele',
      'Random Color': 'Rastgele Renk',
      'Verify': 'Doğrula',
      'Encode →': 'Kodla →',
      '← Decode': '← Kodu Çöz',
      'Encode': 'Kodla',
      'Decode': 'Kodu Çöz',
      'Text → Binary': 'Metin → İkili',
      'Binary → Text': 'İkili → Metin',
      'Result will appear here…': 'Sonuç burada görünecek…',
      'Result will appear here...': 'Sonuç burada görünecek...',
      'Enter text or Base64 string…': 'Metin veya Base64 dizgesi girin…',
      'Enter text or Base32 string…': 'Metin veya Base32 dizgesi girin…',
      'Enter text or binary string…': 'Metin veya ikili dizge girin…',
      'Copy to clipboard': 'Panoya kopyala',
      'Copied!': 'Kopyalandı!',
      'Error': 'Hata',
      'Success': 'Başarılı',
      'Loading…': 'Yükleniyor…',
      'Select a file': 'Dosya seçin',
      'Choose a file': 'Dosya seçin',
      'Drop a file here': 'Dosyayı buraya bırakın',
      'Password': 'Parola',
      'Length': 'Uzunluk',
      'Width': 'Genişlik',
      'Height': 'Yükseklik',
      'Color': 'Renk',
      'Background': 'Arka plan',
      'Text Color': 'Metin rengi',
      'Options': 'Seçenekler',
      'Settings': 'Ayarlar',
      'Lowercase': 'Küçük harf',
      'Uppercase': 'Büyük harf',
      'Numbers': 'Sayılar',
      'Symbols': 'Semboller',
      'Alphabetical': 'Alfabetik',
      'Numeric': 'Sayısal',
      'Ascending': 'Artan',
      'Descending': 'Azalan',
      'Yes': 'Evet',
      'No': 'Hayır',
      'From': 'Başlangıç',
      'To': 'Bitiş',
      'Name': 'Ad',
      'Description': 'Açıklama',
      'Type': 'Tür',
      'Size': 'Boyut',
      'Date': 'Tarih',
      'Time': 'Saat',
      'URL': 'URL',
      'Example': 'Örnek',
      'Examples': 'Örnekler',
      'How it works': 'Nasıl çalışır?',
      'About': 'Hakkında',
      'Back': 'Geri',
      'Next': 'İleri',
      'Generator': 'Oluşturucu',
      'Converter': 'Dönüştürücü',
      'Encoder / Decoder': 'Kodlayıcı / Kod Çözücü',
      'Formatter': 'Biçimlendirici',
      'Validator': 'Doğrulayıcı',
      'Previewer': 'Önizleyici',
      'Checker': 'Denetleyici',
      'Parser': 'Ayrıştırıcı',
      'Reader': 'Okuyucu',
      'Optimizer': 'İyileştirici',
      'Click Generate': 'Oluştur düğmesine tıklayın',
      'Generate Hash': 'Hash Oluştur',
      'Generate Hashes': 'Hash Değerlerini Oluştur',
      'Hashing…': 'Hash oluşturuluyor…',
      'Verifying…': 'Doğrulanıyor…',
      'Valid JSON ✓': 'Geçerli JSON ✓',
      'Invalid JSON ✗': 'Geçersiz JSON ✗',
      '✓ Valid JSON': '✓ Geçerli JSON',
      '✕ Invalid JSON': '✕ Geçersiz JSON',
      'Reading file…': 'Dosya okunuyor…',
      'Computing hashes…': 'Hash değerleri hesaplanıyor…',
      'Invalid': 'Geçersiz',
      'Generate SHA family digests from any text input using the Web Crypto API.': 'Web Crypto API ile herhangi bir metin girdisinden SHA ailesi özetleri oluşturun.',
      'Type or paste text to hash…': 'Hash oluşturmak için metin yazın veya yapıştırın…',
      'Text to hash': 'Hash oluşturulacak metin',
      'Hash Generator Tool': 'Hash Oluşturucu Aracı',
      'Hash results': 'Hash sonuçları',

      // Tool feedback and validation messages
      'Array is empty.': 'Dizi boş.',
      'Both fields are empty': 'Her iki alan da boş.',
      'CSS minified!': 'CSS küçültüldü!',
      'CSV needs at least a header and one data row.': 'CSV için en az bir başlık ve bir veri satırı gerekir.',
      'Checksums computed!': 'Sağlama toplamları hesaplandı!',
      'Cleared': 'Temizlendi',
      'Cleared all UUIDs': 'Tüm UUID’ler temizlendi',
      'Code point out of range.': 'Kod noktası aralık dışında.',
      'Converted to CSV!': 'CSV’ye dönüştürüldü!',
      'Converted to JSON!': 'JSON’a dönüştürüldü!',
      'Converted to YAML!': 'YAML’ye dönüştürüldü!',
      'Copy failed — please copy manually': 'Kopyalama başarısız oldu — lütfen elle kopyalayın',
      'Copy not supported in this browser': 'Kopyalama bu tarayıcıda desteklenmiyor',
      'Decoded from Base32!': 'Base32 kodu çözüldü!',
      'Decoded from binary!': 'İkili kod çözüldü!',
      'Decoded from hex!': 'Hex kodu çözüldü!',
      'Downloaded!': 'İndirildi!',
      'Downloaded fake-data.': 'Sahte veri indirildi.',
      'Enter a code point value.': 'Bir kod noktası değeri girin.',
      'Enter a password first': 'Önce bir parola girin',
      'Enter a search term': 'Bir arama terimi girin',
      'Enter a valid Unix timestamp': 'Geçerli bir Unix zaman damgası girin',
      'Enter at least one UUID.': 'En az bir UUID girin.',
      'Enter at least one value': 'En az bir değer girin',
      'Enter both password and hash': 'Parolayı ve hash değerini girin',
      'Enter some text first.': 'Önce bir metin girin.',
      'Failed to read file.': 'Dosya okunamadı.',
      'HMAC generated!': 'HMAC oluşturuldu!',
      'HTML decoded!': 'HTML kodu çözüldü!',
      'HTML encoded!': 'HTML kodlandı!',
      'HTML minified!': 'HTML küçültüldü!',
      'Image copied!': 'Görüntü kopyalandı!',
      'Image is too large (max 10MB)': 'Görüntü çok büyük (en fazla 10 MB)',
      'Input is empty': 'Girdi boş',
      'Input is empty.': 'Girdi boş.',
      'Invalid Base64 image data': 'Geçersiz Base64 görüntü verisi',
      'Invalid SVG': 'Geçersiz SVG',
      'Invalid URL': 'Geçersiz URL',
      'Invalid bcrypt hash format': 'Geçersiz bcrypt hash biçimi',
      'Invalid code point value.': 'Geçersiz kod noktası değeri.',
      'Invalid date': 'Geçersiz tarih',
      'Invalid timestamp': 'Geçersiz zaman damgası',
      'JS minified (basic)!': 'JS küçültüldü (temel)!',
      'JSON is valid ✓': 'JSON geçerli ✓',
      'JSON minified!': 'JSON küçültüldü!',
      'JSON must be an array of objects.': 'JSON, nesnelerden oluşan bir dizi olmalıdır.',
      'Keys sorted!': 'Anahtarlar sıralandı!',
      'Line numbers added': 'Satır numaraları eklendi',
      'Line numbers removed': 'Satır numaraları kaldırıldı',
      'Min must be ≤ Max': 'Minimum değer maksimum değerden büyük olamaz',
      'No QR code to copy': 'Kopyalanacak QR kodu yok',
      'No QR code to download': 'İndirilecek QR kodu yok',
      'Nothing to copy': 'Kopyalanacak bir şey yok',
      'Nothing to copy.': 'Kopyalanacak bir şey yok.',
      'Nothing to download': 'İndirilecek bir şey yok',
      'Nothing to download.': 'İndirilecek bir şey yok.',
      'Paste or upload an SVG first': 'Önce bir SVG yapıştırın veya yükleyin',
      'Please enter CSS.': 'Lütfen CSS girin.',
      'Please enter CSV.': 'Lütfen CSV girin.',
      'Please enter HTML.': 'Lütfen HTML girin.',
      'Please enter JSON to minify.': 'Küçültmek için JSON girin.',
      'Please enter JSON to process': 'İşlemek için JSON girin',
      'Please enter JSON to validate.': 'Doğrulamak için JSON girin.',
      'Please enter JSON.': 'Lütfen JSON girin.',
      'Please enter JavaScript.': 'Lütfen JavaScript girin.',
      'Please enter SQL.': 'Lütfen SQL girin.',
      'Please enter XML.': 'Lütfen XML girin.',
      'Please enter YAML.': 'Lütfen YAML girin.',
      'Please enter a JWT token': 'Lütfen bir JWT belirteci girin',
      'Please enter a message.': 'Lütfen bir ileti girin.',
      'Please enter a secret key.': 'Lütfen gizli anahtarı girin.',
      'Please enter a value to look up.': 'Sorgulamak için bir değer girin.',
      'Please enter some text to hash': 'Hash oluşturmak için metin girin',
      'Please fill both JSON inputs.': 'Her iki JSON alanını da doldurun.',
      'Please fill in the required fields': 'Lütfen zorunlu alanları doldurun',
      'Please select an image file': 'Lütfen bir görüntü dosyası seçin',
      'Please upload a valid image file': 'Lütfen geçerli bir görüntü dosyası yükleyin',
      'QR code decoded!': 'QR kodu çözüldü!',
      'QR code generated!': 'QR kodu oluşturuldu!',
      'QR library not loaded yet — please try again': 'QR kitaplığı henüz yüklenmedi — lütfen tekrar deneyin',
      'QR reader library not loaded yet': 'QR okuyucu kitaplığı henüz yüklenmedi',
      'ROT13 applied!': 'ROT13 uygulandı!',
      'Range too small for unique integers': 'Aralık benzersiz tam sayılar için çok dar',
      'SQL formatted!': 'SQL biçimlendirildi!',
      'Select a date and time': 'Bir tarih ve saat seçin',
      'Select at least one algorithm.': 'En az bir algoritma seçin.',
      'Select at least one character type': 'En az bir karakter türü seçin',
      'Select at least one charset': 'En az bir karakter kümesi seçin',
      'Select at least one field': 'En az bir alan seçin',
      'XML formatted!': 'XML biçimlendirildi!',
      'XML minified!': 'XML küçültüldü!',

      // Tool names — also used by the home cards and command palette
      'Password Generator': 'Parola Oluşturucu',
      'Hash Generator': 'Hash Oluşturucu',
      'JWT Decoder': 'JWT Kod Çözücü',
      'Bcrypt Hash Generator': 'Bcrypt Hash Oluşturucu',
      'HMAC Generator': 'HMAC Oluşturucu',
      'Password Strength Checker': 'Parola Gücü Denetleyicisi',
      'Random Token Generator': 'Rastgele Belirteç Oluşturucu',
      'UUID Validator': 'UUID Doğrulayıcı',
      'File Checksum Tool': 'Dosya Sağlama Toplamı Hesaplayıcı',
      'Base64 Encode / Decode': 'Base64 Kodlama / Kod Çözme',
      'URL Encoder / Decoder': 'URL Kodlayıcı / Kod Çözücü',
      'Case Converter': 'Büyük/Küçük Harf Dönüştürücü',
      'Base32 Encoder / Decoder': 'Base32 Kodlayıcı / Kod Çözücü',
      'Hex Encoder / Decoder': 'Hex Kodlayıcı / Kod Çözücü',
      'HTML Encode / Decode': 'HTML Kodlama / Kod Çözme',
      'Binary Text Converter': 'İkili Metin Dönüştürücü',
      'ASCII Converter': 'ASCII Dönüştürücü',
      'ROT13 Encoder / Decoder': 'ROT13 Kodlayıcı / Kod Çözücü',
      'JSON Formatter': 'JSON Biçimlendirici',
      'JSON Minifier': 'JSON Küçültücü',
      'JSON Validator': 'JSON Doğrulayıcı',
      'JSON to YAML': 'JSON → YAML',
      'YAML to JSON': 'YAML → JSON',
      'JSON to CSV': 'JSON → CSV',
      'CSV to JSON': 'CSV → JSON',
      'JSON Diff Tool': 'JSON Karşılaştırma Aracı',
      'JSON Sorter': 'JSON Sıralayıcı',
      'Regex Tester': 'Regex Test Aracı',
      'Markdown Previewer': 'Markdown Önizleyici',
      'Text Diff Checker': 'Metin Fark Denetleyicisi',
      'SQL Formatter': 'SQL Biçimlendirici',
      'XML Formatter': 'XML Biçimlendirici',
      'HTML Minifier': 'HTML Küçültücü',
      'CSS Minifier': 'CSS Küçültücü',
      'JavaScript Minifier': 'JavaScript Küçültücü',
      'HTTP Status Code Lookup': 'HTTP Durum Kodu Sorgulama',
      'MIME Type Lookup': 'MIME Türü Sorgulama',
      'Word Counter': 'Kelime Sayacı',
      'Text Sorter': 'Metin Sıralama Aracı',
      'Remove Duplicate Lines': 'Yinelenen Satırları Kaldır',
      'Line Numbering Tool': 'Satır Numaralandırma Aracı',
      'Text Reverser': 'Metin Ters Çevirme Aracı',
      'Slug Generator': 'Slug Oluşturucu',
      'Random String Generator': 'Rastgele Dizge Oluşturucu',
      'Text Cleaner': 'Metin Temizleyici',
      'Find and Replace Tool': 'Bul ve Değiştir Aracı',
      'UUID Generator': 'UUID Oluşturucu',
      'Lorem Ipsum': 'Lorem Ipsum',
      'QR Code Generator': 'QR Kod Oluşturucu',
      'Gradient Generator': 'Gradyan Oluşturucu',
      'Color Palette Generator': 'Renk Paleti Oluşturucu',
      'Random Number Generator': 'Rastgele Sayı Oluşturucu',
      'Random Color Generator': 'Rastgele Renk Oluşturucu',
      'Random Name Generator': 'Rastgele Ad Oluşturucu',
      'Fake Data Generator': 'Sahte Veri Oluşturucu',
      'Timestamp Converter': 'Zaman Damgası Dönüştürücü',
      'Color Converter': 'Renk Dönüştürücü',
      'Unit Converter (px/rem/em)': 'Birim Dönüştürücü (px/rem/em)',
      'Temperature Converter': 'Sıcaklık Dönüştürücü',
      'Bytes Converter': 'Bayt Dönüştürücü',
      'Number Base Converter': 'Sayı Tabanı Dönüştürücü',
      'Percentage Calculator': 'Yüzde Hesaplayıcı',
      'Aspect Ratio Calculator': 'En-Boy Oranı Hesaplayıcı',
      'URL Parser': 'URL Ayrıştırıcı',
      'Meta Tag Generator': 'Meta Etiket Oluşturucu',
      'Open Graph Tag Generator': 'Open Graph Etiket Oluşturucu',
      'Query String Parser': 'Sorgu Dizgesi Ayrıştırıcı',
      'URL Builder': 'URL Oluşturucu',
      'User Agent Parser': 'User-Agent Ayrıştırıcı',
      'Robots.txt Generator': 'Robots.txt Oluşturucu',
      'QR Code Reader': 'QR Kod Okuyucu',
      'Image to Base64': 'Görüntü → Base64',
      'Base64 to Image': 'Base64 → Görüntü',
      'Image Metadata Viewer': 'Görüntü Meta Verisi Görüntüleyici',
      'SVG Optimizer': 'SVG İyileştirici',
      'Choose SVG file': 'SVG dosyası seç',
      'No file selected': 'Dosya seçilmedi',
      'Favicon Generator': 'Favicon Oluşturucu',
      'Image Dimension Checker': 'Görüntü Boyut Denetleyicisi',
      'QR Batch Generator': 'Toplu QR Kod Oluşturucu'
    }
  };

  function readLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED_LANGUAGES.has(stored) ? stored : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  }

  function interpolate(text, values) {
    if (!values) return text;
    return text.replace(/{{(\w+)}}/g, (_, key) => String(values[key] ?? ''));
  }

  function t(key, values) {
    const dictionary = translations[language] || {};
    const extension = window.TOOLKIT_I18N_EXTRA?.[language] || {};
    const translated = dictionary[key] || extension[key] || translatePattern(key);
    return interpolate(translated, values);
  }

  function translatePattern(key) {
    if (language !== 'tr') return key;
    let match = key.match(/^Search (\d+) tools…$/);
    if (match) return `${match[1]} araç ara…`;
    match = key.match(/^Browse (\d+) Tools$/);
    if (match) return `${match[1]} Araca Göz At`;
    match = key.match(/^(\d+) Tools$/);
    if (match) return `${match[1]} Araç`;
    match = key.match(/^(\d+) matching tools?$/);
    if (match) return `${match[1]} eşleşen araç`;
    match = key.match(/^(\d+) suggested tools$/);
    if (match) return `${match[1]} önerilen araç`;
    match = key.match(/^(\d+) tokens? generated!$/);
    if (match) return `${match[1]} belirteç oluşturuldu!`;
    match = key.match(/^Generated (\d+) (record\(s\)|string\(s\)|name\(s\)|number\(s\))$/);
    if (match) {
      const nouns = {
        'record(s)': 'kayıt',
        'string(s)': 'dizge',
        'name(s)': 'ad',
        'number(s)': 'sayı'
      };
      return `${match[1]} ${nouns[match[2]]} oluşturuldu`;
    }
    match = key.match(/^(\d+) UUIDs?$/);
    if (match) return `${match[1]} UUID`;
    match = key.match(/^(\d+) min$/);
    if (match) return `${match[1]} dakika`;
    match = key.match(/^(\d+) images?$/);
    if (match) return `${match[1]} görsel`;
    match = key.match(/^(\d+) valid \/ (\d+) invalid$/);
    if (match) return `${match[1]} geçerli / ${match[2]} geçersiz`;
    match = key.match(/^(\d+) match(?:es)? replaced\.$/);
    if (match) return `${match[1]} eşleşme değiştirildi.`;
    match = key.match(/^(\d+) replacement\(s\) made$/);
    if (match) return `${match[1]} değiştirme yapıldı`;
    match = key.match(/^\+ (\d+) additions?$/);
    if (match) return `+ ${match[1]} ekleme`;
    match = key.match(/^− (\d+) deletions?$/);
    if (match) return `− ${match[1]} silme`;
    match = key.match(/^≡ (\d+) unchanged$/);
    if (match) return `≡ ${match[1]} değişmeyen`;
    match = key.match(/^(\d+) matches?$/);
    if (match) return `${match[1]} eşleşme`;
    match = key.match(/^Group (\d+)$/);
    if (match) return `Grup ${match[1]}`;
    match = key.match(/^(\d+) blank line\(s\) removed$/);
    if (match) return `${match[1]} boş satır kaldırıldı`;
    match = key.match(/^(\d+) duplicate\(s\) removed\. (\d+) unique line\(s\) kept\.$/);
    if (match) return `${match[1]} yinelenen satır kaldırıldı. ${match[2]} benzersiz satır korundu.`;
    match = key.match(/^Before: (.+) → After: (.+) · Saved: ([\d.]+)%$/);
    if (match) return `Önce: ${match[1]} → Sonra: ${match[2]} · Kazanç: ${match[3]}%`;
    match = key.match(/^(.+) → (.+) · saved (.+) \(([\d.]+)%\)$/);
    if (match) return `${match[1]} → ${match[2]} · ${match[3]} tasarruf (${match[4]}%)`;
    match = key.match(/^(\d+) (years?|months?|days?|hours?|minutes?|seconds?) ago$/);
    if (match) return `${match[1]} ${t(match[2])} önce`;
    match = key.match(/^in (\d+) (years?|months?|days?|hours?|minutes?|seconds?)$/);
    if (match) return `${match[1]} ${t(match[2])} sonra`;
    match = key.match(/^Sorted (\d+) lines$/);
    if (match) return `${match[1]} satır sıralandı`;
    match = key.match(/^(\d+) duplicate\(s\) removed$/);
    if (match) return `${match[1]} yinelenen kayıt kaldırıldı`;
    match = key.match(/^(©\s*\d{4}\s+Toolkit\.\s*)No data leaves your device\.$/);
    if (match) return `${match[1]}Verileriniz cihazınızdan ayrılmaz.`;
    match = key.match(/^(\d+) tools · HTML · CSS · Vanilla JS · Web Crypto API$/);
    if (match) return `${match[1]} araç · HTML · CSS · Vanilla JS · Web Crypto API`;
    match = key.match(/^(\d+) day(s)? • ([\d.]+) weeks • (\d+) whole average months$/);
    if (match) return `${match[1]} gün • ${match[3]} hafta • ${match[4]} tam ortalama ay`;
    match = key.match(/^Fields: minute=(.+), hour=(.+), day=(.+), month=(.+), weekday=(.+)\.$/);
    if (match) return `Alanlar: dakika=${match[1]}, saat=${match[2]}, gün=${match[3]}, ay=${match[4]}, hafta günü=${match[5]}.`;
    match = key.match(/^Contrast ratio: ([\d.]+):1\nNormal text AA: (Pass|Fail) • AAA: (Pass|Fail)\nLarge text AA: (Pass|Fail) • AAA: (Pass|Fail)$/);
    if (match) return `Kontrast oranı: ${match[1]}:1\nNormal metin AA: ${t(match[2])} • AAA: ${t(match[3])}\nBüyük metin AA: ${t(match[4])} • AAA: ${t(match[5])}`;
    match = key.match(/^Failed to generate QR for: (.+)$/);
    if (match) return `QR kodu oluşturulamadı: ${match[1]}`;
    match = key.match(/^Failed to generate QR: (.+)$/);
    if (match) return `QR kodu oluşturulamadı: ${match[1]}`;
    match = key.match(/^Error computing (.+): (.+)$/);
    if (match) return `${match[1]} hesaplanırken hata oluştu: ${match[2]}`;
    const prefixes = [
      ['Decode error: ', 'Kod çözme hatası: '],
      ['Encode error: ', 'Kodlama hatası: '],
      ['Error: ', 'Hata: '],
      ['Parse error: ', 'Ayrıştırma hatası: '],
      ['Invalid JSON: ', 'Geçersiz JSON: '],
      ['Invalid regex: ', 'Geçersiz düzenli ifade: '],
      ['Invalid percent-encoded string — ', 'Geçersiz yüzde kodlu dizge — '],
      ['XML parse error: ', 'XML ayrıştırma hatası: '],
      ['JSON A is invalid: ', 'JSON A geçersiz: '],
      ['JSON B is invalid: ', 'JSON B geçersiz: '],
      ['Hashing failed: ', 'Hash oluşturulamadı: '],
      ['Encoding failed: ', 'Kodlama başarısız oldu: ']
    ];
    const prefix = prefixes.find(([source]) => key.startsWith(source));
    if (prefix) return `${prefix[1]}${key.slice(prefix[0].length)}`;
    if (key.includes(', ')) {
      const parts = key.split(', ');
      const translated = parts.map((part) => t(part));
      if (translated.some((part, index) => part !== parts[index])) return translated.join(', ');
    }
    if (key.includes(' · ')) {
      const parts = key.split(' · ');
      const translated = parts.map((part) => t(part));
      if (translated.some((part, index) => part !== parts[index])) return translated.join(' · ');
    }
    return key;
  }

  function canTranslateText(node) {
    if (!node.nodeValue || !node.nodeValue.trim()) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    return !parent.closest('script, style, noscript, pre, code, textarea, input, [contenteditable="true"], [data-i18n-skip]');
  }

  function translateTextNode(node) {
    if (!canTranslateText(node)) return;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const key = match ? match[2].replace(/\s+/g, ' ').trim() : source;
    const translated = t(key);
    node.nodeValue = match ? `${match[1]}${translated}${match[3]}` : translated;
  }

  function translateAttribute(element, attribute) {
    if (!element.hasAttribute(attribute)) return;
    let attributes = originalAttributes.get(element);
    if (!attributes) {
      attributes = new Map();
      originalAttributes.set(element, attributes);
    }
    if (!attributes.has(attribute)) attributes.set(attribute, element.getAttribute(attribute));
    element.setAttribute(attribute, t(attributes.get(attribute)));
  }

  function canTranslateAttribute(element, attribute) {
    if (attribute !== 'value') return true;
    if (element.tagName !== 'INPUT') return false;
    return ['button', 'reset', 'submit'].includes((element.getAttribute('type') || '').toLowerCase());
  }

  function apply(root) {
    const target = root || document.body;
    if (!target) return;

    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    translateDocumentTitle();

    // An option without a value inherits its translated text as its functional value.
    // Pin the source value before walking text nodes, including dynamically added options.
    const options = target.querySelectorAll ? [...target.querySelectorAll('option:not([value])')] : [];
    if (target.nodeType === Node.ELEMENT_NODE && target.matches('option:not([value])')) options.unshift(target);
    options.forEach((option) => { option.value = option.textContent.trim().replace(/\s+/g, ' '); });

    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateTextNode);

    const elements = [];
    if (target.nodeType === Node.ELEMENT_NODE) elements.push(target);
    if (target.querySelectorAll) elements.push(...target.querySelectorAll('*'));
    elements.forEach((element) => {
      if (element.matches('[data-i18n]')) {
        element.textContent = t(element.dataset.i18n);
      }
      ['aria-label', 'title', 'placeholder', 'value'].forEach((attribute) => {
        if (canTranslateAttribute(element, attribute)) translateAttribute(element, attribute);
      });
    });
  }

  function translateDocumentTitle() {
    const toolTitle = originalDocumentTitle.match(/^(.+?) — Toolkit$/);
    document.title = toolTitle ? `${t(toolTitle[1])} — Toolkit` : t(originalDocumentTitle);
  }

  function createLanguageControl() {
    const container = document.querySelector('.nav-actions') || document.querySelector('.nav-container');
    const toggle = document.getElementById('navToggle');
    if (!container || document.querySelector('.nav-language')) return;

    const control = document.createElement('div');
    control.className = 'nav-language';

    const trigger = document.createElement('button');
    trigger.className = 'nav-language__trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', t('Language'));
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.title = t('Language');

    const current = document.createElement('span');
    current.className = 'nav-language__current';
    current.textContent = language === 'tr' ? 'Türkçe' : 'English';
    trigger.appendChild(current);

    const menu = document.createElement('div');
    menu.className = 'nav-language__menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', t('Language'));
    menu.hidden = true;

    const options = ['en', 'tr'].map((locale) => {
      const option = document.createElement('button');
      option.className = 'nav-language__option';
      option.type = 'button';
      option.dataset.language = locale;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(locale === language));
      option.textContent = locale === 'tr' ? 'Türkçe' : 'English';
      option.addEventListener('click', () => {
        setLanguage(locale);
        setMenuOpen(false);
        trigger.focus();
      });
      menu.appendChild(option);
      return option;
    });

    function setMenuOpen(open) {
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    }

    function focusOption(direction) {
      setMenuOpen(true);
      const currentIndex = options.indexOf(document.activeElement);
      const nextIndex = currentIndex === -1
        ? options.findIndex((option) => option.dataset.language === language)
        : (currentIndex + direction + options.length) % options.length;
      options[Math.max(0, nextIndex)].focus();
    }

    trigger.addEventListener('click', () => setMenuOpen(menu.hidden));
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(-1); }
      if (event.key === 'Escape') setMenuOpen(false);
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(-1); }
      if (event.key === 'Escape') { setMenuOpen(false); trigger.focus(); }
    });
    control.addEventListener('focusout', () => requestAnimationFrame(() => {
      if (!control.contains(document.activeElement)) setMenuOpen(false);
    }));
    document.addEventListener('click', (event) => {
      if (!control.contains(event.target)) setMenuOpen(false);
    });

    control.append(trigger, menu);
    container.insertBefore(control, toggle || null);
  }

  function setLanguage(nextLanguage) {
    const next = SUPPORTED_LANGUAGES.has(nextLanguage) ? nextLanguage : DEFAULT_LANGUAGE;
    language = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    apply();
    document.querySelectorAll('.nav-language').forEach((control) => {
      const trigger = control.querySelector('.nav-language__trigger');
      const current = control.querySelector('.nav-language__current');
      const menu = control.querySelector('.nav-language__menu');
      if (trigger) {
        trigger.setAttribute('aria-label', t('Language'));
        trigger.title = t('Language');
      }
      if (current) current.textContent = next === 'tr' ? 'Türkçe' : 'English';
      if (menu) {
        menu.setAttribute('aria-label', t('Language'));
        menu.hidden = true;
      }
      control.querySelectorAll('.nav-language__option').forEach((option) => {
        option.setAttribute('aria-selected', String(option.dataset.language === next));
      });
    });
    window.dispatchEvent(new CustomEvent('toolkit:languagechange', { detail: { language: next } }));
  }

  window.ToolkitI18n = Object.freeze({
    t,
    apply,
    getLanguage: () => language,
    setLanguage,
    defaultLanguage: DEFAULT_LANGUAGE,
    storageKey: STORAGE_KEY
  });

  createLanguageControl();
  apply();

  // Translate later-inserted shared controls without touching tool input data.
  const observer = new MutationObserver((records) => {
    const added = new Set();
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) added.add(node);
    }));
    added.forEach((node) => apply(node.nodeType === Node.TEXT_NODE ? node.parentElement : node));
  });
  observer.observe(document.body, { childList: true, subtree: true });
}());
