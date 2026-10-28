# Saniyelik maç simülasyonu — şartname

Durum: Faz 4, laboratuvar/topsuz hareket ve top fiziği/pas uygulanmış durumda. Bu belge yeni motorun kural kaynağıdır. Uygulanan kurallar aşağıda kesin; sonraki adımlar amaç ve açık soru olarak ayrıdır. Godot'a taşınacak sözleşme kodun dosya yapısı değil bu belge, JSON veri ve kabul testleridir.

Laboratuvar: https://rasimoner.github.io/ManagerStory/lab.html. Oyunda bağlantısı yoktur. Kariyer, mevcut dakika motoru, 3D yönetmeni, kayıt biçimi ve V7.14.0 sürümü değişmez. Diğer lig maçları ileride de `simAIGame` ile kalır.

## Neden yeni motor

Mevcut motor dakikada bir ilerler; az sayıdaki aksiyon arasını sunum doldurur. Mevki çevresindeki LEASH kutuları topsuz hareketi sınırlar. Pasın sonucu çizgideki oyunculara ulaşmadan belirlenir; bazı uzun paslarda alıcı topa yetişmek için hızlanır. Dakika sonundaki faul zarı müdahaleden bağımsızdır. Bu motor yamalanmayacak: yeni motor kısa adımlarla gerçek konum üretir, olay günlüğü bu konumların sonucudur.

## Koordinat ve girdi sözleşmesi

- Birimler metre ve saniye. Saha 105 × 68. Orijin merkez, `x` boyuna, `y` enine; sınırlar ±52,5 ve ±34. `newview/runtime.js` içindeki `toWorld` ile ölçek aynıdır: simülasyon `(x,y)` → three.js `(x,0,y)`. Yüzdeye dönüştürülüp tekrar ölçeklenmez; ileride boyuna/enine eksen açıkça eşlenir.
- `createSimulation({ teams, seed, ball })`: karşı yönlerde oynayan iki takım ve motorun başlangıç topu. Takım `{id, direction: 1|-1, formation, tactics: {press,line,passingStyle?}, players}`. Oyuncu `{id, number, slot, attributes: {pace,acceleration,reactions,fitness,passing?,vision?,technique?,firstTouch?}, position?}`. Özellikler 0–100, kimlikler benzersiz. Diziliş yuvaları JSON'dadır; core modları bilmez.
- Başlangıç `ball: {position:{x,y}, teamId, ownerId?, velocity?:{x,y}, height?, verticalVelocity?}`. `ownerId` yoksa serbesttir; `teamId` son sahiplik takımını, `lastTouchTeamId` son teması taşır. Konum/hız/yükseklik/sahiplik bundan sonra motorundur. Özelliklerde verilmeyen dört yeni alan JSON'daki 65 değerini alır; verilmiş geçersiz değerler reddedilir.
- `stepSimulation(simulation)` tam bir adım atar. `advanceSimulation(simulation,{seconds})` kare zamanını biriktirir. `readSimulation` bağımsız düz nesne kopyası verir; `{includeEvents:false}` günlük büyüdükçe her çizimde geçmişi kopyalamamak içindir. `placeSimulationBall` doğrulanan bir **hakem müdahalesi**, `requestSimulationPass` kesilebilir bir elle pas isteğidir. Eski ikinci `ball` parametresi yalnız değişmemiş topsuz kabul testlerinin tekrarında korunur; laboratuvar bunu kullanmaz. Girdi nesnelerine, `S`, `M`, kariyer ya da kayda yazılmaz. Geçersiz takım, özellik, tohum, konum ve negatif zaman açık hata verir.

## Saat ve karar

