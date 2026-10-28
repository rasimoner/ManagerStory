# Oyun verisi

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

Yeni saniyelik çekirdeğin ve ayrı laboratuvarın verisi; mevcut kariyer motoru bunu yüklemez. Kural kaynağı `docs/match-sim.md`.

- `pitch`: metre cinsinden saha, hedeflerin çizgiye payı, kale/ceza alanı/orta daire ölçüleri.
- `clock`: sabit adım (saniye); `epsilon` sadece kayan noktalı birikimin adım sınırını kaçırmaması için tolerans.
- `attributes`: kabul edilen özellik aralığı. `movement`: metre/sn hız ve metre/sn² ivmenin tabanı/özellik payı, kondisyon çarpanı, radyan/sn dönüş, varış toleransı, aciliyet mesafeleri ve yürüyüş/hafif koşu/koşu/sprint hız oranları.
- `decisions`: özelliğe göre 0,3–0,6 saniyelik tepki aralığı; üst tam adıma yuvarlanır. `phases`: kazanma/karşı pres pencereleri ve karşı preste tetik mesafesi çarpanı.
- `roles`: eşzamanlı pres/örtme/markaj/destek sayıları; örtme çizgisine mesafe/oran, markajın kale tarafı mesafesi, destek açıları ve derin koşu mesafesi.
- `shape`: savunma/hücum hedef boyu ve eni, takımın ortak rol hedef zarfı; topa boyuna mesafe ve enine kayma. Bunlar mevkiye özel sabit kutular değildir. Kaleci derinliği ve enine açı payı ayrıca burada.
- `tactics`: `tactics.json`'daki pres seçeneklerinin metre tetik mesafeleri ve savunma hattı seçeneklerinin metre kaydırmaları. Seçeneklerin adları kopya bir seçenek listesi oluşturmaz; arayüz doğrudan `TACTIC_DATA.options` okur.
- `formations`: yalnız deneyin 4-2-3-1 ve 4-4-2 yuvaları; hat ve merkezlenmiş normalize çapa. `x` boyuna, `y` enine. Kalecinin yeri ayrı hesaplanır. Kariyerdeki `SLOT_POS`/`oppRadarPos` aynen kalır.
- `lab`: başlangıç tohumu/taktik/diziliş/top, takım renkleri/kimlikleri, seed'li örnek oyuncu özellik aralığı, topun metre/sn senaryo hızı, bekleme süresi ve sahiplik değişim olasılığı, hız seçenekleri, klavyenin metre adımı, hız oklarının saniye ufku ve rol etiketleri. Otomatik top sunum betiğidir; motor pas kararı değildir.
