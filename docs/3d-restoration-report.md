# Eski 3D sunumunu yeni motora uyarlama — inceleme adayı

31 Ekim 2026. Başlangıç main: `21ffc2ebcbd46244238bae0e26a53a30be5c7b86` (V7.19.1). Başlangıçta açık PR yoktu. Dal: `fix/restore-3d-presentation`. Main'e birleşme, sürüm artışı veya yayın yapılmadı. **Fiziksel iPhone/Safari görsel onayı yok; özellik eşitliği bütünüyle tamamlanmış sayılmıyor.**

## A — geçmiş ve görsel referans

Eski motorun çalışan 3D yolunun yeni motor bağlantısından önceki referansı `75eb294` (V7.17.0); entegrasyon `214f7e9` (V7.18.0), kaleci zinciri `cceef45` (V7.19.0), son sunum restorasyonu `0b07859` / `e0d45e5` (V7.19.1). Son iki smoke düzeltmesi `7853804` ve `21ffc2e` korundu. Kamera kaynak dosyasının taşındığı geçmiş commit `d26c243`; sonrasında aynı kamera açıları ortak kaldı. Eski yönetmen/özel hareket dosyalarının ayrıştırma geçmişi de incelendi; yeni bir kamera tasarlanmadı.

Kullanıcının iki ekran görüntüsü ve iki kaydı incelendi: `ScreenRecording_10-31-2026 01-04-21_1(2).mp4` (1,83 sn, Yakın görünümde dönüş/mücadele) ve `(3).mp4` (28,73 sn, Otomatik/Yakın geçişi, kurtarış ve sürme). Eski görüntüde takım renkli skor, oyuncu ismi, hücum yönü ve gruplanmış kontroller; yeni görüntüde yalnız küçük skor/süre bulunuyor. Bu görüntüler görsel referanstır; otomatik test sonucu veya yeni adayın Safari onayı değildir.

### Özellik envanteri

Yollar `src/core/presentation/` köküne göredir. “Mevcuttu” V7.19.1 başlangıcını, “bu dal” yapılan bağlantıyı, “açık” gerçek kısıtı belirtir.

