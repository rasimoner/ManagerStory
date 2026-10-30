# Ortak maç süresi ve doğal 2D — V7.16.0

29 Ekim 2026 · Dal `feat/match-sim-duration` · Başlangıç main `ce0125cbc2dac56f2078ceacb1a4ed9c2b84d29d` · Node 22.23.4.

## Sonuç ve kapsam

Yeni deneysel kullanıcı maçlarında 1× fizik gerçek zamanla ilerler; maç saati seçilen toplam 3/5/7/10 dakikada 90'a ulaşır. Seçim Ayarlar'da kalıcıdır, varsayılan 7'dir ve başlangıçta aktif maçın çekirdeğine kopyalanır. Süren maç ve kayıttan devamı sonraki tercih değişikliğinden etkilenmez. Yeni 2D'de tehlikeye göre otomatik hız yoktur. Manuel 0,5/1/2 korunur. Deneysel anahtar kapalı başlar; açıkken 3D yoktur. Mevcut eski motor/3D ve diğer lig maçları değişmez.

**Süre işlevi ve futbol dengesi ayrı değerlendirilir.** Aynı 50 eşit kadro/tohumda kısa maçlar %80–92 golsüz, toplam 0,44–1,86 şut verir. Dört sürenin hepsi futbol açısından zayıftır; 10 dakika da tamamlanmış denge sayılmaz. Bu ölçümün iyi bir futbol oyunu onayı olduğu ileri sürülmez.

## Telefonda deneme

