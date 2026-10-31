# 3D restorasyon Faz 2 — inceleme adayı

31 Ekim 2026. Başlangıç main: 4301ee07939d6e228cb3dc98c07ee0e8dc262666 (PR #14 birleşmesi). Önceki 9741221 restorasyonu korundu. Dal: fix/3d-restoration-phase2. Main'e birleşme, sürüm artışı ve yayın yapılmaz; fiziksel iPhone/Safari görsel onayı beklenir.

## Devre ve ilk kontrol

Devre yerleşiminde fizik saati oyuncuları hareket sınırlarıyla yeni konumlara taşır; maç saati tam 45:00'da durur. Top oyunu, karar, fitness ve sakatlık adımları hazırlıkta çalışmaz. Takımlar bir kez yön değiştirir. Kendi yarıları, rakibin orta yuvarlak mesafesi ve duran santra çifti doğrulanınca gerçek santra pası çıkar; sonraki adım ikinci yarı saatini ilerletir. Hazırlık seçili 3/5/7/10 dakika bütçesini tüketmez, izlemeye bu kadar fizik süresi eklenir. Bitiş tam 90:00'dır.

clock.stoppedTicks kayıt/devam, sona geçme ve laboratuvar bitişinde hesaba katılır. 2D/3D aynı durumu okur. Eski referans checkpoint'lerinin önceki sonucu için uyumluluk yolu korunur; yeni laboratuvar ve doğal maçlar düzeltilmiş davranışı kullanır. Save şeması 5 → 6, eski ham/sıkıştırılmış aktif maçlar korunarak taşınır.

Başarılı ilk temasta topun yüksekliği sıfırlanmaz. Gerçek temas noktası/yüksekliğinden kontrollü dikey hız ve yer çekimiyle iniş başlar; ilk yatay ofset fizik zamanında ayağa yaklaşır. Aynı anda yeniden örneklemek hareket üretmez. Top havadayken pas/sürme/şut seçimi kontrolü silemez. Ayak/göğüs/kafa teması ayrılır; eski chest/header ve gerçek ayak teması kullanılır. İlk kontrol başarısı, özellik ağırlıkları ve hata zarı değişmez; geçiş ek RNG tüketmez.

## Duran toplar

| Durum | Önceki geçici davranış | Bu aday |
|---|---|---|
| Taç | Çizgide kısa rakip pası | Doğru çizgi, 2 m rakip mesafesi, fiziksel yerleşme, iki elle tutuş ve baş üstü bırakma, gerçek throwIn |
| Korner | Yerleşimsiz kısa yeniden başlama | Doğru köşe, kullanan/alıcı, 9,15 m rakip mesafesi, gerçek corner ve mevcut kısa pas |
| Frikik | Geçici kısa pas | Faul noktası, 9,15 m mesafe, yakında en çok üç kişilik baraj, gerçek freeKick ve mevcut kısa pas |
| Penaltı | Top ceza alanı dışına taşınırdı | 11 m noktası, kaleci çizgide; diğer oyuncular alan/yay dışında ve noktanın gerisinde; gerçek penalty ve mevcut şut fiziği |
| Aut | Kalecinin elinden başlama | Kale alanındaki doğru nokta, rakipler alan dışında, ayakla goalKick |
| Santra | Fiziksel hazır kontrolü ve pas | Korundu; ikinci yarı saat duruşu tamamlandı |
| Kaleci dağıtımı | Gerçek throw/punt | Önceki animasyon/elde top zinciri korundu |

Oyuncu kökleri topluca atanmaz; aynı ivme, hız ve dönüş sınırlarıyla yerleşirler. Top yalnız düdükten sonraki hazırlıkta konulur. Kadro değişirse hedefler yenilenir. Gerçek bırakmadan önce açık top/kararlar çalışmaz. Duran top hazırlığı normal maç saati içindedir; yalnız devre yerleşimi durdurulan süreye yazılır.

## Özel hareket envanteri

Eski newview/beats kaynakları ve ACTIONS incelendi. Eski yönetmenin ikinci top/oyuncu çözücüsü çağrılmadı.

| Özellik | Gerçek yeni motor kaynağı | Bağlantı |
|---|---|---|
| Rakibi geçme/çıkış | Mevcut beat geometrisi | Eski cut çıkışı ve koşuya dönüş |
| Ani yön değiştirme | Gerçek karşılaşmada ölçülen heading değişimi | skill/cut, eski sağ/sol cut |
| Vücut çalımı | Ters yön değişimi ve savunmacının önceki yöne gerçek hareketi | skill/bodyFeint, eski sağ/sol feint |
| Dönüş | Gerçek büyük heading değişimi | skill/turn, eski dönüş çıkışı |
| Topu koruma | motionMode:shield | PR #14 shoulder korunur |
| İkili mücadele/omuz/kayma | duel/tackle/grounded | Önceki gerçek tepkiler korunur |
| Yakın kamera | Gerçek skill katılımcıları, son üçüncü bölge | Eski yakın kamera; tackle'ın her ikinci mücadele sayacı korunur |
| Stepover, nutmeg, elastico, cruyff, croqueta, roulette, flairnutmeg, rainbow, sombrero, juggle | Bu farklı top/oyuncu yolları üretilmiyor | Genel sürme bunlarmış gibi etiketlenmedi; açık |
| Backheel/rabona/nolook, bicycle/Panenka/chip, Bergkamp/scorpion, yıldız tekrarı | Yeterli gerçek eylem/yol yok | Yeni sonuç sahnelemesi eklenmedi; açık |

Gözlem topa, oyuncuya, futbol istatistiğine veya RNG'ye yazmaz. Eşlenmiş test, gözlem olayının sonraki fizik/istatistik/RNG'yi değiştirmediğini doğrular. Başarı mevcut fiziksel beat olayından gelir; uydurma rakip düşüşü yoktur. Normal kariyerde de gerçek skill olayı oluşur; ek WebGL sahnesi bu kariyerden alınır.

## Kamera ve önceki restorasyon

PR #14 save.png karesindeki koyu ön alanın kaynağı, tribünün çift taraflı arka kaplamasının altından görülmesidir. Canvas sahneyi doldurur, dış çim geometrisi vardır. Yalnız kaplamanın arka yüzü elendi. Dört gerçek tribün geometrisinde saha tarafından görünürlük korunup altından görünürlük kaldırıldığı ray testiyle doğrulanır; bayraklar çift taraflı kalır. Kamera konumu/FOV/takip/zoom/geçiş formülleri değiştirilmedi.

Korunanlar: Otomatik/Yayın/Yakın/Tribün ve şut kadrajı; duraklamada kamera geçişi; koşu/dönüş/ayak desteği; gerçek sürme dokunuşu ve top dönüşü; kalecinin hazır/uzanma/iniş/destek/kalkış/ikinci kurtarış zinciri; eldeki mesh'in el kemiklerine bağlanması; gol sevinci, takım taraftar fotoğrafı ve bayrak shader'ı; renkli skor, oyuncu ismi/numarası, hücum yönü; aynı maçta 2D/3D, hız, duraklatma ve tam ekran. Yeni gerçek hareket/duran top bildirimleri eklendi.

## Doğrulama ve kanıt

Önce kırmızı regresyonlar yazıldı: match-sim-half-clock, first-control, restart-layout, stadium, dribble-cues ve lab-finish testleri. Duran toplar iki yönde; hazırlıkta hareket/yön sınırları; penaltı dışlamaları; gerçek iki el tutuşu; kayıt/devam ve sona geçme doğrulanır. Önceki 2D/3D eşitlik, kamera, kaleci, atmosfer, golden ve performans testleri korunur.

Son yerel oyun commit'i 1bb3a57 için Node 22.23.4 ile lint, 467 hızlı test ve 5 performans testi geçti; mevcut bir test atlaması vardır. Son laboratuvar/QA değişikliklerinin tam kapıları GitHub Actions'ta doğrulanır. Yerel Chromium eksik ZIP döndürdü; son tam test sırasında çalışma ortamı bağlantısı kesildi. Başarılı tam test veya yerel WebGL sonucu bu durumdan varsayılmaz. Son CI sonuçları PR açıklamasında güncellenir.

CI önceki gerçek WebGL ve 12 kaleci kaydını, ayrıca taç/korner/aut/frikik/penaltı/göğüs/kafa/gerçek kariyer çalımından oluşan sekiz sahneyi çalıştırır. Lint tabanı büyütülmedi, eski golden dosyaları yenilenmedi. İlk kontrol ve geçici duran top kuralları düzeldiği için eski toplu denge snapshot'ı birebir karşılaştırılmaz; mevcut test/smoke/perf kapıları korunur, yeni katsayı taraması veya yedi dakikalık ek izleme açılmaz.

## Açık kalanlar ve Safari kontrolü

Tam özellik eşitliği iddiası yoktur: yukarıdaki isimli özel top yolları/yıldız tekrarı motor desteği ister. Korner/frikik mevcut kısa pası kullanır; yeni orta veya doğrudan frikik tercihi eklenmedi. Bütün kafa/göğüs/ayak temaslarının birebir anatomik hizası ve fiziksel iPhone performansı görsel onay bekler.

1. 3/5/7/10 dakika: devrede hazırlık boyunca 45:00; doğru kale/yön; hazır santra sonrası devam; 90:00 bitiş.
2. Havadan ayak/göğüs/kafa kontrolü; doğal iniş; kontrolün ortasında duraklatma ve kayıt/devam.
3. İki yönlü ani dönüş/vücut çalımı/çıkış, yakın kamera, koruma/omuz/kayma ve koşuya dönüş; 0,5×/1×/2×.
4. Taç/korner/frikik/penaltı/aut: yasal yerleşme ve gerçek bırakma; oyuncu ışınlanması olmasın.
5. Dikey kaleci/çizgi/köşe kadrajında koyu tribün altı; yatay tam ekran.
6. İki yöne alçak/yüksek kurtarış, yerde/ayakta elde top, kalkış, ikinci kurtarış, kısa elle dağıtım ve degaj.
7. Gol sevinci, taraftar fotoğrafı, bayrak, isim, skor/yön; 2D/3D değişiminde aynı saat/skor.
8. Safari akıcılığı ve ısınma; Chromium telefon görünümü bu onayın yerine geçmez.