| Özellik | Eski kaynak / davranış | Yeni yoldaki durum ve bağlantı |
|---|---|---|
| Yayın, Yakın, Tribün açıları | `match3d/newview/camera.js:createBroadcastCamera` | V7.19.1'de zaten ortak; koordinat/FOV korunur, manuel ilk kadraj eşitliği testli. |
| Otomatik açık oyun | Aynı kamera, `mode:tv` | Mevcuttu; ortak konum, yükseklik, açı, takip eğrisi korunur. |
| Otomatik mücadele yakınlaşması | `newview/director.js:run`, yalnız `abs(ball.x)>26`, her ikinci uygun tackle; `tackle` / `beats/*` yakın kadrajı kullanır | Eksikti. Bu dal olay katılımcılarını ve uygun mücadele sayacını taşır; her top kontrolü veya her tackle yakınlaşmaz. Kamera yalnız gözlenmiş olaya bağlanır. |
| Kamera geçişleri | Ortak yönetmen çekim değiştirebiliyor, büyük farkta kesme yapıyordu | Yeni sahne her düğmede kamerayı sıfırlıyordu. Bu dal aynı kamera nesnesini korur, kesmesiz geçiş seçeneğini yalnız yeni sahnede açar. Duraklamada yalnız kamerayı çizen sınırlı RAF vardır; fizik ilerletmez. |
| Kart yakın planı | `director.js:run` yellow/red | Bu dal gerçek kart/oyuncu olayını yakın plana bağlar. |
| Şut / karşı karşıya / golcü kamerası | `director.js:shot/celebrate`, `camera.js` shot/side/close | Mevcuttu. Şut görüş zarfı artık geçişten sonra kamerayı sıçratmak yerine ortak kameranın hedef konumuna uygulanır. |
| Uzak şutta top + kale + kaleci | `camera.js` / önceki kadraj düzeltmeleri | İki yönde, üç telefon oranında kadraj testi korunur. |
| Tribün içine girmeme / gri alan | `camera.js:keepOutOfStands`, korner kadraj araması | Ortak eski sınırlar korunur; bütün saha/cihaz kombinasyonları görsel olarak onaylanmış değildir. |
| Özel çalıma bağlı yakın planlar | `beats/feints.js`, `turns.js`, `through-the-legs.js`, `over-the-top.js`, `first-touch.js`, `scorpion.js` | **Açık.** Yeni motor bu özel hareket kimliklerini üretmiyor. Genel dribble veya tackle olayı stepover/roulette/rainbow/scorpion diye sunulmaz. |
| Yürüme/koşma/sprint | `newview/runtime.js:pose/analyseGait` | Aynı klipler ve mesafe temelli faz kullanılır. Bu dal aynı kareyi yeniden örneklerken hızın değişmesini ve IK'nin klip örneğine birikmesini giderir. |
| Ayak yönü / dönüş / zemine basma | `runtime.js:pose/footIK`, `newview/facing.js` | Motor heading'i aynen korunur. Bu dal destek kilidini dönüşte yumuşak bırakır, bacak klip geçişini kısa fizik süresiyle yumuşatır; beklemede tekrarlanan kare aynı pozu verir. Sıfır kayma iddiası yoktur. |
| Sürme, sağ/sol ayak dokunuşu | `runtime.js:dribble`, `beats/footwork.js` | Eski top çözücüsü çağrılmaz. Bu dal gerçek `carry.touchTick` / alçak `firstTouch` anında en yakın ayağı gerçek topa uzatır; ayak seçimi dokunuş boyunca sabittir. |
| Topu vücutla koruma | `actions.js:shoulder` | Eksikti. Yalnız gerçek `motionMode:shield` ve top sahibi için mevcut üst gövde pozu bağlandı. |
| İkili mücadele / kayma / blok | `director.js:tackle`, `actions.js:lunge`, kayma klibi | Mevcuttu; bu dal kayma klibiyle aynı anda genel lunge uygulanmasını kaldırır; gerçek shoulder/duel olayının iki katılımcısına mevcut omuz pozu bağlanır. Yeni motorun sonuç ve grounded durumu korunur. |
| Özel çalımlar ve rakibin özel tepkisi | `SKILL_BEATS`: stepover, nutmeg, elastico, cruyff, croqueta, roulette, flairnutmeg, rainbow, sombrero, juggle; `actions.js:stumble/spread` | **Açık.** Eski beat'ler topu/oyuncuyu yönetip sonuç sahneliyor; yeni yola taşınmadılar. Motor olayında hareket kimliği olmadan rakibe uydurma düşüş gösterilmez. |
| Backheel/rabona/nolook, bicycle, Panenka/chip, Bergkamp, scorpion | `beats/flair-passes.js`, `bicycle-kick.js`, `first-touch.js`, `scorpion.js`, `director.js:shot` | **Açık.** Yeni motor genel pas/şut/ilk kontrol üretiyor; bu özel hareketler için yeterli olay yok. |
| Topun geometri ve kaplaması | `match3d-newview.js:makeBall` | Kopya kaplama vardı, dönüş eksikti. Bu dal eski modeli/kaplamayı/gölgeyi `newview/ball.js` içinde iki görünüm için ortaklaştırır. Yarıçap 0,11 m korunur. |
| Topun yuvarlanması / havada dönüşü | Eski renderer `ballAxis`, kat edilen yol / yarıçap | Bu dal aynı ekseni gözlenmiş gerçek yer değiştirmeden hesaplar; duraklama, elde tutma ve büyük zaman sıçramasında ek dönüş üretmez. |
| Oyuncu dönerken top | Eski `runtime.dribble` doğal taşıma, yeni yol gerçek top koordinatlarını alır | Dünya/yerel koordinat karışımı yok. Bu dal sahiplik durumunu da çizilen zamana örnekler; rig'in dönüşüyle top yeniden konumlandırılmaz. Motorun hızlı sahiplenme ofseti aynen kalır. |
| Havadan ilk kontrol | `beats/first-touch.js:footTrap/chestControl` | Yükseklik/alıcı aktarımı eksikti. Bu dal gerçek fractional ilk temas yüksekliğini uçuş örneklemesine ve eski chest pozuna bağlar. Motorun temas sonrası anında `height=0` kuralı değişmedi; doğal uzun iniş tamamen çözülmüş sayılmaz. |
| Kaleci bekleme / hazır / alçak-yüksek plonjon / kalkış | `runtime.js`, `actions.js`, eski keeper beat'leri; yeni `sim/keeper-animation.js` | V7.19.0 zinciri korunur. Gerçek bekleme, iki yönde uzanma, iniş, el/diz desteği, kalkış ve ikinci kurtarış testleri korunur. |
| Kalecinin iki elle topu tutması | `runtime.js:pickUp/handsOf/handIK`, `beats/keeper-hands.js` | Eller gerçek topa bağlanmıyordu. Bu dal eski iki kemikli kol IK'sini kullanır; eller erişilebilir göğüs tutuşuna kapanır, `heldBy` sürerken yalnız görünür top mesh'i iki elin ortasına bağlanır. Motordaki top çapası ve sahipliği değişmez; bırakma olayında kısa görsel geçişle gerçek serbest top örneğine dönülür. Dirsek bükülme yönü gövdeye göre sürekli tutulur. |
| Elde topun kaleciyle hareketi | Eski held fonksiyonu; yeni motorda `heldBy` / keeper possession | Yeni motor zaten heldBy ile topu kaleciye bağlar; bu metrik çapa korunur, ikinci held fiziği kurulmaz. Yerdeki kurtarışta sabit ayakta tutuş yüksekliğinin topu havada bırakmaması için görünür mesh gerçek el kemiklerini izler. Elden çıkışta fizik örneğine dönülür. |
| Kısa elle dağıtım | `gkThrow` klibi | Mevcuttu, gerçek keeperDistribution/throw ile korunur. |
| Uzun degaj | `beats/keeper-volley.js`, `actions.js:gkVolley` | Genel pas pozu gösteriliyordu. Bu dal gerçek keeperDistribution/punt için eski volley pozunu kullanır. Motorun elden bırakma yüksekliğini yeniden sahnelemez. |
| Kurtarış sonrası konum ve pozu temizleme | Eski `updateDive/updateProne`, yeni keeper zinciri | Kök konumu motordan gelir. Önceki gövde zinciri korunur; el hizalamasının ikinci kurtarışa/kalkışa sıçrama taşımaması gerçek kayıt testleriyle denetlenir. |
| Gol sevinci | `director.js:celebrate`, `actions.js:celebrate` | V7.19.1'de mevcuttu; korunur. Sonraki gerçek eylem önceliklidir, oyuncu kökü sahnelenmez. |
| Gol sonrası taraftar fotoğrafı | Eski gol geri bildirimi / `fanPhoto` | V7.19.1'de mevcuttu; takım fotoğrafı, nötr yedek ve duraklatarak smoke çekimi korunur. Bu dal yoğun temas günlüğünün gol/fotoğraf penceresini 32 olay sınırında kesmesini engeller; gerçek gol süre penceresi sonuna kadar saklanır. |
| Bayrak ve taraftar hareketi | `newview/stadium.js` shader saat/heyecanı | V7.19.1'de mevcuttu; fizik saatiyle, gol atan tribün için güncellenir. |
| Skor, isimler, olay bildirimleri, hız kontrolleri | `match3d-newview.js:paintHud`, `nv-who`, `nv-dir` | Sade skor/olay metni vardı; isim/yön eksikti. Bu dal aynı kulüp kimliğinden renkli skor, oyuncu numarası/ismi, hücum yönü ve seçili hız bilgisini bağlar. Kontroller mevcut ortak sürücüyü kullanır. |
| 22 oyuncunun topsuz hareketi / gölgeler | Eski director layout / runtime; yeni gerçek oyuncu kareleri | Bütün aktif kadro çizilir, yalnız aktif klip aktörleriyle sınırlanmaz. Eski model gölgeleri korunur, topun yükseklikten etkilenen temas gölgesi ortaklaştırılır. |
| Korner, frikik, penaltı yerleşimleri | `director.js:cornerHomes/freeKickHomes/shot(pen)` | **Kısmi/açık.** Gerçek motor konumları korunur; geçici korner yeniden başlamasında eski Tribün kadrajı bağlandı. Motorun gerçek frikik/penaltı/korner düzenleri henüz yok; eski düzenleri ikinci simülasyon olarak eklemek yasak. |
| Taç ve aut | Eski yeniden başlama beat'leri | **Kısmi/açık.** Yeni motor hâlâ kısa rakip pası / kaleci elinden geçici yeniden başlama üretir. Topun çizgi beklemesi veya yeniden konulması sunumdan değiştirilmez. |
| Devre arası / ikinci yarı / 90:00 | Eski `director.layout/resync`, devre akış kilidi | Eski kilit korunur. Bu dal yeni motorun `half` yerleşimini iki görünümde hazırlık olarak örter, görünür saati 45:00 tutar; gerçek kickoff'ta alanı açar. **İç saatin yerleşme sırasında ilerlemesi hâlâ açık**; başlangıçta hazırlık sonrası gerçek saate geçiş görülebilir. 90:00 ve fizik tick bütçesi değişmez. |
| Yıldız tekrarı / arşivi | `newview/replay.js`, eski yönetmen `starMoment` | **Açık.** Yeni motorun üretmediği özel hareketi veya ikinci maçı oluşturacak eski yönetmen bağlanmaz. |

