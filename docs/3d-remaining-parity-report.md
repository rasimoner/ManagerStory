# PR #16 sonrası 3D eşitliği — teslim raporu

Dal fix/3d-remaining-feature-parity. Ürün tabanı c6341386f9f0815e12aeb26bd86a77ca52942149; 7.19.3 PR adayıdır, yayımlanmış sürüm değildir. Teslim doğrulaması sürer; kanıt olmadan başarılı kontrol yazılmaz. Merge ve yayın görsel onay bekler.

Başlangıç main d86ac72de6bc4677a2357fc516c06e1ffeceed48 / 7.19.2. PR #16 merged ve Pages 41263740314 build/publish başarısı ayrı doğrulandı. PR CI 41260752142 verify geçti, iki mobil iş tarayıcı kurulumunda bekliyordu. Eski dizinin README/package/package-lock ve izlenmeyen 7.20.0 notu korunur. Node 22.23.4 kullanılır. Tek motor, saf JS/Vite/three.js mimarisi korunur.

## Önce → sonra

| Kabul | Önce | Bu dal / deneme |
|---|---|---|
| R1 dönüş | Sonuçsuz taşıma koruma zamanını yeniliyor; dokunuş henüz dönmemiş gövdeden çıkabiliyor | Taşıma niyeti/dokunuş ayrılır; gerçek 3 m ilerleme olmadan koruma maliyeti sıfırlanmaz; 1/2 |
| R2 servis | Geçici kısa seçenekler, restart/yerleşim eksikleri | Kısa/gerçek korner, uygun frikik ve açık oyun ortası ortak fizik; 2/2 |
| R3–R6 | Genel hava kontrolü | Gerçek kafa şutu, kafa pası, uzaklaştırma, vole; her biri 1/2 |
| R7 | Röveşata eksik | Açık; 2/2, ürün farkı kaldırıldı |
| R8/R10/R11/R15 | Genel gözlenen dönüş | Gerçek stepover, elastico, Cruyff, drag-back; her biri 1/2 |
| R9 | Nutmeg eksik | Gerçek jokey ayak boşluğu ve ayakta kesilme; 1/2 |
| R12/R13 | Genel dönüş | İki farklı ayakla croqueta, fiziksel tam tur roulette; her biri 2/2 |
| R14/R16/R18 | Eksik | Flair nutmeg/rainbow/juggling açık; her biri 2/2 |
| R17 | Sombrero eksik | Gerçek savunmacı üstü uçuş ve iniş takibi; 1/2 |
| R19/R20 | Normal pas | Fiziksel backheel/rabona hazırlığı ve gerçek krampon; her biri 2/2 |
| R21/R24 | Normal pas | Gerçek farklı oyuncuya baş bakışı / makas dairesinden sonra belirsiz pas; her biri 1/2 |
| R22 | Genel foot/chest/head | Gerçek incik yüksekliğini bekleyen ayak hazırlığı ve özel yumuşatma; 1/2 |
| R23/R25 | Eksik | Bergkamp/scorpion açık; her biri 2/2 |
| R26 | Mevcut kaleci zinciri | Gerçek eski pensave/starsave/gkvolley çağrıları ve normal zincir doğrulandı |
| R27 | Yalnız manuel gerçek tekrar | Aynı 180 kare kayıttan otomatik gerçek yıldız tekrarı; 2/2 |
| R28 | Arşiv move/seed tarifi sahneliyor | Gerçek kayıt yok; yeni kalıcı sistem kurulmadı, sınır raporlandı |

Doğrudan frikik, baraj, ofsayt, Panenka, chip, manuel tekrar ve PR #16 göçü yeniden uygulanmadı. Eski director/drive/move/stepBall ikinci fizik olarak çalıştırılmaz. Eski saf ayak eğrileri/kayıtlı hareketler sunumdadır. Kamera, kaleci, ayak desteği, top dönüşü, hava kontrolü, devre, gol/tribün ve 2D/3D koruma testlerindedir.

## Kesin bulgular

R1 gerçek kod sorunları heading'den erken dokunuş ve kısa sonuçsuz dribble ile shield süresinin yenilenmesidir. Yeni niyet, gerçek topu yarıçap dışındayken de takip eder; kalecinin uzak serbest top karşı örneğini korur. Özgün video 34,43 sn; 57:07/58:10/59:15 aynı bölgeyi gösterir. Özgün kariyer checkpoint/seed'i yoktur; seed 9 videonun kesin aynı kök nedeni sayılmaz.

