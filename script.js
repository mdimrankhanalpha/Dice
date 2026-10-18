(() => {
'use strict';

/* ---------- secure randomness (Web Crypto only) ---------- */
const buf = new Uint32Array(1);
const rand32 = () => (crypto.getRandomValues(buf), buf[0]);
const rand01 = () => rand32() / 4294967296;

// Unbiased integer in [0, m) by rejection sampling.
const randBelow = (m) => {
  const limit = 4294967296 - (4294967296 % m);
  let x;
  do { x = rand32(); } while (x >= limit);
  return x % m;
};
const rollDie = () => randBelow(6) + 1;

/* ---------- quaternions [x, y, z, w] ---------- */
const qmul = (a, b) => [
  a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
  a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
  a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
  a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]
];
const qaxis = (x, y, z, a) => { const s = Math.sin(a / 2); return [x*s, y*s, z*s, Math.cos(a / 2)]; };
const qslerp = (a, b, t) => {
  let d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3], s = 1, k0, k1;
  if (d < 0) { d = -d; s = -1; }
  if (d > 0.9995) { k0 = 1 - t; k1 = t * s; }
  else {
    const th = Math.acos(d), sn = Math.sin(th);
    k0 = Math.sin((1 - t) * th) / sn;
    k1 = Math.sin(t * th) / sn * s;
  }
  const r = [k0*a[0] + k1*b[0], k0*a[1] + k1*b[1], k0*a[2] + k1*b[2], k0*a[3] + k1*b[3]];
  const l = Math.hypot(r[0], r[1], r[2], r[3]);
  return [r[0] / l, r[1] / l, r[2] / l, r[3] / l];
};
// Rotation matrix (row-major) of a quaternion.
const qmat = (q) => {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  return [
    1 - 2*(y*y + z*z), 2*(x*y - z*w),     2*(x*z + y*w),
    2*(x*y + z*w),     1 - 2*(x*x + z*z), 2*(y*z - x*w),
    2*(x*z - y*w),     2*(y*z + x*w),     1 - 2*(x*x + y*y)
  ];
};
const randAxis = () => {
  const z = 2 * rand01() - 1, a = 2 * Math.PI * rand01(), r = Math.sqrt(1 - z*z);
  return [r * Math.cos(a), r * Math.sin(a), z];
};

/* ---------- dice orientation ----------
   Local faces: +Y=1 -Y=6, +Z=2 -Z=5, +X=3 -X=4 (opposites sum to 7).
   BASE[n] rotates face n to point straight up (+Y). A yaw about Y keeps it flat. */
const H = Math.PI / 2;
const BASE = {
  1: [0, 0, 0, 1],
  6: [1, 0, 0, 0],
  3: qaxis(0, 0, 1, H),
  4: qaxis(0, 0, 1, -H),
  2: qaxis(1, 0, 0, -H),
  5: qaxis(1, 0, 0, H)
};
const finalQuat = (n) => {
  const yaw = (randBelow(4) * 90 + (rand01() * 70 - 35)) * Math.PI / 180;
  return qmul(qaxis(0, 1, 0, yaw), BASE[n]);
};

/* ---------- WebGL ---------- */
const canvas = document.getElementById('d');
const opts = { alpha: false, antialias: false, depth: false, stencil: false,
               powerPreference: 'low-power', preserveDrawingBuffer: false };
const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
if (!gl) return;

const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform mat3 uM;      // world -> dice-local rotation
uniform float uY;     // vertical offset of the dice

const float K  = 0.25;    // tan(half fov)
const float RR = 0.085;   // edge rounding radius
const float HB = 0.415;   // 0.5 - RR
const float RP = 0.10;    // pip sphere radius
const float PO = 0.035;   // pip sphere centre above the face
const float G  = 0.26;    // pip grid spacing

float smax(float a, float b, float k){
  float h = max(k - abs(a - b), 0.0);
  return max(a, b) + h * h * 0.25 / k;
}
float pip(vec2 f, vec2 c, float z){ return length(vec3(f - c, z)) - RP; }

