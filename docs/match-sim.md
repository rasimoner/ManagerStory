# Saniyelik maç simülasyonu — şartname

Durum: Faz 4, adım 1–3. Bu belge yeni motorun kural kaynağıdır. Uygulanan kurallar aşağıda kesin; sonraki adımlar amaç ve açık soru olarak ayrıdır. Godot'a taşınacak sözleşme kodun dosya yapısı değil bu belge, JSON veri ve kabul testleridir.

Laboratuvar: https://rasimoner.github.io/ManagerStory/lab.html. Oyunda bağlantısı yoktur. Kariyer, mevcut dakika motoru, 3D yönetmeni, kayıt biçimi ve V7.14.0 sürümü değişmez. Diğer lig maçları ileride de `simAIGame` ile kalır.

## Neden yeni motor

Mevcut motor dakikada bir ilerler; az sayıdaki aksiyon arasını sunum doldurur. Mevki çevresindeki LEASH kutuları topsuz hareketi sınırlar. Pasın sonucu çizgideki oyunculara ulaşmadan belirlenir; bazı uzun paslarda alıcı topa yetişmek için hızlanır. Dakika sonundaki faul zarı müdahaleden bağımsızdır. Bu motor yamalanmayacak: yeni motor kısa adımlarla gerçek konum üretir, olay günlüğü bu konumların sonucudur.

## Koordinat ve girdi sözleşmesi

- Birimler metre ve saniye. Saha 105 × 68. Orijin merkez, `x` boyuna, `y` enine; sınırlar ±52,5 ve ±34. `newview/runtime.js` içindeki `toWorld` ile ölçek aynıdır: simülasyon `(x,y)` → three.js `(x,0,y)`. Yüzdeye dönüştürülüp tekrar ölçeklenmez; ileride boyuna/enine eksen açıkça eşlenir.
- `createSimulation({ teams, seed, ball })`: karşı yönlerde oynayan iki takım. Takım `{id, direction: 1|-1, formation, tactics: {press,line}, players}`. Oyuncu `{id, number, slot, attributes: {pace,acceleration,reactions,fitness}, position?}`. Özellikler 0–100, kimlikler benzersiz. Diziliş yuvaları JSON'dadır; core modları bilmez.
- `ball: {position:{x,y}, teamId}` dışarıdan verilen referanstır. Bu aşamada top sahipliği, pas, şut, top sürme, çarpışma veya müdahale hesaplanmaz. Top rakip çizgilerinden geçebilir; otomatik laboratuvar betiği bir pas motoru değildir.
- `stepSimulation(simulation, ball)` tam bir adım atar. `advanceSimulation(simulation,{seconds,ball})` kare zamanını biriktirir. `readSimulation` bağımsız düz nesne kopyası verir. Girdi nesnelerine, `S`, `M`, kariyer ya da kayda yazılmaz. Geçersiz takım, özellik, tohum, konum ve negatif zaman açık hata verir.

## Saat ve karar

- Sabit adım `clock.stepSeconds`: 0,1 sn. Saat kayan noktalı toplama yerine tam adım sayısı × adım süresidir. Çizim kare hızı ve 0,5×/1×/2× yalnızca biriken zamanı değiştirir. Atlanan kareler adım atlamaz. Arka plana gidince laboratuvar durur; dönüşte geçen duvar zamanı simüle edilmez.
- Oyuncunun tepki süresi `ceil((0,6 − 0,3 × reactions/100)/0,1) × 0,1`: 0,3–0,6 sn. Her oyuncu kendi karar saatinde hedefini yeniler. Top sahipliği değişince yeni faza ilk tepki için bu süre yeniden beklenir; basan aynı anda değişmez. Süre, top değişimi ile ilk pres kararı arasında ölçülür; azami hıza ulaşma süresi değildir.
- Her karar turunda en yakın uygun saha oyuncusu adaydır. Adayın karar zamanı gelmediyse daha uzaktaki oyuncu onun yerine seçilmez. Yeni basan seçilince eski basan bırakır; aynı takımın en fazla `roles.maxPressers` oyuncusu basar.
- Bu aşamada çekirdek hareket için zar çekmez. Tohumla üretilen laboratuvar oyuncu özellikleri ve otomatik top rotası `core/random.js` `R(seed)` kullanır; aynı girdi ve tohum aynı konum dizisini verir. Daha sonra zar sadece uygulama hatası (pas sapması, ilk dokunuş, şut isabeti) üretir.

