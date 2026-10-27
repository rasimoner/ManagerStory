/* Special moves: the 19 outfield moves and the keeper's own, in the order a player's list shows them.
   rating: a player's skill stars (1–5) come from a weighted flair of his attributes, against the thresholds.
   requires: a move is his when any one of its alternatives holds. In an alternative, a number is a minimum
   (stars or an attribute), role: his position is one of these, notRole: it is none of these, roleContains:
   his position's code contains this letter, move: he already has that move (moves are checked in order).
   keeper: a keeper has one star and one move, Higuita's scorpion, from this overall.
   starShow: in the star-transfer scene he shows the first of his moves in this order (the most spectacular);
   without one, the fallback; a keeper shows the scorpion or a volley from his hands. Keepers' scene stars come
   from their overall (keeperStars: the overall for 2, 3, 4, 5 stars).
   Data only: everything after "=" is JSON (tests/data.test.cjs). */
export const MOVE_DATA = {
  "moves": [
    {"id":"scorpion","name":"Akrep vuruşu","keeper":true},
    {"id":"nutmeg","name":"Bacak arası","requires":[{"stars":4},{"stars":3,"technique":76}]},
    {"id":"stepover","name":"Makas","requires":[{"stars":4,"notRole":["CB"]}]},
    {"id":"elastico","name":"Elastico","requires":[{"stars":5,"notRole":["CB"]},{"stars":4,"technique":80,"dribbling":80,"notRole":["CB"]}]},
    {"id":"nolook","name":"Bakmadan pas","requires":[{"vision":78,"technique":74}]},
    {"id":"cruyff","name":"Cruyff dönüşü","requires":[{"stars":3,"technique":70}]},
    {"id":"croqueta","name":"La Croqueta","requires":[{"stars":4,"roleContains":"M"},{"stars":4,"technique":80}]},
    {"id":"roulette","name":"Marsilya dönüşü","requires":[{"stars":5,"notRole":["CB"]},{"stars":4,"technique":80,"notRole":["CB"]}]},
    {"id":"flairnutmeg","name":"Flair bacak arası","requires":[{"move":"nutmeg","stars":4,"dribbling":78}]},
    {"id":"flairpass","name":"Makasla pas","requires":[{"move":"stepover","vision":75}]},
    {"id":"rainbow","name":"Gökkuşağı","requires":[{"stars":5,"notRole":["CB"]},{"stars":4,"dribbling":82,"notRole":["CB"]}]},
    {"id":"sombrero","name":"Aşırtma çalım","requires":[{"stars":5,"notRole":["CB"]},{"stars":4,"dribbling":81,"technique":81,"notRole":["CB"]}]},
    {"id":"juggle","name":"Sektirip geçme","requires":[{"stars":5,"notRole":["CB"]}]},
    {"id":"backheel","name":"Topuk pası","requires":[{"technique":75}]},
    {"id":"rabona","name":"Rabona","requires":[{"stars":5,"notRole":["CB"]},{"technique":86,"notRole":["CB"]}]},
    {"id":"panenka","name":"Panenka","requires":[{"composure":80,"technique":78}]},
    {"id":"bicycle","name":"Röveşata","requires":[{"role":["ST"],"stars":4},{"role":["ST"],"technique":78,"finishing":80}]},
    {"id":"chip","name":"Kaleciyi aşırtma","requires":[{"finishing":78,"technique":76}]},
    {"id":"trap","name":"Ayakla öldürme","requires":[{"technique":78}]},
    {"id":"pirouette","name":"Bergkamp dönüşü","requires":[{"role":["ST","CAM","CF"],"stars":4,"technique":80}]}
  ],
  "rating": {"flair":{"dribbling":0.6,"technique":0.4},"starsAt":[60,69,77,84],"defaultAttribute":60},
  "keeper": {"stars":1,"moves":["scorpion"],"minOverall":70},
  "starShow": {
    "order": ["elastico","rainbow","sombrero","roulette","flairnutmeg","juggle","croqueta","stepover","pirouette","rabona","bicycle","cruyff","nutmeg","flairpass","chip","panenka","backheel","nolook","trap"],
    "fallback": "juggle",
    "keeperMove": "scorpion",
    "keeperFallback": "gkvolley",
    "names": {"gkvolley":"Elden vole","juggle":"Top sektirme"},
    "keeperStars": [67,74,80,85]
  }
};
