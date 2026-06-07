# Öğrenci Destek Koordinatörlüğü

Sakarya Üniversitesi Öğrenci Destek Koordinatörlüğü için iş hafızası, faaliyet takibi, akademik takvim ve evrak yönetimi prototipi.

## Yerel Çalıştırma

```bash
npm install
npm run dev
```

## Ortak Veri Kurulumu

Uygulama Supabase ayarları yoksa `localStorage` ile çalışır. Her kullanıcı kendi tarayıcısındaki kayıtları görür.
Herkesin aynı kayıtları görmesi için Supabase bağlantısı tanımlanmalıdır.

1. Supabase üzerinde yeni proje oluşturun.
2. SQL Editor içinde `supabase-schema.sql` dosyasındaki SQL'i çalıştırın.
3. Büyük PDF/Word/Excel dosyalarının ortak indirilebilir kalması için SQL Editor içinde `supabase-storage.sql` dosyasındaki SQL'i de çalıştırın.
4. Yerelde `.env.example` dosyasını `.env` olarak kopyalayın ve değerleri doldurun:

```bash
VITE_SUPABASE_URL=https://SUPABASE-PROJE-REF.supabase.co
VITE_SUPABASE_ANON_KEY=SUPABASE_ANON_PUBLIC_KEY
VITE_ADMIN_PIN=sadece-sizin-bileceginiz-yonetici-kodu
VITE_VIEWER_PIN=5-kisiyle-paylasilacak-izleyici-kodu
VITE_SUPABASE_FILE_BUCKET=dekanlik-files
```

5. GitHub Pages yayını için repo ayarlarında şu secret'ları ekleyin:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_ADMIN_PIN
VITE_VIEWER_PIN
VITE_SUPABASE_FILE_BUCKET
```

6. GitHub Actions deploy tamamlandıktan sonra uygulamada `Ayarlar` sayfasına girin.
7. Önce `Ortak Veri Bağlantısını Test Et` butonunu kullanın. Test başarılıysa kayıtlar farklı tarayıcılarda ortak görünür.
8. Büyük dosya paylaşımı için `Storage Bağlantısını Test Et` butonunu kullanın.
9. Daha önce tarayıcıya girilmiş yerel kayıtlar varsa `Yerel Verileri Ortak Alana Aktar` butonunu kullanın.

## Dosya Saklama Mantığı

Supabase Storage hazırsa PDF, Word, Excel ve metin dosyaları `dekanlik-files` bucket alanına yüklenir ve Evraklar ekranında indirilebilir bağlantı oluşur.
Storage hazır değilse uygulama kaydı bozmaz: küçük dosyalar kayıt içine gömülür, büyük dosyalarda dosyadan çıkarılan özet/metin saklanır.

## Erişim Mantığı

`VITE_ADMIN_PIN` ile giren kullanıcı kayıt ekleyebilir, düzenleyebilir ve silebilir.
`VITE_VIEWER_PIN` ile giren kullanıcı yalnızca kayıtları görüntüler.

## Güvenlik Notu

Bu yapı prototip paylaşımı içindir. PIN kapısı gerçek kimlik doğrulama değildir. Gerçek öğrenci adı, T.C. kimlik numarası veya kişisel veri girilmemelidir.
