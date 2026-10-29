# Faz 4 — Kariyer bağlantısı

29 Ekim 2026 · Taban `854f020` · Dal `feat/match-sim-career` · Node 22.23.4.

## A — Skor kuyruğunun teşhisi

Önce tanı aracının testi kırmızı çalıştırıldı, sonra olay çözümlemesi eklendi. `npm run sim:report -- --output docs/measurements/match-sim-career-tail.json` aynı 50 tohumu yeniden oynatır. Yeni ham dosya, dokuz yüksek skorlu maçtaki **52 golün her biri için önceki 30 saniyenin bütün olaylarını**, son santradan geçen zamanı ve önceki gole uzaklığı içerir. Motorun sayıları ve RNG sırası değiştirilmedi; 50 skor ve bütün istatistik sayaçları Denge 1'in kaydedilmiş sonucuyla birebir karşılaştırıldı ve aynı çıktı.

| Toplam gol | Denge 1 | Teşhis sonrası |
|---|---:|---:|
| 0 | %6 | %6 |
| 1 | %32 | %32 |
| 2 | %26 | %26 |
| 3 | %16 | %16 |
| 4 | %2 | %2 |
| 5+ | %18 | %18 |
| Ortalama | 2,44 | 2,44 |

Yüksek skorlu tohumlar: 2026 (3–3), 4 (3–4), 6 (3–2), 10 (3–2), 16 (5–3), 29 (1–4), 31 (3–2), 37 (2–3), 46 (3–3). Goller arası en kısa süre **46,27 sn**, medyan **693,36 sn**; 60 sn altındaki tek çift tohum 29'dadır. **Son santradan sonraki 30 sn içinde gol yoktur.** Santrada kayıp → gol → aynı santra kaybı biçiminde kendini besleyen bir döngü gözlenmedi. Başlama kuralı oyuncuların kendi yarısına gerçek hareketle dönmesini bekler; gol sonrası rolleri/kararları yeni sahiplik fazı yeniden üretir. Bu maçların yalnız biri kırmızı kartlıdır (46); başlangıç motorunda kondisyon tüketimi henüz bulunmadığından yorgunluk birikmesi bu dağılımı açıklayamaz.

**Somut zayıflık kaleci çıkışıdır:** bu 52 golün yedisinin önceki 30 sn'sinde gol yiyen kalecinin dağıtımı vardır. Beşi başarısız dağıtımın **0,69–1,20 sn** sonrasında, kaleciden yalnız **0,26–5,87 m** uzakta rakip kontrolüyle gelir. Tohum 16'da üç örnek vardır. Diğer iki çıkış takım arkadaşına ulaşmış, hücum daha sonra topu kazanmıştır. Mevcut kaleci alıcıyı güvenlik yerine tercih edilen mesafeye göre seçer; taşıma yüksekliğinden çıkan topun ilk alçak kısmı yakındaki rakibe açıktır. Bu aynı santra/yeniden başlama durumunun bozulup kalması değil, çıkış seçimi ve alçak çıkış geometrisinin tekrar eden zayıflığıdır. Topu rakibe ulaştıran fizik, günlüğe uygun çalışmaktadır. Bu işte oyuncuya dokunulmazlık, sonuç kotası veya daha yüksek çıkış eklenmedi; güvenli kaleci çıkışı ve dar açı kalibrasyonu son denge işine açık madde olarak bırakıldı. Bu bulgu kuyruğun tek nedeni olduğu iddiası değildir.

Geçici çizgi duruşları 52 golün 18'inin penceresinde bulunur; tek taraflı tekrarlı faul/çizgi döngüsü görülmedi (yalnız bir faul). Goller çoğunlukla birkaç dakikalık açık oyunlarla ayrılır. Poisson varsayımı, farklı konum/şut kalitelerindeki ve birbirine bağlı ataklardaki varyansı açıklamak için yeterli değildir; örneklemdeki kopukluk gizlenmedi ve **denge sorunu kapanmış sayılmadı**.

