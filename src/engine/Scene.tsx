import { isAdvanced } from '../games/advanced/models';
import { Art3D } from './Scene3D';
import { memo, useEffect, useRef, useState } from 'react';
import { buildWorld, cssColor, type SceneData } from './geometry';
import { useStudio } from '../systems/StudioContext';

const vertexSource = `#version 300 es
in vec2 a_position;
in vec4 a_color;
out vec4 v_color;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); v_color = a_color; }`;
const fragmentSource = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 out_color;
void main() { out_color = v_color; }`;

export const WorldArt = memo(function WorldArt({ kind, className = '', data = {} }: { kind: string; className?: string; data?: SceneData }) {
  if (isAdvanced(kind)) return <div className={`world-art ${className}`}><Art3D kind={kind} /></div>;
  const p = buildWorld(kind, data);
  return <svg className={`world-art ${className}`} viewBox="0 0 800 380" aria-hidden="true" focusable="false">{p.shapes.map((s, i) => <polygon key={i} points={s.points.map(point => point.join(',')).join(' ')} fill={cssColor(s.color)} />)}</svg>;
});
export default function Scene({ kind, data = {}, label, paused = false }: { kind: string; data?: SceneData; label: string; paused?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef({ data, paused });
  const redraw = useRef<() => void>(() => {});
  const [fallback, setFallback] = useState(false);
  const { save } = useStudio();
  const reduced = save.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => { input.current = { data, paused }; redraw.current(); }, [data, paused]);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    let gl: WebGL2RenderingContext | null = null;
    try { gl = element.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' }); } catch { /* Use the vector fallback. */ }
    if (!gl) { setFallback(true); return; }
    const gpu = gl;
    const shaders: WebGLShader[] = [];
    function compile(type: number, source: string) { const shader = gpu.createShader(type); if (!shader) throw new Error('Unable to allocate shader'); shaders.push(shader); gpu.shaderSource(shader, source); gpu.compileShader(shader); if (!gpu.getShaderParameter(shader, gpu.COMPILE_STATUS)) throw new Error('Unable to compile WebGL scene'); return shader; }
    let program: WebGLProgram | null = null; let buffer: WebGLBuffer | null = null; let vao: WebGLVertexArrayObject | null = null;
    let frame = 0; let lastFrame = 0; let disposed = false; let phase = 0;
    try {
      program = gpu.createProgram(); if (!program) throw new Error('Unable to allocate program');
      gpu.attachShader(program, compile(gpu.VERTEX_SHADER, vertexSource)); gpu.attachShader(program, compile(gpu.FRAGMENT_SHADER, fragmentSource)); gpu.linkProgram(program);
      if (!gpu.getProgramParameter(program, gpu.LINK_STATUS)) throw new Error('Unable to link WebGL scene');
      gpu.useProgram(program); buffer = gpu.createBuffer(); vao = gpu.createVertexArray(); gpu.bindVertexArray(vao); gpu.bindBuffer(gpu.ARRAY_BUFFER, buffer);
      const position = gpu.getAttribLocation(program, 'a_position'); const tint = gpu.getAttribLocation(program, 'a_color');
      gpu.enableVertexAttribArray(position); gpu.vertexAttribPointer(position, 2, gpu.FLOAT, false, 24, 0); gpu.enableVertexAttribArray(tint); gpu.vertexAttribPointer(tint, 4, gpu.FLOAT, false, 24, 8);
      gpu.enable(gpu.BLEND); gpu.blendFunc(gpu.SRC_ALPHA, gpu.ONE_MINUS_SRC_ALPHA);
      function draw(time = performance.now()) {
        if (disposed || !program) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5); const width = Math.round(element!.clientWidth * ratio); const height = Math.round(width * 380 / 800);
        if (element!.width !== width || element!.height !== height) { element!.width = width; element!.height = height; }
        gpu.viewport(0, 0, width, height); gpu.clearColor(0.09, 0.11, 0.17, 1); gpu.clear(gpu.COLOR_BUFFER_BIT);
        if (!reduced && !input.current.paused && !document.hidden) phase = time / 1000;
        const vertices = buildWorld(kind, input.current.data, phase).vertices(); gpu.bindBuffer(gpu.ARRAY_BUFFER, buffer); gpu.bufferData(gpu.ARRAY_BUFFER, vertices, gpu.DYNAMIC_DRAW); gpu.drawArrays(gpu.TRIANGLES, 0, vertices.length / 6);
      }
      redraw.current = () => draw(); draw();
      function tick(time: number) { if (disposed) return; if (time - lastFrame >= 1000 / 30 && !document.hidden && !input.current.paused) { draw(time); lastFrame = time; } frame = requestAnimationFrame(tick); }
      if (!reduced) frame = requestAnimationFrame(tick);
    } catch (error) { console.warn('WebGL is unavailable; using vector graphics.', error); setFallback(true); }
    const onLost = (event: Event) => { event.preventDefault(); setFallback(true); };
    element.addEventListener('webglcontextlost', onLost);
    const resize = () => redraw.current(); window.addEventListener('resize', resize);
    return () => {
      disposed = true; cancelAnimationFrame(frame); redraw.current = () => {}; element.removeEventListener('webglcontextlost', onLost); window.removeEventListener('resize', resize);
      if (buffer) gpu.deleteBuffer(buffer); if (vao) gpu.deleteVertexArray(vao); if (program) gpu.deleteProgram(program); for (const shader of shaders) gpu.deleteShader(shader);
      if (!element.isConnected) gpu.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [kind, reduced]);
  return <div className="game-scene" role="img" aria-label={label}>
    {fallback ? <><WorldArt kind={kind} data={data} /><span className="renderer-note">Vector mode · all controls still work</span></> : <><canvas ref={canvas} aria-hidden="true" data-renderer="webgl2" /><span className="renderer-note">WebGL2 scene</span></>}
  </div>;
}