## B–E — uygulama sınırı

- Kamera açı/formülleri yeniden tasarlanmadı. Aynı `createBroadcastCamera`, yeni yola özel kesmesiz geçiş ve gerçek şut zarfıyla kullanılır. Duraklamadaki kısa kamera RAF'ı yalnız aynı karesini çizer; `stepSimulation` çağırmaz.
- Top modelleri iki renderer için tek fabrikadan gelir. Top dönüşü gözlenmiş iki konumun düzlem mesafesidir; gerçek yarıçap değişmez, iz/ışık efekti eklenmez.
- Oyuncu kökleri, yön, serbest top konumu/yüksekliği, sahiplik ve sonuç yeni motordandır. `heldBy` sırasında görünür topun el kemiklerine bağlanması, kullanıcının açık elde tutma isteğine yönelik sunum uyarlamasıdır; motordaki top çapası ve 2D durumu değiştirilmez. Çizim örneği önceki/güncel kare ve bilinen ilk dokunuş temasından geçer; geleceği veya yeni uçuşu hesaplamaz.
- Kayma klibi ile genel müdahale pozunun aynı bacakları eşzamanlı yönetmesi kaldırılır. AnimasyonMixer'in değişmeyen track'i tekrar yazmaması yüzünden önceki IK'nin birikmesi önlenir. Ayak desteği kısa çözülmeyle bırakılır; gerçek dokunuşa sabit seçilmiş ayak uzanır.
- Yeni el hizalaması eski `handIK` matematiğini kullanır. Kaleci kökü kaydırılmaz. Yerde yakalamada motorun ayakta tutuş yüksekliği ellere erişilemiyordu; bu yüzden yalnız eldeki topun mesh'i el kavramasına bağlanır ve bırakma anında serbest fizik çizimine döner. Yeni sahnede dirsek bükülme yönü gövdeye göre korunur; kavrama ve bırakma pozu kısa geçişlidir. Önceki tam gövde kalkış zinciri değiştirilmez.
- `src/core/sim/`, karar/denge/oyuncu hızı/top fiziği/RNG ve kayıt formatı değiştirilmedi. Başlangıç/geçmiş altın kayıtlar yenilenmedi. Aynı komutlarla 2D ve 3D'nin checkpoint/olay/skor/kadro/RNG eşitliği korunur.

