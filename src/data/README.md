# Oyun verisi

## match-duration.json (`MATCH_DURATION_DATA`)

Tam maç seçenekleri 3/5/7/10 dakika, varsayılan 7; saniye dönüşümü, doğal gösterimin 1× oranı ve referans/doğal saat modeli adları. Fizik adımı ve futbol değerleri `match-sim.json` içinde kalır.

## match-sim-career.json (`CAREER_SIM_DATA`)

Kariyer ile saniyelik motor arasındaki eşleme: serbest/4-2-3-1/4-4-2 dizilişleri, yuvalar ve uyumlu roller, mevcut oyuncu alanlarından özellik okuma sırası, eksik alan varsayılanı, normalize çapa sınırı, takım talimatları ve henüz etkisiz seçeneklerin açık listesi. `rating` olay ağırlıkları (6,5 taban, gol/asist/şut/pas/müdahale/hata/kurtarış/yenilen gol/kart, 1–10 sınırı), büyük fırsat xG eşiği ve temel izleme saati. Kulüp renkleri bu dosyaya kopyalanmaz; kulüp kimliğinden gelir.

`continuous` yalnız V7.15.0'dan kalan referans modelde kullanılır. Yeni doğal maçta yalnız manuel hız uygulanır. Referansta 1× seçiliyken sakin/ yaklaşım/ tehdit/ kritik/ yeniden başlama gösterim hızları 32/12/3/1/8; geometrik eşikler, 1 sn yön kestirimi, 0,18 sn yavaşlama ve 0,8 sn hızlanma zaman sabitleri. Hedef 6–10 dk; bu değerler oyuncu fiziğini veya olay sıklığını değiştirmez. `playback` yalnız kare işi bütçesi, adım sınırı ve çizim/sayaç yenileme oranlarını tutar; önden hesaplama/halka tampon katsayıları kaldırıldı.

`match-sim.json` kariyer komutları: `tactics.widthScale` takım genişliği; `workload` süre/mesafe/sprint/temas tüketimi ve stamina çarpanı; `injuries` periyodik yorgunluk/sert temas riskleri; `instructions` her bireysel talimatın gerçekten etkili olup olmadığı ve karar/kaleci çıkış katsayıları. Tüketim kariyer girdisinde açılır; Denge 1 laboratuvar karşılaştırması sabit kalır.

Oyunun verisi koddan ayrı, düz JSON dosyalarında (refactor B, V7.9.13; E4, V7.13.0’dan beri `.json`). Kod onları adıyla alır: `import CLUB_DATA from "../../data/clubs.json"`. Bir dosyayı her yerde aynı adla alın; testlerin erişim noktası (`tests/support/game.cjs`) dosyayı bu adla verir (`g.api.CLUB_DATA`). Başka bir motor (Godot) aynı dosyaları okuyabilir.

`tests/data.test.cjs`: her dosya geçerli JSON, her dosyayı oyun kullanıyor ve oyun dosyadaki değerleri okuyor.

## balance.json (`BALANCE`)

