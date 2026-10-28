# Faz 4 — sürme ve mücadele: ara durum

28 Ekim 2026. **İş tamamlanmadı; bu dosya uygulama kodunun veya tamamlanmış doğrulamanın yerine geçmez.** Çalışma ortamına erişim son doğrulama sırasında kesildi. Yeni kod henüz GitHub'a aktarılmadığı için main'e birleştirme ve laboratuvar yayını yapılmadı.

## Depodaki durum

- Main: `6274f2d1c5f4bce0f4208b8e2fd639ce339f714e`.
- Özellik dalı: `feat/match-sim-duels`, main'den açıldı.
- Uygulamanın bilinen yerel commit'i: `8a0d7ce`. Son düzeltmeleri içeren amend komutunun sonucu ortam kesilince okunamadı; bu SHA son aday olarak kabul edilmemeli.
- Uygulama dosyaları kesilen çalışma ortamındaki `ManagerStory` klasöründedir. Bu rapor kaydedildiği sırada uzak dalda uygulama kaynakları bulunmuyordu.
- Sürüm 7.14.0; eski motor, 3D, kariyer ve altın kayıtlar değiştirilmedi. Hiçbir dal silinmedi.

## Erişim kesilmeden ölçülen son fizik adayı

Node 22.23.4; tohum 901; iki 4-2-3-1; Normal pres/hat/tempo, Dengeli pas; 22 oyuncu, 54.000 gerçek adım. Bunlar yerel adayın sonuçlarıdır; mevcut yayınla karıştırılmamalıdır.

| Ölçü / 90 dakika | Önceki pas işi | Son yerel aday | Kabul karşılaştırması |
|---|---:|---:|---|
| Pas | 1.358 | 883 | 800–1.000 |
| İsabet | %55,82 | %80,75 | %75–88 |
| Ortalama gerçek pas mesafesi | 25,84 m | 16,39 m | Yaklaşık 15–20 m |
| Kontrollü tamamlanan pas | 758 | 713 | İsabetin payı |
| Faul | — | 34 | Yaklaşık 20–25; yüksek |
| Sarı / kırmızı | — | 1 / 0 | Sarı yaklaşık 3–5; düşük |
| Taşıma / mesafe | 0 | 918 / 8.527,63 m | Her taşıma dizisi; çalım denemesiyle aynı tanım değil |
| Beat | 0 | 71 | Gerçek birebir karşılaşmasından kaçış |
| Müdahale | 0 | 208 | 30 kazanma / 31 sekme / 147 ıska |
| Kontrollü top kazanma | — | 204 | Pas, sürme ve serbest top dahil |
| Kontrollü pas kesme | 186 | 36 | Top kazanmanın pas alt kümesi |
| Avantaj | 0 | 3 | Gerçek temastan |
| Sahiplik, Sarı / Mavi | %49,08 / %50,92 | %48,88 / %51,12 | Fiziksel kontrol değişimi |

Son yerel raporun üç tam maç süresi **1.461 / 1.241 / 1.148 ms**; medyan **1.241 ms**. Derleme/kopyalama zaman dışında. Tek soğuk modül varyantıyla yapılan bazı test koşuları 2 saniyeyi aşmıştı. Son test düzenlemesi, rapor ve uygulama gibi aynı yüklenmiş yerel modülü topsuz ve topla deneylerde paylaşır; üç maçın her biri için 2.000 ms sınırı vardır. Bu son düzenlemenin bütün doğrulama sonucu erişim kesilince okunamadı; hız kabulü tamamlanmış sayılmamalıdır.

## Yerelde uygulanmış akış

