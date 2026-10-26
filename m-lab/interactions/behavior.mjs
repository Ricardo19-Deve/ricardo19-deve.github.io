/** M Interaction Director — pure, deterministic, no THREE/DOM dependency. */
export const M_MODES = Object.freeze({
  float:{label:"Flutuar",temporary:false},swim:{label:"Nadar",temporary:false},
  curious:{label:"Curiosidade",temporary:true,duration:3.0},
  peek:{label:"Espiar",temporary:true,duration:3.4},
  knock:{label:"Nok nok",temporary:true,duration:2.6},
  shy:{label:"Esconder",temporary:true,duration:3.1},
  follow:{label:"Seguir dedo",temporary:false}
});
export const clamp=(v,a=-1,b=1)=>Math.min(b,Math.max(a,v));
export const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
export class MInteractionDirector {
  constructor(onMode=()=>{}) {
    this.mode="float";this.returnMode="float";this.elapsed=0;this.clock=0;
    this.pointer={x:0,y:0};this.scroll=0;this.onMode=onMode;this.demo=false;
    this.demoSteps=[["float",3.5],["curious",3],["swim",6],["peek",3.4],["knock",2.6],["float",3]];
    this.demoIndex=0;this.demoAge=0;
  }
  setMode(next,{fromDemo=false}={}) {
    if(!M_MODES[next])throw new Error("Unknown M mode "+next);
    if(!fromDemo)this.demo=false;
    if(M_MODES[next].temporary && !M_MODES[this.mode].temporary)this.returnMode=this.mode;
    this.mode=next;this.elapsed=0;
    this.onMode(next);
  }
  setPointer(x,y){this.pointer.x=clamp(x);this.pointer.y=clamp(y)}
  setScroll(value){this.scroll=clamp(value)}
  setDemo(enabled){
    this.demo=Boolean(enabled);this.demoIndex=0;this.demoAge=0;
    if(enabled)this.setMode(this.demoSteps[0][0],{fromDemo:true});
  }
  step(dt) {
    dt=clamp(dt,0,.08);this.clock+=dt;this.elapsed+=dt;
    if(this.demo){
      this.demoAge+=dt;
      if(this.demoAge>=this.demoSteps[this.demoIndex][1]){
        this.demoAge=0;
        this.demoIndex=(this.demoIndex+1)%this.demoSteps.length;
        this.setMode(this.demoSteps[this.demoIndex][0],{fromDemo:true});
      }
    }else{
      const info=M_MODES[this.mode];
      if(info.temporary && this.elapsed>=info.duration)this.setMode(this.returnMode);
    }
    return this.pose();
  }
  pose(){
    const t=this.clock,a=this.elapsed,phase=ease(a/.65),p=this.pointer,s=this.scroll;
    const idleWave=Math.sin(t*1.22),idleSway=Math.sin(t*.62);
    const o={x:0,y:idleWave*.047,z:0,rx:0,ry:idleSway*.06,rz:Math.sin(t*.88)*.035,scale:1};
    switch(this.mode){
      case "swim":
        o.y+=Math.sin(t*1.5)*.042;o.x=Math.sin(t*.52)*.09;
        o.rz+=Math.sin(t*.5)*.055;
        break;
      case "curious":
        o.ry+=(p.x*.26)*phase;o.rx-=p.y*.12*phase;
        o.rz+=.12*phase;
        break;
      case "follow":
        o.x+=p.x*.47;o.y+=p.y*.23;
        o.ry+=p.x*.23;o.rx-=p.y*.12;
        break;
      case "peek":
        o.x+=-.5*phase+.13*Math.sin(a*1.7)*phase;
        o.ry+=-.43*phase;o.rz+=-.2*phase;
        break;
      case "knock":{
        const bump=(u)=>Math.exp(-Math.pow((a-u)/.11,2));
        o.z+=(bump(.75)+bump(1.23))*.29;
        o.rz+=.12*phase;o.y+=Math.sin(a*9)*.015*phase;
        break;
      }
      case "shy":
        o.x+=.5*phase;o.y-=.32*phase;o.ry+=.52*phase;o.scale=.94;
        break;
    }
    o.x+=s*.08;o.y-=s*.18;o.rz+=s*.09;
    return o;
  }
}