Önce/sonra gol 2,44; şut 18,14; isabet 9,14; xG 2,336; xG/şut 0,1288; kurtarış %73,30; faul 10,62; sarı 2,68; pas 776,02. Önceden hedef dışında olan faul ve 5+ oranları hâlâ açıktır. Bu A adımı davranış değiştirmediği için yeni bir hedef sapması yoktur.

## B–C — Kariyer bağlantısı

Deneysel anahtar varsayılan kapalıdır; eski motor/3D ve diğer lig maçlarının `simAIGame` yolu korunur. Kayıt göçü 3 → 4 eski kariyerlere kapalı anahtar ekler. `src/core/sim/` kariyeri bilmez; saf girdi/olay/reyting adaptörü `core/match/`, kariyer köprüsü `core/engine/` içindedir. Gerçek XI/yer/rol, rakip oyuncular, `gk`, kondisyon ve `matchSeed()` kullanılır. Gol/asist/kart/dakika mevcut `matchEvent` kancalarından; sonuç, tablo, gazete ve sezon aynı mevcut akıştan geçer.

Komutlar tek takıma taktik/diziliş, bireysel talimat, motivasyon ve duruşta değişikliktir. Manuel duraklatma futbol duruşu sayılmaz. Kırmızı görenin yerine oyuncu alınmaz; sakat çıkan oyuncu sahaya dönmez ve `M.requiredSubstitution` akışı işler. RNG konumu, karar önbellekleri, bekleyen değişiklik ve bütün motor durumu JSON'dan aynı gelecekle devam eder. Yarıda kaydet/yükle → 90 dakika karşılaştırması olaylar, oyuncu istatistikleri ve kariyer sayaçları için birebir testlidir.

Kondisyon B'nin eski motora yakın bitirme şartı için kalibre edildi. İlk maçta en az 80 dakika oynayanların ortalaması yeni motorda **82,10**, eski örnekte **82,31**. Saha oyuncusu zaman/mesafe/sprint/mücadele tüketimi ve kalecinin ayrı zaman tüketimi JSON'dadır. Laboratuvarın tüketimsiz Denge 1 yolu değişmez. Sakatlık sezon örneğinde iki takım toplamında 10/34 ve 6/34; eski motorun yaklaşık 0,135 kullanıcı sakatlığı/maç düzeyine yakın, az örneklemli bir ölçümdür.

Kayıtta aktif motor ve olaylar kayıpsız sıkıştırılır; aynı dakika olayları olay kimliklerine bağlanır. Tamamlanan deneysel özetler de sıkıştırılır ve açılışta eski nesne biçimine geri gelir. Otomatik sıkıştırma Worker'da yapılır; eski bir Worker yanıtı yeni kullanıcı kaydını ezemez. Durdur/komut/kapanış için açık kayıt aynı anda tamamlanır. 33 arşivlenmiş özet + aktif tam maçın 5 MiB UTF-16 bütçesi testle korunur; kota hatası mevcut açık kayıt uyarısını verir.

## D — Kesintisiz değişken hızlı 2D

Kapsam güncellemesi mevcut A–C'nin üzerine uygulandı. Önceki 22 sn tamponlu aday git checkpoint'inde korunur; yayınlanan yaklaşım değildir. **Motor zamanı ile ekranda gösterilen zaman eşittir.** Önden oynanmış gelecek yoktur. Her 0,1 sn fizik adımı hesaplanır; sakin bölümler de saha gizlenmeden izlenir. Hız değişikliği yalnız gösterimdedir: sakin 32×, yaklaşma 12×, tehdit 3×, şut/önemli olay 1×, yeniden başlama 8×. Düğmeler bu hızları 0,5/1/2 ile çarpar. Yavaşlama 0,18 sn, hızlanma 0,8 sn üstel geçiştir. Komut tam görülen adımda; değişiklik o andan sonraki ilk gerçek duruşta uygulanır.

### Süre ve performans

