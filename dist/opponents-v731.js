/* Stable, locally generated league squads. No match RNG or external data is involved. */
const OPPONENT_ROLES=['GK','LB','CB','CB','RB','CM','CM','LW','CAM','RW','ST','GK','CB','CM','RW','ST'];
const OPPONENT_FIRST=['Mehmet','Emir','Kaan','Eren','Ali','Kerem','Mert','Bora','Yiğit','Deniz','Tuna','Baran','Ozan','Yusuf','Ahmet','Arda','Sinan','Umut','Ferhat','Cem','Levent','Rıza','Sarp','Selim'];
const OPPONENT_LAST=['Kaya','Demir','Aksoy','Yılmaz','Aydın','Çelik','Yıldız','Koç','Arslan','Kurt','Güneş','Polat','Şahin','Tekin','Yalçın','Özkan','Erdem','Altun','Aslan','Işık','Karaca','Öztürk','Doğan','Özer'];
function makeOpponentSquads(){
 const squads={};
 OPP.forEach((team,teamIndex)=>{
  const rng=R(731000+teamIndex*1301),base=team[1];
  squads[team[0]]=OPPONENT_ROLES.map((position,index)=>{
   const age=18+Math.floor(rng()*17),star=index===10&&rng()<.18?5:0;
   const overall=Math.round(Math.max(54,Math.min(84,base+(rng()-.5)*12+star+(index>=11?-4:0))));
   const attribute=(bias=0)=>Math.max(43,Math.min(90,Math.round(overall+bias+(rng()-.5)*17)));
   const pace=attribute(position==='LW'||position==='RW'?9:position==='CB'?-8:position==='GK'?-15:0);
   const passing=attribute(position==='CM'||position==='CAM'?7:0);
   const shooting=attribute(position==='ST'?10:position==='GK'?-23:-2);
   const tackling=attribute(['CB','LB','RB'].includes(position)?9:position==='GK'?-14:-3);
   return {id:`opp-${teamIndex}-${index}`,name:`${OPPONENT_FIRST[(teamIndex*7+index*3)%24]} ${OPPONENT_LAST[(teamIndex*5+index*7)%24]}`,
    age,position,overall,potential:Math.min(90,overall+Math.max(0,27-age)+Math.floor(rng()*5)),
    pace,acceleration:attribute(pace-overall),passing,technique:attribute((passing-overall)*.6),
    dribbling:attribute(position==='LW'||position==='RW'?7:position==='GK'?-17:0),shooting,tackling,
    positioning:attribute(position==='CB'||position==='GK'?8:0),stamina:attribute(3),
    fitness:90+Math.floor(rng()*11),form:68,gk:position==='GK'?{reflexes:attribute(9),handling:attribute(5),oneOnOne:attribute(5)}:null};
  });
 });
 return squads;
}
function ensureOpponentSquads(){
 S.opponentSquads ??=makeOpponentSquads();
 for(const team of OPP)if(!Array.isArray(S.opponentSquads[team[0]])||S.opponentSquads[team[0]].length<11)
  S.opponentSquads[team[0]]=makeOpponentSquads()[team[0]];
 S.v731 ??={schema:1,lastEvolvedFixture:-1};
}
function opponentPlayer(id){
 if(!M||typeof id!=='string'||!/^o\d+$/.test(id))return null;
 const team=M.userHome?M.away:M.home;
 const identity=M.oppLineup?.[id];
 return S.opponentSquads?.[team]?.find(p=>p.id===identity)||S.opponentSquads?.[team]?.[Number(id.slice(1))]||null;
}
function opponentLineup(name){
 const players=S.opponentSquads[name]||[];
 return Object.fromEntries(Array.from({length:11},(_,index)=>['o'+index,players[index]?.id]));
}
function evolveOpponentSquads(fixture){
 ensureOpponentSquads();if(S.v731.lastEvolvedFixture>=fixture)return;
 for(const [teamIndex,team] of OPP.entries()){
  for(const [index,p] of S.opponentSquads[team[0]].entries()){
   const rng=R(731700+fixture*721+teamIndex*43+index*7);
   const change=p.age<=23&&rng()<.14?1:p.age>=31&&rng()<.13?-1:0;
   p.overall=Math.max(50,Math.min(p.potential,p.overall+change));
   p.form=Math.max(40,Math.min(95,p.form+Math.round((rng()-.5)*5)));
   p.fitness=Math.max(60,Math.min(100,p.fitness+(fixture<17?5:7)-Math.floor(rng()*7)));
  }
 }
 S.v731.lastEvolvedFixture=fixture;
}