- Serbest yuvarlanan sürme dokunuşu; bütün uygun oyuncuların aynı süpürülmüş ilk temas yarışı. Topla hız oranı %68–88, dönüş kapasitesi %62.
- Tepki anında pas/sür/koru karşılaştırması; boşluk/ilerleme/varış farkıyla sürme yönü, kısa güvenli çıkış ve süreli destek bekleyişi.
- Kale tarafı jokey/ikinci adam, ayakla/kayarak hazırlık; yön/zamanlama hatası tackling'den. Başarı veya faul sonucu zarı yok.
- Ayak yolunun top/bacak ilk kesişiminden kazanma/sekme/ıska/faul. Kaymadan sonra özelliklere bağlı yerde kalma.
- Omuzda güç ve hızdan yalnız ivmeyle yavaşlama; sahiplik hâlâ ilk gerçek temasa ait.
- Fiziksel şiddetten kart, ikinci sarı, konumsal DOGSO adayı; 3 saniyelik avantaj ve geri çağırma.
- 7. işe kadar açıkça geçici serbest vuruş: oyuncular yürüyerek/koşarak yerleşir, yerdeki rakip dahil 9,15 m şartı, kısa pas; ceza alanında en yakın kenar dışı ve `penaltyPending`.
- Gerçek birebir çıkışında `beat`; özel hareket seçimi yapılmıyor.
- Laboratuvarda seçenek puanları/ok, savunmacı durumları/temas, kısa hakem işareti, son 10 olay ve yeni sayaçlar; native telefon uzun basması.
- Son inceleme düzeltmesi: sürme dokunuşu genel boş top takibi başlatmaz; jokey, örtme, destek ve derin koşu hedefleri korunur. Kontrol zarfından uzaklaşan sürücü gerçek topa yönelir. Bütün rakiplerin fiziksel temas hakkı sürer.

Pas güvenliğinde çıkış anı önceki işte atlanıyordu; rakibin zaten eriştiği pas artık güvenli sayılmıyor. Tepki vermiş alıcıya ikinci tepki süresi eklenmiyor. Sürme tercihine ek olarak bu iki düzeltme ve ilk dokunuş katsayıları pas isabetini etkiledi.

## Yerel dosya grupları

Mevcut simülasyon/pas/rol/hareket modülleri ve laboratuvar oturumu/görünümü güncellendi. Yeni modüller:

- `core/sim/duel-state.js`, `dribble-evaluation.js`, `dribbling.js`, `owner-options.js`, `owner-pass-scan.js`
- `core/sim/defending.js`, `tackle-contact.js`, `tackle-resolution.js`, `shoulder-duels.js`, `beat-tracking.js`
- `core/sim/foul-severity.js`, `refereeing.js`, `foul-restart.js`
- `core/presentation/lab/duel-layers.js`, `event-view.js`, `long-press.js`
- `tests/match-sim-duels.test.cjs`, `tests/smoke/lab-duels.mjs`

`match-sim.json` karar/sürme/mücadele/hakem değerlerini taşır. `tests/match-sim-performance.test.cjs` tam maç tekrarını, faul öncesi teması ve hız sınırını kapsar. `docs/match-sim.md`, `architecture.md`, `code-layout.md`, `src/data/README.md` yerelde güncellendi; yerel detay raporunda son rol düzeltmesinden önceki sayılar kalan yerler varsa yenilenmelidir.

## Doğrulama ve devam adımları

Yeni sentetik testler önce kırmızı çalıştırıldı. Son fizik adayında 41 simülasyon/pas/top testi yeşildi. Son hızlı koşulardan birinde 280 davranış testi geçti; onun soğuk hız koşusu başarısız olduğu için tüm doğrulama yeşil sayılmadı. Daha önceki adayda tam paketin 368 davranış testi ve eski 12 duman + dört laboratuvar tarayıcı denemesi geçti; bunlar son aday için tekrar edilmelidir. Altınlar ve topsuz 90 dakika koordinat özeti değiştirilmedi. Son erişilebilir lint sonucu yeni ihlal yoktu, taban büyümedi.

Devam etmek için:

1. Çalışma ortamı yeniden erişilebilir olunca yerel değişiklikleri ve son amend sonucunu kurtar; uygulamanın uzak dala henüz gönderilmediğini dikkate al.
2. Kaynakları incele; son aday için Node 22'de lint, test:fast, tam npm test, build ve smoke çalıştır. Hız ölçümünün tüm örneklerini raporla.
3. Son fizik adayıyla 901, 731 ve 42 tohumlarını tekrar ölç; özellikle 34 faul ve düşük sarı sayısının sebeplerini ve sonraki denge işini rapora işle.
4. Son kaynakları ve güncel belgeleri özellik dalına aktar. Tam doğrulamadan sonra main'e birleştir; yayın sonucunu kontrol et. Silinebilecek dalları yalnız raporla.

Gerçek duran toplar/penaltı, şut/kaleci, avantajda kartın sonraki duruşta gösterilmesi ve tam DOGSO istisnaları açık kalır. Faul/kart şiddeti, kontrollü topa erişim marjı ve taşıma/beat/top kazanma tanım eşlemesi çok tohumlu denge ister.

**Telefondaki mevcut laboratuvar henüz bu değişiklikleri içermiyor.**
