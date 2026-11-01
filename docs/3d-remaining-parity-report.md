# PR #16 sonrası 3D eşitliği — teslim raporu

Dal fix/3d-remaining-feature-parity. Ürün tabanı c6341386f9f0815e12aeb26bd86a77ca52942149; 7.19.3 PR adayıdır, yayımlanmış sürüm değildir. Zorunlu performans ve 50 tohum yeniden üretme kapıları kırmızıdır; teslim yeşil değildir. Merge ve yayın görsel onay bekler.

Başlangıç main d86ac72de6bc4677a2357fc516c06e1ffeceed48 / 7.19.2. PR #16 merged ve Pages 41263740314 build/publish başarısı ayrı doğrulandı. PR CI 41260752142 verify geçti. Başlangıçta tarayıcı kurulumunda bekleyen iki mobil iş son kontrolde cancelled; bu işlerin senaryoları skipped. Pages build/publish başarısı bunlardan ayrı doğrulandı. Eski dizinin README/package/package-lock ve izlenmeyen 7.20.0 notu korunur. Node 22.23.4 kullanılır. Tek motor, saf JS/Vite/three.js mimarisi korunur.

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

Önceki ortamda Node 22 tam paket: 676 başarılı, 1 mevcut atlama + ayrı 5/5 performans; hızlı: 586 başarılı, aynı atlama + 5/5 performans. Lint/build ve otomatik tekrar/normal kariyerin dikey/yatay WebGL örnekleri geçti. Ortam eski görüntüye döndüğünden ham yerel log/medya kayboldu; yeni teslimin Git commit'leri ve indirilebilir kanıt dosyaları aşağıdaki gerçek sonuçları korur.

20 eşlenmiş doğal saat tohumu ile 50 tohum/sekiz güç deneyi tamamlandı; yeni main ölçümü tarihsel 50 tohum sayaçlarını yeniden üretti. Ölçmeden denge değişmedi denmez. Golden veya lint eşiği gevşetilmez. Ham/özet ölçümler ve sınırlı görsel manifest korunur. Son zorunlu performans kapısı iki girişimde geçmedi; PR oluşturulmaz. Ayrıntı aşağıdadır.

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

*Top kaybı sahip takım değişimidir; verilen restart'lar dahildir. Kazanılan top ayrıca raporlanır. Küçük 20 maç örneğinde ortalama şut +2,00, gol +0,50, kurtarış +1,00; tamamlanan pas -3,00 ve top kaybı +1,70 değişti. Yeni servis/hava teması/taşıma kararlarının toplu etkisidir; tek tek özelliklere nedensel pay ayrıldığı iddia edilmez. 50 tohum/güç sonucu aşağıdadır; bu sayılar eski golden/CI referansını otomatik yenilemek için kullanılmadı. Ham before/after ve eşlenmiş dağılım comparison.json içindedir.

## Eşlenmiş 50 tohum: uzun adım sözleşmesinde ciddi regresyon

Aynı Node 22, aynı araç ve seed sırasıyla güncel main d86ac72 yeniden ölçüldü. Main, mevcut CI referansının her maç skorunu ve 14 sayacını birebir üretti. Aday c6341386 için mevcut compare.cjs değiştirilmeden bir kez çalıştırıldı ve exit 1 verdi: ilk seed 901 skor 1:0 yerine 8:9. Referans/golden/workflow istisnası değiştirilmedi. Bu yalnız eski bir dosyayla açıklanabilecek fark değildir; taze main karşılaştırması da farkı doğrular.

Bu laboratuvar aracı 54.000 fizik adımını çalıştırır; devre hazırlığı yüzünden tek başına tam 90:00 bitiş kanıtı değildir. Doğal 420 saniyelik 20 kariyer maçı yukarıda ayrı durur. Aşağıdaki sayılar aynı uzun adım sözleşmesinin eşlenmiş dağılımıdır.

| Ölçüt | Main ort. | Aday ort. | Fark | Main min/medyan/max | Aday min/medyan/max |
|---|---:|---:|---:|---|---|
| Şut | 17,64 | 48,46 | +30,82 | 7/17/36 | 27/47/83 |
| Gol | 2,76 | 16,92 | +14,16 | 0/3/6 | 9/17/28 |
| Pas | 798,64 | 728,98 | -69,66 | 746/798,5/845 | 664/731/784 |
| Tamamlanan pas | 632,58 | 581,22 | -51,36 | 580/632,5/678 | 506/580/642 |
| Faul | 25,88 | 30,26 | +4,38 | 14/26/36 | 19/30/44 |
| Kurtarış | 6,72 | 10,24 | +3,52 | 1/6,5/12 | 3/10/20 |
| Kazanılan top | 143,52 | 124,16 | -19,36 | 98/144/176 | 90/121,5/160 |

Kazanılan top, top kaybı diye yeniden adlandırılmadı; gerçek sahip takım değişimi 20 maçlık ölçümde ayrıca vardır. Ortalama xG 1,936→5,774, ağırlıklı kurtarış %70,89→%37,70, kırmızı kart 0,44→2,44. Sebepler tek tek değişikliklere ayrıştırılmadı; özellikle kart/eksilen kadro ile şut temas türleri birlikte incelenmelidir. Gol kotası, zorunlu kayıp veya denge çarpanı eklenmedi. Denge kapısı başarısızdır; yeni referansla kapatılmadı.

Sekiz güç deneyinde 50 maçlık aday galibiyet sayıları: all10 48, all20 50, all5 39, finishing 21, reflexes 22, defence 24, swapped10 48, equal 24. Bunlar ölçümdür, kalibrasyonun geçtiği iddiası değildir. ci-50-before-summary.json / ci-50-summary.json / ci-50-comparison.json kaynak ve dağılımları taşır; büyük ham rapor kanıt paketinde tutulur.

