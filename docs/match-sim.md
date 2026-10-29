# Saniyelik maç simülasyonu — şartname

Durum: Faz 4, laboratuvar/topsuz hareket, top fiziği/pas, sürme/müdahale/faul ve şut/kaleci/gol/skor/santra/devre ve Denge 1 uygulanmış durumda. Bu belge yeni motorun kural kaynağıdır. Uygulanan kurallar aşağıda kesin; sonraki adımlar amaç ve açık soru olarak ayrıdır. Godot'a taşınacak sözleşme kodun dosya yapısı değil bu belge, JSON veri ve kabul testleridir.

Laboratuvar: https://rasimoner.github.io/ManagerStory/lab.html. V7.15.0'da laboratuvar karşılaştırması korunarak kariyere **varsayılan kapalı deneysel anahtarla** bağlantı eklendi. Açıkken kullanıcı maçı kesintisiz değişken hızlı 2D ile izlenir; 3D sonraki iştir. Diğer lig maçları yine `simAIGame` ile kalır. Kapalıyken eski dakika/3D yolu korunur.

## Kariyer adaptörü (C)

Saf `core/match/` kariyer modunu import etmez. Girdi kullanıcının mevcut ilk on biri, `M.matchPositions`/`M.matchRoles`, rakibin `opponentPlayer` kayıtları ve `oppRadarPos` düzenidir. `match-sim-career.json` serbest yerleşimi 4-2-3-1 yuvalarına, 4-4-2'yi kendi yuvalarına eşler; uyumlu roller ve en yakın başlangıç yuvası seçilir. Kullanıcının serbestçe taşıdığı oyuncunun çapa farkı korunur. Özellikler aynı JSON'daki alan okuma sırasıyla gelir; verilmemiş teknik alanın varsayılanı 65, değer sınırı 0–100; `gk.reflexes/handling/oneOnOne` doğrudan okunur. Tohum `matchSeed()`; deneysel maç başlangıcı kariyer salt'ını değiştirmez. Aynı kayıt/fikstür aynı maçı üretir.

| Kariyer seçeneği | Motor karşılığı |
|---|---|
| Pres, savunma hattı, mentalite, tempo, pas stili | Aynı adlı takım kararı; rakibin taktiğine yazmaz |
| Dar / Normal / Geniş | Ortak blok ve hedef zarfı genişliği |
| Serbest yerleşim / diziliş | JSON yuva/rol eşlemesi, kaydırılan çapalar; anlık ışınlanma yok |
| Alanı daralt | Genişlik Dar |
| Topu dolaştır | Tempo Düşük + pas Kısa |
| Hızlı geçiş | Tempo Yüksek + pas Direkt (birlikte seçilirse listedeki son talimat öncelikli) |
| Dengeli bireysel talimat | Varsayılan rol/karar |
| Topu sakla | Koruma puanı +6 |
| Daha fazla şut | Şut karar puanı ×1,18; gol zarı eklemez |
| Kısa kullan / Uzun kullan | Kaleci alıcı mesafesi 12/45 m; uzunda punt |
| Hücum yaklaşımı: Dengeli/Kanatlar/Merkez/Kontra | **Henüz etkisiz**, diğer etkili taktikler aynen uygulanır |
| Savunma arkasına koş, Ceza sahasında kal, Presi artır (bireysel), Merkeze yaklaş, Daha riskli pas, Serbest rol, Geniş oyna, İçe kat et, Bindirme yap, Geride kal, Öne çık, Süpürücü kaleci | **Henüz etkisiz**, komut `effective:false` olarak kaydedilir |
| Bağırma ve devre arası konuşması | Kariyerde mevcut moral/konuşma etkisi; motorda **henüz davranış karşılığı yok**, motivasyon komutu günlükte |

Motor olayları `matchEvent` üzerinden Türkçe yorumla aktarılır. Gol skoru bu tek kancadan artırır; adaptör skoru ikinci kez yazmaz. İkinci sarı+sarıdan kırmızı, mevcut kariyer kart kancasının beklediği tek kırmızı olayına katlanır; böylece sezon sarısı üçe çıkmaz. Dakika `minutePlayed` kancasından, kondisyon çekirdek oyuncusundan gelir; eski dakika tüketimi çalıştırılmaz. Asist gol olayındaki aynı atakta son başarılı pas kimliğidir; sezon araması rastgele son 14 olaya dayanmaz. Geçici çizgi duruşları ayrı sayaç/etikettir; gerçek korner/penaltı şutu varmış gibi yazılmaz.

**Reyting:** taban 6,5; gol +0,85, asist +0,45; şut +0,035, isabette ek +0,04; başarılı pas +0,0015, kayıp pas −0,008; kontrollü kesme +0,03, yasal müdahale +0,045; kontrol hatası −0,04; isabetli şutta kurtarış +0,10; kalecinin sahadayken yediği gol −0,40; sarı −0,20, kırmızı −1,10. Sınır 1–10. Küçük sık aksiyonlar tabanı az değiştirir, gol/kurtarış/hata/kart daha belirgindir; iyi maç 8+, çok gol yiyen veya kırmızı gören kötü maç 5 altına inebilir. Bütün ağırlıklar JSON'dadır. Bu basit kural xG'yi sonuç yerine kullanmaz.

Eski 34 maç/ekran/kariyer altın dosyaları yenilenmez. Karşılaştırma yardımcısı yalnız format 4'teki kapalı anahtar meta verisini format 3 görünümüne taşır ve Ayarlar'a bilinçli eklenen tek anahtar bölümünü çıkarır. Futbol olayları, skorlar, istatistikler ve diğer kariyer alanları hâlâ birebir hash'lenir; yeni anahtar ve göç ayrıca test edilir. Bu, eski altınlara deneysel skor yazılması değildir.

## Kesintisiz değişken hızlı 2D izleme (güncel D)

29 Ekim kapsam güncellemesi, önceki önemli-an kesmeleri ve 22 sn önden hesaplama önerisinin yerini alır. **Motor ile ekrandaki saat aynı sabit adımdadır.** Gelecek skor, konum veya olay önden oynatılmaz. Bütün 54.000 fizik adımı hesaplanır; sakin bölümde sahneyi gizleme, zaman kesmesi veya pozisyonu atlayarak yeni sahneye geçme yoktur. Görünüm oyuncuları, numaraları, topu ve top sahibini sürekli gösterir. Kareler arasındaki kısa çizim geçişi çizim içindir; motorun eriştiği zamandan ileri konum kullanılmaz.

Sunum katsayıları `match-sim-career.json.continuous`: sakin 32×; hücum kalesine 42 m yaklaşımda 12×; boyuna 28 m ve enine 50 m tehdit koridorunda 3×; şut hazırlığı/uçuşu ve önemli olaydan sonraki 2 oyun saniyesinde 1×; yeniden başlamada 8×. Bunlar futbolcu hızı/ivmesi değildir. Topun mevcut hızından 1 sn'lik doğrusal yön kestirimi yalnız yavaşlamayı zamanında başlatmak içindir; yeni fizik, başarı zarı veya gelecek olay üretmez. Düşüş 0,18 sn, hızlanma 0,8 sn zaman sabitli üstel geçiştir; bir karenin oyun süresi bu eğrinin analitik integraliyle bulunur. Aynı sabit hedefte 60/15 fps aynı süreyi üretir.

0,5× / 1× / 2× düğmeleri bütün bu izleme hızlarının çarpanıdır; **6–10 dakika hedefi 1× seçiliyken** geçerlidir. Böylece ortalama 9–15× oyun hızı amaçlanır; sakin bölümler 3–4× ile sınırlanmaz. Süre hedefi için maçın fiziği, olay sayısı veya gol/pas dengesi değiştirilmez. Kesintisiz ve başsız aynı maçı bitiren testte bütün fizik olayları, RNG ve skor birebir aynıdır. `Maçı sonuna geç` kalan adımları karelere bölerek hesaplar; sakatlıkta karar için durur, devreyi otomatik sürdürür.

**Komut sözleşmesi:** duraklatma anında fizik durur; taktik/talimat günlüğünün `tick` değeri kullanıcının gördüğü `M.matchElapsedSeconds/0,1` adımıdır. Oyuncu değişikliği isteği aynı anda kuyruğa girer, B gereği ilk gerçek futbol duruşunda uygulanır. Menü açmak topu oyundan çıkarmaz. Eski tampon gecikmesi kaldırıldı. Devre arası ve sakatlıkta biriken duvar zamanı dönüşte hız patlamasına çevrilmez; ikinci yarı santrasında alt-adım zamanı kaybedilip saat kilitlenmez.

Kare başına iş sunumda ölçülür: başlangıç adım maliyeti 0,04 ms; 7 ms hedef, en çok 512 adım ve ölçülen maliyetle uyarlama. Bütçe yetmezse fizik adımı atlanmaz; izleme uzar ve `budgetLimitedFrames` sayılır. RNG bu bütçeyi okumaz. Arka plandan dönünce geçen gerçek süre yakalanmaz. iPhone gerçek donanım doğrulaması ayrıdır; 390×844 dokunmatik Chromium ve 4× CPU yavaşlatmada bütün 1× maçın gerçek duvar süresi/RAF dağılımı Actions'ta ölçülür. Hedef dışı süre gizlenmez; ham ölçüm yüklenir.

