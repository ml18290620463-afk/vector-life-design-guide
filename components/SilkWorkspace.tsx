import { useEffect, useRef, useState } from 'react';
import './silk-workspace.css';

function fabricMarkup(x: number, y: number, w: number, h: number) {
const b = y + h, r = x + w;
const defs=`<defs>
<linearGradient id="fabric" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff"/><stop offset=".32" stop-color="#FAFBFF"/><stop offset=".68" stop-color="#F5F8FC"/><stop offset="1" stop-color="#EAF2FA"/></linearGradient>
<linearGradient id="fold" x1="0" y1="0" x2=".15" y2="1"><stop stop-color="#d3e2ed" stop-opacity=".1"/><stop offset=".28" stop-color="#fff"/><stop offset=".44" stop-color="#f9fcff"/><stop offset=".51" stop-color="#c2d5e4" stop-opacity=".36"/><stop offset=".65" stop-color="#e2edf5"/><stop offset="1" stop-color="#f3f7fa" stop-opacity="0"/></linearGradient>
<linearGradient id="curl"><stop stop-color="#a9c4d8" stop-opacity="0"/><stop offset=".36" stop-color="#c4d8e7" stop-opacity=".32"/><stop offset=".63" stop-color="#fff"/><stop offset=".78" stop-color="#e2edf5"/><stop offset="1" stop-color="#eff5fa" stop-opacity="0"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85 .24" numOctaves="2" seed="14"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".026"/></feComponentTransfer></filter>
</defs>`;
const layers: string[] = [];
const layer = (content: string, _z: number) => { layers.push(content); };
const contour=`M${x+28} ${y} C${x+240} ${y-5} ${r-230} ${y+5} ${r-30} ${y} Q${r} ${y} ${r} ${y+32} C${r-9} ${y+220} ${r+11} ${b-180} ${r-3} ${b-39} Q${r-4} ${b-9} ${r-38} ${b-8} C${r-245} ${b-22} ${x+430} ${b+20} ${x+218} ${b+6} C${x+132} ${b} ${x+70} ${b-12} ${x+29} ${b-5} Q${x-2} ${b-3} ${x} ${b-36} C${x+7} ${b-230} ${x-6} ${y+210} ${x} ${y+30} Q${x} ${y} ${x+28} ${y}Z`;
layer(`<path fill="url(#fabric)" d="M224 0H1440V1000H224Z"/>
<g filter="url(#blur)" opacity=".22">
<path fill="url(#fold)" d="M224 ${b+125} C420 ${b-35} 670 ${b+97} 960 ${b+62} S1270 ${b-30} 1480 ${b+21} V1000H224Z"/>
<path fill="url(#curl)" d="M1460 90 C1320 260 1440 460 1395 620 C1370 740 1330 800 1460 900Z"/>
</g>
<path d="${contour}" fill="#8faac3" opacity=".07" transform="translate(0 5)" filter="url(#blur)"/>
<path d="${contour}" fill="url(#fabric)"/>
<path d="${contour}" fill="white" opacity=".18"/>
<path d="M${x+35} ${b-5} C${x+160} ${b-14} ${x+218} ${b+19} ${x+420} ${b+10} S${r-180} ${b-23} ${r-40} ${b-8}" stroke="white" stroke-width="1" opacity=".35"/>
<path fill="#9bb3c7" filter="url(#grain)" d="M224 0H1440V1000H224Z"/>`,0);
// Broad continuous material folds; crisp crests soften into the shared surface.
layer(`<defs>
<linearGradient id="turn" x1="0" y1="0" x2="0.15" y2="1"><stop stop-color="#f8fbfe" stop-opacity="0"/><stop offset=".25" stop-color="#d5e9f8" stop-opacity=".18"/><stop offset=".48" stop-color="#ffffff" stop-opacity=".75"/><stop offset=".59" stop-color="#e8f5ff" stop-opacity=".32"/><stop offset=".73" stop-color="#8fbfdf" stop-opacity=".42"/><stop offset="1" stop-color="#eaf2f9" stop-opacity="0"/></linearGradient>
<linearGradient id="edgeTurn"><stop stop-color="#e5eff8" stop-opacity="0"/><stop offset=".35" stop-color="#add2ed" stop-opacity=".28"/><stop offset=".58" stop-color="#ffffff" stop-opacity=".65"/><stop offset=".76" stop-color="#b2cde5" stop-opacity=".38"/><stop offset="1" stop-color="#eaf2f9" stop-opacity="0"/></linearGradient>
<linearGradient id="fadeLine"><stop stop-color="white" stop-opacity="0"/><stop offset=".35" stop-color="white"/><stop offset=".8" stop-color="white" stop-opacity=".6"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
<filter id="silkSoft"><feGaussianBlur stdDeviation="1.2"/></filter>
<filter id="silkShadow"><feGaussianBlur stdDeviation="15"/></filter>
</defs>
<path d="M240 ${b+82} C380 ${b+51} 459 ${b-32} 564 ${b-17} C678 ${b-1} 724 ${b+57} 925 ${b+53}" stroke="#C6CCE2" stroke-opacity=".12" stroke-width="18" filter="url(#silkShadow)"/>
<path d="M224 ${b+110} C346 ${b+75} 431 ${b-32} 552 ${b-34} C681 ${b-35} 742 ${b+48} 963 ${b+35} C802 ${b+101} 664 ${b+26} 554 ${b+9} C438 ${b-10} 355 ${b+116} 224 ${b+138}Z" fill="url(#turn)" filter="url(#silkSoft)"/>
<path d="M245 ${b+105} C382 ${b+61} 445 ${b-23} 554 ${b-20} C677 ${b-18} 758 ${b+60} 950 ${b+40}" stroke="url(#fadeLine)" stroke-width="1.0" opacity=".55"/>
<path d="M${r+45} ${y+80} C${r-8} ${y+200} ${r-62} ${y+280} ${r-37} ${y+390} C${r-10} ${y+487} ${r+39} ${y+535} ${r+40} ${b+10} L1460 ${b+65} C${r+61} ${y+496} ${r+6} ${y+440} ${r-4} ${y+368} C${r-22} ${y+256} ${r+45} ${y+173} 1460 ${y+90}Z" fill="url(#edgeTurn)" filter="url(#silkSoft)"/>
<path d="M${r+35} ${y+120} C${r-9} ${y+229} ${r-36} ${y+281} ${r-24} ${y+364} C${r-9} ${y+450} ${r+35} ${y+530} ${r+41} ${b-5}" stroke="white" stroke-opacity=".28" stroke-width="1.1"/>
`,5);
// A translucent turn: broad lit face narrows into a blue reverse face.
layer(`<defs>
<linearGradient id="ribbonFace" x1="0" y1="0" x2=".15" y2="1"><stop stop-color="#ffffff" stop-opacity=".12"/><stop offset=".28" stop-color="#ffffff" stop-opacity=".8"/><stop offset=".52" stop-color="#d5e9f7" stop-opacity=".46"/><stop offset=".79" stop-color="#B9D4EC" stop-opacity=".62"/><stop offset="1" stop-color="#eff8ff" stop-opacity=".12"/></linearGradient>
<linearGradient id="ribbonReverse" x1="0" y1="0" x2="1" y2=".3"><stop stop-color="#e5f3ff" stop-opacity="0"/><stop offset=".42" stop-color="#9CC2E3" stop-opacity=".62"/><stop offset=".65" stop-color="#c9e4f6" stop-opacity=".35"/><stop offset=".86" stop-color="#ffffff" stop-opacity=".7"/><stop offset="1" stop-color="#d6eafa" stop-opacity="0"/></linearGradient>
<filter id="wovenSoft"><feGaussianBlur stdDeviation=".45"/></filter>
</defs>
<path d="M225 ${b+93} C358 ${b+48} 402 ${b-43} 524 ${b-20} C628 ${b-1} 674 ${b+91} 777 ${b+62} C661 ${b+65} 611 ${b+26} 518 ${b+19} C394 ${b+1} 332 ${b+118} 225 ${b+139}Z" fill="url(#ribbonFace)" filter="url(#wovenSoft)"/>
<path d="M493 ${b+9} C612 ${b+3} 667 ${b+93} 777 ${b+62} C873 ${b+35} 931 ${b-7} 1030 ${b-4} C934 ${b+27} 873 ${b+80} 773 ${b+75} C661 ${b+71} 601 ${b+32} 493 ${b+9}Z" fill="url(#ribbonReverse)" filter="url(#wovenSoft)"/>
<path d="M231 ${b+96} C358 ${b+50} 409 ${b-40} 524 ${b-19} C628 ${b} 674 ${b+91} 777 ${b+63} S946 ${b-1} 1020 ${b-3}" stroke="white" stroke-opacity=".55" stroke-width="1.1"/>
<path d="M${r+29} ${y+125} C${r-62} ${y+250} ${r-60} ${y+305} ${r-23} ${y+391} C${r+9} ${y+466} ${r+25} ${y+500} ${r+29} ${b-5} C${r+32} ${y+477} ${r-7} ${y+436} ${r-11} ${y+361} C${r-16} ${y+266} ${r+30} ${y+222} ${r+29} ${y+125}Z" fill="url(#ribbonReverse)" filter="url(#wovenSoft)"/>
`,5);
let threads='';
for(let i=0;i<64;i++){
 const t=i/63,a=t*39,alpha=.035+.065*(.5+.5*Math.sin(i*2.39));
 threads+=`<path d="M225 ${b+94+a} C358 ${b+49+a*.95} 402 ${b-42+a} 524 ${b-20+a} C628 ${b-1+a*.67} 674 ${b+91-a*.6} 777 ${b+62+t*12}" stroke="${i%4===0?'#9CC2E3':'#ffffff'}" stroke-width=".4" stroke-opacity="${alpha}"/>`;
 threads+=`<path d="M${r+29} ${y+125+t*18} C${r-62+t*37} ${y+250} ${r-60+t*44} ${y+305} ${r-23+t*12} ${y+391} C${r+9+t*4} ${y+466} ${r+25+t*3} ${y+500} ${r+29} ${b-5}" stroke="${i%4===0?'#9CC2E3':'#ffffff'}" stroke-width=".4" stroke-opacity="${alpha}"/>`;
}
layer(`<defs><filter id="floatShadow"><feGaussianBlur stdDeviation="6"/></filter><linearGradient id="iceEdge"><stop stop-color="#8cbfe0" stop-opacity=".15"/><stop offset=".4" stop-color="#9CC2E3" stop-opacity=".55"/><stop offset=".7" stop-color="#a9d4ef" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<path d="M238 ${b+149} C370 ${b+124} 420 ${b+19} 520 ${b+34} C639 ${b+41} 686 ${b+91} 783 ${b+87} S935 ${b+31} 1020 ${b+9}" stroke="#D2DAEB" stroke-width="8" stroke-opacity=".13" filter="url(#floatShadow)"/>
${threads}
<path d="M225 ${b+139} C332 ${b+118} 394 ${b+1} 518 ${b+19} C611 ${b+26} 661 ${b+65} 777 ${b+62}" stroke="url(#iceEdge)" stroke-width="1.6"/>
<path d="M231 ${b+96} C358 ${b+50} 409 ${b-40} 524 ${b-19} C628 ${b} 674 ${b+91} 777 ${b+63} S946 ${b-1} 1020 ${b-3}" stroke="#ffffff" stroke-opacity=".8" stroke-width=".8"/>
`,5);
return defs + layers.join('');
}

/** Decorative material follows the real panel; it never receives pointer events. */
export function SilkWorkspace() {
  const ref = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState({ markup: '', width: 1440, height: 1000 });
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const card = host.querySelector('.now-card')?.getBoundingClientRect();
        const scale = rect.width / 1216;
        if (!scale) return;
        const x = card ? (card.left - rect.left) / scale + 224 : 281.6;
        const y = card ? (card.top - rect.top) / scale : 114;
        const width = card ? card.width / scale : 1100.8;
        const height = card ? card.height / scale : 700;
        setSurface({ markup: fabricMarkup(x, y, width, height), width: 1216, height: rect.height / scale });
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(host);
    const card = host.querySelector('.now-card');
    if (card) observer.observe(card);
    update();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return <div ref={ref} className="silk-workspace" aria-hidden="true">
    <svg fill="none" width="100%" height="100%" viewBox={`224 0 ${surface.width} ${surface.height}`} preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: surface.markup }} />
  </div>;
}
