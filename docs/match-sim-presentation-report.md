# V7.19.1 — kamera, tribün, gol ve ayak desteği

Başlangıç main `cceef45e606379c6dcfb92f1e30b56d410b1fcd2`, dal `fix/sim-presentation-parity`. Önceki kaleci çalışması korunur. Yeni motor bağlantısında eski sunumun eksik taşındığı doğrulandı: kamera yalnız `tv` seçiyordu, ayrıca dikeyde yükseltiliyordu; bayrak/taraftar `uTime` güncellenmiyordu; gol yalnız yazıydı. Bunlar eski renderer'da mevcutken yeni sahnede eksikti.

Dört kamera seçimi ortak eski `createBroadcastCamera` bileşenini kullanır. Manuel açıların konumu ve FOV'u eski kamera ile sayısal olarak aynı test edilir. Otomatik seçim yalnız güncel top/oyuncu ve gözlenmiş golü okur. Şut kadrajı merceği aşırı genişletmek yerine görüş doğrultusunda geri çekilerek korunur. İki takım yönünde üç telefon oranındaki mevcut direk/top/kaleci kadraj testi korunur.

Shader zamanı `physicsTime` olur: duraklama bayrakları durdurur; hız düğmeleriyle maçla birlikte ilerler. Gol takımının tribünü yükselir, karşı tribün sakinleşir. Mevcut `celebrate` üst gövde pozu 1,6 fizik saniyesi oynar; ayaklar gerçek konumlara koşmayı sürdürür. Ardından 2 fizik saniyesi mevcut kulüp taraftar fotoğrafı gösterilir. Eksik fotoğraf mevcut tarafsız görsele döner. Sonraki gerçek pas/şut/müdahale oyuncu sevincini keser.

Ayak kaymasının ölçümü: düz 4 m/sn koşu senaryosunda yere yakın ayak ardışık 60 Hz karede yaklaşık 4,7 cm hareket ediyordu. Kısa yer desteği sırasında dünya konumuna görsel iki kemikli IK uygulanır; aynı senaryoda 2,5 cm üst sınır testi geçer. Koşu klibinin 0,75'e daraltılması kaldırılır. Diz/ayak kemikleri değişir; motorun oyuncu kökü ve topu yerinden oynatılmaz. Sıfır kayma veya tüm hız/dönüşlerde kusursuz temas iddiası yoktur.

## Doğrulama

Önce kamera, tribün, gerçek el konumuyla sevinç ve gerçek ayak konumuyla kayma testleri kırmızı çalıştırıldı. Sonra uygulandı. Mevcut salt okuma rig, 2D/3D sonuç eşitliği, iki yön/dikey-yatay kadraj ve kaleci zinciri kontrolleri korunur. Altın dosyalar ve lint tabanı büyütülmez. Kontroller Node 22 ile yürütülür.

[PR doğrulama iş akışı](https://github.com/rasimoner/ManagerStory/actions/workflows/match-sim-verify.yml) lint, hızlı/tam paket ve performans kapıları, build, mevcut smoke, gerçek WebGL 3D ve kaleci hareket kayıtlarını çalıştırır. Bu sunum dalında ek denge/süre taraması ve ikinci tam yedi dakikalık izleme başlatılmaz. Zorunlu test/duman kapıları korunur.

WebGL 3D kanıt paketi `simulation-3d-mobile`: `camera-tv.png`, `camera-close.png`, `camera-stand.png`, `camera-auto.png`, `goal-celebration.png`, `goal-fan-photo.png`, `goal-return-to-play.png`; mevcut dikey/yatay kariyer kareleriyle birlikte. `verification.json` test edilen commit'i içerir. Gol dizisi açıkça izole çekirdek kabul geometrisidir; normal kariyer kanıtı santra/pas/şut/kurtarış karelerinden ayrıdır. Kaleci paketi mevcut kısa hareket kayıtlarını korur.

Yerel ortamda fiziksel telefon yoktur. Chromium telefon görünümü iPhone/Safari cihaz testi sayılmaz. Yayın yalnız bütün kapılar geçince yapılır; canlı sürüm ve kesin commit son teslim mesajında verilir. Dal silinmez.
