import * as THREE from "three";

// ── Pixy.js FX Manager ────────────────────────────────────────────────────────
// Adapts mebiusbox/pixy.js GLSL shaders into standalone Three.js ShaderMaterials.
// Source: https://github.com/mebiusbox/pixy.js
// Each factory returns { mesh, material, update(dt) } ready to add to any scene.

// ── Shared billboard vertex shader ────────────────────────────────────────────
const BILLBOARD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec2 vPosition;
void main() {
  vUv      = uv;
  vPosition = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// ── Common GLSL math helpers (pixy common.glsl + noise.glsl subset) ───────────
const COMMON_GLSL = /* glsl */ `
#define PI 3.14159265358979
#define pow2(x) ((x)*(x))

float rgb2gray(vec3 c) { return dot(c, vec3(0.299,0.587,0.114)); }

// Simplex 2D noise (IQ)
vec3 hash3(vec2 p){
  vec3 q=vec3(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)),dot(p,vec2(419.2,371.9)));
  return fract(sin(q)*43758.5453);
}
float snoise(vec3 p){
  vec3 a=floor(p),b=fract(p);
  b=b*b*(3.0-2.0*b);
  float n=a.x+a.y*57.0+113.0*a.z;
  return mix(mix(mix(fract(sin(n+0.0)*43758.5453),fract(sin(n+1.0)*43758.5453),b.x),
                 mix(fract(sin(n+57.0)*43758.5453),fract(sin(n+58.0)*43758.5453),b.x),b.y),
             mix(mix(fract(sin(n+113.0)*43758.5453),fract(sin(n+114.0)*43758.5453),b.x),
                 mix(fract(sin(n+170.0)*43758.5453),fract(sin(n+171.0)*43758.5453),b.x),b.y),b.z);
}

// Gradient noise 2D
float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float gnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),
             mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x),f.y);
}
float pnoise(vec2 p){ return gnoise(p); }

// FBM
float fbm(vec2 p){
  float v=0.0;
  v+=gnoise(p*1.0)*0.500; p*=2.01;
  v+=gnoise(p*1.0)*0.250; p*=2.02;
  v+=gnoise(p*1.0)*0.125; p*=2.03;
  v+=gnoise(p*1.0)*0.062;
  return v;
}
float fbm(vec3 p){
  float v=0.0;
  v+=snoise(p*1.0)*0.500; p*=2.01;
  v+=snoise(p*1.0)*0.250; p*=2.02;
  v+=snoise(p*1.0)*0.125; p*=2.03;
  v+=snoise(p*1.0)*0.062;
  return v;
}

// Prng
float prng(vec2 s){ return fract(sin(dot(s,vec2(127.1,311.7)))*43758.5453); }

// NoiseStack helpers (for bonfire)
float noiseStack(vec3 pos,int octaves,float falloff){
  float noise=snoise(pos),off=1.0;
  if(octaves>1){ off*=falloff; pos*=2.0; noise=(1.0-off)*noise+off*snoise(pos); }
  if(octaves>2){ pos*=2.0; off*=falloff; noise=(1.0-off)*noise+off*snoise(pos); }
  if(octaves>3){ pos*=2.0; off*=falloff; noise=(1.0-off)*noise+off*snoise(pos); }
  return (1.0+noise)/2.0;
}
vec2 noiseStackUV(vec3 pos,int octaves,float falloff,float diff){
  return vec2(noiseStack(pos,octaves,falloff),noiseStack(pos+vec3(3984.293,423.21,5235.19),octaves,falloff));
}
`;

// ── Effect 1: BONFIRE / CAMPFIRE ──────────────────────────────────────────────
const BONFIRE_FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform float time;
uniform float cSpeed;
uniform float cIntensity;
uniform float cStrength;
uniform float cDensity;
uniform float cSize;
uniform float cColor;
uniform vec2  resolution;
varying vec2 vUv;

void main() {
  vec2 uv    = vUv;
  vec2 coord = uv * resolution;

  // pin adaption
  float clip = resolution.y * 0.82;
  float ypartClip          = coord.y / clip;
  float ypartClippedFalloff= clamp(2.0 - ypartClip, 0.0, 1.0);
  float ypartClipped       = min(ypartClip, 1.0);
  float ypartClippedn      = 1.0 - ypartClipped;

  float xfuel    = 1.0 - abs(2.0 * uv.x - 1.0);
  float realTime = cSpeed * time;

  vec2 coordScaled = cDensity * 0.01 * coord.xy;
  vec3 position    = vec3(coordScaled, 0.0) + vec3(1223.0, 6443.0, 8425.0);
  vec3 flow        = vec3(4.1*(0.5-uv.x)*pow(ypartClippedn,4.0), -2.0*xfuel*pow(ypartClippedn,64.0), 0.0);
  vec3 timing      = realTime * vec3(0.0, -1.7*cStrength*10.0, 1.1) + flow;

  vec3 displacePos = vec3(1.0,0.5,1.0)*2.4*position + realTime*vec3(0.01,-0.7,1.3);
  vec3 displace3   = vec3(noiseStackUV(displacePos,2,0.4,0.1),0.0);
  vec3 noiseCoord  = vec3(2.0,1.0,1.0)*position + timing + 0.4*displace3;
  float noise      = noiseStack(noiseCoord,3,0.4);
  float flames     = pow(ypartClipped,0.3*xfuel)*pow(noise,0.3*xfuel);

  float f   = ypartClippedFalloff*pow(1.0-flames*flames*flames,8.0);
  float fff = f*f*f;
  vec3 fire = cIntensity * vec3(f, fff, fff*fff);

  // sparks
  float sparkGridSize = cSize * 10.0;
  vec2 sparkCoord     = coord.xy - vec2(0.0, 190.0*realTime);
  sparkCoord -= 30.0*noiseStackUV(0.01*vec3(sparkCoord,30.0*time),1,0.4,0.1);
  sparkCoord += 100.0*flow.xy;
  if(mod(sparkCoord.y/sparkGridSize,2.0)<1.0) sparkCoord.x+=0.5*sparkGridSize;
  vec2  sparkGridIndex = vec2(floor(sparkCoord/sparkGridSize));
  float sparkRandom    = prng(sparkGridIndex);
  float sparkLife      = min(10.0*(1.0-min((sparkGridIndex.y+(190.0*realTime/sparkGridSize))/(24.0-20.0*sparkRandom),1.0)),1.0);
  vec3 sparks = vec3(0.0);
  if(sparkLife>0.0){
    float sparkSize    = xfuel*xfuel*sparkRandom*0.08;
    float sparkRadians = 999.0*sparkRandom*2.0*PI+2.0*time;
    vec2  sparkCircular= vec2(sin(sparkRadians),cos(sparkRadians));
    vec2  sparkOffset  = (0.5-sparkSize)*sparkGridSize*sparkCircular;
    vec2  sparkModules = mod(sparkCoord+sparkOffset,sparkGridSize)-0.5*vec2(sparkGridSize);
    float sparkLength  = length(sparkModules);
    float sparksGray   = max(0.0,1.0-sparkLength/(sparkSize*sparkGridSize));
    sparks = sparkLife*sparksGray*vec3(1.0,0.3,0.0);
  }

  vec3 color = max(fire,sparks);
  float alpha = max(color.r, max(color.g, color.b));
  gl_FragColor = vec4(mix(vec3(rgb2gray(color)),color,cColor), alpha);
}`;

// ── Effect 2: CAUSTICS (ocean underwater light) ───────────────────────────────
const CAUSTICS_FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform float time;
uniform float cScale;
uniform float cSpeed;
uniform float cColor;
varying vec2 vUv;

void main() {
  vec2 coord = vUv;
  mat3 m = mat3(-2.0,-1.0,2.0, 3.0,-2.0,1.0, 1.0,2.0,2.0);
  vec3 a = vec3(coord / vec2(100.0*cScale), time/(max(4.5-cSpeed,0.001)))*m;
  vec3 b = a*m*0.4;
  vec3 c = b*m*0.3;
  float v = pow(min(min(length(0.5-fract(a)),length(0.5-fract(b))),length(0.5-fract(c))),7.0)*25.0;
  vec3 col = vec3(v);
  col += mix(vec3(0.0),vec3(0.0,0.35,0.5),cColor);
  gl_FragColor = vec4(col, clamp(v*1.5,0.0,0.6));
}`;

// ── Effect 3: MAGIC CIRCLE (spell / ability) ──────────────────────────────────
const MAGIC_CIRCLE_FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform float time;
uniform vec3  cTint;
varying vec2 vUv;

vec2 rot(vec2 p,float r){ mat2 m=mat2(cos(r),sin(r),-sin(r),cos(r)); return m*p; }

float circle(float pre,vec2 p,float r1,float r2,float power){
  float l=length(p);
  if(r1<l&&l<r2) pre=0.0;
  float d=min(abs(l-r1),abs(l-r2));
  return clamp(pre+power/d,0.0,1.0);
}
float rectangle(float pre,vec2 p,vec2 h1,vec2 h2,float power){
  p=abs(p);
  float dx1=(p.y<h1.y)?abs(h1.x-p.x):length(p-h1);
  float dx2=(p.y<h2.y)?abs(h1.x-p.x):length(p-h2);
  float dy1=(p.x<h1.x)?abs(h1.y-p.y):length(p-h1);
  float dy2=(p.x<h2.x)?abs(h1.y-p.y):length(p-h2);
  float d=min(min(dx1,dx2),min(dy1,dy2));
  return clamp(pre+power/d,0.0,1.0);
}
float radiation(float pre,vec2 p,float r1,float r2,int num,float power){
  float angle=2.0*PI/float(num),d=1e10;
  for(int i=0;i<64;i++){
    if(i>=num) break;
    float _d=(r1<p.y&&p.y<r2)?abs(p.x):min(length(p-vec2(0,r1)),length(p-vec2(0,r2)));
    d=min(d,_d); p=rot(p,angle);
  }
  return clamp(pre+power/d,0.0,1.0);
}
vec3 scene(vec2 p){
  float dest=0.0;
  p*=sin(PI*time/1.0)*0.02+1.1;
  vec2 q;
  // outer ring
  q=rot(p,time*PI/6.0);
  dest=circle(dest,q,0.85,0.9,0.006);
  dest=radiation(dest,q,0.87,0.88,36,0.0008);
  // outer rects
  q=rot(p,time*PI/6.0);
  { const int n=6; float angle=PI/float(n); q=rot(q,floor(atan(q.x,q.y)/angle+0.5)*angle);
    for(int i=0;i<n;i++){ dest=rectangle(dest,q,vec2(0.601),vec2(0.601),0.0015); q=rot(q,angle); } }
  // inner ring
  q=p; dest=circle(dest,q,0.5,0.55,0.002);
  // inner rects
  q=rot(p,-time*PI/6.0);
  { const int n=3; float angle=PI/float(n); q=rot(q,floor(atan(q.x,q.y)/angle+0.5)*angle);
    for(int i=0;i<n;i++){ dest=rectangle(dest,q,vec2(0.36),vec2(0.36),0.0015); q=rot(q,angle); } }
  // dots
  q=rot(p,time*PI/6.0); dest=radiation(dest,q,0.25,0.3,12,0.005);
  return pow(dest,2.5)*cTint;
}

void main(){
  vec2 p=(vUv*2.0-1.0);
  vec3 col=scene(p);
  float alpha=clamp(length(col)*2.0,0.0,1.0);
  gl_FragColor=vec4(col,alpha);
}`;

// ── Effect 4: FIRE (simple FBM fire, lighter weight than bonfire) ─────────────
const FIRE_FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform float time;
uniform float cIntensity;
uniform float cStrength;
uniform float cPower;
uniform float cRange;
uniform float cWidth;
uniform float cColor;
varying vec2 vUv;

void main(){
  vec2 q=vUv;
  q.y*=2.0-1.0*cPower;
  float T3=max(3.0,1.25*cStrength)*time;
  q.x=mod(q.x,1.0)-0.5;
  q.y-=0.25;
  float n=fbm(cStrength*q-vec2(0,T3));
  float c=2.0*cIntensity-16.0*pow(max(0.0,length(q*vec2(3.0-cWidth*3.0+q.y*1.5,0.75))-n*max(0.0,q.y+0.25)),1.2);
  float c1=n*c*(1.5-pow((2.50/cRange)*vUv.y,4.0));
  c1=clamp(c1,0.0,1.0);
  vec3 col=vec3(1.5*c1,1.5*c1*c1*c1,c1*c1*c1*c1*c1);
  float a=c*(1.0-pow(vUv.y,3.0));
  vec3 final=mix(vec3(0.0),col,a);
  float alpha=max(final.r,max(final.g,final.b));
  gl_FragColor=vec4(mix(vec3(rgb2gray(final)),final,cColor),alpha);
}`;

// ── Effect 5: LIGHTNING ───────────────────────────────────────────────────────
const LIGHTNING_FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform float time;
uniform float cIntensity;
uniform float cFrequency;
uniform float cWidth;
varying vec2 vUv;

void main(){
  vec2 uv=vUv*2.0-1.0;
  vec3 finalColor=vec3(0.0);
  for(int i=0;i<3;++i){
    float amp=80.0+float(i)*5.0;
    float period=0.4;
    float thickness=mix(0.9,1.0,gnoise(uv*10.0));
    float t=abs(cWidth/(sin(uv.x+fbm(uv*cFrequency+4.0*time*period))*amp)*thickness);
    finalColor+=t*vec3(0.4,0.6,1.0)*cIntensity;
  }
  float alpha=clamp(length(finalColor),0.0,1.0);
  gl_FragColor=vec4(finalColor,alpha);
}`;

// ── Effect 6: SPARK BURST ─────────────────────────────────────────────────────
const SPARK_FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform float time;
uniform float cIntensity;
uniform float cPowerExponent;
varying vec2 vUv;

void main(){
  vec2 pos=vUv*2.0-1.0;
  vec2 n=normalize(pos);
  float t=cIntensity*2.0/max(length(pos),0.001);
  float r=pnoise(n*8.0+time)*2.0;
  r=max(t-r,0.0);
  r=pow(r,cPowerExponent);
  vec3 col=vec3(r*1.2,r*0.8,r*0.2);
  gl_FragColor=vec4(col,clamp(r,0.0,1.0));
}`;

// ── Effect 7: EXPLOSION FLASH ─────────────────────────────────────────────────
const EXPLOSION_FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform float time;
uniform float cLife;   // 0→1 lifetime of explosion
uniform float cBloom;
varying vec2 vUv;

float map(vec3 p){
  float f=fbm(p*0.8+time*0.4);
  return length(p)-0.6-0.4*f;
}
bool raySphere(vec3 ro,vec3 rd,out float mn,out float mx){
  float b=dot(ro,rd),c=dot(ro,ro)-1.6;
  float disc=b*b-c;
  if(disc<0.0) return false;
  disc=sqrt(disc); mn=-b-disc; mx=-b+disc;
  return true;
}

void main(){
  vec2 uv=vUv*2.0-1.0;
  float fade=1.0-clamp(cLife,0.0,1.0);
  vec3 rd=normalize(vec3(uv,1.2));
  vec3 ro=vec3(0.0,0.0,-2.5+cLife*0.4);
  vec4 sum=vec4(0.0);
  float mn=0.0,mx=0.0;
  if(raySphere(ro,rd,mn,mx)){
    float t=mn;
    for(int i=0;i<32;i++){
      vec3 pos=ro+t*rd;
      if(t>mx||sum.a>0.95) break;
      float d=map(pos);
      d=max(abs(d)+0.05,0.02);
      float ld=0.08-d;
      float w=(1.0-sum.a)*max(ld,0.0);
      vec3 ldst=-pos; float lD=length(ldst);
      sum.rgb+=vec3(1.0,0.5,0.2)/exp(lD*lD*0.15)/(28.0-18.0*cBloom);
      sum.a=clamp(sum.a+w*0.8,0.0,1.0);
      t+=d*0.6;
    }
  }
  sum.rgb*=fade;
  sum.a*=fade;
  gl_FragColor=vec4(sum.rgb,sum.a);
}`;

// ── Effect 8: WATER CIRCLE WAVE ───────────────────────────────────────────────
const WATERWAVE_FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform float time;
uniform float cAmplitude;
uniform float cLambda;
uniform float cPeriod;
uniform vec3  cColor;
varying vec2 vUv;

void main(){
  vec2 pos=vUv*2.0-1.0;
  float r=length(pos);
  float phase=2.0*PI*(time/max(cPeriod,0.001)-r/max(cLambda,0.001));
  float wave=0.0;
  if(phase>=0.0) wave=(cAmplitude*sin(phase))/max(sqrt(r),0.001);
  float v=clamp(wave*4.0,0.0,1.0);
  gl_FragColor=vec4(cColor*v,v*0.7);
}`;

// ── Manager interface ─────────────────────────────────────────────────────────
export interface PixyEffect {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  update(dt: number): void;
  dispose(): void;
}

function makeEffect(
  frag: string,
  uniforms: Record<string, THREE.IUniform>,
  size = 1.0,
): PixyEffect {
  const mat = new THREE.ShaderMaterial({
    vertexShader:   BILLBOARD_VERT,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const geo  = new THREE.PlaneGeometry(size, size);
  const mesh = new THREE.Mesh(geo, mat);

  let elapsed = 0;
  return {
    mesh,
    material: mat,
    update(dt: number) {
      elapsed += dt;
      mat.uniforms.time.value = elapsed;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

// ── Public factory functions ──────────────────────────────────────────────────

export interface BonfireOptions {
  size?: number;
  speed?: number;
  intensity?: number;
  strength?: number;
  density?: number;
  sparkSize?: number;
  colorMix?: number;
  resolution?: [number, number];
}
export function createBonfire(opts: BonfireOptions = {}): PixyEffect {
  const s = opts.size ?? 1;
  const res = opts.resolution ?? [256, 256];
  return makeEffect(BONFIRE_FRAG, {
    time:       { value: 0 },
    cSpeed:     { value: opts.speed      ?? 0.6 },
    cIntensity: { value: opts.intensity  ?? 2.5 },
    cStrength:  { value: opts.strength   ?? 0.6 },
    cDensity:   { value: opts.density    ?? 1.5 },
    cSize:      { value: opts.sparkSize  ?? 2.0 },
    cColor:     { value: opts.colorMix   ?? 1.0 },
    resolution: { value: new THREE.Vector2(res[0], res[1]) },
  }, s);
}

export interface CausticsOptions {
  size?: number;
  scale?: number;
  speed?: number;
  colorBlend?: number;
}
export function createCaustics(opts: CausticsOptions = {}): PixyEffect {
  return makeEffect(CAUSTICS_FRAG, {
    time:   { value: 0 },
    cScale: { value: opts.scale      ?? 0.012 },
    cSpeed: { value: opts.speed      ?? 1.2 },
    cColor: { value: opts.colorBlend ?? 0.8 },
  }, opts.size ?? 2);
}

export interface MagicCircleOptions {
  size?: number;
  tint?: THREE.Color;
}
export function createMagicCircle(opts: MagicCircleOptions = {}): PixyEffect {
  return makeEffect(MAGIC_CIRCLE_FRAG, {
    time:  { value: 0 },
    cTint: { value: opts.tint ?? new THREE.Color(0.4, 0.7, 1.0) },
  }, opts.size ?? 2);
}

export interface FireOptions {
  size?: number;
  intensity?: number;
  strength?: number;
  power?: number;
  range?: number;
  width?: number;
  colorMix?: number;
}
export function createFire(opts: FireOptions = {}): PixyEffect {
  return makeEffect(FIRE_FRAG, {
    time:       { value: 0 },
    cIntensity: { value: opts.intensity ?? 1.8 },
    cStrength:  { value: opts.strength  ?? 2.0 },
    cPower:     { value: opts.power     ?? 0.5 },
    cRange:     { value: opts.range     ?? 1.2 },
    cWidth:     { value: opts.width     ?? 1.0 },
    cColor:     { value: opts.colorMix  ?? 1.0 },
  }, opts.size ?? 1);
}

export interface LightningOptions {
  size?: number;
  intensity?: number;
  frequency?: number;
  width?: number;
}
export function createLightning(opts: LightningOptions = {}): PixyEffect {
  return makeEffect(LIGHTNING_FRAG, {
    time:        { value: 0 },
    cIntensity:  { value: opts.intensity  ?? 1.2 },
    cFrequency:  { value: opts.frequency  ?? 3.5 },
    cWidth:      { value: opts.width      ?? 0.06 },
  }, opts.size ?? 2);
}

export interface SparkOptions {
  size?: number;
  intensity?: number;
  powerExponent?: number;
}
export function createSpark(opts: SparkOptions = {}): PixyEffect {
  return makeEffect(SPARK_FRAG, {
    time:          { value: 0 },
    cIntensity:    { value: opts.intensity     ?? 0.25 },
    cPowerExponent:{ value: opts.powerExponent ?? 3.0 },
  }, opts.size ?? 1);
}

export interface ExplosionOptions {
  size?: number;
  bloom?: number;
}
export function createExplosion(opts: ExplosionOptions = {}): PixyEffect {
  const fx = makeEffect(EXPLOSION_FRAG, {
    time:  { value: 0 },
    cLife: { value: 0 },
    cBloom:{ value: opts.bloom ?? 0.5 },
  }, opts.size ?? 2);
  return fx;
}

export interface WaterWaveOptions {
  size?: number;
  amplitude?: number;
  lambda?: number;
  period?: number;
  color?: THREE.Color;
}
export function createWaterWave(opts: WaterWaveOptions = {}): PixyEffect {
  return makeEffect(WATERWAVE_FRAG, {
    time:       { value: 0 },
    cAmplitude: { value: opts.amplitude ?? 0.05 },
    cLambda:    { value: opts.lambda    ?? 0.5 },
    cPeriod:    { value: opts.period    ?? 0.3 },
    cColor:     { value: opts.color     ?? new THREE.Color(0.3, 0.7, 1.0) },
  }, opts.size ?? 2);
}

// ── One-shot explosion helper (auto-removes from scene after lifetime) ─────────
export function spawnExplosion(
  scene: THREE.Scene,
  position: THREE.Vector3,
  size = 3,
  duration = 1.2,
  bloom = 0.5,
): (dt: number) => void {
  const fx = createExplosion({ size, bloom });
  fx.mesh.position.copy(position);
  scene.add(fx.mesh);

  let life = 0;
  const tick = (dt: number) => {
    life += dt;
    fx.update(dt);
    fx.material.uniforms.cLife.value = life / duration;
    if (life >= duration) {
      scene.remove(fx.mesh);
      fx.dispose();
    }
  };
  return tick;
}

// ── One-shot water ripple (auto-removes after fade) ───────────────────────────
export function spawnWaterRipple(
  scene: THREE.Scene,
  position: THREE.Vector3,
  size = 4,
  duration = 1.5,
): (dt: number) => void {
  const fx = createWaterWave({ size });
  fx.mesh.position.copy(position);
  fx.mesh.rotation.x = -Math.PI / 2;
  scene.add(fx.mesh);

  let life = 0;
  const tick = (dt: number) => {
    life += dt;
    fx.update(dt);
    fx.material.opacity = Math.max(0, 1 - life / duration);
    if (life >= duration) {
      scene.remove(fx.mesh);
      fx.dispose();
    }
  };
  return tick;
}

// ── Catalogue for showcase ────────────────────────────────────────────────────
export const PIXY_EFFECTS_CATALOGUE = [
  { id: 'bonfire',      label: 'Bonfire',       desc: 'Campfire with embers & sparks',         create: () => createBonfire() },
  { id: 'fire',        label: 'Fire',           desc: 'FBM turbulent fire column',             create: () => createFire() },
  { id: 'caustics',    label: 'Caustics',       desc: 'Ocean underwater light patterns',       create: () => createCaustics() },
  { id: 'magicCircle', label: 'Magic Circle',   desc: 'Rotating runic spell circle',           create: () => createMagicCircle() },
  { id: 'lightning',   label: 'Lightning',      desc: 'Electric arc / storm bolt',             create: () => createLightning() },
  { id: 'spark',       label: 'Spark Burst',    desc: 'Impact spark / forge sparks',           create: () => createSpark() },
  { id: 'explosion',   label: 'Explosion',      desc: 'Volumetric combat explosion',           create: () => createExplosion() },
  { id: 'waterwave',   label: 'Water Wave',     desc: 'Circular water ripple on hit',          create: () => createWaterWave() },
] as const;