Kayıt çekirdekte hâlâ düz `snapshotSimulation` nesnesidir. Cihazda aktif maçın ağır alanları ve tamamlanmış deneysel maç özetleri kayıpsız LZW/varint/UTF-16 arşivinde saklanır; Unicode ve RNG değişmez. Otomatik arşiv sıkıştırması ayrı Worker'dadır; duraklatma, açık kaydetme ve dışa aktarma eşzamanlı kaydeder. Sıra numarası eski bir arka plan kaydının daha yeni kaydı veya yeni kariyeri ezmesini engeller. Normal motorun kayıt yolu bu arşivi kullanmaz.

## Neden yeni motor

Mevcut motor dakikada bir ilerler; az sayıdaki aksiyon arasını sunum doldurur. Mevki çevresindeki LEASH kutuları topsuz hareketi sınırlar. Pasın sonucu çizgideki oyunculara ulaşmadan belirlenir; bazı uzun paslarda alıcı topa yetişmek için hızlanır. Dakika sonundaki faul zarı müdahaleden bağımsızdır. Bu motor yamalanmayacak: yeni motor kısa adımlarla gerçek konum üretir, olay günlüğü bu konumların sonucudur.

## Koordinat ve girdi sözleşmesi

- Birimler metre ve saniye. Saha 105 × 68. Orijin merkez, `x` boyuna, `y` enine; sınırlar ±52,5 ve ±34. `newview/runtime.js` içindeki `toWorld` ile ölçek aynıdır: simülasyon `(x,y)` → three.js `(x,0,y)`. Yüzdeye dönüştürülüp tekrar ölçeklenmez; ileride boyuna/enine eksen açıkça eşlenir.
- `createSimulation({ teams, seed, ball })`: karşı yönlerde oynayan iki takım ve motorun başlangıç topu. Takım `{id, direction: 1|-1, formation, tactics: {press,line,passingStyle?,tempo?}, players}`. Oyuncu `{id, number, slot, attributes: {pace,acceleration,reactions,fitness,passing?,vision?,technique?,firstTouch?,dribbling?,strength?,composure?,tackling?,positioning?}, position?}`. Özellikler 0–100, kimlikler benzersiz. Diziliş yuvaları JSON'dadır; core modları bilmez.
- Başlangıç `ball: {position:{x,y}, teamId, ownerId?, velocity?:{x,y}, height?, verticalVelocity?}`. `ownerId` yoksa serbesttir; `teamId` son sahiplik takımını, `lastTouchTeamId` son teması taşır. Konum/hız/yükseklik/sahiplik bundan sonra motorundur. Özelliklerde verilmeyen teknik/mücadele alanları JSON'daki 65 değerini alır; verilmiş geçersiz değerler reddedilir.
- `stepSimulation(simulation)` tam bir adım atar. `advanceSimulation(simulation,{seconds})` kare zamanını biriktirir. `readSimulation` bağımsız düz nesne kopyası verir; `{includeEvents:false}` günlük büyüdükçe her çizimde geçmişi kopyalamamak içindir. `placeSimulationBall` doğrulanan bir **hakem müdahalesi**, `requestSimulationPass` kesilebilir bir elle pas isteğidir. Eski ikinci `ball` parametresi yalnız değişmemiş topsuz kabul testlerinin tekrarında korunur; laboratuvar bunu kullanmaz. Girdi nesnelerine, `S`, `M`, kariyer ya da kayda yazılmaz. Geçersiz takım, özellik, tohum, konum ve negatif zaman açık hata verir.

## Saat ve karar

- Sabit adım `clock.stepSeconds`: 0,1 sn. Saat kayan noktalı toplama yerine tam adım sayısı × adım süresidir. Çizim kare hızı ve 0,25×/0,5×/1×/2× yalnızca biriken zamanı değiştirir. Atlanan kareler adım atlamaz. Arka plana gidince laboratuvar durur; dönüşte geçen duvar zamanı simüle edilmez.
- Oyuncunun tepki süresi `ceil((0,6 − 0,3 × reactions/100)/0,1) × 0,1`: 0,3–0,6 sn. Her oyuncu kendi karar saatinde hedefini yeniler. Top sahipliği değişince yeni faza ilk tepki için bu süre yeniden beklenir; basan aynı anda değişmez. Süre, top değişimi ile ilk pres kararı arasında ölçülür; azami hıza ulaşma süresi değildir.
- Her karar turunda en yakın uygun saha oyuncusu adaydır. Adayın karar zamanı gelmediyse daha uzaktaki oyuncu onun yerine seçilmez. Yeni basan seçilince eski basan bırakır; aynı takımın en fazla `roles.maxPressers` oyuncusu basar.
- Topsuz karar ve hareket zar çekmez. Pas seçimi de deterministiktir. Çekirdek yalnız pas/sürme uygulamasının yön/hız sapması, ilk dokunuş/sekme ve müdahalenin zamanlama/yön hatası için `core/random.js` `R(seed)` kullanır; durum `rngState` ile görünürdür. Aynı tohum, aynı başlangıç ve aynı müdahale adımları aynı konumları ve olayları üretir. Laboratuvar özelliklerine yeni teknik alanlar eklenirken önceki fiziksel özellik zar dizisi korunur.

## Hareket

Tüm katsayılar `src/data/match-sim.json`'dadır. Hız `5,2 + 3,8 × pace/100` m/sn, ivme `2,4 + 2,6 × acceleration/100` m/sn². İkisi de `0,72 + 0,28 × fitness/100` ile çarpılır. Laboratuvar karşılaştırmasında kondisyon tüketilmez; kariyer `workload:true` ile aşağıdaki tüketimi açar.

Oyuncu hedefe hız ve ivme sınırlarıyla yaklaşır; durma mesafesine göre frenler. İvme sınırı hız vektörünün değişimine uygulanır, sadece sürat artışına değil. Yön saniyede en fazla `movement.turnRate` radyan döner. Aciliyet mesafeyle yürüyüş, hafif koşu, koşu veya sprint seçer; basan sprint ister, yakında frenler. Hedefe varınca küçük durma toleransı titreşimi önler. Saha çizgisine yaklaşırken her eksen ivmenin 1/√2 payıyla durma mesafesi ayırır; sonraki adımın yolu da hesaba katılır. Önce zorunlu sınır freni, kalan vektör ivmesiyle hedefe yönelme uygulanır. Konum kırpılmaz ve hız aniden sıfırlanmaz. Kaleci kendi kalesi ile topun açısına göre ayrı bir konum alır.

Oyuncunun mevkii bir çapadır. LEASH gibi başlangıç noktasına bağlı kalıcı bir kutu yoktur. Farklı rol hedefleri başlangıç mevkiinden uzaklaşabilir. İki oyuncunun aynı topa koştuğu omuz temasında aşağıdaki ivmeyle yavaşlama uygulanır. Genel sert gövde çarpışması ve ofsayt kısıtı bu aşamada yoktur.

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
- Kontrol yarıçapı **1,2 m**: ayak/gövde erişimi için küçük bir pay; oyuncuyu çekmek veya uzağı sahiplenmek için kullanılmaz. Kontrollü top sahibin yönünde **0,35 m** önündedir; saha sınırında topun bu ofseti sınır içinde kalır. Sahibin ataletle frenlemesi gerçek ivmeyle olur. Sürme kararı bu bağlı kontrolü bırakıp aşağıdaki fiziksel dokunuşu uygular.
- Ulaşılabilir yükseklik **1,8 m**: sıçrama ve kafa mücadelesi olmadan basit gövde/ayak erişim zarfı. Havadan pasın çıkışı ve inişi kesilebilir; yüksek orta bölümü kesilemez. Uçuşun alçak bölgesi adımın içinde başlarsa o kesişme zamanı da bulunur.
- Her serbest top adımında top ve oyuncunun gerçek önceki/sonraki konumları arasında bağıl süpürülmüş kontrol dairesi çözülür. Bu, hızlı topun adımlar arasında oyuncunun üstünden atlamasını önler. En erken temas kazanır; aynı zamanlı rakip/alıcı temasında savunmacı önceliklidir. Kontrol ve saha dışı aynı adımda yarışır; önce çizgi geçilmişse daha sonraki temas sahiplik vermez. Oyuncu hiçbir yerde ışınlanmaz. Sabit 0,1 sn içindeki doğrusal temas yaklaşımının yerdeki eğri hız profiline göre konum farkı milimetre düzeyindedir.

### Karar, uygulama ve ilk yetişen

Pas seçen sahip, tepki/teknik özellikleri ve yakındaki baskıya göre en az tepki süresi kadar tutar; taban tutma 0,85 sn, düşük özellik ilavesi en çok 0,7 sn, baskı en çok 0,4 sn kısaltır. Pas yönüne fiziksel dönüş sınırıyla döner ve frenler. Bu süre sürmenin yerine geçmez: her tepki anında pas, sürme ve koruma aşağıdaki puanlarla yarışır. Basanın eski 2,4 m kaba yaklaşma hedefi fizik adımında 1,65 m kale tarafı jokey hedefiyle yenilenir; değişmemiş topsuz tekrar fikstürü eski yaklaşımı korur. Şutun tutma/uygulama kuralı aşağıdaki "Şut ve kaleci" bölümündedir.

Her takım arkadaşı ve onun önündeki 6 m koşu alanı (hareket hızından 0,5 sn ek öngörüyle, saha içine sığdırılarak) değerlendirilir. Yerden pas hızı `min(25, 10 + 0,28·mesafe)` m/sn. Yerden çizgi güvensizse havadan seçenek de denenir; onun uçuş süresi `0,9 + 0,04·mesafe` sn, ilk düşey hız `g·süre/2` olur. Topun süre hesabı bu gerçek fizikledir.

