/* The squad a new career starts with: base ratings and contract years left. Everything else a player
   carries (fitness, morale, profile…) is given when the career is made.
   Data only: everything after "=" is JSON (tests/data.test.cjs). */
const STARTING_SQUAD = [
  {"name":"Onur","age":28,"pos":"GK","overall":70,"potential":71,"pace":45,"finishing":20,"passing":57,"dribbling":42,"defending":71,"physical":68,"stamina":73,"contract":2},
  {"name":"Berkay","age":24,"pos":"LB","overall":68,"potential":72,"pace":76,"finishing":43,"passing":66,"dribbling":69,"defending":67,"physical":65,"stamina":76,"contract":2},
  {"name":"Furkan","age":25,"pos":"CB","overall":70,"potential":73,"pace":61,"finishing":35,"passing":61,"dribbling":55,"defending":75,"physical":77,"stamina":72,"contract":2},
  {"name":"Serkan","age":34,"pos":"CB","overall":71,"potential":71,"pace":49,"finishing":33,"passing":67,"dribbling":52,"defending":79,"physical":82,"stamina":64,"contract":2},
  {"name":"Emre","age":22,"pos":"CB","overall":67,"potential":75,"pace":66,"finishing":34,"passing":60,"dribbling":57,"defending":71,"physical":73,"stamina":74,"contract":2},
  {"name":"Diallo","age":25,"pos":"RB","overall":70,"potential":74,"pace":81,"finishing":45,"passing":64,"dribbling":71,"defending":68,"physical":72,"stamina":78,"contract":2},
  {"name":"Burak","age":29,"pos":"CM","overall":73,"potential":73,"pace":67,"finishing":61,"passing":78,"dribbling":72,"defending":70,"physical":76,"stamina":80,"contract":2},
  {"name":"Taylan","age":24,"pos":"CM","overall":69,"potential":74,"pace":71,"finishing":58,"passing":73,"dribbling":70,"defending":65,"physical":68,"stamina":77,"contract":2},
  {"name":"Can","age":22,"pos":"CM","overall":68,"potential":76,"pace":72,"finishing":60,"passing":74,"dribbling":72,"defending":61,"physical":66,"stamina":79,"contract":2},
  {"name":"Kerem","age":23,"pos":"RW","overall":72,"potential":77,"pace":84,"finishing":70,"passing":69,"dribbling":79,"defending":39,"physical":58,"stamina":76,"contract":2},
  {"name":"Okoro","age":24,"pos":"LW","overall":73,"potential":78,"pace":87,"finishing":72,"passing":66,"dribbling":80,"defending":36,"physical":64,"stamina":78,"contract":2},
  {"name":"Aras","age":19,"pos":"CAM","overall":71,"potential":88,"pace":78,"finishing":68,"passing":79,"dribbling":82,"defending":44,"physical":57,"stamina":75,"contract":3},
  {"name":"Mensah","age":25,"pos":"ST","overall":74,"potential":77,"pace":92,"finishing":78,"passing":60,"dribbling":72,"defending":31,"physical":67,"stamina":76,"contract":2},
  {"name":"Oğuz","age":28,"pos":"ST","overall":72,"potential":72,"pace":63,"finishing":76,"passing":67,"dribbling":64,"defending":39,"physical":89,"stamina":72,"contract":2},
  {"name":"Yasin","age":21,"pos":"RW/LW","overall":67,"potential":75,"pace":82,"finishing":64,"passing":63,"dribbling":73,"defending":38,"physical":57,"stamina":74,"contract":2},
  {"name":"Deniz","age":17,"pos":"CM","overall":62,"potential":84,"pace":70,"finishing":54,"passing":69,"dribbling":68,"defending":55,"physical":58,"stamina":72,"contract":2}
];
