# Faz 4 — sürme, müdahale ve faul raporu

**28 Ekim 2026 · Node 22.23.4 · Sürüm 7.14.0**. Dal: `feat/match-sim-duels`, taban main `6274f2d`. Laboratuvar: https://rasimoner.github.io/ManagerStory/lab.html.

## Ölçüm

90 dakika = **54.000 gerçek 0,1 sn adım**, 22 oyuncu, iki 4-2-3-1, Normal pres/hat/tempo, Dengeli pas. Ana karşılaştırma tohumu **901**, önceki pas işinin aynısıdır. Aralıklar bu işte istenen futbol kabul hedefleridir; taşıma/beat/top kazanma için aynı tanımla sayısal hedef henüz belirlenmemiştir.

| Ölçü, iki takım / 90 dakika | Önceki pas işi | Son aday | Futbol karşılaştırması |
|---|---:|---:|---|
| Toplam pas | 1.358 | **807** | 800–1.000; içinde |
| Kontrollü tamamlanan | 758 | **629** | İsabetin payı |
| İsabet | %55,82 | **%77,94** | %75–88; içinde |
| Gerçek ortalama mesafe | 25,84 m | **19,78 m** | Yaklaşık 15–20 m; içinde |
| Pas/dakika | 15,09 | **8,97** | 8,89–11,11 |
| Faul | — | **13** | 20–25; düşük |
| Sarı | — | **1** | 3–5; düşük |
| Kırmızı | — | **0** | Nadir; üç maç sıklık tahmini değildir |
| Taşıma dizisi / mesafe | 0 | **748 / 10.871,91 m** | Her taşıma; çalım denemesiyle aynı tanım değil |
| Geçilen savunmacı (`beat`) | 0 | **51** | Gerçek birebir karşılaşmasından kaçış |
| Müdahale | 0 | **154** | 28 kazanma / 31 sekme / 95 ıska |
| Omuz karşılaşması | 0 | **50** | Sahiplik atamadan ivmeyle yavaşlama |
| Kontrollü top kazanma | — | **159** | Pas, sürme ve bağımsız boş top dahil |
| Kontrollü pas kesme | 186 | **43** | Kazanmanın pas alt kümesi |
| Avantaj | 0 | **2** | Gerçek faulün ardından |
| Ortalama oyuncu tutması | 1,16 sn | **1,90 sn** | Takım sahipliğiyle aynı ölçü değil |
| Ortalama takım sahipliği | 8,74 sn | **19,30 sn** | Uçuş dahil, geçici yeniden başlama bekleyişi hariç |
| Sarı / Mavi sahiplik | %49,08 / %50,92 | **%55,12 / %44,88** | Gerçek kontrolden |

Pas sayısı **%40,57 azaldı**, isabet **22,13 yüzde puan arttı**, ortalama mesafe **6,06 m kısaldı**. Sürme boşluğunun kullanılması, baskıda kısa güvenli çıkış/koruma ve gerçek topa ilk ulaşma belirleyicidir. Çıkış anındaki pas güvenliği düzeltildi; tepki vermiş alıcıya ikinci tepki gecikmesi kaldırıldı, normal ilk dokunuş kayıpları azaltıldı. Sayıların tek nedeni sürme seçeneği diye sunulmaz.

## Üç tohum ve sapmalar

| Tohum | Pas | İsabet | Mesafe | Faul | Sarı | Kırmızı | Avantaj | Taşıma | Beat |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 901 | 807 | 77,94% | 19,78 m | 13 | 1 | 0 | 2 | 748 | 51 |
| 731 | 815 | 77,67% | 18,81 m | 20 | 4 | 0 | 2 | 785 | 55 |
| 42 | 811 | 78,55% | 18,51 m | 16 | 5 | 0 | 4 | 813 | 50 |

Üç örnekte pas hedefleri birlikte sağlanır. **Faul ve kart dengesi tamamlanmış değildir:** 901 ve 42'de faul düşük, 901'de sarı düşük; varsayılan 731 bu aralıklara girer. Serbest dokunuşa rakibin müdahaleden önce yetişebilmesi, temkinli gövde erişim marjı, sarı sonrası temkin ve 8 sn müdahale bekleyişi faullü hamleleri sınırlar. Şiddet eşiği 2,15 olduğundan bütün fauller sarıya dönüşmez. Sonraki denge işinde temasın açı/hız/uzanma ve hazırlık süresi dağılımı çok tohumla kalibre edilecek; faul/kart kotası veya ayrı zar eklenmeyecek.

Taşıma, her kesintisiz top taşıma dizisidir; koruma/pas veya kontrol kaybında biter. Beat 3 m içindeki gerçek jokey/müdahale karşılaşmasından sonra en az 2 m ilerleme, rakibin ilerisine çıkış ve 4 m açılma ister. Bu tanımlar veri sağlayıcısının çalım denemesi/başarısı tanımına eşlenmeden sayısal futbol hedefi ilan edilmedi. Şut yokken son bölgedeki taşıma/pas döngüsü ve taşıma mesafesi yüksek kalabilir; şut ve gerçek duran top işlerinde yeniden ölçülecek.

## Fizik ve son kontroller

