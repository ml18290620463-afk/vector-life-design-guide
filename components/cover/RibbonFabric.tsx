import { useEffect, useRef } from 'react';

export const fabricMotion = {
  period: 6.4,
  amplitude: 9,
  tipLift: 14,
  breathPeriod: 9.2,
  columns: 72,
  rows: 40,
  pixelRatio: 2,
};
const W = 1672,
  H = 941;

// One spatial field carries the fabric and its internal connections together.
function displaced(x: number, y: number, time: number) {
  const progress = Math.max(0, Math.min(1, x / W));
  const phase =
    (time * Math.PI * 2) / fabricMotion.period - progress * Math.PI * 2.4 + (y / H - 0.6) * 1.2;
  const freedom = 0.22 + 0.78 * progress;
  const wave = Math.sin(phase) * fabricMotion.amplitude * freedom;
  const curl = Math.sin(phase + 0.85) * 3.4 * freedom;
  const loop = Math.exp(-(((x - 940) / 240) ** 2 + ((y - 580) / 190) ** 2));
  const breath = Math.sin((time * Math.PI * 2) / fabricMotion.breathPeriod) * 0.012 * loop;
  const tip = Math.max(0, (progress - 0.65) / 0.35) ** 2;
  const lift = (0.5 - 0.5 * Math.cos((time * Math.PI * 2) / 8)) * fabricMotion.tipLift * tip;
  return [
    x + curl + (x - 940) * breath + tip * lift * 0.2,
    y - wave - lift + (y - 580) * breath,
    Math.cos(phase) * freedom,
  ];
}

export function RibbonFabric() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const art = canvas.parentElement!;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) return;
    gl.disable(gl.DITHER);
    const shader = (type: number, source: string) => {
      const result = gl.createShader(type)!;
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
        gl.deleteShader(result);
        throw new Error('Ribbon shader');
      }
      return result;
    };
    let program: WebGLProgram | null = null;
    let vertex: WebGLShader | null = null,
      fragment: WebGLShader | null = null;
    try {
      vertex = shader(
        gl.VERTEX_SHADER,
        'attribute vec2 position; attribute vec2 uv; attribute float light; varying vec2 tex; varying float shade; void main(){tex=uv; shade=light; gl_Position=vec4(position.x/836.0-1.0,1.0-position.y/470.5,0.,1.);}',
      );
      fragment = shader(
        gl.FRAGMENT_SHADER,
        'precision mediump float; uniform sampler2D image; varying vec2 tex; varying float shade; void main(){vec4 c=texture2D(image,tex); c.rgb*=1.0+shade*.035; gl_FragColor=vec4(c.rgb,c.a);}',
      );
      program = gl.createProgram()!;
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Ribbon program');
    } catch {
      if (program) gl.deleteProgram(program);
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      return;
    }
    gl.useProgram(program);
    const { columns, rows } = fabricMotion;
    const vertices = new Float32Array((columns + 1) * (rows + 1) * 5);
    const indices: number[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < columns; x++) {
        const i = y * (columns + 1) + x;
        indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
      }
    const buffer = gl.createBuffer(),
      indexBuffer = gl.createBuffer(),
      texture = gl.createTexture();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [name, size, offset] of [
      ['position', 2, 0],
      ['uv', 2, 8],
      ['light', 1, 16],
    ] as const) {
      const loc = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 20, offset);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const paths = Array.from(art.querySelectorAll<SVGPathElement>('.ribbon-current path')).map(
      (path) => {
        const original = path.getAttribute('d')!;
        const length = path.getTotalLength();
        return {
          path,
          original,
          points: Array.from({ length: 181 }, (_, i) => path.getPointAtLength((length * i) / 180)),
        };
      },
    );
    let frame = 0,
      elapsed = 0,
      last = 0,
      loaded = false,
      visible = true,
      disposed = false;
    const draw = () => {
      const time = media.matches ? 0 : elapsed;
      let n = 0;
      for (let y = 0; y <= rows; y++)
        for (let x = 0; x <= columns; x++) {
          const u = x / columns,
            v = y / rows;
          const [px, py, light] = displaced(u * W, v * H, time);
          vertices[n++] = media.matches ? u * W : px;
          vertices[n++] = media.matches ? v * H : py;
          vertices[n++] = u;
          vertices[n++] = v;
          vertices[n++] = media.matches ? 0 : light;
        }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      paths.forEach(({ path, original, points }) =>
        path.setAttribute(
          'd',
          media.matches
            ? original
            : points
                .map((p, i) => {
                  const [x, y] = displaced(p.x, p.y, time);
                  return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
                })
                .join(''),
        ),
      );
    };
    const tick = (now: number) => {
      if (last) elapsed += Math.min((now - last) / 1000, 0.04);
      last = now;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (!loaded || disposed) return;
      if (!document.hidden && visible && !media.matches) frame = requestAnimationFrame(tick);
      else if (media.matches) draw();
    };
    const resize = () => {
      const rect = art.getBoundingClientRect(),
        ratio = Math.min(devicePixelRatio || 1, fabricMotion.pixelRatio);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (loaded) draw();
    };
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(art);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(art);
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      // Premultiply before filtering so transparent texels cannot bleed into edges.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      loaded = true;
      resize();
      art.dataset.fabricReady = 'true';
      sync();
    };
    image.src = '/assets/vector-home/ribbon-clear.png';
    const lost = (event: Event) => {
      event.preventDefault();
      loaded = false;
      cancelAnimationFrame(frame);
      delete art.dataset.fabricReady;
      paths.forEach(({ path, original }) => path.setAttribute('d', original));
    };
    canvas.addEventListener('webglcontextlost', lost);
    document.addEventListener('visibilitychange', sync);
    media.addEventListener('change', sync);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      image.onload = null;
      observer.disconnect();
      sizeObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      media.removeEventListener('change', sync);
      canvas.removeEventListener('webglcontextlost', lost);
      delete art.dataset.fabricReady;
      paths.forEach(({ path, original }) => path.setAttribute('d', original));
      gl.deleteBuffer(buffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);
  return <canvas ref={ref} className="ribbon-fabric" aria-hidden="true" />;
}
