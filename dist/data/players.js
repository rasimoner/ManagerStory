/* What a player is made of: the profile attributes, each position's typical shape (offsets from
   overall) and the attributes it is judged by, the player types with their leanings, which types a position
   can have (with weights), the wonderkid type per position, training focuses and the attribute groups shown on
   a profile.
   Data only: everything after "=" is JSON (tests/data.test.cjs). */
const PLAYER_DATA = {
  "attributes": ["pace","acceleration","finishing","passing","dribbling","technique","vision","composure","tackling","positioning","offBall","strength","stamina"],
  "positionShape": {
    "GK": {"pace":-18,"acceleration":-12,"finishing":-45,"passing":-12,"dribbling":-30,"technique":-20,"vision":-10,"composure":4,"tackling":-35,"positioning":6,"offBall":-35,"strength":2,"stamina":-6},
    "CB": {"pace":-6,"acceleration":-8,"finishing":-28,"passing":-8,"dribbling":-16,"technique":-12,"vision":-10,"composure":0,"tackling":8,"positioning":7,"offBall":-18,"strength":8,"stamina":-2},
    "FB": {"pace":5,"acceleration":4,"finishing":-24,"passing":-3,"dribbling":-4,"technique":-5,"vision":-6,"composure":-3,"tackling":4,"positioning":2,"offBall":-6,"strength":-2,"stamina":6},
    "CM": {"pace":-3,"acceleration":-2,"finishing":-10,"passing":5,"dribbling":0,"technique":2,"vision":4,"composure":2,"tackling":-2,"positioning":1,"offBall":-2,"strength":-1,"stamina":6},
    "CAM": {"pace":0,"acceleration":2,"finishing":-2,"passing":5,"dribbling":5,"technique":6,"vision":7,"composure":2,"tackling":-18,"positioning":-6,"offBall":4,"strength":-7,"stamina":0},
    "W": {"pace":9,"acceleration":8,"finishing":-3,"passing":-2,"dribbling":6,"technique":2,"vision":-2,"composure":-3,"tackling":-24,"positioning":-10,"offBall":5,"strength":-8,"stamina":2},
    "ST": {"pace":3,"acceleration":3,"finishing":8,"passing":-8,"dribbling":0,"technique":-1,"vision":-6,"composure":3,"tackling":-28,"positioning":-10,"offBall":8,"strength":3,"stamina":-1}
  },
  "positionKeys": {
    "GK": ["positioning","composure"],
    "CB": ["tackling","positioning","strength","composure"],
    "FB": ["tackling","pace","stamina","positioning","passing"],
    "CM": ["passing","vision","technique","stamina","tackling"],
    "CAM": ["passing","vision","technique","dribbling","finishing"],
    "W": ["pace","dribbling","technique","finishing","offBall"],
    "ST": ["finishing","offBall","composure","strength","pace"]
  },
  "types": {
    "dribbler": {"label":"Çalımcı","d":{"dribbling":10,"technique":8,"acceleration":5,"pace":2,"composure":2,"strength":-8,"tackling":-4,"finishing":-2}},
    "speedster": {"label":"Hızlı","d":{"pace":10,"acceleration":9,"dribbling":3,"technique":-3,"strength":-4,"composure":-4}},
    "finisher": {"label":"Golcü","d":{"finishing":10,"offBall":7,"composure":6,"dribbling":-4,"passing":-5,"vision":-4}},
    "target": {"label":"Hedef forvet","d":{"strength":12,"finishing":4,"pace":-8,"acceleration":-8,"dribbling":-7,"technique":-3}},
    "playmaker": {"label":"Oyun kurucu","d":{"vision":10,"passing":9,"technique":6,"composure":3,"tackling":-6,"strength":-5,"pace":-3}},
    "boxToBox": {"label":"Box-to-box","d":{"stamina":10,"tackling":5,"strength":4,"offBall":3,"technique":-4,"vision":-3}},
    "destroyer": {"label":"Top kesici","d":{"tackling":10,"positioning":7,"strength":5,"dribbling":-7,"technique":-5,"vision":-4}},
    "stopper": {"label":"Stoper","d":{"strength":8,"tackling":5,"positioning":3,"pace":-5,"passing":-5,"dribbling":-4}},
    "ballPlayer": {"label":"Oyun kuran stoper","d":{"passing":8,"composure":7,"vision":5,"strength":-3,"tackling":-2}},
    "wingBack": {"label":"Bindiren bek","d":{"pace":6,"stamina":7,"dribbling":5,"passing":3,"tackling":-4,"positioning":-4}},
    "keeper": {"label":"Kaleci","d":{}},
    "sweeperKeeper": {"label":"Libero kaleci","d":{"passing":10,"acceleration":6,"composure":4}}
  },
  "positionTypes": {
    "GK": [["keeper",3],["sweeperKeeper",1]],
    "CB": [["stopper",3],["ballPlayer",2],["destroyer",1]],
    "FB": [["wingBack",3],["speedster",1],["destroyer",1]],
    "CM": [["playmaker",2],["boxToBox",3],["destroyer",2]],
    "CAM": [["playmaker",2],["dribbler",2]],
    "W": [["dribbler",3],["speedster",3],["finisher",1]],
    "ST": [["finisher",3],["target",2],["speedster",1],["dribbler",1]]
  },
  "wonderTypes": {"W":"dribbler","CAM":"dribbler","ST":"finisher","CM":"playmaker","FB":"wingBack","CB":"ballPlayer","GK":"sweeperKeeper"},
  "trainingFocus": {
    "dribbling": {"label":"Çalım","attrs":["dribbling","technique"]},
    "passing": {"label":"Pas ve oyun görüşü","attrs":["passing","vision"]},
    "finishing": {"label":"Bitiricilik","attrs":["finishing","composure"]},
    "physical": {"label":"Fizik ve hız","attrs":["pace","acceleration","strength"]},
    "defending": {"label":"Savunma","attrs":["tackling","positioning"]}
  },
  "attributeGroups": [
    ["Hücum",[["finishing","Bitiricilik"],["offBall","Topsuz koşu"],["composure","Soğukkanlılık"]]],
    ["Teknik",[["dribbling","Çalım"],["technique","Teknik"],["passing","Pas"],["vision","Oyun görüşü"]]],
    ["Fizik",[["pace","Hız"],["acceleration","Çabukluk"],["strength","Güç"],["stamina","Dayanıklılık"]]],
    ["Savunma",[["tackling","Top kapma"],["positioning","Pozisyon alma"]]]
  ]
};