## Hareket

Tüm katsayılar `src/data/match-sim.json`'dadır. Hız `5,2 + 3,8 × pace/100` m/sn, ivme `2,4 + 2,6 × acceleration/100` m/sn². İkisi de `0,72 + 0,28 × fitness/100` ile çarpılır. Bu aşamada kondisyon tüketilmez; girdideki kondisyon kapasiteyi etkiler.

Oyuncu hedefe hız ve ivme sınırlarıyla yaklaşır; durma mesafesine göre frenler. İvme sınırı hız vektörünün değişimine uygulanır, sadece sürat artışına değil. Yön saniyede en fazla `movement.turnRate` radyan döner. Aciliyet mesafeyle yürüyüş, hafif koşu, koşu veya sprint seçer; basan sprint ister, yakında frenler. Hedefe varınca küçük durma toleransı titreşimi önler. Saha çizgisine yaklaşırken her eksen ivmenin 1/√2 payıyla durma mesafesi ayırır; sonraki adımın yolu da hesaba katılır. Önce zorunlu sınır freni, kalan vektör ivmesiyle hedefe yönelme uygulanır. Konum kırpılmaz ve hız aniden sıfırlanmaz. Kaleci kendi kalesi ile topun açısına göre ayrı bir konum alır.

Oyuncunun mevkii bir çapadır. LEASH gibi başlangıç noktasına bağlı kalıcı bir kutu yoktur. Farklı rol hedefleri başlangıç mevkiinden uzaklaşabilir. Bu ilk aşamada oyuncu–oyuncu fiziksel çarpışması ve ofsayt kısıtı yoktur; daha sonraki temas adımında ele alınır.

## Takım fazları

| Faz | Başlangıç | Çıkış |
|---|---|---|
| Topa sahip (`possession`) | Geçiş penceresi bittikten sonra top bu takımda | Topu kaybetme |
| Savunmada (`defending`) | Karşı pres penceresinden sonra top rakipte | Topu kazanma |
| Kazanma (`winning`) | Dış girdi sahipliği bu takıma geçirir | `phases.winningSeconds` sonra sahip olma |
| Karşı pres (`counterpress`) | Dış girdi topu rakibe geçirir | `phases.counterpressSeconds` sonra savunma |

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

Topa sahipken hedef boy 48 m, en 56 m: genişlik pas açılarını, boy derin koşuyu açar. Top kanada gittikçe blok merkezi topun tarafına kayar; saha sınırında hedefler saha içine sığar. Savunma hattı `Geride/Normal/Önde` blok merkezini geriye/öne taşır. Pres `Düşük/Normal/Yüksek` sırasıyla 12/19/27 m tetik mesafesi verir. Seçeneklerin dili tek kaynak `data/tactics.json`; yeni davranış katsayıları `match-sim.json` içindedir. Diğer taktikler bu işte uygulanmış sayılmaz.

## Laboratuvarın sınırı ve kullanım

Sahaya dokunmak otomatik modu kapatır ve top referansını oraya koyar. Takım düğmeleri sahipliği değiştirir. Otomatik modda top sahip takımın farklı oyuncularına doğru veri hızıyla akar; bekleme aralıkları ve ara sıra sahiplik değişimi seed'lidir. Yeni motor topun kime gideceğine karar vermez. Kontroller: duraklat, hız, tohumla sıfırla, iki takımın dizilişi, pres ve savunma hattı. Katmanlar: roller ve örtme çizgisi, hatlar ve ölçülü takım kutusu, hız okları, çapa hedefleri.

