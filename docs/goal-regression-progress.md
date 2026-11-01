# Gol artışı — dar kapsam ve sabit kabul

1 Kasım 2026. Başlangıç: fix/3d-remaining-feature-parity / 97d99fcfad169c4ccf156b2d53884a4f123c4023. Karşılaştırma main d86ac72de6bc4677a2357fc516c06e1ffeceed48; iki uzak baş doğrulandı. Yeni dal fix/3d-goal-regression. Node 22.23.4. Önceki dosyalara dokunmadan ayrı clone; kopuk worktree/Node bağlantısı birer girişimde aşıldı.

Tek ürün kabulü G1: Aynı 50 tohum/54.000 adım sözleşmesindeki gol 2,76→16,92 ve şut 17,64→48,46 artışının nedenini kod/olay iziyle ayır; nedeni gösteren kırmızı testi yaz, yalnız kanıtlanan kusuru düzelt. Diğer yeni fizik özelliklerini, normal şut/kaleci davranışını ve kayıt/devamı koru. Uzun ölçümü doğal kısa maçlarla karıştırma. Gol kotası/sonuç çarpanı, seed/eşik/golden/lint baseline değişikliği yok.

G1 çözüm yaklaşımı sayacı: **7/7**. Son devam talebiyle 6–7 de kaydedildi ve başarısız ürün farkları geri alındı. İlk iki deneme, “Dene ve devam et” ile yetkilendirilen 3. yaklaşım ve “Tamam denemelere devam edebilirsin” ile bu devam turunda yetkilendirilen 4–5 korunur. Bu yeni yetki eski başarısızlıkların sayacını sıfırlamaz. Önceki iki başarısızlık korunur. Salt okuma teşhisi, tarihsel commit karşılaştırması ve kırmızı test çözüm yaklaşımı sayılmaz. Uygulama + ilgili kabul bir denemedir; başarısız ürün farkı geri alınır ve ayrı yeniden üretme korunur. Önceki görevin altı başarısız hareketi ve diğer açık maddeleri bu işte yeniden denenmez; sayaçları korunur. Aşağıdaki eski 2/2 ve uygulanmamış öneri kayıtları ek onaydan önceki durumu anlatır.

Bağımlılık: Başlangıç varsayımı yok. Önce 901/731/42 tohumlarında küçük karşılaştırma ve tarihsel commit daraltması; kesin neden bulunduktan sonra ürün değişikliği. Odaklı test/ölçümden sonra bir geniş doğrulama. Performans, diğer kariyer fixture'ları ve 3D tekrar ayrı sonraki işlerdir; başarısız kapılar gizlenmez. Main'e merge/yayın yok. PR yalnız zorunlu kapılar geçerse.

Önceki ölçümler docs/measurements/3d-remaining-parity içinde korunur. Yeni kanıtlar aynı adları/raporları ezmeden ayrı klasöre yazılır. AGENTS.md commit kontrolleri uygulanır; kapsam dışı bir kapı başarısız olursa neden ve sapma açıkça kaydedilir.

## Birinci yaklaşım

90ea733 üç sabit tohumda 9 gol, korner/servis commit'i 8c99b45 41 gol, son aday 43 gol. İlk büyük sıçrama 8c99b45'te. 901 olay izinde servis sonrası savunmacı hedefleri x≈20–22/y=-34 iken gerçek karşılama x≈40/y≈-2; üç savunmacı alıcı çevresinden ayrılıyor. Ulaşılamayan orta için son ufuk noktasını seçen simulationInterceptTarget bunu üretiyor. Kırmızı geometri testi hedef (21,23;-34) nedeniyle başarısız; ulaşılabilir orta ve normal serbest top karşı örnekleri geçti. İlk ürün yaklaşımı yalnız ulaşılamayan ortada en yakın oynanabilir geçiş noktasını korur; gerçek erişilebilir kesme ve diğer toplar aynı kalır. Sonuç ölçümü beklenir.

