export type Vec3 = [number,number,number];
export interface Mesh { vertices:number[]; color:string }
const colors:Record<string,string>={math:'#98caff',geometry:'#d6b0ff',calculus:'#ffaece',physics:'#ffe096',engine:'#ffb17e',robot:'#97eed8',vm:'#a4b5ff',trail:'#b7dc95',water:'#8fe1ff',kitchen:'#ffd49e',creator:'#dfaeff'};
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export class MeshBuilder {
  meshes:Mesh[]=[];
  triangle(a:Vec3,b:Vec3,c:Vec3,color:string) { const u=b.map((v,i)=>v-a[i]);const v=c.map((n,i)=>n-a[i]); const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const l=Math.hypot(...n)||1; const normal=n.map(x=>x/l); this.meshes.push({vertices:[...a,...normal,...b,...normal,...c,...normal],color}); }
  quad(a:Vec3,b:Vec3,c:Vec3,d:Vec3,color:string){this.triangle(a,b,c,color);this.triangle(a,c,d,color);}
  box(x:number,y:number,z:number,w:number,h:number,d:number,color:string){
    const a:Vec3=[x-w/2,y,z-d/2],b:Vec3=[x+w/2,y,z-d/2],c:Vec3=[x+w/2,y+h,z-d/2],e:Vec3=[x-w/2,y+h,z-d/2],f:Vec3=[x-w/2,y,z+d/2],g:Vec3=[x+w/2,y,z+d/2],i:Vec3=[x+w/2,y+h,z+d/2],j:Vec3=[x-w/2,y+h,z+d/2];
    this.quad(a,e,c,b,color);this.quad(f,g,i,j,color);this.quad(e,j,i,c,color);this.quad(a,b,g,f,color);this.quad(b,c,i,g,color);this.quad(a,f,j,e,color);
  }
  cylinder(x:number,y:number,z:number,r:number,h:number,color:string,n=20){for(let k=0;k<n;k++){const a=k/n*Math.PI*2,b=(k+1)/n*Math.PI*2;const p:Vec3=[x+Math.cos(a)*r,y,z+Math.sin(a)*r],q:Vec3=[x+Math.cos(b)*r,y,z+Math.sin(b)*r],pt:Vec3=[p[0],y+h,p[2]],qt:Vec3=[q[0],y+h,q[2]];this.quad(p,pt,qt,q,color);this.triangle([x,y+h,z],qt,pt,color);}}
  orb(x:number,y:number,z:number,r:number,color:string){const top:Vec3=[x,y+r,z],bottom:Vec3=[x,y-r,z];const ring:Vec3[]=[[x+r,y,z],[x,y,z+r],[x-r,y,z],[x,y,z-r]];for(let i=0;i<4;i++){this.triangle(top,ring[i],ring[(i+1)%4],color);this.triangle(bottom,ring[(i+1)%4],ring[i],color);}}
}
export function build3D(kind:string,data:Record<string,number>={},time=0):Mesh[] {
  const p=new MeshBuilder(),c=colors[kind]||'#a6d9ef';
  p.box(0,-0.5,0,9,0.35,7,'#233447');p.box(0,-0.17,0,8.6,0.12,6.6,'#304359');
  for(let i=-4;i<=4;i++)p.box(i,-0.03,0,0.018,0.018,6.3,'#4e677b');for(let i=-3;i<=3;i++)p.box(0,-0.03,i,8.3,0.018,0.018,'#4e677b');
  const pillar=(x:number,z:number,h=1.6)=>{p.box(x,0,z,0.65,h,0.65,'#465c73');p.box(x,h,z,0.72,0.08,0.72,c);};
  if(['math','geometry','calculus','physics'].includes(kind)){
    p.box(0,0,-2.2,6,3.5,0.15,'#1c2940');p.box(0,0.2,-2.07,0.024,3.1,0.03,'#a3bad4');p.box(0,1.3,-2.06,5.8,0.025,0.03,'#a3bad4');
    for(let i=0;i<24;i++){const x=-2.8+i*5.6/23;const y=kind==='calculus'?0.5+(x+1)**2*0.2:kind==='physics'?0.5+Math.max(0,2.4-(x/1.8)**2):1.5+Math.sin(x*1.2)*0.8;p.orb(x,y,-1.98,0.055,c);}
    if(kind==='geometry'){p.box(-1.7,0,0.5,1.5,1.7,1.5,c);p.cylinder(1,0,0.4,0.7,1.9,'#91ddd7');p.orb(2.5,1.2,1.2,0.9,'#ffda94');}
    else {pillar(-2.7,1,0.7);pillar(2.7,1,0.7);const phase=(time*0.4)%1;const x=-2.6+phase*5.2;const y=kind==='physics'?0.6+4*phase*(1-phase)*2:0.6;p.orb(x,y,0.8,0.28,c);for(let i=0;i<8;i++)p.box(-2.4+i*0.65,0,2,0.48,0.3+i*0.11,0.6,c);}
  }else if(kind==='engine'){
    p.box(0,0,0,3,0.5,2.2,'#637585');const moving=data.rpm?Math.sin(time*5):0;
    for(let i=0;i<(data.cylinders||4);i++){const x=-1.1+(i%4)*0.72;const z=Math.floor(i/4)*0.8;p.cylinder(x,0.5,z,0.27,1.35,'#45566d');p.cylinder(x,0.95+moving*0.22,z,0.22,0.2,c);p.box(x,0.7,z,0.06,0.7+moving*0.2,0.06,'#bdd2df');}
    p.cylinder(2.1,0,0,0.85,0.35,'#32485b');for(let i=0;i<8;i++){const angle=i/8*Math.PI*2+time*(data.rpm?2:0);p.orb(2.1+Math.cos(angle)*0.65,0.42,Math.sin(angle)*0.65,0.11,c);}for(let i=0;i<4;i++)p.box(-2.6,0.4+i*0.3,0,0.7,0.07,1.4,'#a5c1c7');
  }else if(kind==='robot'){
    for(const [x,z]of [[2,1],[2,2],[2,3],[4,4],[1,4]])p.box(x-3,0,z-3,0.8,0.8,0.8,'#59637b');
    p.box(3,0,2,0.85,0.08,0.85,'#d8ec8c');const x=(data.x||0)-3,z=(data.y||0)-3;p.box(x,0.2,z,0.7,0.38,0.75,c);p.box(x,0.58,z,0.4,0.24,0.4,'#d6e7ef');p.orb(x+0.14,0.74,z+0.2,0.06,'#1b3241');p.orb(x-0.14,0.74,z+0.2,0.06,'#1b3241');for(const dx of[-0.4,0.4])for(const dz of[-0.25,0.25])p.box(x+dx,0.08,z+dz,0.16,0.28,0.21,'#172832');
  }else if(kind==='vm'){
    p.box(-1,0,0,3.5,0.15,3.4,'#397665');p.box(-1,0.15,0,1.3,0.28,1.3,c);for(let i=0;i<(data.ram||8);i++){const x=0.2+i%4*0.55,z=-1+Math.floor(i/4)*0.7;p.box(x,0.15,z,0.4,0.3,0.55,i===(data.pc||0)%16?'#caff66':'#8994bc');}p.box(2.7,0,-0.5,1.2,1.7,1,'#293b54');for(let i=0;i<5;i++)p.box(2.7,0.2+i*0.28,0.03,0.95,0.07,0.06,i<(data.cycles||0)%6?c:'#536577');
  }else if(kind==='trail'){
    p.box(0,0,0,8,0.02,1.1,'#192e3c');for(let i=-3;i<=3;i++)p.box(i,0.05,0,0.45,0.02,0.04,'#e5d5aa');for(let i=0;i<5;i++){const x=-3+i*1.5;p.box(x,0,-2.2,1,0.8+i%3*0.5,0.9,'#667f8a');p.box(x,0.2,-1.72,0.25,0.35,0.04,c);p.cylinder(x,0,2,0.12,0.8,'#93795e');p.orb(x,1.2,2,0.65,'#829f71');}p.box(-3+(data.step||0)*1.1,0.1,0,0.85,0.35,0.5,c);
  }else if(kind==='water'){
    for(let i=0;i<3;i++){const x=-2.2+i*2.1;p.cylinder(x,0,0,0.75,2.3,'#4b657a');p.cylinder(x,0.04,0,0.69,clampHeight((data.stored||40)/100*2.2),'#56bad6');p.box(x,2.3,0,1.5,0.12,1.5,c);if(i<2)p.box(x+1,0.55,0,1,0.16,0.16,'#cad5d9');}p.box(0,0,2.3,2,0.55,0.5,'#425f70');
  }else if(kind==='kitchen'){
    p.box(0,0,-1.3,6,1.1,1.3,'#5c697d');p.box(0,1.1,-1.3,6.2,0.12,1.5,'#e0d3ba');p.cylinder(-1,1.22,-1.2,0.7,0.5,'#8899a2');p.cylinder(-1,1.73,-1.2,0.6,0.04,c);for(let i=0;i<6;i++)p.orb(-1+Math.sin(i)*0.45,1.79,-1.2+Math.cos(i)*0.4,0.1,'#b5d88c');for(let i=0;i<4;i++)p.orb(-1+Math.sin(time+i)*0.3,1.9+(time*0.3+i*0.22)%1,-1.2,0.05,'#c2d4df');p.box(2,0,1,1.3,2.4,1.1,'#c3d1d3');p.box(2,1.35,1.58,1.1,0.045,0.04,'#4e7189');
  }else if(kind==='creator'){
    p.box(0,0,-1.8,5,2.7,0.2,'#6f5897');p.box(0,0.3,-1.66,4.6,2.1,0.04,c);p.cylinder(0,0,0,0.9,0.13,'#aab5d2');p.box(-2.4,0.6,1,0.7,0.7,0.5,'#273a50');p.box(-2.4,0,1,0.08,0.6,0.08,'#b9cdd6');p.box(-2.4,0,1,1.1,0.05,0.7,'#596f87');for(const x of[-2.5,2.5]){p.box(x,0,-1,0.08,2.7,0.08,'#bbc5d8');p.orb(x,2.75,-1,0.42,'#ffe7ae');}p.box(1.8,0,1.8,1.5,0.6,0.8,'#445a72');for(let i=0;i<5;i++)p.box(1.25+i*0.25,0.62,1.8,0.08,0.1+((data.peak||0)+i)%4*0.03,0.5,c);
  }
  return p.meshes;
}
const clampHeight=(v:number)=>Math.max(0.06,Math.min(2.2,v));
export function vertexData(meshes:Mesh[]){const out:number[]=[];for(const mesh of meshes){const color=rgb(mesh.color);for(let i=0;i<mesh.vertices.length;i+=6)out.push(...mesh.vertices.slice(i,i+6),...color);}return new Float32Array(out);}
export function cameraMatrix(angle:number,zoom:number,aspect:number){
  const eye:Vec3=[Math.sin(angle)*zoom,zoom*0.62,Math.cos(angle)*zoom];const target:Vec3=[0,0.8,0];const norm=(v:number[])=>{const l=Math.hypot(...v);return v.map(x=>x/l);};const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);const dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0);const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];const f=1/Math.tan(Math.PI/7),near=0.1,far=80;const proj=[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];const matrix=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)matrix[c*4+r]+=proj[k*4+r]*view[c*4+k];return {matrix:new Float32Array(matrix),eye};
}
export function projectMesh(mesh:Mesh,angle=0.65){const {matrix}=cameraMatrix(angle,12,1.78);const points=[];for(let i=0;i<mesh.vertices.length;i+=6){const v=[...mesh.vertices.slice(i,i+3),1],p=[0,0,0,0];for(let r=0;r<4;r++)for(let k=0;k<4;k++)p[r]+=matrix[k*4+r]*v[k];points.push([360+p[0]/p[3]*360,200-p[1]/p[3]*200]);}return points.map(p=>p.map(x=>x.toFixed(1)).join(',')).join(' ');}
