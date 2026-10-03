import { cameraMatrix } from './world3d';
const vertex = `#version 300 es
layout(location=0) in vec3 position; layout(location=1) in vec3 normal; layout(location=2) in vec3 color;
uniform mat4 camera; uniform mat4 lightCamera;
out vec3 world; out vec3 n; out vec3 c; out vec4 shadowPosition;
void main(){world=position;n=normal;c=color;shadowPosition=lightCamera*vec4(position,1.0);gl_Position=camera*vec4(position,1.0);}`;
const fragment = `#version 300 es
precision highp float;
in vec3 world; in vec3 n; in vec3 c; in vec4 shadowPosition;
uniform vec3 eye; uniform vec3 lightEye; uniform sampler2D shadowMap; uniform bool shadows;
out vec4 outColor;
float visibility(){
 if(!shadows)return 1.0;
 vec3 p=shadowPosition.xyz/shadowPosition.w*0.5+0.5;
 if(p.z>1.0||p.z<0.0||p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0)return 1.0;
 float value=0.0;vec2 texel=vec2(1.0/512.0);
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)value+=p.z-0.004<=texture(shadowMap,p.xy+vec2(x,y)*texel).r?1.0:0.0;
 return 0.35+value/9.0*0.65;
}
void main(){
 vec3 normal=normalize(n),light=normalize(lightEye-world),view=normalize(eye-world);
 float diffuse=max(dot(normal,light),0.0),spec=pow(max(dot(normal,normalize(light+view)),0.0),42.0);
 float rim=pow(1.0-max(dot(view,normal),0.0),3.0);
 vec3 linear=pow(c,vec3(2.2))*(0.25+diffuse*visibility()*1.3)+vec3(0.035,0.09,0.14)*rim+vec3(0.16)*spec*visibility();
 float glow=step(0.7,c.g)*step(0.72,c.b);linear+=pow(c,vec3(2.2))*glow*0.12;
 float fog=clamp((length(eye-world)-9.0)/32.0,0.0,0.28);linear=mix(linear,vec3(0.012,0.025,0.045),fog);
 vec3 mapped=linear/(linear+vec3(0.7));outColor=vec4(pow(mapped,vec3(1.0/2.2)),1.0);
}`;
const depthVertex = `#version 300 es
layout(location=0) in vec3 position;uniform mat4 camera;void main(){gl_Position=camera*vec4(position,1.0);}`;
const depthFragment = `#version 300 es
precision highp float;void main(){}`;
export function createRenderer(gl: WebGL2RenderingContext) {
  const shaders: WebGLShader[] = [], programs: WebGLProgram[] = [];
  let buffer: WebGLBuffer | null = null, depth: WebGLTexture | null = null, framebuffer: WebGLFramebuffer | null = null;
  const dispose = () => { if (buffer) gl.deleteBuffer(buffer); if (depth) gl.deleteTexture(depth); if (framebuffer) gl.deleteFramebuffer(framebuffer); programs.forEach(p => gl.deleteProgram(p)); shaders.forEach(s => gl.deleteShader(s)); };
  const program = (v: string, f: string) => {
    const p = gl.createProgram(); if (!p) throw new Error('No graphics program.'); programs.push(p);
    for (const [type, source] of [[gl.VERTEX_SHADER, v], [gl.FRAGMENT_SHADER, f]] as const) {
      const shader = gl.createShader(type); if (!shader) throw new Error('No graphics shader.'); shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Graphics shader unavailable.'); gl.attachShader(p, shader);
    }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Graphics program unavailable.'); return p;
  };
  try {
    const main = program(vertex, fragment), shadow = program(depthVertex, depthFragment);
    buffer = gl.createBuffer(); if (!buffer) throw new Error('No graphics buffer.');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [index, offset] of [[0, 0], [1, 12], [2, 24]]) { gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, 3, gl.FLOAT, false, 36, offset); }
    depth = gl.createTexture(); framebuffer = gl.createFramebuffer();
    if (depth && framebuffer) {
      gl.bindTexture(gl.TEXTURE_2D, depth); gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, 512, 512, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.deleteFramebuffer(framebuffer); framebuffer = null; }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.enable(gl.DEPTH_TEST);
    const light = cameraMatrix(-0.6, 15, 1), uniformCamera = gl.getUniformLocation(main, 'camera'), eye = gl.getUniformLocation(main, 'eye');
    const lightCamera = gl.getUniformLocation(main, 'lightCamera'), lightEye = gl.getUniformLocation(main, 'lightEye'), enabled = gl.getUniformLocation(main, 'shadows'), sampler = gl.getUniformLocation(main, 'shadowMap'), depthCamera = gl.getUniformLocation(shadow, 'camera');
    return {
      dispose,
      draw(vertices: Float32Array, width: number, height: number, angle: number, zoom: number) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        if (framebuffer) { gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); gl.viewport(0, 0, 512, 512); gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(shadow); gl.uniformMatrix4fv(depthCamera, false, light.matrix); gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 9); }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, width, height); gl.clearColor(0.04, 0.07, 0.115, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(main);
        const view = cameraMatrix(angle, zoom, width / height);
        gl.uniformMatrix4fv(uniformCamera, false, view.matrix); gl.uniformMatrix4fv(lightCamera, false, light.matrix); gl.uniform3fv(eye, new Float32Array(view.eye)); gl.uniform3fv(lightEye, new Float32Array(light.eye)); gl.uniform1i(enabled, Number(!!framebuffer));
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, depth); gl.uniform1i(sampler, 0); gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 9);
      },
    };
  } catch { dispose(); return null; }
}