## Doğrulama ve açık görsel onay

Regresyonlar önce kırmızı testle yeniden üretildi: aktarılmayan ilk kontrol/olay verisi, eksik otomatik yakın plan, kamera sıfırlaması, eksik top dönüşü, erken yere indirilen kontrol, el-top ayrılığı, chest/degaj bağlantısı ve tekrarlanan dönüş karesindeki poz değişmesi. Yeni test `tests/match-sim-restoration.test.cjs`. Önceki kaleci sürekliliği testinin yeni el IK'sinde bulduğu sıçrama giderildi; eşik gevşetilmedi.

Yerel ortam Node **24.22.1**. Son odaklı kontrol **49/49**: yeni restorasyon senaryoları, 2D/3D eşitliği, gerçek rig, kamera kadrajı, eski atmosfer, kaleci animasyonu/gerçek kayıt sürekliliği ve eski scorpion sonrası kalkış. Lint ve build geçti. Lint tabanı yalnız ortak top fabrikasının giderdiği bir ihlal kadar küçüldü. Yerel hızlı pakette 440 testten 437 geçti, 1 mevcut atlama ve iki eski altın kayıt dosyasında başarısızlık var; fixture 0 aynı `21ffc2e` temiz worktree'de de aynı 2–0 / `6f89f91d9124f460dabb3dce` olay hash'iyle başarısızdır. Bu nedenle altınlar değiştirilmedi, ürün fiziği bu testi geçirmek için ayarlanmadı. CI'nin Node 22 sonucu ayrıca kaydedilmelidir; ortam farkının kesin nedeni bu aşamada kanıtlanmış değildir.