Alıcı zamanı hız vektörü, ivme, azami hız, tepki ve dönüşten hesaplanır. Rakibin alt zaman sınırında ek dönüş/tepki gecikmesi verilmez: gelişmekte olan pası zaten okuyor olabileceği için bu ihtiyatlı bir güvenlik hesabıdır. Yol, **çıkış anında, her 0,1 sn ve hedefte** kontrol edilir; yalnız hedefteki rakibe bakılmaz. Yüksek uçuş örnekleri kontrol hesabından çıkar. Azami koşuyla bile ilgili örneğe ulaşamayacak rakip pahalı hesaba girmez. İlk riskli örnekte seçenek güvensiz sayılır; sonraki örnekleri hesaplamak kararını değiştirmez.

Seçim; ilerleme, hedef çevresindeki boşluk, varış farkı ve pas stilinin tercih ettiği mesafeden oluşan JSON ağırlıklarıyla yapılır. `vision`, görülebilen mesafe ufkunu 16–76 m arasında değiştirir. `Kısa/Dengeli/Direkt` seçenek adları `tactics.json` kaynağından gelir. Alıcının ulaşamadığı seçenek otomatik seçilmez. Otomatik oyuncu güvensiz pası zaman aşımıyla zorlamaz: çıkış yoksa korur, destek bekleyişinin maliyeti artınca sürerek kurtulmayı dener. Elle pas güvenlik seçimini aşabilir. **Pas bırakılırken seçilen çizgi yeniden değerlendirilir**; önceki karardaki güvenli etiket sonucu garanti etmez.

`passing/100` eksikliği ve 6 m içindeki baskı yön sapmasını ve hız hatasını ölçekler; iki seed'li uygulama zarı çekilir. Mükemmel passing bu hatayı sıfırlar. Önceden başarı zarı veya sonucu yazılmış pas yoktur. Top yola çıkınca alıcı ve topa yakın iki oyuncu/takım, kendi tepki süresinden sonra tahmini karşılama noktasına sprint hedefi alır. Bu hedef en çok 5 sn uçuş ufkunda aranır; tepki süresi dolmuş takipçinin varış hesabına aynı tepki gecikmesi ikinci kez eklenmez; asıl kontrol için yine gerçek konuma ulaşmaları gerekir. Örten/markaj/destek/bloklar güncel top konumuna devam eder; yeni sahipte eski takip rolü kalıcı olmaz.

İlk dokunuşta başarısızlık olasılığı:

`(1 − firstTouch/100) · (0,04 + 0,28 · üçBoyutluTopHızı/25) + (1 − technique/100) · 0,05`, en çok 0,85.

Bir seed'li zar buna göre gerçek teması kontrol veya sekme yapar. Başarısızlıkta yatay hızın 0,48'i (en az 2 m/sn), seed'li ±1,1 radyan sapma ve düşey hızın 0,2'siyle top serbest kalır. Aynı oyuncu 0,3 sn yeniden dokunamaz; başka oyuncu hemen kazanabilir. Havadan kontrol de aynı kurala tabidir. Bu sayılar ilk dokunuş kaybını topun gerçek hızıyla ilişkilendirir; sonraki denge işi için JSON'da ayrı tutulur.

### Geçici saha dışı kuralı

**GEÇİCİ:** taç çizgisinde son dokunanın rakibi çizgiden kısa pasla başlar. Kale çizgisinde artık kalecinin elinden basit dağıtım / kısa korner ayrımı vardır; "Şut ve kaleci" bölümündeki kesin geçici kural uygulanır. Taker topa gerçekten gelir; oyuncu ışınlanmaz. Gerçek duran toplar 7. işte bu kuralların yerini alacaktır.

### Konumdan doğan günlük ve ölçüler

Olaylar `{type,time,fromId,toId,fromPos,toPos,success,…}`; zaman saniye, konumlar metredir. `pass` gerçek ayak çıkışında `success:null` ile yazılır. İlk temas veya saha dışı gerçekten oluşunca aynı kaydın `success`, `resolvedAt`, `actualToId`, `actualToPos`, gerçek `distance` alanları tamamlanır. Bu bir önceden sonuç belirleme değildir. `firstTouch`, `interception`, `looseBall`, `ballOut` olayları gerçek temas/çizgi zamanında eklenir. Hakem müdahalesi ayrı `referee` olayıdır; havadaki önceki pası başarısız olarak kapatır. Günlük sıralıdır; geçmişe dönük yeni olay eklenmez. Eski oyun günlüğüne çeviri ve 3D sahneleme bu işte yoktur.

Pas isabeti kontrolle tamamlanan / çözülen pas; ortalama mesafe gerçek çıkıştan ilk temasa/çizgiye kadar ölçülür. Bir sekmeden sonra aynı takımın tekrar kazanması ilk dokunuşu başarılıya çevirmez. Top kazanma sayısı kontrollü rakip kesmeleridir; kontrolsüz çelmeler olayda kalır. Topla oynama yüzdesi pas uçuşunda son sahip takımına yazılır; serbest top da yeni kontrol gelene kadar son sahipte sayılır. Çizgide yeniden başlama bekleyişi yüzdelerden çıkar. Oyuncunun ortalama tutması ve takımın kesintisiz ortalama sahiplik süresi ayrı raporlanır.

## Sürme, müdahale, faul

### Gerçek dokunuş ve hareket sınırları

Sürmede top sahibine bağlı taşınmaz. `ownerId` dokunuşta `null` olur; `ball.carry` son sürücüyü ve dokunuşu takip eder. Top aynı sürtünmeyle serbest yuvarlanır, bütün uygun oyuncular aynı süpürülmüş temas hesabına girer. Taşıma sürerken genel boş top/pas koşusu başlatılmaz: destek ve derin koşu ile basanın jokeyi ve örtenin ikinci adam hedefi korunur. Sürücü topun kontrol zarfı dışında kalırsa gerçek top noktasına yönelir; kontrolü geri almak için yine fiziksel olarak yetişmesi gerekir. Sürücünün geri kontrolü için ayrı başarı zarı yoktur; rakip önce yetişirse kontrol/ilk dokunuş normal kurallarla rakibindir. Sürücünün yön ve mesafe uygulama hatası `dribbling/technique` ile küçülür. Kontrol yarıçapı sürme sırasında genişletilmez.

`u = oyuncu hızı / topsuz azami hız`, `k = (dribbling + technique)/200`, `p = 6 m içindeki baskı (0–1)`:

- Dokunuş yolu `(0,50 + 1,55·u + 0,65·(1−k)) · (1−0,55·p)` metredir. Kusursuz, baskısız sprintte yaklaşık 2,05 m; sıkışık ve yavaş oyunda daha kısadır. Düşük teknik uzun kontrolsüz dokunuşu artırır.
- Serbest yuvarlanma süresi en az 0,3 sn; yol/hızdan bulunur. Topa bu yolu aldıracak ilk hız sürtünme hesaba katılarak verilir. Sürücü bu süre bitene kadar tekrar dokunamaz; rakip beklemez. Seed'li açı hatası en çok `0,16·(1−k)` radyan, hız/mesafe uygulama payı `0,35·(1−k)` olur.
- Hedef topla hız oranı `0,68 + 0,20·k`, yani topsuz hızın %68–88'idir. Dönüş kapasitesi topsuzun %62'sidir. Yeni kontrol geldiğinde mevcut atalet ivme sınırıyla frenlenir; hız aniden kırpılmaz. Aynı hız/ivme/saha sınırları her adımda sürer.
- Sürme yönleri hücum yönü çevresindeki JSON açılarıdır. 1,6 sn'lik koşu ufkunun yarısında ve sonunda sürücü ile rakiplerin varış farkı bulunur; sürücünün hızı yukarıdaki oranla sınırlanır. Pasla aynı `player-arrival` hesabı kullanılır. Güvenli süre farkı ±3 sn ile sınırlanır; ilerleme, dönüş maliyeti ve baskı ile puanlanır. Geriye/kenara kaçış da adaydır. Saha kenarında kırpıldıktan sonra en az 3 m gerçek koşu alanı kalmayan aday elenir; yerinde durma boşluk sayılmaz.
- Korumada hedef en yakın baskıdan 0,5 m uzağa konur. Oyuncu gerçek dönüşüyle gövdesini rakip ile 0,35 m önündeki topun arasına çevirir. Hız hedefi ayrıca %28 ile azaltılır. Strength/composure korumayı tercih etmesini, strength omuz temasındaki yavaşlamayı etkiler.

`dribble` bir kesintisiz taşıma dizisidir; her küçük dokunuş ayrı taşıma sayılmaz. `touches`, gerçek alınan `distance`, başlangıç/son konum ve bitiş zamanı aynı kayıtta tutulur. Kontrol başka oyuncuya geçince, koruma/pas seçilince, faul veya çizgi çıkışında dizi biter. Taşıma sayısı ile veri sağlayıcılarının rakip geçmeye yönelik çalım denemesi aynı ölçü değildir.

### Pas / sür / koru kararı