// distance to the nearest pip sphere of the face under p
float pips(vec3 p){
  vec3 a = abs(p);
  float n; vec2 f;
  if (a.x > a.y && a.x > a.z) {
    if (p.x > 0.0) { n = 3.0; f = vec2(-p.z, p.y); } else { n = 4.0; f = vec2(p.z, p.y); }
  } else if (a.y > a.z) {
    if (p.y > 0.0) { n = 1.0; f = vec2(p.x, -p.z); } else { n = 6.0; f = vec2(p.x, p.z); }
  } else {
    if (p.z > 0.0) { n = 2.0; f = vec2(p.x, p.y); } else { n = 5.0; f = vec2(-p.x, p.y); }
  }
  float z = max(a.x, max(a.y, a.z)) - (0.5 + PO);
  float d = 1.0;
  if (n == 1.0 || n == 3.0 || n == 5.0) d = min(d, pip(f, vec2(0.0), z));
  if (n > 1.5) { d = min(d, pip(f, vec2(-G, -G), z)); d = min(d, pip(f, vec2(G, G), z)); }
  if (n > 3.5) { d = min(d, pip(f, vec2(-G, G), z));  d = min(d, pip(f, vec2(G, -G), z)); }
  if (n > 5.5) { d = min(d, pip(f, vec2(-G, 0.0), z)); d = min(d, pip(f, vec2(G, 0.0), z)); }
  return d;
}

float map(vec3 p){
  vec3 q = abs(p) - vec3(HB);
  float d = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - RR;
  if (d < 0.08) d = smax(d, -pips(p), 0.03);
  return d;
}

