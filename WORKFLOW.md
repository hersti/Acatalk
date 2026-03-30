# AcaTalk — Çalışma Kuralları

## Amaç
Bu dosya, projede AI asistanının nasıl çalışması gerektiğini tanımlar. Amaç daha az tekrar, daha az varsayım, daha düzenli analiz ve daha sürdürülebilir geliştirme akışı sağlamaktır.

## Genel Çalışma İlkeleri
- Daima Türkçe konuş.
- Doğrulamadan kesin konuşma.
- Önce analiz et, sonra öner.
- Gerekmedikçe soru sorma.
- Kritik belirsizlik varsa bunu açıkça belirt.
- Sorunları varsayma; mümkünse dosya, log, config veya kod üzerinden doğrula.
- Aynı konu daha önce çözülmüşse tekrar baştan açıklatma.
- Gereksiz araç, servis veya ücretli çözüm önermemeye çalış.
- Mevcut stack ile çözüm üretmeyi önceliklendir.

## Cevaplama Biçimi
Her teknik konuda mümkünse şu sırayla ilerle:
1. Mevcut durum özeti
2. Kesin bilinenler
3. Doğrulanması gerekenler
4. Ana problemler
5. Önerilen çözüm
6. Adım adım uygulanacak plan

## Kod İnceleme Kuralları
- Kod istemeden önce hangi dosyaların gerektiğini net söyle.
- Tüm projeyi körlemesine yorumlama; ilgili dosyaları baz al.
- Sorunu dosya bazlı incele.
- Gerekirse hangi dosyada neyin değişeceğini açıkça belirt.
- Değişiklik önerirken:
  - hangi dosya değişecek
  - ne eklenecek / silinecek / taşınacak
  - neden yapılacak
  - olası yan etkiler
  yaz.

## Mimari ve Refactor Kuralları
- Önce çalışan sistemi bozma riskini değerlendir.
- Büyük refactor önermeden önce mevcut yapının darboğazlarını tespit et.
- Refactor önerilerini şu şekilde ayır:
  - hemen gerekli
  - yakında yapılmalı
  - opsiyonel iyileştirme

## Hata Çözme Kuralları
Bir hata incelenirken şu akış izlenmeli:
1. Hata nerede görülüyor?
2. Beklenen davranış ne?
3. Gerçek davranış ne?
4. Muhtemel sebepler neler?
5. Hangi dosyalar/loglar kontrol edilmeli?
6. En olası sebep hangisi?
7. En düşük riskli çözüm ne?

## Deployment ve Sync Kuralları
- GitHub, Vercel ve Supabase ilişkisini varsayma; önce mevcut bağlantı durumunu kontrol et.
- Repo durumu doğrulanmadan “repo boş”, “senkron bozuk”, “deploy olmuş” gibi kesin ifadeler kullanma.
- Frontend ve edge function tarafını ayrı ama ilişkili değerlendir.
- Kodun tek kaynak noktası olmasına dikkat et.
- Repo dışında kalmış kritik kod varsa bunu risk olarak belirt.

## Dosya Talep Kuralları
Soruna göre yalnızca gerekli dosyaları iste:

### Frontend sorunuysa
- ilgili page/component
- ilgili hook
- ilgili lib/api çağrısı
- varsa ilgili types dosyası

### Supabase sorunuysa
- ilgili edge function
- ilgili migration veya tablo bilgisi
- ilgili query/policy
- frontend çağıran kod

### Deploy sorunuysa
- vercel.json
- package.json
- env değişken listesi
- deploy logu
- edge function deploy bilgisi

### Mimari sorunsa
- klasör yapısı
- package.json
- src yapısı
- supabase/functions yapısı
- önemli config dosyaları

## Yeni Özellik Eklerken
Yeni feature istenirken şu formatta ilerle:
1. Özelliğin amacı
2. Etkilenen alanlar
3. Gerekli dosyalar
4. Veri akışı
5. UI akışı
6. Riskler
7. Uygulama sırası

## Çıktı Kalitesi
- Gereksiz uzun yazma.
- Ama yüzeysel de kalma.
- Teknik ama uygulanabilir ol.
- Belirsiz yerlerde açıkça “bu doğrulanmalı” de.
- Gereksiz tekrar yapma.

## Güncelleme Disiplini
Büyük değişikliklerden sonra şu dosyaların güncellenmesi gerektiğini hatırlat:
- PROJECT_CONTEXT.md
- DEPLOYMENT.md
- KNOWN_ISSUES.md

## Yasaklar / Kaçınılacak Şeyler
- Doğrulamadan kesin yargı
- Tüm sistemi görmeden büyük varsayım
- Gereksiz tool/servis kalabalığı
- Kullanıcıyı aynı bağlamı tekrar tekrar vermeye zorlamak
- Kod görmeden aşırı özgüvenli teşhis