| Ölçüm | Sonuç |
|---|---:|
| Node 22 sabit 100 ms gösterim saatli 1× prova | **447,1 sn = 7 dk 27,1 sn** |
| Provanın ortalama oyun/gösterim hızı | **12,08×** |
| Provanın hesaplanan fizik adımı | **54.000 / 54.000** |
| Provanın bütçesi dolan kare | **0** |
| Çekirdekte başsız 90 dk, üç yerel Node 22 koşusu | **1.114 / 1.282 / 1.097 ms** |
| Gerçek tarayıcıda tam 1× izleme, 390×844, 4× CPU yavaşlatma | CI ölçümü bekleniyor |

447,1 sn gerçek duvar saatiyle beklenen telefon ölçümü değildir: test saatinin toplamıdır. Tarayıcı dumanı gerçekten maç boyunca bekler; duvar süresi, kare aralıkları, fazlar ve kayıt boyutunu ayrı JSON'a yazar. 6–10 dakika sınırına uymayan sonucu hata olarak gösterir. Yalnız gösterim hızı ayarlanabilir; bu hedef için futbol fiziği/olay sıklığı/denge değiştirilmedi. Adaydaki yaklaşık 63–68 kondisyonun 82 civarına düzeltilmesinin gerekçesi B'nin kondisyon şartıdır.

Kare başına motor için yaklaşık 7 ms uyarlanan bütçe vardır. Yavaş cihazda kalan fizik adımları sonraki karelere yayılır; zaman atlamak yerine maç uzar. Telefon görünümü kulüp renkleri, numaralar, top/sahip vurgusu ve kısa olay metni içerir. Sakin bölüm 32× olduğundan tek tek paslar takip edilemez; tehlikeli bölüm yavaşlar. Şut uçuşu çok kısaysa yavaşlamanın üstel geçişi ilk teması tamamen gerçek hızda göstermeyebilir. Bu önden hesaplama/geri sarma olmadan kalan sınırlamadır. Chromium CPU emülasyonu gerçek Android/iPhone/Safari veya ısınmış düşük donanım kanıtı değildir; fiziksel telefon denemesi ayrıca gerekir.

## Bir sezonluk deney

Ham sonuç: [match-sim-career-season.json](measurements/match-sim-career-season.json). Komut: `npm run sim:career-report`. Node 22.23.4; aynı kariyer, sabit `matchSalt=73`; 34 kullanıcı lig maçı yeni motorda, diğer maçlar mevcut kariyer `simAIGame` akışında. Transfer yok; sakatlıkta ilk uygun yedek, haftalık mevcut dinlenme (+12) ve kondisyon (+4) kararları var. Taktik/rotasyon optimizasyonu yapılmaz. Güç deneyinde her maçın motor girdisindeki kullanıcı özelliklerine ve `gk` alanlarına +10 (tavan 100) uygulanır; fitness bu artışa dahil değildir.

| 34 maç | Mevcut kadro | +10 özellik |
|---|---:|---:|
| Galibiyet / beraberlik / mağlubiyet | 10 / 6 / 18 | 25 / 8 / 1 |
| Sıra / puan | 17. / 36 | 1. / 83 |
| Atılan / yenilen gol | 61 / 74 | 117 / 36 |
| Maç başına iki takım toplam gol | **3,97** | **4,50** |
| Oyuncu maç reytingi ortalaması | 6,68 | 6,95 |
| Reyting 8+ / 5 altı | 26 / 3 | 47 / 2 |
| İki takım toplam sakatlık | 10 | 6 |
| Mensah / Aras gol | 29 / 16 | 60 / 30 |

Güçlü kadro belirgin biçimde daha iyi sonuç aldı; tablo, oyuncu gol/asist/dakika/kart ve reyting kayıtları tutarlı aktarıldı. **Gol dengesi tamamlanmış sayılmaz:** gerçek kariyer kadrolarında 3,97, eşit laboratuvarın 2,44'ünden yüksek; +10 deneyindeki 60 gollü forvet de son denge işine işarettir. Sabit XI politikası sezon ilerledikçe bazı oyuncuları 36 civarı kondisyonla bıraktı; bu otomatik iyi menajerlik deneyi değildir. Örnek tek sezon/tohumdur; sonuçlar genel istatistiksel kalibrasyon iddiası taşımaz.

