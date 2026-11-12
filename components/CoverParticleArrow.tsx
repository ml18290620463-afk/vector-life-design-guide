import React from 'react';

type Particle = { x: number; y: number; radius: number; progress: number; tx: number; ty: number; glint: boolean; layer: number };

/** Micro-particles follow travelling waves along the original brush gesture. */
export function CoverParticleArrow() {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const source = new Image();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    let frame = 0;
    let render: ((time: number) => void) | undefined;
    let last = 0;
    const tick = (time: number) => {
      if (disposed || document.hidden) return;
      if (time - last >= 32) { render?.(time / 1000); last = time; }
      if (!motion.matches) frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      render?.(motion.matches ? 0 : performance.now() / 1000);
      if (!document.hidden && !motion.matches) frame = requestAnimationFrame(tick);
    };
    const draw = () => {
      if (disposed || !source.naturalWidth) return;
      const width = canvas.clientWidth;
      if (!width) return;
      const height = width * source.naturalHeight / source.naturalWidth;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      const mask = document.createElement('canvas');
      mask.width = source.naturalWidth;
      mask.height = source.naturalHeight;
      const sample = mask.getContext('2d', { willReadFrequently: true });
      if (!sample) return;
      sample.drawImage(source, 0, 0);
      const pixels = sample.getImageData(0, 0, mask.width, mask.height).data;
      let seed = 72841;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      // Ordered centreline carries light through the loop before the ascending tip.
      const anchors = [[.08,.92],[.25,.9],[.43,.79],[.55,.66],[.56,.53],[.47,.46],[.32,.45],[.23,.53],[.24,.64],[.35,.69],[.48,.63],[.62,.48],[.75,.3],[.9,.07]].map(([x,y]) => ({x:x*width,y:y*height}));
      const path: {x:number;y:number}[] = [];
      for(let i=0;i<anchors.length-1;i++) {
        const a=anchors[Math.max(0,i-1)], b=anchors[i], c=anchors[i+1], d=anchors[Math.min(anchors.length-1,i+2)];
        for(let j=0;j<12;j++) {
          const t=j/12;
          const cubic=(a:number,b:number,c:number,d:number)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
          path.push({x:cubic(a.x,b.x,c.x,d.x),y:cubic(a.y,b.y,c.y,d.y)});
        }
      }
      path.push(anchors[anchors.length-1]);
      let total = 0;
      const segments = path.slice(1).map((b,i) => {
        const a = path[i]; const dx = b.x-a.x; const dy = b.y-a.y;
        const length = Math.hypot(dx,dy); const start = total; total += length;
        return {a,dx,dy,length,start};
      });
      const particles: Particle[] = [];

      const scale = width / mask.width;
      const spacing = Math.max(1.9, width / 440);
      for (let y=0;y<height;y+=spacing) for (let x=0;x<width;x+=spacing) {
        const px=x+spacing*(.4+random()*.2), py=y+spacing*(.4+random()*.2);
        const sx=Math.min(mask.width-1,Math.floor(px/scale));
        const sy=Math.min(mask.height-1,Math.floor(py/scale));
        const index=(sy*mask.width+sx)*4;
        if (random()>pixels[index]/255*pixels[index+3]/255*.88) continue;
        let nearest=Infinity, progress=0, tx=0, ty=-1;
        for (const s of segments) {
          const t=Math.max(0,Math.min(1,((px-s.a.x)*s.dx+(py-s.a.y)*s.dy)/(s.length*s.length)));
          const distance=(px-s.a.x-t*s.dx)**2+(py-s.a.y-t*s.dy)**2;
          if(distance<nearest) { nearest=distance; progress=(s.start+t*s.length)/total; tx=s.dx/s.length; ty=s.dy/s.length; }
        }
        particles.push({x:px,y:py,radius:.22+random()*.08,progress,tx,ty,glint:random()>.94,layer:Math.floor(random()*3)});

      }
      // Every edge terminates at two actual particles; small connected cells form sheets.
      const buckets=new Map<string,number[]>();
      const cell=6;
      particles.forEach((p,i)=>{
        const key=`${p.layer}:${Math.floor(p.x/cell)}:${Math.floor(p.y/cell)}`;
        const list=buckets.get(key) || []; list.push(i); buckets.set(key,list);
      });
      const edges: [number,number][]=[];
      const faces: [number,number,number][]=[];
      particles.forEach((p,i)=>{
        const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);
        const candidates: {index:number;distance:number}[]=[];
        for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) {
          for(const j of buckets.get(`${p.layer}:${cx+x}:${cy+y}`) || []) {
            if(j<=i) continue;
            const q=particles[j],distance=Math.hypot(q.x-p.x,q.y-p.y);
            const alignment=Math.abs(((q.x-p.x)*p.tx+(q.y-p.y)*p.ty)/distance);
            if(distance>1.4 && distance<5.5 && alignment>.82 && Math.abs(q.progress-p.progress)<.012) candidates.push({index:j,distance});
          }
        }
        candidates.sort((a,b)=>a.distance-b.distance);
        const close=candidates.slice(0,i%7===0 ? 2 : 1);
        close.forEach(q=>edges.push([i,q.index]));
        if(close.length===2) {
          const a=particles[close[0].index],b=particles[close[1].index];
          if(Math.hypot(a.x-b.x,a.y-b.y)<5.5) faces.push([i,close[0].index,close[1].index]);
        }
      });
      const positions=new Float32Array(particles.length*4);
      render = (time) => {
        ctx.clearRect(0,0,width,height);
        const t=motion.matches ? 0 : time;
        particles.forEach((p,i)=>{
          const wave=p.progress*Math.PI*6-t*1.55;
          const depth=p.layer-1;
          const crest=((Math.cos(wave-depth*.4)+1)/2)**4;
          // Coherent sheet movement creates thickness without random particle jitter.
          const swell=Math.sin(wave)*1.6;
          const turn=Math.cos(wave*.5)*depth*1.6;
          const transverse=depth*1.1+swell*(.45+p.layer*.23);
          positions[i*4]=p.x-p.ty*transverse+p.tx*turn;
          positions[i*4+1]=p.y+p.tx*transverse+p.ty*turn;
          positions[i*4+2]=crest;
          positions[i*4+3]=.75+p.layer*.1;
        });
        const trace=(indices:number[])=>{
          ctx.beginPath();
          indices.forEach((i,n)=>{const x=positions[i*4],y=positions[i*4+1];if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
        };
        for(let layer=0;layer<3;layer++) {
          for(const face of faces) {
            if(particles[face[0]].layer!==layer) continue;
            const light=positions[face[0]*4+2];
            if(light<.55) continue;
            trace(face);ctx.closePath();
            ctx.fillStyle=`rgba(204,232,246,${light*.055})`;ctx.fill();
          }
          ctx.lineWidth=.3;
          for(const edge of edges) {
            if(particles[edge[0]].layer!==layer) continue;
            const light=(positions[edge[0]*4+2]+positions[edge[1]*4+2])/2;
            trace(edge);
            ctx.strokeStyle=light>.65 ? `rgba(232,247,255,${.65+light*.25})` : `rgba(48,109,140,${.4+layer*.055+light*.1})`;
            ctx.stroke();
          }
          particles.forEach((p,i)=>{
            if(p.layer!==layer) return;
            const light=positions[i*4+2];
            ctx.fillStyle=p.glint && light>.6 ? 'rgba(248,253,255,.95)' : `rgba(31,91,123,${positions[i*4+3]})`;
            ctx.beginPath();ctx.arc(positions[i*4],positions[i*4+1],p.radius,0,Math.PI*2);ctx.fill();
          });
        }
        canvas.dataset.ready='true';
      };
      restart();
    };
    source.onload=draw;
    source.src='/vector-brush-arrow-light-mask.png';
    const observer=new ResizeObserver(draw);
    observer.observe(canvas);
    document.addEventListener('visibilitychange',restart);
    motion.addEventListener('change',restart);
    return () => {
      disposed=true; cancelAnimationFrame(frame); observer.disconnect();source.onload=null;
      document.removeEventListener('visibilitychange',restart);motion.removeEventListener('change',restart);
    };
  }, []);
  return <canvas ref={ref} className="vector-brush-cover__particles" aria-hidden="true" />;
}