Birinci yaklaşım sonucu: geometri kabulü 3/3 geçti ama aynı üç tohumda 43 yerine 44 gol (15/14/15), dolayısıyla G1 başarısız. Yalnız bu yaklaşımın ball-chasing ürün farkı kaldırıldı. Patch ve kırmızı geometri yeniden üretmesi tests/reproductions altında korunur. Bu savunma hedefi sorunu büyük gol artışını açıklayan yeterli neden değildir.

## İkinci yaklaşım

Gol izinde kaleci orta uçuşu boyunca mevcut topun kanadını izliyor; orta merkeze inerken ters tarafta kalıyor, kurulamıyor. 901 ilk golde atışta kaleci y=+2,069, şut karşı köşeye; gereken uzanma 2,139 m, mevcut ek uzanma 0,749 m. Bu normal şut sonucunu değiştiren bir katsayı değildir. Yeni kırmızı test, merkeze gelen aynı kesintisiz uçuş için iki hücum yönü/iki kanatta kalecinin merkezi alanı önceden örtmediğini gösterir. İkinci yaklaşım yalnız cross uçuşunda gerçek fiziksel iniş noktasını açıortay hedefinde öngörür; diğer pas/şut, hız, tepki, erişim, RNG ve sonuç çözücüsü korunur. Üçüncü ürün yaklaşımı yoktur.

İkinci yaklaşım sonucu: yerel kaleci/iki yön/iki kanat kabulü 5/5 geçti; aynı üç tohumda gol 18/10/9 (toplam 37), son aday 17/14/12 (43), taşıma commit'i 4/4/1 (9). Büyük artış giderilmedi ve 901 daha kötüleşti. G1 başarısız; yalnız ikinci yaklaşımın keeper-positioning ürün farkı da geri alınır. İki patch ve ayrı kırmızı yeniden üretmeler korunur. Yeni ürün çözümü uygulanmayacak; yalnız nedensel ayrıştırma/teslim doğrulaması tamamlanır.

## Son ayırma ve durum

8c99b45 üzerinde yalnız restart-decision.js önceki 90ea733 sürümüne alınınca üç seed 1/2/3 gol, toplam 6 oldu (8c99b45: 14/12/15, toplam 41). Bu tanı kontrolü yeni duran-top servis seçimini kapatır; nihai ürün çözümü değildir ve aday dala alınmadı. Probe worktree de eski haline döndürüldü. Yeni servis yolunun büyük artıştaki nedensel payı doğrulandı; oyuncu yerleşimi/orta seçimi/ilk kontrol/atış zincirindeki tam alt neden henüz izole edilmedi.

G1 çözümü **başarısız, 2/2**. Yeni adayın src/ ağacı 97d99fc ile aynıdır. Üçüncü ürün yaklaşımı yok. Dört yönlü yerel testin geçmesi veya toplamın 43→37 olması yeterli başarı sayılmadı. Başarısız ürünler geri alındığı için daha büyük 50 tohum/güç/video paketi tekrar başlatılmadı. AGENTS.md commit lint/hızlı kontrolü bir kez çalıştırılır; performans veya başka özellik düzeltmesine geçilmez.

## Tek pozisyonun temas ayrıştırması

Kullanıcının devam talebiyle yalnız tanı kaydı eklendi; G1 iki başarısız ürün yaklaşımı 2/2 olarak korunur. Son adayın 901 ilk golü: servis 332,2; ilk kontrol 334,665085415; şut 335,1; gol 335,598738005. İlk kontrolde en yakın savunmacı 4,128585 m, şutta 3,840997 m; temas yarıçapı dışında. Bu vaka eksik çarpışma kanıtı değildir; boş alan ilk kontrolden önce oluşuyor. Önceki hedef/kaleci yamaları yeniden uygulanmadı. Tek korner öncesi checkpoint ile bütün maçı tekrar koşturmadan yeniden üretme eklendi. Ürün kusuru için yeni kesin kırmızı kabul henüz kurulmadığından ürün kodu değiştirilmedi.

## 2 Kasım: kanıtlanan markaj önceliği ve uygulanmamış öneri