Karar her oyuncunun 0,3–0,6 sn tepki saatindedir; karar zarı çekilmez. İlk bakışta bütün paslar değerlendirilir. Geçerli en iyi çıkış, beş tepki aralığına kadar algı planında tutulabilir; **mevcut çizgisi her tepki anında ve ayak çıkışında yeniden hesaplanır**, güvensizleşirse bütün seçenekler hemen yeniden taranır. Bu, aynı çıkışı hazırlarken tekrar tekrar bütün takım için uçuş hesaplamak yerine oyuncunun niyetini korur. Sürme/koruma her tepki anında onunla yeniden yarışır. Laboratuvarda diğer pas çizgileri son taramayı, seçilmiş çizgi güncel değerlendirmeyi gösterir.

JSON'daki başlangıç ağırlıkları (saniye/metre ölçeklerinin puana çevrimi):

| Seçenek | Puan |
|---|---|
| Pas | `15 + 0,30·mevcutPasPuanı + 16·baskı + 2·min(tutma,7)·tempo − 0,45·abs(mesafe−20)` |
| Sür | `27 + 7·güvenliSüreFarkı + 0,65·ilerleme − 1,4·dönüşAçısı − 32·baskı + pasStiliPayı` |
| Koru | `−10 + 40·baskı + 7·(strength+composure)/200 − destekBeklemeMaliyeti` |

Yüksek başlangıç sürme puanı önünde alanı olan oyuncuyu pas bekleyerek durdurmaz; baskı maliyeti yakında kısa güvenli çıkışı/korumayı öne çıkarır. Pasın 20 m tercih ve mesafe maliyeti, güvenli kısa destekleri gereksiz uzun paslara karşı korur. Vision/composure eksikliği güvenli çıkış puanına en çok 6 puan algı maliyeti ekler; iyi oyuncu mevcut güvenli çıkışı daha az kaçırır. Görüş mesafesi önceki 16–76 m kuralıdır. `Düşük/Normal/Yüksek` tempo 0,8/1/1,2 çıkış aciliyeti verir; `Kısa/Dengeli/Direkt` sürme puanı payları −1/0/−3'tür. İsimlerin kaynağı `tactics.json`'dır.

Koruma desteği 1,5 sn bekler; sonra her saniye 10 puan maliyet eklenir. Çıkış gelmezse oyuncu en iyi sürme yönünden kurtulmayı dener. Bu kural topu ve takımı sonsuz koruma döngüsünde tutmaz; top kaybı yine gerçek serbest dokunuştan doğar. Elle uzun basılan oyuncuda sürme tercihi zorlanır; fizik ve rakip teması aynıdır.

Pas isabetini etkileyen iki fizik düzeltmesi de bu iştedir: çıkış anında rakibin kontrol zarfındaki top güvenli pas sayılmaz; tepki vermiş alıcıya ikinci tepki gecikmesi eklenmez. Otomatik kısa hedef, alıcının 0,4 sn hız öngörüsünü içerir. İlk dokunuş hata katsayıları yukarıdaki daha düşük değerlere indirildi: önceki 1.358 pasın her normal alıcı temasında yüksek kayıp üretmesi sürme tercihinden bağımsız bir sapmaydı. Karar ve takip hâlâ sonucu garanti etmez.

### Jokey, ayakla/kayarak müdahale ve omuz

Basan 5 m içinde kale tarafındaki 1,65 m hedefe geçer. Hedef rakibin tepki süresi kadar hız öngörüsüyle kayar; savunmacı rakibe bakarak geriye/yanlara hareket edebilir. Jokey hız hedefi topsuz kapasitenin %64'üdür; anlık hız/ivme sınırı korunur. Örten aynı hesabın iki kat mesafesinde ikinci adamdır. Hedef, tepki saatinde yenilenir.

Müdahale isteği gerçek top–gövde uzaklığını okur. Eşik `0,75 − 0,25·ortalama(tackling,positioning,composure)/100 − 0,12·presÇarpanı`; sarılıya 0,15 m eklenir. Pres çarpanları Düşük/Normal/Yüksek için 0,65/0,85/1,1'dir. Ayrıca top rakibin gövdesinin önünden açıkça erişilebiliyorsa ayak fırsatı görülebilir: top mesafesi + 0,30 m bacak zarfı + sarı temkini + `0,5·(1−beceri)` payı, gövde mesafesinden küçük olmalıdır. Böylece gövdenin içinden topa doğru koşmak fırsat sayılmaz.

- Ayakla müdahale en çok 1,85 m, kayma 3,10 m uzanır. Kayma için topun eşikten 0,25 m daha açıkta olması gerekir. Temel hazırlık 0,2/0,4 sn; tackling eksikliği en çok 0,25 sn seed'li gecikme ve ±0,25 radyan yön hatası ekler. Sonuç için başarı zarı yoktur.
- Hazırlık tam temas adımına yuvarlanır. Serbest top aynı top fiziğiyle; kontrollü top taşıyıcının mevcut sür/pas/şut niyeti, ivme, fren ve dönüşü aynı hareket integratörüyle ilerletilerek öngörülür. Ayağın sabitlenen nişan noktasına doğrultusu, hazırlık sonundaki gerçek savunmacı konumundan yeniden kurulur; topa kilitlenen takip veya sonuç zarı yoktur. Sonra ayağın uzandığı doğru parçası çözülür. Top için ayağın süpürme etkin yarıçapı 0,36 m, rakibin ayak/bacak zarfı 0,30 m'dir. Ayak ancak 0,36 m ve altındaki top yüksekliğine erişir. **İlk kesişim top ise** top oynanır; **ilk kesişim bacak ise** faul; hiçbir kesişim yoksa ıska. Arkadaki topa ulaşmadan bacağın içinden geçen ayak topu kazanamaz. Top ilk temas olsa da aynı ayak yolu daha sonra gerçekten bacağa giriyorsa, kaymada en az 9 m/sn, ayakta 10 m/sn müdahale hızında devam teması fauldür; topa değmek tehlikeli devam hareketini otomatik yasal yapmaz. `bodyContact` bu ikinci kesişimi taşır.
- Ayakla topa temas, top gerçek 1,2 m kontrol zarfındaysa `won`; uzaktaysa veya kaymadaysa `loose` olur. Sekme hızı en az 2 m/sn, müdahale hızının %55'idir. Serbest topu yine ilk gerçek temas kazanır. `missed` kaydının `contact:player` hali hemen ardından faul üretir.
- Kaymadan sonra oyuncu `1,2 + 1,2·(1−ortalama(acceleration,fitness)/100)` sn yerde kalır. Ayağa kalkana kadar rol, pres, serbest top kontrolü veya yeni müdahaleye katılmaz. Frenlemesi fiziksel ivmeyledir. Yeni müdahale bekleyişi 5 sn'dir; seri ayak sokmalarını ve sürekli kaymayı sınırlar.
- Aynı serbest topa aynı yönde koşan rakipler 0,8 m içinde omuz temasına girebilir. Güç `0,65·strength/100 + 0,35·hız/azamiHız`; düşük olanın hedef hızı %70'e iner. Hız/konum bir anda değiştirilmez. Sahiplik verilmez; yavaşlama sonrası ilk yetişen kazanır. Olay tekrar payı 1,2 sn'dir. Genel itme/sert gövde faul modeli bu aşamada ayrı bir zarla eklenmez.

### Faul, kart ve avantaj

Yeni çekirdek eski dakika motorunun faul zarını çağırmaz. Bir `foul` yalnız gerçek bacak temasının hemen ardından, aynı zaman ve oyuncularla yazılır. `tackle`/`duel` olmadan faul yoktur. Kod bu kaydı sahneleme öncesinde bir niyet olarak üretmez.

Şiddet `0,10·müdahaleHızı + 0,65·arkadan + 0,45·kayma + 0,55·topaŞansYok`. Müdahale hızı savunmacının gerçek sürati + 7 m/sn ayak uzanma hızıdır. Arkadan gelme, rakibin **gerçek bakış yönüne** göre geri yarı düzlemidir. Topa oynama şansı, o türün gerçek uzanma mesafesi ve ayak erişim yüksekliğiyle değerlendirilir. Sarı eşiği 2,15; doğrudan kırmızı şiddeti 3,20. Sarı sonrası fırsat marjı büyür; ikinci sarı kırmızıdır. Kırmızılı oyuncu tüm rol/kontrol listelerinden çıkarılır, fiziksel olarak frenler.