## Görsel kapısının mevcut sınırı

Kapsamlı yeni kayıt ilk açık oyun ortası/rabona otomatik tekrarında iki kez 45 saniyede tamamlanmadı. İlkinde 50 tohum işi eşzamanlıydı; ikincisi bu iş bittikten sonra da süre aşımı verdi. İlk videoda tekrar çubuğu yaklaşık %57'ye ilerliyordu; sonsuz döngü veya futbol kararı kilidi kanıtlanmadı. Yazılımsal WebGL'de replay RAF süresinin camera.maximumFrameSeconds ile kısılması incelenmesi gereken adaydır, kesin kök neden diye yazılmaz. Üçüncü tekrar, zaman aşımı büyütme veya otomatik paneli gizleme yapılmadı.

Test aracının başlangıç/son tick okuması data-simTick idi; gerçek öznitelik data-sim-tick'tir. Bu yüzden ilk dört dikey kayıt gerçek WebGL görüntüsü olsa da istenen temas ofseti/sekans uzunluğu kabulünü kanıtlamaz. Manifest bu kayıtları sequenceVerified:false olarak işaretler. Araç doğru öznitelik ve eksik değer assert'iyle düzeltildi; iki başarısız kayıt yeniden koşulmadı ve kapı kırmızı kalır. Bağımsız temas kareleri varsa yalnız duraklatılmış gerçek çekirdek checkpoint'inin görüntüsüdür; canlı animasyon/otomatik tekrar tamamlanması yerine geçmez. Önceki ortamın başarılı otomatik tekrar gözlemi yeni ortamın bu başarısızlığını örtmez.


## Tam doğal kariyer ve bütün süreler

npm run smoke, Node 22'de değiştirilmeden geçti: temel/legacy 12/12, laboratuvarlar, eski worker service worker, pas/mücadele/şut/denge, kariyer komut/değişiklik/kayıt/devam/skip/puan tablosu ve doğal 1× 7 dakikalık 2D maç. Telefon Chromium 390×844, 4× CPU yavaşlatma: aktif 448,582 sn; 436,2 fizik sn + 162 duruş tick'i; maç saati 90:00, skor 0:0, saat geri gitmedi. Medyan kare 16,7 ms, p95 16,8 ms; en uzun kare 766,7 ms. Eşzamanlı ölçüm/ağır fonksiyonel kontroller vardı; bu sonuç performans kapısının yerine kullanılmaz. career-mobile.json ham metrikleri korur. Bu 2D doğal kariyer kanıtıdır; izole 3D hareket sıklığı veya fiziksel Safari kanıtı değildir.

sim:duration-report değiştirilmeden 250 maçı tamamladı: reference / 180 / 300 / 420 / 600 saniye gruplarının her birinde kariyer gol/kart/dakika/asist tutarlılığı 50/50. Workload açık ve sakatlanan oyuncu laboratuvarda yedeksiz çıkar. Ortalama (gol, şut, pas): reference (17,64;46,36;716,24), 180 (0,32;3,26;30,34), 300 (0,80;5,58;50,20), 420 (1,14;7,14;69,74), 600 (1,56;11,00;102,48). Bu farklı workload/tam bitiş düzeni, önceki 54.000-adım denge ölçümüne karıştırılmaz; reference grubundaki yüksek gol ayrıca açıktır. duration-after-summary.json ve ham kanıt paketi kullanılır.


## Korunan commit'ler

| Commit | Kapsam |
|---|---|
| 90ea733ef9ef | R1 taşıma niyeti/koruma ve kaleci karşı örnekleri |
| 8c99b450da4c | R2 ortak servis, fiziksel korner yerleşimi ve gerçek yakın koşucular |
| 31fa2a0ea955 | R3–R6 gerçek hava teması |
| 0aa68d7f4062 | Altı farklı yer hareketi ve gerçek ayak eğrileri |
| edf8533d80e9 | No-look baş bakışı/normal pas fiziği |
| 0424a1f171d7 | Backheel/rabona gerçek hazırlık ve temas |
| 8b1b460c36e7 | Sombrero; durdurulan hava hareketlerinin ayrı izleri |
| 0f549b98d443 | Mevcut gerçek kayıttan otomatik tekrar |
| 7d17758ef30b | Eski makasla pas çağrısının gerçek teması |
| 721b140efbef | Özel ayakla karşılama |
| 9933258172cc | Kariyer karesinde observed/zor kurtarış kanıtını koruma |
| b7cc9d4ecd49 | Gerçek nutmeg ayak boşluğu; başarısız flair izi |
| c6341386f9f0 | Durdurulan Bergkamp/scorpion yeniden üretmeleri |
| c39eb964a71c | 7.19.3 aday metası, 20 tohum ve açık performans kapısı |

[Dal ve bütün commit'ler](https://github.com/rasimoner/ManagerStory/commits/fix/3d-remaining-feature-parity). Sonraki commit'ler yalnız ölçüm/kanıt aracı/raporu tamamlar; ürün tabanı c6341386'dır. Son teslim commit'lerinde AGENTS.md'nin hızlı paketi yeniden çalıştırma şartı, kullanıcının aynı altyapı engelinde en çok iki girişim şartı nedeniyle tekrarlanmaz; bu sapma commit mesajında açıkça yazılır. Hızlı/tam kapı başarılı ilan edilmez, başarısız performans ve 50 tohum kapısı korunur.