R2 ilk denemeden sonra uzak stoperler kadro sırasıyla korner koşucusu seçiliyordu; yakın hücumcular varken gereksiz 40 m yol vardı. İkinci yaklaşım gerçek yakın koşucuları seçer; hız/zaman eşiği değiştirmez. RestartKind asıl pass eventIndex'te kalır. Eski pauseHalfPreparation:false kayıtları uyumluluk testindedir.

R12 ikinci yaklaşım destek ayağını topun dışına koyar; R13 ilk 5,584874765 rad dönüşü, toparlanmadan ayrılan gerçek dönüş süresiyle tamamlar. R19 durağan yüz dönüşünü tamamlar; R20 sığmayan duruşta normal pası seçer. R27 ikinci yaklaşım kariyer karesinin düşürdüğü observed/reachDifficulty/lastMoment kanıtını korur; genel gözlem yıldız olmaz. Tekrar motor/RNG'yi ilerletmez; kadro değişiminde temizlenir, 180 kare ve 8 MiB altı muhafazakâr kayıt sınırı korunur.

## Durdurulan altı hareket

| Konu | İlk yaklaşım | İkinci yaklaşım / kesin sonuç | Korunan ve gereken |
|---|---|---|---|
| R7 röveşata | Fiziksel overhead var; tam uçuş/iniş yok | Eski geriye flip + IK: krampon 0,933840868 m uzakta (>0,30) | Kafa/vole korunur; kemik/kalça erişimi gerekir |
| R14 flair nutmeg | Uzun hazırlıkta savunmacı 1,3 sn'de aldı | Gerçek boşluk geçildi; tam geri dönüşte topuk 0,533681087 m uzakta | Normal nutmeg/özel pas korunur; gerçek topuk hazırlığı gerekir |
| R16 rainbow | İkinci temas genel kontrolde öne taşındı | Offset yerde temizlenince 0,5 sn flick yine önden çıktı | Sombrero korunur; arka temas/yeniden kontrol geometrisi gerekir |
| R18 juggling | İkinci temas yerdeydi | 0,703 m ikinci temas oldu; savunmacı 0,9 sn / 0,962 m'de aldı | Hava kontrolü korunur; eski lunge-bacağı sekansı ve sabit kabul yeni işte netleşmeli |
| R23 Bergkamp | Savunmacı gövdenin önünde kaldı | Gerçek krampon/süreklilik/kayıt geçti; 1,781548 sn'de savunmacı aldı, tam karşı-yandan sekans yok | Trap/nutmeg korunur; ilk temas ve normal beden kaçışı birlikte çözülmeli |
| R25 scorpion | Eski eğri topa erişirken model kökü 0,943077341 m kaydı | Sabit kök + topuk IK: iki yönde 0,576207097 / 0,576207025 m uzakta | Normal kaleci zinciri korundu; kemik-yerel ileri gövde/kalça gerekir |

Başarısız ürün farkları geri alındı. tests/reproductions içindeki izler/patch'ler varsayılan CI'dan ayrıdır; patch hazır çözüm değildir. Üçüncü yaklaşım yapılmadı; bağımsız işler engellenmiş sayılmadı. Scorpion rig ön koşulu geçmediğinden kaleci sonucunu zorlayan bir dal eklenmedi. Rig prototipleri çalışan kariyer özelliği sayılmaz.

R28: recordStarMoment → recipeOf → watchHighlight → highlight-scene → director.stage. RAM tamponu arşive yazılmaz. Gerçek kayıt için sürümlü klip, rig/kadro, sıkıştırma, saklama/atım ve iPhone kotası gerekir; bu işte yeni kalıcı sistem kurulmadı.

## Kayıt, denge ve doğrulama

Yeni 8/9/10 göçleri servis, carry.skill ve özel pas duruşunu korur; ham/sıkıştırılmış ve kayıt/devam testleri vardır. Nutmeg mevcut phase ve gerçek adım segmentini kullanır; trapIntent karede türetilir; otomatik tekrar kalıcı kayıt eklemez.

Önceki ortamda Node 22 tam paket: 676 başarılı, 1 mevcut atlama + ayrı 5/5 performans; hızlı: 586 başarılı, aynı atlama + 5/5 performans. Lint/build ve otomatik tekrar/normal kariyerin dikey/yatay WebGL örnekleri geçti. Ortam eski görüntüye döndüğünden ham yerel log/medya kayboldu; teslimin yeni doğrulaması kalıcı GitHub log/artifact'larıyla tamamlanır.

