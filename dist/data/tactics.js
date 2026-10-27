/* Team tactics: the options of each setting, their labels, and the team orders.
   Data only: everything after "=" is JSON (tests/data.test.cjs). */
export const TACTIC_DATA = {
  "options": {
    "mentality": ["Temkinli","Dengeli","Cesur"],
    "press": ["Düşük","Normal","Yüksek"],
    "tempo": ["Düşük","Normal","Yüksek"],
    "line": ["Geride","Normal","Önde"],
    "approach": ["Dengeli","Kanatlar","Merkez","Kontra"],
    "passingStyle": ["Kısa","Dengeli","Direkt"],
    "width": ["Dar","Normal","Geniş"]
  },
  "labels": {"mentality":"Mentalite","press":"Pres","tempo":"Tempo","line":"Savunma çizgisi","approach":"Hücum yaklaşımı","passingStyle":"Pas stili","width":"Genişlik"},
  "orders": {"compact":"Alanı daralt","patience":"Topu dolaştır","quick":"Hızlı geçiş yap"}
};
