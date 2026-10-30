# Yeni motor — kariyerde gerçek konumlu 3D

Başlangıç: main `75eb294`, V7.17.0; dal `feat/match-sim-3d`.

## Bağlantı

Tek motor sürücüsü `liveFrameStep` olarak kalır. `captureSimulationFrame` bağımsız kopyasına metre konumu yanında hız, heading, takım yönü, yuva, rol, hareket, müdahale, kaleci ve gerçek temas bilgisi eklenir. Top yüksekliği, sahibi, elde tutan kaleci, şut ve hız çekirdektendir.

`scene-frame.js` yalnız gözlenmiş iki fizik karesi arasında çizim örneği üretir. Eksen eşlemesi `(x,y,h) → (x,h+top yarıçapı,y)`; oyuncu kökü yerde ve rig yönü `π/2-heading`. Takım yönü sahneyi ikinci kez aynalamaz. Fizik ilerlemeyen RAF karesi önceki fizik karesini silmez. Duraklamada güncel kare gösterilir. Çizim, simülasyon veya RNG nesnesi almaz.

İlk dört kabul testi uygulama öncesinde kırmızı çalıştı; sözleşme ve ara konum uygulamasından sonra geçti. Kariyer seçimi, gerçek WebGL görüntüleri, son doğrulama ve yayın bilgileri uygulama tamamlandığında bu rapora eklenecek.