Yerel Playwright Chromium paketi yok; indirme boş/eksik ZIP döndürdü. Yerel WebGL smoke başarısızlığı tarayıcı başlatma aşamasındadır, görsel başarı sayılmaz. PR iş akışı Node 22'de lint, hızlı/tam paket, ayrı performans kapıları, build, eski/laboratuvar smoke'ları ve gerçek WebGL kariyer/kaleci kanıtlarını çalıştırır. Sunum dalında yeni 200 maçlık denge/süre taraması veya ikinci yedi dakikalık kayıt açılmaz; mevcut kapılar kaldırılmaz.

Safari onayı bekleyen kontrol listesi:

1. Otomatik/Yayın/Yakın/Tribün: önceki konumlarda kadraj, otomatik yakınlaşmanın sıklığı, düğme geçişleri, uzak şut ve çizgi kenarında dış alan.
2. 0,5×/1×/2×: yürüme, yavaş koşu, hızlanma/durma, 90°/180° dönüş, ayak yönü ve zeminde kayma.
3. Sürme/koruma/müdahale: gerçek dokunuşlar, sağ/sol ayak geçişi, topun dönüşte çizdiği yol.
4. Uzun havadan pas: temas yüksekliği, chest pozu, motorun ani yere alma sınırının ne kadar görünür kaldığı.
5. Kaleci: iki yönde alçak/yüksek kurtarış, gerçek elde tutma, hareketli elde top, kalkış, ikinci kurtarış, kısa/uzun dağıtım.
6. Gol sevinci, doğru takım taraftar fotoğrafı, bayraklar, oyuncu ismi ve 2× olay sürekliliği.
7. Devre hazırlık ekranı ve sonrasında gerçek saate geçiş; 90:00 bitiş, duraklatma, kayıt/devam, 2D/3D geçişi.
8. Gerçek iPhone Safari kare hızı ve ısınma. Masaüstü/Chromium emülasyonu bu onayın yerine geçmez.

Görsel incelemede dikey `save.png` karesinin alt köşesinde koyu saha dışı zemin görüldü; kamera sınırı için somut açık bulgudur. Safari onayıyla kapanmış sayılmaz.

**Açık kalanlar:** motorun üretmediği özel hareketler ve duran top kuralları; gerçek temasta bütün anatomik el/ayak hizalarının birebir olması; motorun kontrol anında yüksekliği sıfırlaması; motorun yeniden başlama/top konumu sıçramaları ve ikinci yarı hazırlığının gerçek saat bütçesi. Bunlar görsel eşitlikte tamamlandı olarak işaretlenmez. Main/yayın onayı istenmeden önce PR ve test sonucu somut olarak hazırlanır; bu aday kendi kendine yayınlanmaz.

### Elde topun görsel bağlanması

İlk WebGL adayında sayısal kaleci/temas testleri geçmesine rağmen, 0,95 sn kurtarış karesinde kaleci yerdeyken topun 1,21 m'de havada durduğu görüldü. `heldBy` artık görünür topun gerçek iki el kemiklerinin ortasına bağlanmasını seçer. Göğüs tutuşu bedenin gerçek pozu ve yer düzeyiyle hesaplanır. Kaleci kökü, motordaki top nesnesi, sonuç ve RNG değişmez. Bırakma olayı görünür kavramadan gözlenmiş serbest top örneğine 0,12 fizik saniyesinde geçer; yeni atış/fizik hesaplanmaz. Bu, eski V7.18 raporundaki mutlak mesh koordinatı sınırlamasının, bu işte kullanıcının açık el bağlantısı isteğiyle dar kapsamlı güncellenmesidir. Kaleci WebGL kayıt sayfası artık ürünün aynı top görünümünü kullanır ve eldeki mesh–iki el ortası boşluğunu da doğrular.

Önceki aday `32576fa` için [WebGL/kaleci doğrulaması](https://github.com/rasimoner/ManagerStory/actions/runs/41141275506) ve Node 22 hızlı paket geçti. İki görünümde 12 kaleci kaydı üretildi. Sayısal başarı görsel kaliteyi kapatmadı: yalıtılmış `catch-low-right-landscape-0.95.png` karesindeki havada tutuş bulgusu yukarıdaki mesh bağlantısına gerekçe oldu. Son el bağlantısı için aynı kapılar yeniden doğrulanır; fiziksel Safari kabulü yine ayrıdır.