G1 geçmişi 2/2 olarak korunur; yeni ürün denemesi uygulanmadı. Aynı checkpoint servis anında (332,2 sn), planSimulationBoxDefence iki markajı home-LW (köşede, gerçek kale uzaklığı 33,866 m) ve home-LCM (11,685 m) için kullanıyor. Gerçek alıcı home-ST (10,904 m) listeye girmiyor. boxReceiver ve sıralama yalnız x eksenini kullanıyor; y=-33,865 konumundaki kornerci x farkı 0,331 olduğu için öncelik alıyor. Bu, önceki hedef kovalama/kaleci tahminlerinden farklı, doğrudan seçim listesinde gözlenen hatadır.

corner-mark-priority.cjs: Node 22.23.4, iki yön × iki kanatta 4 kırmızı kabul aynı yanlış home-LW/home-LCM listesini gösterdi. Normal orta dışı davranış karşı örneği geçti (1/1). Bu tanı testi varsayılan CI dışında tutuldu; ürün kodu değişmedi.

corner-mark-priority-proposed.patch yalnız cross uçuşunda mevcut receiverDistance değerini gerçek iki boyutlu kale uzaklığıyla değerlendiren ve aynı uzaklıkla sıralayan inceleme önerisidir. Eşik, markaj sayısı, hız/erişim, RNG, gol veya kurtarış sonucu değiştirmez. Patch UYGULANMADI, kabul edildiği veya gol artışını giderdiği iddia edilmez. Bunu uygulayıp test etmek G1 için üçüncü ürün denemesi olacağı için ilk kullanıcı talebindeki iki yaklaşım sınırı nedeniyle açık ek yetki gerekir. Önceki denemelerin adları/sayaçları değiştirilmez.

## Kullanıcı onayıyla tek ek deneme — G1 3/3

2 Kasım 2026: Kullanıcı, somut markaj önerisi için sorulan tek ek denemeye “Dene ve devam et” yanıtını verdi. Önceki iki başarısızlık silinmez; toplam bütçe yalnız bu düzeltme için 3/3 olur, dördüncü yaklaşım yoktur. Önce dört aynalı kırmızı markaj kabulü tekrarlandı (4 başarısız / 1 normal karşı örnek başarılı). Sıra: önerilen patch → aynı kabuller → aynı korner → aynı 901/731/42 → ancak azalma varsa geniş ölçüm. Başka ürün/perf/tekrar işi eklenmez.

Üçüncü yaklaşımın yerel sonucu: yalnız `flight.cross` için alıcı uzaklığı gerçek iki boyutlu kale uzaklığı oldu. Dört kırmızı kabul yeşil; normal top karşı örneği ve orta uçuşunda kayıt/devam eşitliğiyle varsayılan `match-sim-corner-mark-priority.test.cjs` 6/6. Aynı doğal kornerde ilk kontroldeki en yakın savunmacı 4,128585→1,753223 m; eski gol yerine gerçek şut/kurtarış zinciri oluştu. Konum, RNG veya sonuç zorlanmadı.

Üç sabit tohumda 17/14/12→11/5/12 gol (43→28); bu nedenle tek 50-tohum ve 20 kısa maç ölçümüne geçildi. Aynı 50 tohum/54.000 adımda gol ortalaması 16,92→10,30 (%39,1 azalma), şut 48,46→38,48. Main 2,76 gol/17,64 şut; G1'in genel denge kabulü açık. 20 doğal kısa maçta gol 1,05→0,80, şut 8,80→7,80, top kaybı 31,20→30,20. İki sözleşme birleştirilmez. Markajdaki bağımsız ve kanıtlanan başarı tutuldu; dördüncü ürün yaklaşımı uygulanmadı. İlk iki başarısız yama geri alınmış kalır.

Mevcut referansla karşılaştırma seed 901'de 1–0 yerine 6–5 skoruyla başarısız. Referans/golden/eşik/CI değiştirilmedi; ilk skor farkı zaten kapıyı durdurduğu için 400 ek güç maçı ve beş süre taraması yeniden başlatılmadı. PR/merge/yayın yok. Sürüm 7.19.4 yalnız yayımlanmamış adaydır. Ölçümler ve dar devam promptu `goal-regression-report.md` içindedir.

