# AcaTalk — Bilinen Sorunlar

## Kullanım Amacı
Bu dosya projedeki aktif, çözülmüş veya tekrar kontrol edilmesi gereken sorunları takip etmek için tutulur.

## Durum Etiketleri
- ACTIVE → şu anda devam eden sorun
- INVESTIGATING → inceleniyor
- BLOCKED → çözüm dış bir nedene takıldı
- FIXED → çözüldü
- VERIFYING → çözüldü ama tekrar test edilmeli

---

## ISSUE-001
**Başlık:** AI fonksiyonlarında “servis çalışmıyor” benzeri hata  
**Durum:** INVESTIGATING  
**Öncelik:** Yüksek  
**Alan:** Supabase Edge Functions / Frontend entegrasyonu  

**Belirti:**  
Frontend tarafında AI ile ilgili işlemlerde hata gösteriliyor.

**Bilinenler:**  
- Edge function bazı durumlarda 200 dönebiliyor
- Sorun yalnızca backend değil, frontend hata yönetiminde de olabilir
- ANTHROPIC_API_KEY, model adı veya response parsing tarafı etkili olabilir

**Kontrol Edilmesi Gerekenler:**  
- İlgili edge function kodu
- Frontend bu fonksiyonu nasıl çağırıyor
- Response formatı
- Supabase function logları
- Secret tanımları
- Hata yakalama ve kullanıcıya gösterilen mesajlar

**Denenenler / Notlar:**  
- Error logging artırıldıysa log tekrar incelenmeli
- Model string ve env doğrulanmalı

**Sonraki Adım:**  
Fonksiyon çağrısını uçtan uca test et ve frontend-backend veri akışını doğrula.

---

## ISSUE-002
**Başlık:** GitHub repo / gerçek kaynak kod durumu belirsiz  
**Durum:** INVESTIGATING  
**Öncelik:** Kritik  
**Alan:** GitHub / Vercel / genel workflow  

**Belirti:**  
Repo, branch, local kopya ve deploy edilen kod arasında tutarsızlık olabilir.

**Bilinenler:**  
- GitHub tarafının güncelliği mutlaka doğrulanmalı
- Vercel canlı deploy alıyor olabilir ama repo aynı durumda olmayabilir
- Edge function kodları repo dışında güncellenmiş olabilir

**Kontrol Edilmesi Gerekenler:**  
- GitHub repo içeriği
- Branch listesi
- Son commit tarihi
- Local kopya var mı
- Vercel’in hangi branch/repo’dan deploy aldığı
- Repo içindeki supabase/functions ile canlıdaki function’ların eşleşmesi

**Risk:**  
Kod kaybı, yanlış sürümle çalışma, bağlam bozulması

**Sonraki Adım:**  
Repo ve deploy kaynaklarını eşleştir, sonra tek kaynak yapısı kur.

---

## ISSUE-003
**Başlık:** Edge function kodları ile repo senkronu net değil  
**Durum:** ACTIVE  
**Öncelik:** Yüksek  
**Alan:** Supabase / GitHub  

**Belirti:**  
Supabase’e deploy edilmiş function kodları ile repodaki kod aynı olmayabilir.

**Bilinenler:**  
- MCP/panel üzerinden deploy edilen function’lar repo dışında kalmış olabilir
- Bu durum versiyon takibini zorlaştırır

**Kontrol Edilmesi Gerekenler:**  
- Her function’ın repoda karşılığı var mı
- En güncel sürüm repoya işlendi mi
- Deploy sonrası repo güncelleniyor mu

**Hedef Çözüm:**  
Edge function kodlarını repoda ana kaynak haline getirmek

**Sonraki Adım:**  
Tüm function’ları listele, repo ile karşılaştır, eksikleri tamamla.

---

## ISSUE-004
**Başlık:** Bağlam kaybı ve sohbetten sohbete tekrar ihtiyacı  
**Durum:** ACTIVE  
**Öncelik:** Orta  
**Alan:** Proje yönetimi / AI workflow  

**Belirti:**  
Her yeni sohbette aynı bilgiler tekrar anlatılıyor.

**Bilinenler:**  
- PROJECT_CONTEXT.md hazır
- Ama tek başına yeterli olmayabilir
- Ek bağlam dosyaları gerekiyordu

**Çözüm Yönü:**  
- PROJECT_CONTEXT.md
- WORKFLOW.md
- DEPLOYMENT.md
- KNOWN_ISSUES.md

birlikte kullanılmalı.

**Sonraki Adım:**  
Bu dosyaları project knowledge içine yükle ve güncel tut.

---

## ISSUE-005
**Başlık:** Deployment süreci kısmen manuel ve yorucu  
**Durum:** ACTIVE  
**Öncelik:** Orta  
**Alan:** GitHub / Vercel / Supabase  

**Belirti:**  
Her değişiklikte sync, deploy veya doğrulama kısmı manuel efor gerektiriyor.

**Muhtemel Nedenler:**  
- Net workflow yok
- Repo tek kaynak değil
- Edge function deploy akışı ayrı yaşıyor
- Değişiklik sonrası kontrol listesi yok

**Hedef Çözüm:**  
Daha net commit → push → deploy → verify düzeni kurmak

**Sonraki Adım:**  
Önce mevcut akışı belgeleyip sonra sadeleştirmek

---

## Çözülmüş / Kontrol Edilecek Sorunlar

### ISSUE-006
**Başlık:** verify_jwt ayarları  
**Durum:** VERIFYING  
**Öncelik:** Düşük  

**Not:**  
Fonksiyonlar için verify_jwt ayarlarının beklenen şekilde düzenlendiği belirtiliyor. Ama gerçek deploy durumuyla tekrar doğrulanmalı.

---

### ISSUE-007
**Başlık:** vercel.json SPA routing  
**Durum:** VERIFYING  
**Öncelik:** Düşük  

**Not:**  
Routing sorununun çözüldüğü belirtiliyor. Production davranışı tekrar doğrulanmalı.

---

### ISSUE-008
**Başlık:** Auth redirect URL  
**Durum:** VERIFYING  
**Öncelik:** Düşük  

**Not:**  
Ayarlamanın yapıldığı belirtiliyor. Giriş/çıkış ve redirect akışı test edilmeli.

---

## Güncelleme Kuralı
Her sorun için aşağıdakiler güncellenmeli:
- durum
- öncelik
- son not
- sonraki adım

## Not
Bu dosya yaşayan bir dokümandır. Sorunlar çözüldükçe kaldırmak yerine durumları güncellenmelidir.