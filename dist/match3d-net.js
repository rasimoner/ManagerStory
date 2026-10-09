// Local damped displacement driven by the EXISTING presentation seconds.
// A goal-frame/post never moves; only net line vertices are rewritten.
export function netDisplacement(point,impact,seconds,dir){
 if(!impact||impact.dir!==dir)return 0;
 const t=seconds-impact.seconds;if(t<=0||t>1.2)return 0;
 const radius=Math.hypot(point[1]-impact.point[1],point[2]-impact.point[2]);
 const back=dir*54.8,depth=Math.max(0,Math.min(1,(point[0]-dir*52.5)/(back-dir*52.5)));
 const edge=Math.max(0,Math.min(1,(2.3-point[1])/.35,point[1]/.12,(3.66-Math.abs(point[2]))/.35));
 if(depth===0||edge===0)return 0;
 return dir*.48*Math.sin(t*22)*Math.exp(-t*4.8)*Math.exp(-radius*radius/1.3)*depth*edge;
}
