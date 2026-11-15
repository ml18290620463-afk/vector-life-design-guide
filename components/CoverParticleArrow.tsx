import React from 'react';

// Follow the reference's cyan → lilac → blue → pink thread along the gesture.
// Keep the particle cores saturated so the fine structure survives the pale cover.
const THREAD_COLORS = [[0, 94, 132], [87, 65, 175], [0, 105, 170], [0, 116, 140], [112, 62, 171]];
function threadColor(progress: number, highlight = false) {
  const position = Math.max(0, Math.min(1, progress)) * (THREAD_COLORS.length - 1);
  const index = Math.min(Math.floor(position), THREAD_COLORS.length - 2);
  const blend = position - index;
  return THREAD_COLORS[index].map((channel, i) => {
    const value = channel + (THREAD_COLORS[index + 1][i] - channel) * blend;
    return Math.round(highlight ? value + (255 - value) * .68 : value);
  }).join(',');
}

/** Separate translucent droplets carry light along the original brush silhouette. */
export function CoverParticleArrow() {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const source = new Image();
    let disposed = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let render: ((time: number) => void) | undefined;
    const tick = (time: number) => {
      if (disposed || document.hidden) return;
      render?.(motion.matches ? 0 : time / 1000);
      if (!motion.matches) frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      tick(performance.now());
    };
    const draw = () => {
      const width = canvas.clientWidth;
      if (!width || !source.naturalWidth || disposed) return;
      const height = width * 676 / 750;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      const makePath = (coords: number[][]) => {
        const anchors = coords.map(([x,y]) => ({x:x*width,y:y*height}));
        const points: {x:number;y:number;distance:number}[] = [];
        let distance = 0;
        for (let i=0;i<anchors.length-1;i++) {
          const a=anchors[Math.max(0,i-1)], b=anchors[i], c=anchors[i+1], d=anchors[Math.min(anchors.length-1,i+2)];
          for (let j=0;j<40;j++) {
            const t=j/40;
            const cubic=(a:number,b:number,c:number,d:number)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
            const x=cubic(a.x,b.x,c.x,d.x), y=cubic(a.y,b.y,c.y,d.y);
            const prev=points[points.length-1];
            if(prev) distance+=Math.hypot(x-prev.x,y-prev.y);
            points.push({x,y,distance});
          }
        }
        const end=anchors[anchors.length-1], prev=points[points.length-1];
        distance+=Math.hypot(end.x-prev.x,end.y-prev.y);
        points.push({...end,distance});
        return {points,length:distance};
      };
      const body=makePath([[.08,.92],[.25,.9],[.43,.79],[.55,.66],[.56,.53],[.47,.46],[.32,.45],[.23,.53],[.24,.64],[.35,.69],[.48,.63],[.62,.48],[.75,.3],[.9,.07]]);
      const mask=document.createElement('canvas');
      mask.width=source.naturalWidth;mask.height=source.naturalHeight;
      const sample=mask.getContext('2d',{willReadFrequently:true});
      if(!sample) return;
      sample.drawImage(source,0,0);
      const pixels=sample.getImageData(0,0,mask.width,mask.height).data;
      let seed=72841;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const drops: {x:number;y:number;tx:number;ty:number;progress:number;phase:number;depth:number;radius:number;sprite:HTMLCanvasElement}[]=[];
      const sprites=Array.from({length:32},(_,index)=>{
        const sprite=document.createElement('canvas');sprite.width=24;sprite.height=24;
        const context=sprite.getContext('2d')!;
        const color=threadColor(index/31);
        // Small solid grains with an offset specular shoulder, never hollow rings.
        const gradient=context.createLinearGradient(6,4,17,21);
        gradient.addColorStop(0,'rgba(250,255,255,.98)');
        gradient.addColorStop(.20,`rgba(${threadColor(index/31,true)},1)`);
        gradient.addColorStop(.44,`rgba(${color},1)`);
        gradient.addColorStop(.82,`rgba(${color},.95)`);
        gradient.addColorStop(1,`rgba(${color},.45)`);
        context.fillStyle=gradient;
        context.beginPath();context.ellipse(12,12,8,9,-.25,0,Math.PI*2);context.fill();
        context.fillStyle='rgba(249,255,255,.92)';
        context.beginPath();context.ellipse(9,7,2.4,1.6,-.5,0,Math.PI*2);context.fill();
        return sprite;
      });
      const spacing=Math.max(2.05,width/285);
      for(let y=0;y<height;y+=spacing) for(let x=0;x<width;x+=spacing) {
        const px=x+random()*spacing*.7,py=y+random()*spacing*.7;
        const sx=Math.min(mask.width-1,Math.floor(px/width*mask.width));
        const sy=Math.min(mask.height-1,Math.floor(py/height*mask.height));
        const index=(sy*mask.width+sx)*4;
        const strength=pixels[index]/255*pixels[index+3]/255;
        if(strength<.16 || random()>strength*.85) continue;
        let nearest=Infinity,progress=0,tx=0,ty=-1;
        for(let j=0;j<body.points.length-1;j++) {
          const a=body.points[j],b=body.points[j+1];
          const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
          const fraction=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/(length*length)));
          const distance=(px-a.x-dx*fraction)**2+(py-a.y-dy*fraction)**2;
          if(distance<nearest){nearest=distance;progress=(a.distance+fraction*length)/body.length;tx=dx/length;ty=dy/length;}
        }
        const depth=random();
        drops.push({x:px,y:py,tx,ty,progress,phase:random(),depth,radius:(.76+depth*.28+random()*.14)*Math.max(.85,width/750),sprite:sprites[Math.round(progress*31)]});
      }
      drops.sort((a,b)=>a.depth-b.depth);
      render = (time) => {
        ctx.clearRect(0,0,width,height);
        for(const drop of drops) {
          const phase=(drop.phase+time*(.23+drop.depth*.07))%1;
          const fade=Math.pow(Math.sin(Math.PI*phase),.5);
          const travel=(phase-.5)*26;
          const light=Math.pow((Math.cos(drop.progress*12-time*1.65)+1)/2,3);
          const swell=Math.sin(drop.progress*22-time*1.5+drop.depth)*1.1;
          const x=drop.x+drop.tx*travel-drop.ty*swell;
          const y=drop.y+drop.ty*travel+drop.tx*swell;
          const radius=drop.radius*(1+light*.12);
          const elongation=1+drop.depth*.12;
          // Broad travelling illumination, with softer distant droplets.
          ctx.globalAlpha=(.82+fade*.18)*(.86+drop.depth*.06+light*.08);
          ctx.save();
          ctx.translate(x,y);ctx.rotate(Math.atan2(drop.ty,drop.tx));
          ctx.drawImage(drop.sprite,-radius*elongation,-radius,radius*2*elongation,radius*2);
          ctx.restore();
        }
        ctx.globalAlpha=1;
        canvas.dataset.ready='true';
        canvas.dataset.material='fine-visible-grains-v4';
      };
      restart();
    };
    const observer=new ResizeObserver(draw);
    observer.observe(canvas);
    document.addEventListener('visibilitychange',restart);
    motion.addEventListener('change',restart);
    source.onload=draw;
    source.src='/vector-brush-arrow-light-mask.png';
    return () => {
      disposed=true;source.onload=null;cancelAnimationFrame(frame);observer.disconnect();
      document.removeEventListener('visibilitychange',restart);motion.removeEventListener('change',restart);
    };
  }, []);
  return <canvas ref={ref} className="vector-brush-cover__particles" aria-hidden="true" />;
}