- Sabit adım `clock.stepSeconds`: 0,1 sn. Saat kayan noktalı toplama yerine tam adım sayısı × adım süresidir. Çizim kare hızı ve 0,25×/0,5×/1×/2× yalnızca biriken zamanı değiştirir. Atlanan kareler adım atlamaz. Arka plana gidince laboratuvar durur; dönüşte geçen duvar zamanı simüle edilmez.
- Oyuncunun tepki süresi `ceil((0,6 − 0,3 × reactions/100)/0,1) × 0,1`: 0,3–0,6 sn. Her oyuncu kendi karar saatinde hedefini yeniler. Top sahipliği değişince yeni faza ilk tepki için bu süre yeniden beklenir; basan aynı anda değişmez. Süre, top değişimi ile ilk pres kararı arasında ölçülür; azami hıza ulaşma süresi değildir.
- Her karar turunda en yakın uygun saha oyuncusu adaydır. Adayın karar zamanı gelmediyse daha uzaktaki oyuncu onun yerine seçilmez. Yeni basan seçilince eski basan bırakır; aynı takımın en fazla `roles.maxPressers` oyuncusu basar.
- Topsuz karar ve hareket zar çekmez. Pas seçimi de deterministiktir. Çekirdek yalnız pas uygulamasının yön/hız sapması ve ilk dokunuş/sekme için `core/random.js` `R(seed)` kullanır; durum `rngState` ile görünürdür. Aynı tohum, aynı başlangıç ve aynı müdahale adımları aynı konumları ve olayları üretir. Laboratuvar özelliklerine yeni teknik alanlar eklenirken önceki fiziksel özellik zar dizisi korunur.

## Hareket

Tüm katsayılar `src/data/match-sim.json`'dadır. Hız `5,2 + 3,8 × pace/100` m/sn, ivme `2,4 + 2,6 × acceleration/100` m/sn². İkisi de `0,72 + 0,28 × fitness/100` ile çarpılır. Bu aşamada kondisyon tüketilmez; girdideki kondisyon kapasiteyi etkiler.

Oyuncu hedefe hız ve ivme sınırlarıyla yaklaşır; durma mesafesine göre frenler. İvme sınırı hız vektörünün değişimine uygulanır, sadece sürat artışına değil. Yön saniyede en fazla `movement.turnRate` radyan döner. Aciliyet mesafeyle yürüyüş, hafif koşu, koşu veya sprint seçer; basan sprint ister, yakında frenler. Hedefe varınca küçük durma toleransı titreşimi önler. Saha çizgisine yaklaşırken her eksen ivmenin 1/√2 payıyla durma mesafesi ayırır; sonraki adımın yolu da hesaba katılır. Önce zorunlu sınır freni, kalan vektör ivmesiyle hedefe yönelme uygulanır. Konum kırpılmaz ve hız aniden sıfırlanmaz. Kaleci kendi kalesi ile topun açısına göre ayrı bir konum alır.

Oyuncunun mevkii bir çapadır. LEASH gibi başlangıç noktasına bağlı kalıcı bir kutu yoktur. Farklı rol hedefleri başlangıç mevkiinden uzaklaşabilir. Bu ilk aşamada oyuncu–oyuncu fiziksel çarpışması ve ofsayt kısıtı yoktur; daha sonraki temas adımında ele alınır.

## Takım fazları

| Faz | Başlangıç | Çıkış |
|---|---|---|
| Topa sahip (`possession`) | Geçiş penceresi bittikten sonra top bu takımda | Topu kaybetme |
| Savunmada (`defending`) | Karşı pres penceresinden sonra top rakipte | Topu kazanma |
| Kazanma (`winning`) | Gerçek kontrol sahipliği bu takıma geçirir | `phases.winningSeconds` sonra sahip olma |
| Karşı pres (`counterpress`) | Gerçek kontrol topu rakibe geçirir | `phases.counterpressSeconds` sonra savunma |

Kazanma fazı genişleme ve destek hedeflerini, karşı pres fazı veriyle büyütülmüş pres tetik mesafesini kullanır. Faz etiketi değişir; oyuncunun fiziksel konumu sıçramaz.

## Topsuz roller