Sayfa ayrı Vite girişidir; oyun hiçbir laboratuvar modülü yüklemez. Laboratuvar dosyaları çevrimdışı önbelleğe alınmaz; service worker laboratuvar ad alanını ağdan geçirebilir. Önceden kurulmuş oyun worker'ı listesinde olmayan `.js` dosyalarını reddettiği için bağımsız giriş `lab/laboratory.mjs` olarak yayınlanır; böylece kullanıcı önce oyunu açıp yenilemek zorunda kalmaz. Bu geçiş eski worker fikstürüyle ayrıca tarayıcıda sınanır. Laboratuvar kendi service worker'ını kaydetmez, kariyerin localStorage alanını okumaz/yazmaz.

## Kabul ve ölçüm

`tests/match-sim.test.cjs`: deterministik konum dizisi, değişen kare hızında aynı adım sayısı, her adımda hız/ivme/dönüş sınırları, özellik ve kondisyon etkisi, presin tepki süresi ve sayısı, gerçek pas çizgisinin örtülmesi, blok ölçüleri/kayması/genişlemesi, taktik karşılıkları, girdi ve kopya sınırı. Başsız test: 90 dk = 54.000 adım, 22 oyuncu; otomatik top betiğiyle süre ölçülür. Duvar zamanı makine ve paralel test yüküne bağlı olduğundan test yapay bir zaman aşımıyla kesilmez. 

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
| Top fiziği ve pas | Metre/sn top hızı, sürtünme, havada uçuş; ilk yetişen sahip olur, çizgideki rakip pası keser | Havadaki top/spin ayrıntısı, kontrol yarıçapı, kalabalıkta temas sırası? |
| Sürme, müdahale, faul | Gerçek top–ayak mesafesi; hız/açı/zamanlama teması ve faulü üretir | Ayağa kayma, gövde teması, avantaj süresi ve hakem toleransı nasıl dengelenecek? |
| Şut ve kaleci | Şut uçuşundan isabet, blok, direk, kurtarış ve gol | Reaksiyon ve görüş engeli, uzanma sınırı, parmak ucu sapması ne düzeyde? |
| Orta ve duran toplar | Açık oyun ortası, kafa, ofsayt, korner, penaltı, serbest vuruş/baraj, taç/kale vuruşu, kaleci yumruğu ve elle dağıtım; avantaj ve kartlar | Hava topu zamanlaması, ofsayt anı, duran top yerleşimi ve kart eşikleri? |
| Özel hareket | Motor özellik, hız ve rakip mesafesinden seçer; 3D sadece oynatır | Başarı/başarısızlık zarfı ve hareket sırasında kontrol kaybı nasıl ölçülecek? |
| Olay günlüğü ve 3D | Konumlardan yan ürün `{type,minute,second,…}`; mevcut 3D olay alanlarıyla uyum ve gerçek konum akışı | Sürekli konum örnekleri günlüğe mi ayrı zaman çizgisine mi; tekrar/saklama bütçesi ne? |
| Taktikler | Mentalite, tempo, genişlik, pas stili, yaklaşım ve bireysel talimatlar davranış olur | Kullanıcı müdahalesinin ilk görülen etkisi ve denge sınırları? |
| Denge ve geçiş | Pres süresi, koşu mesafesi/sprintler, pas mesafesi/başarı, top kazanma yerleri, şut/xG/faul/kart dağılımları ölçülür | Hedef maç temposu ve istatistik aralıkları birlikte seçilecek; eski altınlar yeni motorun birebir skor hedefi değildir |

Yeni motor yalnız kullanıcının maçına bağlanacak. 3D entegrasyonu, denge ve kayıt geçişi ayrı işlerdir; eski motor ancak açık geçiş kararı ve testlerden sonra silinir.
