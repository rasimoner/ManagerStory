# Faz 4 — şut, kaleci ve gol raporu

**28 Ekim 2026 · Node 22.23.4 · Sürüm 7.14.0 değişmedi.** Dal: `feat/match-sim-shooting`; taban `47c4323`. Laboratuvar: https://rasimoner.github.io/ManagerStory/lab.html.

## Durum ve doğrulama

Şut/kaleci, fiziksel blok/direk/kurtarış, gol/skor, santra, devre/yön değişimi ve 90 dakika bitişi uygulandı. xG yalnız karar ve istatistik; gol için sonuç zarı yok. Eski oyun motoru, 3D, kariyer, kayıt biçimi ve altınlar değiştirilmedi.

Bu ilk dal kaydı main'e birleşme onayı değildir. Son kodun Node 22 lint/hızlı/tam test, build ve tarayıcı doğrulaması dalın PR iş akışında tamamlanacak; beş tohumun nihai tablosu ve doğrulama bağlantısı bu bölüme eklenecek. Yerel ortam Chromium çalıştırmayı engellediği için değişmemiş 12 duman kontrolü ve beş laboratuvar senaryosu GitHub Actions üzerinde aynı komutlarla çalıştırılır. Süre bütçesi yükseltilmez; üç tam maçın her biri 2 saniyenin altında olmalıdır.

## Uygulamanın sınırı

Şut yön/güç/yükseklik hatası seed'lidir; mesafe, görünen/örtülen açı, kalecinin iki eksendeki konumu, baskı ve vücut durumu karar içindir. Aynı fizik yolu savunmacı blokları, kalecinin gerçek tepki/erişim sınırı ve kale çerçevesiyle yarışır. Topun tamamı çizgiyi geçmeden gol yoktur. Kaleci parmak ucuyla değip golü önleyemediyse temas günlükte korunur, başarılı kurtarış sayısına girmez.

Kaleci set olur, adım/plonjonla uzanır; handling yalnız temas sonrası tutma/çelme/saptırma kalitesini etkiler. Elde top dokunulmazdır; 3,5 sn sonra elle atış/elden uzun vuruş çıkar. Geri pas ve ceza alanı dışı elle alma engellenir. Birebirde oneOnOne/positioning ile çıkar; sürme, plase veya aynı parabollü aşırtma karşılık olabilir. `save` zorluğu ve son an bilgisi özel hareketler için yalnız kayıttır.

Gol yiyen takım santraya fiziksel olarak yerleşir ve merkezden gerçek pas çıkarır. 45'te yön değişimi, 90'da bitiş vardır; uzatma yoktur. Kale çizgisinde kalecinin elinden dağıtım / kısa korner, taçta rakip kısa pası ve önceki faul yeniden başlatmaları **7. işe kadar geçicidir**. Orta, kafa, gerçek duran top, ofsayt veya özel hareket seçimi eklenmedi.

## Ölçüm ve futbol hedefleri

Tekrar komutu: `node --experimental-vm-modules --disable-warning=ExperimentalWarning tools/match-sim-report.cjs` (Node 22). Tohumlar **901, 731, 42, 2026, 508**, iki 4-2-3-1, Normal pres/hat/tempo, Dengeli pas/mentalite, 22 oyuncu; her maç 54.000 gerçek 0,1 sn adım. Derleme, snapshot, JSON yazdırma zaman dışında.

Şut hedefi 20–28, isabet 8–10, gol 2,5–3, şut başına xG 0,10–0,12, blok 4–8, kaleci kurtarış oranı %65–75. Pas 800–1.000, isabet %75–88, ortalama mesafe 15–20 m; faul 20–25, sarı 3–5. Bunlar kullanıcı tarafından verilen karşılaştırma hedefleridir; sayaçları bu aralığa zorlayan kota yoktur. Beş maç lig kalibrasyonu sayılmaz; aralık dışı sonuçlar raporlanır.

Başarılı kurtarış / isabetli şut oranı kullanılır; gol olan parmak ucu teması paya girmez. xG farkı **gerçek gol − toplam xG**. Blok savunma takımına, şut/xG hücum takımına yazılır; tablolar iki takım toplamıdır. Direk sayısında aynı şutun çerçeveye tekrar teması ayrı fiziksel temastır.

Nihai beş tohum tablosu PR doğrulamasından sonra eklenecek. Ara ölçümler şut/gol/blokların bazı tohumlarda yüksek, kurtarış ve faul/sarıların düşük kalabildiğini gösterdi. Tam örtülmüş açıda şut tekrarını önlemek için xG'nin açık kale oranı çarpanı kullanılır; skor veya olay sayısı sonradan düzeltilmez. Yakın mesafeli ikinci şutlar, henüz olmayan ofsayt ve önceki müdahalelerdeki yüksek ıska oranı 8. işte birlikte kalibre edilecek.

