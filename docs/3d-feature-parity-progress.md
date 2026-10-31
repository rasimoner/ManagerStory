# 3D özellik eşitliği — ilerleme ve deneme kaydı

Başlangıç: `5c201ea439fc0d57c0006683a07b51a07e08559c`, V7.19.2.
Dal: `fix/3d-complete-feature-parity`. Main/yayın değiştirilmeyecek.

Bir deneme, bir çözüm yaklaşımının uygulanması + ilgili kabul doğrulamasıdır. Test yazma/teşhis deneme değildir. Aynı kabul maddesi yeniden adlandırılarak sayaç sıfırlanmaz. Başarısız yaklaşım ve bulgu burada tutulur; iki başarısızlıktan sonra yalnız o maddenin ürün değişiklikleri geri alınır. Açık yeniden üretmeler `tests/reproductions/` altında, varsayılan paketten ayrı tutulur.

| Kimlik | Sabit kabul kapsamı | Durum | Deneme | Kanıt / bağımlılık |
|---|---|---|---:|---|
| P1 | Dar alanda tekrarlı dönüş; iki yön/süre/kayıt | ikinci deneme başarısız | 2/2 | Ürün geri alındı; tests/reproductions/turn-release.cjs |
| P2 | Doğrudan frikik kararı, fizik, hazırlık, baraj, kamera | doğrulama bekliyor | 0/2 | Mevcut `restart-release` yalnız kısa pas |
| P3 | Korner/açık oyun ortası ve gerçek kafa/vole/röveşata | doğrulama bekliyor | 0/2 | Kafa kontrolü bitiriş sayılmayacak |
| P4 | İsimli özel çalımlar; gerçek temas ve savunma | doğrulama bekliyor | 0/2 | Eski beats var; ikinci simülasyon kullanılamaz |
| P5 | Özel pas/ilk kontrol/aşırtma/Panenka | doğrulama bekliyor | 0/2 | Eski sekanslar koddan karşılaştırılacak |
| P6 | Scorpion ve eski özel kaleci hareketleri | doğrulama bekliyor | 0/2 | Normal kaleci zinciri korunacak |
| P7 | Ofsayt konumu/katılım/istisnalar/düdük/yeniden başlama | doğrulama bekliyor | 0/2 | Yeni motorda kural bulunmuyor |
| P8 | Diğer duran toplar, devre, 90:00, kamera/sunum koruması | doğrulama bekliyor | 0/2 | Önceki çalışmayı yeniden uygulamadan regresyon doğrulaması |
| P9 | Eski gerçek yıldız tekrarı ve sınırlı salt okuma kayıt | doğrulama bekliyor | 0/2 | `newview/replay.js` gerçek kariyer kaydı; prototip ayrı |
| P10 | Denge, performans, WebGL ve zorunlu teslim kapıları | doğrulama bekliyor | 0/2 | Aynı tohumlu önce/sonra ölçümü; fiziksel Safari mevcut değil |

## Altyapı

Depo klonu ve `npm ci` ilk girişimde başarılı. Video yerelde ve kareleri incelendi. Kullanıcının 56:42–60:00 bulgusu, yaklaşık 57:07 ve 59:15 karelerinde aynı dar alandaki Okoro olarak gözleniyor. Bu gözlem motor kök nedeni veya kayıt tohumu değildir.

## P1 — iki deneme sınırı doldu

1. Seçilmiş sürme koridoruna vücut hizalanana kadar dokunuşu bekletme: yeni iki yön/dört süre testinin 9/9'u geçti; mevcut kalecinin ayakla sürme testi taşıma niyetinin kaybolduğunu gösterdi. Başarısız.
2. Taşıma niyetini dokunuştan önce oluşturma, dokunuş zamanını temas gelene kadar boş bırakma: aynı testin ilk kontrolü düzeldi; serbest top uzakta olduğunda kalecinin gerçek topu kovalama regresyonu kaldı. Başarısız.

Yalnız P1 ürün değişikliği (`dribbling.js`) geri alındı. Varsayılan paketi kırmayan açık yeniden üretme: `node --experimental-vm-modules --disable-warning=ExperimentalWarning --test tests/reproductions/turn-release.cjs`. İlk başsız örnek: seed 9, home-LW, ~177–185 fizik saniyesi. Kullanıcı videosunun orijinal checkpoint/seed'i yok; video ile birebir aynı karar dizisi kanıtlanmadı. Erken/ters yöne dokunuş yeniden üretildi; videodaki bütün döngünün tek kök nedeni olduğu iddia edilmez. Normal sürme/kaleci ürünü korunur. Özel çalımların otomatik seçiminde bu kilitlenme giderilmiş sayılmayacak.

## P2 — frikik

İlk yaklaşım: deterministik mesafe/açı/teknik tercihi, gerçek koşu, mevcut şut/parabol, baraj ve kaleci. Yakın iki yön, uzak/dar açı/düşük teknik, koşuda kayıt/devam ve dikey/yatay kadraj testleri geçti. İlk kadraj testinde testin camera matrixWorld güncellemesi eksikti; bu test altyapısı düzeltildi, ürün kamera formülleri değiştirilmedi.

Tamamlama: barajın gecikmeli fiziksel sıçrama zarfı ve altından geçme, vuruş karesinde gerçek ayağa IK bağlantısı. Gerçek rig teması ve baraj çarpışma testleri geçti. Falso eklenmedi: mevcut doğrusal yatay/parabolik dikey uçuşta doğrudan vuruşlar hesaplanır; bu aşamada falso gerektiren uçuş seçilmez. Uygun servis seçeneği P3 ile ortaklaştırılacak. Genel frikik maddesi henüz bütün görsel kanıtlarıyla tamamlandı sayılmıyor.

Altyapı: varsayılan Node 24 eski golden sonuçlarını değiştiriyor; Node 22.23.4 edinildi. Node 22 hızlı pakette yalnız yeni JSON belgesinin eksik başlığı yakalandı ve belge eklendi; golden yenilenmedi. Yerel Playwright indirmesi eksik ZIP döndürüyor; otomatik iç tekrar yapan yükleyici durduruldu. Aynı indirme tekrar başlatılmayacak.