- Sürmede top serbest yuvarlanır; ilk gerçek temas kazanır. Aynı oyuncunun tekrar dokunması için süre gerekir. Topla hız ve dönüş hedefleri özelliklerden düşürülür; hız/ivme bir anda kırpılmaz.
- Sürme dokunuşu genel boş top takibi başlatmaz: jokey/örtme ve destek/derin koşu korunur. Uzak kalan sürücü gerçek top noktasına döner.
- Saha kenarında kırpılıp gerçek koşu alanı bırakmayan yön elenir; boşluk varmış gibi puanlanmaz. Bunun sentetik testi önce kırmızı çalıştırıldı. Taşıma taban puanı bu ayrımla 27'dir; boş alanda sürme hâlâ öne çıkar.
- Ayak–top/bacak ilk kesişimi kazanma/sekme/ıska/faulü üretir. Başarı veya faul zarı yoktur. Omuz kuvveti yalnız yavaşlamayı etkiler.
- Kayarak ıska yapan oyuncu kalkana kadar uygunluk listelerine giremez. Her faulden hemen önce aynı oyuncuların aynı zamanlı teması bulunur.
- Avantaj 3 sn içinde atak biterse geri çağrılır. Kırmızı/ikinci sarı oyunu durdurur. Ceza alanı faulü `penaltyPending` ile alanın en yakın kenarının dışından başlar.
- Faul kısa pası, 9,15 m yerleşim ve ceza alanı dışına taşıma **7. işe kadar GEÇİCİ**. Yerdeki rakip de mesafe kontrolüne dahildir; köşede erişilemeyen saha dışı hedef kullanılmaz. Oyuncu taşınmaz.
- `beat` yalnız kayıt; `moves.json` veya 3D için hareket seçilmez.

## Hız ve doğrulama

Derleme ve kopya çıkarma zaman dışında, aynı yüklenmiş yerel modül kullanılır. Simülasyonlar sıfırdan kurulur; üç tam maçın **her biri 2.000 ms altında** olmalıdır, medyan ayrıca raporlanır. Gerekli topsuz kontrol de aynı modüldedir; her test için farklı ağaç budanmış soğuk modül derlenmez. Fizik adımı atlanmaz. Ara adayların soğuk varyantlarında 2,066–2,750 sn aşım da görüldü; nihai sonuç son doğrulama satırındadır.

Pas taraması ortak kadro/çıkış verisini paylaşır; ulaşılamayan alıcının yolu ve varış alt sınırıyla sonucu değiştiremeyecek rakip hesapları atlanır. Seçili pas her tepki ve çıkışta yeniden güvenlikten geçer. Bunlar maç sonucunu veya adım sayısını önceden belirlemez.

Eski topsuz 90 dakika koordinat SHA-256 özeti **9b1126b840f9ad5ec641b19abbdc01fd4f66afd11acba238e6207aee31d16754** korunur. Yeni maçın bütün 54.000 × 22 × 2 konumu ve bütün olayları aynı tohumda iki kez karşılaştırılır. Tam maçta her faulün önceki teması denetlenir. Pasın üç ana hedefi de 901 referans maçında test edilir.

Nihai doğrulama (Node 22.23.4): **371 davranış testi + 4 tam maç/hız kontrolü**, hızlı pakette **281 + 4** kontrol yeşil. Lint yeni ihlal yok; taban büyümedi. Build ve değişmemiş **12 duman kontrolü + dört laboratuvar tarayıcı denemesi** yeşil. Telefon görünümü ayrıca 390 × 844'te incelendi; canlı sayaçlar seçenek satırını kapatmayacak biçimde saha üstünde ayrı alana alındı.

Tam paket sonundaki üç gerçek 90 dakika süresi: **1.192,3 / 869,0 / 838,9 ms**; medyan **869,0 ms**. Hızlı paket: **997,3 / 810,5 / 780,3 ms**. Her koşu 2 saniyenin altında. Derleme ve çıktı kopyaları ölçüm dışında; aynı modül gerekli topsuz kontrolde de kullanılıyor. Eski motor, 3D, kariyer, kayıt biçimi, altınlar ve sürüm değişmedi.

## Telefonda dört deneme

1. **Tohum 901 → Yeniden kur → 90 dakikayı tamamla**: ilk tablodaki sonuçlar aynı olmalı. Varsayılan 731'in sayıları ikinci tabloda.
2. **0,25×** ve pas/sür/koru katmanı: boşlukta sürmeyi, küçük serbest top dokunuşlarını; baskıda kısa çıkış/korumayı izle.
3. Oyuncuya **uzun bas**, devam et: topu alınca sürmeye zorlanır. Jokey, müdahaleye hazırlık, TOP/OYUNCU/ISKA temas işareti ve yerde kalmaya bak.
4. Son 10 olay ile faul/kart/avantajı izle. Yeniden başlamada oyuncular koşarak yerleşmeli; ceza alanında `penaltyPending` ve geçici kısa pas görünmeli.

## Açık sorular

Faul/kart şiddetinin çok tohumlu dengesi; tam gövde/ayak zarfı ve taşıma/beat/kazanma tanımlarının futbol verisiyle eşlemesi. Şut/kaleci geldikten sonra DOGSO'nun kaleci erişimiyle değerlendirilmesi, avantaj kartının sonraki duruşta gösterilmesi ve gol sonucuna göre yaptırım. 7. işte gerçek penaltı/serbest vuruş/baraj ve diğer duran toplarla geçici yeniden başlamaların kaldırılması. Spin/çim, sıçrama/kafa, ofsayt, özel hareket seçimi ve 3D olay entegrasyonu sonraki işlerdir.
