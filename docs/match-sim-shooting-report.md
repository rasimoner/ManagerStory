# Faz 4 — şut, kaleci ve gol raporu

**28 Ekim 2026 · Node 22.23.4 · Sürüm 7.14.0 değişmedi.** Dal: `feat/match-sim-shooting`; taban `47c4323`. Laboratuvar: https://rasimoner.github.io/ManagerStory/lab.html.

## Durum ve doğrulama

Şut/kaleci, fiziksel blok/direk/kurtarış, gol/skor, santra, devre/yön değişimi ve 90 dakika bitişi uygulandı. xG yalnız karar ve istatistik; gol için sonuç zarı yok. Eski oyun motoru, 3D, kariyer, kayıt biçimi ve altınlar değiştirilmedi.

Doğrulama kaynağı [PR #5'in kontrolleri](https://github.com/rasimoner/ManagerStory/pull/5/checks) ve `Verify match simulation` iş akışıdır: Node 22 lint, hızlı/tam test, build, değişmemiş **12 oyun duman kontrolü + beş laboratuvar senaryosu**, beş tohum JSON'u ve 390 × 844 telefon görüntüsü. Main'e birleşmenin önkoşulu bu kontrollerin yeşil olmasıdır. İş akışı tam git geçmişini alır; lint tabanının büyümeme testi atlanmaz. Gerçek telefon kayıt fikstürlerinin depoda henüz bulunmamasıyla ilgili eski koşullu test yeni bir atlama değildir.

**24 sentetik şut/kaleci senaryosu** vardır. İlk test grubu özellik yokken kırmızı çalıştırıldı. Tarayıcı denemesinin bulduğu santra hatası ayrıca önce kırmızı testle tekrarlandı: uzaktaki ve hâlâ koşan alıcıya merkez pası arkasından gidiyordu. Alıcı artık merkeze yakın oyuncudan seçilir; taker ve alıcı 0,5 m/sn altına fiziksel olarak frenlemeden pas çıkmaz. Varsayılan 731'de ilk kontrollü sahiplik **6,2 sn**'de oluşur; 0,25× telefon denemesi 30 sn bekleme sınırına sığar. Kalecinin eski boş top hedefinde takılı kalması, köşede ilk geçen çizginin korunması ve rakip kontrolsüz dokunuşunda geri pas yasağının kalkması da kırmızı/yeşil regresyonlarla korunur.

Eski topsuz 54.000 adım koordinat SHA-256 özeti **9b1126b840f9ad5ec641b19abbdc01fd4f66afd11acba238e6207aee31d16754** değişmez. Yeni tam maçta oyuncuların ve topun bütün adımları, olaylar ve skor aynı tohumda iki kez karşılaştırılır; her gol aynı oyuncunun önceki şutuna bağlıdır ve olaylar kronolojiktir. Yeni dosyalarda lint ihlali yoktur; taban artırılmadı. Altın dosyalar aynen korunur.

## Uygulamanın sınırı

Şut yön/güç/yükseklik hatası seed'lidir; mesafe, görünen/örtülen açı, kalecinin iki eksendeki konumu, baskı ve vücut durumu karar içindir. Aynı fizik yolu savunmacı blokları, kalecinin gerçek tepki/erişim sınırı ve kale çerçevesiyle yarışır. Topun tamamı çizgiyi geçmeden gol yoktur. Kaleci parmak ucuyla değip golü önleyemediyse temas günlükte korunur, başarılı kurtarış sayısına girmez.

Kaleci set olur, adım/plonjonla uzanır; handling yalnız temas sonrası tutma/çelme/saptırma kalitesini etkiler. Elde top dokunulmazdır; 3,5 sn sonra elle atış/elden uzun vuruş çıkar. Geri pas ve ceza alanı dışı elle alma engellenir. Birebirde oneOnOne/positioning ile çıkar; sürme, plase veya aynı parabollü aşırtma karşılık olabilir. `save` zorluğu ve son an bilgisi özel hareketler için yalnız kayıttır.

Kale ölçüleri direk merkezlerini değil **net 7,32 × 2,44 m açıklığı** ifade eder; çerçeve merkezleri bir yarıçap dışarıdadır. Açıklığın içinde kalan topa yanlış direk teması yazılmaması ayrı kabul testiyle korunur.

Gol yiyen takım santraya fiziksel olarak yerleşir ve merkezden gerçek pas çıkarır. 45'te yön değişimi, 90'da bitiş vardır; uzatma yoktur. Kale çizgisinde kalecinin elinden dağıtım / kısa korner, taçta rakip kısa pası ve önceki faul yeniden başlatmaları **7. işe kadar geçicidir**. Orta, kafa, gerçek duran top, ofsayt veya özel hareket seçimi eklenmedi.

## Ölçüm ve futbol hedefleri

Tekrar komutu: `node --experimental-vm-modules --disable-warning=ExperimentalWarning tools/match-sim-report.cjs` (Node 22). Tohumlar **901, 731, 42, 2026, 508**, iki 4-2-3-1, Normal pres/hat/tempo, Dengeli pas/mentalite, 22 oyuncu; her maç 54.000 gerçek 0,1 sn adım. Derleme, snapshot, JSON yazdırma zaman dışında.

Şut hedefi 20–28, isabet 8–10, gol 2,5–3, şut başına xG 0,10–0,12, blok 4–8, kaleci kurtarış oranı %65–75. Pas 800–1.000, isabet %75–88, ortalama mesafe 15–20 m; faul 20–25, sarı 3–5. Bunlar kullanıcı tarafından verilen karşılaştırma hedefleridir; sayaçları bu aralığa zorlayan kota yoktur. Beş maç lig kalibrasyonu sayılmaz; aralık dışı sonuçlar raporlanır.

Başarılı kurtarış / isabetli şut oranı kullanılır; gol olan parmak ucu teması paya girmez. xG farkı **gerçek gol − toplam xG**. Blok savunma takımına, şut/xG hücum takımına yazılır; tablolar iki takım toplamıdır. Direk sayısında aynı şutun çerçeveye tekrar teması ayrı fiziksel temastır.

| Tohum | Skor Sarı–Mavi | Şut | İsabet | Gol | xG | xG/şut | Gol−xG | Blok | Kurtarış | Kurtarış % | Direk |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 901 | 1–7 | 32 | 12 | 8 | 6,47 | 0,202 | 1,53 | 12 | 4 | 33,3 | 3 |
| 731 | 7–6 | 38 | 18 | 13 | 10,87 | 0,286 | 2,13 | 7 | 5 | 27,8 | 4 |
| 42 | 0–2 | 22 | 5 | 2 | 4,11 | 0,187 | -2,11 | 10 | 3 | 60,0 | 1 |
| 2026 | 2–2 | 47 | 14 | 4 | 9,80 | 0,209 | -5,80 | 25 | 10 | 71,4 | 3 |
| 508 | 10–4 | 32 | 21 | 14 | 6,77 | 0,211 | 7,23 | 5 | 7 | 33,3 | 0 |
| Futbol hedefi | — | 20–28 | 8–10 | 2,5–3 | Yaklaşık 2–3,4 | 0,10–0,12 | Kalibrasyonda 0 çevresi | 4–8 | İsabete bağlı | 65–75 | Sabit hedef yok |

| Tohum | Pas | İsabet % | Ort. mesafe m | Faul | Sarı | Kırmızı | Müdahale | Kazandı | Sekti | Iska | Iska % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 901 | 803 | 78,58 | 17,42 | 19 | 1 | 0 | 143 | 28 | 26 | 89 | 62,2 |
| 731 | 776 | 75,39 | 18,46 | 16 | 3 | 0 | 125 | 16 | 20 | 89 | 71,2 |
| 42 | 816 | 75,37 | 19,34 | 10 | 2 | 0 | 134 | 24 | 26 | 84 | 62,7 |
| 2026 | 801 | 75,91 | 18,16 | 13 | 1 | 0 | 139 | 17 | 25 | 97 | 69,8 |
| 508 | 779 | 77,54 | 18,48 | 20 | 5 | 0 | 148 | 16 | 27 | 105 | 70,9 |
| Futbol hedefi | 800–1.000 | 75–88 | 15–20 | 20–25 | 3–5 | Nadir; beş maçla oran çıkarılmaz | Sabit hedef yok | Kazanma + sekme >%50 | Aynı ölçü | <50% | <50 |

**Beş maç ortalaması:** 34,2 şut, 14,0 isabet, 8,2 gol, 7,60 xG; ağırlıklı xG/şut **0,222**, başarılı kurtarış **%41,4**. Müdahalelerin **%67,3**'ü ıska. **Futbol dengesi kabul hedeflerinde değildir**; fiziksel/işlevsel testlerin geçmesi bu kalibrasyonun tamamlandığı anlamına gelmez.

### Aralık dışı sonuçların yorumu

Şut ortalaması **34,2**, isabet **14,0** ve gol **8,2** ile hedefin belirgin üzerindedir; 731 ve 508'de **13 ve 14 gol** vardır. Son güç hatası düzeltmesinden önceki daha iyi beş maç sonuçları nihai sonuç diye tutulmadı: baskı/koşu/dönüş güç sapmasına da katılınca gerçek fizik ve bütün sonraki sahiplik akışı değişir. Aynı kaynak/tohum hâlâ birebir tekrarlanır; bu değişkenliğin kendisi denge duyarlılığıdır.

**Kurtarış %41,4 ile %65–75 hedefinin altında.** 2026'da kaleci 14 isabetten 10'unu önlerken (%71,4), 731'de 18 isabetin yalnız 5'ini önlüyor (%27,8). Kaleciyi her şutu alan sabit bir duvar yapmak veya skoru kota ile düşürmek yerine fark kayda bırakıldı. Yakın mesafeli ikinci şutlar, henüz olmayan ofsayt, savunmanın hareket/temas zarfı ve set olmadan gelen şutların gecikmesi olası etkenlerdir; aşağıdaki ölçüm tek başına bunların nedensel payını ayırmaz. 8. işte şut mesafesi/açısı, ilk ve ikinci şut ayrımı, set/tepki payı ve handling sonuçları ayrı dilimlerde kalibre edilmeli.

xG/şut **0,222** ile 0,10–0,12'nin üzerinde; maç başına **7,60 xG** de yüksek tehlike/fırsat dağılımı gösterir. Toplam xG ile gerçek gol farkı beş maç toplamında **+2,98 gol**; bu küçük örnek modele kalibre edildiği iddiası vermez. xG karar modeli saha oyuncusu için 0,72 m izdüşüm silueti, gerçek blok ise önceki 1,2 m kontrol zarfını kullanır; model/temas farkı blok ve xG dengesinde incelenmeli. Bloklar 5–25, direkler 0–4 arasında; blok ortalaması **11,8** ile yüksek. Tam örtülmüş açıda düşük değerli şut tekrarı engellenir; şut/gol sonucu önceden belirlenmez.

Pas ortalaması **795,0**; isabet ve mesafe beş tohumda da %75–88 / 15–20 m içinde. 731/508'de 776/779 pas hedefin altında. Şut, elde top ve fiziksel santra bekleyişleri önceki yalnız pas/sürme akışının süresini değiştirir; pas davranışının bütünü aralıkta diye sunulmaz. Faul ortalaması **15,6**, sarı **2,4**: çoğunluk düşük; yalnız 508'de hem faul hem sarı hedefe girer.

**Müdahale sonuçları:** 689 girişimin 464'ü ıska (**%67,3**); kazanma + sekme **%32,7**. Önceki 154'te 95 ıska (%61,7) sorunu çözülmüş sayılmaz. Jokey mesafesinden hazırlanan 0,2/0,4 sn hamlede, sürücünün serbest dokunuşu ve hareketi hedefi değiştiriyor; küçük ayak temas yarıçapı ve yön/zaman uygulama hatası ıskayı artırıyor. Temkinli fırsat marjı ile 8 sn bekleyiş de yeniden hamleyi azaltıyor. Faul için önce oyuncuya gerçekten değmek gerektiğinden bu ıskalar faul sayısını da aşağı çeker. İstenen düzeltme bu işte kota ekleyerek yapılmadı; 8. işte hazırlık/öngörü/temas geometrisi birlikte ölçülmeli.

### 90 dakika süresi

Zamanlayıcı derleme/snapshot/JSON dışında başlar; bütün **54.000 adım** ve olaylar içeridedir. Hız testindeki **üç ayrı tam maçın her birinde 2.000 ms** eşiği korunur; medyan ayrıca yazdırılır. Kanonik Node 22 masaüstü CI süreleri PR'nin `native shooting/keepers 90 minutes` satırında; aynı beş tohumun ham JSON'u ve telefon görüntüsü `match-sim-verification` çıktısındadır. Laboratuvarın telefondaki duvar süresi bu masaüstü ölçümüyle aynı değildir.

Son kaynak için yerel Node 22.23.4 raporundaki üç gerçek maç **1.813,2 / 1.218,6 / 1.296,1 ms**, medyan **1.296,1 ms** idi. Yerel kısıtlı ortamda önceki bazı başlangıç koşuları 2,4–3,3 sn sınır aşımı ve bir koşuda zamanlama duraklaması da gösterdi; bu sayılar gizlenip eşik yükseltilmedi. Son kaynak için bütün ölçüm ve tarayıcı kontrolleri PR akışında yeniden çalışır; son yeşil koşu birleşme kanıtıdır.

Yeni telefon testi şutu duraklatılmışken başlattığından yalnız başlangıç noktası olan çizgiyi görünür bekliyordu; test artık önce şutu ve boşalan sahipliği doğrular, oyunu ilerletip çok noktalı gerçek yolu bekler. Güç hatasında baskı/koşu/dönüş paylarının eksikliği ayrı kırmızı testle saptandı ve giderildi; aynı hedef/güç/seed'de her etkenin gerçek hız sapmasını artırdığı doğrulanır.

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

Birleşen `feat/match-sim-shooting` dalı silinebilecek dal olarak kapanışta raporlanır, otomatik silinmez. Son main SHA ve yayın durumu kapanış mesajında verilir; main yalnız tam doğrulama sonrası birleştirilir. Önceki işlerin raporları tarihlerinin ölçümü olarak aynen korunur.