Son commit kontrolleri: Node 22.23.4, lint temiz; test:fast 592 başarılı / 1 mevcut atlama, performans 5/5, build başarılı. Tam test/smoke ve yeni WebGL/iPhone kanıtı bu dar teslimde yeniden çalıştırılmadı.

## Ek deneme sonrası devam: yalnız tanı

Kullanıcının “Devam et” mesajıyla farklı doğal seed 42'nin ilk golü incelendi. G1 3/3 ve markaj düzeltmesi korunur. Kart/eksilme öncesindeki kornerde kaleci, mevcut tahmine göre saha içinde ulaşamayacağı top için `intercept` görevi alıyor; `keeperFollowsFreeBall` bu görevi kabul ederek normal konumlanmayı erken kesiyor. Gerçek checkpoint'te yeni kırmızı kabul 1 başarısız; ulaşılabilir orta ve normal serbest top karşı örnekleri 2/2 başarılı. Test ayrı reproductions dosyasında, CI dışında. Stoperin markaj/cover devri de gözlendi; aynı erişilemezlik hükmü ona genellenmedi. Ürün değişikliği veya dördüncü yaklaşım uygulanmadı; ayrıntı `remaining-keeper-cross-diagnosis.md`.

Bu tanı commit'inin kontrolleri: Node 22.23.4 lint temiz; test:fast 592 başarılı / 1 mevcut atlama, performans 5/5. src/ ağacı değişmedi; sürüm artırılmadı.

## Devam izni — G1 ek yaklaşımlar

Kullanıcı “Tamam denemelere devam edebilirsin” diyerek devam denemelerini yetkilendirdi. Önceki G1 1/2 başarısızlıkları ve 3. yaklaşımın kısmi markaj başarısı korunur. Bu devam turunda en çok iki ek yaklaşım uygulanır: önce 4, gerekirse farklı kanıtla 5; aynı G1 yeniden adlandırılmaz. İlk kabul aynı: korner/servis kaynaklı artışı kesin kırmızı kabul ile azaltmak, normal futbol/kaleci/kayıt davranışını korumak. Bu sınırda başarısız ürün farkları geri alınır, somut başarılar tutulur.

4. yaklaşım başlamadan: kaleci, gerçek orta uçuşunda mevcut fizik tahminine göre saha içinde erişilebilir bir karşılama noktası yoksa `intercept` görevinin fallback hedefiyle normal konumlanmayı atlamamalı. Erişilebilir orta ve normal serbest top çıkışı, ayakla taşıma, iki yön/iki kanat ve kayıt-devam korunmalı. Önceki iniş alanı hedefi veya saha oyuncularının fallback hedefi değiştirilmez. Yeni alan/denge katsayısı/RNG değişikliği yok. Sayaç 4/5; 5 henüz uygulanmadı. Sıra kırmızı kabul → dar düzeltme ve ilgili testler → aynı 901/731/42 → azalma varsa tek geniş 50/20 ölçümü.

4. yaklaşım yerel kaleci kabulü 8/8 geçti; normal ayakla kontrol/kurtarış/orta/süre kontrolleri ayrıca çalıştırıldı. Ancak aynı üç tohum 11/5/12→13/9/6, toplam 28→28 gol; şut 104→111. G1'in gol artışı kabulü tek başına başarısız. Geniş ölçüm başlatılmadı. Yama `goal-keeper-role-attempt4.patch` ile korunur; başarı diye sayılmaz.

5. ve bu devam turunun son yaklaşımı başlamadan: yüksek orta sırasında iki ayrı çağrı aynı savunma görevini bozuyor. Keeper görev geçerliliği 4'te ayrıldı, fakat `planDefensiveRoles` hâlâ pres/cover görevlerini önce atayarak merkez markajını tüketiyor. Son yaklaşım bu rol önceliğini orta uçuşuna özgü biçimde birlikte ele alır: ceza alanı markajı önce planlanır, gerçek karşılama ortak ball-chasing fiziğinde kalır; normal pas ve eski cross bayrağı olmayan kayıtlarda sıra korunur. 4'ün başarısızlığı silinmez; aynı G1 sayacı 5/5, sıfırlama yok. Önce stoperin yeni kırmızı iki yön/iki kanat kabulü; sonra birleşik 4+5 adayında ilgili kontroller ve aynı üç tohum. Genel etki kötüleşirse bu iki yeni ürün farkı kaldırılır; eski başarılı markaj düzeltmesi korunur.