Balance: the numbers that tune the game, in one place. league.lift: every league club plays this much above its listed level (difficulty; measured over 136 matches, our points per match 1.20). starScene: the skill stars that make a signing a star-transfer scene, and the shirt numbers a star asks for first. highlights: the career highlight archive keeps each player's best perPlayer moments; best is the type's rank (typeRank: a big signing's show, a keeper's save, a special move in a match, a newly learnt move), then his stars, a move not in his archive yet before another of one that is, then the newest. training.cap: the most a training focus adds to an attribute. season: the first season's year, the size of the transfer market and the smallest squad a club keeps. development (summer, on top of weekly growth): the young close in on their potential, the peak years hold, then a decline; keepers peak and decline later (gains and declines: [base, random span]). retirement: the chance by age (keepers count as this many years younger), certain from certainAt; stars retire less often, weak players more. contracts: the longest renewal by age, the wage demand, a new contract's wage (overall² × perOverallSquared; academy for a promoted youngster) and the wage room (the club's level priced like a player of that level, times wageBudget.squadSlots, rounded to wageBudget.roundTo). shirtNumbers: the numbers a shirt can carry. wonderkid: the week he appears and the chance he is ours. market.positions: the cycle of positions the market is filled with. engine: match tuning — the pass success base, which kind each attribute is and how much tiredness weighs on each kind, and how much each skill suffers out of position, by role group.

## clubs.json (`CLUB_DATA`)

The league's clubs, in league order. colors: primary and secondary; pattern: how the crest and flags split (v vertical, h horizontal, d diagonal). team: the strength profile of a club the game plays against (level and the 0–100 attack, midfield, defence, keeper, pressing and physical ratings), and its style of play. colorNames: how the colours are said on the club card. startingClub: the club a new career manages. level (the starting club, which has no team block): its stature, which sets the wage room.

## moves.json (`MOVE_DATA`)

Special moves: the 19 outfield moves and the keeper's own, in the order a player's list shows them. rating: a player's skill stars (1–5) come from a weighted flair of his attributes, against the thresholds. requires: a move is his when any one of its alternatives holds. In an alternative, a number is a minimum (stars or an attribute), role: his position is one of these, notRole: it is none of these, roleContains: his position's code contains this letter, move: he already has that move (moves are checked in order). keeper: a keeper has one star and one move, Higuita's scorpion, from this overall. starShow: in the star-transfer scene he shows the first of his moves in this order (the most spectacular); without one, the fallback; a keeper shows the scorpion or a volley from his hands. Keepers' scene stars come from their overall (keeperStars: the overall for 2, 3, 4, 5 stars). keeperSaves: the star moments of a match that are a keeper's (an archived keeper save). highlightStage: the scene a recorded moment is staged with when it is not the move's own (our keeper's penalty save and star save). highlightNames: the names of the archive's moments that are not moves of the list (a keeper's volley, his saves).

## names.json (`NAME_DATA`)

Names for generated players: market and academy players (market), league clubs' players (rivals).

## players.json (`PLAYER_DATA`)

What a player is made of: the profile attributes, each position's typical shape (offsets from overall) and the attributes it is judged by, the player types with their leanings, which types a position can have (with weights), the wonderkid type per position, training focuses and the attribute groups shown on a profile.

## squad.json (`STARTING_SQUAD`)

The squad a new career starts with: each player's id, base ratings and contract years left (everything else a player carries — fitness, morale, profile… — is given when the career is made); styleEdge: how much more often he is the one who gets the chance against a rival of that style (the quick striker against a high line, the target man against a deep block). The first eleven and bench (by id), their places on the pitch, the captain, and the opening plan (aras: the playmaker's role, the save's own name for it).

## story.json (`STORY_DATA`)

Scripted moments of the first season. transferOffer: in the first season, on the given week and day, a club bids for one of the starting players (by id); the board can take the bid, the raised bid after a counter offer, or keep him. If he goes, the replacement (by id) takes his place in the eleven when he is not in it already; voice: the dressing-room voice (by id) who talks about it. playmaker: the player (by id) the old "free 10 / closer to the centre" decisions are about (their choices may still wait in old saves).

## tactics.json (`TACTIC_DATA`)

Team tactics: the options of each setting, their labels, and the team orders.


## match-sim.json (`MATCH_SIM_DATA`)

Yeni saniyelik çekirdeğin ve ayrı laboratuvarın verisi; V7.15.0 deneysel kariyer adaptörü aynı veriyi kullanır. Eski dakika motoru kendi kurallarıyla kalır. Kural kaynağı `docs/match-sim.md`.

- `pitch`: metre cinsinden 105 × 68 saha, hedeflerin çizgiye payı, net açıklığı 7,32 × 2,44 kale (çerçeve merkezleri açıklığın dışında), direk yarıçapı, 16,5 × 40,32 ceza alanı, 5,5 × 18,32 altıpas ve orta daire ölçüleri.
- `clock`: sabit adım (saniye); `epsilon` sadece kayan noktalı birikimin adım sınırını kaçırmaması için tolerans.
- `attributes`: kabul edilen özellik aralığı. `movement`: metre/sn hız ve metre/sn² ivmenin tabanı/özellik payı, kondisyon çarpanı, radyan/sn dönüş, varış toleransı, aciliyet mesafeleri ve yürüyüş/hafif koşu/koşu/sprint hız oranları.
- `decisions`: özelliğe göre 0,3–0,6 saniyelik tepki aralığı; üst tam adıma yuvarlanır. `phases`: kazanma/karşı pres pencereleri ve karşı preste tetik mesafesi çarpanı.
- `roles`: eşzamanlı pres/örtme/markaj/destek sayıları; örtme çizgisine mesafe/oran, markajın kale tarafı mesafesi, destek açıları ve derin koşu mesafesi. `holderStandOffDistance`: eski topsuz tekrar fikstürünün 2,4 m kaba yaklaşma hedefi; canlı motor bunu `duels.jockeyDistance` ile rafine eder.
- `shape`: savunma/hücum hedef boyu ve eni, takımın ortak rol hedef zarfı; topa boyuna mesafe ve enine kayma. Bunlar mevkiye özel sabit kutular değildir. Kaleci derinliği ve enine açı payı ayrıca burada.
- `tactics`: `tactics.json`'daki pres seçeneklerinin metre tetik mesafeleri ve savunma hattı seçeneklerinin metre kaydırmaları; `passing.styles` pas stilinin mesafe/ilerleme/boşluk tercihlerini taşır. Seçeneklerin adları kopya bir seçenek listesi oluşturmaz; arayüz doğrudan `TACTIC_DATA.options` okur.
- `formations`: yalnız deneyin 4-2-3-1 ve 4-4-2 yuvaları; hat ve merkezlenmiş normalize çapa. `x` boyuna, `y` enine. Kalecinin yeri ayrı hesaplanır. Kariyerdeki `SLOT_POS`/`oppRadarPos` aynen kalır.
- `ball`: kontrol yarıçapı (1,2 m), erişim yüksekliği (1,8 m), yuvarlanma ivmesi (1,25 m/sn²), yerçekimi (9,81 m/sn²), sahiplik ofseti (0,35 m), eski girdilerde teknik alan varsayılanı ve tekrar temas bekleyişi. `firstTouch`: beceri/hız riski ve sekmenin yatay/düşey hız/yön katsayıları. Her biri `docs/match-sim.md`'de formülüyle açıklanır.
- `passing`: özellik/baskıdan tutma, pas hızı ve lob uçuş süresi, minimum otomatik mesafe, öne koşu hedefi, 0,1 sn yol değerlendirmesi, alıcı toleransı, görüş ufku, boşluk/güvenlik ağırlıkları, lob maliyeti, seed'li uygulama hatası, riskli çıkış bekleyişi ve karşılama ufku/sayısı. `styles`: yalnız `Kısa/Dengeli/Direkt` davranış katsayıları; seçenek adlarının arayüz kaynağı yine `tactics.json`.
- `lab`: başlangıç tohumu/taktik/diziliş/top, takım renkleri/kimlikleri, seed'li fiziksel örnek özellikler ve bunlardan türetilen teknik özellikler; 0,25× dahil hızlar, klavye metre adımı, hız/yol çizimi ufku, 90 dakika süresi, etiket kenar payı ve rol etiketleri. `ballSpeed/holdMinimumSeconds/holdRangeSeconds/turnoverProbability` eski topsuz tekrar fikstürü içindir; canlı laboratuvar bu betiği kullanmaz. Otomatik oyun çekirdeğin fizik/pas/sürme/mücadele adımıdır.

- `dribbling`: özelliklerden topla hız oranı/dönüş, hız/beceri/baskıdan dokunuş yolu, yeniden temas aralığı, seed'li açı/mesafe hatası, yön adayları, pasla ortak varış ufku/örnekleri ve koruma hedefi/hızı. Topu oyuncuya bağlayan görsel bir sürme değildir.
- `ownerDecision`: pas/sür/koru puanlarının metre/saniye ağırlıkları, algı maliyeti, pas mesafesi ve zaman aciliyeti, pas taramasının tepki sayısı, destek bekleyişi/maliyeti; `tempos` ve `styleCarry` etiketleri ortak `tactics.json` seçeneklerini kullanır.
- `duels`: jokey mesafesi/ikinci adam katsayısı/hızı, ayakla/kayarak uzanma ve hazırlık, tackling kaynaklı zaman/yön hatası, ayak/bacak etkin temas yarıçapı, gerçek top açıklığı ve gövde erişim marjı, sarı temkini, pres çarpanı, müdahale/kalkış süreleri, omuzda güç-hızdan yavaşlama, beat karşılaşma/kaçış sınırları. Başarı yüzdesi veya faul zarı yoktur.
- `refereeing`: fiziksel şiddetin hız/arkadan/kayma/topa oynama şansı ağırlıkları, sarı/kırmızı eşikleri, mevcut konumsal DOGSO ölçütleri, avantaj süresi/ilerlemesi; **geçici** serbest vuruş yerleşimi, 9,15 m, saha içi uzaklaşma yönleri ve kısa pas. Ceza alanı içi `penaltyPending` 7. işte gerçek penaltıyla değişecektir.
- Yeni oyuncu alanları `dribbling`, `strength`, `composure`, `tackling`, `positioning` de 0–100'dür; eski girdide yoksa `ball.defaultAttribute` uygulanır. `lab` fiziksel örneklerin eski zar sırasını değiştirmeden bu alanları türetir; uzun basma, son olay sayısı ve kısa işaret süresi de buradadır. İlk dokunuş katsayılarının ve pas tercihinin bu işteki değişme gerekçesi şartnamededir.

- `shooting`: xG'nin mesafe/açı/örtülme/kaleci/baskı/vücut katsayıları; yalnız karar ve istatistik içindir. Şut/pas fırsat değeri ve ortak mentalite etiketleri (`Temkinli/Dengeli/Cesur`), uzak şut sınırı, plase/sert/aşırtma hedef/gücü, kusursuz oyuncuda da sıfır olmayan yön/güç hata tabanı; her iki hatada ayrı baskı/koşu/dönüş payları, blok ve direk sekme katsayıları. Gol ihtimali zarı içermez.
- `goalkeeper`: reflexes kaynaklı tepki ve set olmama gecikmesi, açıortayda konum, set eşiği, adım/plonjon yatay/dikey erişim ve hızı; handling ile tutma/çelme/saptırma kalitesi; birebirde çıkış ve önceden açılan gövde/kol zarfı; elde taşıma/elle atma/elden uzun vurma; son an zorluk işareti ve DOGSO'da perspektif payı.
- `match`: 2.700/5.400 saniyede devre/bitiş, gol/devre kısa bekleyişi, oyuncuları ışınlamadan santraya yerleştirme payları ve gerçek ilk pas; **geçici** kısa korner mesafesi. `ball.radius` topun tamamının kale çizgisini geçmesi ve direk temasında kullanılır.
- `finishing` ve `gk.reflexes/handling/oneOnOne` 0–100'dür. İki takım aynı şemayı kullanır; kaleci alanları oyuncunun `gk` nesnesinden veya deney girdisindeki `attributes.gk` üzerinden alınabilir. Eksikler `ball.defaultAttribute` olur; geçersiz verilen değerler reddedilir. Laboratuvar bunları eski fiziksel özelliklerin zar sırasını değiştirmeden türetir. `lab.doubleTapMilliseconds` top sahibine iki kez dokunarak şut istemenin süresidir.

Denge 1 ekleri:

- `boxDefending`: kale uzaklığıyla etkinleşen ortak blok boy/en/zarfı, kademeli geçiş mesafesi, iki markajın kale tarafı ve positioning payı, penaltı noktası çevresindeki dönen top görevi. Savunmacıyı hedefe ışınlayan sayı yoktur.
- `shooting.blockRadius`: şut kararının izdüşümü ve gerçek hızlı şut temasının tek yarıçapı; pas/serbest top kontrol yarıçapı değildir. `minimumDecisionXg`, xG eğrisi ve şutun diğer seçeneklerle puan ağırlığı, tam örtülmüş yolu beklemek yerine gerçek fırsatta vurmayı belirler. Sonuç sayacı okunmaz.
- `duels.footRadius/legRadius`: uzanan ayağın süpürme ve bacak temas zarfı. `cooldownSeconds`: ardışık müdahale bekleyişi. `recklessSlideSpeed/recklessStandingSpeed`: top sonrası **gerçek bacak kesişimi de varsa** tehlikeli devam teması eşiği; kendiliğinden faul üretmez.
- `goalkeeper.tipSpeedFactor/tipSideWeight`: fiziksel parmak ucu temasının ileri ve yana hız bileşenleri. Uzanma başarısı için kura yoktur; dokunup yine gol olan top kurtarıştan düşer.
- `reporting`: sabit 50 tohumun ilk referansları ve şut/kaleci/xG/müdahale dilim sınırları. Futbol davranışından ayrıdır; `sim:report` en az 50 maç çalıştırır. `--strength` aynı kadroları karşılaştırır; `--experiments` pahalı deneyin seçilmiş parçalarını yeniden çalıştırabilir.
- `lab.shotMap`: xG'den nokta alanına ölçek, en küçük görünür nokta ve sonuç renkleri. Şut sayısına veya fiziğe etkisi yoktur.

`reporting.controlledShots`: aynı atış konumları, set kaleci derinliği, +10 özellik artışı ve kısa uçuş süresi; finishing ve reflexes etkisini maçın sonraki RNG akışından ayıran eşlenmiş deney içindir. Normal/set kaleci ön erişimi 1,15/1,25 m, set olmama ek tepki payı 0,04 sn olarak kalibre edildi; plonjon sınırı değişmez.

Raporun `milliseconds` alanı performans ölçümüdür, deterministik sonuç değildir. CI kaydedilen maç/güç/kontrollü şut sayaçlarını yeniden üretip `tools/sim-report/compare.cjs` ile karşılaştırır; yüzdelik ve istisnalar tarihli raporda açıklanır.

`balance.json.shortMatchFlow`: yalnız doğal süreli maçta taşımanın olumlu varış güvenliği puanı tavanı (saniye), pas/taşımada kale mesafesi kazancı puanı (metre başına) ve ileri destek uzaklığı. Referans laboratuvar bu ayarı kullanmaz; top/oyuncu hızı, şut veya kaleci sonucu katsayısı değildir.

## match-sim-keeper-animation.json (`KEEPER_ANIMATION_DATA`)

Yeni kariyer 3D kalecisinin yalnız görsel hareket süreleri, dalış/iniş/destek kemik pozları ve zemin payları. Kayıtlı kalkış klibinin çömelme zamanı; gözlenmiş önceki kurtarış için kısa çizim ufku. Fiziksel erişimi, topu, gol dengesini veya maç süresini değiştirmez.

## match-sim-view.json
Yeni motorun salt okuyan 3D görünümünün temas penceresi, çizim/kamera/radar ölçüleri ve mevcut forma renkleri. Futbol, fizik, RNG ve eski 3D hız ayarlarını değiştirmez.