- **Basan (B)**: kaleci dışındaki en yakın uygun oyuncu, taktiğin tetik mesafesi içindeyse ve kendi tepki süresi dolmuşsa topa sprint hedefi alır. Mesafe eşitliğinde sabit kadro sırası kazanır. Pres sınırı takım başınadır.
- **Örten (Ö)**: basanın arkasında, top ile kendi kalemize en fazla ilerleme sağlayan gerçek rakip alıcı arasındaki tehlikeli pas çizgisine yerleşir. İleri alıcı yoksa kale yönü güvenli referanstır. Hedef veri mesafesi kadar çizginin içindedir. Basanı, alıcıyı ve hedefi durum taşır; laboratuvar çizgiyi gösterebilir. Sayı `coverCount` ile sınırlıdır.
- **Markaj (M)**: baskı ve örtmeden kalan uygun oyunculardan biri, kaleye yakın tehdit alıcıyı kale tarafından gölgeler. Kalanlar blok (H) çapalarına döner.
- **Destek (D)**: topa sahip takımda uygun iki oyuncu topun arkasında iki pas açısı kurar. Destekler ayrı hedef alır.
- **Derin koşu (K)**: topa sahip takımın ileri hat oyuncusu hücum yönünde alan açar. Bu, henüz pas isteği veya ofsayt kararı değildir.
- **Kaleci (KL)**: top boyuna ilerledikçe kalesinden çıkar, enine top yönünde sınırlı kayar. Baskıya katılmaz.

Roller takımın karar anlarında güncel konumlardan yeniden planlanır; bireyin hedefi kendi karar saatinde değişir. Rol aktarımı pres sayısını aşamaz. Top taraf değiştirdiğinde önceki fazın rolleri karar süresince fiziksel olarak toparlanır.

## Blok ve taktik karşılıkları

4-2-3-1 ve 4-4-2 sadece laboratuvar verisidir. Oyundaki `SLOT_POS` ve `oppRadarPos` değiştirilmez. Savunma, orta saha ve hücum hatları merkezlenmiş normalize çapalardan üretilir.

Savunmada temel hedef boy 32 m, en 40 m; rol hedefleri için takımın ortak hareket zarfı en çok 38 × 44 m. Bunlar oyuncuya özel kafes değildir: zarf bütün takım için topa ve taktiğe göre yer değiştirir. Kaleci ölçüm dışında, **basan ve örten dahil** tüm saha oyuncuları ölçüm içindedir. Normal yerleşmiş savunmada kabul aralığı boy 25–40 m, en ≤45 m. Gerekçe: üç hattın yaklaşık 12–16 m aralıklarla bağlantılı kalması ve kanatta yardımın yetişebilmesi; bütün sahayı enlemesine kapatmak savunma boşluklarını gizler. Sahiplik değişiminden hemen sonra hız/ivme sınırı nedeniyle yerleşme süresi vardır; aralıklar her geçiş karesine anlık zorlanmaz.

Topa sahipken hedef boy 48 m, en 56 m: genişlik pas açılarını, boy derin koşuyu açar. Top kanada gittikçe blok merkezi topun tarafına kayar; saha sınırında hedefler saha içine sığar. Savunma hattı `Geride/Normal/Önde` blok merkezini geriye/öne taşır. Pres `Düşük/Normal/Yüksek` sırasıyla 12/19/27 m tetik mesafesi verir. Seçeneklerin dili tek kaynak `data/tactics.json`; yeni davranış katsayıları `match-sim.json` içindedir. Pas stili top/pas adımında uygulanır; diğer taktikler bu işte uygulanmış sayılmaz.

## Top fiziği ve pas

### Fizik ve kontrol