## Henüz etkisiz eşlemeler

Tam eşleme tabloları `docs/match-sim.md` ve `src/data/match-sim-career.json` içindedir.

- Hücum yönelimi: Dengeli / Kanatlar / Merkez / Kontra motor davranışını değiştirmez.
- Bireysel: Savunma arkasına koş, Ceza sahasında kal, Presi artır, Merkeze yaklaş, Daha riskli pas, Serbest rol, Geniş oyna, İçe kat et, Bindirme yap, Geride kal, Öne çık, Süpürücü kaleci.
- Bağırma ve devre konuşması kariyer moralini korur ve motorda komut olarak günlüğe girer; ek davranış katsayısı yoktur.

Pres/hat/mentalite/tempo/pas stili/genişlik/diziliş ve compact/patience/quick takım talimatları etkilidir. Bireyselde Dengeli, Topu sakla, Daha fazla şut, Kısa kullan, Uzun kullan karşılığı vardır. Geçici çizgi duruşu gerçek korner sayısı olarak sunulmaz. Gerçek duran top/penaltı/orta/kafa kuralları ayrı işte kalır.

## Telefonda deneme

1. Ayarlar → **Deneysel maç motoru (yeni, 2D)** anahtarını aç; kariyerden maça gir. 2D ve “Yeni motorda 3D yakında” notunu gör.
2. 1× ile sakin/tehlikeli geçişleri, saat/skor/top sürekliliğini izle. 0,5× ve 2× ile izleme hızını dene.
3. Duraklat; taktik ve bireysel talimat değiştir, oyuncu değişikliği iste. Taktik hemen, oyuncu ilk gerçek duruşta uygulanmalı. Devre konuşması/bağırma mevcut ekranlardadır.
4. Maçta duraklatıp sayfayı kapat/aç; saat/skor/konum aynı yerden devam etmeli. “Maçı sonuna geç” ile sonucu tamamla; sakatlıkta değişiklik isteği durdurmalı.
5. Maç sonunda sonuç/puan tablosu, oyuncu gol/asist/dakika/kart/kondisyon/reyting, gazete ve sezon kayıtlarını kontrol et. Sonraki maç öncesi anahtarı kapatınca eski motor/3D yolu geri gelir.

## Sonraki 3D işi için sözleşme

Yönetmen, çekirdekten metre cinsinden oyuncu/top konumu, hız, heading/eylem/rol, top yüksekliği/uçuşu/gerçek sahip, kaleci set/tepki/erişim ve gerçek temas olaylarını okumalı. `tick/time`, oyuncu kimliği, `shotId`, hedef/güç, blok/kurtarış/direk/gol ve yeniden başlama kayıtları sahnenin kaynağıdır. Animasyon çekirdeğe sonuç, yeni pas veya yeni gol yazamaz; topu ayağa/kafaya çekemez. Kamera/yavaşlatma yalnız sunum saatiyle yürür; taktik/değişiklik görünen motor adımına bağlanır. Şimdiki tek kare + önceki kare sözleşmesi üzerine görsel interpolasyon eklenebilir; kariyer sonuç adaptörü tekrar yazılmaz.

## Doğrulama ve yayın durumu

A–C checkpoint'inin Node 22 Actions doğrulaması tam yeşildi (eski testler, 34 altın maç, mevcut dumanlar, build ve 50 tohum karşılaştırması). Kesintisiz D son değişiklikleri için yerel lint/test ve iki paralel Actions işi; biri bütün mevcut doğrulama, diğeri gerçek 1× mobil izleme kapısıdır. Son CI bağlantısı, gerçek süre/kare sayıları ve main birleşme SHA'sı tamamlanınca buraya eklenecek. D ayrı işe bırakılmadı.