5. yaklaşım sonucu: yeni kaleci 8/8 ve stoper 6/6 kabulleri geçti; gerçek temasın devam kontrolüyle varsayılan yeni testler 15/15. Aynı üç tohum 13/9/6→5/9/6 (20 toplam); önceki markaj adayı 28. Bu olumlu küçük sonuçtan sonra tek 50-tohum ve 20 kısa maç ölçüldü. 50 fizik sözleşmesinde gol 10,30→8,62, şut 38,48→35,62; main 2,76/17,64. Kısa seride gol 0,80→1,10 ve faul 2,05→2,40 arttı. Genel G1 açık. Kanıtlanan iki görev kusurunu birlikte gideren 5. yaklaşım kısmi başarı olarak tutuldu; 4 tek başına başarı sayılmaz. Altıncı yaklaşım yok.

Seed 42 aynı doğal tick 467 checkpoint'inde eski ilk kontrol/şut/gol yerine stoper 47,783895'te 1,80 m yüksekte gerçek kafa pası temasını yapıyor; top oyunda devam ediyor. Temas veya sonucu zorlayan kod yok. Bu laboratuvar checkpoint'idir, özgün kullanıcı kariyer/video seed'i değildir. Güncel ayrıntı `goal-regression-continuation-report.md` içinde.

Son commit kontrolleri: Node 22.23.4 lint temiz; test:fast 607 başarılı / 1 mevcut atlama, ayrı performans 5/5, build başarılı. Referans karşılaştırması 901 için 1–0 yerine 3–2 ile başarısız. Chromium kurulumu bozuk ZIP yüzünden başarısız; tek komutun kendi beş otomatik denemesinin iki altyapı girişimi sınırını aştığı raporlandı, tekrar başlatılmadı. Yeni WebGL/iPhone kanıtı yok. PR/merge/yayın yok.

## Kullanıcının devam talebi — altıncı yaklaşım öncesi

“Tamam denemelere devam edebilirsin” yetkisi ve sonraki “Devam et” doğrultusunda mevcut başarılar korunur; G1'in ilk beş yaklaşımı silinmez veya yeniden adlandırılmaz. Bu devam turunda en çok iki ek yaklaşım (6–7), aynı G1 üzerinde izlenir; başlangıç sayacı 6/7. Uzun/kısa sözleşmeler ayrı, eşikler/golden/ref/CI aynı.

Ön inceleme: kısa seed 202 ilk golü penaltı; faulün özgün 41,880/−18,162 konumu motorun ceza alanı içinde. Geri çağrılan avantajın yanlış noktadan penaltı ürettiği varsayımı doğrulanmadı, ürün denenmedi. Uzun seed 731 ilk golünde kaleci şut anına kadar merkeze dönüyor; golün kendisi çarpışma kusuru kanıtı değil. Mevcut yüksek-skor kuyruğunun 416 golünde servis kökeni ve hazır olmayan kaleci oranı ölçüldü; bu dağılım tek başına kök neden sayılmaz.

6. yaklaşımın sabit kabulü: merkeze doğru gelen gerçek orta, kaleciyi kanattaki o anki top gölgesine gereksiz taşımamalı; tehdit hedefi topun ilk oynanabilir alçalan yüksekliğindeki fiziksel konumu olmalı. Eski 2. yaklaşım yer temasını öngörüyordu; bu defa karşı kıyıya düşen ama ilk oynanabilir teması öbür tarafta olan ayrı kontrolle o çözüm dışlanır. 5. yaklaşımın erişilemez kaleci takip görevi iptali nedeniyle normal hedef kodu artık gerçekten kullanılıyor; bu bağımlılık mevcut çağrı zinciri ve doğal 731 kaleci hedef izinden doğrulandı. Normal lob/serbest top, ayakla taşıma, iki yön/iki kanat, kurtarış zinciri ve kayıt-devam korunmalı. Şut/kurtarış katsayısı, RNG veya başarı zorlaması yok. Önce yeni kırmızı kabuller, sonra aynı üç tohum; olumlu ise tek geniş ölçüm. Başarısızsa yalnız yeni fark kaldırılır.