- Topun yatay konumu/hızı metre ve metre/sn, yüksekliği metre, düşey hızı metre/sn. Yerden hız `ball.rollingDeceleration = 1,25 m/sn²` sabit sürtünmeyle azalır. Adım içindeki yol analitik olarak `v·t − a·t²/2`; durma anından sonrası sıfır hızdır, tersine dönmez. Örneğin 10 m/sn serbest top 8 sn ve 40 m sonra durur. Bu, pasın kendiliğinden hedefe bağlanmasını önler.
- Havada yatay hız sabit, düşey ivme `9,81 m/sn²`; uçuş basit paraboldür. İniş anı adımın içinde çözülür; kalan süre yerde sürtünmeyle ilerler. Spin, hava direnci, rüzgâr ve çim farkı bu işte yoktur.
- Kontrol yarıçapı **1,2 m**: ayak/gövde erişimi için küçük bir pay; oyuncuyu çekmek veya uzağı sahiplenmek için kullanılmaz. Kontrollü top sahibin yönünde **0,35 m** önündedir; saha sınırında topun bu ofseti sınır içinde kalır. Sahibin ataletle frenlemesi gerçek ivmeyle olur; sürme hedefi verilmez.
- Ulaşılabilir yükseklik **1,8 m**: sıçrama ve kafa mücadelesi olmadan basit gövde/ayak erişim zarfı. Havadan pasın çıkışı ve inişi kesilebilir; yüksek orta bölümü kesilemez. Uçuşun alçak bölgesi adımın içinde başlarsa o kesişme zamanı da bulunur.
- Her serbest top adımında top ve oyuncunun gerçek önceki/sonraki konumları arasında bağıl süpürülmüş kontrol dairesi çözülür. Bu, hızlı topun adımlar arasında oyuncunun üstünden atlamasını önler. En erken temas kazanır; aynı zamanlı rakip/alıcı temasında savunmacı önceliklidir. Kontrol ve saha dışı aynı adımda yarışır; önce çizgi geçilmişse daha sonraki temas sahiplik vermez. Oyuncu hiçbir yerde ışınlanmaz. Sabit 0,1 sn içindeki doğrusal temas yaklaşımının yerdeki eğri hız profiline göre konum farkı milimetre düzeyindedir.

### Karar, uygulama ve ilk yetişen

Sahip, tepki/teknik özellikleri ve yakındaki baskıya göre en az tepki süresi kadar tutar; taban tutma 0,85 sn, düşük özellik ilavesi en çok 0,7 sn, baskı en çok 0,4 sn kısaltır. Pas yönüne fiziksel dönüş sınırıyla döner ve frenler. Şut veya sürme seçeneği yoktur. Müdahale sonraki işte olduğu için basan oyuncunun hedefi sahibin içinden geçmez: pas açısını baskılamak için 2,4 m yaklaşma mesafesi bırakır. Bu bir temas engeli veya ışınlanan çarpışma değildir.

Her takım arkadaşı ve onun önündeki 6 m koşu alanı (hareket hızından 0,5 sn ek öngörüyle, saha içine sığdırılarak) değerlendirilir. Yerden pas hızı `min(25, 10 + 0,28·mesafe)` m/sn. Yerden çizgi güvensizse havadan seçenek de denenir; onun uçuş süresi `0,9 + 0,04·mesafe` sn, ilk düşey hız `g·süre/2` olur. Topun süre hesabı bu gerçek fizikledir.

Alıcı zamanı hız vektörü, ivme, azami hız, tepki ve dönüşten hesaplanır. Rakibin alt zaman sınırında ek dönüş/tepki gecikmesi verilmez: gelişmekte olan pası zaten okuyor olabileceği için bu ihtiyatlı bir güvenlik hesabıdır. Yol, **her 0,1 sn ve hedefte** kontrol edilir; yalnız hedefteki rakibe bakılmaz. Yüksek uçuş örnekleri kontrol hesabından çıkar. Azami koşuyla bile ilgili örneğe ulaşamayacak rakip pahalı hesaba girmez. İlk riskli örnekte seçenek güvensiz sayılır; sonraki örnekleri hesaplamak kararını değiştirmez.

Seçim; ilerleme, hedef çevresindeki boşluk, varış farkı ve pas stilinin tercih ettiği mesafeden oluşan JSON ağırlıklarıyla yapılır. `vision`, görülebilen mesafe ufkunu 16–76 m arasında değiştirir. `Kısa/Dengeli/Direkt` seçenek adları `tactics.json` kaynağından gelir. Alıcının ulaşamadığı seçenek otomatik seçilmez. Üç saniye boyunca güvenli seçenek yoksa ulaşılabilir riskli çıkış seçilebilir; kesilme yine fiziksel olarak çözülür. **Pas bırakılırken seçilen çizgi yeniden değerlendirilir**; önceki karardaki güvenli etiket sonucu garanti etmez.

