import React from 'react';

// The reference gesture, sampled as a smooth, arc-length-parametrized current.
const anchors = [[490,849,12],[820,792,17],[1090,672,16],[1127,558,13],[1048,484,11],[928,473,10],[804,517,20],[770,590,25],[823,643,22],[958,632,15],[1125,529,12],[1292,375,12],[1470,201,1]];
const curve = Array.from({length:1600},(_,i)=>{
  const t=i/1599*(anchors.length-1), n=Math.min(anchors.length-2,Math.floor(t)), u=t-n;
  const a=anchors[Math.max(0,n-1)],b=anchors[n],c=anchors[n+1],d=anchors[Math.min(anchors.length-1,n+2)];
  const interpolate=(k:number)=>.5*((2*b[k])+(-a[k]+c[k])*u+(2*a[k]-5*b[k]+4*c[k]-d[k])*u*u+(-a[k]+3*b[k]-3*c[k]+d[k])*u*u*u);
  return {x:interpolate(0),y:interpolate(1),width:interpolate(2),length:0};
});
for(let i=1;i<curve.length;i++) curve[i].length=curve[i-1].length+Math.hypot(curve[i].x-curve[i-1].x,curve[i].y-curve[i-1].y);
const length=curve[curve.length-1].length;
const track=Array.from({length:2400},(_,i)=>{
  const distance=i/2399*length;
  let lo=0,hi=curve.length-1;
  while(lo<hi){const m=(lo+hi)>>1;if(curve[m].length<distance)lo=m+1;else hi=m;}
  const p=curve[lo],a=curve[Math.max(0,lo-1)],b=curve[Math.min(curve.length-1,lo+1)];
  const norm=Math.hypot(b.x-a.x,b.y-a.y)||1;
  return {...p,nx:-(b.y-a.y)/norm,ny:(b.x-a.x)/norm};
});

export function CoverIceFlow() {
  const ref=React.useRef<HTMLCanvasElement>(null);
  React.useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
    let seed=41,frame=0,time=0,last=0;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const particles=Array.from({length:12500},()=>({phase:random(),lane:random()*2-1,depth:random(),speed:.016+random()*.012,r:.48+random()*.62,head:random()<.19}));
    const colors=['#7596cb','#91a8df','#abb8ed','#c3cbf2','#e2edff','#ffffff'];
    // Cached microscopic glints keep the animation inexpensive and the grain fine.
    const sprites=colors.map(color=>{
      const sprite=document.createElement('canvas');sprite.width=12;sprite.height=12;
      const c=sprite.getContext('2d')!;
      c.fillStyle=color;c.beginPath();c.ellipse(6,6,3.5,2.6,-.6,0,Math.PI*2);c.fill();
      c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.arc(5,4.8,1.1,0,Math.PI*2);c.fill();return sprite;
    });
    const render=(stamp:number)=>{
      time+=last?Math.min(stamp-last,50)/1000:0;last=stamp;
      ctx.clearRect(0,0,1672,941);
      for(const p of particles){
        const progress=(p.phase+time*p.speed)%1;
        let x:number,y:number,edge:number;
        if(p.head){
          // Both wings converge into the same point; every grain moves toward it.
          const t=progress,side=p.lane<0?-1:1;
          const spread=Math.abs(p.lane);
          const bx=side<0?1315+spread*105:1415+spread*18;
          const by=side<0?278-spread*32:345-spread*97;
          x=bx+(1470-bx)*t;y=by+(201-by)*t;
          edge=Math.min(1,t*12,(1-t)*18);
        }else{
          const point=track[Math.min(2399,Math.floor(progress*2399))];
          const lane=p.lane+Math.sin(progress*32-time*1.1+p.depth*6)*.08;
          const offset=lane*point.width*(.7+p.depth*.5);
          x=point.x+point.nx*offset;y=point.y+point.ny*offset;
          edge=Math.min(1,progress*14,(1-progress)*35);
        }
        const light=.5+.5*Math.sin(progress*20-time*2.1+p.depth*.8);
        const color=Math.min(5,Math.floor(p.depth*3+light*2.6));
        ctx.globalAlpha=edge*(.42+p.depth*.28+light*.25);
        const size=p.r*(2.7+light*.5);
        ctx.drawImage(sprites[color],x-size/2,y-size/2,size,size);
      }
      ctx.globalAlpha=1;canvas.dataset.ready='true';canvas.dataset.version='particle-body-v3';canvas.dataset.particles=String(particles.length);
      if(!reduce.matches&&!document.hidden)frame=requestAnimationFrame(render);
    };
    const restart=()=>{cancelAnimationFrame(frame);last=0;render(performance.now());};
    restart();reduce.addEventListener('change',restart);document.addEventListener('visibilitychange',restart);
    return()=>{cancelAnimationFrame(frame);reduce.removeEventListener('change',restart);document.removeEventListener('visibilitychange',restart);};
  },[]);
  return <div className="vector-brush-cover__ice-motion">
    <canvas ref={ref} width={1672} height={941} />
    <svg viewBox="0 0 1672 941" preserveAspectRatio="none" className="vector-brush-cover__beams">
      <path className="vector-brush-cover__beam vector-brush-cover__beam--one" d="M10 891 C350 645 640 710 895 653 C1050 615 1111 546 1190 535 C1390 523 1413 425 1470 201" />
      <path className="vector-brush-cover__beam vector-brush-cover__beam--two" d="M1127 322 C1290 280 1430 208 1640 147" />
    </svg>
  </div>;
}