6. yaklaşım sonucu: doğru maç sırası uygulanmış kırmızı kabul 4 başarısız / 3 kontrol başarılı, uygulama sonrası yeni ve mevcut görev kontrolleri 22/22. İlk test sürümünde servisten hemen sonraki `restart` rolü, normal off-ball karar adımı çalıştırılmadan sınanıyordu; bu fixture sırası düzeltildi ve aynı ürün yaklaşımında kırmızı/yeşil tekrarlandı, kabul gevşetilmedi. Ancak üç sabit tohum 5/9/6→6/10/8, gol toplamı 20→24; şut 90→112. G1 başarısız. Yalnız yeni keeperThreatPosition ürün farkı geri alındı. Patch ve yeni kırmızı kabul reproductions altında, varsayılan CI dışında korunur. Geniş ölçüm başlatılmadı.

7. ve bu devam turunun son yaklaşımı öncesi: seed 731'in üçüncü golüne giden frikik servisinde, tick 24371'de home-RB için kaba 0,25 sn grid'i hiçbir ulaşılabilir nokta bulmuyor ve (−28,057;34) hedefini döndürüyor. Oysa aynı mevcut tahmin, top 1,80 m düzlemine 1,299087 sn sonra (−41,989932;−0,508405) konumunda inerken oyuncunun 1,160084 sn'de varabileceğini gösteriyor. Yedi doğal karar anında bu fark ölçüldü. Bu, 1. yaklaşımın fallback'i daha yakına taşıması değildir; kaçırılmış fiziksel temas anı örneklemeye eklenir. İkincil karede 24383'te gereken zaman 0,099087 sn, oyuncunun mevcut kontrol erişimi içinde varış 0 sn. Yeni fizik/hız/erişim eşiği, RNG veya temas sonucu yok. Normal ve eski cross bayrağı olmayan pasların grid/fallback davranışı korunur; tüm gerçek temas yine tek fizik çözücüsünden gelir. Kaydedilmiş test iki yön/iki kanat, ulaşılamayan kaleci ve kayıt-devamı içerir. G1 sayacı 7/7; 6 geri alınmış kalır. Olumlu üç tohum sonucu yoksa geniş ölçüm yapılmaz; başarısız 7. ürün farkı da kaldırılır.

7. yaklaşım sonucu: yeni kırmızı kabul 4 başarısız / 4 kontrol başarılıydı; uygulama sonrası yeni kabul + mevcut kaleci/markaj/hava teması kontrolleri 34/34 geçti. Ancak aynı 901/731/42 tohumlarında gol 5/9/6→11/6/7, toplam 20→24; şut 90→108. Kafa şutu sayısı üç maçta toplam 20'ye çıktı; hedef düzeltmesi yalnız savunmacıları değil hücumcuların temasını da etkiledi. G1 başarısız. İkinci başarısızlıkla bu turdaki iki yeni ürün farkı da geri alınmış oldu. 7. patch, geçerli dar pencere kırmızısı ve orijinal checkpoint reproductions altında korunur. Geniş 50/20, güç, beş süre veya yeni WebGL paketi başlatılmadı. Mevcut ürün kaynakları 87d5786 ile aynıdır; sürüm 7.19.5 olarak kalır.

Bu turdaki geri alma sonrası commit kontrolleri: Node 22.23.4 lint temiz, test:fast 607 başarılı / 1 mevcut atlama; ayrı performans 5/5. Ürün src/ ağacı ve 7.19.5 metası 87d5786 ile aynı; yeni geniş denge/build/smoke/WebGL paketi başlatılmadı.
