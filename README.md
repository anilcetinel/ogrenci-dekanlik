# Öğrenci Dekanlığı

Sakarya Üniversitesi Öğrenci Dekanlığı için iş hafızası, faaliyet takibi, akademik takvim ve evrak yönetimi prototipi.

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
3. Yerelde `.env.example` dosyasını `.env` olarak kopyalayın ve değerleri doldurun:

```bash
VITE_SUPABASE_URL=https://SUPABASE-PROJE-REF.supabase.co
VITE_SUPABASE_ANON_KEY=SUPABASE_ANON_PUBLIC_KEY
VITE_APP_PIN=sau2026
```

4. GitHub Pages yayını için repo ayarlarında şu secret'ları ekleyin:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_APP_PIN
```

5. Daha önce tarayıcıya girilmiş yerel kayıtlar varsa uygulamada `Ayarlar` sayfasından `Yerel Verileri Ortak Alana Aktar` butonunu kullanın.

## Güvenlik Notu

Bu yapı prototip paylaşımı içindir. PIN kapısı gerçek kimlik doğrulama değildir. Gerçek öğrenci adı, T.C. kimlik numarası veya kişisel veri girilmemelidir.