`passing/100` eksikliği ve 6 m içindeki baskı yön sapmasını ve hız hatasını ölçekler; iki seed'li uygulama zarı çekilir. Mükemmel passing bu hatayı sıfırlar. Önceden başarı zarı veya sonucu yazılmış pas yoktur. Top yola çıkınca alıcı ve topa yakın iki oyuncu/takım, kendi tepki süresinden sonra tahmini karşılama noktasına sprint hedefi alır. Bu hedef en çok 5 sn uçuş ufkunda aranır; asıl kontrol için yine gerçek konuma ulaşmaları gerekir. Örten/markaj/destek/bloklar güncel top konumuna devam eder; yeni sahipte eski takip rolü kalıcı olmaz.

İlk dokunuşta başarısızlık olasılığı:

`(1 − firstTouch/100) · (0,08 + 0,55 · üçBoyutluTopHızı/25) + (1 − technique/100) · 0,10`, en çok 0,85.

Bir seed'li zar buna göre gerçek teması kontrol veya sekme yapar. Başarısızlıkta yatay hızın 0,48'i (en az 2 m/sn), seed'li ±1,1 radyan sapma ve düşey hızın 0,2'siyle top serbest kalır. Aynı oyuncu 0,3 sn yeniden dokunamaz; başka oyuncu hemen kazanabilir. Havadan kontrol de aynı kurala tabidir. Bu sayılar ilk dokunuş kaybını topun gerçek hızıyla ilişkilendirir; sonraki denge işi için JSON'da ayrı tutulur.

### Geçici saha dışı kuralı

**GEÇİCİ:** taç, kale vuruşu ve korner ayrımı yapılmaz. Topun ilk çizgi kesişimi bulunur; son dokunanın rakibi tam o çizgi noktasından yeniden başlatır. En yakın oyuncu çizgiye gerçekten koşar; yalnız o oyuncu kontrol edebilir, ulaşınca normal tutma/pas kuralına döner. Kaleci seçilebilir. Gerçek duran toplar 6. işte yapılacaktır; bu basit kural o işin yerine geçmiş sayılmaz.

### Konumdan doğan günlük ve ölçüler

Olaylar `{type,time,fromId,toId,fromPos,toPos,success,…}`; zaman saniye, konumlar metredir. `pass` gerçek ayak çıkışında `success:null` ile yazılır. İlk temas veya saha dışı gerçekten oluşunca aynı kaydın `success`, `resolvedAt`, `actualToId`, `actualToPos`, gerçek `distance` alanları tamamlanır. Bu bir önceden sonuç belirleme değildir. `firstTouch`, `interception`, `looseBall`, `ballOut` olayları gerçek temas/çizgi zamanında eklenir. Hakem müdahalesi ayrı `referee` olayıdır; havadaki önceki pası başarısız olarak kapatır. Günlük sıralıdır; geçmişe dönük yeni olay eklenmez. Eski oyun günlüğüne çeviri ve 3D sahneleme bu işte yoktur.

Pas isabeti kontrolle tamamlanan / çözülen pas; ortalama mesafe gerçek çıkıştan ilk temasa/çizgiye kadar ölçülür. Bir sekmeden sonra aynı takımın tekrar kazanması ilk dokunuşu başarılıya çevirmez. Top kazanma sayısı kontrollü rakip kesmeleridir; kontrolsüz çelmeler olayda kalır. Topla oynama yüzdesi pas uçuşunda son sahip takımına yazılır; serbest top da yeni kontrol gelene kadar son sahipte sayılır. Çizgide yeniden başlama bekleyişi yüzdelerden çıkar. Oyuncunun ortalama tutması ve takımın kesintisiz ortalama sahiplik süresi ayrı raporlanır.

## Laboratuvarın sınırı ve kullanım

Otomatik mod çekirdeğin kendi oyunudur: iki takım fiziksel topa pas verir, kazanır ve kaybeder. Sahadaki bir takım arkadaşına dokunmak sahibinden elle pas ister; bu istek güvenlik seçimini aşabilir ve kesilebilir. `Elle havadan pas` aynı deneyi lobla yapar. Boş sahaya dokunmak otomatiği kapatıp hakem müdahalesi kuyruğuna top yerleştirir; duraklatılmışken önizlenir, sonraki fizik adımında uygulanır. Takım düğmeleri hakemin yeniden başlatma takımını seçer. Oyuncu konumu değişmez. Otomatik kapalıyken topun fiziği sürer, otomatik pas kararı bekler; elle istek çalışır.

