/* V7.1: context-driven press questions and player conversations. No network calls. */
const PRE_PRESS = [
  ['strongOpponent', c => c.r[1]>=73, c => `${c.r[0]} ligin güçlü ekiplerinden. Maça hangi düşünceyle çıkıyorsunuz?`, ['Rakibe saygılıyız, kendi dengemizden ödün vermeyeceğiz.', 'Bu düzeydeki takımlara karşı cesur davranacağız.', 'Bireysel eşleşmelerin üzerinde çalıştık.']],
  ['weakOpponent', c => c.r[1]<70, c => `${c.r[0]} karşısında herkes üç puanı bekliyor. Bu beklenti takımı etkiler mi?`, ['Kolay maç yok; oyunumuzu kurmalıyız.', 'Sorumluluğu alıp tempoyu belirleyeceğiz.', 'Oyuncularıma güveniyorum.']],
  ['upperTable', c => c.ourRank<=6, c => `İlk altı içindesiniz. ${c.r[0]} karşısında konumunuzu korumak önemli mi?`, ['Puan durumundan önce oyunumuz önemli.', 'Hedefimizin gerektirdiği gibi oynayacağız.', 'Bu hafta detayları doğru yapmamız lazım.']],
  ['lowerTable', c => c.ourRank>=12, c => `Puan durumundaki baskı ${c.r[0]} maçına nasıl yansıyacak?`, ['Sakinliğimizi korumalıyız.', 'Sahada bir reaksiyon görmek istiyorum.', 'Takım bu baskıya birlikte cevap verecek.']],
  ['rivalRank', c => c.rivalRank<=5, c => `${c.r[0]} üst sıralarda. Sizce kilit mücadele nerede yaşanacak?`, ['Merkezde disiplin belirleyici olacak.', 'Topu kazandığımız an hızlı hareket edeceğiz.', 'Rakibin güçlü yönlerine göre hazırlanıyoruz.']],
  ['evenRank', c => Math.abs(c.ourRank-c.rivalRank)<=3, c => `Puan tablosunda ${c.r[0]} ile yakınsınız. Sahadaki farkı ne belirler?`, ['Küçük kararlar ve konsantrasyon.', 'Maçın ritmini ele geçirmeliyiz.', 'Oyuncularım bu maçı iyi okuyor.']],
  ['lastWin', c => c.lastOutcome==='G', c => `Geçen haftaki galibiyetin ardından ${c.r[0]} maçına aynı kadroyla mı çıkacaksınız?`, ['Form iyi ama kararımı hazırlığa göre veririm.', 'Kazanan oyun alışkanlıklarını sürdüreceğiz.', 'Hiçbir oyuncunun yeri garanti değil.']],
  ['lastLoss', c => c.lastOutcome==='M', c => `Geçen haftaki mağlubiyetten sonra hangi reaksiyonu bekliyorsunuz?`, ['Dengeli kalıp hataları azaltmalıyız.', 'İlk düdükten itibaren güçlü tepki bekliyorum.', 'Oyuncularım toparlanmayı biliyor.']],
  ['lastDraw', c => c.lastOutcome==='B', c => `Son beraberlikten sonra bu kez üç puan için ne değişecek?`, ['Pozisyonları daha iyi değerlendirmeliyiz.', 'Daha cesur bir başlangıç yapacağız.', 'Teknik ekip gerekli ayrıntıları çalıştı.']],
  ['winningStreak', c => c.winStreak>=2, c => `Üst üste ${c.winStreak} galibiyet aldınız. Seri sizi gevşetir mi?`, ['Seri önemlidir ama her maç sıfırdan başlar.', 'Özgüvenle oynayacağız.', 'Sorumluluğumuz her hafta artıyor.']],
  ['losingStreak', c => c.lossStreak>=2, c => `Üst üste alınan sonuçlar soyunma odasını nasıl etkiledi?`, ['Birbirimize yakın duruyoruz.', 'Artık sahada cevap vermeliyiz.', 'Oyuncuları suçlamak çözüm değil.']],
  ['homeCrowd', c => c.home, c => `Hisar Stadı'ndaki taraftar desteği ${c.r[0]} maçında ne kadar önemli?`, ['Desteği kullanıp aceleci davranmamalıyız.', 'İlk dakikadan enerji verecekler.', 'Taraftarın arkamızda olduğunu hissediyoruz.']],
  ['awayGame', c => !c.home, c => `${c.r[0]} deplasmanında oyununuzu nasıl kuracaksınız?`, ['Sabırlı ve kompakt başlayacağız.', 'Deplasmanda da kendi oyunumuza inanıyoruz.', 'Rakibin temposunu kırmanın yollarını biliyoruz.']],
  ['derby', c => /Boğaz|Beykoz|Kadıköy|Üsküdar|Hisar/.test(c.r[0]), c => `${c.r[0]} ile bu karşılaşma özel bir atmosfer taşıyor. Oyuncular bunu nasıl yaşıyor?`, ['Duyguyu kontrol etmek şart.', 'Böyle maçlar bizi motive eder.', 'Taraftarlarımız için de güçlü oynamak isteriz.']],
  ['opponentPress', c => c.r[2]==='high', c => `${c.r[0]} önde baskı kuruyor. Çıkış planınız nasıl?`, ['Baskıya karşı sakin pas yapacağız.', 'Arkadaki alanları kullanacağız.', 'Oyunculara birden fazla çıkış yolu hazırladık.']],
  ['opponentBlock', c => c.r[2]==='deep', c => `${c.r[0]} geride bekliyor. Sabırsızlığa düşer misiniz?`, ['Topu doğru bölgelerde dolaştıracağız.', 'Kenarlardan boşluk yaratmayı hedefliyoruz.', 'Sahada çözümü oyuncularım bulacak.']],
  ['starScorer', c => !!c.star, c => `${c.star.name} için özel bir rol düşündünüz mü?`, ['Takım dengesini öncelememiz gerek.', 'Doğru anda ona alan açacağız.', 'Onun yeteneğine ve kararlarına güveniyorum.']],
  ['youngTalent', c => !!c.young, c => `${c.young.name} gibi gençlere bu maçta şans verir misiniz?`, ['Gelişim planına göre karar vereceğim.', 'Hazırsa yaşı engel olmayacak.', 'Genç oyuncuları baskıdan korumak isterim.']],
  ['tiredPlayer', c => !!c.tired, c => `${c.tired.name} son günlerde yorgun görünüyor. İlk 11 için hazır mı?`, ['Sağlık ekibini dinleyeceğiz.', 'Son kararı maç saatinde vereceğim.', 'Kadronun tamamına güveniyorum.']],
  ['injury', c => !!c.injured, c => `${c.injured.name} sakatlığının kadro seçimine etkisi ne?`, ['Önce oyuncunun sağlığını düşünürüz.', 'Alternatiflerimiz göreve hazır.', 'Taktik planımızı buna göre güncelledik.']],
  ['transfer', c => !!c.newcomer, c => `Yeni transfer ${c.newcomer.name} takıma ne kattı?`, ['Önce uyum sağlaması önemli.', 'Kalitesi rekabeti yükseltecek.', 'Ona zaman ve güven vereceğiz.']],
  ['changedTactics', c => c.changedTactics, c => `Maç planındaki son değişiklik ${c.r[0]} için mi?`, ['Oyuncuların ihtiyacına göre karar verdik.', 'Rakibe sürpriz hazırladık.', 'Sahada gördüklerimize göre tekrar ayarlayabiliriz.']],
  ['cupAlive', c => c.cupAlive, c => `Türkiye Kupası hedefi lig maçının önceliğini değiştiriyor mu?`, ['Her kulvarda aynı ciddiyetle hazırlanıyoruz.', 'Rotasyonu doğru yönetmeliyiz.', 'Bugün yalnızca bu maçı düşünüyoruz.']],
  ['cupEliminated', c => !c.cupAlive, c => `Kupadan sonra lig hedeflerine odaklanmak takıma nasıl yansıdı?`, ['Önümüzdeki maça yoğunlaştık.', 'Bu hayal kırıklığını motivasyona çevireceğiz.', 'Oyuncularım yeniden ayağa kalktı.']],
  ['fanPressure', c => c.fans<60, c => `Taraftarın eleştirileri oyunculara ulaşıyor mu?`, ['Eleştirileri duyuyoruz ama soğukkanlıyız.', 'Onlara sahada cevap vereceğiz.', 'Oyuncularıma baskı yüklemeyeceğim.']],
  ['fanMomentum', c => c.fans>=75, c => `Tribündeki iyimserlik takımın hedeflerini yükseltti mi?`, ['Beklentiye kapılmadan çalışmalıyız.', 'Birlikte daha fazlasını başarabiliriz.', 'Taraftarın enerjisi oyunculara geçiyor.']],
  ['defence', c => c.r[3]>=75, c => `${c.r[0]} hücumda etkili. Savunma önlemi alacak mısınız?`, ['Hatlar arası mesafeyi koruyacağız.', 'Onları geriye koşmaya zorlayacağız.', 'Savunmacılarıma güveniyorum.']],
  ['physical', c => c.r[8]>=80, c => `Rakibin fizik gücüne nasıl karşılık vereceksiniz?`, ['İkili mücadeleleri doğru seçmeliyiz.', 'Topu hızlı dolaştıracağız.', 'Takımımız bu yoğunluğa hazır.']],
  ['generalRead', () => true, c => `${c.r[0]} karşısında oyunun anahtarı nedir?`, ['Dengeyi korumak.', 'İnisiyatif almak.', 'Doğru bireysel eşleşmeler.']],
  ['generalSquad', () => true, () => `Kadrodaki rekabet ilk 11 kararınızı zorlaştırıyor mu?`, ['Kararları form durumuna göre veriyorum.', 'Herkes hazır olmalı.', 'Takımın genel planını öne koyuyorum.']]
];
const POST_PRESS = [
  ['comfortableWin','win', c => c.margin>=3, c => `${c.margin} farklı galibiyette oyuncuların en iyi yaptığı şey neydi?`, ['Oyunu baştan sona disiplinle oynadılar.', 'Bitiriciliğimiz belirleyiciydi.', 'Bu performansı sürdürmelerini bekliyorum.']],
  ['lateWin','win', c => c.lateWinner, c => `Son dakikalarda gelen golü nasıl yaşadınız?`, ['Takım son ana kadar inandı.', 'Kenardan yaptığımız hamleler yardımcı oldu.', 'Bu mücadeleyi taraftarımız hak etti.']],
  ['comebackWin','win', c => c.comeback, c => `Geriden gelip kazanırken soyunma odasında neyi değiştirdiniz?`, ['Oyuncularımı sakin tuttum.', 'Daha cesur oynamalarını istedim.', 'Bu geri dönüş onların karakterini gösteriyor.']],
  ['bigWin','win', c => c.bigOpponent, c => `Güçlü ${c.opponent} karşısında bu sonuç size ne anlatıyor?`, ['Planı iyi uyguladık.', 'Doğru anda risk aldık.', 'Takıma duyduğum güven büyüdü.']],
  ['winStreak','win', c => c.winStreak>=3, c => `Üst üste ${c.winStreak} galibiyet; takımın sınırı nerede?`, ['Ayaklarımız yere basmalı.', 'Bu özgüveni büyütebiliriz.', 'Oyuncular daha fazlasını istiyor.']],
  ['tightWin','win', c => c.margin===1, c => `Tek farkla gelen galibiyeti nasıl değerlendiriyorsunuz?`, ['Zor anda dengemizi koruduk.', 'Daha erken koparabilirdik.', 'Bugün oyuncularım kazanmayı hak etti.']],
  ['heavyLoss','loss', c => c.margin>=3, c => `Ağır mağlubiyetin sorumluluğunu nasıl paylaşıyorsunuz?`, ['Sorumluluk benim.', 'Takım olarak hatalarımızı inceleyeceğiz.', 'Oyuncuları yalnız bırakmayacağım.']],
  ['lateLoss','loss', c => c.lateConcede, c => `Son bölümde yenilen gol sonrası takım neden dağıldı?`, ['Maç sonunu yönetemedik.', 'Savunma kararlarını değerlendireceğim.', 'Kendimize daha çok güvenmeliyiz.']],
  ['narrowLoss','loss', c => c.margin===1, c => `Tek farkla kaybedilen maçta eksik olan neydi?`, ['Son paslarda daha sakin olmalıydık.', 'Bir hamleyi daha erken yapabilirdim.', 'Oyuncularımın çabasından memnunum.']],
  ['poorPlay','loss', c => c.shots<5, c => `Az sayıda pozisyon buldunuz. Hücum planı işlemedi mi?`, ['Üretkenlik konusunda çalışacağız.', 'Rakip boşlukları kapattı.', 'Bu kadro daha fazlasını yapabilir.']],
  ['deservedMore','loss', c => c.shots>=9, c => `Çok pozisyon bulup kaybetmenizin nedeni neydi?`, ['Bitiricilikte yetersiz kaldık.', 'Planımız pozisyon üretti.', 'Oyuncularıma çalışmayı sürdüreceğiz dedim.']],
  ['lossStreak','loss', c => c.lossStreak>=2, c => `Kötü seri yönetimle ilişkinizi etkiliyor mu?`, ['Sonuçların sorumluluğunu alıyorum.', 'Çözümü sahada bulmalıyız.', 'Takımla birlikte çıkış arıyoruz.']],
  ['lostLead','draw', c => c.lostLead, c => `Öne geçmişken iki puan bırakmanızın nedeni ne?`, ['Oyunu daha iyi kontrol etmeliydik.', 'Değişikliklerin zamanını tekrar inceleyeceğim.', 'Oyuncularımın emeğini yok sayamam.']],
  ['drawComeback','draw', c => c.equalised, c => `Geriden gelip aldığınız beraberlik değerli mi?`, ['Mücadele açısından değerli.', 'Üç puan da alabilirdik.', 'Oyuncuların reaksiyonu sevindirici.']],
  ['nilNil','draw', c => c.goals===0, c => `Golsüz geçen maçta hücum üretimi neden sınırlı kaldı?`, ['Şut seçimlerimizi geliştireceğiz.', 'Savunmada sağlamdık.', 'Oyuncularım daha fazla risk alabilir.']],
  ['highDraw','draw', c => c.goals>=2, c => `${c.goals}–${c.goals} biten maçta hücum mu savunma mı ağır bastı?`, ['Savunma dengesini kaybettik.', 'Hücumdaki cesaretimiz önemliydi.', 'Maçın iniş çıkışlarını hepimiz gördük.']],
  ['evenDraw','draw', () => true, () => 'Bir puanı nasıl değerlendiriyorsunuz?', ['Dengeli bir maçtı.', 'Kazanacak fırsatlarımız vardı.', 'Bu sonucun üzerine koymalıyız.']],
  ['matchStar','player', c => !!c.star, c => `${c.star.name} bugün fark yarattı. Ona ne söylediniz?`, ['Takımın başarısını öne çıkardım.', 'Potansiyelini daha fazla kullanmasını istiyorum.', 'Onunla gurur duyuyorum.']],
  ['youngMatch','player', c => !!c.young, c => `Genç ${c.young.name} üzerindeki baskıyı nasıl yöneteceksiniz?`, ['Adım adım gelişmesini istiyoruz.', 'Sahada cesur kalmalı.', 'Tecrübeli oyuncular ona yardım ediyor.']],
  ['keeperMatch','player', c => c.keeper?.saves>=2, c => `Kaleci ${c.keeper.name} kritik kurtarışlar yaptı. Performansı nasıldı?`, ['Takıma güven verdi.', 'İyi bir maç çıkardı ama birlikte savunduk.', 'Bu standardı koruması önemli.']],
  ['scorerMatch','player', c => !!c.scorer, c => `${c.scorer.name} gol attı. Pozisyon alışını nasıl buldunuz?`, ['Doğru anda doğru yerdeydi.', 'Takımın pas bağlantısı da iyiydi.', 'Daha fazlasını yapabilir.']],
  ['underperformer','player', c => !!c.lowRated, c => `${c.lowRated.name} beklenen etkiyi yapamadı mı?`, ['Oyuncuyu tek maçla yargılamam.', 'Bir sonraki maçta reaksiyon bekliyorum.', 'Takım olarak değerlendireceğiz.']],
  ['subImpact','tactic', c => c.substitutions>0, c => `${c.substitutions} oyuncu değişikliği oyunu nasıl etkiledi?`, ['Sahadaki enerji tazelendi.', 'Bazı kararları yeniden değerlendiririm.', 'Kenardan gelenler göreve hazırdı.']],
  ['pressImpact','tactic', c => c.press==='Yüksek', () => 'Yüksek presi seçmenizin gerekçesi neydi?', ['Rakibi erken karşılamak istedik.', 'Riskini biliyorduk ama gerek vardı.', 'Oyuncularım bu tempoya hazırdı.']],
  ['shapeImpact','tactic', c => c.tactics>0, () => 'Diziliş ve maç içi taktik hamleleriniz planladığınız gibi işledi mi?', ['Bazı hamleler istediğimiz sonucu verdi.', 'Maçı okurken risk almamız gerekti.', 'Oyunculara uyumları için teşekkür ettim.']],
  ['secondHalf','tactic', c => c.secondHalfGoals>0, () => 'İkinci yarıdaki değişimin temel nedeni neydi?', ['Devrede daha net konuştuk.', 'Oyuncular doğru alanları buldu.', 'Sahada aldıkları kararlar belirleyiciydi.']],
  ['shotProfile','tactic', c => c.shots>=8, c => `${c.shots} şut ürettiniz. Bu kadar girişim planın bir parçası mıydı?`, ['Fırsat geldiğinde değerlendirmeliyiz.', 'Şut kalitesi de sayı kadar önemli.', 'Oyuncular cesaret gösterdi.']],
  ['generalResult','general', () => true, () => 'Maçın ardından ilk değerlendirmeniz nedir?', ['Oyuncuların emeğine odaklanacağım.', 'Planımızdaki ayrıntıları gözden geçireceğim.', 'Takımın bir sonraki adımını düşünmeliyiz.']]
];
function questionChoicePool(template, kind) {
  const codes=kind==='pre'?['pressCalm','pressBold','pressTactical','pressTrust']:['postMe','postDemand','postTeam','postTactical'];
  return template[4].map((answer,i)=>[answer,codes[i]]);
}
function selectPress(pool, used, context, eligibleResultTypes) {
  let candidates=pool.filter(item=>eligibleResultTypes.includes(item[1])&&item[2](context));
  if(!candidates.length)candidates=pool.filter(item=>item[1]==='general');
  const recent=used.slice(-Math.min(5,pool.length-1)), available=candidates.filter(item=>!recent.includes(item[0]));
  if(available.length)candidates=available;
  const counts=new Map(pool.map(item=>[item[0],used.filter(id=>id===item[0]).length]));
  candidates.sort((a,b)=>counts.get(a[0])-counts.get(b[0]) || ((S.week*17+S.fixture*11+a[0].length*3)%41)-((S.week*17+S.fixture*11+b[0].length*3)%41));
  const selected=candidates[0];used.push(selected[0]);if(used.length>50)used.splice(0,used.length-50);return selected;
}
function prePressContext() {
  const r=currentOpponent(),table=[...S.table].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)),form=S.form['Anadolu Hisarı']||[];
  const xi=S.players.filter(p=>S.xi.includes(p.id)), fx=currentFixture();
  return { r,home:fx.home,ourRank:table.findIndex(x=>x.n==='Anadolu Hisarı')+1,rivalRank:table.findIndex(x=>x.n===r[0])+1,
    lastOutcome:form.at(-1),winStreak:form.slice(-4).reverse().findIndex(x=>x!=='G')===-1?Math.min(4,form.length):form.slice(-4).reverse().findIndex(x=>x!=='G'),
    lossStreak:form.slice(-4).reverse().findIndex(x=>x!=='M')===-1?Math.min(4,form.length):form.slice(-4).reverse().findIndex(x=>x!=='M'),
    star:xi.slice().sort((a,b)=>b.overall-a.overall)[0],young:xi.find(p=>p.age<=20),tired:xi.find(p=>p.fitness<65),injured:xi.find(p=>p.injury>0),
    newcomer:S.players.find(p=>p.status==='Yeni transfer'&&p.minutes<180),changedTactics:S.v71.lastTacticWeek>=S.week-1,cupAlive:S.v6.cup.alive,fans:S.fans };
}
function makeV71PrePress() {
  const c=prePressContext(),question=selectPress(PRE_PRESS.map(([id,condition,prompt,answers])=>[id,'pre',condition,prompt,answers]),S.v71.preUsed,c,['pre']);
  return {kind:'press',title:'Maç Öncesi Basın Toplantısı',speaker:'Muhabir',text:question[3](c),choices:questionChoicePool(question,'pre'),questionId:question[0]};
}
function postPressContext(ug,og) {
  const side=M.userHome?0:1,events=M.events,userGoals=events.filter(e=>e.type==='goal'&&e.side===side),oppGoals=events.filter(e=>e.type==='goal'&&e.side!==side);
  let lead=0,trail=0;for(const event of events){if(event.type==='goal'){const d=(event.homeGoals-event.awayGoals)*(M.userHome?1:-1);if(d>0)lead=1;if(d<0)trail=1;}}
  const players=Object.entries(M.playerStats).map(([id,stat])=>({name:S.players.find(p=>p.id===+id)?.name||'Oyuncu',age:S.players.find(p=>p.id===+id)?.age||30,...stat}));
  const form=S.form['Anadolu Hisarı']||[];
  return { margin:Math.abs(ug-og),goals:ug,opponent:currentOpponent()[0],bigOpponent:currentOpponent()[1]>=73,lateWinner:ug>og&&userGoals.some(e=>e.minute>=80),lateConcede:ug<og&&oppGoals.some(e=>e.minute>=80),comeback:ug>og&&!!trail,lostLead:ug===og&&!!lead,equalised:ug===og&&!!trail,shots:M.shots[side],
    winStreak:form.slice(-4).reverse().findIndex(x=>x!=='G')===-1?Math.min(4,form.length):form.slice(-4).reverse().findIndex(x=>x!=='G'),
    lossStreak:form.slice(-4).reverse().findIndex(x=>x!=='M')===-1?Math.min(4,form.length):form.slice(-4).reverse().findIndex(x=>x!=='M'),
    star:players.filter(p=>p.minutes>=30).sort((a,b)=>b.rating-a.rating)[0],young:players.find(p=>p.age<=20&&p.minutes>=15),keeper:players.find(p=>p.saves>=2),scorer:players.find(p=>p.goals>0),lowRated:players.find(p=>p.rating<6),substitutions:M.substitutions.length,press:M.press,tactics:M.tacticChanges.length,secondHalfGoals:userGoals.filter(e=>e.minute>45).length };
}
function makeV71PostPress(ug,og) {
  const context=postPressContext(ug,og),type=ug>og?'win':ug<og?'loss':'draw';
  const question=selectPress(POST_PRESS,S.v71.postUsed,context,[type,'player','tactic','general']);
  return [question[3](context),questionChoicePool(question,'post'),question[0],question[1]];
}
const PLAYER_MEETINGS = [
  ['minutes',p=>!S.xi.includes(p.id)&&p.minutes<(S.fixture+1)*45,p=>`${p.age<=20?'Hocam, gelişmek için süreye ihtiyacım var.':'Hocam, daha fazla oynayabileceğimi düşünüyorum.'} Bana şans verir misiniz?`],
  ['starter',p=>!S.xi.includes(p.id)&&p.overall>=69,p=>'İlk 11 için yeterince hazır olduğumu düşünüyorum. Bana güvenmenizi istiyorum.'],
  ['position',p=>S.xi.includes(p.id)&&S.positions[p.id]&&!p.pos.split('/').includes(roleAtSlot(p,S.positions[p.id])),p=>`Kendi pozisyonum ${p.pos}. Sahada oynadığım rol bana doğal gelmiyor hocam.`],
  ['role',p=>p.passing>=70||p.finishing>=70,p=>`Bireysel rolümü konuşalım mı? ${p.pos} pozisyonunda daha fazla sorumluluk alabilirim.`],
  ['captain',p=>p.age>=27&&p.overall>=68&&p.id!==S.v71.captainId,p=>'Soyunma odasında daha fazla liderlik yapmak istiyorum. Kaptanlık için beni de düşünür müsünüz?'],
  ['teammate',p=>p.happiness<70&&p.age>=21,p=>'Bir takım arkadaşımla sahadaki iletişimimiz iyi değil. Bunu büyümeden çözmek istiyorum.'],
  ['contract',p=>p.contract<=1,p=>'Sözleşmemin sonuna yaklaşıyorum. Geleceğimi burada görebilecek miyim?'],
  ['transfer',p=>p.happiness<55,p=>'Geleceğimle ilgili konuşmak istiyorum. Ayrılma fikrini düşünmeye başladım.'],
  ['form',p=>p.form>=78,p=>'Son haftalardaki formumdan memnunum. Bu düzeni sürdürmek istiyorum.'],
  ['youngAdvice',p=>p.age<=20,p=>'Hocam, daha iyi olmak için neye odaklanmamı önerirsiniz?'],
  ['bigMatch',p=>currentOpponent()[1]>=73&&p.morale>=60,p=>'Büyük maç geliyor. Sahaya çıkmak ve takıma yardım etmek istiyorum.'],
  ['fatigue',p=>p.fitness<72,p=>'Son haftalarda yorgun hissediyorum. Biraz dinlenmeye ihtiyacım var.'],
  ['promise',p=>S.promises.some(x=>x.type==='minutes'&&x.player===p.id&&x.due<=S.week),p=>'Verdiğiniz süre sözünü hatırlıyorum hocam. Neden hâlâ fırsat bulamadım?'],
  ['newCompetition',p=>S.players.some(x=>x.status==='Yeni transfer'&&x.id!==p.id&&x.pos===p.pos),p=>'Yeni transferle rekabetten kaçmıyorum; yine de takımdaki yerimi bilmek isterim.'],
  ['happyClub',p=>p.happiness>=82,p=>'Bu kulüpte gerçekten mutluyum hocam. Burada daha fazlasını başarmak istiyorum.']
];
function buildPlayerMeeting() {
  const used=S.v71.conversations.slice(-7),last=S.v71.playerMeetings,categoryWeek=S.v71.categoryMeetings,candidates=[];
  for(const p of S.players.filter(p=>p.status!=='Transfer oldu'&&p.status!=='Kirada')){
    if(S.week-(last[p.id]??-10)<3)continue;
    for(const [kind,eligible,utterance] of PLAYER_MEETINGS){
      if(!eligible(p)||used.includes(kind)&&S.week-(categoryWeek[kind]??-10)<3)continue;
      let score=(kind==='youngAdvice'&&p.age<=19?4:0)+(kind==='captain'&&p.age>=30?3:0)+(kind==='fatigue'&&p.fitness<60?4:0)+(kind==='minutes'&&p.happiness<60?4:0)+(kind==='happyClub'&&p.happiness>90?2:0)+((p.id*7+S.week*5+kind.length)%13);
      candidates.push({p,kind,utterance,score});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  const selected=candidates[0];if(!selected)return null;
  const {p,kind,utterance}=selected;S.v71.conversations.push(kind);S.v71.conversations=S.v71.conversations.slice(-30);last[p.id]=S.week;categoryWeek[kind]=S.week;
  return {kind:'meeting',player:p.id,meetingKind:kind,title:`${p.name} kapını çalıyor`,speaker:p.name,text:utterance(p),choices:[['Seni dinliyorum; birlikte bir plan yapalım.',`meeting:${p.id}:support`],['Sahadaki performansınla cevap ver.',`meeting:${p.id}:challenge`],['Şimdilik takımın ihtiyacına göre karar vereceğim.',`meeting:${p.id}:honest`]]};
}
function settlePlayerPromises(){
  for(const promise of S.promises){if(promise.type!=='minutes'||promise.resolved)continue;
    const p=S.players.find(x=>x.id===promise.player);if(!p)continue;
    if((p.minutes-(promise.atMinutes??0))>=45){promise.resolved=true;p.happiness=clamp((p.happiness??70)+2,20,100);p.morale=clamp(p.morale+1,20,100)}
    else if(promise.due<=S.week){promise.resolved=true;p.happiness=clamp((p.happiness??70)-3,20,100);p.morale=clamp(p.morale-2,20,100);pushInbox(p.name,'Verilen süre sözü',`Hocam, süre sözü yerine gelmedi. Önümüzdeki haftaları konuşmak istiyorum.`,'player')}
  }
}
function resolvePlayerMeeting(id,response){
  const event=S.event,p=S.players.find(x=>x.id===id);if(!p||event?.kind!=='meeting'||event.player!==id||!['support','challenge','honest'].includes(response))return;
  const mod=response==='support'?2:response==='challenge'?-2:0;
  p.morale=clamp((p.morale??70)+mod,20,100);p.happiness=clamp((p.happiness??70)+mod,20,100);p.relation=clamp((p.relation??65)+(response==='support'?1:response==='challenge'?-1:0),20,100);
  applyConversationEffect('playerMeeting',response,[p]);
  if(event.meetingKind==='fatigue'&&response==='support')p.fitness=clamp(p.fitness+5,20,100);
  if(event.meetingKind==='captain'&&response==='support')S.v71.captainId=p.id;
  if((event.meetingKind==='minutes'||event.meetingKind==='starter')&&response==='support')S.promises.push({type:'minutes',player:p.id,due:S.week+3,atMinutes:p.minutes});
  if(event.meetingKind==='role'&&response==='support')p.individualRole=p.pos.split('/')[0];
  S.history.push(`${p.name} görüşmesi (${event.meetingKind}): ${response==='support'?'destekleyici':response==='challenge'?'talepkâr':'dürüst'} yanıt.`);
  save();advance();
}
