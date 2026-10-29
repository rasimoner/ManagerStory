# Kısa maçlarda hücum akışı

30 Ekim 2026 · Başlangıç main `ef392c6` (V7.16.0) · Dal `feat/short-match-flow` · Node 22.23.4.

## Başlangıç ölçümü

Mevcut `equalDurationInput`, `measureDurationMatch`, `summarizeDurationRuns` araçları kullanıldı. Eşit kadrolar, kondisyon/sakatlık açık, 420 fizik saniyesi; tohumlar önce seçildi ve sabit tutuldu: `901,731,42,2026,508,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15`.

| İki takım toplamı / maç | Önce | Sonra |
|---|---:|---:|
| Şut | 1,10 | 7,55 |
| Gol | 0,20 | 0,70 |
| Golsüz maç | 16/20 (%80) | 10/20 (%50) |
| xG | 0,1020 | 0,7082 |
| Pas isabeti | %77,57 | %71,96 |

Önce ve sonra 20/20 maçta günlük/sayaç/kariyer gol, kart, asist ve dakika tutarlılığı doğrulandı. Pas isabeti toplam tamamlanan / çözülen pastır; oyuncu ortalamalarının ortalaması değildir. Tohum başına küçük ölçüm tablosu: [match-sim-short-flow.json](measurements/match-sim-short-flow.json).

## Neden ve dar kapsam

Sürme puanında güvenli bölgede fazla kalmanın getirisi ileri alanı değerlendirmeyi bastırabiliyor. Pas ve sürme arasında ilerleme değeri aynı ölçekte değil. İki destek hedefi de topun arkasında; top sahibi ileri hat oyuncusu derin koşuya seçilirse ayrı bir ileri alıcı kalmayabiliyor.

Önce yazılan testte altı hücum beklentisi başarısız, savunma ve referans koruma kontrolleri başarılıydı. Uygulamadan sonra sekiz kontrol geçti: iki yönde ileri alan/pas, iki dizilişte ayrı derin koşu ve destekler, gerçek kesme, dört sürede aynı fiziksel karar ve eski referans kararı.

Üç dar değişiklik uygulandı:

1. Sürmede ilerleme, hücum kalesine gerçek mesafenin azalmasıdır; yalnız kale çizgisine yaklaşmak değildir. Güvenli varış farkının pozitif puan katkısı 0,5 saniyede doyar; negatif farkın bütün maliyeti korunur. Kale mesafesi kazancının metre başına puanı 1,2 olur.
2. Yalnız görülebilen, ulaşılabilen ve mevcut kesilme hesabından güvenli çıkan paslara aynı kale mesafesi kazancı ×1,2 eklenir. Çıkış anındaki güvenlik kontrolü ve gerçek pas uygulaması aynen kalır.
3. Top sahibi/taşıyıcı topsuz rollerden çıkar; ayrı ileri hat oyuncusu derine koşar. Desteklerden biri topun 10 m önünde, diğeri mevcut 8 m gerisinde açı kurar. Ortak takım zarfı ve gerçek koşu korunur.

Katsayılar `balance.json.shortMatchFlow` içindedir. Değişiklik yalnız `clock.model:"natural"` kararlarında etkilidir; dört süre için aynı davranıştır. Şut/kaleci, oyuncu/top hızı, saha, yorgunluk, saatler, RNG, kayıt biçimi ve eski motor değiştirilmedi. Yeni durum alanı veya raporlama altyapısı eklenmedi. Referans modelde eski kararlar korunur.

3/5/10 dakika için aynı tek tohumla (901) işlev kontrolü: sırasıyla 1.800/3.000/6.000 adım; 180/300/600 fizik saniyesi; üçünde de 5.400 maç saniyesi, son düdük ve gerçek kariyer/sayaç tutarlılığı. Ayrı denge taraması yapılmadı. Yalnız ilk aday ölçüldü; sonuç kotası veya tekrar tekrar ayar yok.

## Açık sorunlar

20 maç küçük bir örneklemdir; tam futbol dengesi iddiası değildir. Golsüzlük hâlâ %50, gol ortalaması 0,70; pas isabeti 5,61 yüzde puan düştü. Bütün taktiklerin tamamlanması, ofsayt/gerçek duran toplar ve 3D ayrı işlerdir. Fiziksel iPhone/Safari görsel onayı kullanıcı denemesine kalır; uzun gerçek zamanlı izleme ve video bu işte çalıştırılmaz.

## Başlangıç doğrulaması

Değişmemiş main üzerinde Node 22.23.4 ile lint ve hızlı paketin işlev testleri geçti. Ayrı performans dosyasında iki mevcut 2 sn kapısı başarısız: şut/kaleci ve kondisyonlu tam referans maçlar. Kondisyonlu koşular 2.661 / 2.335 / 1.695 ms. Eşikler ve testler korunuyor; bu ortam sorunu uygulamanın başarısı gibi gösterilmeyecek. Başlangıç ölçümünü erken kaydetmek için başarısız hız kapısı bu belge commit'inde açıkça belirtilir.

## Aday doğrulaması

Node 22.23.4: lint temiz; hızlı işlev paketi 391 başarılı / 1 mevcut atlama / 0 başarısız; build başarılı. Ayrı performans dosyasında 4/5 başarılı; kalan kondisyonlu referans maç kapısı 1.663 / 1.588 / 2.381 ms ile yerelde başarısız. Eşik değiştirilmedi; tam test ve duman için GitHub Node 22 doğrulaması beklenecek.

Mevcut bekleyen oyuncu değişikliği testi 120. saniyede açık oyun varsayıyordu; daha sık hücum bu anı bir duruşa taşıdı. Test şimdi gerçek açık oyuna ilerler, onu doğrular; iki kez istenen değişikliğin tek bekleyen istek olması ve kullanıcıya bekleme açıklaması aynen denetlenir. Test veya beklenti kapatılmadı.

CI'da yalnız `feat/short-match-flow` için ek 50/güç ve beş süre ×50 ölçümü ile ayrı uzun 1× izleme çalıştırılmaz; kullanıcı bu işte 20 tohum ve kısa işlev kontrolleri istedi. Lint, hızlı/tam test, performans bütçeleri, build ve bütün mevcut duman kontrolleri korunur. Diğer dalların varsayılan kapsamı değişmez. Birleşme/yayın henüz yapılmadı.