Kontroller: duraklat, **0,25×**/0,5×/1×/2×, tohumla sıfırla, iki diziliş, pres, hat ve pas stili. `90 dakikayı tamamla` çizim yapmadan kalan sabit adımları tamamlar, duvar süresini gösterir ve durur; adım atlamaz. Katmanlar: roller/örtme, hat/blok, hız, çapalar; **pas seçenekleri** (yeşil güvenli, kırmızı riskli, çizgi kalınlığı değerlendirme), **seçilen pas**, **top yolu**, hedefte alıcı/rakip saniyeleri. Havada topun metre yüksekliği görünür. Köşede pas/isabet, gerçek ortalama mesafe, kesme ve iki takımın sahiplik yüzdesi vardır. Duraklatılmış sabit SVG her çizim karesinde yeniden kurulmaz; oyuncuya dokunma hedefi kararlı kalır.

Sayfa ayrı Vite girişidir; oyun hiçbir laboratuvar modülü yüklemez. Laboratuvar dosyaları çevrimdışı önbelleğe alınmaz; service worker laboratuvar ad alanını ağdan geçirebilir. Önceden kurulmuş oyun worker'ı listesinde olmayan `.js` dosyalarını reddettiği için bağımsız giriş `lab/laboratory.mjs` olarak yayınlanır; böylece kullanıcı önce oyunu açıp yenilemek zorunda kalmaz. Bu geçiş eski worker fikstürüyle ayrıca tarayıcıda sınanır. Laboratuvar kendi service worker'ını kaydetmez, kariyerin localStorage alanını okumaz/yazmaz.

## Kabul ve ölçüm

`tests/match-sim.test.cjs`: deterministik konum dizisi, değişen kare hızında aynı adım sayısı, her adımda hız/ivme/dönüş sınırları, özellik ve kondisyon etkisi, presin tepki süresi ve sayısı, gerçek pas çizgisinin örtülmesi, blok ölçüleri/kayması/genişlemesi, taktik karşılıkları, girdi ve kopya sınırı. Başsız test: 90 dk = 54.000 adım, 22 oyuncu; otomatik top betiğiyle süre ölçülür. Hız bütçesi `tests/match-sim-performance.test.cjs` içinde ayrı korunur. Tüm pahalı maç testleri bittikten sonra seri çalışır; paketlenmiş yerel motor için topsuz 3 sn, paslı 4,5 sn cömert CI sınırları vardır. Hedefler 1 sn ve 1,5 sn; gerçek ölçümler ve profil ayrımı [iş raporunda](match-sim-passing-report.md). Aynı dosya, başlangıç main sürümünün 54.000 × 22 × 2 koordinatının SHA-256 özetini birebir korur; eski testler veya altınlar güncellenmez.

### Ölçülen ilk sonuçlar (28 Ekim 2026)

Node 22.23.4, aynı ortamda mevcut tam test paketi de çalışırken. Deterministik yerleşim deneyi: tohum 731, Normal pres/hat, iki takım 4-2-3-1; merkez top 35 sn, kanat topu `(0,29)` 30 sn, aynı noktada sahiplik değişimi 35 sn. Boy/en kaleci hariç, basan dahil gerçek konumların sınırıdır.

| Durum | Boy | En | Ek ölçüm |
|---|---:|---:|---|
| Merkezde savunma | 31,0 m | 40,0 m | İlk pres tepkisi 0,4 sn |
| Kanatta savunma | 35,0 m | 40,0 m | Blok merkezi kanada 10,1 m kaydı |
| Aynı takım topu kazanınca | 50,1 m | 58,0 m | Derinlik ve destek açıları açıldı |

Başsız otomatik top deneyi: tohum 901, 22 oyuncu, 54.000 adım = 90 dakika; **16,51 saniye** (yaklaşık 327 kat gerçek zaman). Bu süre çizim içermez, telefonun kare hızı ölçümü değildir. Paralel hızlı test koşusunda aynı deney 16,10 sn sürdü. Süre bir hızlandırma hilesiyle veya adım atlayarak elde edilmez.