vec3 nrm(vec3 p){
  vec2 e = vec2(1.0, -1.0) * 0.0008;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
                   e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

vec3 env(vec3 r){
  float s = smoothstep(0.6, 0.9, dot(r, normalize(vec3(-0.5, 0.8, 0.5))));
  float t = 0.03 + 0.10 * smoothstep(-0.3, 1.0, r.y);
  return vec3(t + s * 1.2);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  vec3 camPos = vec3(0.0, 2.226, 3.562);
  vec3 fw = vec3(0.0, -0.53, -0.848);
  vec3 up = vec3(0.0, 0.848, -0.53);
  vec3 rdW = normalize(fw + (vec3(1.0, 0.0, 0.0) * uv.x + up * uv.y) * K);
  vec3 ro = uM * (camPos - vec3(0.0, uY, 0.0));
  vec3 rd = uM * rdW;

  float b = dot(ro, rd);
  float h = b * b - (dot(ro, ro) - 0.81);
  if (h < 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  h = sqrt(h);
  float t = max(-b - h, 0.0);
  float tmax = -b + h;

  float minR = 1000.0, tm = t;
  bool hit = false;
  for (int i = 0; i < 72; i++) {
    float d = map(ro + rd * t);
    float r = d / t;
    if (r < minR) { minR = r; tm = t; }
    if (d < 0.0005) { hit = true; break; }
    t += d * 0.9;
    if (t > tmax) break;
  }

  float px = 2.0 * K / uRes.y;
  float alpha = 1.0;
  if (hit) tm = t;
  else alpha = clamp(0.5 * (1.0 - minR / px), 0.0, 0.5);
  if (alpha <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  vec3 ps = ro + rd * tm;
  vec3 nL = nrm(ps);
  vec3 n = nL * uM;
  vec3 v = -rdW;

  float paint = 1.0 - smoothstep(0.002, 0.009, pips(ps));

  float occ = 0.0, sc = 1.0;
  for (int i = 1; i <= 4; i++) {
    float hh = 0.025 * float(i);
    occ += (hh - map(ps + nL * hh)) * sc;
    sc *= 0.6;
  }
  float ao = clamp(1.0 - 1.6 * occ, 0.0, 1.0);

  vec3 L1 = normalize(vec3(-0.5, 0.8, 0.45));
  vec3 L2 = normalize(vec3(0.8, 0.1, 0.5));
  float d1 = dot(n, L1);
  float k1 = max(d1, 0.0);
  float k2 = max(dot(n, L2), 0.0);
  float amb = mix(0.06, 0.17, n.y * 0.5 + 0.5);

  vec3 base = mix(vec3(0.80, 0.77, 0.68), vec3(0.025, 0.025, 0.03), paint);
  vec3 col = base * (amb + k1 * 0.95 + k2 * 0.30 * vec3(0.85, 0.95, 1.10)) * ao;

  float sp = pow(max(dot(n, normalize(L1 + v)), 0.0), 90.0) * 0.8 * step(0.0, d1);
  float fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  col += vec3(sp) + env(reflect(rdW, n)) * fr * ao;

  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(col * alpha, 1.0);
}`;

let ready = false, uRes, uM, uY;
const mat = new Float32Array(9);

const compile = (type, src) => {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
};

const init = () => {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(p, 0, 'a');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false;
  gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  uRes = gl.getUniformLocation(p, 'uRes');
  uM = gl.getUniformLocation(p, 'uM');
  uY = gl.getUniformLocation(p, 'uY');
  ready = true;
  return true;
};

/* ---------- state & rendering (only on demand) ---------- */
let q = finalQuat(rollDie());   // resting orientation (face chosen by the secure generator)
let hop = 0, px = 0;
let rolling = false, raf = 0;
let from, target, a1, a2, n1, n2, dur, t0, hiddenAt = 0;
const HOP = 0.08;

const draw = () => {
  if (!ready) return;
  // uniform = rotation world->local = transpose of local->world (row-major flatten of R)
  const r = qmat(q);
  for (let i = 0; i < 9; i++) mat[i] = r[i];
  gl.uniformMatrix3fv(uM, false, mat);
  gl.uniform1f(uY, hop);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
};

const step = (now) => {
  raf = 0;
  let u = (now - t0) / dur;
  if (u >= 1) { q = target; hop = 0; rolling = false; draw(); return; }
  if (u < 0) u = 0;
  const e = 1 - Math.pow(1 - u, 3);
  const r = (1 - e) * 2 * Math.PI;
  q = qmul(qmul(qaxis(a1[0], a1[1], a1[2], n1 * r), qaxis(a2[0], a2[1], a2[2], n2 * r)),
           qslerp(from, target, e));
  const s = Math.sin(Math.PI * u);
  hop = HOP * s * s;
  draw();
  raf = requestAnimationFrame(step);
};

const roll = () => {
  if (rolling || !ready) return;
  rolling = true;
  const n = rollDie();                 // 1) outcome first, from the secure generator
  target = finalQuat(n);               // 2) final orientation for exactly that face
  from = q;                            // 3) cosmetic tumble only; it cannot change the outcome
  a1 = randAxis(); a2 = randAxis();
  n1 = (1 + randBelow(2)) * (randBelow(2) ? 1 : -1);
  n2 = randBelow(2) * (randBelow(2) ? 1 : -1);
  dur = 1250 + randBelow(450);
  t0 = performance.now();
  raf = requestAnimationFrame(step);
};

/* ---------- sizing ---------- */
let side = 0;
const resize = (w, h) => {
  side = Math.max(1, Math.floor(Math.min(w, h)));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  px = Math.max(1, Math.min(Math.round(side * dpr), 900));
  canvas.style.width = canvas.style.height = side + 'px';
  if (canvas.width !== px) canvas.width = canvas.height = px;
  if (!ready) return;
  gl.viewport(0, 0, px, px);
  gl.uniform2f(uRes, px, px);
  draw();
};

if (!init()) return;

if (window.ResizeObserver) {
  new ResizeObserver((en) => {
    const c = en[0].contentRect;
    resize(c.width, c.height);
  }).observe(document.body);
} else {
  const f = () => resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', f);
  f();
}

/* ---------- input (no visible controls) ---------- */
canvas.addEventListener('pointerdown', (e) => {
  if (e.button) return;
  const r = canvas.getBoundingClientRect(), s = r.width;
  const dx = e.clientX - (r.left + s / 2), dy = e.clientY - (r.top + s / 2);
  if (dx * dx + dy * dy <= 0.2025 * s * s) { e.preventDefault(); roll(); }
});
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') && !e.repeat) {
    e.preventDefault();
    roll();
  }
});
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

/* ---------- visibility & context loss ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    hiddenAt = performance.now();
  } else if (rolling) {
    t0 += performance.now() - hiddenAt;
    if (!raf) raf = requestAnimationFrame(step);
  } else {
    draw();
  }
});
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  ready = false;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
});
canvas.addEventListener('webglcontextrestored', () => {
  if (!init()) return;
  gl.viewport(0, 0, px, px);
  gl.uniform2f(uRes, px, px);
  if (rolling) raf = requestAnimationFrame(step); else draw();
});
})();