## Telefonda dört deneme

1. **0,25× → top sahibine iki kez dokun.** Top gerçek uçuşla gitmeli; açı çizgileri, şut izi, kalecinin tepki geri sayımı ve erişim kolunu izle.
2. **Şut/açı/kaleci erişimi katmanı** açıkken tutma, çelme ve saptırmayı; serbest dönen topun başka oyuncuya veya ikinci şuta gitmesini izle. Olayda zorluk değeri görünür.
3. **Golü ve santrayı izle.** Skor artmalı, kısa GOL işareti görünmeli, yiyen takım gerçek merkez pasıyla başlamalı. Oyuncular kendi yarısına koşmalı.
4. **Tohum 901 → Yeniden kur → 90 dakikayı tamamla.** Skor/istatistikler raporla aynı olmalı; 2. devrede Sarı aşağı/Mavi yukarı, 90:00'da MAÇ BİTTİ görünmeli. Tohum 731 ile de tekrarlanabilir.

## Oyun bağlantısı için arayüz eksikleri

| Alan | Mevcut | Sonraki işte gereken |
|---|---|---|
| Başlat/ilerlet/oku | `createSimulation({teams,seed,ball,match:true})`, sabit adım/advance ve bağımsız snapshot | Kariyerden maça özel oyuncu/özellik/taktik kopyası kuran adaptör |
| Skor/saat/olay | `match.score/half/phase`, 0,1 sn zaman, kimlik/konumlu olaylar | Eski olay/maç ekranı ve 3D sözleşmesine çeviri; sonucu kariyere yalnız bir kez yazma |
| Oyuncu değişikliği | Kırmızı/uygunluk var, yedek yok | Benzersiz kimlikli yedek kadro, değişiklik doğrulaması ve kadro/rol/pas taraması önbelleklerini yenileme |
| Taktik/diziliş | Laboratuvar `setSimulationTactics` her iki takımı değiştirir; ilk diziliş girdidedir | Tek takıma atomik taktik/diziliş/bireysel talimat komutu; uygulanma adımının günlüğü |
| Kondisyon/sakatlık | Başlangıç fitness hız/ivmeyi etkiler; tüketim yok | Mesafe/sprint/mücadeleden tüketim, sakatlık ve zorunlu değişiklik; kariyere yazmayı adaptör üstlenmeli |
| Kayıttan devam | Okunabilir snapshot ve görünen rngState var | Seed üretecini/WeakMap önbelleklerini geri kuran sürümlü yükleme API'si; snapshot tek başına restore değildir |
| Komut/tekrar | Pas, sürme, şut, hakem top yerleştirme var | Adım numaralı tek takım komut kuyruğu, iptal/hata sözleşmesi ve tekrar kaydı |
| Sunum | Laboratuvar yalnız durum/olay okur; motor DOM/three.js bilmez | Konum örnekleme/interpolasyon ve olay cursor'ı; sunum simülasyon ilerletmemeli |

Mevcut `automaticPasses` adı tarihsel olarak bütün otomatik sahip kararlarını açıp kapatır; oyun adaptörü bunu dar anlamda yalnız pas anahtarı sanmamalı.

## Şartnamede açık kalanlar

- 7. işte gerçek taç/kale vuruşu/korner/serbest vuruş/penaltı, orta/kafa/sıçrama ve ofsayt; geçici kuralların kaldırılması.
- Avantajda kartı sonraki duruşta gösterme ve ceza sahasında topa oynama/DOGSO indirimi; kalecinin görüşünün savunmacıyla kapanması.
- Sağ/sol ayak tercihi, ayak dışı/plase farkında falso, spin/hava direnci ve daha ayrıntılı el/gövde temas zarfı.
- Şutsuz kendi kalesine gol, seken şutun son dokunan/atan kimliği ve asist tanımının eski olaylara eşlenmesi; mevcut kabul her golün önce aynı oyuncunun şutunu gerektirir.
- Kalecinin topu ikinci kez elle alması/tutma ihlali ve dolaylı serbest vuruş; kaleci atılırsa kimin kaleye geçeceği; yedek/değişiklik ve az oyuncuyla maç bitirme sözleşmesi.
- 8. işte xG kalibrasyonu, şut sıklığı/yeri, ikinci şutlar, kaleci özelliklerinin zorluk dağılımı, pas/faul/kart ve yüksek ıska oranı birlikte ölçülmeli. Gol/kurtarış kotası veya sonuca ayrı zar eklenmemeli.

## Dal ve birleşme

Bu dal silinmeyecek. Main yalnız tam doğrulama sonrası birleştirilecek; son main SHA'sı ve gerçekten silinebilecek mevcut dallar kapanış raporunda belirtilecek. Önceki işlerin raporları tarihlerinin ölçümü olarak aynen korunur.