**Net gol şansı için bu aşamanın kesin kuralı:** faul yapılan oyuncunun kontrolü/taşıması olmalı; kaleye en çok 30 m, ortadaki 22 m koridorda, hücum yönüne en az 1 m/sn gidiyor olmalı. İlerisinde aynı koridorda uygun saha savunmacısı kalmamışsa `dogso:true`; arkadan da gelindiyse `redCandidate:true` ve doğrudan kırmızı. Şiddet eşiği de ayrı kırmızı adayıdır. Bu konumsal aday hesabı artık aşağıdaki kaleci erişimi/perspektif hesabıyla da süzülür. Tam DOGSO/ceza sahasında topa oynama indirimi, şut/kaleci ve gerçek penaltı işinde genişletilecektir. Kuralın dayanağı [IFAB Law 12](https://theifab.com/laws/latest/fouls-and-misconduct/)'deki kontrol, yön, kaleye uzaklık ve kalan savunmacı ölçütleridir; bu sayısal eşikler simülasyonun kendi kararıdır.

Faul yapılan takımın sahibi/taşıyıcısı kontrolü sürdürüp hücum yönüne en az 0,8 m/sn gidiyorsa avantaj başlar. Pencere **3 sn**. Bu sırada rakip kontrolü veya saha dışı atağı bitirirse ilk faul konumuna geri dönülür. Pencere sonunda aynı takım devam edip en az 1 m ilerlemişse avantaj kalır; ilerleyememişse geri çağrılır. İlk `foul` silinmez veya yeniden yazılmaz; `advantage.status` `played/recalled` olur. Bu aşamada kart kararı temas anında kayda girer. Doğrudan kırmızı/ikinci sarıda oyun durur; bu aşamada kırmızı adaylarında oyun durdurulur; gol fırsatı avantajındaki kart indirimi henüz uygulanmaz. Avantajda kartın sonraki duruşta gösterilmesi ve DOGSO avantajında gol sonucuna göre indirim, gerçek duran top/şut entegrasyonunun açık işidir.

### GEÇİCİ serbest vuruş — 7. işe kadar

Faul verilince top durur; en yakın uygun oyuncu faul yerinde taker olur. Oyuncular taşınmaz, aynı ivmeyle yerleşir. En az 2 sn beklenir; taker 0,8 m içine gelmeden ve **yerde olanlar dahil kırmızı görmemiş bütün rakipler 9,15 m** uzaklaşmadan oyun başlamaz. Kenar/köşedeki uzaklaşma hedefi 9,45 m çemberinde saha içinde seçilir; saha dışında erişilemeyen hedefe kilitlenmez. Devam eden müdahale hazırlıkları düdükte iptal edilir.

Taker topu faul noktasından, en yakın uygun takım arkadaşına doğru en çok 12 m'lik yerden pasla oyuna sokar. Bu pas da kesilebilir; `temporaryRestart:true`, en yakın rakip mesafesi ve varsa `penaltyPending` kayda girer. Kaleye yönelme/şut/baraj/penaltı vuruşu yoktur.

**Ceza alanı içi faul GEÇİCİ olarak** en yakın ceza alanı kenarının 0,30 m dışına taşınan toptan aynı pasla başlar. Ön kenar ile yan kenarın en yakını seçilir. Oyuncu konumuna müdahale edilmez; asıl faul yeri kayıtta kalır, `foul.penaltyPending:true` yazılır. Bu bir uygulanmış penaltı kuralı değildir; 7. iş bu geçici yeniden başlamanın yerini alacaktır.

### Beat kaydı; özel hareket seçimi yok

Sürücü 3 m içinde gerçekten jokey/hazır/müdahale durumundaki bir savunmacıyla karşılaşırsa temas takibi başlar. En çok 5 sn içinde kontrol aynı sürücüde kalırken karşılaşma yerinden en az 2 m ilerleyip savunmacının ilerisine geçmesi ve aradaki mesafenin 4 m'ye açılması gerekir. O karşılaşma bir kez `beat` olur: sürücü/savunmacı kimliği, ikisinin gerçek konumu, sürücünün m/sn hızı ve savunmacının karşılaşmadaki durumu kaydedilir. Oyuncu uzaktan yalnız yanından geçti diye olay oluşmaz; sahiplik kaybı takibi iptal eder. `moves.json` yüklenmez, hareket seçilmez veya 3D'ye emir verilmez.

`dribble`, `tackle` (`won/loose/missed`), `duel`, `foul`, `advantage`, `yellow`, `red`, `beat` zaman sıralı gerçek olaylardır. Sürme metreleri ve kontrollü top kazanma ayrı istatistiktir. Omuz mücadelesi takım satırlarında iki oyuncunun katılımını, toplamda tek karşılaşmayı sayar. Pas kesme ile müdahaleyle kontrollü kazanma aynı sayaç değildir.

## Şut ve kaleci

### Karar ve xG — sonuç zarı değil

Sahip, her tepki anında **pas / sür / koru / şut** puanlarını aynı ölçekte karşılaştırır. Seçim seed tüketmez. Şut en çok 38 m'den, otomatik kararda xG en az 0,032 ise adaydır; düşük finishing/composure ile 25 m ötesinin maliyeti artar. Mentalite ortak `tactics.json` seçenekleridir: Temkinli/Dengeli/Cesur şut değerini 0,85/1/1,18 ile çarpar. Finishing/composure şut tercihini, vision/composure pas algısını etkiler. Güvenli pasın alıcısı hedef konumda daha yüksek xG alıyorsa fark ×120 pas puanına eklenir; bu nedenle iyi durumdaki takım arkadaşına pas, hemen şuta üstün gelebilir. Güvenli sürme açıyı iyileştirebildiğinde sürme de kazanır.

`d`: kale merkezine metre mesafe; `a`: iki direğe çizilen ışının arasındaki radyan açı; `b`: saha savunmacılarının kapattığı kale ağzı oranı; `p`: mevcut 6 m baskı değeri; `t`: kaleye dönme açısı / π; `v`: koşu hızı / azami hız; `k`: kalecinin perspektifteki konumu.

Savunmacının etkili 0,72 m şut blok silueti (kararla **aynı fiziksel yarıçap**) kale ağzına izdüşürülür; örtüşen aralıkların birleşimi alınır, aynı açı iki kez sayılmaz. Kaleci için şutçu–kale boyuna aralığındaki oran `f` hesaplanır. Kalecinin gördüğü kale merkezinden enine uzaklığı /7,32, öne çıkıp açıyı daraltma payı `max(0,1−f)·(oneOnOne+positioning)/200` ile azaltılır. Kaleci şutçunun gerisinde kaldıysa veya yoksa `k=1`; böylece kalecinin hem boyuna hem enine konumu hesaba girer.

`L = 0,15 − 0,09d + 1,1ln(max(a,ε)) − 0,35b − 0,65p − 0,4t − 0,3v + 0,35k`

`xG = clamp(max(0,025,1−b) / (1+exp(−L)), 0,005, 0,85)`

Bu simülasyonun **yaklaşık karar/istatistik modeli**dir; gerçek maç verisine kalibre edilmiş model değildir. xG şut sonucuna, kurtarışa veya gole yazılmaz. Kale ağzı tümüyle örtülünce düşük değerli şutu tekrar tekrar seçmek yerine çıkış aranır. Şut puanı `8 + 1200·xG + 7·(finishing+composure)/200`, mentalite, baskı aciliyeti ve uzak şut maliyetiyle karşılaştırılır. Bütün katsayılar JSON'dadır.

### Hedef, ayak/vücut ve uygulama

Hedef kalecinin konumunun karşı köşesidir. Finishing/technique yükseldikçe hedefin direğe payı küçülür; kusursuz oyuncunun bile 0,24 m hedef payı vardır. Hedef yüksekliği tekniğe göre yaklaşık 0,55–1,10 m. Güç `18 + 9·strength/100 + 4·technique/100` m/sn; plasede bunun 0,8'i. Güçlü/uzak vuruş sert, bitiriciliği yüksek yakın vuruş plase olur. Kaleci 6 m'den fazla çıkmış, oyuncuya boyuna 12 m'den yakın ve technique en az 65 ise 10 m/sn aşırtma denenir; aynı parabol kalecinin üzerinden geçip geçmediğini çözer.

Şutun yön/güç/yükseklik uygulama hatası finishing, technique, composure, baskı, koşu oranı ve vücut dönüş açısıyla büyür. **Kusursuz şutçuda da** yön tabanı 0,014 radyan ve güç tabanı %2,5'tir. `core/random.js` üretecinden yalnız uygulamada üç zar çekilir. Kalecinin uzanma başarısı veya gol için zar çekilmez. Şut bekleme tabanı 0,35 sn; oyuncu gerçek dönüşüyle yüzünü kaleye çevirir, ters vücutla erken vurmanın bedelini hata zarfında öder. Elle çift dokunma beklemeyi aşar, aynı özellik/hata/fizik kurallarını kullanır.

Güç hatasının yarı genişliği `0,025 + 0,14·(1−k) + 0,06·baskı + 0,04·koşu + 0,08·dönüş` olur; `k` üç şut özelliğinin 0–1 ortalamasıdır. Aynı seed ve aynı hedef/güçte baskı, koşu ve dönüşün her biri gerçek hız sapmasını artırır; bu ayrı regresyonla korunur. Yeni bir sonuç zarı çekilmez.

Bu aşamada sağ/sol ayak veya ayak dışı spin modeli yoktur. Ayak/vücut hazırlığı mevcut heading, fiziksel dönüş ve hızla temsil edilir; plase/sert/aşırtma ilk hız farkıdır. Ayak tercihi, falso ve ayak dışının ayrıca modellenmesi 7/8. işte veri/temas modeli kararıdır; mevcut oyuncuda olmayan ayak alanı uydurulmaz.

### Uçuş, blok, direk ve gol

Top mevcut analitik parabol/sürtünmeyle uçar. Kontrol altındaki topa veya kaleye bağlanan bir şut animasyonu yoktur. Her 0,1 sn adımda saha oyuncusu, kaleci ve kale çerçevesi temasları çizgi çıkışıyla **aynı zaman sırasına** girer. Şut yolundaki savunmacının süpürülmüş **0,72 m şut blok / 1,8 m yükseklik** zarfına ilk temas **blok**tur; hız temas normaline göre 0,48 sekme katsayısıyla yansıtılır, top serbest kalır. Sonraki temaslar tekrar sonsuz blok sayılmaz; topa gerçekten ilk yetişen kontrol/ilk dokunuş kurallarıyla alır. Basan kale tarafı jokeyini korur, örten şut tehdidinde pas alıcısı yerine top–kale çizgisini kapatır.

Kalenin **net açıklığı 7,32 × 2,44 m**; direk merkezleri bu açıklığın 0,06 m dışında, üst direğin merkezi yerden 2,50 m'dedir. Direk yarıçapı 0,06 m, top yarıçapı **0,11 m**. Direkler dikey silindir, üst direk enine silindir olarak süpürülmüş top yoluyla çözülür; sekme katsayısı **0,72**. Şut dışındaki top da çerçeveden fiziksel seker. Uçuşun sabit adım içindeki temas geometrisi doğrusal süpürmedir; yükseklik temas anında aynı parabolle okunur. Hava direnci/falso/ağ etkileşimi yoktur.

Gol için top merkezi hücum edilen kale çizgisini **0,11 m tamamen geçmeli**, `abs(y)+0,11 < 3,66` ve `height+0,11 < 2,44` olmalıdır. Üstten veya yandan çıkış gol değildir. Bir topun çizgiyi yalnız kısmen geçmesi, çizgiye değmesi veya şutsuz geçmesi gol yazmaz. Her `goal`, önündeki aynı oyuncunun gerçek `shot` kaydına `shotId` ile bağlıdır. Skor olayın gerçek çizgi anında artar. Şutsuz kendi kalesine gol ile gol atan/son dokunan kimliği sözleşmesi bu kabul kuralı değiştirilmeden genişletilemez; açık sorudur.

Asist, aynı atakta şutçuyu bulmuş son başarılı pasın vereni olur; sürme bunu bozmaz. Rakip kontrolü, hakem müdahalesi ve yeniden başlama pas izini temizler. Blok, direk veya kaleci sekmesinden sonra asist kaldırılır; ikinci şut yeni şut olayıdır. Parmağın değdiği top yine kaleye girerse fiziksel `save` teması günlükte kalır ama `success:false/goalAfterTouch:true` olur; başarılı kurtarış sayacından düşer. İsabetli şut yalnız gerçekten kaleye girecek yoldaki kurtarış veya golle sayılır; kalecinin dışarı giden topa dokunması isabet üretmez.

### Kalecinin konumu, set ve kurtarış erişimi

İki takım aynı `gk.reflexes`, `gk.handling`, `gk.oneOnOne` ve genel pace/acceleration/positioning/composure şemasını kullanır. `gk` oyuncunun doğrudan alanı veya deney girdisindeki `attributes.gk` olabilir; eksik alan 65, geçersiz verilen alan açık hatadır. Rakip için ayrı sabit kaleci puanı yoktur.

Kaleci topun iki direğe göre açıortayında konum alır. Normal derinlik `clamp(1,2 + 0,075·topun kale uzaklığı,1,2,5)` m; enine hedef ±3,3 m. Kaleci tehditte hedefinin 1,05 m yakınına gelince frenler; hızı ≤0,45 m/sn iken 0,35 sn dengede kaldıysa **set** olur. Konum değişimi de aynı oyuncu hız/ivme/dönüş sınırlarını kullanır.

Şut anında topun gerçek hız/yükseklik/sürtünmesiyle kale çizgisine varış noktası kestirilir. Tepki `0,16 + (1−reflexes/100)·0,20` sn; set değilse **0,04 sn ek** gecikme vardır. Tepki bitmeden yeni plonjon uzanması oluşmaz; yalnız zaten o noktadaki gövde/önceden açılmış kollar fiziksel temas edebilir. Set gövde/kol zarfı 1,25 m, normal gövde 1,15 m; birebirde önceden kapanmış zarf oneOnOne ile genişler.

Tepki sonrası yatay ek uzanma saniyede `4,1 + 2,2·reflexes/100 + 1,1·acceleration/100` m, en çok **2,65 m**. Yakındaki topa adım, uzağa plonjon hedefi alınır. Dikey erişim 2,05 m'den 3,8 m/sn ile en çok **2,90 m**'ye büyür; yatay/dikey uzanma elipsi aşılırsa topa değemez. Kalecinin gövdesi ışınlanmaz: temas, adım başı/sonu gerçek gövde konumuyla ball–keeper bağıl hareketinde çözülür; kol erişimi ayrı zarf olarak laboratuvarda görünür.

Gerçek temas varsa handling, topun üç boyutlu hızı ve uzanma zorluğu tutma kalitesini verir. **Tutma / yana veya kornere çelme / parmak ucuyla saptırma** için yalnız bu kalitede seed'li zar vardır. Çelme ve saptırma yeni gerçek hız/düşey hız üretir; top tekrar uçup ilk yetişene gidebilir, ikinci şut mümkün olur. Zorluk 0–1 arası yatay/dikey erişim oranından gelir; son anda erişimde en az 0,9 kaydedilir. `save` ayrıca `reachDifficulty`, `reactionAt`, `reactionMarginSeconds`, `lastMoment` taşır. Özel hareket ve akrep vuruşu seçilmez; ileride bu kayıtlar aday üretir.

### Birebir, elde top ve geri pas

Kaleye 19 m içinde, merkezi 18,32 m koridorda savunmacıyı geçmiş kontrollü taşıyıcı varsa kaleci açıyı daraltır. oneOnOne/positioning, en çok 13 m çıkışı ve önceden açılan zarfı etkiler. Top kalecinin gerçek el/gövde erişimine önce gelirse ceza alanında ayağa kapanarak alabilir; serbest sürme dokunuşunda da diğer oyuncularla aynı ilk temas yarışına girer. Hücumcu sürme/şut seçenekleriyle kaleciyi geçebilir, plase veya aşırtma deneyebilir.

Kaleci ceza alanında düşük hızlı serbest topu elle alabilir; kendi takımının bilerek ayakla gönderdiği pas `backpassTeamId` izi taşır ve **elle alınamaz**. O top ayakla kontrol/pas/sürme kurallarına döner; kalecinin serbest dokunuşu konum alma hedefiyle ezilmez. Ceza alanı dışı elle tutma/kurtarma yoktur, ayak teması mümkündür. Ceza alanı 16,5 × 40,32 m, altıpas 5,5 × 18,32 m; kalecinin elle oynama sınırı altıpas değil ceza alanıdır.

Elde top `heldBy` ile görünür; mevcut kontrol sahibinin erişiminde taşınır, müdahale başlayamaz veya çözülemez. Kaleci **3,5 sn** içinde takım arkadaşına elle atar veya mesafe uzunsa elinden uzun vurur; `keeperDistribution.kind` `throw/punt` olur. Dağıtılan top yine gerçek uçuş, ilk dokunuş ve pas sonucuna tabidir. Henüz topu elde tutma ihlali, kalecinin ikinci kez elle alması ve dolaylı serbest vuruş modeli yoktur; 7. işin açık kuralıdır.

### Maç, santra, devre ve geçici kale çizgisi kuralı

`createSimulation({...,match:true})` tam maçı etkinleştirir; laboratuvar bunu açar. Maç başında ev sahibi, golden sonra yiyen, ikinci yarıda diğer takım santra yapar. Gol sonrası en az 2 sn, devrede en az 3 sn beklenir; oyuncular **aynı fiziksel hareketle kendi yarı alanlarına koşar**, karşı takım orta daire dışına yerleşir. Taker gerçekten kontrol erişimine gelince ve taker ile merkeze yakın seçilen alıcı 0,5 m/sn altına frenleyince merkezdeki toptan takım arkadaşına gerçek yerden **santra pası** çıkar. Karşı takımın orta daire dışındaki gerçek uzaklığı da kontrol edilir. Oyuncu konumu değiştirilerek hızlı başlatılmaz.

Saat 2.700 sn'de `half`, iki takımın yönünün tersine çevrilmesi ve ikinci yarı santrasını üretir. 5.400 sn'de `end` olur, adım/konum/olay/skor ilerlemesi durur. Uzatma yok; bu aşamada gol/devre/yeniden başlama beklemeleri 90 dakikalık sabit saatin içindedir. Sentetik sahneler için `match:false` saat akışını kapatır; golün skor kaydı yine gerçektir.

**GEÇİCİ — 7. işe kadar:** kale çizgisi çıkışında son dokunan hücum takımıysa top ceza alanı/altıpas içindeki basit yeniden başlama noktasına alınır; kaleci oraya gerçekten gelir, elle alır ve dağıtır. Son dokunan savunmaysa hücum takımı en yakın köşeden en çok 8 m hedefli yerden kısa pasla başlar. Topun ayak çıkış hatası ve rakibin gerçek teması bu kısa pası da etkiler. Bunlar gerçek kale vuruşu/korner yerleşimi ve orta değildir. Taç çizgisinin önceki rakipten kısa yeniden başlama kuralı sürer.

DOGSO'nun önceki kontrol/yön/mesafe/kalan saha savunmacısı koşulları korunur; artık kalecinin perspektifte iki köşeyi fiziksel olarak kapatabildiği durumlar net gol şansı adayı sayılmaz. Bu, özelliklerden tepki/erişim hesabıdır; kurtarış olasılığı zarı değildir. Ceza sahasında topa oynama indirimi ve avantajda kartın sonraki duruşa bırakılması gerçek duran top işine kalır.

### Günlük ve laboratuvar

Gerçek ayak/temas/çizgi/yeniden başlama anında `shot` (xG, hedef, güç, stil), `block`, `save` (tür/zorluk), `post`, `wide`, `goal`, `keeperClaim`, `keeperDistribution`, `kickoff`, `half`, `end` oluşur. Konumlar metre, zaman saniye; golün şut kaydı ve asist kimliği açıktır. Aynı tohum ve aynı komut adımları aynı fizik/olay/skoru üretir.

Üstte skor ve saat, devrede değişen yönler; şut değeri/xG, kaleyi gören iki çizgi, şutun gerçek izi, kalecinin erişimi/tepki anı ve kurtarış türü gösterilir. Top sahibine **iki kez dokunmak** (350 ms içinde) hemen şut ister; ilk dokunma kendine pas hatası üretmez. Tek takım arkadaşı dokunuşu ve uzun basma korunur. Canlı takım tablosu şut, isabet, gol, xG, blok, kurtarış, direk gösterir. Olay listesinde şut/kurtarış/gol; golde kısa işaret vardır. Telefon denemeleri ve tarihli beş tohum ölçümü [şut raporundadır](match-sim-shooting-report.md).


## Laboratuvarın sınırı ve kullanım

Otomatik mod çekirdeğin kendi oyunudur: iki takım fiziksel topu sürer, pas verir, korur, mücadeleyle kazanır ve kaybeder. Sahadaki bir takım arkadaşına dokunmak sahibinden elle pas ister; bu istek güvenlik seçimini aşabilir ve kesilebilir. `Elle havadan pas` aynı deneyi lobla yapar. Oyuncuya 550 ms uzun basmak, o oyuncuyu topu aldığında sürmeye zorlar; kısa dokunmanın pası aynı anda gönderilmez. Sürme tercihi fizik/müdahale sınırlarını aşmaz. Hareket 12 pikseli geçer veya dokunma iptal edilirse uzun basma iptal edilir. Boş sahaya dokunmak otomatiği kapatıp hakem müdahalesi kuyruğuna top yerleştirir; duraklatılmışken önizlenir, sonraki fizik adımında uygulanır. Takım düğmeleri hakemin yeniden başlatma takımını seçer. Oyuncu konumu değişmez. Otomatik kapalıyken topun fiziği sürer, otomatik pas kararı bekler; elle istek çalışır.

Kontroller: duraklat, **0,25×**/0,5×/1×/2×, tohumla sıfırla, iki diziliş, pres, hat, pas stili, tempo ve mentalite. `90 dakikayı tamamla` çizim yapmadan kalan sabit adımları tamamlar, duvar süresini gösterir ve durur; adım atlamaz. Katmanlar: roller/örtme, hat/blok, hız, çapalar; **pas seçenekleri** (yeşil güvenli, kırmızı riskli, çizgi kalınlığı değerlendirme), **seçilen pas**, **top yolu**, hedefte alıcı/rakip saniyeleri. Havada topun metre yüksekliği görünür. Ek katmanlar sahibin pas/sür/koru puanları ve sürme yönü oku; savunmacının jokey/hazır/müdahale/yerde durumu; müdahaledeki top/oyuncu/ıska temas noktasıdır. Faul/kart/avantaj 2,2 sn işaretlenir. Son 10 ilgili olay listelenir. Canlı sayılar pas/isabet/mesafe ve sahipliğin yanında sürme/metre, beat, kazanılan/seken/ıska müdahale, top kazanma, faul, sarı, kırmızı ve avantajı içerir. Duraklatılmış sabit SVG her çizim karesinde yeniden kurulmaz; oyuncuya dokunma hedefi kararlı kalır.

Sayfa ayrı Vite girişidir; oyun hiçbir laboratuvar modülü yüklemez. Laboratuvar dosyaları çevrimdışı önbelleğe alınmaz; service worker laboratuvar ad alanını ağdan geçirebilir. Önceden kurulmuş oyun worker'ı listesinde olmayan `.js` dosyalarını reddettiği için bağımsız giriş `lab/laboratory.mjs` olarak yayınlanır; böylece kullanıcı önce oyunu açıp yenilemek zorunda kalmaz. Bu geçiş eski worker fikstürüyle ayrıca tarayıcıda sınanır. Laboratuvar kendi service worker'ını kaydetmez, kariyerin localStorage alanını okumaz/yazmaz.

## Kabul ve ölçüm

### Kariyer için motor komutları (B)

- `requestSimulationSubstitution(simulation,{teamId,outId,player,slot?})` isteği günlükte bekletir. `applySimulationCommands` yalnız santra/devre/gol, çizgi veya hakem duruşunda uygular; menüde duraklatmak futbol duruşu değildir. Gelen aynı yuvayı, verilen farklı boş yuva varsa onu alır. Çıkan aktif kadrodan `departed` arşivine geçer; geri giremez. Kırmızı kartlı oyuncunun yerine oyuncu alınamaz; bekleyen oyuncu kart görürse isteği iptal edilir. Kadro değişince hızlandırma indisleri ve topsuz önbellekler yenilenir.
- `commandSimulationTactics(simulation,{teamId,tactics,formation?})`: pres, hat, mentalite, tempo, pas stili ve genişlik yalnız o takıma uygulanır; olay tam `tick` ve `time` taşır. Diziliş yeni çapa verir; oyuncu ışınlanmaz. Eksik yuvayı korur. Genişlik çarpanları Dar 0,84 / Normal 1 / Geniş 1,08; saha sınırı ortak zarfı sınırlar.
- `commandSimulationInstruction`: Dengeli varsayılan; Topu sakla koruma puanına +6; Daha fazla şut karar puanına ×1,18; Kısa/Uzun kullan kaleci alıcı mesafesini 12/45 m yapar (uzunda punt). Diğer bireysel talimatlar `effective:false`: henüz etkisiz. `commandSimulationMotivation` motivasyon komutunu kaydeder; moral etkisi kariyerdedir.
- `workload:true` maçta kondisyon hareketten tüketilir: saha oyuncusunda saniyede 0,0006, kalecide 0,0032; metrede 0,0008, sprint metresinde ek 0,00035, mücadelede 0,0175 puan; stamina çarpanı `0,7+0,8·(1−stamina/100)`, taban 20. Kalan kondisyon hız/ivmeyi her adımda yeniler. Oyuncunun süre/mesafe/sprint/temas sayacı vardır. Eski topsuz koordinat fikstürü ve laboratuvarın Denge 1 karşılaştırması tüketimsiz kalır; kariyer tüketimi açar.
- Sakatlık yalnız tüketimli maçlarda: 60 sn'de bir oyuncu başına saniyelik 0,0000012 temel seed'li risk, yorgunlukla `1+3·(1−fitness/100)`; en az 6 m/sn sert bacak temasında 0,002 ek risk. `injureSimulationPlayer` oyuncuyu çıkarır, hakem duruşu ve `paused` üretir. Kullanıcıdan değişiklik istemek ve rakibin otomatik seçimi adaptörün işidir. Oranlar JSON'dadır; eski motorun maç başına yaklaşık 0,135 kullanıcı sakatlığı referanstır.
- `pauseSimulation` / `resumeSimulation` günlüklüdür; dururken saat/fizik ilerlemez. `snapshotSimulation` salt okur, `restoreSimulation` format 1 düz nesneden devam eder. Kesirli zaman, RNG, bekleyen komutlar, top/oyuncular/hakem/avantaj, kararlar, sayaç/günlük ve kovalamaca/alıcı algısı önbelleği saklanır. JSON'un kaybettiği ortak konum referansları, `undefined` ve sonsuz karar puanları yan tablolarla geri kurulur. Kaydetme yeni zar çekmez veya olay eklemez. Test: 45. dakikadan sonra bekleyen değişiklikle JSON'a kaydet/yükle ve kaydetmeden sürdürme, 90'daki **bütün durum** için eşittir.

`tests/match-sim.test.cjs`: deterministik konum dizisi, değişen kare hızında aynı adım sayısı, her adımda hız/ivme/dönüş sınırları, özellik ve kondisyon etkisi, presin tepki süresi ve sayısı, gerçek pas çizgisinin örtülmesi, blok ölçüleri/kayması/genişlemesi, taktik karşılıkları, girdi ve kopya sınırı. Başsız test: 90 dk = 54.000 adım, 22 oyuncu; otomatik top betiğiyle süre ölçülür. Hız bütçesi `tests/match-sim-performance.test.cjs` içinde ayrı korunur. Tüm pahalı maç testleri bittikten sonra seri çalışır; paketlenmiş yerel motor için topsuz 3 sn ve sürme/müdahale dahil gerçek oyun için **üç ayrı tam 90 dakika koşusunun her birinde 2 sn** CI sınırları vardır; bütün süreler test çıktısında görünür. Önceki pas bütçesi 4,5 sn idi; eski profil ayrımı [pas raporunda](match-sim-passing-report.md), yeni sonuç [sürme/mücadele raporunda](match-sim-duels-report.md). Aynı dosya, başlangıç main sürümünün 54.000 × 22 × 2 koordinatının SHA-256 özetini birebir korur; eski testler veya altınlar güncellenmez.

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
| Sürme, müdahale, faul (uygulandı) | Yukarıdaki fizik, temas, karar ve geçici yeniden başlama kuralları | Çok tohumlu faul/kart dengesi, tam gövde temas geometrisi ve avantajda kart gösterme zamanı? |
| Şut ve kaleci (uygulandı) | Gerçek uçuş, blok/direk/kaleci teması, gol/skor, santra/devre | Çok tohumlu xG/kurtarış kalibrasyonu, görüş engeli, ayak tercihi/falso ve şutsuz kendi kalesine gol sözleşmesi? |
| Orta ve duran toplar | Açık oyun ortası, kafa, ofsayt, korner, penaltı, serbest vuruş/baraj, taç/kale vuruşu, kaleci yumruğu ve elle dağıtım; geçici faul yeniden başlamasını kaldırma | Hava topu zamanlaması, ofsayt anı, duran top yerleşimi ve kart eşikleri? |
| Özel hareket | Motor özellik, hız ve rakip mesafesinden seçer; 3D sadece oynatır | Başarı/başarısızlık zarfı ve hareket sırasında kontrol kaybı nasıl ölçülecek? |
| Olay günlüğü ve 3D | Konumlardan yan ürün `{type,minute,second,…}`; mevcut 3D olay alanlarıyla uyum ve gerçek konum akışı | Sürekli konum örnekleri günlüğe mi ayrı zaman çizgisine mi; tekrar/saklama bütçesi ne? |
| Taktikler | Mentalite, tempo, genişlik, pas stili, yaklaşım ve bireysel talimatlar davranış olur | Kullanıcı müdahalesinin ilk görülen etkisi ve denge sınırları? |
| Denge ve geçiş | Pres süresi, koşu mesafesi/sprintler, pas mesafesi/başarı, top kazanma yerleri, şut/xG/faul/kart dağılımları ölçülür | Hedef maç temposu ve istatistik aralıkları birlikte seçilecek; eski altınlar yeni motorun birebir skor hedefi değildir |

Yeni motor yalnız kullanıcının maçına bağlanacak. 3D entegrasyonu, denge ve kayıt geçişi ayrı işlerdir; eski motor ancak açık geçiş kararı ve testlerden sonra silinir.

### Top/pas ölçümü — 28 Ekim 2026

Node 22.23.4, tohum 901, 22 oyuncu ve aynı 54.000 adım; çizimsiz yerel paket, derleme ölçüm dışında. Üç koşunun medyanı: topsuz **0,673 sn**, top/paslı **1,291 sn** (sırasıyla 0,602–0,713 ve 1,249–1,484 sn). İlk bildirilen 16,51 sn test VM'i içindeydi; yerel paketle birebir karşılaştırma değildir. Profilleme ve aynı ölçüm türünün önce/sonrası [ayrı raporda](match-sim-passing-report.md).

1.358 pas, 758 kontrollü tamamlama, **%55,82** isabet; gerçek ortalama mesafe **25,84 m**; **15,09 pas/dk**, **186 kontrollü kesme**, ortalama oyuncu tutması **1,16 sn**, sahiplik Sarı **%49,08**, Mavi **%50,92**. Bu sayılar futbol dengesi olarak onaylanmış değildir: toplam pas fazla, isabet düşük ve paslar uzun. Sürme/şut yokken baskıdan çıkış yalnız pasla denenir; geçici yeniden başlama ve ilk dokunuş kayıpları da etkilidir. Hız hedefi sağlanırken bu sapmalar gizlenmez; sonraki denge için başlangıç ölçümüdür. Takım sahiplik süresi ve doğrulama sonuçları iş raporundadır.

### Sürme/müdahale ölçümü — 28 Ekim 2026

Node 22.23.4, tohum 901, iki 4-2-3-1, Normal pres/hat/tempo ve Dengeli pas; 22 oyuncu ve 54.000 gerçek adım. **807 pas, %77,94 isabet, 19,78 m ortalama**; önceki 1.358 / %55,82 / 25,84 m belirgin iyileşti. 748 taşıma / 10.871,91 m, 51 beat, 154 müdahale (28 kazanma / 31 sekme / 95 ıska), 159 kontrollü kazanma; 13 faul, 1 sarı, 0 kırmızı, 2 avantaj. Faul ve sarı hedefin altında; nedenleri, üç tohum ve hız serisi [ayrı raporda](match-sim-duels-report.md). Eski altınlar ve topsuz koordinat özeti korunur.


### Şut/kaleci ölçümü — 28 Ekim 2026

Node 22.23.4; beş tohum 901/731/42/2026/508, 54.000 adım/maç, iki 4-2-3-1. Ayrıntılı tablo ve hedefler [şut raporundadır](match-sim-shooting-report.md). Ortalama **34,2 şut, 14,0 isabet, 8,2 gol, 7,60 xG**, ağırlıklı xG/şut **0,222**, başarılı kurtarış **%41,4**; şut kalitesi/gol/kurtarış dengesi hedeflerinden belirgin uzak. Pas ortalaması **795,0**; beş maçta isabet ve mesafe hedefte, iki pas sayısı dışında. Faul **15,6**, sarı **2,4**; 689 müdahalenin 464'ü ıska (**%67,3**). Son güç hatası düzeltmesinden önceki daha iyi dağılım nihai sonuç diye korunmadı. 8. iş bu dağılımları birlikte kalibre edecek; fiziksel sonuç yerine ayrı gol/faul/kurtarış zarı eklenmeyecek. Üç ayrı tam maç için 2 saniye CI eşiği ve değişmemiş topsuz koordinat özeti korunur.



## Denge 1 — 28–29 Ekim 2026

Kariyere bağlama öncesi A teşhisi: 50 maçın dokuz yüksek skorlu örneğinde 52 golün önceki 30 sn'si incelendi. Santradan 30 sn içinde gol yok; goller arası medyan 693,36 sn. Kaleci çıkışının hemen kesilmesinden doğan beş gol görüldü; çıkış seçimi/ilk alçak uçuş zayıflığı son denge işine bırakıldı. Durumu bozup kalan bir santra döngüsü saptanmadı. Motor değiştirilmedi; 50 skor ve sayaçlar Denge 1 ile aynı. Ayrıntı ve ham tanılar [kariyer raporunda](match-sim-career-report.md).

Ölçüm ayardan önce kuruldu: 50 benzersiz tohum, aynı iki takım/diziliş/taktik, 54.000 gerçek adım; derleme ve rapor zaman dışında. Her ölçünün ortalama/medyan/P10/P90’ı, şut/kaleci/müdahale dilimleri, xG kalibrasyonu ve +5/+10/+20 güç farkı aynı düzenekle raporlanır. Rastgelelik yalnız uygulama/temas kalitesindedir; gol/kurtarış/müdahale sonucuna kota veya ayrı zar yoktur.

| Ölçü | Önce | Sonra | Hedef |
|---|---|---|---|
| Gol | 7,34 | 2,44 | 2,2–3,4 |
| Şut | 38,30 | 18,14 | 18–30 |
| İsabetli şut | 13,56 | 9,14 | 6–11 |
| Toplam xG | 6,89 | 2,34 | Golle tutarlı |
| xG / şut | 0,180 | 0,129 | 0,09–0,14 |
| Kurtarış % | 45,87 | 73,30 | 62–76 |
| Blok | 14,88 | 4,04 | 3–8 |
| Yasal kazanma + sekme % | 35,08 | 58,15 | >50 |
| Faul | 14,72 | 10,62 | 16–26 |
| Sarı | 2,20 | 2,68 | 2–5 |
| Kırmızı | 0,12 | 0,22 | Sabit hedef yok |
| Pas | 800,92 | 776,02 | 750–1.000 |
| Pas isabet % | 77,01 | 77,32 | 75–88 |
| Pas mesafesi m | 18,32 | 19,90 | 15–20 |

Bitiricilik tek başına artınca aynı şutun amaçlanan gücü düşmez. Plase/sert stilinde fiziksel güç teknikle karşılaştırılır; finishing köşe seçimi ve uygulama doğruluğunu etkiler. Bu ayrım +10 finishing artışının yanlışlıkla %20 daha zayıf plaseye geçmesine karşı testle korunur.

Canlı top son üçte birdeyken 35 m tetik ve 18 m kademeyle blok daralır/derinleşir; iki kale tarafı markaj ve penaltı noktası çevresinde dönen top görevi vardır. Ortak hedef zarfı oyuncuyu sıçratmaz. Hızlı şutta karar/fizik tek 0,72 m blok yarıçapı kullanır; 1,2 m kontrol yarıçapı pas ve boş top içindir. Müdahale hazırlığı tam temas adımına ve taşıyıcının aynı hareket integratörüyle öngörüsüne dayanır; gerçek çıkış noktasından sabit nişana uzanır. Etkin ayak/bacak zarfı 0,36/0,30 m, bekleme 5 sn. Tehlikeli devam bacak teması top önce oynansa da ayrıca fauldür.

Kalecinin normal/set gövde ve açılmış kol zarfı 1,15/1,25 m; tepki 0,16+0,20·(1−reflexes/100), set değilse +0,04 sn. Parmak ucu ileri/yana hız bileşenleri düzeltilmiştir; plonjon azami ek uzanması korunur. Gol ve kurtarış hâlâ gerçek temas ve çizgi geçişidir. Şut haritası olaylardan maç boyunca birikir; renk sonucu, alan xG’yi gösterir. Skorun altında xG/kurtarış oranı vardır.

İlk 50’de şut sayısı hedefte, ek 100 maçta hafif altında; faul hedef altında ve 5+ gol oranı hedefin üstünde; xG’nin bazı dilimleri uyumsuz kalır. Genel gövde faulleri, orta/kafa/duran top şutları yoktur; uzak şut seçimi hâlâ tutucudur. Bu alanlar kapanmış sayılmaz. Ayrıntı, nedenler, başarısız adayların neden korunmadığı ve güç deneyleri [Denge 1 raporunda](match-sim-balance-report.md); ham önce/sonra dosyaları `docs/measurements/` içindedir.