20 eşlenmiş doğal saat tohumu için before.json hazırdır; after.json ve 50 tohum/güç deneyleri yeniden ölçülür. Ölçmeden denge değişmedi denmez. Golden veya lint eşiği gevşetilmez. Son ölçüm ve görsel manifest eklenecek. Son zorunlu performans kapısı iki girişimde geçmedi; PR oluşturulmaz. Ayrıntı aşağıdadır.

Görsel senaryolar: izole çekirdek durumunun gerçek kariyer UI sunumu ve ayrı normal kariyer kaydı. 390×844 / 844×390 Chromium gerçek SwiftShader WebGL2, fiziksel Safari testi değildir. Otomatik tekrar kabulü canlı tick/skor/saat/kaydın beklemesini ve aynı adıma dönüşü kontrol eder. Diğer kareler gerçek maç topunu gösterir; eski sahne tarifi tekrar diye sunulmaz.

Telefon kontrol listesi: gerçek Safari'de iki kadraj/kamera sürükleme-zoom/buton çakışması; arka plan/devam; kayıt ve 2D/3D aynı an; manuel/otomatik tekrarda saat/skor; kaleci ayakla takip/tutma/iniş/kalkış/dağıtım; kısa korner/orta/kesilme/seken top; devre/değişiklik ve tampon temizliği.

[Deneme günlüğü](3d-remaining-parity-progress.md) · [Ayrı dar devam promptları](3d-remaining-parity-follow-ups.md)

## Son kapı: performans — açık

Yeni teslim ortamında iki hızlı paketin fonksiyonel 586 testi geçti, 1 mevcut atlama korundu. Ayrı performans ilkinde 4/5, ikincide 3/5 geçti. İlk şut/kaleci örneği 2039,1 ms; ikinci örnekler 2462,5 / 1765,7 / 1646,1 ms. Workload ikinci örnekler 2237,4 / 2169,2 / 1710,3 ms. Mevcut her-koşu <2000 ms eşiği korunur; medyan veya önceki ortamın başarılı sonucuyla bu başarısızlık örtülmez. Üçüncü deneme/uzak host üzerinden yeniden koşma yapılmadı. Ürün optimizasyonu uygulanmadığından kök nedenin host etkisi mi ürün yükü mü olduğu açık kalır; aynı ortamda main kontrolü ve CPU profili sonraki dar işin gereğidir. PR açılmadı.

## Eşlenmiş 20 tohum sonucu

Aynı seed sırası, eşit slot özellikleri, 420 fizik saniyesi, iki devre, workload kapalı; Node 22.23.4. Ölçülen yeni oyun **denge bakımından aynı değildir**.

| Ölçüt | Önce ort. | Sonra ort. | Fark | Önce min/medyan/max | Sonra min/medyan/max |
|---|---:|---:|---:|---|---|
| Şut | 6.80 | 8.80 | +2.00 | 2/7/15 | 3/9/16 |
| Gol | 0.55 | 1.05 | +0.50 | 0/0/4 | 0/1/5 |
| Pas | 72.45 | 71.25 | -1.20 | 53/74.5/79 | 61/72/81 |
| Tamamlanan pas | 52.70 | 49.70 | -3.00 | 40/54/61 | 40/49.5/60 |
| Top kaybı* | 29.50 | 31.20 | +1.70 | 16/29.5/37 | 23/29.5/43 |
| Faul | 1.95 | 1.85 | -0.10 | 0/1.5/6 | 0/2/6 |
| Kurtarış | 2.35 | 3.35 | +1.00 | 0/2/8 | 0/3/7 |
| Kazanılan top | 18.25 | 19.00 | +0.75 | 12/18.5/28 | 11/19/28 |

*Top kaybı sahip takım değişimidir; verilen restart'lar dahildir. Kazanılan top ayrıca raporlanır. Küçük 20 maç örneğinde ortalama şut +2,00, gol +0,50, kurtarış +1,00; tamamlanan pas -3,00 ve top kaybı +1,70 değişti. Yeni servis/hava teması/taşıma kararlarının toplu etkisidir; tek tek özelliklere nedensel pay ayrıldığı iddia edilmez. 50 tohum/güç ölçümü ayrı tamamlanacak; bu sayılar eski golden/CI referansını otomatik yenilemek için kullanılmadı. Ham before/after ve eşlenmiş dağılım comparison.json içindedir.