1. [Canlı oyunu aç](https://rasimoner.github.io/ManagerStory/). Ayarlar → **Maç süresi**: 3, 5, 7 veya 10 dakika; **Deneysel maç motoru (yeni, 2D)** anahtarını aç.
2. Kariyerden maça gir; süre sorusu çıkmamalı. 1× ile top/oyuncu hareketi aynı tempoda, saat hızlı ilerlemeli. 7 dakikada her devre 3:30 fizik süresidir; 45:00'da devre bekler, 90:00'da biter.
3. 0,5× / 2×, duraklatma, taktik ve oyuncu değişikliği dene. Taktik görülen anda, değişiklik ilk gerçek futbol duruşunda uygulanır. Menüde beklerken maç bütçesi ilerlemez.
4. Duraklatıp kapat/aç; aynı yerden sürdür. Ayardaki süreyi değiştirmek aktif maçı değiştirmemeli. “Maçı sonuna geç” aynı kalan maçı tamamlamalı.
5. Sonuç, gazete ve oyuncu dakika/gol/asist/kart/kondisyonunu kontrol et. Yeni motor kapalıyken sonraki maç eski motor/3D yolundadır.

## Zaman, durum ve kayıt

`core/sim/simulation-clock.js` genel `durationSeconds` girdisini alır. `tick` tam sayı, fizik adımı 0,1 sn. `physicsTime = time = tick × 0,1`; `matchTime = tick × 5.400 / totalTicks` (bitişte 5.400). Oran yuvarlanıp toplanmaz. DOM, kariyer ve görünüm türü bilinmez. Genel çekirdek 12 sn gibi dört seçenek dışındaki adım uyumlu süreyi de kabul eder; geçersiz süre hata verir. Kariyer tercihi yalnız 3/5/7/10 sayılarıdır: komut geçersizi reddeder, eksik/bozuk yükleme tercihi 7 olur.

Hareket/ivme, top/pas/şut uçuşu, yerçekimi, tepki/karar, avantaj, kaleci tutması ve kısa bekleme fizik saatinde kaldı. Devre/bitiş, olay dakikası, oyuncu süresi ve yorgunluk maruziyeti maç saatinde. `passesPerMinute` yeni modelde maç dakikası, `passesPerPhysicsMinute` fizik temposudur; toplam pas sayısı aynı gerçek olaylardır. `M.matchElapsedSeconds`, özet/gazete/arşiv için maç saatidir. Ekran ve çekirdek aynı görülen adımı kullanır; gelecek sonuç tamponu yoktur. Sonuna-geç kalan fizik süresini aynı nesnede işler.

Kayıt göçü 4 → 5 yalnız `matchDurationMinutes` tercihini ekler. Aktif checkpoint kendi modelini, süresini, iki saatini, birikimini, faaliyet ve yorgunluk sayaçlarını, RNG/komut/karar/kovalama durumunu saklar. Kariyer olay cursor'ı ve dakika sayaçları çift yazmayı önler. Özet `timeModel/durationSeconds` ile oynanan süreyi taşır. Ağır alanlar mevcut kayıpsız arşivde kalır.

V7.15.0'dan kalmış, saat modeli bulunmayan deneysel checkpoint `reference`/5.400 fizik saniyesi olarak açılır; önceki 32/12/3/1/8 yumuşak gösterimle tamamlanır. Yeni ayar sonraki maça geçerlidir. Gerçek eski koddan alınmış `tests/fixtures/saves/duration/v7.15.0-experimental.json` devamı eski kodun 1–5 skoru, RNG'si, bütün takım sayaçları, kariyer oyuncu değerleri ve tam olay günlüğü SHA-256'sıyla birebir test edilir. Eski dakika/3D yarım maçlara dokunulmaz; mevcut kayıt/34 altın maç kapıları da korunur.

## Kondisyon ve dakikalar

- `playedSeconds` gerçek fizik süresidir; kariyer dakikasında bir kez `5.400/durationSeconds` ile çevrilir. Tam maç 90, 60'ta giren 30 dakika testi vardır. Her aktarılan dakika mevcut `minutePlayed` kancasından yalnız bir kez geçer.
- Mevcut enerji terimleri `fizikSaniye × saniyeMaliyeti + gerçekMesafe × metreMaliyeti + gerçekSprint × sprintMaliyeti`; her terim bir kez süre oranıyla ağırlanır. Stamina çarpanı ve kaleci/saha oyuncusu saniye katsayıları korunur. Gerçek mesafe ve sprint sayaçları çoğaltılmaz. Bu, enerji maruziyeti normalleştirmesidir.
- Gerçek temas başına kondisyon maliyeti ve sert temas sakatlık riski süre oranıyla çarpılmaz. Temasları ya da kartları çoğaltan ek üretim yoktur.
- Yorgunluk sakatlığı geçen maç saniyeleriyle, maç dakikası kontrol noktalarında; risk o andaki kalan kondisyonla hesaplanır. Son düdükten sonra yeni yorgunluk sakatlığı engellenir. Referans modelin eski risk/RNG takvimi değişmez.
- Eşit kadro ölçümünde maç sonu ortalama kondisyon 79,51–80,57; 90 fizik dakika referansında 80,72. 3 dakikada tüketim sıfıra inmedi. Kaleci 3 dakikada 76,77'ye düşer; başlangıç/santra hareketinin daha büyük enerji payı vardır. Bu ayrıca kalibrasyon konusu, ideal kondisyon dengesi iddiası değildir.

## Otomatik saat ölçümü

Ham sonuç: [match-sim-duration-clocks.json](measurements/match-sim-duration-clocks.json). Node 22, 60 fps sanal saat, 1×; gerçek duvar zamanı izlemesi değildir. Ondalık farklar sanal kare toplamının yaklaşık 10⁻¹⁰ sn kayan nokta temsilidir; motorun devre/bitiş saatleri tamdır.

| Seçim | Sanal izleme sn | Fizik sn | Adım | Devre fizik sn | Son maç saati |
|---|---:|---:|---:|---:|---|
| 3 dk | 180,000 | 180 | 1.800 | 90 | 90:00 |
| 5 dk | 300,000 | 300 | 3.000 | 150 | 90:00 |
| 7 dk | 420,000 | 420 | 4.200 | 210 | 90:00 |
| 10 dk | 600,000 | 600 | 6.000 | 300 | 90:00 |

Manuel 0,5×/1×/2× ve 60/30 fps karşılaştırması aynı futbol olayları, RNG ve oyuncu durumunu verir; komut aynı fizik adımındadır. Kare bütçesini iki adımla sınırlayan test 10 sn'lik karede yalnız iki fizik adımı hesaplayarak süreyi uzatır; adım atlamaz. Duraklatma/menü beklemesi ve taktik/gerçek duruşta değişiklik ayrıca testlidir.

## Aynı 50 tohum — 250 gerçek maç

Ham sonuç: [match-sim-duration.json](measurements/match-sim-duration.json). `npm run sim:duration-report -- <dosya>` yeniden üretir. Beş grubun tohumları birebir aynıdır; Denge 1'in referans tohumları ve 1'den başlayan sabit liste, toplam 50 benzersiz tohum. İki takım aynı yuvadaki aynı özellikleri alır; oyuncu kimlikleri kararlı sayıdır. Bütün gruplarda kondisyon ve gerçek sakatlık açıktır. Laboratuvar kıyasında yedek kadro yoktur; sakat oyuncu çıkar, hakem beklemesi otomatik sürdürülür. Bu, kariyerin transfer/rotasyon/otomatik yedek politikasının sezon deneyi değildir.

Mevcut laboratuvarın **varsayılan tüketimsiz** Denge 1 yolu ayrıca aynı 50 tohum/güç karşılaştırma kapısında korunur; önceki 2,44 gol ortalaması bu eşit kadro ve tüketim açık 2,32 referansıyla aynı deneymiş gibi karıştırılmaz.

| Süre | Gol | Şut | İsabet | xG | Pas | Pas isabeti |
|---|---:|---:|---:|---:|---:|---:|
| 90 fizik dk referans | 2.32 | 17.40 | 8.72 | 2.295 | 772.36 | %77.32 |
| 3 dk | 0.08 | 0.44 | 0.26 | 0.050 | 24.00 | %76.90 |
| 5 dk | 0.16 | 1.08 | 0.64 | 0.153 | 41.26 | %77.85 |
| 7 dk | 0.20 | 1.06 | 0.60 | 0.112 | 57.60 | %77.08 |
| 10 dk | 0.16 | 1.86 | 1.08 | 0.213 | 84.94 | %76.10 |

Her gol dağılımı 50 maçın **adedi ve yüzdesidir**; 0/1/2/3/4/5+ toplam gol:

| Süre | 0 | 1 | 2 | 3 | 4 | 5+ |
|---|---:|---:|---:|---:|---:|---:|
| 90 fizik dk referans | 5 (%10) | 13 (%26) | 11 (%22) | 11 (%22) | 5 (%10) | 5 (%10) |
| 3 dk | 46 (%92) | 4 (%8) | 0 (%0) | 0 (%0) | 0 (%0) | 0 (%0) |
| 5 dk | 42 (%84) | 8 (%16) | 0 (%0) | 0 (%0) | 0 (%0) | 0 (%0) |
| 7 dk | 40 (%80) | 10 (%20) | 0 (%0) | 0 (%0) | 0 (%0) | 0 (%0) |
| 10 dk | 42 (%84) | 8 (%16) | 0 (%0) | 0 (%0) | 0 (%0) | 0 (%0) |

| Süre | Faul | Sarı | Kırmızı | Sakatlık | Kondisyon | Kaleci | Saha oyuncusu |
|---|---:|---:|---:|---:|---:|---:|---:|
| 90 fizik dk referans | 11.34 | 2.76 | 0.16 | 0.16 | 80.72 | 79.79 | 80.81 |
| 3 dk | 0.48 | 0.16 | 0.00 | 0.18 | 79.51 | 76.77 | 79.79 |
| 5 dk | 0.72 | 0.08 | 0.00 | 0.18 | 80.23 | 78.12 | 80.44 |
| 7 dk | 1.08 | 0.24 | 0.00 | 0.18 | 80.48 | 78.53 | 80.67 |
| 10 dk | 1.14 | 0.34 | 0.00 | 0.18 | 80.57 | 79.02 | 80.73 |

İki takım toplamı/maç ortalamalarıdır; kondisyon 0–100. Gol, şut, pas, faul, sarı ve kırmızı gerçek günlük ile sayaçlar arasında eşitlik denetiminden geçer. İki takım ayrı kullanıcı takımı olarak gerçek `recordMatchEvent`, `recordMinutePlayed`, `seasonRecordMatch` yazıcılarından geçirilir; gol/asist/kart/dakika ve şut/olay dakikaları karşılaştırılır. Her grupta **50/50**, toplam **250/250** tutarlı. Bu başsız karşılaştırma kariyer UI'sini veya sezonun kalan yapay zekâ maçlarını oynatmaz; tam kariyer sonuç/gazete/tablo/sezon, kaydet/yükle ve sonuna-geç entegrasyon testleri/dumanı ayrı kapıdır.

## Hazırlık bütçesi ve futbol etkisi

Adım başındaki gerçek durum sınıflanır; her fizik adımı bir kez sayılır, toplam seçilen fizik süresidir. `kickoff` santra/gol/devre yerleşimi, `restart` çizgi/hakem duruşudur. Kullanıcının devrede veya sakatlık ekranında beklemesi simülasyon adımı değildir ve bu tabloda yoktur.

| Süre | Açık oyun sn/pay | Santra/yerleşme sn/pay | Diğer yeniden başlama sn/pay |
|---|---:|---:|---:|
| 90 fizik dk referans | 5007.824 (%92.74) | 44.670 (%0.83) | 347.506 (%6.44) |
| 3 dk | 148.272 (%82.37) | 21.176 (%11.76) | 10.552 (%5.86) |
| 5 dk | 259.048 (%86.35) | 21.840 (%7.28) | 19.112 (%6.37) |
| 7 dk | 371.944 (%88.56) | 22.184 (%5.28) | 25.872 (%6.16) |
| 10 dk | 539.120 (%89.85) | 21.822 (%3.64) | 39.058 (%6.51) |

3 dakikada oyun dışı pay %17,63, 10 dakikada %10,15; kısa maçın çoğu hazırlıkla geçmez, fakat 3 dakikada yaklaşık altıda biri hazırlık/duruştur. Oyuncular fiziksel olarak yerleşir; ışınlama eklenmedi. Gerçek mesafe, sprint ve temas adetleri ham `movement` alanında korunur.

Çok az atak/golsüzlük bütün kısa seçeneklerde açıktır. 10 dakikanın 7 dakikadan az gol vermesi 50 eşlenmiş tohumda değişen devre/yorgunluk/karar akışının sonucu; süreye göre garanti skor ya da monoton gol hedefi yoktur. Denge 2'de kısa formatta gerçek hücum bağlantısı, ilerleme, karar aciliyeti ve şut fırsatı üretimi ölçülmelidir; fizik hızına, saha boyutuna, kota veya hayali istatistiğe başvurulmadı. Kaleci çıkışı, gerçek duran toplar/orta/kafa/ofsayt ve etkisiz taktik eşlemeleri önceki açık maddelerdir.

## Gerçek 7 dakika / 1× Chromium izlemesi

[Actions 40938196215 / gerçek izleme işi](https://github.com/rasimoner/ManagerStory/actions/runs/40938196215/job/123675067352), uygulama SHA `889591ba461ebe284a6eccadc0223774591aea6a`; Node 22.23.4, 390×844 dokunmatik Chromium, 4× CPU yavaşlatma, 1×, tohum 8873. Tek tam izleme başarıyla tamamlandı; aynı uzun test yeniden çalıştırılmadı. Ham [JSON](measurements/match-sim-duration-mobile.json) ve [son ekran](measurements/match-sim-duration-mobile.png) Actions arşivinden alındı; arşiv SHA-256 ve logdaki JSON ile eşitlik doğrulandı.

| Gerçek izleme ölçüsü | Sonuç |
|---|---:|
| Aktif RAF duvar süresi | **423,2998 sn = 7 dk 3,30 sn** |
| Nominal 420 saniyeye göre fark | +3,2998 sn / %0,79 |
| Hazırlık tamamlandıktan sonraki toplam gözlem | 423,316 sn |
| RAF örneklerinde ayrı işaretlenen bekleme | 0 ms; otomatik devre geçişi, ek insan beklemesi yok |
| Fizik / maç zamanı | **420 / 5.400 sn** |
| Adım | **4.200 / 4.200** |
| Motor sürücüsünün biriktirdiği kare süresi | 420,0174 sn |
| RAF aralığı adedi | 25.264 |
| RAF medyan / P95 | **16,7 / 16,8 ms** |
| En uzun aralık | **233,4 ms**, son düdükte |
| Diğer 100 ms üstü aralıklar | 166,6 ms devrede; 116,6 ms başlangıçta |
| Bütçesi dolan kare / geri giden saat | **0 / yok** |
| Skor | **0–0** |
| Aktif kaydın UTF-16 boyutu | 616.074 bayt |

Aktif süre, pitch mevcutken RAF aralıklarından ve önceki duraklatma durumundan ölçülür. Saha DOM'u olmayan ekran aralıklarında örnek dizisi kesilir; bu geçişler aktif süreye eklenmez. `waitingMilliseconds` yalnız saha mevcutken duraklatma işaretli aralıkları sayar, bütün menü yokluğu sürelerinin ayrı sayacı değildir. Toplam gözlem saati hazırlıktan sonra başladığı, RAF gözlemi saha görünmeden önce kurulduğu için iki sayaç tam aynı başlangıç çizgisine sahip değildir. Otomatik koşuya ek kullanıcı beklemesi konmadı; beklemelerin simülasyonu ilerletmediği ayrı testlerle korunur. Bu sınırlama 423,2998'i bütün insan etkileşimlerini kapsayan bir kronometre garantisine dönüştürmez.

3,30 sn fark, fizik adımı atlamadan çizim/yeniden çizim ve kare sınırlarının getirdiği duvar uzamasıdır; motorun 420 sn'si ve 4.200 adımı tamdır. 25.264 RAF örneği ekrandaki her pikselin veya dokunma gecikmesinin ayrı ölçümü değildir. Tek tohum/tek emüle cihaz bütün telefonlarda süre garantisi vermez. Önceki referans izleme raporundaki 3.416,6 ms son-düdük takılması bu yeni kısa koşuda 233,4 ms'dir; farklı zaman modeli ve olay hacmi olduğundan yalnız bir optimizasyonun kontrollü kıyası sayılmaz.

Görüntüde bazı forma numaraları üst üste gelir; önceki çizgi kenarı kırpılmasının bütün pozisyonlarda giderildiği doğrulanmadı. 0,1 sn fizik arasındaki CSS çizim geçişi görsel gecikme taşıyabilir. Bunlar kapsamlı bir 2D tasarım yenilemesiyle örtülmedi. **Chromium CPU emülasyonu fiziksel iPhone/Safari onayı değildir.**

## Sonraki 3D sözleşmesi

- Çekirdek `clock.model/durationSeconds/totalTicks`, `tick`, `physicsTime/time`, `matchTime` verir. Yönetmen fizik hareketi için fizik, saat/olay etiketi için maç zamanını okur; kendi 90 dakika çevirisini kurmaz.
- `readSimulation`: gerçek metre oyuncu/top konumu, hız, heading, rol/eylem, top yüksekliği/sahibi/uçuşu ve kaleci durumu. `captureSimulationFrame` 2D'nin anlık hafif kopyasıdır, iki saati taşır. Görsel ara konum sonucu veya top temasını değiştiremez.
- Olay `tick`, fiziksel alt-adım `physicsTime/time`, oransal `matchTime`, aktör/konum/`shotId` ve gerçek sonucu taşır. `resolvedAt` fizik, `resolvedMatchTime` maç zamanıdır. Eski kayıt eksik alanları referans anlamıyla okunur.
- Komut görülen adıma, değişiklik sonraki gerçek duruşa; animasyon yeni gol/pas/başarı veya fiziğe hız yazamaz. Bu teslim 3D yönetmenine bağlanmaz.

## Doğrulama ve yayın

[PR #8](https://github.com/rasimoner/ManagerStory/pull/8) uygulama SHA'sı `889591ba461ebe284a6eccadc0223774591aea6a` için [son Node 22 doğrulaması](https://github.com/rasimoner/ManagerStory/actions/runs/40938196215) bütünüyle geçti: lint, hızlı testte 383 başarılı/1 mevcut atlama, tam pakette 473 başarılı/1 mevcut atlama, ayrıca her iki paketin 5/5 performans kontrolü, build, mevcut 12 duman kontrolü, mobil laboratuvarlar ve kariyer kontrolleri. Mevcut 50 referans maç/8 güç deneyi karşılaştırması ve yeni 250 maç ölçümü de geçti. Altın kayıtlar değiştirilmedi, lint tabanı büyümedi. Önce test sonra uygulama; süre, kayıt/kariyer ve rapor testlerinin kırmızı sonuçları yerelde gözlendi.

Actions'ın 250 maçındaki bütün futbol/kariyer alanları depodaki ham ölçümlerle birebir eşleşti; yalnız çalıştırma makinesine bağlı `milliseconds` karşılaştırılmadı. Dört sanal saat çıktısı tamamen aynı. [Karşılaştırma kanıtı](measurements/match-sim-duration-ci-verification.json) kaynak SHA'sını ve doğrulanmış arşiv SHA-256'sını taşır. Gerçek 7 dakikalık izleme aynı SHA'da bir kez çalıştı ve geçti. Sonraki rapor/ham kanıt commit'i yalnız `docs/` değiştirir; aynı uzun izleme yeniden çalıştırılmaz.

Yerel Chromium kurulu değildir. Yerel Node 22'de eski değişmemiş main de bazı 2 sn soğuk performans bütçelerini aştı (şut 3.309/2.020/1.703 ms; tüketimli 2.832/4.092/2.559 ms). Son belge kontrolünde lint ve bütün hızlı işlev testleri geçti; yerel soğuk şut medyanı 2.030,9 ms ile aynı bütçeyi aştı. Eşikler değiştirilmedi; son uygulamanın bütün performans kontrolleri Actions'ta geçti. Tekrar tekrar yerel zaman denemesiyle iyi sonuç seçilmedi.

Main'e birleşme sonrası [Pages yayın kapısı](https://github.com/rasimoner/ManagerStory/actions/workflows/pages.yml) lint/tam test/build/dumanı tekrar doğrular ve [canlı oyunu](https://rasimoner.github.io/ManagerStory/) yayımlar. Kesin birleşme SHA'sı ve yayın koşusu teslim mesajında verilir. Birleşen dallar silinmez; birleşme sonrasında `feat/match-sim-duration` silinebilecek adaydır.


V7.18.0 güncellemesi: bu tarihli raporda sonraki iş olarak tarif edilen 3D sözleşmesi uygulandı. Aynı aktif maç Saha → 3D seçimiyle çizilir; yaklaşım, kanıtlar ve sınırlar [3D raporunda](match-sim-3d-report.md). Önceki sürüme ait ölçümler ve kararların tarihi korunmuştur.
