/* Career simulation helpers shared by the season test and the characterization tests.
   FAST is game code run inside the loaded game (h.run(FAST)): it defines fastRound, fastSeason and
   autoSeasonEnd there. */
// one league round without the live engine: our game through the league model, then everything finishMatch
// does after a match (other games, league development, our development, wonderkid, academy reports)
const FAST = `function fastRound(){
 const g=currentFixture().game,i=S.leagueSchedule[S.fixture].indexOf(g);
 simAIGame(g,S.fixture,90+i);
 const xi=S.xi.map(id=>S.players.find(p=>p.id===id)).filter(Boolean);
 const ug=g.home===managedClubName()?g.hg:g.ag,rnd=R(5000+S.fixture*31+(S.seasonIndex||0)*977);
 const rows=xi.map(p=>({id:p.id,name:p.name,minutes:90,goals:0,rating:+(6+rnd()*2).toFixed(1)})),evs=[];
 for(let k=0;k<ug;k++){const front=rows.filter(r=>!/GK|CB/.test(S.players.find(p=>p.id===r.id).pos)),s=front[Math.floor(rnd()*front.length)]||rows[0];
  s.goals++;S.players.find(p=>p.id===s.id).goals++;const a=rows[Math.floor(rnd()*rows.length)];
  if(a!==s)evs.push({type:'pass',fromId:a.id,toId:s.id,fromSide:'user',toSide:'user',success:true});evs.push({type:'goal',fromId:s.id,fromSide:'user'})}
 xi.forEach(p=>p.minutes=(p.minutes||0)+90);
 simulateRoundOthers();evolveOpponentSquads(S.fixture);
 S.results.push({home:g.home,away:g.away,hg:g.hg,ag:g.ag,week:S.fixture+1,matchSummary:{players:rows,events:evs}});
 seasonRecordMatch({events:evs},S.results[S.results.length-1]);
 S.v6.academyCounter++;evolvePlayers();seasonWonderTick();if(S.v6.academyCounter>=3+(S.fixture%2))refreshAcademy();
 S.fixture=Math.min(33,S.fixture+1);S.week++;S.day=1;
}
// the last round is played, the post-match press is answered: the next day starts the season end
function fastSeason(){while(!seasonComplete())fastRound();S.week=34;S.day=4;S.event=null;advance();}
// a manager's summer: keep the useful men, release the old and the weak
function autoSeasonEnd(){let guard=0;while(S.seasonEnd&&guard++<20){const id=S.seasonEnd.steps[S.seasonEnd.at];
 if(id==='contracts'){const avg=S.players.reduce((n,p)=>n+p.overall,0)/S.players.length;
  for(const x of S.seasonEnd.data.expiring){const p=S.players.find(q=>q.id===x.id);seasonContractPick(x.id,p.overall>=avg-3&&p.age<33||isGK(p.pos)?Math.min(2,x.maxYears):0)}}
 seasonEndNext(id)}}`;
module.exports = { FAST };