İlk doğrulamada Node 24 üzerinde mevcut altın maç testi hem değişmemiş `main` hem bu dalda aynı farkı verdi. Depodaki CI ile aynı Node 22 kullanıldığında altınlar değiştirilmeden geçti; doğrulama raporu Node 22 içindir.

## Sonraki adımlar — henüz uygulanmayanlar ve açık sorular

| Adım | Amaç | Karar bekleyen soru |
|---|---|---|
| Top fiziği ve pas (uygulandı) | Yukarıdaki kurallar ve kabul testleri | Spin/çim/hava direnci eklenecek mi; 1,8 m zarfı sıçrama ve kafa mücadelesine nasıl ayrılacak? |
| Sürme, müdahale, faul | Gerçek top–ayak mesafesi; hız/açı/zamanlama teması ve faulü üretir | Ayağa kayma, gövde teması, avantaj süresi ve hakem toleransı nasıl dengelenecek? |
| Şut ve kaleci | Şut uçuşundan isabet, blok, direk, kurtarış ve gol | Reaksiyon ve görüş engeli, uzanma sınırı, parmak ucu sapması ne düzeyde? |
| Orta ve duran toplar | Açık oyun ortası, kafa, ofsayt, korner, penaltı, serbest vuruş/baraj, taç/kale vuruşu, kaleci yumruğu ve elle dağıtım; avantaj ve kartlar | Hava topu zamanlaması, ofsayt anı, duran top yerleşimi ve kart eşikleri? |
| Özel hareket | Motor özellik, hız ve rakip mesafesinden seçer; 3D sadece oynatır | Başarı/başarısızlık zarfı ve hareket sırasında kontrol kaybı nasıl ölçülecek? |
| Olay günlüğü ve 3D | Konumlardan yan ürün `{type,minute,second,…}`; mevcut 3D olay alanlarıyla uyum ve gerçek konum akışı | Sürekli konum örnekleri günlüğe mi ayrı zaman çizgisine mi; tekrar/saklama bütçesi ne? |
| Taktikler | Mentalite, tempo, genişlik, pas stili, yaklaşım ve bireysel talimatlar davranış olur | Kullanıcı müdahalesinin ilk görülen etkisi ve denge sınırları? |
| Denge ve geçiş | Pres süresi, koşu mesafesi/sprintler, pas mesafesi/başarı, top kazanma yerleri, şut/xG/faul/kart dağılımları ölçülür | Hedef maç temposu ve istatistik aralıkları birlikte seçilecek; eski altınlar yeni motorun birebir skor hedefi değildir |

Yeni motor yalnız kullanıcının maçına bağlanacak. 3D entegrasyonu, denge ve kayıt geçişi ayrı işlerdir; eski motor ancak açık geçiş kararı ve testlerden sonra silinir.

### Top/pas ölçümü — 28 Ekim 2026

Node 22.23.4, tohum 901, 22 oyuncu ve aynı 54.000 adım; çizimsiz yerel paket, derleme ölçüm dışında. Üç koşunun medyanı: topsuz **0,673 sn**, top/paslı **1,291 sn** (sırasıyla 0,602–0,713 ve 1,249–1,484 sn). İlk bildirilen 16,51 sn test VM'i içindeydi; yerel paketle birebir karşılaştırma değildir. Profilleme ve aynı ölçüm türünün önce/sonrası [ayrı raporda](match-sim-passing-report.md).

1.358 pas, 758 kontrollü tamamlama, **%55,82** isabet; gerçek ortalama mesafe **25,84 m**; **15,09 pas/dk**, **186 kontrollü kesme**, ortalama oyuncu tutması **1,16 sn**, sahiplik Sarı **%49,08**, Mavi **%50,92**. Bu sayılar futbol dengesi olarak onaylanmış değildir: toplam pas fazla, isabet düşük ve paslar uzun. Sürme/şut yokken baskıdan çıkış yalnız pasla denenir; geçici yeniden başlama ve ilk dokunuş kayıpları da etkilidir. Hız hedefi sağlanırken bu sapmalar gizlenmez; sonraki denge için başlangıç ölçümüdür. Takım sahiplik süresi ve doğrulama sonuçları iş raporundadır.
