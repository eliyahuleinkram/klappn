var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name3 in all)
    __defProp(target, name3, { get: all[name3], enumerable: true });
};

// engine/golden/gm-zones.src.mjs
import * as nwaa from "../../render-service/node_modules/node-web-audio-api/index.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";

// node_modules/@strudel/core/dist/index.mjs
var dist_exports = {};
__export(dist_exports, {
  ClockCollator: () => _n,
  Cyclist: () => hf,
  FXr: () => uf,
  FXrel: () => cf,
  FXrelease: () => of,
  Fraction: () => m,
  Hap: () => S,
  Pattern: () => f,
  State: () => ut,
  TimeSpan: () => B,
  __chooseWith: () => Me,
  _brandBy: () => Oe,
  _fitslice: () => Fn,
  _irand: () => ze,
  _keyDown: () => je,
  _match: () => In,
  _mod: () => bt,
  _morph: () => de,
  _polymeterListSteps: () => Hn,
  _retime: () => Yt,
  _slices: () => Zt,
  accelerate: () => Ys,
  activeLabel: () => va,
  ad: () => Bp,
  add: () => $h,
  adsr: () => xp,
  almostAlways: () => Jw,
  almostNever: () => jw,
  always: () => Nw,
  amp: () => sr,
  analyze: () => gc,
  anchor: () => Ua,
  and: () => nd,
  apply: () => Pd,
  applyN: () => Wn,
  ar: () => zp,
  arp: () => wh,
  arpWith: () => yh,
  arrange: () => kh,
  as: () => Kp,
  asym: () => py,
  att: () => or,
  attack: () => rr,
  averageArray: () => nn,
  backgroundImage: () => Hw,
  band: () => Ih,
  bandf: () => Cc,
  bandq: () => Oc,
  bank: () => yc,
  base64ToUnicode: () => gn,
  bbexpr: () => ti,
  bbst: () => ni,
  beat: () => oy,
  begin: () => Mc,
  berlin: () => qw,
  bgain: () => ja,
  binary: () => iw,
  binaryL: () => uw,
  binaryN: () => Jf,
  binaryNL: () => $f,
  bind: () => xh,
  binshift: () => Zl,
  bite: () => Ld,
  bjork: () => _y,
  bjorklund: () => ge,
  blshift: () => Dh,
  bmod: () => sf,
  bor: () => Vh,
  bp: () => Bc,
  bpa: () => ji,
  bpattack: () => Ei,
  bpd: () => Wi,
  bpdc: () => yu,
  bpdecay: () => Ri,
  bpdepth: () => fu,
  bpdepthfreq: () => du,
  bpdepthfrequency: () => hu,
  bpe: () => Bi,
  bpenv: () => xi,
  bpf: () => xc,
  bpq: () => zc,
  bpr: () => Zi,
  bprate: () => lu,
  bprelease: () => Yi,
  bps: () => Gi,
  bpshape: () => mu,
  bpskew: () => wu,
  bpsustain: () => Di,
  bpsync: () => pu,
  brak: () => Ud,
  brand: () => mw,
  brandBy: () => dw,
  brshift: () => Gh,
  bus: () => Pa,
  busgain: () => Ea,
  bxor: () => Hh,
  bypass: () => Tm,
  byteBeatExpression: () => Zc,
  byteBeatStartTime: () => ei,
  calculateSteps: () => dh,
  cat: () => mt,
  ccn: () => $p,
  ccv: () => Np,
  ceil: () => id,
  ch: () => ri,
  channel: () => gi,
  channels: () => si,
  chebyshev: () => dy,
  choose: () => Rf,
  chooseCycles: () => Wf,
  chooseIn: () => ww,
  chooseInWith: () => Pe,
  chooseOut: () => gw,
  chooseWith: () => It,
  chop: () => Xm,
  chord: () => Da,
  chorus: () => wc,
  chunk: () => mm,
  chunkBack: () => gm,
  chunkBackInto: () => Am,
  chunkInto: () => qm,
  chunkback: () => bm,
  chunkbackinto: () => Sm,
  chunkinto: () => km,
  clamp: () => an,
  cleanupUi: () => Dw,
  clip: () => pp,
  coarse: () => Rc,
  code2hash: () => ph,
  color: () => Ap,
  colour: () => Tp,
  comb: () => Xl,
  compose: () => oh,
  compress: () => dd,
  compressSpan: () => md,
  compressor: () => bl,
  compressorAttack: () => kl,
  compressorKnee: () => _l,
  compressorRatio: () => vl,
  compressorRelease: () => ql,
  compressspan: () => yd,
  constant: () => ch,
  contract: () => Kn,
  control: () => Jp,
  controls: () => gy,
  cosine: () => Qy,
  cosine2: () => Uy,
  cpm: () => Ed,
  cps: () => lp,
  createClock: () => ff,
  createParam: () => Nt,
  createParams: () => Cp,
  crush: () => Lc,
  ctf: () => vi,
  ctlNum: () => Lp,
  ctranspose: () => Aa,
  cubic: () => ay,
  curry: () => w,
  curve: () => yp,
  cut: () => bi,
  cutoff: () => _i,
  cycleToSeconds: () => Kt,
  cyclesPer: () => Ww,
  dec: () => vc,
  decay: () => _c,
  degrade: () => Tw,
  degradeBy: () => Aw,
  degradeByWith: () => Sw,
  degree: () => qa,
  delay: () => Ru,
  delayfb: () => Fu,
  delayfeedback: () => Wu,
  delayspeed: () => Vu,
  delaysync: () => Qu,
  delayt: () => Du,
  delaytime: () => Hu,
  deltaSlide: () => wp,
  det: () => Ku,
  detune: () => Xu,
  dfb: () => Iu,
  dict: () => Qa,
  dictionary: () => Ga,
  diode: () => ly,
  dist: () => yl,
  distort: () => ml,
  distorttype: () => gl,
  distortvol: () => wl,
  div: () => Rh,
  djf: () => Lu,
  drawLine: () => Cn,
  drive: () => Qc,
  drop: () => Qn,
  dry: () => ta,
  ds: () => Op,
  dt: () => Gu,
  duck: () => Uc,
  duckattack: () => Yc,
  duckdepth: () => Xc,
  duckonset: () => Kc,
  dur: () => dp,
  duration: () => hp,
  early: () => jd,
  echo: () => im,
  echoWith: () => sm,
  echowith: () => rm,
  eish: () => Ty,
  end: () => Pc,
  enhance: () => Ul,
  env: () => nf,
  eq: () => Yh,
  eqt: () => Zh,
  errorLogger: () => zt,
  euclid: () => by,
  euclidLegato: () => qy,
  euclidLegatoRot: () => Sy,
  euclidRot: () => ky,
  euclidish: () => Ay,
  euclidrot: () => vy,
  evalScope: () => xn,
  evaluate: () => On,
  every: () => Md,
  expand: () => Xn,
  expression: () => Ol,
  extend: () => Un,
  fadeInTime: () => sa,
  fadeOutTime: () => na,
  fadeTime: () => ea,
  fanchor: () => eu,
  fast: () => qd,
  fastChunk: () => vm,
  fastGap: () => wd,
  fastcat: () => N,
  fastchunk: () => _m,
  fastgap: () => gd,
  fft: () => bc,
  filter: () => zm,
  filterWhen: () => Mm,
  firstOf: () => zd,
  fit: () => ey,
  flatten: () => G,
  floor: () => cd,
  fm: () => Sr,
  fm1: () => Ar,
  fm2: () => Tr,
  fm3: () => Cr,
  fm4: () => xr,
  fm5: () => Br,
  fm6: () => Or,
  fm7: () => zr,
  fm8: () => Mr,
  fmatt: () => Kr,
  fmatt1: () => Yr,
  fmatt2: () => Zr,
  fmatt3: () => to,
  fmatt4: () => eo,
  fmatt5: () => no,
  fmatt6: () => so,
  fmatt7: () => ro,
  fmatt8: () => oo,
  fmattack: () => Fr,
  fmattack1: () => Ir,
  fmattack2: () => Vr,
  fmattack3: () => Hr,
  fmattack4: () => Dr,
  fmattack5: () => Gr,
  fmattack6: () => Qr,
  fmattack7: () => Ur,
  fmattack8: () => Xr,
  fmdec: () => Ao,
  fmdec1: () => To,
  fmdec2: () => Co,
  fmdec3: () => xo,
  fmdec4: () => Bo,
  fmdec5: () => Oo,
  fmdec6: () => zo,
  fmdec7: () => Mo,
  fmdec8: () => Po,
  fmdecay: () => yo,
  fmdecay1: () => wo,
  fmdecay2: () => go,
  fmdecay3: () => bo,
  fmdecay4: () => _o,
  fmdecay5: () => vo,
  fmdecay6: () => ko,
  fmdecay7: () => qo,
  fmdecay8: () => So,
  fmenv: () => Pr,
  fmenv1: () => Er,
  fmenv2: () => jr,
  fmenv3: () => Jr,
  fmenv4: () => $r,
  fmenv5: () => Nr,
  fmenv6: () => Lr,
  fmenv7: () => Rr,
  fmenv8: () => Wr,
  fmh: () => cr,
  fmh1: () => ir,
  fmh2: () => ur,
  fmh3: () => ar,
  fmh4: () => lr,
  fmh5: () => pr,
  fmh6: () => fr,
  fmh7: () => hr,
  fmh8: () => dr,
  fmi: () => mr,
  fmi1: () => yr,
  fmi2: () => wr,
  fmi3: () => gr,
  fmi4: () => br,
  fmi5: () => _r,
  fmi6: () => vr,
  fmi7: () => kr,
  fmi8: () => qr,
  fmrel: () => ic,
  fmrel1: () => uc,
  fmrel2: () => ac,
  fmrel3: () => lc,
  fmrel4: () => pc,
  fmrel5: () => fc,
  fmrel6: () => hc,
  fmrel7: () => dc,
  fmrel8: () => mc,
  fmrelease: () => Yo,
  fmrelease1: () => Zo,
  fmrelease2: () => tc,
  fmrelease3: () => ec,
  fmrelease4: () => nc,
  fmrelease5: () => sc,
  fmrelease6: () => rc,
  fmrelease7: () => oc,
  fmrelease8: () => cc,
  fmsus: () => Io,
  fmsus1: () => Vo,
  fmsus2: () => Ho,
  fmsus3: () => Do,
  fmsus4: () => Go,
  fmsus5: () => Qo,
  fmsus6: () => Uo,
  fmsus7: () => Xo,
  fmsus8: () => Ko,
  fmsustain: () => Eo,
  fmsustain1: () => jo,
  fmsustain2: () => Jo,
  fmsustain3: () => $o,
  fmsustain4: () => No,
  fmsustain5: () => Lo,
  fmsustain6: () => Ro,
  fmsustain7: () => Wo,
  fmsustain8: () => Fo,
  fmwave: () => co,
  fmwave1: () => io,
  fmwave2: () => uo,
  fmwave3: () => ao,
  fmwave4: () => lo,
  fmwave5: () => po,
  fmwave6: () => fo,
  fmwave7: () => ho,
  fmwave8: () => mo,
  focus: () => bd,
  focusSpan: () => _d,
  focusspan: () => vd,
  fold: () => fy,
  fractionalArgs: () => ih,
  frameRate: () => np,
  frames: () => sp,
  freeze: () => Vl,
  freq: () => ra,
  freqToMidi: () => Ze,
  fromBipolar: () => ad,
  fshift: () => Ml,
  fshiftnote: () => Pl,
  fshiftphase: () => El,
  ftype: () => tu,
  func: () => rd,
  fxr: () => af,
  gain: () => er,
  gap: () => pt,
  gat: () => wa,
  gate: () => ya,
  getAccidentalsOffset: () => Ye,
  getControlName: () => yt,
  getCps: () => Fy,
  getCurrentKeyboardState: () => qn,
  getEventOffsetMs: () => th,
  getFreq: () => tn,
  getFrequency: () => rh,
  getIsStarted: () => Hy,
  getPattern: () => Iy,
  getPerformanceTimeSeconds: () => hh,
  getPlayableNoteValue: () => sh,
  getRandsAtTime: () => K,
  getSoundIndex: () => nh,
  getTime: () => Wy,
  getTrigger: () => Sf,
  getTriggerFunc: () => Vy,
  grow: () => jm,
  gt: () => Uh,
  gte: () => Kh,
  hard: () => uy,
  harmonic: () => Ta,
  hash2code: () => fh,
  hbrick: () => tp,
  hcutoff: () => Mu,
  hold: () => Tc,
  hours: () => rp,
  hp: () => Eu,
  hpa: () => Pi,
  hpattack: () => Mi,
  hpd: () => Li,
  hpdc: () => Su,
  hpdecay: () => Ni,
  hpdepth: () => _u,
  hpdepthfreq: () => ku,
  hpdepthfrequency: () => vu,
  hpe: () => Ci,
  hpenv: () => Ti,
  hpf: () => Pu,
  hpq: () => Ju,
  hpr: () => Ki,
  hprate: () => gu,
  hprelease: () => Xi,
  hps: () => Hi,
  hpshape: () => qu,
  hpskew: () => Au,
  hpsustain: () => Vi,
  hpsync: () => bu,
  hresonance: () => ju,
  hsl: () => Om,
  hsla: () => Bm,
  hurry: () => Ad,
  id: () => ot,
  imag: () => Ql,
  inhabit: () => Jy,
  inhabitmod: () => Ny,
  innerBind: () => Bh,
  inside: () => xd,
  inv: () => Dd,
  invert: () => Hd,
  ir: () => cl,
  irand: () => yw,
  irbegin: () => al,
  iresponse: () => il,
  irspeed: () => ul,
  isControlName: () => is,
  isNote: () => Mt,
  isNoteWithOctave: () => Yf,
  isPattern: () => pe,
  isaw: () => Rt,
  isaw2: () => Ae,
  iter: () => pm,
  iterBack: () => fm,
  iterback: () => hm,
  itri: () => Zy,
  itri2: () => tw,
  jux: () => nm,
  juxBy: () => tm,
  juxby: () => em,
  kcutoff: () => $l,
  keep: () => jh,
  keepif: () => Jh,
  keyAlias: () => kn,
  keyDown: () => Rw,
  krush: () => Jl,
  label: () => ka,
  lastOf: () => Od,
  late: () => Ln,
  lbrick: () => ep,
  legato: () => fp,
  leslie: () => ga,
  lfo: () => ef,
  linger: () => Rd,
  listRange: () => _t,
  lock: () => Uu,
  logKey: () => oe,
  logger: () => E,
  loop: () => Ec,
  loopAt: () => Zm,
  loopAtCps: () => ny,
  loopBegin: () => jc,
  loopEnd: () => $c,
  loopat: () => ty,
  loopatcps: () => sy,
  loopb: () => Jc,
  loope: () => Nc,
  lp: () => qi,
  lpa: () => zi,
  lpattack: () => Oi,
  lpd: () => $i,
  lpdc: () => uu,
  lpdecay: () => Ji,
  lpdepth: () => ru,
  lpdepthfreq: () => cu,
  lpdepthfrequency: () => ou,
  lpe: () => Ai,
  lpenv: () => Si,
  lpf: () => ki,
  lpq: () => Nu,
  lpr: () => Ui,
  lprate: () => nu,
  lprelease: () => Qi,
  lps: () => Ii,
  lpshape: () => iu,
  lpskew: () => au,
  lpsustain: () => Fi,
  lpsync: () => su,
  lrate: () => ba,
  lsize: () => _a,
  lt: () => Qh,
  lte: () => Xh,
  mapArgs: () => ie,
  mask: () => Sh,
  midi2note: () => eh,
  midiToFreq: () => it,
  midibend: () => Dp,
  midichan: () => Mp,
  midicmd: () => jp,
  midimap: () => Pp,
  midiport: () => Ep,
  miditouch: () => Gp,
  minutes: () => op,
  mod: () => Wh,
  mode: () => Ya,
  morph: () => cy,
  mouseX: () => ow,
  mouseY: () => sw,
  mousex: () => rw,
  mousey: () => nw,
  mtranspose: () => Sa,
  mul: () => Lh,
  n: () => Xs,
  nanFallback: () => sn,
  ne: () => td,
  net: () => ed,
  never: () => $w,
  noise: () => Bu,
  note: () => Ks,
  noteToMidi: () => gt,
  nothing: () => R,
  nrpnn: () => Rp,
  nrpv: () => Wp,
  nudge: () => Ba,
  numeralArgs: () => L,
  objectMap: () => bn,
  oct: () => za,
  octave: () => Oa,
  octaveR: () => xa,
  octaves: () => Ka,
  octer: () => Nl,
  octersub: () => Ll,
  octersubsub: () => Rl,
  off: () => Qd,
  offset: () => Xa,
  often: () => Pw,
  or: () => sd,
  orbit: () => Ma,
  oschost: () => Up,
  oscport: () => Xp,
  outerBind: () => Oh,
  outside: () => Bd,
  overgain: () => Ja,
  overshape: () => $a,
  pace: () => Vn,
  pairs: () => un,
  palindrome: () => Zd,
  pan: () => Na,
  panchor: () => ma,
  panorient: () => Fa,
  panspan: () => La,
  pansplay: () => Ra,
  panwidth: () => Wa,
  parray: () => me,
  parseFractional: () => cn,
  parseNumeral: () => ce,
  partials: () => my,
  patt: () => ca,
  pattack: () => oa,
  pcurve: () => da,
  pdec: () => ua,
  pdecay: () => ia,
  penv: () => ha,
  per: () => Df,
  perCycle: () => Fw,
  perlin: () => kw,
  perx: () => Iw,
  ph: () => ai,
  phasdp: () => wi,
  phaser: () => li,
  phasercenter: () => hi,
  phaserdepth: () => mi,
  phaserrate: () => ui,
  phasersweep: () => pi,
  phases: () => yy,
  phc: () => di,
  phd: () => yi,
  phs: () => fi,
  pick: () => yf,
  pickF: () => xy,
  pickOut: () => Oy,
  pickReset: () => Ey,
  pickRestart: () => My,
  pickSqueeze: () => $y,
  pickmod: () => gf,
  pickmodF: () => By,
  pickmodOut: () => zy,
  pickmodReset: () => jy,
  pickmodRestart: () => Py,
  pickmodSqueeze: () => Ly,
  pipe: () => on,
  pitchJump: () => gp,
  pitchJumpTime: () => bp,
  ply: () => kd,
  plyForEach: () => lm,
  plyWith: () => am,
  pm: () => _h,
  polyBind: () => Ph,
  polyTouch: () => Qp,
  polymeter: () => $t,
  polyrhythm: () => gh,
  postgain: () => nr,
  pow: () => Fh,
  pr: () => bh,
  prel: () => fa,
  prelease: () => pa,
  press: () => Yd,
  pressBy: () => Kd,
  progNum: () => Fp,
  psus: () => la,
  psustain: () => aa,
  pure: () => C,
  pw: () => oi,
  pwrate: () => ci,
  pwsweep: () => ii,
  rand: () => W,
  rand2: () => hw,
  randL: () => aw,
  randcat: () => bw,
  randrun: () => Nf,
  range: () => ld,
  range2: () => fd,
  rangex: () => pd,
  rarely: () => Ew,
  ratio: () => hd,
  rdim: () => sl,
  real: () => Gl,
  ref: () => ry,
  register: () => l,
  registerControl: () => c,
  registerMultiControl: () => V,
  reify: () => d,
  rel: () => Ac,
  release: () => Sc,
  removeUndefineds: () => lt,
  repeatCycles: () => dm,
  repl: () => Dy,
  replicate: () => Em,
  reset_state: () => df,
  reset_timelines: () => mf,
  resonance: () => $u,
  rev: () => Rn,
  revv: () => Xd,
  rfade: () => ol,
  rib: () => xm,
  ribbon: () => Cm,
  ring: () => Wl,
  ringdf: () => Il,
  ringf: () => Fl,
  rlp: () => el,
  room: () => Za,
  roomdim: () => nl,
  roomfade: () => rl,
  roomlp: () => tl,
  roomsize: () => ll,
  rotate: () => rn,
  round: () => od,
  rsize: () => hl,
  run: () => jf,
  s: () => us,
  s_add: () => Fm,
  s_alt: () => Nm,
  s_cat: () => $m,
  s_contract: () => Dm,
  s_expand: () => Vm,
  s_extend: () => Hm,
  s_polymeter: () => Lm,
  s_sub: () => Im,
  s_taper: () => Rm,
  s_taperlist: () => Wm,
  s_tour: () => Gm,
  s_zip: () => Qm,
  saw: () => qt,
  saw2: () => Se,
  scram: () => Yl,
  scramble: () => pw,
  scrub: () => Yp,
  seconds: () => cp,
  seed: () => fw,
  seg: () => Fd,
  segment: () => Wd,
  semitone: () => Va,
  seq: () => Nn,
  seqPLoop: () => qh,
  sequence: () => Q,
  sequenceP: () => En,
  set: () => Eh,
  setCpsFunc: () => _f,
  setIsStarted: () => qf,
  setPattern: () => vf,
  setStringParser: () => mh,
  setTime: () => ee,
  setTriggerFunc: () => kf,
  shape: () => dl,
  shrink: () => Zn,
  shrinklist: () => Yn,
  shuffle: () => lw,
  signal: () => j,
  silence: () => q,
  sine: () => Af,
  sine2: () => Te,
  sinefold: () => hy,
  size: () => pl,
  slice: () => ss,
  slide: () => Ia,
  slow: () => Td,
  slowChunk: () => wm,
  slowcat: () => Z,
  slowcatPrime: () => fe,
  slowchunk: () => ym,
  smear: () => Kl,
  soft: () => iy,
  sol2note: () => uh,
  someCycles: () => Mw,
  someCyclesBy: () => zw,
  sometimes: () => Ow,
  sometimesBy: () => Bw,
  songPtr: () => ip,
  sound: () => as,
  source: () => Qs,
  sparsity: () => Cd,
  speak: () => Vw,
  speed: () => ye,
  splice: () => Ym,
  splitAt: () => ue,
  spread: () => Zu,
  square: () => Tf,
  square2: () => Xy,
  squeeze: () => Ry,
  squeezeBind: () => zh,
  squiz: () => Tl,
  src: () => Us,
  stack: () => z,
  stackBy: () => vh,
  stackCentre: () => $n,
  stackLeft: () => jn,
  stackRight: () => Jn,
  steady: () => Gy,
  stepBind: () => Mh,
  stepalt: () => Dn,
  stepcat: () => $,
  steps: () => Um,
  stepsPerOctave: () => Ca,
  stretch: () => Sl,
  striate: () => Km,
  stringifyValues: () => ae,
  struct: () => Ah,
  strudelScope: () => le,
  stut: () => um,
  stutWith: () => om,
  stutwith: () => cm,
  sub: () => Nh,
  superimpose: () => Th,
  sus: () => qc,
  sustain: () => kc,
  sustainpedal: () => zl,
  swing: () => Vd,
  swingBy: () => Id,
  sysex: () => Ip,
  sysexdata: () => Hp,
  sysexid: () => Vp,
  sz: () => fl,
  take: () => Gn,
  time: () => ew,
  timeCat: () => ns,
  timecat: () => Jm,
  timeline: () => Cy,
  toBipolar: () => ud,
  tokenizeNote: () => Ue,
  tour: () => ts,
  transient: () => rf,
  trem: () => Fc,
  tremolo: () => Wc,
  tremolodepth: () => Vc,
  tremolophase: () => Dc,
  tremoloshape: () => Gc,
  tremoloskew: () => Hc,
  tremolosync: () => Ic,
  tri: () => Ky,
  tri2: () => Yy,
  triode: () => jl,
  tsdelay: () => Dl,
  uid: () => up,
  undegrade: () => xw,
  undegradeBy: () => Cw,
  unicodeToBase64: () => wn,
  uniq: () => ah,
  uniqsort: () => lh,
  uniqsortr: () => yn,
  unison: () => Yu,
  unit: () => Al,
  useRNG: () => cw,
  v: () => xu,
  val: () => ap,
  valueToMidi: () => Zf,
  vel: () => tr,
  velocity: () => Zs,
  vib: () => Tu,
  vibmod: () => Ou,
  vibrato: () => Cu,
  vmod: () => zu,
  voice: () => Ha,
  vowel: () => Cl,
  warp: () => Cs,
  warpatt: () => Os,
  warpattack: () => Bs,
  warpdc: () => Rs,
  warpdec: () => Ms,
  warpdecay: () => zs,
  warpdepth: () => Ns,
  warpenv: () => Ds,
  warpmode: () => Fs,
  warprate: () => $s,
  warprel: () => Js,
  warprelease: () => js,
  warpshape: () => Ls,
  warpskew: () => Ws,
  warpsus: () => Es,
  warpsustain: () => Ps,
  warpsync: () => Gs,
  waveloss: () => xl,
  wavetablePhaseRand: () => Hs,
  wavetablePosition: () => ps,
  wavetableWarp: () => xs,
  wavetableWarpMode: () => Is,
  wchoose: () => _w,
  wchooseCycles: () => If,
  when: () => Gd,
  whenKey: () => Lw,
  withSeed: () => Lf,
  withValue: () => Ch,
  within: () => Pm,
  worklet: () => wy,
  wrandcat: () => vw,
  wt: () => ls,
  wtatt: () => ds,
  wtattack: () => hs,
  wtdc: () => As,
  wtdec: () => ys,
  wtdecay: () => ms,
  wtdepth: () => qs,
  wtenv: () => fs,
  wtphaserand: () => Vs,
  wtrate: () => vs,
  wtrel: () => _s,
  wtrelease: () => bs,
  wtshape: () => Ss,
  wtskew: () => Ts,
  wtsus: () => gs,
  wtsustain: () => ws,
  wtsync: () => ks,
  xfade: () => rs,
  xsdelay: () => Hl,
  zcrush: () => kp,
  zdelay: () => qp,
  zip: () => es,
  zipWith: () => Pt,
  zmod: () => vp,
  znoise: () => _p,
  zoom: () => Jd,
  zoomArc: () => $d,
  zoomarc: () => Nd,
  zrand: () => mp,
  zzfx: () => Sp
});

// node_modules/fraction.js/dist/fraction.mjs
if (typeof BigInt === "undefined") BigInt = function(n2) {
  if (isNaN(n2)) throw new Error("");
  return n2;
};
var C_ZERO = BigInt(0);
var C_ONE = BigInt(1);
var C_TWO = BigInt(2);
var C_THREE = BigInt(3);
var C_FIVE = BigInt(5);
var C_TEN = BigInt(10);
var MAX_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
var MAX_CYCLE_LEN = 2e3;
var P = {
  "s": C_ONE,
  "n": C_ZERO,
  "d": C_ONE
};
function assign(n2, s) {
  try {
    n2 = BigInt(n2);
  } catch (e) {
    throw InvalidParameter();
  }
  return n2 * s;
}
function ifloor(x) {
  return typeof x === "bigint" ? x : Math.floor(x);
}
function newFraction(n2, d2) {
  if (d2 === C_ZERO) {
    throw DivisionByZero();
  }
  const f2 = Object.create(Fraction.prototype);
  f2["s"] = n2 < C_ZERO ? -C_ONE : C_ONE;
  n2 = n2 < C_ZERO ? -n2 : n2;
  const a = gcd(n2, d2);
  f2["n"] = n2 / a;
  f2["d"] = d2 / a;
  return f2;
}
var FACTORSTEPS = [C_TWO * C_TWO, C_TWO, C_TWO * C_TWO, C_TWO, C_TWO * C_TWO, C_TWO * C_THREE, C_TWO, C_TWO * C_THREE];
function factorize(n2) {
  const factors = /* @__PURE__ */ Object.create(null);
  if (n2 <= C_ONE) {
    factors[n2] = C_ONE;
    return factors;
  }
  const add = (p) => {
    factors[p] = (factors[p] || C_ZERO) + C_ONE;
  };
  while (n2 % C_TWO === C_ZERO) {
    add(C_TWO);
    n2 /= C_TWO;
  }
  while (n2 % C_THREE === C_ZERO) {
    add(C_THREE);
    n2 /= C_THREE;
  }
  while (n2 % C_FIVE === C_ZERO) {
    add(C_FIVE);
    n2 /= C_FIVE;
  }
  for (let si2 = 0, p = C_TWO + C_FIVE; p * p <= n2; ) {
    while (n2 % p === C_ZERO) {
      add(p);
      n2 /= p;
    }
    p += FACTORSTEPS[si2];
    si2 = si2 + 1 & 7;
  }
  if (n2 > C_ONE) add(n2);
  return factors;
}
var parse = function(p1, p2) {
  let n2 = C_ZERO, d2 = C_ONE, s = C_ONE;
  if (p1 === void 0 || p1 === null) {
  } else if (p2 !== void 0) {
    if (typeof p1 === "bigint") {
      n2 = p1;
    } else if (isNaN(p1)) {
      throw InvalidParameter();
    } else if (p1 % 1 !== 0) {
      throw NonIntegerParameter();
    } else {
      n2 = BigInt(p1);
    }
    if (typeof p2 === "bigint") {
      d2 = p2;
    } else if (isNaN(p2)) {
      throw InvalidParameter();
    } else if (p2 % 1 !== 0) {
      throw NonIntegerParameter();
    } else {
      d2 = BigInt(p2);
    }
    s = n2 * d2;
  } else if (typeof p1 === "object") {
    if ("d" in p1 && "n" in p1) {
      n2 = BigInt(p1["n"]);
      d2 = BigInt(p1["d"]);
      if ("s" in p1)
        n2 *= BigInt(p1["s"]);
    } else if (0 in p1) {
      n2 = BigInt(p1[0]);
      if (1 in p1)
        d2 = BigInt(p1[1]);
    } else if (typeof p1 === "bigint") {
      n2 = p1;
    } else {
      throw InvalidParameter();
    }
    s = n2 * d2;
  } else if (typeof p1 === "number") {
    if (isNaN(p1)) {
      throw InvalidParameter();
    }
    if (p1 < 0) {
      s = -C_ONE;
      p1 = -p1;
    }
    if (p1 % 1 === 0) {
      n2 = BigInt(p1);
    } else {
      let z3 = 1;
      let A2 = 0, B2 = 1;
      let C3 = 1, D = 1;
      let N2 = 1e7;
      if (p1 >= 1) {
        z3 = 10 ** Math.floor(1 + Math.log10(p1));
        p1 /= z3;
      }
      while (B2 <= N2 && D <= N2) {
        let M = (A2 + C3) / (B2 + D);
        if (p1 === M) {
          if (B2 + D <= N2) {
            n2 = A2 + C3;
            d2 = B2 + D;
          } else if (D > B2) {
            n2 = C3;
            d2 = D;
          } else {
            n2 = A2;
            d2 = B2;
          }
          break;
        } else {
          if (p1 > M) {
            A2 += C3;
            B2 += D;
          } else {
            C3 += A2;
            D += B2;
          }
          if (B2 > N2) {
            n2 = C3;
            d2 = D;
          } else {
            n2 = A2;
            d2 = B2;
          }
        }
      }
      n2 = BigInt(n2) * BigInt(z3);
      d2 = BigInt(d2);
    }
  } else if (typeof p1 === "string") {
    let ndx = 0;
    let v = C_ZERO, w2 = C_ZERO, x = C_ZERO, y2 = C_ONE, z3 = C_ONE;
    let match = p1.replace(/_/g, "").match(/\d+|./g);
    if (match === null)
      throw InvalidParameter();
    if (match[ndx] === "-") {
      s = -C_ONE;
      ndx++;
    } else if (match[ndx] === "+") {
      ndx++;
    }
    if (match.length === ndx + 1) {
      w2 = assign(match[ndx++], s);
    } else if (match[ndx + 1] === "." || match[ndx] === ".") {
      if (match[ndx] !== ".") {
        v = assign(match[ndx++], s);
      }
      ndx++;
      if (ndx + 1 === match.length || match[ndx + 1] === "(" && match[ndx + 3] === ")" || match[ndx + 1] === "'" && match[ndx + 3] === "'") {
        w2 = assign(match[ndx], s);
        y2 = C_TEN ** BigInt(match[ndx].length);
        ndx++;
      }
      if (match[ndx] === "(" && match[ndx + 2] === ")" || match[ndx] === "'" && match[ndx + 2] === "'") {
        x = assign(match[ndx + 1], s);
        z3 = C_TEN ** BigInt(match[ndx + 1].length) - C_ONE;
        ndx += 3;
      }
    } else if (match[ndx + 1] === "/" || match[ndx + 1] === ":") {
      w2 = assign(match[ndx], s);
      y2 = assign(match[ndx + 2], C_ONE);
      ndx += 3;
    } else if (match[ndx + 3] === "/" && match[ndx + 1] === " ") {
      v = assign(match[ndx], s);
      w2 = assign(match[ndx + 2], s);
      y2 = assign(match[ndx + 4], C_ONE);
      ndx += 5;
    }
    if (match.length <= ndx) {
      d2 = y2 * z3;
      s = /* void */
      n2 = x + d2 * v + z3 * w2;
    } else {
      throw InvalidParameter();
    }
  } else if (typeof p1 === "bigint") {
    n2 = p1;
    s = p1;
    d2 = C_ONE;
  } else {
    throw InvalidParameter();
  }
  if (d2 === C_ZERO) {
    throw DivisionByZero();
  }
  P["s"] = s < C_ZERO ? -C_ONE : C_ONE;
  P["n"] = n2 < C_ZERO ? -n2 : n2;
  P["d"] = d2 < C_ZERO ? -d2 : d2;
};
function modpow(b, e, m2) {
  let r = C_ONE;
  for (; e > C_ZERO; b = b * b % m2, e >>= C_ONE) {
    if (e & C_ONE) {
      r = r * b % m2;
    }
  }
  return r;
}
function cycleLen(n2, d2) {
  for (; d2 % C_TWO === C_ZERO; d2 /= C_TWO) {
  }
  for (; d2 % C_FIVE === C_ZERO; d2 /= C_FIVE) {
  }
  if (d2 === C_ONE)
    return C_ZERO;
  let rem = C_TEN % d2;
  let t = 1;
  for (; rem !== C_ONE; t++) {
    rem = rem * C_TEN % d2;
    if (t > MAX_CYCLE_LEN)
      return C_ZERO;
  }
  return BigInt(t);
}
function cycleStart(n2, d2, len) {
  let rem1 = C_ONE;
  let rem2 = modpow(C_TEN, len, d2);
  for (let t = 0; t < 300; t++) {
    if (rem1 === rem2)
      return BigInt(t);
    rem1 = rem1 * C_TEN % d2;
    rem2 = rem2 * C_TEN % d2;
  }
  return 0;
}
function gcd(a, b) {
  if (!a)
    return b;
  if (!b)
    return a;
  while (1) {
    a %= b;
    if (!a)
      return b;
    b %= a;
    if (!b)
      return a;
  }
}
function Fraction(a, b) {
  parse(a, b);
  if (this instanceof Fraction) {
    a = gcd(P["d"], P["n"]);
    this["s"] = P["s"];
    this["n"] = P["n"] / a;
    this["d"] = P["d"] / a;
  } else {
    return newFraction(P["s"] * P["n"], P["d"]);
  }
}
var DivisionByZero = function() {
  return new Error("Division by Zero");
};
var InvalidParameter = function() {
  return new Error("Invalid argument");
};
var NonIntegerParameter = function() {
  return new Error("Parameters must be integer");
};
Fraction.prototype = {
  "s": C_ONE,
  "n": C_ZERO,
  "d": C_ONE,
  /**
   * Calculates the absolute value
   *
   * Ex: new Fraction(-4).abs() => 4
   **/
  "abs": function() {
    return newFraction(this["n"], this["d"]);
  },
  /**
   * Inverts the sign of the current fraction
   *
   * Ex: new Fraction(-4).neg() => 4
   **/
  "neg": function() {
    return newFraction(-this["s"] * this["n"], this["d"]);
  },
  /**
   * Adds two rational numbers
   *
   * Ex: new Fraction({n: 2, d: 3}).add("14.9") => 467 / 30
   **/
  "add": function(a, b) {
    parse(a, b);
    return newFraction(
      this["s"] * this["n"] * P["d"] + P["s"] * this["d"] * P["n"],
      this["d"] * P["d"]
    );
  },
  /**
   * Subtracts two rational numbers
   *
   * Ex: new Fraction({n: 2, d: 3}).add("14.9") => -427 / 30
   **/
  "sub": function(a, b) {
    parse(a, b);
    return newFraction(
      this["s"] * this["n"] * P["d"] - P["s"] * this["d"] * P["n"],
      this["d"] * P["d"]
    );
  },
  /**
   * Multiplies two rational numbers
   *
   * Ex: new Fraction("-17.(345)").mul(3) => 5776 / 111
   **/
  "mul": function(a, b) {
    parse(a, b);
    return newFraction(
      this["s"] * P["s"] * this["n"] * P["n"],
      this["d"] * P["d"]
    );
  },
  /**
   * Divides two rational numbers
   *
   * Ex: new Fraction("-17.(345)").inverse().div(3)
   **/
  "div": function(a, b) {
    parse(a, b);
    return newFraction(
      this["s"] * P["s"] * this["n"] * P["d"],
      this["d"] * P["n"]
    );
  },
  /**
   * Clones the actual object
   *
   * Ex: new Fraction("-17.(345)").clone()
   **/
  "clone": function() {
    return newFraction(this["s"] * this["n"], this["d"]);
  },
  /**
   * Calculates the modulo of two rational numbers - a more precise fmod
   *
   * Ex: new Fraction('4.(3)').mod([7, 8]) => (13/3) % (7/8) = (5/6)
   * Ex: new Fraction(20, 10).mod().equals(0) ? "is Integer"
   **/
  "mod": function(a, b) {
    if (a === void 0) {
      return newFraction(this["s"] * this["n"] % this["d"], C_ONE);
    }
    parse(a, b);
    if (C_ZERO === P["n"] * this["d"]) {
      throw DivisionByZero();
    }
    return newFraction(
      this["s"] * (P["d"] * this["n"]) % (P["n"] * this["d"]),
      P["d"] * this["d"]
    );
  },
  /**
   * Calculates the fractional gcd of two rational numbers
   *
   * Ex: new Fraction(5,8).gcd(3,7) => 1/56
   */
  "gcd": function(a, b) {
    parse(a, b);
    return newFraction(gcd(P["n"], this["n"]) * gcd(P["d"], this["d"]), P["d"] * this["d"]);
  },
  /**
   * Calculates the fractional lcm of two rational numbers
   *
   * Ex: new Fraction(5,8).lcm(3,7) => 15
   */
  "lcm": function(a, b) {
    parse(a, b);
    if (P["n"] === C_ZERO && this["n"] === C_ZERO) {
      return newFraction(C_ZERO, C_ONE);
    }
    return newFraction(P["n"] * this["n"], gcd(P["n"], this["n"]) * gcd(P["d"], this["d"]));
  },
  /**
   * Gets the inverse of the fraction, means numerator and denominator are exchanged
   *
   * Ex: new Fraction([-3, 4]).inverse() => -4 / 3
   **/
  "inverse": function() {
    return newFraction(this["s"] * this["d"], this["n"]);
  },
  /**
   * Calculates the fraction to some integer exponent
   *
   * Ex: new Fraction(-1,2).pow(-3) => -8
   */
  "pow": function(a, b) {
    parse(a, b);
    if (P["d"] === C_ONE) {
      if (P["s"] < C_ZERO) {
        return newFraction((this["s"] * this["d"]) ** P["n"], this["n"] ** P["n"]);
      } else {
        return newFraction((this["s"] * this["n"]) ** P["n"], this["d"] ** P["n"]);
      }
    }
    if (this["s"] < C_ZERO) return null;
    let N2 = factorize(this["n"]);
    let D = factorize(this["d"]);
    let n2 = C_ONE;
    let d2 = C_ONE;
    for (let k3 in N2) {
      if (k3 === "1") continue;
      if (k3 === "0") {
        n2 = C_ZERO;
        break;
      }
      N2[k3] *= P["n"];
      if (N2[k3] % P["d"] === C_ZERO) {
        N2[k3] /= P["d"];
      } else return null;
      n2 *= BigInt(k3) ** N2[k3];
    }
    for (let k3 in D) {
      if (k3 === "1") continue;
      D[k3] *= P["n"];
      if (D[k3] % P["d"] === C_ZERO) {
        D[k3] /= P["d"];
      } else return null;
      d2 *= BigInt(k3) ** D[k3];
    }
    if (P["s"] < C_ZERO) {
      return newFraction(d2, n2);
    }
    return newFraction(n2, d2);
  },
  /**
   * Calculates the logarithm of a fraction to a given rational base
   *
   * Ex: new Fraction(27, 8).log(9, 4) => 3/2
   */
  "log": function(a, b) {
    parse(a, b);
    if (this["s"] <= C_ZERO || P["s"] <= C_ZERO) return null;
    const allPrimes = /* @__PURE__ */ Object.create(null);
    const baseFactors = factorize(P["n"]);
    const T1 = factorize(P["d"]);
    const numberFactors = factorize(this["n"]);
    const T2 = factorize(this["d"]);
    for (const prime in T1) {
      baseFactors[prime] = (baseFactors[prime] || C_ZERO) - T1[prime];
    }
    for (const prime in T2) {
      numberFactors[prime] = (numberFactors[prime] || C_ZERO) - T2[prime];
    }
    for (const prime in baseFactors) {
      if (prime === "1") continue;
      allPrimes[prime] = true;
    }
    for (const prime in numberFactors) {
      if (prime === "1") continue;
      allPrimes[prime] = true;
    }
    let retN = null;
    let retD = null;
    for (const prime in allPrimes) {
      const baseExponent = baseFactors[prime] || C_ZERO;
      const numberExponent = numberFactors[prime] || C_ZERO;
      if (baseExponent === C_ZERO) {
        if (numberExponent !== C_ZERO) {
          return null;
        }
        continue;
      }
      let curN = numberExponent;
      let curD = baseExponent;
      const gcdValue = gcd(curN, curD);
      curN /= gcdValue;
      curD /= gcdValue;
      if (retN === null && retD === null) {
        retN = curN;
        retD = curD;
      } else if (curN * retD !== retN * curD) {
        return null;
      }
    }
    return retN !== null && retD !== null ? newFraction(retN, retD) : null;
  },
  /**
   * Check if two rational numbers are the same
   *
   * Ex: new Fraction(19.6).equals([98, 5]);
   **/
  "equals": function(a, b) {
    parse(a, b);
    return this["s"] * this["n"] * P["d"] === P["s"] * P["n"] * this["d"];
  },
  /**
   * Check if this rational number is less than another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  "lt": function(a, b) {
    parse(a, b);
    return this["s"] * this["n"] * P["d"] < P["s"] * P["n"] * this["d"];
  },
  /**
   * Check if this rational number is less than or equal another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  "lte": function(a, b) {
    parse(a, b);
    return this["s"] * this["n"] * P["d"] <= P["s"] * P["n"] * this["d"];
  },
  /**
   * Check if this rational number is greater than another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  "gt": function(a, b) {
    parse(a, b);
    return this["s"] * this["n"] * P["d"] > P["s"] * P["n"] * this["d"];
  },
  /**
   * Check if this rational number is greater than or equal another
   *
   * Ex: new Fraction(19.6).lt([98, 5]);
   **/
  "gte": function(a, b) {
    parse(a, b);
    return this["s"] * this["n"] * P["d"] >= P["s"] * P["n"] * this["d"];
  },
  /**
   * Compare two rational numbers
   * < 0 iff this < that
   * > 0 iff this > that
   * = 0 iff this = that
   *
   * Ex: new Fraction(19.6).compare([98, 5]);
   **/
  "compare": function(a, b) {
    parse(a, b);
    let t = this["s"] * this["n"] * P["d"] - P["s"] * P["n"] * this["d"];
    return (C_ZERO < t) - (t < C_ZERO);
  },
  /**
   * Calculates the ceil of a rational number
   *
   * Ex: new Fraction('4.(3)').ceil() => (5 / 1)
   **/
  "ceil": function(places) {
    places = C_TEN ** BigInt(places || 0);
    return newFraction(
      ifloor(this["s"] * places * this["n"] / this["d"]) + (places * this["n"] % this["d"] > C_ZERO && this["s"] >= C_ZERO ? C_ONE : C_ZERO),
      places
    );
  },
  /**
   * Calculates the floor of a rational number
   *
   * Ex: new Fraction('4.(3)').floor() => (4 / 1)
   **/
  "floor": function(places) {
    places = C_TEN ** BigInt(places || 0);
    return newFraction(
      ifloor(this["s"] * places * this["n"] / this["d"]) - (places * this["n"] % this["d"] > C_ZERO && this["s"] < C_ZERO ? C_ONE : C_ZERO),
      places
    );
  },
  /**
   * Rounds a rational numbers
   *
   * Ex: new Fraction('4.(3)').round() => (4 / 1)
   **/
  "round": function(places) {
    places = C_TEN ** BigInt(places || 0);
    return newFraction(
      ifloor(this["s"] * places * this["n"] / this["d"]) + this["s"] * ((this["s"] >= C_ZERO ? C_ONE : C_ZERO) + C_TWO * (places * this["n"] % this["d"]) > this["d"] ? C_ONE : C_ZERO),
      places
    );
  },
  /**
    * Rounds a rational number to a multiple of another rational number
    *
    * Ex: new Fraction('0.9').roundTo("1/8") => 7 / 8
    **/
  "roundTo": function(a, b) {
    parse(a, b);
    const n2 = this["n"] * P["d"];
    const d2 = this["d"] * P["n"];
    const r = n2 % d2;
    let k3 = ifloor(n2 / d2);
    if (r + r >= d2) {
      k3++;
    }
    return newFraction(this["s"] * k3 * P["n"], P["d"]);
  },
  /**
   * Check if two rational numbers are divisible
   *
   * Ex: new Fraction(19.6).divisible(1.5);
   */
  "divisible": function(a, b) {
    parse(a, b);
    if (P["n"] === C_ZERO) return false;
    return this["n"] * P["d"] % (P["n"] * this["d"]) === C_ZERO;
  },
  /**
   * Returns a decimal representation of the fraction
   *
   * Ex: new Fraction("100.'91823'").valueOf() => 100.91823918239183
   **/
  "valueOf": function() {
    return Number(this["s"] * this["n"]) / Number(this["d"]);
  },
  /**
   * Creates a string representation of a fraction with all digits
   *
   * Ex: new Fraction("100.'91823'").toString() => "100.(91823)"
   **/
  "toString": function(dec = 15) {
    let N2 = this["n"];
    let D = this["d"];
    let cycLen = cycleLen(N2, D);
    let cycOff = cycleStart(N2, D, cycLen);
    let str = this["s"] < C_ZERO ? "-" : "";
    str += ifloor(N2 / D);
    N2 %= D;
    N2 *= C_TEN;
    if (N2)
      str += ".";
    if (cycLen) {
      for (let i = cycOff; i--; ) {
        str += ifloor(N2 / D);
        N2 %= D;
        N2 *= C_TEN;
      }
      str += "(";
      for (let i = cycLen; i--; ) {
        str += ifloor(N2 / D);
        N2 %= D;
        N2 *= C_TEN;
      }
      str += ")";
    } else {
      for (let i = dec; N2 && i--; ) {
        str += ifloor(N2 / D);
        N2 %= D;
        N2 *= C_TEN;
      }
    }
    return str;
  },
  /**
   * Returns a string-fraction representation of a Fraction object
   *
   * Ex: new Fraction("1.'3'").toFraction() => "4 1/3"
   **/
  "toFraction": function(showMixed = false) {
    let n2 = this["n"];
    let d2 = this["d"];
    let str = this["s"] < C_ZERO ? "-" : "";
    if (d2 === C_ONE) {
      str += n2;
    } else {
      const whole = ifloor(n2 / d2);
      if (showMixed && whole > C_ZERO) {
        str += whole;
        str += " ";
        n2 %= d2;
      }
      str += n2;
      str += "/";
      str += d2;
    }
    return str;
  },
  /**
   * Returns a latex representation of a Fraction object
   *
   * Ex: new Fraction("1.'3'").toLatex() => "\frac{4}{3}"
   **/
  "toLatex": function(showMixed = false) {
    let n2 = this["n"];
    let d2 = this["d"];
    let str = this["s"] < C_ZERO ? "-" : "";
    if (d2 === C_ONE) {
      str += n2;
    } else {
      const whole = ifloor(n2 / d2);
      if (showMixed && whole > C_ZERO) {
        str += whole;
        n2 %= d2;
      }
      str += "\\frac{";
      str += n2;
      str += "}{";
      str += d2;
      str += "}";
    }
    return str;
  },
  /**
   * Returns an array of continued fraction elements
   *
   * Ex: new Fraction("7/8").toContinued() => [0,1,7]
   */
  "toContinued": function() {
    let a = this["n"];
    let b = this["d"];
    const res = [];
    while (b) {
      res.push(ifloor(a / b));
      const t = a % b;
      a = b;
      b = t;
    }
    return res;
  },
  "simplify": function(eps = 1e-3) {
    const ieps = BigInt(Math.ceil(1 / eps));
    const thisABS = this["abs"]();
    const cont = thisABS["toContinued"]();
    for (let i = 1; i < cont.length; i++) {
      let s = newFraction(cont[i - 1], C_ONE);
      for (let k3 = i - 2; k3 >= 0; k3--) {
        s = s["inverse"]()["add"](cont[k3]);
      }
      let t = s["sub"](thisABS);
      if (t["n"] * ieps < t["d"]) {
        return s["mul"](this["s"]);
      }
    }
    return this;
  }
};

// vite-stubs/kabelsalat-web.js
var SalatRepl = class {
  constructor() {
  }
  setCode() {
  }
  evaluate() {
  }
  stop() {
  }
};

// node_modules/@strudel/core/dist/index.mjs
var oe = "strudel.log";
var Qe = 1e3;
var Ut;
var Xt;
function zt(t, e = "cyclist") {
  process.env.NODE_ENV === "development" && console.error(t), E(`[${e}] error: ${t.message}`);
}
function E(t, e, n2 = {}) {
  let s = performance.now();
  Ut === t && s - Xt < Qe || (Ut = t, Xt = s, console.log(`%c${t}`, "background-color: black;color:white;border-radius:15px"), typeof document < "u" && typeof CustomEvent < "u" && document.dispatchEvent(
    new CustomEvent(oe, {
      detail: {
        message: t,
        type: e,
        data: n2
      }
    })
  ));
}
E.key = oe;
var Yf = (t) => /^[a-gA-G][#bsf]*[0-9]*$/.test(t);
var Mt = (t) => /^[a-gA-G][#bsf]*-?[0-9]*$/.test(t);
var Ue = (t) => {
  if (typeof t != "string")
    return [];
  const [e, n2 = "", s] = t.match(/^([a-gA-G])([#bsf]*)(-?[0-9]*)$/)?.slice(1) || [];
  return e ? [e, n2, s ? Number(s) : void 0] : [];
};
var Xe = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
var Ke = { "#": 1, b: -1, s: 1, f: -1 };
var Ye = (t) => t?.split("").reduce((e, n2) => e + Ke[n2], 0) || 0;
var gt = (t, e = 3) => {
  const [n2, s, r = e] = Ue(t);
  if (!n2)
    throw new Error('not a note: "' + t + '"');
  const o = Xe[n2.toLowerCase()], i = Ye(s);
  return (Number(r) + 1) * 12 + o + i;
};
var it = (t) => Math.pow(2, (t - 69) / 12) * 440;
var Ze = (t) => 12 * Math.log(t / 440) / Math.LN2 + 69;
var Zf = (t, e) => {
  if (typeof t != "object")
    throw new Error("valueToMidi: expected object value");
  let { freq: n2, note: s } = t;
  if (typeof n2 == "number")
    return Ze(n2);
  if (typeof s == "string")
    return gt(s);
  if (typeof s == "number")
    return s;
  if (!e)
    throw new Error("valueToMidi: expected freq or note to be set");
  return e;
};
var th = (t, e) => (t - e) * 1e3;
var tn = (t) => it(typeof t == "number" ? t : gt(t));
var en = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
var eh = (t) => {
  const e = Math.floor(t / 12) - 1;
  return en[t % 12] + e;
};
var bt = (t, e) => (t % e + e) % e;
var nn = (t) => t.reduce((e, n2) => e + n2) / t.length;
function sn(t, e = 0) {
  return isNaN(Number(t)) ? (E(`"${t}" is not a number, falling back to ${e}`, "warning"), e) : t;
}
var nh = (t, e) => bt(Math.round(sn(t ?? 0, 0)), e);
var sh = (t) => {
  let { value: e, context: n2 } = t, s = e;
  if (typeof s == "object" && !Array.isArray(s) && (s = s.note || s.n || s.value, s === void 0))
    throw new Error(`cannot find a playable note for ${JSON.stringify(e)}`);
  if (typeof s == "number" && n2.type !== "frequency")
    s = it(t.value);
  else if (typeof s == "number" && n2.type === "frequency")
    s = t.value;
  else if (typeof s != "string" || !Mt(s))
    throw new Error("not a note: " + JSON.stringify(s));
  return s;
};
var rh = (t) => {
  let { value: e, context: n2 } = t;
  if (typeof e == "object")
    return e.freq ? e.freq : tn(e.note || e.n || e.value);
  if (typeof e == "number" && n2.type !== "frequency")
    e = it(t.value);
  else if (typeof e == "string" && Mt(e))
    e = it(gt(t.value));
  else if (typeof e != "number")
    throw new Error("not a note or frequency: " + e);
  return e;
};
var rn = (t, e) => t.slice(e).concat(t.slice(0, e));
var on = (...t) => t.reduce(
  (e, n2) => (...s) => e(n2(...s)),
  (e) => e
);
var oh = (...t) => on(...t.reverse());
var lt = (t) => t.filter((e) => e != null);
var G = (t) => [].concat(...t);
var ot = (t) => t;
var ch = (t, e) => t;
var _t = (t, e) => Array.from({ length: e - t + 1 }, (n2, s) => s + t);
function w(t, e, n2 = t.length) {
  const s = function r(...o) {
    if (o.length >= n2)
      return t.apply(this, o);
    {
      const i = function(...a) {
        return r.apply(this, o.concat(a));
      };
      return e && e(i, o), i;
    }
  };
  return e && e(s, []), s;
}
function ce(t) {
  const e = Number(t);
  if (!isNaN(e))
    return e;
  if (Mt(t))
    return gt(t);
  throw new Error(`cannot parse as numeral: "${t}"`);
}
function ie(t, e) {
  return (...n2) => t(...n2.map(e));
}
function L(t) {
  return ie(t, ce);
}
function cn(t) {
  const e = Number(t);
  if (!isNaN(e))
    return e;
  const n2 = {
    pi: Math.PI,
    w: 1,
    h: 0.5,
    q: 0.25,
    e: 0.125,
    s: 0.0625,
    t: 1 / 3,
    f: 0.2,
    x: 1 / 6
  }[t];
  if (typeof n2 < "u")
    return n2;
  throw new Error(`cannot parse as fractional: "${t}"`);
}
var ih = (t) => ie(t, cn);
var ue = function(t, e) {
  return [e.slice(0, t), e.slice(t)];
};
var Pt = (t, e, n2) => e.map((s, r) => t(s, n2[r]));
var un = function(t) {
  const e = [];
  for (let n2 = 0; n2 < t.length - 1; ++n2)
    e.push([t[n2], t[n2 + 1]]);
  return e;
};
var an = (t, e, n2) => Math.min(Math.max(t, e), n2);
var ln = ["Do", "Reb", "Re", "Mib", "Mi", "Fa", "Solb", "Sol", "Lab", "La", "Sib", "Si"];
var pn = [
  "Sa",
  "Re",
  "Ga",
  "Ma",
  "Pa",
  "Dha",
  "Ni"
];
var fn = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Hb", "H"];
var hn = [
  "Ni",
  "Pab",
  "Pa",
  "Voub",
  "Vou",
  "Ga",
  "Dib",
  "Di",
  "Keb",
  "Ke",
  "Zob",
  "Zo"
];
var dn = [
  "I",
  "Ro",
  "Ha",
  "Ni",
  "Ho",
  "He",
  "To"
];
var mn = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
var uh = (t, e = "letters") => {
  const s = (e === "solfeggio" ? ln : e === "indian" ? pn : e === "german" ? fn : e === "byzantine" ? hn : e === "japanese" ? dn : mn)[t % 12], r = Math.floor(t / 12) - 1;
  return s + r;
};
function ah(t) {
  var e = {};
  return t.filter(function(n2) {
    return e.hasOwn(n2) ? false : e[n2] = true;
  });
}
function lh(t) {
  return t.sort().filter(function(e, n2, s) {
    return !n2 || e != s[n2 - 1];
  });
}
function yn(t) {
  return t.sort((e, n2) => e.compare(n2)).filter(function(e, n2, s) {
    return !n2 || e.ne(s[n2 - 1]);
  });
}
function wn(t) {
  const e = new TextEncoder().encode(t);
  return btoa(String.fromCharCode(...e));
}
function gn(t) {
  const e = new Uint8Array(
    atob(t).split("").map((s) => s.charCodeAt(0))
  );
  return new TextDecoder().decode(e);
}
function ph(t) {
  return encodeURIComponent(wn(t));
}
function fh(t) {
  return gn(decodeURIComponent(t));
}
function bn(t, e) {
  return Array.isArray(t) ? t.map(e) : Object.fromEntries(Object.entries(t).map(([n2, s], r) => [n2, e(s, n2, r)]));
}
function Kt(t, e) {
  return t / e;
}
var _n = class {
  constructor({
    getTargetClockTime: e = vn,
    weight: n2 = 16,
    offsetDelta: s = 5e-3,
    checkAfterTime: r = 2,
    resetAfterTime: o = 8
  }) {
    this.offsetTime, this.timeAtPrevOffsetSample, this.prevOffsetTimes = [], this.getTargetClockTime = e, this.weight = n2, this.offsetDelta = s, this.checkAfterTime = r, this.resetAfterTime = o, this.reset = () => {
      this.prevOffsetTimes = [], this.offsetTime = null, this.timeAtPrevOffsetSample = null;
    };
  }
  calculateOffset(e) {
    const n2 = this.getTargetClockTime(), s = n2 - this.timeAtPrevOffsetSample, r = n2 - e;
    if (s > this.resetAfterTime && this.reset(), this.offsetTime == null && (this.offsetTime = r), this.prevOffsetTimes.push(r), this.prevOffsetTimes.length > this.weight && this.prevOffsetTimes.shift(), this.timeAtPrevOffsetSample == null || s > this.checkAfterTime) {
      this.timeAtPrevOffsetSample = n2;
      const o = nn(this.prevOffsetTimes);
      Math.abs(o - this.offsetTime) > this.offsetDelta && (this.offsetTime = o);
    }
    return this.offsetTime;
  }
  calculateTimestamp(e, n2) {
    return this.calculateOffset(e) + n2;
  }
};
function hh() {
  return performance.now() * 1e-3;
}
function vn() {
  return Date.now() * 1e-3;
}
var kn = /* @__PURE__ */ new Map([
  ["control", "Control"],
  ["ctrl", "Control"],
  ["alt", "Alt"],
  ["shift", "Shift"],
  ["down", "ArrowDown"],
  ["up", "ArrowUp"],
  ["left", "ArrowLeft"],
  ["right", "ArrowRight"]
]);
var rt;
function qn() {
  if (rt == null) {
    if (typeof window > "u")
      return;
    rt = {}, window.addEventListener("keydown", (t) => {
      rt[t.key] = true;
    }), window.addEventListener("keyup", (t) => {
      rt[t.key] = false;
    });
  }
  return { ...rt };
}
function ae(t, e = false) {
  return typeof t == "object" ? e ? JSON.stringify(t).slice(1, -1).replaceAll('"', "").replaceAll(",", " ") : JSON.stringify(t) : t;
}
Fraction.prototype.sam = function() {
  return this.floor();
};
Fraction.prototype.nextSam = function() {
  return this.sam().add(1);
};
Fraction.prototype.wholeCycle = function() {
  return new B(this.sam(), this.nextSam());
};
Fraction.prototype.cyclePos = function() {
  return this.sub(this.sam());
};
Fraction.prototype.lt = function(t) {
  return this.compare(t) < 0;
};
Fraction.prototype.gt = function(t) {
  return this.compare(t) > 0;
};
Fraction.prototype.lte = function(t) {
  return this.compare(t) <= 0;
};
Fraction.prototype.gte = function(t) {
  return this.compare(t) >= 0;
};
Fraction.prototype.eq = function(t) {
  return this.compare(t) == 0;
};
Fraction.prototype.ne = function(t) {
  return this.compare(t) != 0;
};
Fraction.prototype.max = function(t) {
  return this.gt(t) ? this : t;
};
Fraction.prototype.maximum = function(...t) {
  return t = t.map((e) => new Fraction(e)), t.reduce((e, n2) => n2.max(e), this);
};
Fraction.prototype.min = function(t) {
  return this.lt(t) ? this : t;
};
Fraction.prototype.mulmaybe = function(t) {
  return t !== void 0 ? this.mul(t) : void 0;
};
Fraction.prototype.divmaybe = function(t) {
  return t !== void 0 ? this.div(t) : void 0;
};
Fraction.prototype.addmaybe = function(t) {
  return t !== void 0 ? this.add(t) : void 0;
};
Fraction.prototype.submaybe = function(t) {
  return t !== void 0 ? this.sub(t) : void 0;
};
Fraction.prototype.show = function() {
  return this.s * this.n + "/" + this.d;
};
Fraction.prototype.or = function(t) {
  return this.eq(0) ? t : this;
};
var m = (t) => Fraction(t);
var Sn = (...t) => {
  if (t = lt(t), t.length !== 0)
    return t.reduce((e, n2) => e.gcd(n2), m(1));
};
var Y = (...t) => {
  if (t = lt(t), t.length === 0)
    return;
  const e = t.pop();
  return t.reduce(
    (n2, s) => n2 === void 0 || s === void 0 ? void 0 : n2.lcm(s),
    e
  );
};
var An = (t) => t instanceof Fraction;
m._original = Fraction;
var B = class _B {
  constructor(e, n2) {
    this.begin = m(e), this.end = m(n2);
  }
  get spanCycles() {
    const e = [];
    var n2 = this.begin;
    const s = this.end, r = s.sam();
    if (n2.equals(s))
      return [new _B(n2, s)];
    for (; s.gt(n2); ) {
      if (n2.sam().equals(r)) {
        e.push(new _B(n2, this.end));
        break;
      }
      const o = n2.nextSam();
      e.push(new _B(n2, o)), n2 = o;
    }
    return e;
  }
  get duration() {
    return this.end.sub(this.begin);
  }
  cycleArc() {
    const e = this.begin.cyclePos(), n2 = e.add(this.duration);
    return new _B(e, n2);
  }
  withTime(e) {
    return new _B(e(this.begin), e(this.end));
  }
  withEnd(e) {
    return new _B(this.begin, e(this.end));
  }
  withCycle(e) {
    const n2 = this.begin.sam(), s = n2.add(e(this.begin.sub(n2))), r = n2.add(e(this.end.sub(n2)));
    return new _B(s, r);
  }
  intersection(e) {
    const n2 = this.begin.max(e.begin), s = this.end.min(e.end);
    if (!n2.gt(s) && !(n2.equals(s) && (n2.equals(this.end) && this.begin.lt(this.end) || n2.equals(e.end) && e.begin.lt(e.end))))
      return new _B(n2, s);
  }
  intersection_e(e) {
    const n2 = this.intersection(e);
    if (n2 == null)
      throw "TimeSpans do not intersect";
    return n2;
  }
  midpoint() {
    return this.begin.add(this.duration.div(m(2)));
  }
  equals(e) {
    return this.begin.equals(e.begin) && this.end.equals(e.end);
  }
  show() {
    return this.begin.show() + " \u2192 " + this.end.show();
  }
};
var S = class _S {
  /*
        Event class, representing a value active during the timespan
        'part'. This might be a fragment of an event, in which case the
        timespan will be smaller than the 'whole' timespan, otherwise the
        two timespans will be the same. The 'part' must never extend outside of the
        'whole'. If the event represents a continuously changing value
        then the whole will be returned as None, in which case the given
        value will have been sampled from the point halfway between the
        start and end of the 'part' timespan.
        The context is to store a list of source code locations causing the event.
  
        The word 'Event' is more or less a reserved word in javascript, hence this
        class is named called 'Hap'.
        */
  constructor(e, n2, s, r = {}, o = false) {
    this.whole = e, this.part = n2, this.value = s, this.context = r, this.stateful = o, o && console.assert(typeof this.value == "function", "Stateful values must be functions");
  }
  get duration() {
    let e;
    return typeof this.value?.duration == "number" ? e = m(this.value.duration) : e = this.whole.end.sub(this.whole.begin), typeof this.value?.clip == "number" ? e.mul(this.value.clip) : e;
  }
  get endClipped() {
    return this.whole.begin.add(this.duration);
  }
  isActive(e) {
    return this.whole.begin <= e && this.endClipped >= e;
  }
  isInPast(e) {
    return e > this.endClipped;
  }
  isInNearPast(e, n2) {
    return n2 - e <= this.endClipped;
  }
  isInFuture(e) {
    return e < this.whole.begin;
  }
  isInNearFuture(e, n2) {
    return n2 < this.whole.begin && n2 > this.whole.begin - e;
  }
  isWithinTime(e, n2) {
    return this.whole.begin <= n2 && this.endClipped >= e;
  }
  wholeOrPart() {
    return this.whole ? this.whole : this.part;
  }
  withSpan(e) {
    const n2 = this.whole ? e(this.whole) : void 0;
    return new _S(n2, e(this.part), this.value, this.context);
  }
  withValue(e) {
    return new _S(this.whole, this.part, e(this.value), this.context);
  }
  hasOnset() {
    return this.whole != null && this.whole.begin.equals(this.part.begin);
  }
  hasTag(e) {
    return this.context.tags?.includes(e);
  }
  resolveState(e) {
    if (this.stateful && this.hasOnset()) {
      console.log("stateful");
      const n2 = this.value, [s, r] = n2(e);
      return [s, new _S(this.whole, this.part, r, this.context, false)];
    }
    return [e, this];
  }
  spanEquals(e) {
    return this.whole == null && e.whole == null || this.whole.equals(e.whole);
  }
  equals(e) {
    return this.spanEquals(e) && this.part.equals(e.part) && // TODO would == be better ??
    this.value === e.value;
  }
  show(e = false) {
    const n2 = typeof this.value == "object" ? e ? JSON.stringify(this.value).slice(1, -1).replaceAll('"', "").replaceAll(",", " ") : JSON.stringify(this.value) : this.value;
    var s = "";
    if (this.whole == null)
      s = "~" + this.part.show;
    else {
      var r = this.whole.begin.equals(this.part.begin) && this.whole.end.equals(this.part.end);
      this.whole.begin.equals(this.part.begin) || (s = this.whole.begin.show() + " \u21DC "), r || (s += "("), s += this.part.show(), r || (s += ")"), this.whole.end.equals(this.part.end) || (s += " \u21DD " + this.whole.end.show());
    }
    return "[ " + s + " | " + n2 + " ]";
  }
  showWhole(e = false) {
    return `${this.whole == null ? "~" : this.whole.show()}: ${ae(this.value, e)}`;
  }
  combineContext(e) {
    const n2 = this;
    return { ...n2.context, ...e.context, locations: (n2.context.locations || []).concat(e.context.locations || []) };
  }
  setContext(e) {
    return new _S(this.whole, this.part, this.value, e);
  }
  ensureObjectValue() {
    if (typeof this.value != "object")
      throw new Error(
        `expected hap.value to be an object, but got "${this.value}". Hint: append .note() or .s() to the end`,
        "error"
      );
  }
};
var ut = class _ut {
  constructor(e, n2 = {}) {
    this.span = e, this.controls = n2;
  }
  // Returns new State with different span
  setSpan(e) {
    return new _ut(e, this.controls);
  }
  withSpan(e) {
    return this.setSpan(e(this.span));
  }
  // Returns new State with added controls.
  setControls(e) {
    return new _ut(this.span, { ...this.controls, ...e });
  }
};
function Tn(t, e, n2) {
  if (e?.value !== void 0 && Object.keys(e).length === 1)
    return E("[warn]: Can't do arithmetic on control pattern."), t;
  const s = Object.keys(t).filter((r) => Object.keys(e).includes(r));
  return Object.assign({}, t, e, Object.fromEntries(s.map((r) => [r, n2(t[r], e[r])])));
}
w((t, e) => t * e);
w((t, e) => e.map(t));
function Cn(t, e = 60) {
  let n2 = 0, s = m(0), r = [""], o = "";
  for (; r[0].length < e; ) {
    const i = t.queryArc(n2, n2 + 1), a = i.filter((h) => h.hasOnset()).map((h) => h.duration), u2 = Sn(...a), p = u2.inverse();
    r = r.map((h) => h + "|"), o += "|";
    for (let h = 0; h < p; h++) {
      const [y2, g] = [s, s.add(u2)], v = i.filter((O) => O.whole.begin.lte(y2) && O.whole.end.gte(g)), _4 = v.length - r.length;
      _4 > 0 && (r = r.concat(Array(_4).fill(o))), r = r.map((O, A2) => {
        const I = v[A2];
        if (I) {
          const P2 = I.whole.begin.eq(y2) ? "" + I.value : "-";
          return O + P2;
        }
        return O + ".";
      }), o += ".", s = s.add(u2);
    }
    n2++;
  }
  return r.join(`
`);
}
var le = {};
var xn = async (...t) => {
  const e = await Promise.allSettled(t), n2 = e.filter((s) => s.status === "fulfilled").map((s) => s.value);
  return e.forEach((s, r) => {
    s.status === "rejected" && console.warn(`evalScope: module with index ${r} could not be loaded:`, s.reason);
  }), n2.forEach((s) => {
    Object.entries(s).forEach(([r, o]) => {
      globalThis[r] = o, le[r] = o;
    });
  }), n2;
};
function Bn(t, e = {}) {
  const { wrapExpression: n2 = true, wrapAsync: s = true } = e;
  n2 && (t = `{${t}}`), s && (t = `(async ()=>${t})()`);
  const r = `"use strict";return (${t})`;
  return Function(r)();
}
var On = async (t, e, n2) => {
  let s = {};
  if (e) {
    const i = e(t, n2);
    t = i.output, s = i;
  }
  return { mode: "javascript", pattern: await Bn(t, { wrapExpression: !!e }), meta: s };
};
var Ct;
var J = true;
var dh = function(t) {
  J = !!t;
};
var mh = (t) => Ct = t;
var f = class _f2 {
  /**
   * Create a pattern. As an end user, you will most likely not create a Pattern directly.
   *
   * @param {function} query - The function that maps a `State` to an array of `Hap`.
   * @noAutocomplete
   */
  constructor(e, n2 = void 0) {
    this.query = e, this._Pattern = true, this._steps = n2;
  }
  get _steps() {
    return this.__steps;
  }
  set _steps(e) {
    this.__steps = e === void 0 ? void 0 : m(e);
  }
  setSteps(e) {
    return this._steps = e, this;
  }
  withSteps(e) {
    return J ? new _f2(this.query, this._steps === void 0 ? void 0 : e(this._steps)) : this;
  }
  get hasSteps() {
    return this._steps !== void 0;
  }
  //////////////////////////////////////////////////////////////////////
  // Haskell-style functor, applicative and monadic operations
  /**
   * Returns a new pattern, with the function applied to the value of
   * each hap. It has the alias `fmap`.
   * @synonyms fmap
   * @param {Function} func to to apply to the value
   * @returns Pattern
   * @example
   * "0 1 2".withValue(v => v + 10).log()
   */
  withValue(e) {
    const n2 = new _f2((s) => this.query(s).map((r) => r.withValue(e)));
    return n2._steps = this._steps, n2;
  }
  // runs func on query state
  withState(e) {
    return new _f2((n2) => this.query(e(n2)));
  }
  /**
   * see `withValue`
   * @noAutocomplete
   */
  fmap(e) {
    return this.withValue(e);
  }
  /**
   * Assumes 'this' is a pattern of functions, and given a function to
   * resolve wholes, applies a given pattern of values to that
   * pattern of functions.
   * @param {Function} whole_func
   * @param {Function} func
   * @noAutocomplete
   * @returns Pattern
   */
  appWhole(e, n2) {
    const s = this, r = function(o) {
      const i = s.query(o), a = n2.query(o), u2 = function(p, h) {
        const y2 = p.part.intersection(h.part);
        if (y2 != null)
          return new S(
            e(p.whole, h.whole),
            y2,
            p.value(h.value),
            h.combineContext(p)
          );
      };
      return G(
        i.map((p) => lt(a.map((h) => u2(p, h))))
      );
    };
    return new _f2(r);
  }
  /**
   * When this method is called on a pattern of functions, it matches its haps
   * with those in the given pattern of values.  A new pattern is returned, with
   * each matching value applied to the corresponding function.
   *
   * In this `_appBoth` variant, where timespans of the function and value haps
   * are not the same but do intersect, the resulting hap has a timespan of the
   * intersection. This applies to both the part and the whole timespan.
   * @param {Pattern} pat_val
   * @noAutocomplete
   * @returns Pattern
   */
  appBoth(e) {
    const n2 = this, s = function(o, i) {
      if (!(o == null || i == null))
        return o.intersection_e(i);
    }, r = n2.appWhole(s, e);
    return J && (r._steps = Y(e._steps, n2._steps)), r;
  }
  /**
   * As with `appBoth`, but the `whole` timespan is not the intersection,
   * but the timespan from the function of patterns that this method is called
   * on. In practice, this means that the pattern structure, including onsets,
   * are preserved from the pattern of functions (often referred to as the left
   * hand or inner pattern).
   * @param {Pattern} pat_val
   * @noAutocomplete
   * @returns Pattern
   */
  appLeft(e) {
    const n2 = this, s = function(o) {
      const i = [];
      for (const a of n2.query(o)) {
        const u2 = e.query(o.setSpan(a.wholeOrPart()));
        for (const p of u2) {
          const h = a.whole, y2 = a.part.intersection(p.part);
          if (y2) {
            const g = a.value(p.value), v = p.combineContext(a), _4 = new S(h, y2, g, v);
            i.push(_4);
          }
        }
      }
      return i;
    }, r = new _f2(s);
    return r._steps = this._steps, r;
  }
  /**
   * As with `appLeft`, but `whole` timespans are instead taken from the
   * pattern of values, i.e. structure is preserved from the right hand/outer
   * pattern.
   * @param {Pattern} pat_val
   * @noAutocomplete
   * @returns Pattern
   */
  appRight(e) {
    const n2 = this, s = function(o) {
      const i = [];
      for (const a of e.query(o)) {
        const u2 = n2.query(o.setSpan(a.wholeOrPart()));
        for (const p of u2) {
          const h = a.whole, y2 = p.part.intersection(a.part);
          if (y2) {
            const g = p.value(a.value), v = a.combineContext(p), _4 = new S(h, y2, g, v);
            i.push(_4);
          }
        }
      }
      return i;
    }, r = new _f2(s);
    return r._steps = e._steps, r;
  }
  bindWhole(e, n2) {
    const s = this, r = function(o) {
      const i = function(u2, p) {
        return new S(
          e(u2.whole, p.whole),
          p.part,
          p.value,
          Object.assign({}, u2.context, p.context, {
            locations: (u2.context.locations || []).concat(p.context.locations || [])
          })
        );
      }, a = function(u2) {
        return n2(u2.value).query(o.setSpan(u2.part)).map((p) => i(u2, p));
      };
      return G(s.query(o).map((u2) => a(u2)));
    };
    return new _f2(r);
  }
  bind(e) {
    const n2 = function(s, r) {
      if (!(s == null || r == null))
        return s.intersection_e(r);
    };
    return this.bindWhole(n2, e);
  }
  join() {
    return this.bind(ot);
  }
  outerBind(e) {
    return this.bindWhole((n2) => n2, e).setSteps(this._steps);
  }
  outerJoin() {
    return this.outerBind(ot);
  }
  innerBind(e) {
    return this.bindWhole((n2, s) => s, e);
  }
  innerJoin() {
    return this.innerBind(ot);
  }
  // Flatterns patterns of patterns, by retriggering/resetting inner patterns at onsets of outer pattern haps
  resetJoin(e = false) {
    const n2 = this;
    return new _f2((s) => n2.discreteOnly().query(s).map((r) => r.value.late(e ? r.whole.begin : r.whole.begin.cyclePos()).query(s).map(
      (o) => new S(
        // Supports continuous haps in the inner pattern
        o.whole ? o.whole.intersection(r.whole) : void 0,
        o.part.intersection(r.part),
        o.value
      ).setContext(r.combineContext(o))
    ).filter((o) => o.part)).flat());
  }
  restartJoin() {
    return this.resetJoin(true);
  }
  // Like the other joins above, joins a pattern of patterns of values, into a flatter
  // pattern of values. In this case it takes whole cycles of the inner pattern to fit each event
  // in the outer pattern.
  squeezeJoin() {
    const e = this;
    function n2(s) {
      const r = e.discreteOnly().query(s);
      function o(a) {
        const p = a.value._focusSpan(a.wholeOrPart()).query(s.setSpan(a.part));
        function h(y2, g) {
          let v;
          if (g.whole && y2.whole && (v = g.whole.intersection(y2.whole), !v))
            return;
          const _4 = g.part.intersection(y2.part);
          if (!_4)
            return;
          const O = g.combineContext(y2);
          return new S(v, _4, g.value, O);
        }
        return p.map((y2) => h(a, y2));
      }
      return G(r.map(o)).filter((a) => a);
    }
    return new _f2(n2);
  }
  squeezeBind(e) {
    return this.fmap(e).squeezeJoin();
  }
  polyJoin = function() {
    const e = this;
    return e.fmap((n2) => n2.extend(e._steps.div(n2._steps))).outerJoin();
  };
  polyBind(e) {
    return this.fmap(e).polyJoin();
  }
  //////////////////////////////////////////////////////////////////////
  // Utility methods mainly for internal use
  /**
   * Query haps inside the given time span.
   *
   * @param {Fraction | number} begin from time
   * @param {Fraction | number} end to time
   * @returns Hap[]
   * @example
   * const pattern = sequence('a', ['b', 'c'])
   * const haps = pattern.queryArc(0, 1)
   * console.log(haps)
   * silence
   * @noAutocomplete
   */
  queryArc(e, n2, s = {}) {
    try {
      return this.query(new ut(new B(e, n2), s));
    } catch (r) {
      return zt(r, "query"), [];
    }
  }
  /**
   * Returns a new pattern, with queries split at cycle boundaries. This makes
   * some calculations easier to express, as all haps are then constrained to
   * happen within a cycle.
   * @returns Pattern
   * @noAutocomplete
   */
  splitQueries() {
    const e = this, n2 = (s) => G(s.span.spanCycles.map((r) => e.query(s.setSpan(r))));
    return new _f2(n2);
  }
  /**
   * Returns a new pattern, where the given function is applied to the query
   * timespan before passing it to the original pattern.
   * @param {Function} func the function to apply
   * @returns Pattern
   * @noAutocomplete
   */
  withQuerySpan(e) {
    return new _f2((n2) => this.query(n2.withSpan(e)));
  }
  withQuerySpanMaybe(e) {
    const n2 = this;
    return new _f2((s) => {
      const r = s.withSpan(e);
      return r.span ? n2.query(r) : [];
    });
  }
  /**
   * As with `withQuerySpan`, but the function is applied to both the
   * begin and end time of the query timespan.
   * @param {Function} func the function to apply
   * @returns Pattern
   * @noAutocomplete
   */
  withQueryTime(e) {
    return new _f2((n2) => this.query(n2.withSpan((s) => s.withTime(e))));
  }
  /**
   * Similar to `withQuerySpan`, but the function is applied to the timespans
   * of all haps returned by pattern queries (both `part` timespans, and where
   * present, `whole` timespans).
   * @param {Function} func
   * @returns Pattern
   * @noAutocomplete
   */
  withHapSpan(e) {
    return new _f2((n2) => this.query(n2).map((s) => s.withSpan(e)));
  }
  /**
   * As with `withHapSpan`, but the function is applied to both the
   * begin and end time of the hap timespans.
   * @param {Function} func the function to apply
   * @returns Pattern
   * @noAutocomplete
   */
  withHapTime(e) {
    return this.withHapSpan((n2) => n2.withTime(e));
  }
  /**
   * Returns a new pattern with the given function applied to the list of haps returned by every query.
   * @param {Function} func
   * @returns Pattern
   * @noAutocomplete
   */
  withHaps(e) {
    const n2 = new _f2((s) => e(this.query(s), s));
    return n2._steps = this._steps, n2;
  }
  /**
   * As with `withHaps`, but applies the function to every hap, rather than every list of haps.
   * @param {Function} func
   * @returns Pattern
   * @noAutocomplete
   */
  withHap(e) {
    return this.withHaps((n2) => n2.map(e));
  }
  /**
   * Returns a new pattern with the context field set to every hap set to the given value.
   * @param {*} context
   * @returns Pattern
   * @noAutocomplete
   */
  setContext(e) {
    return this.withHap((n2) => n2.setContext(e));
  }
  /**
   * Returns a new pattern with the given function applied to the context field of every hap.
   * @param {Function} func
   * @returns Pattern
   * @noAutocomplete
   */
  withContext(e) {
    const n2 = this.withHap((s) => s.setContext(e(s.context)));
    return this.__pure !== void 0 && (n2.__pure = this.__pure, n2.__pure_loc = this.__pure_loc), n2;
  }
  /**
   * Returns a new pattern with the context field of every hap set to an empty object.
   * @returns Pattern
   * @noAutocomplete
   */
  stripContext() {
    return this.withHap((e) => e.setContext({}));
  }
  /**
   * Returns a new pattern with the given location information added to the
   * context of every hap.
   * @param {Number} start start offset
   * @param {Number} end end offset
   * @returns Pattern
   * @noAutocomplete
   */
  withLoc(e, n2) {
    const s = {
      start: e,
      end: n2
    }, r = this.withContext((o) => {
      const i = (o.locations || []).concat([s]);
      return { ...o, locations: i };
    });
    return this.__pure && (r.__pure = this.__pure, r.__pure_loc = s), r;
  }
  /**
   * Returns a new Pattern, which only returns haps that meet the given test.
   * @param {Function} hap_test - a function which returns false for haps to be removed from the pattern
   * @returns Pattern
   * @example
   * s("bd*8").velocity(rand).filterHaps((h) => (h.whole.begin % 1) < h.value.velocity)
   */
  filterHaps(e) {
    return new _f2((n2) => this.query(n2).filter(e));
  }
  /**
   * As with `filterHaps`, but the function is applied to values
   * inside haps.
   * @param {Function} value_test
   * @returns Pattern
   * @example
   * const drums = s("bd sd bd sd")
   * kick: drums.filterValues((v) => v.s === 'bd').duck(2)
   * snare: drums.filterValues((v) => v.s === 'sd')
   * bass: s("saw!4").note("G#1").lpf(80).lpenv(4).orbit(2)
   */
  filterValues(e) {
    return new _f2((n2) => this.query(n2).filter((s) => e(s.value))).setSteps(this._steps);
  }
  /**
   * Returns a new pattern, with haps containing undefined values removed from
   * query results.
   * @returns Pattern
   * @noAutocomplete
   */
  removeUndefineds() {
    return this.filterValues((e) => e != null);
  }
  /**
   * Returns a new pattern, with all haps without onsets filtered out. A hap
   * with an onset is one with a `whole` timespan that begins at the same time
   * as its `part` timespan.
   * @returns Pattern
   * @noAutocomplete
   */
  onsetsOnly() {
    return this.filterHaps((e) => e.hasOnset());
  }
  /**
   * Returns a new pattern, with 'continuous' haps (those without 'whole'
   * timespans) removed from query results.
   * @returns Pattern
   * @noAutocomplete
   */
  discreteOnly() {
    return this.filterHaps((e) => e.whole);
  }
  /**
   * Combines adjacent haps with the same value and whole.  Only
   * intended for use in tests.
   * @noAutocomplete
   */
  defragmentHaps() {
    return this.discreteOnly().withHaps((n2) => {
      const s = [];
      for (var r = 0; r < n2.length; ++r) {
        for (var o = true, i = n2[r]; o; ) {
          const p = JSON.stringify(n2[r].value);
          for (var a = false, u2 = r + 1; u2 < n2.length; u2++) {
            const h = n2[u2];
            if (i.whole.equals(h.whole)) {
              if (i.part.begin.eq(h.part.end)) {
                if (p === JSON.stringify(h.value)) {
                  i = new S(i.whole, new B(h.part.begin, i.part.end), i.value), n2.splice(u2, 1), a = true;
                  break;
                }
              } else if (h.part.begin.eq(i.part.end) && p == JSON.stringify(h.value)) {
                i = new S(i.whole, new B(i.part.begin, h.part.end), i.value), n2.splice(u2, 1), a = true;
                break;
              }
            }
          }
          o = a;
        }
        s.push(i);
      }
      return s;
    });
  }
  /**
   * Queries the pattern for the first cycle, returning Haps. Mainly of use when
   * debugging a pattern.
   * @param {Boolean} with_context - set to true, otherwise the context field
   * will be stripped from the resulting haps.
   * @returns [Hap]
   * @noAutocomplete
   */
  firstCycle(e = false) {
    var n2 = this;
    return e || (n2 = n2.stripContext()), n2.query(new ut(new B(m(0), m(1))));
  }
  /**
   * Accessor for a list of values returned by querying the first cycle.
   * @noAutocomplete
   */
  get firstCycleValues() {
    return this.firstCycle().map((e) => e.value);
  }
  /**
   * More human-readable version of the `firstCycleValues` accessor.
   * @noAutocomplete
   */
  get showFirstCycle() {
    return this.firstCycle().map(
      (e) => `${e.value}: ${e.whole.begin.toFraction()} - ${e.whole.end.toFraction()}`
    );
  }
  /**
   * Returns a new pattern, which returns haps sorted in temporal order. Mainly
   * of use when comparing two patterns for equality, in tests.
   * @returns Pattern
   * @noAutocomplete
   */
  sortHapsByPart() {
    return this.withHaps(
      (e) => e.sort(
        (n2, s) => n2.part.begin.sub(s.part.begin).or(n2.part.end.sub(s.part.end)).or(n2.whole.begin.sub(s.whole.begin).or(n2.whole.end.sub(s.whole.end)))
      )
    );
  }
  asNumber() {
    return this.fmap(ce);
  }
  //////////////////////////////////////////////////////////////////////
  // Operators - see 'make composers' later..
  _opIn(e, n2) {
    return this.fmap(n2).appLeft(d(e));
  }
  _opOut(e, n2) {
    return this.fmap(n2).appRight(d(e));
  }
  _opMix(e, n2) {
    return this.fmap(n2).appBoth(d(e));
  }
  _opSqueeze(e, n2) {
    const s = d(e);
    return this.fmap((r) => s.fmap((o) => n2(r)(o))).squeezeJoin();
  }
  _opSqueezeOut(e, n2) {
    const s = this;
    return d(e).fmap((o) => s.fmap((i) => n2(i)(o))).squeezeJoin();
  }
  _opReset(e, n2) {
    return d(e).fmap((r) => this.fmap((o) => n2(o)(r))).resetJoin();
  }
  _opRestart(e, n2) {
    return d(e).fmap((r) => this.fmap((o) => n2(o)(r))).restartJoin();
  }
  _opPoly(e, n2) {
    const s = d(e);
    return this.fmap((r) => s.fmap((o) => n2(o)(r))).polyJoin();
  }
  //////////////////////////////////////////////////////////////////////
  // End-user methods.
  // Those beginning with an underscore (_) are 'patternified',
  // i.e. versions are created without the underscore, that are
  // magically transformed to accept patterns for all their arguments.
  //////////////////////////////////////////////////////////////////////
  // Methods without corresponding toplevel functions
  /**
   * Layers the result of the given function(s). Like `superimpose`, but without the original pattern:
   * @name layer
   * @memberof Pattern
   * @synonyms apply
   * @returns Pattern
   * @example
   * "<0 2 4 6 ~ 4 ~ 2 0!3 ~!5>*8"
   *   .layer(x=>x.add("0,2"))
   *   .scale('C minor').note()
   */
  layer(...e) {
    return z(...e.map((n2) => n2(this)));
  }
  /**
   * Superimposes the result of the given function(s) on top of the original pattern:
   * @name superimpose
   * @memberof Pattern
   * @returns Pattern
   * @example
   * "<0 2 4 6 ~ 4 ~ 2 0!3 ~!5>*8"
   *   .superimpose(x=>x.add(2))
   *   .scale('C minor').note()
   */
  superimpose(...e) {
    return this.stack(...e.map((n2) => n2(this)));
  }
  //////////////////////////////////////////////////////////////////////
  // Multi-pattern functions
  stack(...e) {
    return z(this, ...e);
  }
  sequence(...e) {
    return Q(this, ...e);
  }
  seq(...e) {
    return Q(this, ...e);
  }
  cat(...e) {
    return mt(this, ...e);
  }
  fastcat(...e) {
    return N(this, ...e);
  }
  slowcat(...e) {
    return Z(this, ...e);
  }
  //////////////////////////////////////////////////////////////////////
  // Context methods - ones that deal with metadata
  onTrigger(e, n2 = true) {
    return this.withHap(
      (s) => s.setContext({
        ...s.context,
        onTrigger: (...r) => {
          s.context.onTrigger?.(...r), e(...r);
        },
        // if dominantTrigger is set to true, the default output (webaudio) will be disabled
        // when using multiple triggers, you cannot flip this flag to false again!
        // example: x.csound('CooLSynth').log() as well as x.log().csound('CooLSynth') should work the same
        dominantTrigger: s.context.dominantTrigger || n2
      })
    );
  }
  /**
   * Writes the content of the current event to the console (visible in the side menu).
   * @name log
   * @memberof Pattern
   * @example
   * s("bd sd").log()
   */
  log(e = (s) => `[hap] ${s.showWhole(true)}`, n2 = (s) => ({ hap: s })) {
    return this.onTrigger((...s) => {
      E(e(...s), void 0, n2(...s));
    }, false);
  }
  /**
   * A simplified version of `log` which writes all "values" (various configurable parameters)
   * within the event to the console (visible in the side menu).
   * @name logValues
   * @memberof Pattern
   * @example
   * s("bd sd").gain("0.25 0.5 1").n("2 1 0").logValues()
   */
  logValues(e = (n2) => `[hap] ${ae(n2, true)}`) {
    return this.log((n2) => e(n2.value));
  }
  //////////////////////////////////////////////////////////////////////
  // Visualisation
  drawLine() {
    return console.log(Cn(this)), this;
  }
  //////////////////////////////////////////////////////////////////////
  // methods relating to breaking patterns into subcycles
  // Breaks a pattern into a pattern of patterns, according to the structure of the given binary pattern.
  unjoin(e, n2 = ot) {
    return e.withHap(
      (s) => s.withValue((r) => r ? n2(this.ribbon(s.whole.begin, s.whole.duration)) : this)
    );
  }
  /**
   * Breaks a pattern into pieces according to the structure of a given pattern.
   * True values in the given pattern cause the corresponding subcycle of the
   * source pattern to be looped, and for an (optional) given function to be
   * applied. False values result in the corresponding part of the source pattern
   * to be played unchanged.
   * @name into
   * @memberof Pattern
   * @example
   * sound("bd sd ht lt").into("1 0", hurry(2))
   */
  into(e, n2) {
    return this.unjoin(e, n2).innerJoin();
  }
};
function zn(t, e) {
  let n2 = [];
  return e.forEach((s) => {
    const r = n2.findIndex(([o]) => t(s, o));
    r === -1 ? n2.push([s]) : n2[r].push(s);
  }), n2;
}
var Mn = (t, e) => t.spanEquals(e);
f.prototype.collect = function() {
  return this.withHaps(
    (t) => zn(Mn, t).map((e) => new S(e[0].whole, e[0].part, e, {}))
  );
};
var yh = l("arpWith", (t, e) => e.collect().fmap((n2) => d(t(n2))).innerJoin().withHap((n2) => new S(n2.whole, n2.part, n2.value.value, n2.combineContext(n2.value))));
var wh = l(
  "arp",
  (t, e) => e.arpWith((n2) => d(t).fmap((s) => n2[s % n2.length])),
  false
);
function dt(t) {
  return !Array.isArray(t) && typeof t == "object" && !An(t);
}
function Pn(t, e, n2) {
  return dt(t) || dt(e) ? (dt(t) || (t = { value: t }), dt(e) || (e = { value: e }), Tn(t, e, n2)) : n2(t, e);
}
(function() {
  const t = {
    set: [(n2, s) => s],
    keep: [(n2) => n2],
    keepif: [(n2, s) => s ? n2 : void 0],
    // numerical functions
    /**
     *
     * Assumes a pattern of numbers. Adds the given number to each item in the pattern.
     * @name add
     * @memberof Pattern
     * @example
     * // Here, the triad 0, 2, 4 is shifted by different amounts
     * n("0 2 4".add("<0 3 4 0>")).scale("C:major")
     * // Without add, the equivalent would be:
     * // n("<[0 2 4] [3 5 7] [4 6 8] [0 2 4]>").scale("C:major")
     * @example
     * // You can also use add with notes:
     * note("c3 e3 g3".add("<0 5 7 0>"))
     * // Behind the scenes, the notes are converted to midi numbers:
     * // note("48 52 55".add("<0 5 7 0>"))
     */
    add: [L((n2, s) => n2 + s)],
    // support string concatenation
    /**
     *
     * Like add, but the given numbers are subtracted.
     * @name sub
     * @memberof Pattern
     * @example
     * n("0 2 4".sub("<0 1 2 3>")).scale("C4:minor")
     * // See add for more information.
     */
    sub: [L((n2, s) => n2 - s)],
    /**
     *
     * Multiplies each number by the given factor.
     * @name mul
     * @memberof Pattern
     * @example
     * "<1 1.5 [1.66, <2 2.33>]>*4".mul(150).freq()
     */
    mul: [L((n2, s) => n2 * s)],
    /**
     *
     * Divides each number by the given factor.
     * @name div
     * @memberof Pattern
     */
    div: [L((n2, s) => n2 / s)],
    mod: [L(bt)],
    pow: [L(Math.pow)],
    log2: [L(Math.log2)],
    band: [L((n2, s) => n2 & s)],
    bor: [L((n2, s) => n2 | s)],
    bxor: [L((n2, s) => n2 ^ s)],
    blshift: [L((n2, s) => n2 << s)],
    brshift: [L((n2, s) => n2 >> s)],
    // TODO - force numerical comparison if both look like numbers?
    lt: [(n2, s) => n2 < s],
    gt: [(n2, s) => n2 > s],
    lte: [(n2, s) => n2 <= s],
    gte: [(n2, s) => n2 >= s],
    eq: [(n2, s) => n2 == s],
    eqt: [(n2, s) => n2 === s],
    ne: [(n2, s) => n2 != s],
    net: [(n2, s) => n2 !== s],
    and: [(n2, s) => n2 && s],
    or: [(n2, s) => n2 || s],
    //  bitwise ops
    func: [(n2, s) => s(n2)]
  }, e = ["In", "Out", "Mix", "Squeeze", "SqueezeOut", "Reset", "Restart", "Poly"];
  for (const [n2, [s, r]] of Object.entries(t)) {
    f.prototype["_" + n2] = function(o) {
      return this.fmap((i) => s(i, o));
    }, Object.defineProperty(f.prototype, n2, {
      // a getter that returns a function, so 'pat' can be
      // accessed by closures that are methods of that function..
      get: function() {
        const o = this, i = (...a) => o[n2].in(...a);
        for (const a of e)
          i[a.toLowerCase()] = function(...u2) {
            var p = o;
            u2 = Q(u2), r && (p = r(p), u2 = r(u2));
            var h;
            return n2 === "keepif" ? (h = p["_op" + a](u2, (y2) => (g) => s(y2, g)), h = h.removeUndefineds()) : h = p["_op" + a](u2, (y2) => (g) => Pn(y2, g, s)), h;
          };
        return i.squeezein = i.squeeze, i;
      }
    });
    for (const o of e)
      f.prototype[o.toLowerCase()] = function(...i) {
        return this.set[o.toLowerCase()](i);
      };
  }
  f.prototype.struct = function(...n2) {
    return this.keepif.out(...n2);
  }, f.prototype.structAll = function(...n2) {
    return this.keep.out(...n2);
  }, f.prototype.mask = function(...n2) {
    return this.keepif.in(...n2);
  }, f.prototype.maskAll = function(...n2) {
    return this.keep.in(...n2);
  }, f.prototype.reset = function(...n2) {
    return this.keepif.reset(...n2);
  }, f.prototype.resetAll = function(...n2) {
    return this.keep.reset(...n2);
  }, f.prototype.restart = function(...n2) {
    return this.keepif.restart(...n2);
  }, f.prototype.restartAll = function(...n2) {
    return this.keep.restart(...n2);
  };
})();
var gh = z;
var bh = z;
var _h = $t;
var pt = (t) => new f(() => [], t);
var q = pt(1);
var R = pt(0);
function C(t) {
  function e(s) {
    return s.span.spanCycles.map((r) => new S(m(r.begin).wholeCycle(), r, t));
  }
  const n2 = new f(e, 1);
  return n2.__pure = t, n2;
}
function pe(t) {
  return t instanceof f || t?._Pattern;
}
function d(t) {
  return pe(t) ? t : Ct && typeof t == "string" ? Ct(t) : C(t);
}
function En(t) {
  let e = C([]);
  for (const n2 of t)
    e = e.bind((s) => n2.fmap((r) => s.concat([r])));
  return e;
}
function z(...t) {
  t = t.map((s) => Array.isArray(s) ? Q(...s) : d(s));
  const e = (s) => G(t.map((r) => r.query(s))), n2 = new f(e);
  return J && (n2._steps = Y(...t.map((s) => s._steps))), n2;
}
function Et(t, e) {
  if (e = e.map((o) => Array.isArray(o) ? Q(...o) : d(o)), e.length === 0)
    return q;
  if (e.length === 1)
    return e[0];
  const [n2, ...s] = e.map((o) => o._steps), r = J ? n2.maximum(...s) : void 0;
  return z(...t(r, e));
}
function jn(...t) {
  return Et(
    (e, n2) => n2.map((s) => s._steps.eq(e) ? s : $(s, pt(e.sub(s._steps)))),
    t
  );
}
function Jn(...t) {
  return Et(
    (e, n2) => n2.map((s) => s._steps.eq(e) ? s : $(pt(e.sub(s._steps)), s)),
    t
  );
}
function $n(...t) {
  return Et(
    (e, n2) => n2.map((s) => {
      if (s._steps.eq(e))
        return s;
      const r = pt(e.sub(s._steps).div(2));
      return $(r, s, r);
    }),
    t
  );
}
function vh(t, ...e) {
  const [n2, ...s] = e.map((i) => i._steps), r = n2.maximum(...s), o = {
    centre: $n,
    left: jn,
    right: Jn,
    expand: z,
    repeat: (...i) => $t(...i).steps(r)
  };
  return t.inhabit(o).fmap((i) => i(...e)).innerJoin().setSteps(r);
}
function Z(...t) {
  if (t = t.map((s) => Array.isArray(s) ? N(...s) : d(s)), t.length == 1)
    return t[0];
  const e = function(s) {
    const r = s.span, o = bt(r.begin.sam(), t.length), i = t[o];
    if (!i)
      return [];
    const a = r.begin.floor().sub(r.begin.div(t.length).floor());
    return i.withHapTime((u2) => u2.add(a)).query(s.setSpan(r.withTime((u2) => u2.sub(a))));
  }, n2 = J ? Y(...t.map((s) => s._steps)) : void 0;
  return new f(e).splitQueries().setSteps(n2);
}
function fe(...t) {
  t = t.map(d);
  const e = function(n2) {
    const s = Math.floor(n2.span.begin) % t.length;
    return t[s]?.query(n2) || [];
  };
  return new f(e).splitQueries();
}
function mt(...t) {
  return Z(...t);
}
function kh(...t) {
  const e = t.reduce((n2, [s]) => n2 + s, 0);
  return t = t.map(([n2, s]) => [n2, s.fast(n2)]), $(...t).slow(e);
}
function qh(...t) {
  let e = m(0);
  for (let n2 of t)
    n2.length == 2 && n2.unshift(e), e = n2[1];
  return z(
    ...t.map(
      ([n2, s, r]) => C(d(r)).compress(m(n2).div(e), m(s).div(e))
    )
  ).slow(e).innerJoin();
}
function N(...t) {
  let e = Z(...t);
  return t.length > 1 && (e = e._fast(t.length), e._steps = t.length), t.length == 1 && t[0].__steps_source && (t._steps = t[0]._steps), e;
}
function Q(...t) {
  return N(...t);
}
function Nn(...t) {
  return N(...t);
}
function xt(t) {
  return Array.isArray(t) ? t.length == 0 ? [q, 0] : t.length == 1 ? xt(t[0]) : [N(...t.map((e) => xt(e)[0])), t.length] : [d(t), 1];
}
var Sh = w((t, e) => d(e).mask(t));
var Ah = w((t, e) => d(e).struct(t));
var Th = w((t, e) => d(e).superimpose(...t));
var Ch = w((t, e) => d(e).withValue(t));
var xh = w((t, e) => d(e).bind(t));
var Bh = w((t, e) => d(e).innerBind(t));
var Oh = w((t, e) => d(e).outerBind(t));
var zh = w((t, e) => d(e).squeezeBind(t));
var Mh = w((t, e) => d(e).stepBind(t));
var Ph = w((t, e) => d(e).polyBind(t));
var Eh = w((t, e) => d(e).set(t));
var jh = w((t, e) => d(e).keep(t));
var Jh = w((t, e) => d(e).keepif(t));
var $h = w((t, e) => d(e).add(t));
var Nh = w((t, e) => d(e).sub(t));
var Lh = w((t, e) => d(e).mul(t));
var Rh = w((t, e) => d(e).div(t));
var Wh = w((t, e) => d(e).mod(t));
var Fh = w((t, e) => d(e).pow(t));
var Ih = w((t, e) => d(e).band(t));
var Vh = w((t, e) => d(e).bor(t));
var Hh = w((t, e) => d(e).bxor(t));
var Dh = w((t, e) => d(e).blshift(t));
var Gh = w((t, e) => d(e).brshift(t));
var Qh = w((t, e) => d(e).lt(t));
var Uh = w((t, e) => d(e).gt(t));
var Xh = w((t, e) => d(e).lte(t));
var Kh = w((t, e) => d(e).gte(t));
var Yh = w((t, e) => d(e).eq(t));
var Zh = w((t, e) => d(e).eqt(t));
var td = w((t, e) => d(e).ne(t));
var ed = w((t, e) => d(e).net(t));
var nd = w((t, e) => d(e).and(t));
var sd = w((t, e) => d(e).or(t));
var rd = w((t, e) => d(e).func(t));
function l(t, e, n2 = true, s = false, r = (o) => o.innerJoin()) {
  if (Array.isArray(t)) {
    const u2 = {};
    for (const p of t)
      u2[p] = l(p, e, n2, s, r);
    return u2;
  }
  const o = e.length;
  var i;
  n2 ? i = function(...u2) {
    u2 = u2.map(d);
    const p = u2[u2.length - 1];
    let h;
    if (o === 1)
      h = e(p);
    else {
      const y2 = u2.slice(0, -1);
      if (y2.every((g) => g.__pure != null)) {
        const g = y2.map((_4) => _4.__pure), v = y2.filter((_4) => _4.__pure_loc).map((_4) => _4.__pure_loc);
        h = e(...g, p), h = h.withContext((_4) => {
          const O = (_4.locations || []).concat(v);
          return { ..._4, locations: O };
        });
      } else {
        const [g, ...v] = y2;
        let _4 = (...O) => e(...O, p);
        _4 = w(_4, null, o - 1), h = r(v.reduce((O, A2) => O.appLeft(A2), g.fmap(_4)));
      }
    }
    return s && (h._steps = p._steps), h;
  } : i = function(...u2) {
    u2 = u2.map(d);
    const p = e(...u2);
    return s && (p._steps = u2[u2.length - 1]._steps), p;
  }, f.prototype[t] = function(...u2) {
    if (o === 2 && u2.length !== 1)
      u2 = [Q(...u2)];
    else if (o !== u2.length + 1)
      throw new Error(`.${t}() expects ${o - 1} inputs but got ${u2.length}.`);
    return u2 = u2.map(d), i(...u2, this);
  }, o > 1 && (f.prototype["_" + t] = function(...u2) {
    const p = e(...u2, this);
    return s && p.setSteps(this._steps), p;
  });
  const a = w(i, null, o);
  return le[t] = a, a;
}
function et(t, e, n2 = true, s = false, r = (o) => o.stepJoin()) {
  return l(t, e, n2, s, r);
}
var od = l("round", function(t) {
  return t.asNumber().fmap((e) => Math.round(e));
});
var cd = l("floor", function(t) {
  return t.asNumber().fmap((e) => Math.floor(e));
});
var id = l("ceil", function(t) {
  return t.asNumber().fmap((e) => Math.ceil(e));
});
var ud = l("toBipolar", function(t) {
  return t.fmap((e) => e * 2 - 1);
});
var ad = l("fromBipolar", function(t) {
  return t.fmap((e) => (e + 1) / 2);
});
var ld = l("range", function(t, e, n2) {
  return n2.mul(e - t).add(t);
});
var pd = l("rangex", function(t, e, n2) {
  return n2._range(Math.log(t), Math.log(e)).fmap(Math.exp);
});
var fd = l("range2", function(t, e, n2) {
  return n2.fromBipolar()._range(t, e);
});
var hd = l(
  "ratio",
  (t) => t.fmap((e) => Array.isArray(e) ? e.slice(1).reduce((n2, s) => n2 / s, e[0]) : e)
);
var dd = l("compress", function(t, e, n2) {
  return t = m(t), e = m(e), t.gt(e) || t.gt(1) || e.gt(1) || t.lt(0) || e.lt(0) ? q : n2._fastGap(m(1).div(e.sub(t)))._late(t);
});
var { compressSpan: md, compressspan: yd } = l(["compressSpan", "compressspan"], function(t, e) {
  return e._compress(t.begin, t.end);
});
var { fastGap: wd, fastgap: gd } = l(["fastGap", "fastgap"], function(t, e) {
  const n2 = function(r) {
    const o = r.begin.sam(), i = r.begin.sub(o).mul(t).min(1), a = r.end.sub(o).mul(t).min(1);
    if (!(i >= 1))
      return new B(o.add(i), o.add(a));
  }, s = function(r) {
    const o = r.part.begin, i = r.part.end, a = o.sam(), u2 = o.sub(a).div(t).min(1), p = i.sub(a).div(t).min(1), h = new B(a.add(u2), a.add(p)), y2 = r.whole ? new B(
      h.begin.sub(o.sub(r.whole.begin).div(t)),
      h.end.add(r.whole.end.sub(i).div(t))
    ) : void 0;
    return new S(y2, h, r.value, r.context);
  };
  return e.withQuerySpanMaybe(n2).withHap(s).splitQueries();
});
var bd = l("focus", function(t, e, n2) {
  return t = m(t), e = m(e), n2._early(t.sam())._fast(m(1).div(e.sub(t)))._late(t);
});
var { focusSpan: _d, focusspan: vd } = l(["focusSpan", "focusspan"], function(t, e) {
  return e._focus(t.begin, t.end);
});
var kd = l("ply", function(t, e) {
  const n2 = e.fmap((s) => C(s)._fast(t)).squeezeJoin();
  return J && (n2._steps = m(t).mulmaybe(e._steps)), n2;
});
var { fast: qd, density: Sd } = l(
  ["fast", "density"],
  function(t, e) {
    return t === 0 ? q : (t = m(t), e.withQueryTime((s) => s.mul(t)).withHapTime((s) => s.div(t)).setSteps(e._steps));
  },
  true,
  true
);
var Ad = l("hurry", function(t, e) {
  return e._fast(t).mul(C({ speed: t }));
});
var { slow: Td, sparsity: Cd } = l(["slow", "sparsity"], function(t, e) {
  return t === 0 ? q : e._fast(m(1).div(t));
});
var xd = l("inside", function(t, e, n2) {
  return e(n2._slow(t))._fast(t);
});
var Bd = l("outside", function(t, e, n2) {
  return e(n2._fast(t))._slow(t);
});
var Od = l("lastOf", function(t, e, n2) {
  const s = Array(t - 1).fill(n2);
  return s.push(e(n2)), fe(...s);
});
var { firstOf: zd, every: Md } = l(["firstOf", "every"], function(t, e, n2) {
  const s = Array(t - 1).fill(n2);
  return s.unshift(e(n2)), fe(...s);
});
var Pd = l("apply", function(t, e) {
  return t(e);
});
var Ed = l("cpm", function(t, e) {
  return e._fast(t / 60 / 1);
});
var jd = l(
  "early",
  function(t, e) {
    return t = m(t), e.withQueryTime((n2) => n2.add(t)).withHapTime((n2) => n2.sub(t));
  },
  true,
  true
);
var Ln = l(
  "late",
  function(t, e) {
    return t = m(t), e._early(m(0).sub(t));
  },
  true,
  true
);
var Jd = l("zoom", function(t, e, n2) {
  if (e = m(e), t = m(t), t.gte(e))
    return R;
  const s = e.sub(t), r = J ? n2._steps?.mulmaybe(s) : void 0;
  return n2.withQuerySpan((o) => o.withCycle((i) => i.mul(s).add(t))).withHapSpan((o) => o.withCycle((i) => i.sub(t).div(s))).splitQueries().setSteps(r);
});
var { zoomArc: $d, zoomarc: Nd } = l(["zoomArc", "zoomarc"], function(t, e) {
  return e.zoom(t.begin, t.end);
});
var Ld = l(
  "bite",
  (t, e, n2) => e.fmap((s) => (r) => {
    const o = m(s).div(r).mod(1), i = o.add(m(1).div(r));
    return n2.zoom(o, i);
  }).appLeft(t).squeezeJoin(),
  false
);
var Rd = l(
  "linger",
  function(t, e) {
    return t == 0 ? q : t < 0 ? e._zoom(t.add(1), 1)._slow(t) : e._zoom(0, t)._slow(t);
  },
  true,
  true
);
var { segment: Wd, seg: Fd } = l(["segment", "seg"], function(t, e) {
  return e.struct(C(true)._fast(t)).setSteps(t);
});
var Id = l("swingBy", (t, e, n2) => n2.inside(e, Ln(Nn(0, t / 2))));
var Vd = l("swing", (t, e) => e.swingBy(1 / 3, t));
var { invert: Hd, inv: Dd } = l(
  ["invert", "inv"],
  function(t) {
    return t.fmap((e) => !e);
  },
  true,
  true
);
var Gd = l("when", function(t, e, n2) {
  return t ? e(n2) : n2;
});
var Qd = l("off", function(t, e, n2) {
  return z(n2, e(n2.late(t)));
});
var Ud = l("brak", function(t) {
  return t.when(Z(false, true), (e) => N(e, q)._late(0.25));
});
var Rn = l(
  "rev",
  function(t) {
    const e = function(n2) {
      const s = n2.span, r = s.begin.sam(), o = s.begin.nextSam(), i = function(u2) {
        const p = u2.withTime((y2) => r.add(o.sub(y2))), h = p.begin;
        return p.begin = p.end, p.end = h, p;
      };
      return t.query(n2.setSpan(i(s))).map((u2) => u2.withSpan(i));
    };
    return new f(e).splitQueries();
  },
  false,
  true
);
var Xd = l("revv", function(t) {
  const e = (n2) => new B(m(0).sub(n2.end), m(0).sub(n2.begin));
  return t.withQuerySpan(e).withHapSpan(e);
});
var Kd = l("pressBy", function(t, e) {
  return e.fmap((n2) => C(n2).compress(t, 1)).squeezeJoin();
});
var Yd = l("press", function(t) {
  return t._pressBy(0.5);
});
f.prototype.hush = function() {
  return q;
};
var Zd = l(
  "palindrome",
  function(t) {
    return t.lastOf(2, Rn);
  },
  true,
  true
);
var { juxBy: tm, juxby: em } = l(["juxBy", "juxby"], function(t, e, n2) {
  t /= 2;
  const s = function(i, a, u2) {
    return a in i ? i[a] : u2;
  }, r = n2.withValue((i) => Object.assign({}, i, { pan: s(i, "pan", 0.5) - t })), o = e(n2.withValue((i) => Object.assign({}, i, { pan: s(i, "pan", 0.5) + t })));
  return z(r, o).setSteps(J ? Y(r._steps, o._steps) : void 0);
});
var nm = l("jux", function(t, e) {
  return e._juxBy(1, t, e);
});
var { echoWith: sm, echowith: rm, stutWith: om, stutwith: cm } = l(
  ["echoWith", "echowith", "stutWith", "stutwith"],
  function(t, e, n2, s) {
    return z(..._t(0, t - 1).map((r) => n2(s.late(m(e).mul(r)), r)));
  }
);
var im = l("echo", function(t, e, n2, s) {
  return s._echoWith(t, e, (r, o) => r.gain(Math.pow(n2, o)));
});
var um = l("stut", function(t, e, n2, s) {
  return s._echoWith(t, n2, (r, o) => r.gain(Math.pow(e, o)));
});
var Wn = l("applyN", function(t, e, n2) {
  let s = n2;
  for (let r = 0; r < t; r++)
    s = e(s);
  return s;
});
var am = l(["plyWith", "plywith"], function(t, e, n2) {
  const s = n2.fmap((r) => mt(..._t(0, t - 1).map((o) => Wn(o, e, r)))._fast(t)).squeezeJoin();
  return J && (s._steps = m(t).mulmaybe(n2._steps)), s;
});
var lm = l(["plyForEach", "plyforeach"], function(t, e, n2) {
  const s = n2.fmap((r) => mt(mt(C(r), ..._t(1, t - 1).map((o) => e(C(r), o))))._fast(t)).squeezeJoin();
  return J && (s._steps = m(t).mulmaybe(n2._steps)), s;
});
var jt = function(t, e, n2 = false) {
  return t = m(t), Z(
    ..._t(0, t.sub(1)).map(
      (s) => n2 ? e.late(m(s).div(t)) : e.early(m(s).div(t))
    )
  );
};
var pm = l(
  "iter",
  function(t, e) {
    return jt(t, e, false);
  },
  true,
  true
);
var { iterBack: fm, iterback: hm } = l(
  ["iterBack", "iterback"],
  function(t, e) {
    return jt(t, e, true);
  },
  true,
  true
);
var { repeatCycles: dm } = l(
  "repeatCycles",
  function(t, e) {
    return new f(function(n2) {
      const s = n2.span.begin.sam(), r = s.div(t).sam(), o = s.sub(r);
      return n2 = n2.withSpan((i) => i.withTime((a) => a.sub(o))), e.query(n2).map((i) => i.withSpan((a) => a.withTime((u2) => u2.add(o))));
    }).splitQueries();
  },
  true,
  true
);
var Jt = function(t, e, n2, s = false, r = false) {
  const o = Array(t - 1).fill(false);
  o.unshift(true);
  const i = jt(t, Q(...o), !s);
  return r || (n2 = n2.repeatCycles(t)), n2.when(i, e);
};
var { chunk: mm, slowchunk: ym, slowChunk: wm } = l(
  ["chunk", "slowchunk", "slowChunk"],
  function(t, e, n2) {
    return Jt(t, e, n2, false, false);
  },
  true,
  true
);
var { chunkBack: gm, chunkback: bm } = l(
  ["chunkBack", "chunkback"],
  function(t, e, n2) {
    return Jt(t, e, n2, true);
  },
  true,
  true
);
var { fastchunk: _m, fastChunk: vm } = l(
  ["fastchunk", "fastChunk"],
  function(t, e, n2) {
    return Jt(t, e, n2, false, true);
  },
  true,
  true
);
var { chunkinto: km, chunkInto: qm } = l(["chunkinto", "chunkInto"], function(t, e, n2) {
  return n2.into(N(true, ...Array(t - 1).fill(false))._iterback(t), e);
});
var { chunkbackinto: Sm, chunkBackInto: Am } = l(["chunkbackinto", "chunkBackInto"], function(t, e, n2) {
  return n2.into(
    N(true, ...Array(t - 1).fill(false))._iter(t)._early(1),
    e
  );
});
var Tm = l(
  "bypass",
  function(t, e) {
    return t = !!parseInt(t), t ? q : e;
  },
  true,
  true
);
var { ribbon: Cm, rib: xm } = l(
  ["ribbon", "rib"],
  (t, e, n2) => n2.early(t).restart(C(1).slow(e))
);
var Bm = l("hsla", (t, e, n2, s, r) => r.color(`hsla(${t}turn,${e * 100}%,${n2 * 100}%,${s})`));
var Om = l("hsl", (t, e, n2, s) => s.color(`hsl(${t}turn,${e * 100}%,${n2 * 100}%)`));
f.prototype.tag = function(t) {
  return this.withContext((e) => ({ ...e, tags: (e.tags || []).concat([t]) }));
};
var zm = l("filter", (t, e) => e.withHaps((n2) => n2.filter(t)));
var Mm = l("filterWhen", (t, e) => e.filter((n2) => t(n2.whole.begin)));
var Pm = l(
  "within",
  (t, e, n2, s) => z(
    n2(s.filterWhen((r) => r.cyclePos() >= t && r.cyclePos() <= e)),
    s.filterWhen((r) => r.cyclePos() < t || r.cyclePos() > e)
  )
);
f.prototype.stepJoin = function() {
  const t = this, e = $(...Yt(Zt(t.queryArc(0, 1))))._steps, n2 = function(s) {
    const o = t.early(s.span.begin.sam()).query(s.setSpan(new B(m(0), m(1))));
    return $(...Yt(Zt(o))).query(s);
  };
  return new f(n2, e);
};
f.prototype.stepBind = function(t) {
  return this.fmap(t).stepJoin();
};
function Yt(t) {
  const e = t.filter((o, i) => i.hasSteps).reduce((o, i) => o.add(i), m(0)), n2 = lt(t.map((o, i) => i._steps)).reduce(
    (o, i) => o.add(i),
    m(0)
  ), s = e.eq(0) ? void 0 : n2.div(e);
  function r(o, i) {
    return i._steps === void 0 ? [o.mulmaybe(s), i] : [i._steps, i];
  }
  return t.map((o) => r(...o));
}
function Zt(t) {
  const e = G(t.map((r) => [r.part.begin, r.part.end])), n2 = yn([m(0), m(1), ...e]);
  return un(n2).map((r) => [
    r[1].sub(r[0]),
    z(...Fn(new B(...r), t).map((o) => o.value.withHap((i) => i.setContext(i.combineContext(o)))))
  ]);
}
function Fn(t, e) {
  return lt(e.map((n2) => In(t, n2)));
}
function In(t, e) {
  const n2 = t.intersection(e.part);
  if (n2 != null)
    return new S(e.whole, n2, e.value, e.context);
}
var Vn = l("pace", function(t, e) {
  return e._steps === void 0 ? e : e._steps.eq(m(0)) ? R : e._fast(m(t).div(e._steps)).setSteps(t);
});
function Hn(t, ...e) {
  const n2 = e.map((r) => xt(r));
  if (n2.length == 0)
    return q;
  t == 0 && (t = n2[0][1]);
  const s = [];
  for (const r of n2)
    r[1] != 0 && (t == r[1] ? s.push(r[0]) : s.push(r[0]._fast(m(t).div(m(r[1])))));
  return z(...s);
}
function $t(...t) {
  if (Array.isArray(t[0]))
    return Hn(0, ...t);
  if (t = t.filter((s) => s.hasSteps), t.length == 0)
    return q;
  const e = Y(...t.map((s) => s._steps));
  if (e.eq(m(0)))
    return R;
  const n2 = z(...t.map((s) => s.pace(e)));
  return n2._steps = e, n2;
}
function $(...t) {
  if (t.length === 0)
    return R;
  const e = (i) => Array.isArray(i) ? i : [i._steps ?? 1, i];
  if (t = t.map(e), t.find((i) => i[0] === void 0)) {
    const i = t.map((u2) => u2[0]).filter((u2) => u2 !== void 0);
    if (i.length === 0)
      return N(...t.map((u2) => u2[1]));
    if (i.length === t.length)
      return R;
    const a = i.reduce((u2, p) => u2.add(p), m(0)).div(i.length);
    for (let u2 of t)
      u2[0] === void 0 && (u2[0] = a);
  }
  if (t.length == 1)
    return d(t[0][1]).withSteps((a) => t[0][0]);
  const n2 = t.map((i) => i[0]).reduce((i, a) => i.add(a), m(0));
  let s = m(0);
  const r = [];
  for (const [i, a] of t) {
    if (m(i).eq(0))
      continue;
    const u2 = s.add(i);
    r.push(d(a)._compress(s.div(n2), u2.div(n2))), s = u2;
  }
  const o = z(...r);
  return o._steps = n2, o;
}
function Dn(...t) {
  t = t.map((r) => Array.isArray(r) ? r.map(d) : [d(r)]);
  const e = Y(...t.map((r) => m(r.length)));
  let n2 = [];
  for (let r = 0; r < e; ++r)
    n2.push(...t.map((o) => o.length == 0 ? q : o[r % o.length]));
  n2 = n2.filter((r) => r.hasSteps && r._steps > 0);
  const s = n2.reduce((r, o) => r.add(o._steps), m(0));
  return n2 = $(...n2), n2._steps = s, n2;
}
var Gn = et("take", function(t, e) {
  if (!e.hasSteps || e._steps.lte(0) || (t = m(t), t.eq(0)))
    return R;
  const n2 = t < 0;
  n2 && (t = t.abs());
  const s = t.div(e._steps);
  return s.lte(0) ? R : s.gte(1) ? e : n2 ? e.zoom(m(1).sub(s), 1) : e.zoom(0, s);
});
var Qn = et("drop", function(t, e) {
  return e.hasSteps ? (t = m(t), t.lt(0) ? e.take(e._steps.add(t)) : e.take(m(0).sub(e._steps.sub(t)))) : R;
});
var Un = et("extend", function(t, e) {
  return e.fast(t).expand(t);
});
var Em = et("replicate", function(t, e) {
  return e.repeatCycles(t).fast(t).expand(t);
});
var Xn = et("expand", function(t, e) {
  return e.withSteps((n2) => n2.mul(m(t)));
});
var Kn = et("contract", function(t, e) {
  return e.withSteps((n2) => n2.div(m(t)));
});
f.prototype.shrinklist = function(t) {
  const e = this;
  if (!e.hasSteps)
    return [e];
  let [n2, s] = Array.isArray(t) ? t : [t, e._steps];
  if (n2 = m(n2), s === 0 || n2 === 0)
    return [e];
  const r = n2 > 0, o = [];
  if (r) {
    const i = m(1).div(e._steps).mul(n2);
    for (let a = 0; a < s; ++a) {
      const u2 = i.mul(a);
      if (u2.gt(1))
        break;
      o.push([u2, 1]);
    }
  } else {
    n2 = m(0).sub(n2);
    const i = m(1).div(e._steps).mul(n2);
    for (let a = 0; a < s; ++a) {
      const u2 = m(1).sub(i.mul(a));
      if (u2.lt(0))
        break;
      o.push([m(0), u2]);
    }
  }
  return o.map((i) => e.zoom(...i));
};
var Yn = (t, e) => e.shrinklist(t);
var Zn = l(
  "shrink",
  function(t, e) {
    if (!e.hasSteps)
      return R;
    const n2 = e.shrinklist(t), s = $(...n2);
    return s._steps = n2.reduce((r, o) => r.add(o._steps), m(0)), s;
  },
  true,
  false,
  (t) => t.stepJoin()
);
var jm = l(
  "grow",
  function(t, e) {
    if (!e.hasSteps)
      return R;
    const n2 = e.shrinklist(m(0).sub(t));
    n2.reverse();
    const s = $(...n2);
    return s._steps = n2.reduce((r, o) => r.add(o._steps), m(0)), s;
  },
  true,
  false,
  (t) => t.stepJoin()
);
var ts = function(t, ...e) {
  return t.tour(...e);
};
f.prototype.tour = function(...t) {
  return $(
    ...[].concat(
      ...t.map((e, n2) => [...t.slice(0, t.length - n2), this, ...t.slice(t.length - n2)]),
      this,
      ...t
    )
  );
};
var es = function(...t) {
  t = t.filter((s) => s.hasSteps);
  const e = Z(...t.map((s) => s._slow(s._steps))), n2 = Y(...t.map((s) => s._steps));
  return e._fast(n2).setSteps(n2);
};
var Jm = $;
var ns = $;
var $m = $;
var Nm = Dn;
var Lm = $t;
f.prototype.s_polymeter = f.prototype.polymeter;
var Rm = Zn;
f.prototype.s_taper = f.prototype.shrink;
var Wm = Yn;
f.prototype.s_taperlist = f.prototype.shrinklist;
var Fm = Gn;
f.prototype.s_add = f.prototype.take;
var Im = Qn;
f.prototype.s_sub = f.prototype.drop;
var Vm = Xn;
f.prototype.s_expand = f.prototype.expand;
var Hm = Un;
f.prototype.s_extend = f.prototype.extend;
var Dm = Kn;
f.prototype.s_contract = f.prototype.contract;
var Gm = ts;
f.prototype.s_tour = f.prototype.tour;
var Qm = es;
f.prototype.s_zip = f.prototype.zip;
var Um = Vn;
f.prototype.steps = f.prototype.pace;
var Xm = l("chop", function(t, e) {
  const s = Array.from({ length: t }, (i, a) => a).map((i) => ({ begin: i / t, end: (i + 1) / t })), r = function(i, a) {
    if ("begin" in i && "end" in i && i.begin !== void 0 && i.end !== void 0) {
      const u2 = i.end - i.begin;
      a = { begin: i.begin + a.begin * u2, end: i.begin + a.end * u2 };
    }
    return Object.assign({}, i, a);
  }, o = function(i) {
    return Q(s.map((a) => r(i, a)));
  };
  return e.squeezeBind(o).setSteps(J ? m(t).mulmaybe(e._steps) : void 0);
});
var Km = l("striate", function(t, e) {
  const s = Array.from({ length: t }, (o, i) => i).map((o) => ({ begin: o / t, end: (o + 1) / t })), r = Z(...s);
  return e.set(r)._fast(t).setSteps(J ? m(t).mulmaybe(e._steps) : void 0);
});
var he = function(t, e, n2 = 0.5) {
  return e.speed(1 / t * n2).unit("c").slow(t);
};
var ss = l(
  "slice",
  function(t, e, n2) {
    return t.innerBind(
      (s) => e.outerBind(
        (r) => n2.outerBind((o) => {
          o = o instanceof Object ? o : { s: o };
          const i = Array.isArray(s) ? s[r] : r / s, a = Array.isArray(s) ? s[r + 1] : (r + 1) / s;
          return C({ begin: i, end: a, _slices: s, ...o });
        })
      )
    ).setSteps(e._steps);
  },
  false
  // turns off auto-patternification
);
f.prototype.onTriggerTime = function(t) {
  return this.onTrigger((e, n2, s, r) => {
    const o = r - n2;
    window.setTimeout(() => {
      t(e);
    }, o * 1e3);
  }, false);
};
var Ym = l(
  "splice",
  function(t, e, n2) {
    const s = ss(t, e, n2);
    return new f((r) => {
      const o = r.controls._cps || 1;
      return s.query(r).map(
        (a) => a.withValue((u2) => ({
          speed: o / u2._slices / a.whole.duration * (u2.speed || 1),
          unit: "c",
          ...u2
        }))
      );
    }).setSteps(e._steps);
  },
  false
  // turns off auto-patternification
);
var { loopAt: Zm, loopat: ty } = l(["loopAt", "loopat"], function(t, e) {
  const n2 = e._steps ? e._steps.div(t) : void 0;
  return new f((s) => he(t, e, s.controls._cps).query(s), n2);
});
var ey = l(
  "fit",
  (t) => t.withHaps(
    (e, n2) => e.map(
      (s) => s.withValue((r) => {
        const o = ("end" in r ? r.end : 1) - ("begin" in r ? r.begin : 0);
        return {
          ...r,
          speed: (n2.controls._cps || 1) / s.whole.duration * o,
          unit: "c"
        };
      })
    )
  )
);
var { loopAtCps: ny, loopatcps: sy } = l(["loopAtCps", "loopatcps"], function(t, e, n2) {
  return he(t, n2, e);
});
var ry = (t) => C(1).withValue(() => d(t())).innerJoin();
var te = (t) => t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
var rs = (t, e, n2) => {
  e = d(e), t = d(t), n2 = d(n2);
  let s = e.fmap((o) => ({ gain: te(o) })), r = e.fmap((o) => ({ gain: te(1 - o) }));
  return z(t.mul(s), n2.mul(r));
};
f.prototype.xfade = function(t, e) {
  return rs(this, t, e);
};
var os = (t) => (e, n2, s) => {
  e = m(e).mod(n2), n2 = m(n2);
  const r = e.div(n2), o = e.add(1).div(n2);
  return t(s.fmap((i) => C(i)._compress(r, o)));
};
var { beat: oy } = l(
  ["beat"],
  os((t) => t.innerJoin())
);
var de = (t, e, n2) => {
  n2 = m(n2);
  const s = m(1).div(t.length), r = (a) => {
    const u2 = [];
    for (const [p, h] of a.entries())
      h && u2.push([m(p).div(a.length), h]);
    return u2;
  }, o = Pt(
    ([a, u2], [p, h]) => {
      const y2 = n2.mul(p - a).add(a), g = y2.add(s);
      return new B(y2, g);
    },
    r(t),
    r(e)
  );
  function i(a) {
    const u2 = a.span.begin.sam(), p = a.span.cycleArc(), h = [];
    for (const y2 of o) {
      const g = y2.intersection(p);
      g !== void 0 && h.push(
        new S(
          y2.withTime((v) => v.add(u2)),
          g.withTime((v) => v.add(u2)),
          true
        )
      );
    }
    return h;
  }
  return new f(i).splitQueries();
};
var cy = (t, e, n2) => (t = d(t), e = d(e), n2 = d(n2), t.innerBind((s) => e.innerBind((r) => n2.innerBind((o) => de(s, r, o)))));
var U = function(t) {
  const e = function(n2, s) {
    const r = d(n2).fmap((o) => Array.isArray(o) ? [...o, t] : [o, 1, t]);
    return s ? s.distort(r) : C({}).distort(r);
  };
  return f.prototype[t] = function(n2) {
    return e(n2, this);
  }, e;
};
var iy = U("soft");
var uy = U("hard");
var ay = U("cubic");
var ly = U("diode");
var py = U("asym");
var fy = U("fold");
var hy = U("sinefold");
var dy = U("chebyshev");
var me = (t) => {
  let n2 = C(w((...s) => s, null, t.length));
  for (const s of t) n2 = n2.appBoth(d(s));
  return n2;
};
var vt = (t) => Array.isArray(t) ? me(t) : d(t);
f.prototype.partials = function(t) {
  return this.withValue((e) => (n2) => ({ ...e, partials: n2 })).appLeft(vt(t));
};
var my = (t) => vt(t).as("partials");
f.prototype.phases = function(t) {
  return this.withValue((e) => (n2) => ({ ...e, phases: n2 })).appLeft(vt(t));
};
var yy = (t) => vt(t).as("phases");
f.prototype.FX = function(...t) {
  return t = t.map(d), this.withValue((e) => (n2) => {
    const s = e.FX ?? [];
    return { ...e, FX: s.concat(n2) };
  }).appLeft(me(t));
};
var cs = (t) => {
  let n2 = C(w((...s) => s, null, t.length));
  for (const s of t) n2 = n2.appLeft(s);
  return n2;
};
f.prototype.worklet = function(t, ...e) {
  return e = e.map(d), this.outerBind((n2) => cs(e).withValue((s) => {
    const r = n2.workletInputs ?? [];
    return { ...n2, workletSrc: t, workletInputs: r.concat(s) };
  }));
};
var wy = (...t) => C({}).worklet(...t);
function Nt(t) {
  let e = Array.isArray(t);
  t = e ? t : [t];
  const n2 = t[0], s = (o) => {
    let i;
    if (typeof o == "object" && o.value !== void 0 && (i = { ...o }, o = o.value, delete i.value), e && Array.isArray(o)) {
      const a = i || {};
      return o.forEach((u2, p) => {
        p < t.length && (a[t[p]] = u2);
      }), a;
    } else return i ? (i[n2] = o, i) : { [n2]: o };
  }, r = function(o, i) {
    return i ? typeof o > "u" ? i.fmap(s) : i.set(d(o).withValue(s)) : d(o).withValue(s);
  };
  return f.prototype[n2] = function(o) {
    return r(o, this);
  }, r;
}
var at = /* @__PURE__ */ new Map();
function is(t) {
  return at.has(t);
}
function c(t, ...e) {
  const n2 = Array.isArray(t) ? t[0] : t;
  let s = {};
  return s[n2] = Nt(t), at.set(n2, n2), e.forEach((r) => {
    s[r] = s[n2], at.set(r, n2), f.prototype[r] = f.prototype[n2];
  }), s;
}
function V(t, e, ...n2) {
  t = Array.isArray(t) ? t : [t];
  let s = {};
  for (let r = 1; r <= e; r++) {
    let o = [...n2], i = [...t];
    if (r === 1) {
      const u2 = o.map((h) => `${h}1`), p = i.map((h) => `${h}1`);
      o = o.concat(u2).concat(p);
    } else
      o = o.map((u2) => `${u2}${r}`), i = i.map((u2) => `${u2}${r}`);
    const a = c(i, ...o);
    s = { ...s, ...a };
  }
  return s;
}
var { s: us, sound: as } = c(["s", "n", "gain"], "sound");
var { wt: ls, wavetablePosition: ps } = c("wt", "wavetablePosition");
var { wtenv: fs } = c("wtenv");
var { wtattack: hs, wtatt: ds } = c("wtattack", "wtatt");
var { wtdecay: ms, wtdec: ys } = c("wtdecay", "wtdec");
var { wtsustain: ws, wtsus: gs } = c("wtsustain", "wtsus");
var { wtrelease: bs, wtrel: _s } = c("wtrelease", "wtrel");
var { wtrate: vs } = c("wtrate");
var { wtsync: ks } = c("wtsync");
var { wtdepth: qs } = c("wtdepth");
var { wtshape: Ss } = c("wtshape");
var { wtdc: As } = c("wtdc");
var { wtskew: Ts } = c("wtskew");
var { warp: Cs, wavetableWarp: xs } = c("warp", "wavetableWarp");
var { warpattack: Bs, warpatt: Os } = c("warpattack", "warpatt");
var { warpdecay: zs, warpdec: Ms } = c("warpdecay", "warpdec");
var { warpsustain: Ps, warpsus: Es } = c("warpsustain", "warpsus");
var { warprelease: js, warprel: Js } = c("warprelease", "warprel");
var { warprate: $s } = c("warprate");
var { warpdepth: Ns } = c("warpdepth");
var { warpshape: Ls } = c("warpshape");
var { warpdc: Rs } = c("warpdc");
var { warpskew: Ws } = c("warpskew");
var { warpmode: Fs, wavetableWarpMode: Is } = c("warpmode", "wavetableWarpMode");
var { wtphaserand: Vs, wavetablePhaseRand: Hs } = c("wtphaserand", "wavetablePhaseRand");
var { warpenv: Ds } = c("warpenv");
var { warpsync: Gs } = c("warpsync");
var { source: Qs, src: Us } = c("source", "src");
var { n: Xs } = c("n");
var { note: Ks } = c(["note", "n"]);
var { accelerate: Ys } = c("accelerate");
var { velocity: Zs, vel: tr } = c("velocity", "vel");
var { gain: er } = c("gain");
var { postgain: nr } = c("postgain");
var { amp: sr } = c("amp");
var { attack: rr, att: or } = c("attack", "att");
var { fmh: cr, fmh1: ir, fmh2: ur, fmh3: ar, fmh4: lr, fmh5: pr, fmh6: fr, fmh7: hr, fmh8: dr } = V(["fmh", "fmi"], 8, "fmh");
var { fmi: mr, fmi1: yr, fmi2: wr, fmi3: gr, fmi4: br, fmi5: _r, fmi6: vr, fmi7: kr, fmi8: qr, fm: Sr, fm1: Ar, fm2: Tr, fm3: Cr, fm4: xr, fm5: Br, fm6: Or, fm7: zr, fm8: Mr } = V(["fmi", "fmh"], 8, "fm");
var { fmenv: Pr, fmenv1: Er, fmenv2: jr, fmenv3: Jr, fmenv4: $r, fmenv5: Nr, fmenv6: Lr, fmenv7: Rr, fmenv8: Wr } = V(
  "fmenv",
  8
);
var {
  fmattack: Fr,
  fmattack1: Ir,
  fmattack2: Vr,
  fmattack3: Hr,
  fmattack4: Dr,
  fmattack5: Gr,
  fmattack6: Qr,
  fmattack7: Ur,
  fmattack8: Xr,
  fmatt: Kr,
  fmatt1: Yr,
  fmatt2: Zr,
  fmatt3: to,
  fmatt4: eo,
  fmatt5: no,
  fmatt6: so,
  fmatt7: ro,
  fmatt8: oo
} = V("fmattack", 8, "fmatt");
var { fmwave: co, fmwave1: io, fmwave2: uo, fmwave3: ao, fmwave4: lo, fmwave5: po, fmwave6: fo, fmwave7: ho, fmwave8: mo } = V(
  "fmwave",
  8
);
var {
  fmdecay: yo,
  fmdecay1: wo,
  fmdecay2: go,
  fmdecay3: bo,
  fmdecay4: _o,
  fmdecay5: vo,
  fmdecay6: ko,
  fmdecay7: qo,
  fmdecay8: So,
  fmdec: Ao,
  fmdec1: To,
  fmdec2: Co,
  fmdec3: xo,
  fmdec4: Bo,
  fmdec5: Oo,
  fmdec6: zo,
  fmdec7: Mo,
  fmdec8: Po
} = V("fmdecay", 8, "fmdec");
var {
  fmsustain: Eo,
  fmsustain1: jo,
  fmsustain2: Jo,
  fmsustain3: $o,
  fmsustain4: No,
  fmsustain5: Lo,
  fmsustain6: Ro,
  fmsustain7: Wo,
  fmsustain8: Fo,
  fmsus: Io,
  fmsus1: Vo,
  fmsus2: Ho,
  fmsus3: Do,
  fmsus4: Go,
  fmsus5: Qo,
  fmsus6: Uo,
  fmsus7: Xo,
  fmsus8: Ko
} = V("fmsustain", 8, "fmsus");
var {
  fmrelease: Yo,
  fmrelease1: Zo,
  fmrelease2: tc,
  fmrelease3: ec,
  fmrelease4: nc,
  fmrelease5: sc,
  fmrelease6: rc,
  fmrelease7: oc,
  fmrelease8: cc,
  fmrel: ic,
  fmrel1: uc,
  fmrel2: ac,
  fmrel3: lc,
  fmrel4: pc,
  fmrel5: fc,
  fmrel6: hc,
  fmrel7: dc,
  fmrel8: mc
} = V("fmrelease", 8, "fmrel");
for (let t = 0; t <= 8; t++)
  for (let e = 0; e <= 8; e++)
    c(`fmi${t}${e}`, `fm${t}${e}`);
var { bank: yc } = c("bank");
var { chorus: wc } = c("chorus");
var { analyze: gc } = c("analyze");
var { fft: bc } = c("fft");
var { decay: _c, dec: vc } = c("decay", "dec");
var { sustain: kc, sus: qc } = c("sustain", "sus");
var { release: Sc, rel: Ac } = c("release", "rel");
var { hold: Tc } = c("hold");
var { bandf: Cc, bpf: xc, bp: Bc } = c(["bandf", "bandq", "bpenv"], "bpf", "bp");
var { bandq: Oc, bpq: zc } = c("bandq", "bpq");
var { begin: Mc } = c("begin");
var { end: Pc } = c("end");
var { loop: Ec } = c("loop");
var { loopBegin: jc, loopb: Jc } = c("loopBegin", "loopb");
var { loopEnd: $c, loope: Nc } = c("loopEnd", "loope");
var { crush: Lc } = c("crush");
var { coarse: Rc } = c("coarse");
var { tremolo: Wc, trem: Fc } = c(["tremolo", "tremolodepth", "tremoloskew", "tremolophase"], "trem");
var { tremolosync: Ic } = c(
  ["tremolosync", "tremolodepth", "tremoloskew", "tremolophase"],
  "tremsync"
);
var { tremolodepth: Vc } = c("tremolodepth", "tremdepth");
var { tremoloskew: Hc } = c("tremoloskew", "tremskew");
var { tremolophase: Dc } = c("tremolophase", "tremphase");
var { tremoloshape: Gc } = c("tremoloshape", "tremshape");
var { drive: Qc } = c("drive");
var { duck: Uc } = c("duckorbit", "duck");
var { duckdepth: Xc } = c("duckdepth");
var { duckonset: Kc } = c("duckonset", "duckons");
var { duckattack: Yc } = c("duckattack", "duckatt");
var { byteBeatExpression: Zc, bbexpr: ti } = c("byteBeatExpression", "bbexpr");
var { byteBeatStartTime: ei, bbst: ni } = c("byteBeatStartTime", "bbst");
var { channels: si, ch: ri } = c("channels", "ch");
var { pw: oi } = c(["pw", "pwrate", "pwsweep"]);
var { pwrate: ci } = c("pwrate");
var { pwsweep: ii } = c("pwsweep");
var { phaserrate: ui, ph: ai, phaser: li } = c(
  ["phaserrate", "phaserdepth", "phasercenter", "phasersweep"],
  "ph",
  "phaser"
);
var { phasersweep: pi, phs: fi } = c("phasersweep", "phs");
var { phasercenter: hi, phc: di } = c("phasercenter", "phc");
var { phaserdepth: mi, phd: yi, phasdp: wi } = c("phaserdepth", "phd", "phasdp");
var { channel: gi } = c("channel");
var { cut: bi } = c("cut");
var { cutoff: _i, ctf: vi, lpf: ki, lp: qi } = c(["cutoff", "resonance", "lpenv"], "ctf", "lpf", "lp");
var { lpenv: Si, lpe: Ai } = c("lpenv", "lpe");
var { hpenv: Ti, hpe: Ci } = c("hpenv", "hpe");
var { bpenv: xi, bpe: Bi } = c("bpenv", "bpe");
var { lpattack: Oi, lpa: zi } = c("lpattack", "lpa");
var { hpattack: Mi, hpa: Pi } = c("hpattack", "hpa");
var { bpattack: Ei, bpa: ji } = c("bpattack", "bpa");
var { lpdecay: Ji, lpd: $i } = c("lpdecay", "lpd");
var { hpdecay: Ni, hpd: Li } = c("hpdecay", "hpd");
var { bpdecay: Ri, bpd: Wi } = c("bpdecay", "bpd");
var { lpsustain: Fi, lps: Ii } = c("lpsustain", "lps");
var { hpsustain: Vi, hps: Hi } = c("hpsustain", "hps");
var { bpsustain: Di, bps: Gi } = c("bpsustain", "bps");
var { lprelease: Qi, lpr: Ui } = c("lprelease", "lpr");
var { hprelease: Xi, hpr: Ki } = c("hprelease", "hpr");
var { bprelease: Yi, bpr: Zi } = c("bprelease", "bpr");
var { ftype: tu } = c("ftype");
var { fanchor: eu } = c("fanchor");
var { lprate: nu } = c("lprate");
var { lpsync: su } = c("lpsync");
var { lpdepth: ru } = c("lpdepth");
var { lpdepthfrequency: ou, lpdepthfreq: cu } = c("lpdepthfrequency", "lpdepthfreq");
var { lpshape: iu } = c("lpshape");
var { lpdc: uu } = c("lpdc");
var { lpskew: au } = c("lpskew");
var { bprate: lu } = c("bprate");
var { bpsync: pu } = c("bpsync");
var { bpdepth: fu } = c("bpdepth");
var { bpdepthfrequency: hu, bpdepthfreq: du } = c("bpdepthfrequency", "bpdepthfreq");
var { bpshape: mu } = c("bpshape");
var { bpdc: yu } = c("bpdc");
var { bpskew: wu } = c("bpskew");
var { hprate: gu } = c("hprate");
var { hpsync: bu } = c("hpsync");
var { hpdepth: _u } = c("hpdepth");
var { hpdepthfrequency: vu, hpdepthfreq: ku } = c("hpdepthfrequency", "hpdepthfreq");
var { hpshape: qu } = c("hpshape");
var { hpdc: Su } = c("hpdc");
var { hpskew: Au } = c("hpskew");
var { vib: Tu, vibrato: Cu, v: xu } = c(["vib", "vibmod"], "vibrato", "v");
var { noise: Bu } = c("noise");
var { vibmod: Ou, vmod: zu } = c(["vibmod", "vib"], "vmod");
var { hcutoff: Mu, hpf: Pu, hp: Eu } = c(["hcutoff", "hresonance", "hpenv"], "hpf", "hp");
var { hresonance: ju, hpq: Ju } = c("hresonance", "hpq");
var { resonance: $u, lpq: Nu } = c("resonance", "lpq");
var { djf: Lu } = c("djf");
var { delay: Ru } = c(["delay", "delaytime", "delayfeedback"]);
var { delayfeedback: Wu, delayfb: Fu, dfb: Iu } = c("delayfeedback", "delayfb", "dfb");
var { delayspeed: Vu } = c("delayspeed");
var { delaytime: Hu, delayt: Du, dt: Gu } = c("delaytime", "delayt", "dt");
var { delaysync: Qu } = c("delaysync");
var { lock: Uu } = c("lock");
var { detune: Xu, det: Ku } = c("detune", "det");
var { unison: Yu } = c("unison");
var { spread: Zu } = c("spread");
var { dry: ta } = c("dry");
var { fadeTime: ea, fadeOutTime: na } = c("fadeTime", "fadeOutTime");
var { fadeInTime: sa } = c("fadeInTime");
var { freq: ra } = c("freq");
var { pattack: oa, patt: ca } = c("pattack", "patt");
var { pdecay: ia, pdec: ua } = c("pdecay", "pdec");
var { psustain: aa, psus: la } = c("psustain", "psus");
var { prelease: pa, prel: fa } = c("prelease", "prel");
var { penv: ha } = c("penv");
var { pcurve: da } = c("pcurve");
var { panchor: ma } = c("panchor");
var { gate: ya, gat: wa } = c("gate", "gat");
var { leslie: ga } = c("leslie");
var { lrate: ba } = c("lrate");
var { lsize: _a } = c("lsize");
var { activeLabel: va } = c("activeLabel");
var { label: ka } = c(["label", "activeLabel"]);
var { degree: qa } = c("degree");
var { mtranspose: Sa } = c("mtranspose");
var { ctranspose: Aa } = c("ctranspose");
var { harmonic: Ta } = c("harmonic");
var { stepsPerOctave: Ca } = c("stepsPerOctave");
var { octaveR: xa } = c("octaveR");
var { nudge: Ba } = c("nudge");
var { octave: Oa, oct: za } = c("octave", "oct");
var { orbit: Ma } = c("orbit", "o");
var { bus: Pa } = c("bus");
var { busgain: Ea, bgain: ja } = c("busgain", "bgain");
var { overgain: Ja } = c("overgain");
var { overshape: $a } = c("overshape");
var { pan: Na } = c("pan");
var { panspan: La } = c("panspan");
var { pansplay: Ra } = c("pansplay");
var { panwidth: Wa } = c("panwidth");
var { panorient: Fa } = c("panorient");
var { slide: Ia } = c("slide");
var { semitone: Va } = c("semitone");
var { voice: Ha } = c("voice");
var { chord: Da } = c("chord");
var { dictionary: Ga, dict: Qa } = c("dictionary", "dict");
var { anchor: Ua } = c("anchor");
var { offset: Xa } = c("offset");
var { octaves: Ka } = c("octaves");
var { mode: Ya } = c(["mode", "anchor"]);
var { room: Za } = c(["room", "size"]);
var { roomlp: tl, rlp: el } = c("roomlp", "rlp");
var { roomdim: nl, rdim: sl } = c("roomdim", "rdim");
var { roomfade: rl, rfade: ol } = c("roomfade", "rfade");
var { ir: cl, iresponse: il } = c(["ir", "i"], "iresponse");
var { irspeed: ul } = c("irspeed");
var { irbegin: al } = c("irbegin");
var { roomsize: ll, size: pl, sz: fl, rsize: hl } = c("roomsize", "size", "sz", "rsize");
var { shape: dl } = c(["shape", "shapevol"]);
var { distort: ml, dist: yl } = c(["distort", "distortvol", "distorttype"], "dist");
var { distortvol: wl } = c("distortvol", "distvol");
var { distorttype: gl } = c("distorttype", "disttype");
var { compressor: bl } = c([
  "compressor",
  "compressorRatio",
  "compressorKnee",
  "compressorAttack",
  "compressorRelease"
]);
var { compressorKnee: _l } = c("compressorKnee");
var { compressorRatio: vl } = c("compressorRatio");
var { compressorAttack: kl } = c("compressorAttack");
var { compressorRelease: ql } = c("compressorRelease");
var { speed: ye } = c("speed");
var { stretch: Sl } = c("stretch");
var { unit: Al } = c("unit");
var { squiz: Tl } = c("squiz");
var { vowel: Cl } = c("vowel");
var { waveloss: xl } = c("waveloss");
var { density: Bl } = c("density");
var { expression: Ol } = c("expression");
var { sustainpedal: zl } = c("sustainpedal");
var { fshift: Ml } = c("fshift");
var { fshiftnote: Pl } = c("fshiftnote");
var { fshiftphase: El } = c("fshiftphase");
var { triode: jl } = c("triode");
var { krush: Jl } = c("krush");
var { kcutoff: $l } = c("kcutoff");
var { octer: Nl } = c("octer");
var { octersub: Ll } = c("octersub");
var { octersubsub: Rl } = c("octersubsub");
var { ring: Wl } = c("ring");
var { ringf: Fl } = c("ringf");
var { ringdf: Il } = c("ringdf");
var { freeze: Vl } = c("freeze");
var { xsdelay: Hl } = c("xsdelay");
var { tsdelay: Dl } = c("tsdelay");
var { real: Gl } = c("real");
var { imag: Ql } = c("imag");
var { enhance: Ul } = c("enhance");
var { comb: Xl } = c("comb");
var { smear: Kl } = c("smear");
var { scram: Yl } = c("scram");
var { binshift: Zl } = c("binshift");
var { hbrick: tp } = c("hbrick");
var { lbrick: ep } = c("lbrick");
var { frameRate: np } = c("frameRate");
var { frames: sp } = c("frames");
var { hours: rp } = c("hours");
var { minutes: op } = c("minutes");
var { seconds: cp } = c("seconds");
var { songPtr: ip } = c("songPtr");
var { uid: up } = c("uid");
var { val: ap } = c("val");
var { cps: lp } = c("cps");
var { clip: pp, legato: fp } = c("clip", "legato");
var { duration: hp, dur: dp } = c("duration", "dur");
var { zrand: mp } = c("zrand");
var { curve: yp } = c("curve");
var { deltaSlide: wp } = c("deltaSlide");
var { pitchJump: gp } = c("pitchJump");
var { pitchJumpTime: bp } = c("pitchJumpTime");
var { znoise: _p } = c("znoise");
var { zmod: vp } = c("zmod");
var { zcrush: kp } = c("zcrush");
var { zdelay: qp } = c("zdelay");
var { zzfx: Sp } = c("zzfx");
var { color: Ap, colour: Tp } = c(["color", "colour"]);
var Cp = (...t) => t.reduce((e, n2) => Object.assign(e, { [n2]: Nt(n2) }), {});
var xp = l("adsr", (t, e) => {
  t = Array.isArray(t) ? t : [t];
  const [n2, s, r, o] = t;
  return e.set({ attack: n2, decay: s, sustain: r, release: o });
});
var Bp = l("ad", (t, e) => {
  t = Array.isArray(t) ? t : [t];
  const [n2, s = n2] = t;
  return e.attack(n2).decay(s);
});
var Op = l("ds", (t, e) => {
  t = Array.isArray(t) ? t : [t];
  const [n2, s = 0] = t;
  return e.set({ decay: n2, sustain: s });
});
var zp = l("ar", (t, e) => {
  t = Array.isArray(t) ? t : [t];
  const [n2, s = n2] = t;
  return e.set({ attack: n2, release: s });
});
var { midichan: Mp } = c("midichan");
var { midimap: Pp } = c("midimap");
var { midiport: Ep } = c("midiport");
var { midicmd: jp } = c("midicmd");
var Jp = l("control", (t, e) => {
  if (!Array.isArray(t))
    throw new Error("control expects an array of [ccn, ccv]");
  const [n2, s] = t;
  return e.ccn(n2).ccv(s);
});
var { ccn: $p } = c("ccn");
var { ccv: Np } = c("ccv");
var { ctlNum: Lp } = c("ctlNum");
var { nrpnn: Rp } = c("nrpnn");
var { nrpv: Wp } = c("nrpv");
var { progNum: Fp } = c("progNum");
var Ip = l("sysex", (t, e) => {
  if (!Array.isArray(t))
    throw new Error("sysex expects an array of [id, data]");
  const [n2, s] = t;
  return e.sysexid(n2).sysexdata(s);
});
var { sysexid: Vp } = c("sysexid");
var { sysexdata: Hp } = c("sysexdata");
var { midibend: Dp } = c("midibend");
var { miditouch: Gp } = c("miditouch");
var { polyTouch: Qp } = c("polyTouch");
var { oschost: Up } = c("oschost");
var { oscport: Xp } = c("oscport");
var yt = (t) => at.has(t) ? at.get(t) : t;
var Kp = l("as", (t, e) => (t = Array.isArray(t) ? t : [t], e.fmap((n2) => {
  n2 = Array.isArray(n2) ? n2 : [n2];
  const s = [];
  for (let r = 0; r < t.length; ++r)
    n2[r] !== void 0 && s.push([yt(t[r]), n2[r]]);
  return Object.fromEntries(s);
})));
var Yp = l(
  "scrub",
  (t, e) => t.outerBind((n2) => {
    Array.isArray(n2) || (n2 = [n2]);
    const [s, r = 1] = n2;
    return e.begin(s).mul(ye(r)).clip(1);
  }),
  false
);
var Bt = /* @__PURE__ */ new Map();
var Zp = (t, e, ...n2) => {
  const s = Bt.get(t) ?? /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set([e, ...n2]);
  for (const o of r)
    s.set(String(o).toLowerCase(), e);
  Bt.set(t, s);
};
var Lt = (t, e = []) => {
  for (const [n2, ...s] of e)
    Zp(t, n2, ...s);
};
var tf = (t, e) => {
  const n2 = Bt.get(t);
  return n2 ? n2.get(String(e).toLowerCase()) ?? e : e;
};
Lt("lfo", [
  ["control", "c"],
  ["subControl", "sc"],
  ["rate", "r"],
  ["depth", "dep", "dr"],
  ["depthabs", "da"],
  ["dcoffset", "dc"],
  ["shape", "sh"],
  ["skew", "sk"],
  ["curve", "cu"],
  ["sync", "s"],
  ["fxi"]
]);
Lt("env", [
  ["control", "c"],
  ["subControl", "sc"],
  ["attack", "att", "a"],
  ["decay", "dec", "d"],
  ["sustain", "sus", "s"],
  ["release", "rel", "r"],
  ["depth", "dep", "dr"],
  ["depthabs", "da"],
  ["acurve", "ac"],
  ["dcurve", "dc"],
  ["rcurve", "rc"],
  ["fxi"]
]);
Lt("bmod", [
  ["bus", "b"],
  ["control", "c"],
  ["subControl", "sc"],
  ["depth", "dep", "dr"],
  ["depthabs", "da"],
  ["dc"],
  ["fxi"]
]);
f.prototype.modulate = function(t, e, n2) {
  e = { control: void 0, ...e };
  const s = ["lfo", "env", "bmod"];
  if (!s.includes(t))
    return E(`[core] Modulation type ${t} not found. Please use one of 'lfo', 'env', 'bmod'`), this;
  let r = this, o;
  r = r.fmap((i) => (a) => ({ v: i, id: a })).appLeft(d(n2));
  for (const [i, a] of Object.entries(e)) {
    const u2 = tf(t, i), p = d(a);
    r = r.fmap(({ v: h, id: y2 }) => (g) => {
      if (o === void 0) {
        let _4 = yt(Object.keys(h).at(-1));
        s.includes(_4) && (_4 = `${_4}_${[...h[_4].__ids].at(-1)}`), o = _4;
      }
      h[t] ??= { __ids: /* @__PURE__ */ new Set() };
      const v = h[t];
      return y2 ??= v.__ids.size, v[y2] ??= { control: o }, v.__ids.add(y2), g === void 0 ? { v: h, id: y2 } : (u2 === "control" || u2 === "subControl" ? v[y2][u2] = yt(g) : v[y2][u2] = g, { v: h, id: y2 });
    }).appLeft(p);
  }
  return r.fmap(({ v: i }) => i);
};
f.prototype.lfo = function(t, e) {
  return this.modulate("lfo", t, e);
};
var ef = (t) => C({}).lfo(t);
f.prototype.env = function(t, e) {
  return this.modulate("env", t, e);
};
var nf = (t) => C({}).env(t);
f.prototype.bmod = function(t, e) {
  return this.modulate("bmod", t, e);
};
var sf = (t) => C({}).bmod(t);
var { transient: rf } = c(["transient", "transsustain"]);
var { FXrelease: of, FXrel: cf, FXr: uf, fxr: af } = c("FXrelease", "FXrel", "FXr", "fxr");
var gy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  FXr: uf,
  FXrel: cf,
  FXrelease: of,
  accelerate: Ys,
  activeLabel: va,
  ad: Bp,
  adsr: xp,
  amp: sr,
  analyze: gc,
  anchor: Ua,
  ar: zp,
  as: Kp,
  att: or,
  attack: rr,
  bandf: Cc,
  bandq: Oc,
  bank: yc,
  bbexpr: ti,
  bbst: ni,
  begin: Mc,
  bgain: ja,
  binshift: Zl,
  bmod: sf,
  bp: Bc,
  bpa: ji,
  bpattack: Ei,
  bpd: Wi,
  bpdc: yu,
  bpdecay: Ri,
  bpdepth: fu,
  bpdepthfreq: du,
  bpdepthfrequency: hu,
  bpe: Bi,
  bpenv: xi,
  bpf: xc,
  bpq: zc,
  bpr: Zi,
  bprate: lu,
  bprelease: Yi,
  bps: Gi,
  bpshape: mu,
  bpskew: wu,
  bpsustain: Di,
  bpsync: pu,
  bus: Pa,
  busgain: Ea,
  byteBeatExpression: Zc,
  byteBeatStartTime: ei,
  ccn: $p,
  ccv: Np,
  ch: ri,
  channel: gi,
  channels: si,
  chord: Da,
  chorus: wc,
  clip: pp,
  coarse: Rc,
  color: Ap,
  colour: Tp,
  comb: Xl,
  compressor: bl,
  compressorAttack: kl,
  compressorKnee: _l,
  compressorRatio: vl,
  compressorRelease: ql,
  control: Jp,
  cps: lp,
  createParam: Nt,
  createParams: Cp,
  crush: Lc,
  ctf: vi,
  ctlNum: Lp,
  ctranspose: Aa,
  curve: yp,
  cut: bi,
  cutoff: _i,
  dec: vc,
  decay: _c,
  degree: qa,
  delay: Ru,
  delayfb: Fu,
  delayfeedback: Wu,
  delayspeed: Vu,
  delaysync: Qu,
  delayt: Du,
  delaytime: Hu,
  deltaSlide: wp,
  density: Bl,
  det: Ku,
  detune: Xu,
  dfb: Iu,
  dict: Qa,
  dictionary: Ga,
  dist: yl,
  distort: ml,
  distorttype: gl,
  distortvol: wl,
  djf: Lu,
  drive: Qc,
  dry: ta,
  ds: Op,
  dt: Gu,
  duck: Uc,
  duckattack: Yc,
  duckdepth: Xc,
  duckonset: Kc,
  dur: dp,
  duration: hp,
  end: Pc,
  enhance: Ul,
  env: nf,
  expression: Ol,
  fadeInTime: sa,
  fadeOutTime: na,
  fadeTime: ea,
  fanchor: eu,
  fft: bc,
  fm: Sr,
  fm1: Ar,
  fm2: Tr,
  fm3: Cr,
  fm4: xr,
  fm5: Br,
  fm6: Or,
  fm7: zr,
  fm8: Mr,
  fmatt: Kr,
  fmatt1: Yr,
  fmatt2: Zr,
  fmatt3: to,
  fmatt4: eo,
  fmatt5: no,
  fmatt6: so,
  fmatt7: ro,
  fmatt8: oo,
  fmattack: Fr,
  fmattack1: Ir,
  fmattack2: Vr,
  fmattack3: Hr,
  fmattack4: Dr,
  fmattack5: Gr,
  fmattack6: Qr,
  fmattack7: Ur,
  fmattack8: Xr,
  fmdec: Ao,
  fmdec1: To,
  fmdec2: Co,
  fmdec3: xo,
  fmdec4: Bo,
  fmdec5: Oo,
  fmdec6: zo,
  fmdec7: Mo,
  fmdec8: Po,
  fmdecay: yo,
  fmdecay1: wo,
  fmdecay2: go,
  fmdecay3: bo,
  fmdecay4: _o,
  fmdecay5: vo,
  fmdecay6: ko,
  fmdecay7: qo,
  fmdecay8: So,
  fmenv: Pr,
  fmenv1: Er,
  fmenv2: jr,
  fmenv3: Jr,
  fmenv4: $r,
  fmenv5: Nr,
  fmenv6: Lr,
  fmenv7: Rr,
  fmenv8: Wr,
  fmh: cr,
  fmh1: ir,
  fmh2: ur,
  fmh3: ar,
  fmh4: lr,
  fmh5: pr,
  fmh6: fr,
  fmh7: hr,
  fmh8: dr,
  fmi: mr,
  fmi1: yr,
  fmi2: wr,
  fmi3: gr,
  fmi4: br,
  fmi5: _r,
  fmi6: vr,
  fmi7: kr,
  fmi8: qr,
  fmrel: ic,
  fmrel1: uc,
  fmrel2: ac,
  fmrel3: lc,
  fmrel4: pc,
  fmrel5: fc,
  fmrel6: hc,
  fmrel7: dc,
  fmrel8: mc,
  fmrelease: Yo,
  fmrelease1: Zo,
  fmrelease2: tc,
  fmrelease3: ec,
  fmrelease4: nc,
  fmrelease5: sc,
  fmrelease6: rc,
  fmrelease7: oc,
  fmrelease8: cc,
  fmsus: Io,
  fmsus1: Vo,
  fmsus2: Ho,
  fmsus3: Do,
  fmsus4: Go,
  fmsus5: Qo,
  fmsus6: Uo,
  fmsus7: Xo,
  fmsus8: Ko,
  fmsustain: Eo,
  fmsustain1: jo,
  fmsustain2: Jo,
  fmsustain3: $o,
  fmsustain4: No,
  fmsustain5: Lo,
  fmsustain6: Ro,
  fmsustain7: Wo,
  fmsustain8: Fo,
  fmwave: co,
  fmwave1: io,
  fmwave2: uo,
  fmwave3: ao,
  fmwave4: lo,
  fmwave5: po,
  fmwave6: fo,
  fmwave7: ho,
  fmwave8: mo,
  frameRate: np,
  frames: sp,
  freeze: Vl,
  freq: ra,
  fshift: Ml,
  fshiftnote: Pl,
  fshiftphase: El,
  ftype: tu,
  fxr: af,
  gain: er,
  gat: wa,
  gate: ya,
  getControlName: yt,
  harmonic: Ta,
  hbrick: tp,
  hcutoff: Mu,
  hold: Tc,
  hours: rp,
  hp: Eu,
  hpa: Pi,
  hpattack: Mi,
  hpd: Li,
  hpdc: Su,
  hpdecay: Ni,
  hpdepth: _u,
  hpdepthfreq: ku,
  hpdepthfrequency: vu,
  hpe: Ci,
  hpenv: Ti,
  hpf: Pu,
  hpq: Ju,
  hpr: Ki,
  hprate: gu,
  hprelease: Xi,
  hps: Hi,
  hpshape: qu,
  hpskew: Au,
  hpsustain: Vi,
  hpsync: bu,
  hresonance: ju,
  imag: Ql,
  ir: cl,
  irbegin: al,
  iresponse: il,
  irspeed: ul,
  isControlName: is,
  kcutoff: $l,
  krush: Jl,
  label: ka,
  lbrick: ep,
  legato: fp,
  leslie: ga,
  lfo: ef,
  lock: Uu,
  loop: Ec,
  loopBegin: jc,
  loopEnd: $c,
  loopb: Jc,
  loope: Nc,
  lp: qi,
  lpa: zi,
  lpattack: Oi,
  lpd: $i,
  lpdc: uu,
  lpdecay: Ji,
  lpdepth: ru,
  lpdepthfreq: cu,
  lpdepthfrequency: ou,
  lpe: Ai,
  lpenv: Si,
  lpf: ki,
  lpq: Nu,
  lpr: Ui,
  lprate: nu,
  lprelease: Qi,
  lps: Ii,
  lpshape: iu,
  lpskew: au,
  lpsustain: Fi,
  lpsync: su,
  lrate: ba,
  lsize: _a,
  midibend: Dp,
  midichan: Mp,
  midicmd: jp,
  midimap: Pp,
  midiport: Ep,
  miditouch: Gp,
  minutes: op,
  mode: Ya,
  mtranspose: Sa,
  n: Xs,
  noise: Bu,
  note: Ks,
  nrpnn: Rp,
  nrpv: Wp,
  nudge: Ba,
  oct: za,
  octave: Oa,
  octaveR: xa,
  octaves: Ka,
  octer: Nl,
  octersub: Ll,
  octersubsub: Rl,
  offset: Xa,
  orbit: Ma,
  oschost: Up,
  oscport: Xp,
  overgain: Ja,
  overshape: $a,
  pan: Na,
  panchor: ma,
  panorient: Fa,
  panspan: La,
  pansplay: Ra,
  panwidth: Wa,
  patt: ca,
  pattack: oa,
  pcurve: da,
  pdec: ua,
  pdecay: ia,
  penv: ha,
  ph: ai,
  phasdp: wi,
  phaser: li,
  phasercenter: hi,
  phaserdepth: mi,
  phaserrate: ui,
  phasersweep: pi,
  phc: di,
  phd: yi,
  phs: fi,
  pitchJump: gp,
  pitchJumpTime: bp,
  polyTouch: Qp,
  postgain: nr,
  prel: fa,
  prelease: pa,
  progNum: Fp,
  psus: la,
  psustain: aa,
  pw: oi,
  pwrate: ci,
  pwsweep: ii,
  rdim: sl,
  real: Gl,
  registerControl: c,
  registerMultiControl: V,
  rel: Ac,
  release: Sc,
  resonance: $u,
  rfade: ol,
  ring: Wl,
  ringdf: Il,
  ringf: Fl,
  rlp: el,
  room: Za,
  roomdim: nl,
  roomfade: rl,
  roomlp: tl,
  roomsize: ll,
  rsize: hl,
  s: us,
  scram: Yl,
  scrub: Yp,
  seconds: cp,
  semitone: Va,
  shape: dl,
  size: pl,
  slide: Ia,
  smear: Kl,
  songPtr: ip,
  sound: as,
  source: Qs,
  speed: ye,
  spread: Zu,
  squiz: Tl,
  src: Us,
  stepsPerOctave: Ca,
  stretch: Sl,
  sus: qc,
  sustain: kc,
  sustainpedal: zl,
  sysex: Ip,
  sysexdata: Hp,
  sysexid: Vp,
  sz: fl,
  transient: rf,
  trem: Fc,
  tremolo: Wc,
  tremolodepth: Vc,
  tremolophase: Dc,
  tremoloshape: Gc,
  tremoloskew: Hc,
  tremolosync: Ic,
  triode: jl,
  tsdelay: Dl,
  uid: up,
  unison: Yu,
  unit: Al,
  v: xu,
  val: ap,
  vel: tr,
  velocity: Zs,
  vib: Tu,
  vibmod: Ou,
  vibrato: Cu,
  vmod: zu,
  voice: Ha,
  vowel: Cl,
  warp: Cs,
  warpatt: Os,
  warpattack: Bs,
  warpdc: Rs,
  warpdec: Ms,
  warpdecay: zs,
  warpdepth: Ns,
  warpenv: Ds,
  warpmode: Fs,
  warprate: $s,
  warprel: Js,
  warprelease: js,
  warpshape: Ls,
  warpskew: Ws,
  warpsus: Es,
  warpsustain: Ps,
  warpsync: Gs,
  waveloss: xl,
  wavetablePhaseRand: Hs,
  wavetablePosition: ps,
  wavetableWarp: xs,
  wavetableWarpMode: Is,
  wt: ls,
  wtatt: ds,
  wtattack: hs,
  wtdc: As,
  wtdec: ys,
  wtdecay: ms,
  wtdepth: qs,
  wtenv: fs,
  wtphaserand: Vs,
  wtrate: vs,
  wtrel: _s,
  wtrelease: bs,
  wtshape: Ss,
  wtskew: Ts,
  wtsus: gs,
  wtsustain: ws,
  wtsync: ks,
  xsdelay: Hl,
  zcrush: kp,
  zdelay: qp,
  zmod: vp,
  znoise: _p,
  zrand: mp,
  zzfx: Sp
}, Symbol.toStringTag, { value: "Module" }));
var lf = function(t, e) {
  const [n2, s] = t, [r, o] = e, [i, a] = ue(s, r);
  return [
    [s, n2 - s],
    [Pt((u2, p) => u2.concat(p), i, o), a]
  ];
};
var pf = function(t, e) {
  const [n2, s] = t, [r, o] = e, [i, a] = ue(n2, o);
  return [
    [n2, s - n2],
    [Pt((p, h) => p.concat(h), r, i), a]
  ];
};
var we = function(t, e) {
  const [n2, s] = t;
  return Math.min(n2, s) <= 1 ? [t, e] : we(...n2 > s ? lf(t, e) : pf(t, e));
};
var ge = function(t, e) {
  const n2 = t < 0, s = Math.abs(t), r = e - s, o = Array(s).fill([1]), i = Array(r).fill([0]), a = we([s, r], [o, i]), u2 = G(a[1][0]).concat(G(a[1][1]));
  return n2 ? u2.map((p) => 1 - p) : u2;
};
var kt = function(t, e, n2) {
  const s = ge(t, e);
  return n2 ? rn(s, -n2) : s;
};
var by = l("euclid", function(t, e, n2) {
  return n2.struct(kt(t, e, 0));
});
var _y = l("bjork", function(t, e) {
  Array.isArray(t) || (t = [t]);
  const [n2, s = n2, r = 0] = t;
  return e.struct(kt(n2, s, r));
});
var { euclidrot: vy, euclidRot: ky } = l(["euclidrot", "euclidRot"], function(t, e, n2, s) {
  return s.struct(kt(t, e, n2));
});
var be = function(t, e, n2, s) {
  if (t < 1)
    return q;
  const o = kt(t, e, 0).join("").split("1").slice(1).map((i) => [i.length + 1, true]);
  return s.struct(ns(...o)).late(m(n2).div(e));
};
var qy = l(["euclidLegato"], function(t, e, n2) {
  return be(t, e, 0, n2);
});
var Sy = l(["euclidLegatoRot"], function(t, e, n2, s) {
  return be(t, e, n2, s);
});
var { euclidish: Ay, eish: Ty } = l(["euclidish", "eish"], function(t, e, n2, s) {
  const r = de(ge(t, e), new Array(t).fill(1), n2);
  return s.struct(r).setSteps(e);
});
function ff(t, e, n2 = 0.05, s = 0.1, r = 0.1, o = globalThis.setInterval, i = globalThis.clearInterval, a = true) {
  let u2 = 0, p = 0, h = 10 ** 4, y2 = 0.01;
  const g = (x) => n2 = x(n2);
  r = r || s / 2;
  const v = () => {
    const x = t(), D = x + s + r;
    for (p === 0 && (p = x + y2); p < D; )
      p = a ? Math.round(p * h) / h : p, e(p, n2, u2, x), p += n2, u2++;
  };
  let _4;
  const O = () => {
    A2(), v(), _4 = o(v, s * 1e3);
  }, A2 = () => {
    _4 !== void 0 && i(_4), _4 = void 0;
  };
  return { setDuration: g, start: O, stop: () => {
    u2 = 0, p = 0, A2();
  }, pause: () => A2(), duration: n2, interval: s, getPhase: () => p, minLatency: y2 };
}
var hf = class {
  constructor({
    interval: e,
    onTrigger: n2,
    onToggle: s,
    onError: r,
    getTime: o,
    latency: i = 0.1,
    setInterval: a,
    clearInterval: u2,
    beforeStart: p
  }) {
    this.started = false, this.beforeStart = p, this.cps = 0.5, this.num_ticks_since_cps_change = 0, this.lastTick = 0, this.lastBegin = 0, this.lastEnd = 0, this.getTime = o, this.num_cycles_at_cps_change = 0, this.seconds_at_cps_change, this.onToggle = s, this.latency = i, this.clock = ff(
      o,
      // called slightly before each cycle
      (h, y2, g, v) => {
        this.num_ticks_since_cps_change === 0 && (this.num_cycles_at_cps_change = this.lastEnd, this.seconds_at_cps_change = h), this.num_ticks_since_cps_change++;
        const O = this.num_ticks_since_cps_change * y2 * this.cps;
        try {
          const A2 = this.lastEnd;
          this.lastBegin = A2;
          const I = this.num_cycles_at_cps_change + O;
          if (this.lastEnd = I, this.lastTick = h, h < v) {
            console.log("skip query: too late");
            return;
          }
          this.pattern.queryArc(A2, I, { _cps: this.cps, cyclist: "cyclist" }).forEach((P2) => {
            if (P2.hasOnset()) {
              const x = (P2.whole.begin - this.num_cycles_at_cps_change) / this.cps + this.seconds_at_cps_change + i, D = P2.duration / this.cps, nt2 = x - h;
              n2?.(P2, nt2, D, this.cps, x), P2.value.cps !== void 0 && this.cps != P2.value.cps && (this.cps = P2.value.cps, this.num_ticks_since_cps_change = 0);
            }
          });
        } catch (A2) {
          zt(A2), r?.(A2);
        }
      },
      e,
      // duration of each cycle
      0.1,
      0.1,
      a,
      u2
    );
  }
  now() {
    if (!this.started)
      return 0;
    const e = this.getTime() - this.lastTick - this.clock.duration;
    return this.lastBegin + e * this.cps;
  }
  setStarted(e) {
    this.started = e, this.onToggle?.(e);
  }
  async start() {
    if (await this.beforeStart?.(), this.num_ticks_since_cps_change = 0, this.num_cycles_at_cps_change = 0, !this.pattern)
      throw new Error("Scheduler: no pattern set! call .setPattern first.");
    E("[cyclist] start"), this.clock.start(), this.setStarted(true);
  }
  pause() {
    E("[cyclist] pause"), this.clock.pause(), this.setStarted(false);
  }
  stop() {
    E("[cyclist] stop"), this.clock.stop(), this.lastEnd = 0, this.setStarted(false);
  }
  async setPattern(e, n2 = false) {
    this.pattern = e, n2 && !this.started && await this.start();
  }
  setCps(e = 0.5) {
    this.cps !== e && (this.cps = e, this.num_ticks_since_cps_change = 0);
  }
  log(e, n2, s) {
    const r = s.filter((o) => o.hasOnset());
    console.log(`${e.toFixed(4)} - ${n2.toFixed(4)} ${Array(r.length).fill("I").join("")}`);
  }
};
var ct = {};
var df = function() {
  mf();
};
var mf = function() {
  ct = {};
};
var Cy = l(
  "timeline",
  function(t, e) {
    t = d(t);
    const n2 = function(s) {
      const r = !!s.controls.cyclist, o = t.query(s), i = [];
      for (const a of o) {
        const u2 = a.value;
        let p;
        if (u2 === 0)
          p = 0;
        else if (u2 in ct)
          p = ct[u2];
        else {
          const y2 = a.wholeOrPart();
          !r || s.span.begin.lt(y2.midpoint()) ? p = y2.begin : p = y2.end;
        }
        r && (ct[u2] = p, u2 !== 0 && delete ct[-u2]);
        const h = e.late(p).query(s.setSpan(a.part)).map((y2) => y2.setContext(y2.combineContext(a)));
        i.push(...h);
      }
      return i;
    };
    return new f(n2, e._steps);
  },
  false
);
var F = function(t, e, n2 = true) {
  const s = Array.isArray(t), r = Object.keys(t).length;
  return t = bn(t, d), r === 0 ? q : e.fmap((o) => {
    let i = o;
    return s && (i = n2 ? Math.round(i) % r : an(Math.round(i), 0, t.length - 1)), t[i];
  });
};
var yf = function(t, e) {
  return Array.isArray(e) && ([e, t] = [t, e]), wf(t, e);
};
var wf = l("pick", function(t, e) {
  return F(t, e, false).innerJoin();
});
var gf = l("pickmod", function(t, e) {
  return F(t, e, true).innerJoin();
});
var xy = l("pickF", function(t, e, n2) {
  return n2.apply(yf(t, e));
});
var By = l("pickmodF", function(t, e, n2) {
  return n2.apply(gf(t, e));
});
var Oy = l("pickOut", function(t, e) {
  return F(t, e, false).outerJoin();
});
var zy = l("pickmodOut", function(t, e) {
  return F(t, e, true).outerJoin();
});
var My = l("pickRestart", function(t, e) {
  return F(t, e, false).restartJoin();
});
var Py = l("pickmodRestart", function(t, e) {
  return F(t, e, true).restartJoin();
});
var Ey = l("pickReset", function(t, e) {
  return F(t, e, false).resetJoin();
});
var jy = l("pickmodReset", function(t, e) {
  return F(t, e, true).resetJoin();
});
var { inhabit: Jy, pickSqueeze: $y } = l(["inhabit", "pickSqueeze"], function(t, e) {
  return F(t, e, false).squeezeJoin();
});
var { inhabitmod: Ny, pickmodSqueeze: Ly } = l(["inhabitmod", "pickmodSqueeze"], function(t, e) {
  return F(t, e, true).squeezeJoin();
});
var Ry = (t, e) => (e = e.map(d), e.length == 0 ? q : t.fmap((n2) => {
  const s = bt(Math.round(n2), e.length);
  return e[s];
}).squeezeJoin());
var bf = class {
  constructor({ onTrigger: e, onToggle: n2, getTime: s }) {
    this.started = false, this.cps = 0.5, this.getTime = s, this.time_at_last_tick_message = 0, this.collator = new _n({ getTargetClockTime: s }), this.onToggle = n2, this.latency = 0.1, this.cycle = 0, this.id = Math.round(Date.now() * Math.random()), this.worker = new SharedWorker(new URL(
      /* @vite-ignore */
      "" + new URL("assets/clockworker-ZDiUtESR.js", import.meta.url).href,
      import.meta.url
    )), this.worker.port.start(), this.channel = new BroadcastChannel("strudeltick");
    const r = (i) => {
      const { cps: a, begin: u2, end: p, cycle: h, time: y2 } = i;
      this.cps = a, this.cycle = h;
      const g = this.collator.calculateOffset(y2) + y2;
      o(u2, p, g), this.time_at_last_tick_message = g;
    }, o = (i, a, u2) => {
      if (this.started === false)
        return;
      this.pattern.queryArc(i, a, { _cps: this.cps, cyclist: "neocyclist" }).forEach((h) => {
        if (h.hasOnset()) {
          const g = Kt(h.whole.begin - this.cycle, this.cps) + u2 + this.latency, v = Kt(h.duration, this.cps);
          e?.(h, 0, v, this.cps, g);
        }
      });
    };
    this.channel.onmessage = (i) => {
      if (!this.started)
        return;
      const { payload: a, type: u2 } = i.data;
      switch (u2) {
        case "tick":
          r(a);
      }
    };
  }
  sendMessage(e, n2) {
    this.worker.port.postMessage({ type: e, payload: n2, id: this.id });
  }
  now() {
    const e = (this.getTime() - this.time_at_last_tick_message) * this.cps;
    return this.cycle + e;
  }
  setCps(e = 1) {
    this.sendMessage("cpschange", { cps: e });
  }
  setCycle(e) {
    this.sendMessage("setcycle", { cycle: e });
  }
  setStarted(e) {
    this.sendMessage("toggle", { started: e }), this.started = e, this.onToggle?.(e);
  }
  start() {
    E("[cyclist] start"), this.setStarted(true);
  }
  stop() {
    E("[cyclist] stop"), this.collator.reset(), this.setStarted(false);
  }
  setPattern(e, n2 = false) {
    this.pattern = e, n2 && !this.started && this.start();
  }
  log(e, n2, s) {
    const r = s.filter((o) => o.hasOnset());
    console.log(`${e.toFixed(4)} - ${n2.toFixed(4)} ${Array(r.length).fill("I").join("")}`);
  }
};
var Ot;
var _e;
var ve;
var ke;
var qe;
function Wy() {
  if (!Ot)
    throw new Error("no time set! use setTime to define a time source");
  return Ot();
}
function ee(t) {
  Ot = t;
}
function _f(t) {
  _e = t;
}
function Fy() {
  return _e?.();
}
function vf(t) {
  ve = t;
}
function Iy() {
  return ve;
}
function kf(t) {
  ke = t;
}
function Vy() {
  return ke;
}
function qf(t) {
  qe = !!t;
}
function Hy() {
  return qe;
}
function Dy({
  defaultOutput: t,
  onEvalError: e,
  beforeEval: n2,
  beforeStart: s,
  afterEval: r,
  getTime: o,
  transpiler: i,
  onToggle: a,
  editPattern: u2,
  onUpdateState: p,
  sync: h = false,
  setInterval: y2,
  clearInterval: g,
  id: v,
  mondo: _4 = false
}) {
  const O = new SalatRepl({ localScope: true }), A2 = {
    schedulerError: void 0,
    evalError: void 0,
    code: "// LOADING",
    activeCode: "// LOADING",
    pattern: void 0,
    miniLocations: [],
    widgets: [],
    pending: false,
    started: false
  }, I = {
    id: v
  }, H3 = (b) => {
    Object.assign(A2, b), A2.isDirty = A2.code !== A2.activeCode, A2.error = A2.evalError || A2.schedulerError, p?.(A2);
  }, P2 = {
    onTrigger: Sf({ defaultOutput: t, getTime: o }),
    getTime: o,
    onToggle: (b) => {
      H3({ started: b }), qf(b), a?.(b), b || df();
    },
    setInterval: y2,
    clearInterval: g,
    beforeStart: s
  }, x = h && typeof SharedWorker < "u" ? new bf(P2) : new hf(P2);
  kf(P2.onTrigger), _f(() => x.cps);
  let D = {}, nt2 = 0, tt2;
  const Vt = function() {
    return D = {}, nt2 = 0, tt2 = void 0, q;
  }, Je = (b) => O.evaluate(b).compile({ log: false });
  function Ht(b) {
    return b._Pattern ? b.__pure : b;
  }
  const Dt = async (b, k3 = true) => (b = u2?.(b) || b, await x.setPattern(b, k3), vf(b), b);
  ee(() => x.now());
  const $e2 = () => x.stop(), Ne2 = () => x.start(), Le2 = () => x.pause(), Re = () => x.toggle(), St2 = (b) => (x.setCps(Ht(b)), q), Gt = (b) => (x.setCps(Ht(b) / 60), q);
  let ft = [];
  const We = function(b) {
    return ft.push(b), q;
  }, Fe = function(b) {
    return tt2 = b, q;
  }, Ie = () => {
    f.prototype.p = function(k3) {
      return typeof k3 == "string" && (k3.startsWith("_") || k3.endsWith("_")) ? q : (k3.includes("$") && (k3 = `${k3}${nt2}`, nt2++), D[k3] = this, this);
    }, f.prototype.q = function(k3) {
      return q;
    };
    try {
      for (let k3 = 1; k3 < 10; ++k3)
        Object.defineProperty(f.prototype, `d${k3}`, {
          get() {
            return this.p(k3);
          },
          configurable: true
        }), Object.defineProperty(f.prototype, `p${k3}`, {
          get() {
            return this.p(k3);
          },
          configurable: true
        }), f.prototype[`q${k3}`] = q;
    } catch (k3) {
      console.warn("injectPatternMethods: error:", k3);
    }
    const b = l("cpm", function(k3, At) {
      return At._fast(k3 / 60 / x.cps);
    });
    return xn({
      all: We,
      each: Fe,
      hush: Vt,
      cpm: b,
      setCps: St2,
      setcps: St2,
      setCpm: Gt,
      setcpm: Gt,
      compileKabel: Je
    });
  };
  return { scheduler: x, evaluate: async (b, k3 = true, At = true) => {
    if (!b)
      throw new Error("no code to evaluate");
    try {
      H3({ code: b, pending: true }), await Ie(), ee(() => x.now()), await n2?.({ code: b }), ft = [], At && Vt(), _4 && (b = `mondolang\`${b}\``);
      let { pattern: M, meta: Tt2 } = await On(b, i, I);
      if (Object.keys(D).length) {
        let X = [], ht = false;
        for (const [st2, Ve4] of Object.entries(D)) {
          const Qt2 = st2.length > 1 && st2.startsWith("S");
          if (Qt2 && ht === false && (X = [], ht = true), !ht || ht && Qt2) {
            const He2 = Ve4.withState((De) => De.setControls({ id: st2 }));
            X.push(He2);
          }
        }
        tt2 && (X = X.map((st2) => tt2(st2))), M = z(...X);
      } else tt2 && (M = tt2(M));
      if (ft.length)
        for (const X of ft)
          M = X(M);
      return pe(M) || (M = q), E("[eval] code updated"), M = await Dt(M, k3), H3({
        miniLocations: Tt2?.miniLocations || [],
        widgets: Tt2?.widgets || [],
        activeCode: b,
        pattern: M,
        evalError: void 0,
        schedulerError: void 0,
        pending: false
      }), r?.({ code: b, pattern: M, meta: Tt2 }), M;
    } catch (M) {
      E(`[eval] error: ${M.message}`, "error"), console.error(M), H3({ evalError: M, pending: false }), e?.(M);
    }
  }, start: Ne2, stop: $e2, pause: Le2, setCps: St2, setPattern: Dt, setCode: (b) => H3({ code: b }), toggle: Re, state: A2 };
}
var Sf = ({ getTime: t, defaultOutput: e }) => async (n2, s, r, o, i) => {
  try {
    (!n2.context.onTrigger || !n2.context.dominantTrigger) && await e(n2, s, r, o, i), n2.context.onTrigger && await n2.context.onTrigger(n2, t(), o, i);
  } catch (a) {
    zt(a, "getTrigger");
  }
};
function Gy(t) {
  return new f((e) => [new S(void 0, e.span, t)]);
}
var j = (t) => {
  const e = (n2) => [new S(void 0, n2.span, t(n2.span.begin, n2.controls))];
  return new f(e);
};
var qt = j((t) => t % 1);
var Se = qt.toBipolar();
var Rt = j((t) => 1 - t % 1);
var Ae = Rt.toBipolar();
var Te = j((t) => Math.sin(Math.PI * 2 * t));
var Af = Te.fromBipolar();
var Qy = Af._early(m(1).div(4));
var Uy = Te._early(m(1).div(4));
var Tf = j((t) => Math.floor(t * 2 % 2));
var Xy = Tf.toBipolar();
var Ky = N(qt, Rt);
var Yy = N(Se, Ae);
var Zy = N(Rt, qt);
var tw = N(Ae, Se);
var ew = j(ot);
var Wt = 0;
var Ft = 0;
typeof window < "u" && document.addEventListener("mousemove", (t) => {
  Wt = t.clientY / document.body.clientHeight, Ft = t.clientX / document.body.clientWidth;
});
var nw = j(() => Wt);
var sw = j(() => Wt);
var rw = j(() => Ft);
var ow = j(() => Ft);
var Cf = (t) => (t |= 0, t ^= t >>> 16, t = Math.imul(t, 2246822507), t ^= t >>> 13, t = Math.imul(t, 3266489909), t ^= t >>> 16, t >>> 0);
var xf = (t) => Math.floor(t * 536870912);
var Bf = (t, e = 0, n2 = 0) => {
  const s = t >>> 0 >>> 0, r = Math.floor(t / 4294967296) >>> 0;
  let o = s ^ Math.imul(r ^ 2246822507, 3266489909);
  return o ^= Math.imul(e ^ 2135587861, 2654435769), o ^= Math.imul(n2 ^ 374761393, 668265261), o >>> 0;
};
var ne = (t, e = 0, n2 = 0) => Cf(Bf(t, e, n2)) / 4294967296;
var Of = (t, e, n2 = 0) => {
  const s = xf(t);
  if (e === 1)
    return ne(s, 0, n2);
  const r = new Array(e);
  for (let o = 0; o < e; o++) r[o] = ne(s, o, n2);
  return r;
};
var Ce = (t) => {
  const e = t << 13 ^ t, n2 = e >> 17 ^ e;
  return n2 << 5 ^ n2;
};
var zf = (t) => t - Math.trunc(t);
var Mf = (t) => Ce(Math.trunc(zf(t / 300) * 536870912));
var se = (t) => t % 536870912 / 536870912;
var Pf = (t, e) => {
  if (e === 1)
    return Math.abs(se(t));
  const n2 = [];
  for (let s = 0; s < e; s++)
    n2.push(se(t)), t = Ce(t);
  return n2;
};
var Ef = (t, e) => Pf(Mf(t), e);
var xe = "legacy";
var K = (t, e = 1, n2 = 0) => xe === "legacy" ? Ef(t + n2, e) : Of(t, e, n2);
var cw = (t = "legacy") => xe = t;
var jf = (t) => qt.range(0, t).round().segment(t);
var iw = (t) => {
  const e = d(t).log2(0).floor().add(1);
  return Jf(t, e);
};
var Jf = (t, e = 16) => {
  e = d(e);
  const n2 = jf(e).mul(-1).add(e.sub(1));
  return d(t).segment(e).brshift(n2).band(C(1));
};
var uw = (t) => {
  const e = d(t).log2(0).floor().add(1);
  return $f(t, e);
};
var $f = (t, e = 16) => d(t).withValue((n2) => (s) => {
  const r = [];
  for (let o = s - 1; o >= 0; o--)
    r.push(n2 >> o & 1);
  return r;
}).appLeft(d(e));
var aw = (t) => j((e) => (n2) => K(e, n2).map(Math.abs)).appLeft(d(t));
var Nf = (t) => j((e, n2) => {
  const r = K(e.floor().add(0.5), t, n2.randSeed).map((i, a) => [i, a]).sort((i, a) => (i[0] > a[0]) - (i[0] < a[0])).map((i) => i[1]), o = e.cyclePos().mul(t).floor() % t;
  return r[o];
})._segment(t);
var Be = (t, e, n2) => {
  const s = [...Array(e).keys()].map((r) => n2.zoom(m(r).div(e), m(r + 1).div(e)));
  return t.fmap((r) => s[r].repeatCycles(e)._fast(e)).innerJoin();
};
var lw = l("shuffle", (t, e) => Be(Nf(t), t, e));
var pw = l("scramble", (t, e) => Be(ze(t)._segment(t), t, e));
var Lf = (t, e) => new f((n2) => {
  let { randSeed: s, ...r } = n2.controls;
  return s = t(s), e.query(n2.setControls({ ...r, randSeed: s }));
}, e._steps);
var fw = l("seed", (t, e) => Lf(() => t, e));
var W = j((t, e) => K(t, 1, e.randSeed));
var hw = W.toBipolar();
var Oe = (t) => W.fmap((e) => e < t);
var dw = (t) => d(t).fmap(Oe).innerJoin();
var mw = Oe(0.5);
var ze = (t) => W.fmap((e) => Math.trunc(e * t));
var yw = (t) => d(t).fmap(ze).innerJoin();
var Me = (t, e) => (e = e.map(d), e.length == 0 ? q : t.range(0, e.length).fmap((n2) => {
  const s = Math.min(Math.max(Math.floor(n2), 0), e.length - 1);
  return e[s];
}));
var It = (t, e) => Me(t, e).outerJoin();
var Pe = (t, e) => Me(t, e).innerJoin();
var Rf = (...t) => It(W, t);
var ww = (...t) => Pe(W, t);
var gw = Rf;
f.prototype.choose = function(...t) {
  return It(this, t);
};
f.prototype.choose2 = function(...t) {
  return It(this.fromBipolar(), t);
};
var Wf = (...t) => Pe(W.segment(1), t);
var bw = Wf;
var Ee = function(t, ...e) {
  const n2 = e.map((a) => d(a[0])), s = [];
  let r = C(0);
  for (const a of e)
    r = r.add(a[1]), s.push(r);
  const o = En(s), i = function(a) {
    const u2 = r.mul(a);
    return o.fmap((p) => (h) => n2[p.findIndex((y2) => y2 > h, p)]).appLeft(u2);
  };
  return t.bind(i);
};
var Ff = (...t) => Ee(...t).outerJoin();
var _w = (...t) => Ff(W, ...t);
var If = (...t) => Ee(W.segment(1), ...t).innerJoin();
var vw = If;
function Vf(t, e = 0) {
  let n2 = Math.floor(t), s = n2 + 1;
  const r = (p) => 6 * p ** 5 - 15 * p ** 4 + 10 * p ** 3, o = (p) => (h) => (y2) => h + r(p) * (y2 - h), i = K(n2, 1, e), a = K(s, 1, e);
  return o(t - n2)(i)(a);
}
function Hf(t, e = 0) {
  const n2 = Math.floor(t), s = n2 + 1, r = K(n2, 1, e), o = K(s, 1, e), i = r + o, a = (t - n2) / (s - n2);
  return ((p, h, y2) => p + y2 * (h - p))(r, i, a) / 2;
}
var kw = j((t, e) => Vf(t, e.randSeed));
var qw = j((t, e) => Hf(t, e.randSeed));
var Sw = l(
  "degradeByWith",
  (t, e, n2) => n2.fmap((s) => (r) => s).appLeft(t.filterValues((s) => s > e)),
  true,
  true
);
var Aw = l(
  "degradeBy",
  function(t, e) {
    return e._degradeByWith(W, t);
  },
  true,
  true
);
var Tw = l("degrade", (t) => t._degradeBy(0.5), true, true);
var Cw = l(
  "undegradeBy",
  function(t, e) {
    return e._degradeByWith(
      W.fmap((n2) => 1 - n2),
      t
    );
  },
  true,
  true
);
var xw = l("undegrade", (t) => t._undegradeBy(0.5), true, true);
var Bw = l("sometimesBy", function(t, e, n2) {
  return d(t).fmap((s) => z(n2._degradeBy(s), e(n2._undegradeBy(1 - s)))).innerJoin();
});
var Ow = l("sometimes", function(t, e) {
  return e._sometimesBy(0.5, t);
});
var zw = l("someCyclesBy", function(t, e, n2) {
  return d(t).fmap(
    (s) => z(
      n2._degradeByWith(W._segment(1), s),
      e(n2._degradeByWith(W.fmap((r) => 1 - r)._segment(1), 1 - s))
    )
  ).innerJoin();
});
var Mw = l("someCycles", function(t, e) {
  return e._someCyclesBy(0.5, t);
});
var Pw = l("often", function(t, e) {
  return e.sometimesBy(0.75, t);
});
var Ew = l("rarely", function(t, e) {
  return e.sometimesBy(0.25, t);
});
var jw = l("almostNever", function(t, e) {
  return e.sometimesBy(0.1, t);
});
var Jw = l("almostAlways", function(t, e) {
  return e.sometimesBy(0.9, t);
});
var $w = l("never", function(t, e) {
  return e;
});
var Nw = l("always", function(t, e) {
  return t(e);
});
function je(t) {
  Array.isArray(t) === false && (t = [t]);
  const e = qn();
  return t.every((n2) => {
    const s = kn.get(n2) ?? n2;
    return e[s];
  });
}
var Lw = l("whenKey", function(t, e, n2) {
  return n2.when(je(t), e);
});
var Rw = l("keyDown", function(t) {
  return t.fmap(je);
});
var Ww = new f(function(t) {
  return [new S(void 0, t.span, t.span.duration)];
});
var Df = new f(function(t) {
  return [new S(void 0, t.span, m(1).div(t.span.duration))];
});
var Fw = Df;
var Iw = new f(function(t) {
  const e = m(1).div(t.span.duration);
  return [new S(void 0, t.span, Math.log(e) / Math.log(2) + 1)];
});
var wt;
try {
  wt = window?.speechSynthesis;
} catch {
  console.warn("cannot use window: not in browser?");
}
var re = wt?.getVoices();
function Gf(t, e, n2) {
  wt.cancel();
  const s = new SpeechSynthesisUtterance(t);
  s.lang = e, re = wt.getVoices();
  const r = re.filter((o) => o.lang.includes(e));
  typeof n2 == "number" ? s.voice = r[n2 % r.length] : typeof n2 == "string" && (s.voice = r.find((o) => o.name === o)), speechSynthesis.speak(s);
}
var Vw = l("speak", function(t, e, n2) {
  return n2.onTrigger((s) => {
    Gf(s.value, t, e);
  });
});
var Hw = function(t, e = {}) {
  const n2 = document.getElementById("code"), s = "background-image:url(" + t + ");background-size:contain;";
  n2.style = s;
  const { className: r } = n2, o = (u2, p) => {
    ({
      style: () => n2.style = s + ";" + p,
      className: () => n2.className = p + " " + r
    })[u2]();
  }, i = Object.entries(e).filter(([u2, p]) => typeof p == "function");
  Object.entries(e).filter(([u2, p]) => typeof p == "string").forEach(([u2, p]) => o(u2, p)), i.length;
};
var Dw = () => {
  const t = document.getElementById("code");
  t && (t.style = "");
};
E("\u{1F300} @strudel/core loaded \u{1F300}");
globalThis._strudelLoaded && console.warn(
  `@strudel/core was loaded more than once...
This might happen when you have multiple versions of strudel installed. 
Please check with "npm ls @strudel/core".`
);
globalThis._strudelLoaded = true;

// node_modules/superdough/node_modules/nanostores/clean-stores/index.js
var clean = /* @__PURE__ */ Symbol("clean");

// node_modules/superdough/node_modules/nanostores/atom/index.js
var listenerQueue = [];
var lqIndex = 0;
var QUEUE_ITEMS_PER_LISTENER = 4;
var epoch = 0;
var atom = (initialValue) => {
  let listeners = [];
  let $atom = {
    get() {
      if (!$atom.lc) {
        $atom.listen(() => {
        })();
      }
      return $atom.value;
    },
    lc: 0,
    listen(listener) {
      $atom.lc = listeners.push(listener);
      return () => {
        for (let i = lqIndex + QUEUE_ITEMS_PER_LISTENER; i < listenerQueue.length; ) {
          if (listenerQueue[i] === listener) {
            listenerQueue.splice(i, QUEUE_ITEMS_PER_LISTENER);
          } else {
            i += QUEUE_ITEMS_PER_LISTENER;
          }
        }
        let index = listeners.indexOf(listener);
        if (~index) {
          listeners.splice(index, 1);
          if (!--$atom.lc) $atom.off();
        }
      };
    },
    notify(oldValue, changedKey) {
      epoch++;
      let runListenerQueue = !listenerQueue.length;
      for (let listener of listeners) {
        listenerQueue.push(
          listener,
          $atom.value,
          oldValue,
          changedKey
        );
      }
      if (runListenerQueue) {
        for (lqIndex = 0; lqIndex < listenerQueue.length; lqIndex += QUEUE_ITEMS_PER_LISTENER) {
          listenerQueue[lqIndex](
            listenerQueue[lqIndex + 1],
            listenerQueue[lqIndex + 2],
            listenerQueue[lqIndex + 3]
          );
        }
        listenerQueue.length = 0;
      }
    },
    /* It will be called on last listener unsubscribing.
       We will redefine it in onMount and onStop. */
    off() {
    },
    set(newValue) {
      let oldValue = $atom.value;
      if (oldValue !== newValue) {
        $atom.value = newValue;
        $atom.notify(oldValue);
      }
    },
    subscribe(listener) {
      let unbind = $atom.listen(listener);
      listener($atom.value);
      return unbind;
    },
    value: initialValue
  };
  if (process.env.NODE_ENV !== "production") {
    $atom[clean] = () => {
      listeners = [];
      $atom.lc = 0;
      $atom.off();
    };
  }
  return $atom;
};

// node_modules/superdough/node_modules/nanostores/map/index.js
var map = (initial = {}) => {
  let $map = atom(initial);
  $map.setKey = function(key, value) {
    let oldMap = $map.value;
    if (typeof value === "undefined" && key in $map.value) {
      $map.value = { ...$map.value };
      delete $map.value[key];
      $map.notify(oldMap, key);
    } else if ($map.value[key] !== value) {
      $map.value = {
        ...$map.value,
        [key]: value
      };
      $map.notify(oldMap, key);
    }
  };
  return $map;
};

// node_modules/superdough/dist/index.mjs
if (typeof DelayNode < "u") {
  class e extends DelayNode {
    constructor(n2, o, a, c2) {
      return super(n2), o = Math.abs(o), this.delayTime.value = a, this.feedbackGain = n2.createGain(), this.feedbackGain.gain.value = Math.min(Math.abs(c2), 0.995), this.feedback = this.feedbackGain.gain, this.delayGain = n2.createGain(), this.delayGain.gain.value = o, this.connect(this.feedbackGain), this.connect(this.delayGain), this.feedbackGain.connect(this), this.connect = (s) => this.delayGain.connect(s), this;
    }
    start(n2) {
      this.delayGain.gain.setValueAtTime(this.delayGain.gain.value, n2 + this.delayTime.value);
    }
  }
  BaseAudioContext.prototype.createFeedbackDelay = function(t, n2, o) {
    return new e(this, t, n2, o);
  };
}
var ze2;
var pn2 = () => (ze2 = new AudioContext(), ze2);
var z2 = () => ze2 || pn2();
var wt2 = (e) => console.log(e);
function ct2(e, t = "superdough") {
  process.env.NODE_ENV === "development" && console.error(e), j2(`[${t}] error: ${e.message}`);
}
var j2 = (...e) => wt2(...e);
var Bo2 = (e) => {
  wt2 = e;
};
var se2 = (e, t, n2) => Math.min(Math.max(e, t), n2);
function re2(e, t = 0, n2) {
  return isNaN(Number(e)) ? (!n2 && j2(`"${e}" is not a number, falling back to ${t}`, "warning"), t) : e;
}
function T(e) {
  const t = z2().createGain();
  return t.gain.value = e, t;
}
function Ue2(e, t, n2) {
  const o = T(n2);
  return e.connect(o), o.connect(t), o;
}
var xt2 = (e, t, n2, o) => o - n2 === 0 ? 0 : (t - e) / (o - n2);
function q2(e, t, n2, o) {
  const a = new AudioWorkletNode(e, t, o);
  return Object.entries(n2).forEach(([c2, s]) => {
    s !== void 0 && (a.parameters.get(c2).value = s);
  }), a;
}
var _2 = (e, t, n2, o, a, c2, s, d2, l2, i = "exponential") => {
  t = re2(t), n2 = re2(n2), o = re2(o), a = re2(a);
  const p = i === "exponential" ? "exponentialRampToValueAtTime" : "linearRampToValueAtTime";
  i === "exponential" && (c2 = c2 === 0 ? 1e-3 : c2, s = s === 0 ? 1e-3 : s);
  const r = s - c2, h = c2 + o * r, u2 = l2 - d2, m2 = (G3) => {
    let b;
    return t > G3 ? b = G3 * xt2(c2, s, 0, t) + c2 : b = (G3 - t) * xt2(s, h, 0, n2) + s, i === "exponential" && (b = b || 1e-3), b;
  };
  e.setValueAtTime(c2, d2), t > u2 ? e[p](m2(u2), l2) : t + n2 > u2 ? (e[p](m2(t), d2 + t), e[p](m2(u2), l2)) : (e[p](m2(t), d2 + t), e[p](m2(t + n2), d2 + t + n2), e.setValueAtTime(h, l2)), e[p](c2, l2 + a);
};
var $2 = (e, t = "linear", n2) => {
  const [s, d2, l2, i] = e;
  if (s == null && d2 == null && l2 == null && i == null)
    return n2 ?? [1e-3, 1e-3, 1, 0.01];
  const p = l2 ?? (s != null && d2 == null || s == null && d2 == null ? 1 : 1e-3);
  return [Math.max(s ?? 0, 1e-3), Math.max(d2 ?? 0, 1e-3), Math.min(p, 1), Math.max(i ?? 0, 0.01)];
};
var Rn2 = ["linear", "exponential"];
function He(e, t, n2, o) {
  if ((t.pattack ?? t.pdecay ?? t.psustain ?? t.prelease ?? t.penv) === void 0)
    return;
  const c2 = re2(t.penv, 1, true), s = Rn2[t.pcurve ?? 0];
  let [d2, l2, i, p] = $2(
    [t.pattack, t.pdecay, t.psustain, t.prelease],
    s,
    [0.2, 1e-3, 1, 1e-3]
  ), r = t.panchor ?? i;
  const h = c2 * 100, u2 = 0 - h * r, m2 = h - h * r;
  _2(e, d2, l2, i, p, u2, m2, n2, o, s);
}
function Te2(e, t, n2) {
  const { vibmod: o = 0.5, vib: a } = t;
  let c2;
  if (a > 0) {
    c2 = z2().createOscillator(), c2.frequency.value = a;
    const s = z2().createGain();
    return s.gain.value = o * 100, c2.connect(s), s.connect(e), ue2(c2, () => {
      Y2(s), Y2(c2);
    }), c2.start(n2), { stop: (d2) => c2.stop(d2), nodes: { vib: [c2], vib_gain: [s] } };
  }
}
function pe2(e, t, n2, o) {
  const a = new ConstantSourceNode(e), c2 = T(0);
  return c2.connect(e.destination), a.connect(c2), ue2(a, () => {
    Y2(c2), Y2(a), t();
  }), a.start(n2), a.stop(o), a;
}
var Bt2 = (e) => e / (1 + e);
var Kn2 = (e, t) => (e % t + t) % t;
var gn2 = (e, t) => (1 + t) * e / (1 + t * Math.abs(e));
var Ve = (e, t) => Math.tanh(e * (1 + t));
var Nn2 = (e, t) => se2((1 + t) * e, -1, 1);
var Qt = (e, t) => {
  let n2 = (1 + 0.5 * t) * e;
  const o = Kn2(n2 + 1, 4);
  return 1 - Math.abs(o - 2);
};
var Hn2 = (e, t) => Math.sin(Math.PI / 2 * Qt(e, t));
var Tn2 = (e, t) => {
  const n2 = Bt2(Math.log1p(t)), o = (e - n2 / 3 * e * e * e) / (1 - n2 / 3);
  return Ve(o, t);
};
var vt2 = (e, t, n2 = false) => {
  const o = 1 + 2 * t, c2 = 0.07 * Bt2(Math.log1p(t)), s = Ve(e + c2, 2 * t), d2 = Ve(n2 ? c2 : -e + c2, 2 * t), l2 = s - d2, i = 1 / Math.cosh(o * c2), p = i * i, r = Math.max(1e-8, (n2 ? 1 : 2) * o * p);
  return Ve(l2 / r, t);
};
var wn2 = (e, t) => vt2(e, t, true);
var Fn2 = (e, t) => {
  const n2 = 10 * Math.log1p(t);
  let o = 1, a = e, c2, s = 0;
  for (let d2 = 1; d2 < 64; d2++) {
    if (d2 < 2) {
      s += d2 == 0 ? o : a;
      continue;
    }
    c2 = 2 * e * o - a, a = o, o = c2, d2 % 2 === 0 && (s += Math.min(1.3 * n2 / d2, 2) * c2);
  }
  return Ve(s, n2 / 20);
};
var Et2 = {
  scurve: gn2,
  soft: Ve,
  hard: Nn2,
  cubic: Tn2,
  diode: vt2,
  asym: wn2,
  fold: Qt,
  sinefold: Hn2,
  chebyshev: Fn2
};
var ge2 = Object.freeze(Object.keys(Et2));
var ue2 = (e, t) => {
  const n2 = t;
  e.onended = function() {
    n2 && n2(), this.onended = null;
  };
};
var Y2 = (e) => {
  if (e != null) {
    if (!(e instanceof AudioNode))
      throw new Error("releaseAudioNode can only release an AudioNode");
    if (e.disconnect(), e instanceof AudioScheduledSourceNode) {
      process.env.NODE_ENV === "development" && e.onended && e.onended.name !== "cleanup" && j2(
        "[superdough] Deprecation warning: it seems your code path is setting 'node.onended = callback' instead of using the onceEnded helper"
      );
      try {
        e.stop();
      } catch {
        e.start(e.context.currentTime + 5), e.stop();
      }
    }
    e instanceof AudioWorkletNode && e.parameters.get("end")?.setValueAtTime(0, 0);
  }
};
var mt2 = {};
mt2.generateReverb = function(e, t) {
  for (var n2 = e.audioContext || new AudioContext(), o = n2.sampleRate, a = e.numChannels || 2, c2 = e.decayTime * 1.5, s = Math.round(e.decayTime * o), d2 = Math.round(c2 * o), l2 = Math.round((e.fadeInTime || 0) * o), i = Math.pow(1 / 1e3, 1 / s), p = n2.createBuffer(a, d2, o), r = 0; r < a; r++) {
    for (var h = p.getChannelData(r), u2 = 0; u2 < d2; u2++)
      h[u2] = Jn2() * Math.pow(i, u2);
    for (var u2 = 0; u2 < l2; u2++)
      h[u2] *= u2 / l2;
  }
  Pn2(p, e.lpFreqStart || 0, e.lpFreqEnd || 0, e.decayTime, t);
};
mt2.generateGraph = function(e, t, n2, o, a) {
  var c2 = document.createElement("canvas");
  c2.width = t, c2.height = n2;
  var s = c2.getContext("2d");
  s.fillStyle = "#000", s.fillRect(0, 0, c2.width, c2.height), s.fillStyle = "#fff";
  for (var d2 = t / e.length, l2 = n2 / (a - o), i = 0; i < e.length; i++)
    s.fillRect(i * d2, n2 - (e[i] - o) * l2, 1, 1);
  return c2;
};
var Pn2 = function(e, t, n2, o, a) {
  if (t == 0) {
    a(e);
    return;
  }
  var c2 = In2(e), s = new OfflineAudioContext(e.numberOfChannels, c2[0].length, e.sampleRate), d2 = s.createBufferSource();
  d2.buffer = e;
  var l2 = s.createBiquadFilter();
  t = Math.min(t, e.sampleRate / 2), n2 = Math.min(n2, e.sampleRate / 2), l2.type = "lowpass", l2.Q.value = 1e-4, l2.frequency.setValueAtTime(t, 0), l2.frequency.linearRampToValueAtTime(n2, o), d2.connect(l2), l2.connect(s.destination), d2.start(), s.oncomplete = function(i) {
    a(i.renderedBuffer), Y2(l2), Y2(d2);
  }, s.startRendering(), window.filterNode = l2;
};
var In2 = function(e) {
  for (var t = [], n2 = 0; n2 < e.numberOfChannels; n2++)
    t[n2] = e.getChannelData(n2);
  return t;
};
var Jn2 = function() {
  return Math.random() * 2 - 1;
};
typeof AudioContext < "u" && (BaseAudioContext.prototype.adjustLength = function(e, t, n2 = 1, o = 0) {
  const a = Math.floor(se2(o, 0, 1) * t.length), c2 = t.sampleRate * e, s = this.createBuffer(t.numberOfChannels, t.length, t.sampleRate);
  for (let d2 = 0; d2 < t.numberOfChannels; d2++) {
    let l2 = t.getChannelData(d2), i = s.getChannelData(d2);
    for (let p = 0; p < c2; p++) {
      let r = (a + p * Math.abs(n2)) % l2.length;
      n2 < 1 && (r = r * -1), i[p] = l2.at(r) || 0;
    }
  }
  return s;
}, BaseAudioContext.prototype.createReverb = function(e, t, n2, o, a, c2, s) {
  const d2 = this.createConvolver();
  return d2.generate = (l2 = 2, i = 0.1, p = 15e3, r = 1e3, h, u2, m2) => {
    d2.duration = l2, d2.fade = i, d2.lp = p, d2.dim = r, d2.ir = h, d2.irspeed = u2, d2.irbegin = m2, h ? d2.buffer = this.adjustLength(l2, h, u2, m2) : mt2.generateReverb(
      {
        audioContext: this,
        numChannels: 2,
        decayTime: l2,
        fadeInTime: i,
        lpFreqStart: p,
        lpFreqEnd: r
      },
      (G3) => {
        d2.buffer = G3;
      }
    );
  }, d2.generate(e, t, n2, o, a, c2, s), d2;
});
var Yt2 = {
  a: { freqs: [660, 1120, 2750, 3e3, 3350], gains: [1, 0.5012, 0.0708, 0.0631, 0.0126], qs: [80, 90, 120, 130, 140] },
  e: { freqs: [440, 1800, 2700, 3e3, 3300], gains: [1, 0.1995, 0.1259, 0.1, 0.1], qs: [70, 80, 100, 120, 120] },
  i: { freqs: [270, 1850, 2900, 3350, 3590], gains: [1, 0.0631, 0.0631, 0.0158, 0.0158], qs: [40, 90, 100, 120, 120] },
  o: { freqs: [430, 820, 2700, 3e3, 3300], gains: [1, 0.3162, 0.0501, 0.0794, 0.01995], qs: [40, 80, 100, 120, 120] },
  u: { freqs: [370, 630, 2750, 3e3, 3400], gains: [1, 0.1, 0.0708, 0.0316, 0.01995], qs: [40, 60, 100, 120, 120] },
  ae: { freqs: [650, 1515, 2400, 3e3, 3350], gains: [1, 0.5, 0.1008, 0.0631, 0.0126], qs: [80, 90, 120, 130, 140] },
  aa: { freqs: [560, 900, 2570, 3e3, 3300], gains: [1, 0.5, 0.0708, 0.0631, 0.0126], qs: [80, 90, 120, 130, 140] },
  oe: { freqs: [500, 1430, 2300, 3e3, 3300], gains: [1, 0.2, 0.0708, 0.0316, 0.01995], qs: [40, 60, 100, 120, 120] },
  ue: { freqs: [250, 1750, 2150, 3200, 3300], gains: [1, 0.1, 0.0708, 0.0316, 0.01995], qs: [40, 60, 100, 120, 120] },
  y: { freqs: [400, 1460, 2400, 3e3, 3300], gains: [1, 0.2, 0.0708, 0.0316, 0.02995], qs: [40, 60, 100, 120, 120] },
  uh: { freqs: [600, 1250, 2100, 3100, 3500], gains: [1, 0.3, 0.0608, 0.0316, 0.01995], qs: [40, 70, 100, 120, 130] },
  un: { freqs: [500, 1240, 2280, 3e3, 3500], gains: [1, 0.1, 0.1708, 0.0216, 0.02995], qs: [40, 60, 100, 120, 120] },
  en: { freqs: [600, 1480, 2450, 3200, 3300], gains: [1, 0.15, 0.0708, 0.0316, 0.02995], qs: [40, 60, 100, 120, 120] },
  an: { freqs: [700, 1050, 2500, 3e3, 3300], gains: [1, 0.1, 0.0708, 0.0316, 0.02995], qs: [40, 60, 100, 120, 120] },
  on: { freqs: [500, 1080, 2350, 3e3, 3300], gains: [1, 0.1, 0.0708, 0.0316, 0.02995], qs: [40, 60, 100, 120, 120] },
  get \u00E6() {
    return this.ae;
  },
  get \u00F8() {
    return this.oe;
  },
  get \u0251() {
    return this.aa;
  },
  get \u00E5() {
    return this.aa;
  },
  get \u00F6() {
    return this.oe;
  },
  get \u00FC() {
    return this.ue;
  },
  get \u0131() {
    return this.y;
  }
};
if (typeof GainNode < "u") {
  class e extends GainNode {
    constructor(n2, o) {
      if (super(n2), !Yt2[o])
        throw new Error("vowel: unknown vowel " + o);
      const { gains: a, qs: c2, freqs: s } = Yt2[o];
      this.makeupGain = n2.createGain(), this.filters = [], this.gains = [];
      for (let d2 = 0; d2 < 5; d2++) {
        const l2 = n2.createGain();
        l2.gain.value = a[d2];
        const i = n2.createBiquadFilter();
        i.type = "bandpass", i.Q.value = c2[d2], i.frequency.value = s[d2], super.connect(i), i.connect(l2), this.filters.push(i), l2.connect(this.makeupGain), this.gains.push(l2);
      }
      return this.makeupGain.gain.value = 8, this;
    }
    connect(n2) {
      this.makeupGain.connect(n2);
    }
    disconnect() {
      Y2(this.makeupGain), this.filters.forEach(Y2), this.gains.forEach(Y2), super.disconnect(), this.makeupGain = null, this.filters = null, this.gains = null;
    }
  }
  BaseAudioContext.prototype.createVowelFilter = function(t) {
    return new e(this, t);
  };
}
var jn2 = {
  stretch: { node: "stretch", param: "pitchFactor" },
  gain: { node: "gain", param: "gain" },
  postgain: { node: "post", param: "gain" },
  pan: { node: "pan", param: "pan" },
  tremolo: { node: "tremolo", param: "frequency" },
  tremolosync: { node: "tremolo", param: "frequency" },
  tremolodepth: { node: "tremolo_gain", param: "gain" },
  tremoloskew: { node: "tremolo", param: "skew" },
  tremolophase: { node: "tremolo", param: "phase" },
  tremoloshape: { node: "tremolo", param: "shape" },
  // MODULATORS
  lfo: { node: "lfo", param: "frequency" },
  lfo_rate: { node: "lfo", param: "frequency" },
  lfo_sync: { node: "lfo", param: "frequency" },
  lfo_depth: { node: "lfo", param: "depth" },
  lfo_depthabs: { node: "lfo", param: "depth" },
  lfo_skew: { node: "lfo", param: "skew" },
  lfo_curve: { node: "lfo", param: "curve" },
  lfo_dcoffset: { node: "lfo", param: "dcoffset" },
  env: { node: "env", param: "depth" },
  env_attack: { node: "env", param: "attack" },
  env_decay: { node: "env", param: "decay" },
  env_sustain: { node: "env", param: "sustain" },
  env_release: { node: "env", param: "release" },
  bmod: { node: "bmod", param: "depth" },
  bmod_depth: { node: "bmod", param: "depth" },
  bmod_depthabs: { node: "bmod", param: "depth" },
  // LPF
  cutoff: { node: "lpf", param: "frequency" },
  resonance: { node: "lpf", param: "Q" },
  lprate: { node: "lpf_lfo", param: "rate" },
  lpsync: { node: "lpf_lfo", param: "sync" },
  lpdepth: { node: "lpf_lfo", param: "depth" },
  lpdepthfrequency: { node: "lpf_lfo", param: "depth" },
  lpshape: { node: "lpf_lfo", param: "shape" },
  lpdc: { node: "lpf_lfo", param: "dcoffset" },
  lpskew: { node: "lpf_lfo", param: "skew" },
  // HPF
  hcutoff: { node: "hpf", param: "frequency" },
  hresonance: { node: "hpf", param: "Q" },
  hprate: { node: "hpf_lfo", param: "rate" },
  hpsync: { node: "hpf_lfo", param: "sync" },
  hpdepth: { node: "hpf_lfo", param: "depth" },
  hpdepthfrequency: { node: "hpf_lfo", param: "depth" },
  hpshape: { node: "hpf_lfo", param: "shape" },
  hpdc: { node: "hpf_lfo", param: "dcoffset" },
  hpskew: { node: "hpf_lfo", param: "skew" },
  // BPF
  bandf: { node: "bpf", param: "frequency" },
  bandq: { node: "bpf", param: "Q" },
  bprate: { node: "bpf_lfo", param: "rate" },
  bpsync: { node: "bpf_lfo", param: "sync" },
  bpdepth: { node: "bpf_lfo", param: "depth" },
  bpdepthfrequency: { node: "bpf_lfo", param: "depth" },
  bpshape: { node: "bpf_lfo", param: "shape" },
  bpdc: { node: "bpf_lfo", param: "dcoffset" },
  bpskew: { node: "bpf_lfo", param: "skew" },
  vowel: { node: "vowel", param: "frequency" },
  // DISTORTION
  coarse: { node: "coarse", param: "coarse" },
  crush: { node: "crush", param: "crush" },
  shape: { node: "shape", param: "shape" },
  shapevol: { node: "shape", param: "postgain" },
  distort: { node: "distort", param: "distort" },
  distortvol: { node: "distort", param: "postgain" },
  distorttype: { node: "distort", param: "distort" },
  // COMPRESSOR
  compressor: { node: "compressor", param: "threshold" },
  compressorRatio: { node: "compressor", param: "ratio" },
  compressorKnee: { node: "compressor", param: "knee" },
  compressorAttack: { node: "compressor", param: "attack" },
  compressorRelease: { node: "compressor", param: "release" },
  // PHASER
  phaserrate: { node: "phaser_lfo", param: "frequency" },
  phasersweep: { node: "phaser_lfo", param: "depth" },
  phasercenter: { node: "phaser", param: "frequency" },
  phaserdepth: { node: "phaser", param: "Q" },
  // ORBIT EFFECTS
  delay: { node: "delay_mix", param: "gain" },
  delaytime: { node: "delay", param: "delayTime" },
  delayfeedback: { node: "delay", param: "feedback" },
  delaysync: { node: "delay", param: "delayTime" },
  dry: { node: "dry", param: "gain" },
  room: { node: "room_mix", param: "gain" },
  djf: { node: "djf", param: "value" },
  busgain: { node: "bus", param: "gain" },
  // SYNTHS
  s: { node: "source", param: "frequency" },
  detune: { node: "source", param: "freqspread" },
  wt: { node: "source", param: "position" },
  warp: { node: "source", param: "warp" },
  freq: { node: "source", param: "frequency" },
  note: { node: "source", param: "frequency" },
  wtdc: { node: "wt_lfo", param: "dc" },
  wtskew: { node: "wt_lfo", param: "skew" },
  wtrate: { node: "wt_lfo", param: "frequency" },
  wtsync: { node: "wt_lfo", param: "frequency" },
  wtdepth: { node: "wt_lfo", param: "depth" },
  warpdc: { node: "warp_lfo", param: "dc" },
  warpskew: { node: "warp_lfo", param: "skew" },
  warprate: { node: "warp_lfo", param: "frequency" },
  warpsync: { node: "warp_lfo", param: "frequency" },
  warpdepth: { node: "warp_lfo", param: "depth" },
  fmi: { node: "fm_1_gain", param: "gain" },
  fmi2: { node: "fm_2_gain", param: "gain" },
  fmi3: { node: "fm_3_gain", param: "gain" },
  fmi4: { node: "fm_4_gain", param: "gain" },
  fmi5: { node: "fm_5_gain", param: "gain" },
  fmi6: { node: "fm_6_gain", param: "gain" },
  fmi7: { node: "fm_7_gain", param: "gain" },
  fmi8: { node: "fm_8_gain", param: "gain" },
  fmh: { node: "fm_1", param: "frequency" },
  fmh2: { node: "fm_2", param: "frequency" },
  fmh3: { node: "fm_3", param: "frequency" },
  fmh4: { node: "fm_4", param: "frequency" },
  fmh5: { node: "fm_5", param: "frequency" },
  fmh6: { node: "fm_6", param: "frequency" },
  fmh7: { node: "fm_7", param: "frequency" },
  fmh8: { node: "fm_8", param: "frequency" },
  pw: { node: "source", param: "pulsewidth" },
  pwrate: { node: "pw_lfo", param: "frequency" },
  pwsweep: { node: "pw_lfo", param: "depth" },
  vib: { node: "vib", param: "frequency" },
  vibmod: { node: "vib_gain", param: "gain" },
  byteBeatStartTime: { node: "source", param: "byteBeatStartTime" },
  spread: { node: "source", param: "panspread" },
  transient: { node: "transient", param: "attack" }
};
function Bn2() {
  return jn2;
}
var St = Bn2();
var fe2 = (e, t) => e !== void 0 && e !== t;
var lt2 = (e) => new GainNode(e, { gain: 1, channelCount: 2, channelCountMode: "explicit" });
var ro2 = class {
  reverbNode;
  delayNode;
  output;
  summingNode;
  djfNode;
  audioContext;
  constructor(t) {
    this.audioContext = t, this.output = lt2(t), this.summingNode = lt2(t), this.summingNode.connect(this.output);
  }
  disconnect() {
    this.output.disconnect(), this.summingNode.disconnect(), this.delayNode?.disconnect(), this.reverbNode?.disconnect();
  }
  getDjf(t, n2 = 0) {
    return this.djfNode == null && (this.djfNode = q2(this.audioContext, "djf-processor", { value: t }), this.summingNode.disconnect(), this.summingNode.connect(this.djfNode), this.djfNode.connect(this.output)), this.djfNode.parameters.get("value").setValueAtTime(t, n2), this.djfNode;
  }
  getDelay(t = 0, n2 = 0.5, o) {
    return n2 = se2(n2, 0, 0.98), this.delayNode == null && (this.delayNode = this.audioContext.createFeedbackDelay(1, t, n2), this.delayNode.connect(this.summingNode), this.delayNode.start?.(o)), this.delayNode.delayTime.value !== t && this.delayNode.delayTime.setValueAtTime(t, o), this.delayNode.feedback.value !== n2 && this.delayNode.feedback.setValueAtTime(n2, o), this.delayNode;
  }
  getReverb(t, n2, o, a, c2, s, d2) {
    return this.reverbNode == null && (this.reverbNode = this.audioContext.createReverb(t, n2, o, a, c2, s, d2), this.reverbNode.connect(this.summingNode)), (fe2(t, this.reverbNode.duration) || fe2(n2, this.reverbNode.fade) || fe2(o, this.reverbNode.lp) || fe2(a, this.reverbNode.dim) || fe2(s, this.reverbNode.irspeed) || fe2(d2, this.reverbNode.irbegin) || this.reverbNode.ir !== c2) && this.reverbNode.generate(t, n2, o, a, c2, s, d2), this.reverbNode;
  }
  sendReverb(t, n2) {
    return Ue2(t, this.reverbNode, n2);
  }
  sendDelay(t, n2) {
    return Ue2(t, this.delayNode, n2);
  }
  duck(t, n2 = 0, o = 0.1, a = 1) {
    const c2 = n2, s = Math.max(o, 2e-3), d2 = this.output.gain;
    pe2(
      this.audioContext,
      () => {
        const l2 = this.audioContext.currentTime, i = d2.value;
        d2.cancelScheduledValues(l2), d2.setValueAtTime(i, l2);
        const p = Math.max(t, l2), r = se2(1 - Math.sqrt(a), 0.01, i);
        d2.exponentialRampToValueAtTime(r, p + c2), d2.exponentialRampToValueAtTime(1, p + c2 + s);
      },
      0,
      t - 0.01
    );
  }
  connectToOutput(t) {
    t.connect(this.summingNode);
  }
};
var po2 = class {
  channelMerger;
  destinationGain;
  constructor(t) {
    this.audioContext = t, this.initializeAudio();
  }
  initializeAudio() {
    const t = this.audioContext, n2 = t.destination.maxChannelCount;
    this.audioContext.destination.channelCount = n2, this.channelMerger = new ChannelMergerNode(t, { numberOfInputs: t.destination.channelCount }), this.destinationGain = new GainNode(t), this.channelMerger.connect(this.destinationGain), this.destinationGain.connect(t.destination);
  }
  reset() {
    this.disconnect(), this.initializeAudio();
  }
  disconnect() {
    this.channelMerger.disconnect(), this.destinationGain.disconnect(), this.destinationGain = null, this.channelMerger = null;
  }
  connectToDestination = (t, n2 = [0, 1]) => {
    const o = new StereoPannerNode(this.audioContext);
    t.connect(o);
    const a = new ChannelSplitterNode(this.audioContext, {
      numberOfOutputs: o.channelCount
    });
    o.connect(a), n2.forEach((c2, s) => {
      a.connect(this.channelMerger, s % o.channelCount, c2 % this.audioContext.destination.channelCount);
    });
  };
};
var uo2 = class {
  audioContext;
  output;
  nodes = {};
  buses = {};
  constructor(t) {
    this.audioContext = t, this.output = new po2(t);
  }
  reset() {
    Object.values(this.nodes).forEach((t) => {
      t.disconnect();
    }), Object.values(this.buses).forEach((t) => {
      t.disconnect();
    }), this.nodes = {}, this.buses = {}, this.output.reset();
  }
  duck(t, n2, o = 0, a = 0.1, c2 = 1) {
    const s = [t].flat(), d2 = [o].flat(), l2 = [a].flat(), i = [c2].flat();
    s.forEach((p, r) => {
      const h = this.nodes[p];
      if (h == null) {
        ct2(new Error(`duck target orbit ${p} does not exist`), "superdough");
        return;
      }
      const u2 = d2[r] ?? d2[0], m2 = Math.max(l2[r] ?? l2[0], 2e-3), G3 = i[r] ?? i[0];
      h.duck(n2, u2, m2, G3);
    });
  }
  getOrbit(t, n2) {
    return this.nodes[t] == null && (this.nodes[t] = new ro2(this.audioContext), this.output.connectToDestination(this.nodes[t].output, n2)), this.nodes[t];
  }
  getBus(t) {
    return this.buses[t] == null && (this.buses[t] = lt2(this.audioContext)), this.buses[t];
  }
};
var gt2 = Object.freeze({
  NONE: 0,
  ASYM: 1,
  MIRROR: 2,
  BENDP: 3,
  BENDM: 4,
  BENDMP: 5,
  SYNC: 6,
  QUANT: 7,
  FOLD: 8,
  PWM: 9,
  ORBIT: 10,
  SPIN: 11,
  CHAOS: 12,
  PRIMES: 13,
  BINARY: 14,
  BROWNIAN: 15,
  RECIPROCAL: 16,
  WORMHOLE: 17,
  LOGISTIC: 18,
  SIGMOID: 19,
  FRACTAL: 20,
  FLIP: 21
});
var ae2 = map();
function ce2(e, t, n2 = {}) {
  e = e.toLowerCase().replace(/\s+/g, "_"), ae2.setKey(e, { onTrigger: t, data: n2 });
}
var Ce2 = {
  s: "triangle",
  gain: 0.8,
  postgain: 1,
  density: ".03",
  channels: [1, 2],
  phaserdepth: 0.75,
  shapevol: 1,
  distortvol: 1,
  distorttype: 0,
  delay: 0,
  busgain: 1,
  byteBeatExpression: "0",
  delayfeedback: 0.5,
  delaysync: 3 / 16,
  orbit: 1,
  i: 1,
  velocity: 1,
  fft: 8,
  tremolodepth: 1,
  tremolophase: 0,
  release: 0.01
};
var Lo2 = Object.freeze({ ...Ce2 });
var bt2 = new Map(Object.entries(Ce2));
var cn2 = [];
function ac2(e) {
  cn2.push(e);
}
var ye2;
function Zt2() {
  return ye2 == null && (ye2 = new uo2(z2())), ye2;
}
function lc2(e, t) {
  Zt2().output.connectToDestination(e, t);
}
var ne2 = {};
var Le = {};
function ic2(e = "time", t = 1) {
  const n2 = {
    time: () => ne2[t]?.getFloatTimeDomainData(Le[t]),
    frequency: () => ne2[t]?.getFloatFrequencyData(Le[t])
  }[e];
  if (!n2)
    throw new Error(`getAnalyzerData: ${e} not supported. use one of ${Object.keys(n2).join(", ")}`);
  return n2(), Le[t];
}
var Tt = 2 * Math.PI;
var xe2;
var an2 = () => {
  xe2 && (xe2?.stop(), xe2?.node?.disconnect());
};
typeof window < "u" && window.addEventListener("message", (e) => {
  e.data === "strudel-stop" ? an2() : e.data?.dough && xe2?.node.port.postMessage(e.data);
});
function Gc2(e, t, n2, o) {
  window.postMessage({ time: o, dough: e.value, currentTime: t, duration: e.duration, cps: n2 });
}

// node_modules/supradough/dist/index.mjs
var H = "data:text/javascript;base64,dmFyIGF0PU9iamVjdC5kZWZpbmVQcm9wZXJ0eTt2YXIgaHQ9KHUsbSxmKT0+bSBpbiB1P2F0KHUsbSx7ZW51bWVyYWJsZTohMCxjb25maWd1cmFibGU6ITAsd3JpdGFibGU6ITAsdmFsdWU6Zn0pOnVbbV09Zjt2YXIgZT0odSxtLGYpPT5odCh1LHR5cGVvZiBtIT0ic3ltYm9sIj9tKyIiOm0sZik7KGZ1bmN0aW9uKCl7InVzZSBzdHJpY3QiO2NvbnN0IHU9dHlwZW9mIHNhbXBsZVJhdGU8InUiP3NhbXBsZVJhdGU6NDhlMyxtPU1hdGguUEkvdSxmPTEvdTtsZXQgVj1oPT5NYXRoLnBvdyhoLDIpO2Z1bmN0aW9uIF8oaCl7cmV0dXJuIFYoaCl9ZnVuY3Rpb24gTyhoLHMsdCl7Y29uc3QgaT1NYXRoLnNpbigoMS10KSouNSpNYXRoLlBJKSxuPU1hdGguc2luKHQqLjUqTWF0aC5QSSk7cmV0dXJuIGgqaStzKm59Y2xhc3MgZ3tjb25zdHJ1Y3Rvcigpe2UodGhpcywicGhhc2UiLDApfXVwZGF0ZShzKXtjb25zdCB0PU1hdGguc2luKHRoaXMucGhhc2UqMipNYXRoLlBJKTtyZXR1cm4gdGhpcy5waGFzZT0odGhpcy5waGFzZStzL3UpJTEsdH19Y2xhc3MgSXtjb25zdHJ1Y3Rvcigpe2UodGhpcywicGhhc2UiLDApfXVwZGF0ZShzKXtyZXR1cm4gdGhpcy5waGFzZSs9ZipzLHRoaXMucGhhc2UlMSoyLTF9fWZ1bmN0aW9uIE0oaCxzKXtyZXR1cm4gaDxzPyhoLz1zLGgraC1oKmgtMSk6aD4xLXM/KGg9KGgtMSkvcyxoKmgraCtoKzEpOjB9Y2xhc3MgU3tjb25zdHJ1Y3RvcihzPXt9KXt0aGlzLnBoYXNlPXMucGhhc2U/PzB9dXBkYXRlKHMpe2NvbnN0IHQ9cy91O2xldCBpPU0odGhpcy5waGFzZSx0KSxuPTIqdGhpcy5waGFzZS0xLWk7cmV0dXJuIHRoaXMucGhhc2UrPXQsdGhpcy5waGFzZT4xJiYodGhpcy5waGFzZS09MSksbn19ZnVuY3Rpb24gVChoLHMsdCl7cmV0dXJuIGg8Mj8wOigobixsLHIpPT5yKihsLW4pK24pKC1zKi41LHMqLjUsdC8oaC0xKSl9ZnVuY3Rpb24geihoLHMpe3JldHVybiBoKk1hdGgucG93KDIscy8xMil9Y2xhc3MgRntjb25zdHJ1Y3RvcihzPXt9KXt0aGlzLnZvaWNlcz1zLnZvaWNlcz8/NSx0aGlzLmZyZXFzcHJlYWQ9cy5mcmVxc3ByZWFkPz8uMix0aGlzLnBhbnNwcmVhZD1zLnBhbnNwcmVhZD8/LjQsdGhpcy5waGFzZT1uZXcgRmxvYXQzMkFycmF5KHRoaXMudm9pY2VzKS5tYXAoKCk9Pk1hdGgucmFuZG9tKCkpfXVwZGF0ZShzKXtjb25zdCB0PU1hdGguc3FydCgxLXRoaXMucGFuc3ByZWFkKSxpPU1hdGguc3FydCh0aGlzLnBhbnNwcmVhZCk7bGV0IG49MCxsPTA7Zm9yKGxldCByPTA7cjx0aGlzLnZvaWNlcztyKyspe2NvbnN0IGE9eihzLFQodGhpcy52b2ljZXMsdGhpcy5mcmVxc3ByZWFkLHIpKS91LGM9KHImMSk9PTE7bGV0IGQ9dDtjJiYoZD1pKTtsZXQgYj1NKHRoaXMucGhhc2Vbcl0sYSksRT0yKnRoaXMucGhhc2Vbcl0tMS1iO249bitFKmQsbD1sK0UqZCx0aGlzLnBoYXNlW3JdKz1hLHRoaXMucGhhc2Vbcl0+MSYmKHRoaXMucGhhc2Vbcl0tPTEpfXJldHVybiBuK2x9fWNsYXNzIGt7Y29uc3RydWN0b3IoKXtlKHRoaXMsInBoYXNlIiwwKX11cGRhdGUocyl7dGhpcy5waGFzZSs9ZipzO2xldCB0PXRoaXMucGhhc2UlMTtyZXR1cm4odDwuNT8yKnQ6MS0yKih0LS41KSkqMi0xfX1jbGFzcyBxe2NvbnN0cnVjdG9yKCl7ZSh0aGlzLCJzMCIsMCk7ZSh0aGlzLCJzMSIsMCl9dXBkYXRlKHMsdCxpPTApe2k9TWF0aC5tYXgoaSwwKSx0PU1hdGgubWluKHQsMmU0KTtjb25zdCBuPTIqTWF0aC5zaW4odCptKSxyPTEtTWF0aC5wb3coLjUsKGkrLjEyNSkvLjEyNSkqbjtyZXR1cm4gdGhpcy5zMD1yKnRoaXMuczAtbip0aGlzLnMxK24qcyx0aGlzLnMxPXIqdGhpcy5zMStuKnRoaXMuczAsdGhpcy5zMX19Y2xhc3MgQ3tjb25zdHJ1Y3RvcihzPTApe3RoaXMucGhhc2U9c31zYXcocyx0KXtsZXQgaT0odGhpcy5waGFzZStzKSUxLG49TShpLHQpO3JldHVybiAyKmktMS1ufXVwZGF0ZShzLHQ9LjUpe2NvbnN0IGk9cy91O2xldCBuPXRoaXMuc2F3KDAsaSktdGhpcy5zYXcodCxpKTtyZXR1cm4gdGhpcy5waGFzZT0odGhpcy5waGFzZStpKSUxLG4rdCoyLTF9fWNsYXNzIEx7Y29uc3RydWN0b3IoKXtlKHRoaXMsInBoYXNlIiwwKX11cGRhdGUocyx0PS41KXtyZXR1cm4gdGhpcy5waGFzZSs9ZipzLHRoaXMucGhhc2UlMTx0PzE6LTF9fWNsYXNzIFB7Y29uc3RydWN0b3IoKXtlKHRoaXMsInVwZGF0ZSIscz0+TWF0aC5yYW5kb20oKTxzKmY/TWF0aC5yYW5kb20oKTowKX19Y2xhc3MgTnt1cGRhdGUoKXtyZXR1cm4gTWF0aC5yYW5kb20oKSoyLTF9fWNsYXNzIEd7Y29uc3RydWN0b3IoKXt0aGlzLm91dD0wfXVwZGF0ZSgpe2xldCBzPU1hdGgucmFuZG9tKCkqMi0xO3JldHVybiB0aGlzLm91dD0odGhpcy5vdXQrLjAyKnMpLzEuMDIsdGhpcy5vdXR9fWNsYXNzIGp7Y29uc3RydWN0b3IoKXt0aGlzLmIwPTAsdGhpcy5iMT0wLHRoaXMuYjI9MCx0aGlzLmIzPTAsdGhpcy5iND0wLHRoaXMuYjU9MCx0aGlzLmI2PTB9dXBkYXRlKCl7Y29uc3Qgcz1NYXRoLnJhbmRvbSgpKjItMTt0aGlzLmIwPS45OTg4Nip0aGlzLmIwK3MqLjA1NTUxNzksdGhpcy5iMT0uOTkzMzIqdGhpcy5iMStzKi4wNzUwNzU5LHRoaXMuYjI9Ljk2OSp0aGlzLmIyK3MqLjE1Mzg1Mix0aGlzLmIzPS44NjY1KnRoaXMuYjMrcyouMzEwNDg1Nix0aGlzLmI0PS41NSp0aGlzLmI0K3MqLjUzMjk1MjIsdGhpcy5iNT0tLjc2MTYqdGhpcy5iNS1zKi4wMTY4OTg7Y29uc3QgdD10aGlzLmIwK3RoaXMuYjErdGhpcy5iMit0aGlzLmIzK3RoaXMuYjQrdGhpcy5iNSt0aGlzLmI2K3MqLjUzNjI7cmV0dXJuIHRoaXMuYjY9cyouMTE1OTI2LHQqLjExfX1jbGFzcyBCe2NvbnN0cnVjdG9yKCl7ZSh0aGlzLCJwaGFzZSIsMSl9dXBkYXRlKHMpe3RoaXMucGhhc2UrPWYqcztsZXQgdD10aGlzLnBoYXNlPj0xPzE6MDtyZXR1cm4gdGhpcy5waGFzZT10aGlzLnBoYXNlJTEsdH19ZnVuY3Rpb24gUihoLHMsdCxpPTEpe2lmKGg8PTApcmV0dXJuIHM7aWYoaD49MSlyZXR1cm4gdDtsZXQgbjtyZXR1cm4gaT09PTA/bj1oOmk+MD9uPU1hdGgucG93KGgsaSk6bj0xLU1hdGgucG93KDEtaCwtaSkscysodC1zKSpufWNsYXNzIHZ7Y29uc3RydWN0b3Iocz17fSl7dGhpcy5zdGF0ZT0ib2ZmIix0aGlzLnN0YXJ0VGltZT0wLHRoaXMuc3RhcnRWYWw9MCx0aGlzLmRlY2F5Q3VydmU9cy5kZWNheUN1cnZlPz8xfXVwZGF0ZShzLHQsaSxuLGwscil7c3dpdGNoKHRoaXMuc3RhdGUpe2Nhc2Uib2ZmIjpyZXR1cm4gdD4wJiYodGhpcy5zdGF0ZT0iYXR0YWNrIix0aGlzLnN0YXJ0VGltZT1zLHRoaXMuc3RhcnRWYWw9MCksMDtjYXNlImF0dGFjayI6e2xldCBwPXMtdGhpcy5zdGFydFRpbWU7cmV0dXJuIHA+aT8odGhpcy5zdGF0ZT0iZGVjYXkiLHRoaXMuc3RhcnRUaW1lPXMsMSk6UihwL2ksdGhpcy5zdGFydFZhbCwxLDEpfWNhc2UiZGVjYXkiOntsZXQgcD1zLXRoaXMuc3RhcnRUaW1lLGE9UihwL24sMSxsLC10aGlzLmRlY2F5Q3VydmUpO3JldHVybiB0PD0wPyh0aGlzLnN0YXRlPSJyZWxlYXNlIix0aGlzLnN0YXJ0VGltZT1zLHRoaXMuc3RhcnRWYWw9YSxhKTpwPm4/KHRoaXMuc3RhdGU9InN1c3RhaW4iLHRoaXMuc3RhcnRUaW1lPXMsbCk6YX1jYXNlInN1c3RhaW4iOnJldHVybiB0PD0wJiYodGhpcy5zdGF0ZT0icmVsZWFzZSIsdGhpcy5zdGFydFRpbWU9cyx0aGlzLnN0YXJ0VmFsPWwpLGw7Y2FzZSJyZWxlYXNlIjp7bGV0IHA9cy10aGlzLnN0YXJ0VGltZTtpZihwPnIpcmV0dXJuIHRoaXMuc3RhdGU9Im9mZiIsMDtsZXQgYT1SKHAvcix0aGlzLnN0YXJ0VmFsLDAsLXRoaXMuZGVjYXlDdXJ2ZSk7cmV0dXJuIHQ+MCYmKHRoaXMuc3RhdGU9ImF0dGFjayIsdGhpcy5zdGFydFRpbWU9cyx0aGlzLnN0YXJ0VmFsPWEpLGF9fXRocm93ImludmFsaWQgZW52ZWxvcGUgc3RhdGUifX1jb25zdCBXPTEwO2NsYXNzIHh7Y29uc3RydWN0b3IoKXtlKHRoaXMsIndyaXRlSWR4IiwwKTtlKHRoaXMsInJlYWRJZHgiLDApO2UodGhpcywiYnVmZmVyIixuZXcgRmxvYXQzMkFycmF5KFcqdSkpfXdyaXRlKHMsdCl7dGhpcy53cml0ZUlkeD0odGhpcy53cml0ZUlkeCsxKSV0aGlzLmJ1ZmZlci5sZW5ndGgsdGhpcy5idWZmZXJbdGhpcy53cml0ZUlkeF09cztsZXQgaT1NYXRoLm1pbihNYXRoLmZsb29yKHUqdCksdGhpcy5idWZmZXIubGVuZ3RoLTEpO3RoaXMucmVhZElkeD10aGlzLndyaXRlSWR4LWksdGhpcy5yZWFkSWR4PDAmJih0aGlzLnJlYWRJZHgrPXRoaXMuYnVmZmVyLmxlbmd0aCl9dXBkYXRlKHMsdCl7cmV0dXJuIHRoaXMud3JpdGUocyx0KSx0aGlzLmJ1ZmZlclt0aGlzLnJlYWRJZHhdfX1jbGFzcyBYe2NvbnN0cnVjdG9yKCl7ZSh0aGlzLCJkZWxheSIsbmV3IHgpO2UodGhpcywibW9kdWxhdG9yIixuZXcgayl9dXBkYXRlKHMsdCxpLG4sbCl7Y29uc3Qgcj10aGlzLm1vZHVsYXRvci51cGRhdGUobikqbCxwPXRoaXMuZGVsYXkudXBkYXRlKHMsaSooMStyKSk7cmV0dXJuIE8ocyxwLHQpfX1jbGFzcyAke2NvbnN0cnVjdG9yKCl7ZSh0aGlzLCJob2xkIiwwKTtlKHRoaXMsInQiLDApfXVwZGF0ZShzLHQpe3JldHVybiB0aGlzLnQrKyV0PT09MCYmKHRoaXMudD0wLHRoaXMuaG9sZD1zKSx0aGlzLmhvbGR9fWNsYXNzIFV7dXBkYXRlKHMsdCl7dD1NYXRoLm1heCgxLHQpO2NvbnN0IGk9TWF0aC5wb3coMix0LTEpO3JldHVybiBNYXRoLnJvdW5kKHMqaSkvaX19Y2xhc3MgWXt1cGRhdGUocyx0PTAsaT0xKXtpPU1hdGgubWF4KC4wMDEsTWF0aC5taW4oMSxpKSk7Y29uc3Qgbj1NYXRoLmV4cG0xKHQpO3JldHVybigxK24pKnMvKDErbipNYXRoLmFicyhzKSkqaX19Y2xhc3Mgd3tjb25zdHJ1Y3RvcihzLHQsaSl7ZSh0aGlzLCJidWZmZXIiKTtlKHRoaXMsInNhbXBsZVJhdGUiKTtlKHRoaXMsInBvcyIsMCk7ZSh0aGlzLCJzYW1wbGVGcmVxIixBKCkpO3RoaXMuYnVmZmVyPXMsdGhpcy5zYW1wbGVSYXRlPXQsdGhpcy5kdXJhdGlvbj10aGlzLmJ1ZmZlci5sZW5ndGgvdGhpcy5zYW1wbGVSYXRlLHRoaXMuc3BlZWQ9dS90aGlzLnNhbXBsZVJhdGUsaSYmKHRoaXMuc3BlZWQqPXRoaXMuZHVyYXRpb24pfXVwZGF0ZShzKXtpZih0aGlzLnBvcz49dGhpcy5idWZmZXIubGVuZ3RoKXJldHVybiAwO2NvbnN0IHQ9cy90aGlzLnNhbXBsZUZyZXEqdGhpcy5zcGVlZDtsZXQgaT10aGlzLmJ1ZmZlcltNYXRoLmZsb29yKHRoaXMucG9zKV07cmV0dXJuIHRoaXMucG9zPXRoaXMucG9zK3QsaX19ZSh3LCJzYW1wbGVzIixuZXcgTWFwKTtjb25zdCB5PShoLHM9ImxpbmVhciIsdCk9Pntjb25zdFtyLHAsYSxjXT1oO2lmKHI9PW51bGwmJnA9PW51bGwmJmE9PW51bGwmJmM9PW51bGwpcmV0dXJuIHQ/P1suMDAxLC4wMDEsMSwuMDFdO2NvbnN0IGQ9YT8/KHIhPW51bGwmJnA9PW51bGx8fHI9PW51bGwmJnA9PW51bGw/MTouMDAxKTtyZXR1cm5bTWF0aC5tYXgocj8/MCwuMDAxKSxNYXRoLm1heChwPz8wLC4wMDEpLE1hdGgubWluKGQsMSksTWF0aC5tYXgoYz8/MCwuMDEpXX07bGV0IEQ9e3NpbmU6ZyxzYXc6Uyx6YXc6SSxzYXd0b290aDpTLHphd3Rvb3RoOkksc3VwZXJzYXc6Rix0cmk6ayx0cmlhbmdsZTprLHB1bHNlOkMsc3F1YXJlOkMscHVsemU6TCxkdXN0OlAsY3JhY2tsZTpQLGltcHVsc2U6Qix3aGl0ZTpOLGJyb3duOkcscGluazpqfTtjb25zdCBaPXtjaG9ydXM6MCxub3RlOjQ4LHM6InRyaWFuZ2xlIixiYW5rOiIiLGdhaW46MSxwb3N0Z2FpbjoxLHZlbG9jaXR5OjEsZGVuc2l0eToiLjAzIixmdHlwZToiMTJkYiIsZmFuY2hvcjowLHJlc29uYW5jZTowLGhyZXNvbmFuY2U6MCxiYW5kcTowLGNoYW5uZWxzOlsxLDJdLHBoYXNlcmRlcHRoOi43NSxzaGFwZXZvbDoxLGRpc3RvcnR2b2w6MSxkZWxheTowLGJ5dGVCZWF0RXhwcmVzc2lvbjoiMCIsZGVsYXlmZWVkYmFjazouNSxkZWxheXNwZWVkOjEsZGVsYXl0aW1lOi4yNSxvcmJpdDoxLGk6MSxmZnQ6OCx6OiJ0cmlhbmdsZSIscGFuOi41LGZtaDoxLGZtZW52OjAsc3BlZWQ6MSxwdzouNX07bGV0IG89aD0+WltoXTtjb25zdCBIPXtjOjAsZDoyLGU6NCxmOjUsZzo3LGE6OSxiOjExfSxKPXsiIyI6MSxiOi0xLHM6MSxmOi0xfSxLPShoLHM9Myk9Pnt2YXIgYTtsZXRbdCxpPSIiLG49IiJdPSgoYT1TdHJpbmcoaCkubWF0Y2goL14oW2EtZ0EtR10pKFsjYnNmXSopKFswLTldKikkLykpPT1udWxsP3ZvaWQgMDphLnNsaWNlKDEpKXx8W107aWYoIXQpdGhyb3cgbmV3IEVycm9yKCdub3QgYSBub3RlOiAiJytoKyciJyk7Y29uc3QgbD1IW3QudG9Mb3dlckNhc2UoKV0scj0oaT09bnVsbD92b2lkIDA6aS5zcGxpdCgiIikucmVkdWNlKChjLGQpPT5jK0pbZF0sMCkpfHwwO3JldHVybihOdW1iZXIobnx8cykrMSkqMTIrbCtyfSxRPWg9Pk1hdGgucG93KDIsKGgtNjkpLzEyKSo0NDAsQT1oPT4oaD1ofHxvKCJub3RlIiksdHlwZW9mIGg9PSJzdHJpbmciJiYoaD1LKGgsMykpLFEoaCkpO2NsYXNzIHR0e2NvbnN0cnVjdG9yKHMpe2UodGhpcywiaWQiLDApO2UodGhpcywib3V0IixbMCwwXSk7ZSh0aGlzLCJhdHRhY2siKTtlKHRoaXMsImRlY2F5Iik7ZSh0aGlzLCJzdXN0YWluIik7ZSh0aGlzLCJyZWxlYXNlIik7ZSh0aGlzLCJfYmVnaW4iKTtlKHRoaXMsIl9kdXJhdGlvbiIpO2UodGhpcywiX3NvdW5kIik7ZSh0aGlzLCJfY2hhbm5lbHMiLDEpO2UodGhpcywiX2J1ZmZlcnMiKTtlKHRoaXMsInVuaXQiKTtlKHRoaXMsIl9wZW52Iik7ZSh0aGlzLCJwZW52Iik7ZSh0aGlzLCJwYXR0YWNrIik7ZSh0aGlzLCJwZGVjYXkiKTtlKHRoaXMsInBzdXN0YWluIik7ZSh0aGlzLCJwcmVsZWFzZSIpO2UodGhpcywidmliIik7ZSh0aGlzLCJfdmliIik7ZSh0aGlzLCJ2aWJtb2QiKTtlKHRoaXMsIl9mbSIpO2UodGhpcywiZm1oIik7ZSh0aGlzLCJmbWkiKTtlKHRoaXMsIl9mbWVudiIpO2UodGhpcywiZm1hdHRhY2siKTtlKHRoaXMsImZtZGVjYXkiKTtlKHRoaXMsImZtc3VzdGFpbiIpO2UodGhpcywiZm1yZWxlYXNlIik7ZSh0aGlzLCJfbHBlbnYiKTtlKHRoaXMsImxwZW52Iik7ZSh0aGlzLCJscGF0dGFjayIpO2UodGhpcywibHBkZWNheSIpO2UodGhpcywibHBzdXN0YWluIik7ZSh0aGlzLCJscHJlbGVhc2UiKTtlKHRoaXMsIl9ocGVudiIpO2UodGhpcywiaHBlbnYiKTtlKHRoaXMsImhwYXR0YWNrIik7ZSh0aGlzLCJocGRlY2F5Iik7ZSh0aGlzLCJocHN1c3RhaW4iKTtlKHRoaXMsImhwcmVsZWFzZSIpO2UodGhpcywiX2JwZW52Iik7ZSh0aGlzLCJicGVudiIpO2UodGhpcywiYnBhdHRhY2siKTtlKHRoaXMsImJwZGVjYXkiKTtlKHRoaXMsImJwc3VzdGFpbiIpO2UodGhpcywiYnByZWxlYXNlIik7ZSh0aGlzLCJjdXRvZmYiKTtlKHRoaXMsImhjdXRvZmYiKTtlKHRoaXMsImJhbmRmIik7ZSh0aGlzLCJjb2Fyc2UiKTtlKHRoaXMsImNydXNoIik7ZSh0aGlzLCJkaXN0b3J0Iik7ZSh0aGlzLCJmcmVxIik7ZSh0aGlzLCJub3RlIik7ZSh0aGlzLCJfbHBmIik7ZSh0aGlzLCJfaHBmIik7ZSh0aGlzLCJfYnBmIik7ZSh0aGlzLCJfY2hvcnVzIik7ZSh0aGlzLCJfY29hcnNlIik7ZSh0aGlzLCJfY3J1c2giKTtlKHRoaXMsIl9kaXN0b3J0Iik7dmFyIGksbixsLHIscCxhLGM7dGhpcy5mcmVxPz8odGhpcy5mcmVxPUEocy5ub3RlKSksdGhpcy5fYmVnaW49cy5fYmVnaW4sdGhpcy5fZHVyYXRpb249cy5fZHVyYXRpb24sdGhpcy5yZWxlYXNlPXMucmVsZWFzZT8/MDtsZXQgdD10aGlzO2lmKE9iamVjdC5hc3NpZ24odCxzKSx0LnM9dC5zPz9vKCJzIiksdC5nYWluPV8odC5nYWluPz9vKCJnYWluIikpLHQudmVsb2NpdHk9Xyh0LnZlbG9jaXR5Pz9vKCJ2ZWxvY2l0eSIpKSx0LnBvc3RnYWluPV8odC5wb3N0Z2Fpbj8/bygicG9zdGdhaW4iKSksdC5kZW5zaXR5PXQuZGVuc2l0eT8/bygiZGVuc2l0eSIpLHQuZmFuY2hvcj10LmZhbmNob3I/P28oImZhbmNob3IiKSx0LmRyaXZlPXQuZHJpdmU/Py42OSx0LnBoYXNlcmRlcHRoPXQucGhhc2VyZGVwdGg/P28oInBoYXNlcmRlcHRoIiksdC5zaGFwZXZvbD1fKHQuc2hhcGV2b2w/P28oInNoYXBldm9sIikpLHQuZGlzdG9ydHZvbD1fKHQuZGlzdG9ydHZvbD8/bygiZGlzdG9ydHZvbCIpKSx0Lmk9dC5pPz9vKCJpIiksdC5jaG9ydXM9dC5jaG9ydXM/P28oImNob3J1cyIpLHQuZmZ0PXQuZmZ0Pz9vKCJmZnQiKSx0LnBhbj10LnBhbj8/bygicGFuIiksdC5vcmJpdD10Lm9yYml0Pz9vKCJvcmJpdCIpLHQuZm1lbnY9dC5mbWVudj8/bygiZm1lbnYiKSx0LnJlc29uYW5jZT10LnJlc29uYW5jZT8/bygicmVzb25hbmNlIiksdC5ocmVzb25hbmNlPXQuaHJlc29uYW5jZT8/bygiaHJlc29uYW5jZSIpLHQuYmFuZHE9dC5iYW5kcT8/bygiYmFuZHEiKSx0LnNwZWVkPXQuc3BlZWQ/P28oInNwZWVkIiksdC5wdz10LnB3Pz9vKCJwdyIpLFt0LmF0dGFjayx0LmRlY2F5LHQuc3VzdGFpbix0LnJlbGVhc2VdPXkoW3QuYXR0YWNrLHQuZGVjYXksdC5zdXN0YWluLHQucmVsZWFzZV0pLHQuX2hvbGRFbmQ9dC5fYmVnaW4rdC5fZHVyYXRpb24sdC5fZW5kPXQuX2hvbGRFbmQrdC5yZWxlYXNlKy4wMSx0LmZtaSYmKHQucz09PSJzYXcifHx0LnM9PT0ic2F3dG9vdGgiKSYmKHQucz0iemF3IiksRFt0LnNdKXtjb25zdCBkPURbdC5zXTt0Ll9zb3VuZD1uZXcgZCx0Ll9jaGFubmVscz0xfWVsc2UgaWYody5zYW1wbGVzLmhhcyh0LnMpKXtjb25zdCBkPXcuc2FtcGxlcy5nZXQodC5zKTt0Ll9idWZmZXJzPVtdLHQuX2NoYW5uZWxzPWQuY2hhbm5lbHMubGVuZ3RoO2ZvcihsZXQgYj0wO2I8dC5fY2hhbm5lbHM7YisrKXQuX2J1ZmZlcnMucHVzaChuZXcgdyhkLmNoYW5uZWxzW2JdLGQuc2FtcGxlUmF0ZSx0LnVuaXQ9PT0iYyIpKX1lbHNlIGNvbnNvbGUud2Fybigic291bmQgbm90IGxvYWRlZCIsdC5zKTt0LnBlbnYmJih0Ll9wZW52PW5ldyB2KHtkZWNheUN1cnZlOjR9KSxbdC5wYXR0YWNrLHQucGRlY2F5LHQucHN1c3RhaW4sdC5wcmVsZWFzZV09eShbdC5wYXR0YWNrLHQucGRlY2F5LHQucHN1c3RhaW4sdC5wcmVsZWFzZV0pKSx0LnZpYiYmKHQuX3ZpYj1uZXcgZyx0LnZpYm1vZD10LnZpYm1vZD8/bygidmlibW9kIikpLHQuZm1pJiYodC5fZm09bmV3IGcsdC5mbWg9dC5mbWg/P28oImZtaCIpLHQuZm1lbnYmJih0Ll9mbWVudj1uZXcgdih7ZGVjYXlDdXJ2ZToyfSksW3QuZm1hdHRhY2ssdC5mbWRlY2F5LHQuZm1zdXN0YWluLHQuZm1yZWxlYXNlXT15KFt0LmZtYXR0YWNrLHQuZm1kZWNheSx0LmZtc3VzdGFpbix0LmZtcmVsZWFzZV0pKSksdC5fYWRzcj1uZXcgdih7ZGVjYXlDdXJ2ZToyfSksdC5kZWxheT1fKHQuZGVsYXk/P28oImRlbGF5IikpLHQuZGVsYXlmZWVkYmFjaz10LmRlbGF5ZmVlZGJhY2s/P28oImRlbGF5ZmVlZGJhY2siKSx0LmRlbGF5c3BlZWQ9dC5kZWxheXNwZWVkPz9vKCJkZWxheXNwZWVkIiksdC5kZWxheXRpbWU9dC5kZWxheXRpbWU/P28oImRlbGF5dGltZSIpLHQubHBlbnYmJih0Ll9scGVudj1uZXcgdih7ZGVjYXlDdXJ2ZTo0fSksW3QubHBhdHRhY2ssdC5scGRlY2F5LHQubHBzdXN0YWluLHQubHByZWxlYXNlXT15KFt0LmxwYXR0YWNrLHQubHBkZWNheSx0Lmxwc3VzdGFpbix0LmxwcmVsZWFzZV0pKSx0LmhwZW52JiYodC5faHBlbnY9bmV3IHYoe2RlY2F5Q3VydmU6NH0pLFt0LmhwYXR0YWNrLHQuaHBkZWNheSx0Lmhwc3VzdGFpbix0LmhwcmVsZWFzZV09eShbdC5ocGF0dGFjayx0LmhwZGVjYXksdC5ocHN1c3RhaW4sdC5ocHJlbGVhc2VdKSksdC5icGVudiYmKHQuX2JwZW52PW5ldyB2KHtkZWNheUN1cnZlOjR9KSxbdC5icGF0dGFjayx0LmJwZGVjYXksdC5icHN1c3RhaW4sdC5icHJlbGVhc2VdPXkoW3QuYnBhdHRhY2ssdC5icGRlY2F5LHQuYnBzdXN0YWluLHQuYnByZWxlYXNlXSkpLHQuX2Nob3J1cz10LmNob3J1cz9bXTpudWxsLHQuX2xwZj10LmN1dG9mZj9bXTpudWxsLHQuX2hwZj10LmhjdXRvZmY/W106bnVsbCx0Ll9icGY9dC5iYW5kZj9bXTpudWxsLHQuX2NvYXJzZT10LmNvYXJzZT9bXTpudWxsLHQuX2NydXNoPXQuY3J1c2g/W106bnVsbCx0Ll9kaXN0b3J0PXQuZGlzdG9ydD9bXTpudWxsO2ZvcihsZXQgZD0wO2Q8dGhpcy5fY2hhbm5lbHM7ZCsrKShpPXQuX2xwZik9PW51bGx8fGkucHVzaChuZXcgcSksKG49dC5faHBmKT09bnVsbHx8bi5wdXNoKG5ldyBxKSwobD10Ll9icGYpPT1udWxsfHxsLnB1c2gobmV3IHEpLChyPXQuX2Nob3J1cyk9PW51bGx8fHIucHVzaChuZXcgWCksKHA9dC5fY29hcnNlKT09bnVsbHx8cC5wdXNoKG5ldyAkKSwoYT10Ll9jcnVzaCk9PW51bGx8fGEucHVzaChuZXcgVSksKGM9dC5fZGlzdG9ydCk9PW51bGx8fGMucHVzaChuZXcgWSl9dXBkYXRlKHMpe2lmKCF0aGlzLl9zb3VuZCYmIXRoaXMuX2J1ZmZlcnMpcmV0dXJuIDA7bGV0IHQ9KyhzPj10aGlzLl9iZWdpbiYmczw9dGhpcy5faG9sZEVuZCksaT10aGlzLmZyZXEqdGhpcy5zcGVlZDtpZih0aGlzLl9mbSYmdGhpcy5mbWghPT12b2lkIDAmJnRoaXMuZm1pIT09dm9pZCAwKXtsZXQgYT10aGlzLmZtaTtpZih0aGlzLl9mbWVudil7Y29uc3QgYj10aGlzLl9mbWVudi51cGRhdGUocyx0LHRoaXMuZm1hdHRhY2ssdGhpcy5mbWRlY2F5LHRoaXMuZm1zdXN0YWluLHRoaXMuZm1yZWxlYXNlKTthPXRoaXMuZm1lbnYqYiphfWNvbnN0IGM9aSp0aGlzLmZtaCxkPWMqYTtpPWkrdGhpcy5fZm0udXBkYXRlKGMpKmR9aWYodGhpcy5fdmliJiZ0aGlzLnZpYm1vZCE9PXZvaWQgMCYmKGk9aSoyKioodGhpcy5fdmliLnVwZGF0ZSh0aGlzLnZpYikqdGhpcy52aWJtb2QvMTIpKSx0aGlzLl9wZW52JiZ0aGlzLnBlbnYhPT12b2lkIDApe2NvbnN0IGE9dGhpcy5fcGVudi51cGRhdGUocyx0LHRoaXMucGF0dGFjayx0aGlzLnBkZWNheSx0aGlzLnBzdXN0YWluLHRoaXMucHJlbGVhc2UpO2k9aSthKnRoaXMucGVudn1sZXQgbj10aGlzLmN1dG9mZjtpZihuIT09dm9pZCAwJiZ0aGlzLl9scGVudil7Y29uc3QgYT10aGlzLl9scGVudi51cGRhdGUocyx0LHRoaXMubHBhdHRhY2ssdGhpcy5scGRlY2F5LHRoaXMubHBzdXN0YWluLHRoaXMubHByZWxlYXNlKTtuPXRoaXMubHBlbnYqYSpuK259bGV0IGw9dGhpcy5oY3V0b2ZmO2lmKGwhPT12b2lkIDAmJnRoaXMuX2hwZW52JiZ0aGlzLmhwZW52IT09dm9pZCAwKXtjb25zdCBhPXRoaXMuX2hwZW52LnVwZGF0ZShzLHQsdGhpcy5ocGF0dGFjayx0aGlzLmhwZGVjYXksdGhpcy5ocHN1c3RhaW4sdGhpcy5ocHJlbGVhc2UpO2w9MioqdGhpcy5ocGVudiphKmwrbH1sZXQgcj10aGlzLmJhbmRmO2lmKHIhPT12b2lkIDAmJnRoaXMuX2JwZW52JiZ0aGlzLmJwZW52IT09dm9pZCAwKXtjb25zdCBhPXRoaXMuX2JwZW52LnVwZGF0ZShzLHQsdGhpcy5icGF0dGFjayx0aGlzLmJwZGVjYXksdGhpcy5icHN1c3RhaW4sdGhpcy5icHJlbGVhc2UpO3I9MioqdGhpcy5icGVudiphKnIrcn1jb25zdCBwPXRoaXMuX2Fkc3IudXBkYXRlKHMsdCx0aGlzLmF0dGFjayx0aGlzLmRlY2F5LHRoaXMuc3VzdGFpbix0aGlzLnJlbGVhc2UpO2ZvcihsZXQgYT0wO2E8dGhpcy5fY2hhbm5lbHM7YSsrKXtpZih0aGlzLl9zb3VuZCYmdGhpcy5zPT09InB1bHNlIj90aGlzLm91dFthXT10aGlzLl9zb3VuZC51cGRhdGUoaSx0aGlzLnB3KTp0aGlzLl9zb3VuZD90aGlzLm91dFthXT10aGlzLl9zb3VuZC51cGRhdGUoaSk6dGhpcy5fYnVmZmVycyYmKHRoaXMub3V0W2FdPXRoaXMuX2J1ZmZlcnNbYV0udXBkYXRlKGkpKSx0aGlzLm91dFthXT10aGlzLm91dFthXSp0aGlzLmdhaW4qdGhpcy52ZWxvY2l0eSx0aGlzLl9jaG9ydXMpe2NvbnN0IGM9dGhpcy5fY2hvcnVzW2FdLnVwZGF0ZSh0aGlzLm91dFthXSx0aGlzLmNob3J1cywuMDMrLjA1KmEsMSwuMTEpO3RoaXMub3V0W2FdPWMrdGhpcy5vdXRbYV19dGhpcy5fbHBmJiYodGhpcy5fbHBmW2FdLnVwZGF0ZSh0aGlzLm91dFthXSxuLHRoaXMucmVzb25hbmNlKSx0aGlzLm91dFthXT10aGlzLl9scGZbYV0uczEpLHRoaXMuX2hwZiYmKHRoaXMuX2hwZlthXS51cGRhdGUodGhpcy5vdXRbYV0sbCx0aGlzLmhyZXNvbmFuY2UpLHRoaXMub3V0W2FdPXRoaXMub3V0W2FdLXRoaXMuX2hwZlthXS5zMSksdGhpcy5fYnBmJiYodGhpcy5fYnBmW2FdLnVwZGF0ZSh0aGlzLm91dFthXSxyLHRoaXMuYmFuZHEpLHRoaXMub3V0W2FdPXRoaXMuX2JwZlthXS5zMCksdGhpcy5fY29hcnNlJiYodGhpcy5vdXRbYV09dGhpcy5fY29hcnNlW2FdLnVwZGF0ZSh0aGlzLm91dFthXSx0aGlzLmNvYXJzZSkpLHRoaXMuX2NydXNoJiYodGhpcy5vdXRbYV09dGhpcy5fY3J1c2hbYV0udXBkYXRlKHRoaXMub3V0W2FdLHRoaXMuY3J1c2gpKSx0aGlzLl9kaXN0b3J0JiYodGhpcy5vdXRbYV09dGhpcy5fZGlzdG9ydFthXS51cGRhdGUodGhpcy5vdXRbYV0sdGhpcy5kaXN0b3J0LHRoaXMuZGlzdG9ydHZvbCkpLHRoaXMub3V0W2FdPXRoaXMub3V0W2FdKnAsdGhpcy5vdXRbYV09dGhpcy5vdXRbYV0qdGhpcy5wb3N0Z2Fpbix0aGlzLl9idWZmZXJzfHwodGhpcy5vdXRbYV09dGhpcy5vdXRbYV0qLjIpfWlmKHRoaXMuX2NoYW5uZWxzPT09MSYmKHRoaXMub3V0WzFdPXRoaXMub3V0WzBdKSx0aGlzLnBhbiE9PS41KXtjb25zdCBhPXRoaXMucGFuKk1hdGguUEkvMjt0aGlzLm91dFswXT10aGlzLm91dFswXSpNYXRoLmNvcyhhKSx0aGlzLm91dFsxXT10aGlzLm91dFsxXSpNYXRoLnNpbihhKX19fWNsYXNzIHN0e2NvbnN0cnVjdG9yKHM9NDhlMyx0PTApe2UodGhpcywidm9pY2VzIixbXSk7ZSh0aGlzLCJ2aWQiLDApO2UodGhpcywicSIsW10pO2UodGhpcywib3V0IixbMCwwXSk7ZSh0aGlzLCJkZWxheXNlbmQiLFswLDBdKTtlKHRoaXMsImRlbGF5dGltZSIsbygiZGVsYXl0aW1lIikpO2UodGhpcywiZGVsYXlmZWVkYmFjayIsbygiZGVsYXlmZWVkYmFjayIpKTtlKHRoaXMsImRlbGF5c3BlZWQiLG8oImRlbGF5c3BlZWQiKSk7ZSh0aGlzLCJ0IiwwKTt0aGlzLnNhbXBsZVJhdGU9cyx0aGlzLnQ9TWF0aC5mbG9vcih0KnMpLHRoaXMuX2RlbGF5TD1uZXcgeCx0aGlzLl9kZWxheVI9bmV3IHh9bG9hZFNhbXBsZShzLHQsaSl7dy5zYW1wbGVzLnNldChzLHtjaGFubmVsczp0LHNhbXBsZVJhdGU6aX0pfXNjaGVkdWxlU3Bhd24ocyl7aWYocy5fYmVnaW49PT12b2lkIDApdGhyb3cgbmV3IEVycm9yKCJbZG91Z2hdOiBzY2hlZHVsZVNwYXduIGV4cGVjdGVkIF9iZWdpbiB0byBiZSBzZXQiKTtpZihzLl9kdXJhdGlvbj09PXZvaWQgMCl0aHJvdyBuZXcgRXJyb3IoIltkb3VnaF06IHNjaGVkdWxlU3Bhd24gZXhwZWN0ZWQgX2R1cmF0aW9uIHRvIGJlIHNldCIpO3Muc2FtcGxlUmF0ZT10aGlzLnNhbXBsZVJhdGU7Y29uc3QgdD1NYXRoLmZsb29yKHMuX2JlZ2luKnRoaXMuc2FtcGxlUmF0ZSk7dGhpcy5zY2hlZHVsZSh7dGltZTp0LHR5cGU6InNwYXduIixhcmc6c30pfXNwYXduKHMpe3MuaWQ9dGhpcy52aWQrKztjb25zdCB0PW5ldyB0dChzKTt0aGlzLnZvaWNlcy5wdXNoKHQpO2NvbnN0IGk9TWF0aC5jZWlsKHQuX2VuZCp0aGlzLnNhbXBsZVJhdGUpO3RoaXMuc2NoZWR1bGUoe3RpbWU6aSx0eXBlOiJkZXNwYXduIixhcmc6dC5pZH0pfWRlc3Bhd24ocyl7dGhpcy52b2ljZXM9dGhpcy52b2ljZXMuZmlsdGVyKHQ9PnQuaWQhPT1zKX1zY2hlZHVsZShzKXtpZighdGhpcy5xLmxlbmd0aCl7dGhpcy5xLnB1c2gocyk7cmV0dXJufWxldCB0PTA7Zm9yKDt0PHRoaXMucS5sZW5ndGgmJnRoaXMucVt0XS50aW1lPHMudGltZTspdCsrO3RoaXMucS5zcGxpY2UodCwwLHMpfXVwZGF0ZSgpe2Zvcig7dGhpcy5xLmxlbmd0aD4wJiZ0aGlzLnFbMF0udGltZTw9dGhpcy50Oyl0aGlzW3RoaXMucVswXS50eXBlXSh0aGlzLnFbMF0uYXJnKSx0aGlzLnEuc2hpZnQoKTt0aGlzLm91dFswXT0wLHRoaXMub3V0WzFdPTA7Zm9yKGxldCBpPTA7aTx0aGlzLnZvaWNlcy5sZW5ndGg7aSsrKXRoaXMudm9pY2VzW2ldLnVwZGF0ZSh0aGlzLnQvdGhpcy5zYW1wbGVSYXRlKSx0aGlzLm91dFswXSs9dGhpcy52b2ljZXNbaV0ub3V0WzBdLHRoaXMub3V0WzFdKz10aGlzLnZvaWNlc1tpXS5vdXRbMV0sdGhpcy52b2ljZXNbaV0uZGVsYXkmJih0aGlzLmRlbGF5c2VuZFswXSs9dGhpcy52b2ljZXNbaV0ub3V0WzBdKnRoaXMudm9pY2VzW2ldLmRlbGF5LHRoaXMuZGVsYXlzZW5kWzFdKz10aGlzLnZvaWNlc1tpXS5vdXRbMV0qdGhpcy52b2ljZXNbaV0uZGVsYXksdGhpcy5kZWxheXRpbWU9dGhpcy52b2ljZXNbaV0uZGVsYXl0aW1lLHRoaXMuZGVsYXlzcGVlZD10aGlzLnZvaWNlc1tpXS5kZWxheXNwZWVkLHRoaXMuZGVsYXlmZWVkYmFjaz10aGlzLnZvaWNlc1tpXS5kZWxheWZlZWRiYWNrKTtjb25zdCBzPXRoaXMuX2RlbGF5TC51cGRhdGUodGhpcy5kZWxheXNlbmRbMF0sdGhpcy5kZWxheXRpbWUpLHQ9dGhpcy5fZGVsYXlSLnVwZGF0ZSh0aGlzLmRlbGF5c2VuZFsxXSx0aGlzLmRlbGF5dGltZSk7dGhpcy5kZWxheXNlbmRbMF09cyp0aGlzLmRlbGF5ZmVlZGJhY2ssdGhpcy5kZWxheXNlbmRbMV09dCp0aGlzLmRlbGF5ZmVlZGJhY2ssdGhpcy5vdXRbMF0rPXMsdGhpcy5vdXRbMV0rPXQsdGhpcy50Kyt9fWNvbnN0IGV0PShoLHMsdCk9Pk1hdGgubWluKE1hdGgubWF4KGgscyksdCk7Y2xhc3MgaXQgZXh0ZW5kcyBBdWRpb1dvcmtsZXRQcm9jZXNzb3J7Y29uc3RydWN0b3IoKXtzdXBlcigpLHRoaXMuZG91Z2g9bmV3IHN0KHNhbXBsZVJhdGUsY3VycmVudFRpbWUpLHRoaXMucG9ydC5vbm1lc3NhZ2U9cz0+e3MuZGF0YS5zcGF3bj90aGlzLmRvdWdoLnNjaGVkdWxlU3Bhd24ocy5kYXRhLnNwYXduKTpzLmRhdGEuc2FtcGxlP3RoaXMuZG91Z2gubG9hZFNhbXBsZShzLmRhdGEuc2FtcGxlLHMuZGF0YS5jaGFubmVscyxzLmRhdGEuc2FtcGxlUmF0ZSk6cy5kYXRhLnNhbXBsZXM/cy5kYXRhLnNhbXBsZXMuZm9yRWFjaCgoW3QsaSxuXSk9Pnt0aGlzLmRvdWdoLmxvYWRTYW1wbGUodCxpLG4pfSk6Y29uc29sZS5sb2coInVucmVjb2duaXplZCBldmVudCB0eXBlIixzLmRhdGEpfX1wcm9jZXNzKHMsdCxpKXtpZih0aGlzLmRpc2Nvbm5lY3RlZClyZXR1cm4hMTtjb25zdCBuPXRbMF07Zm9yKGxldCBsPTA7bDxuWzBdLmxlbmd0aDtsKyspe3RoaXMuZG91Z2gudXBkYXRlKCk7Zm9yKGxldCByPTA7cjxuLmxlbmd0aDtyKyspbltyXVtsXT1ldCh0aGlzLmRvdWdoLm91dFtyXSwtMSwxKX1yZXR1cm4hMH19cmVnaXN0ZXJQcm9jZXNzb3IoImRvdWdoLXByb2Nlc3NvciIsaXQpfSkoKTsK";
var u = typeof sampleRate < "u" ? sampleRate : 48e3;
var k = Math.PI / u;
var n = 1 / u;
var us2 = H;

// node_modules/@strudel/draw/dist/index.mjs
var Z2 = (t = "test-canvas", e) => {
  let { contextType: n2 = "2d", pixelated: o = false, pixelRatio: a = window.devicePixelRatio } = e || {}, r = document.querySelector("#" + t);
  if (!r) {
    r = document.createElement("canvas"), r.id = t, r.width = window.innerWidth * a, r.height = window.innerHeight * a, r.style = "pointer-events:none;width:100%;height:100%;position:fixed;top:0;left:0", o && (r.style.imageRendering = "pixelated"), document.body.prepend(r);
    let l2;
    window.addEventListener("resize", () => {
      l2 && clearTimeout(l2), l2 = setTimeout(() => {
        r.width = window.innerWidth * a, r.height = window.innerHeight * a;
      }, 200);
    });
  }
  return r.getContext(n2, { willReadFrequently: true });
};
var $3 = {};
function pe3(t) {
  $3[t] !== void 0 && (cancelAnimationFrame($3[t]), delete $3[t]);
}
var R2 = {};
f.prototype.draw = function(t, e) {
  if (typeof window > "u")
    return this;
  let { id: n2 = 1, lookbehind: o = 0, lookahead: a = 0 } = e, r = Math.max(Wy(), 0);
  pe3(n2), o = Math.abs(o), R2[n2] = (R2[n2] || []).filter((g) => !g.isInFuture(r));
  let l2 = this.queryArc(r, r + a).filter((g) => g.hasOnset());
  R2[n2] = R2[n2].concat(l2);
  let f2;
  const i = () => {
    const g = Wy(), u2 = g + a;
    R2[n2] = R2[n2].filter((d2) => d2.isInNearPast(o, g));
    let c2 = Math.max(f2 || u2, u2 - 1 / 10);
    const b = this.queryArc(c2, u2).filter((d2) => d2.hasOnset());
    R2[n2] = R2[n2].concat(b), f2 = u2, t(R2[n2], g, u2, this), $3[n2] = requestAnimationFrame(i);
  };
  return $3[n2] = requestAnimationFrame(i), this;
};
f.prototype.onPaint = function(t) {
  return this.withState((e) => (e.controls.painters || (e.controls.painters = []), e.controls.painters.push(t), e));
};
f.prototype.getPainters = function() {
  let t = [];
  return this.queryArc(0, 0, { painters: t }), t;
};
var ye3 = {
  background: "#222",
  foreground: "#75baff",
  caret: "#ffcc00",
  selection: "rgba(128, 203, 196, 0.5)",
  selectionMatch: "#036dd626",
  lineHighlight: "#00000050",
  gutterBackground: "transparent",
  gutterForeground: "#8a919966"
};
function W2() {
  return ye3;
}
var fe3 = "#22222210";
f.prototype.animate = function({ callback: t, sync: e = false, smear: n2 = 0.5 } = {}) {
  window.frame && cancelAnimationFrame(window.frame);
  const o = Z2();
  let { clientWidth: a, clientHeight: r } = o.canvas;
  a *= window.devicePixelRatio, r *= window.devicePixelRatio;
  let l2 = n2 === 0 ? "99" : Number((1 - n2) * 100).toFixed(0);
  l2 = l2.length === 1 ? `0${l2}` : l2, fe3 = `#200010${l2}`;
  const f2 = (i) => {
    let g;
    i = Math.round(i), g = this.slow(1e3).queryArc(i, i), o.fillStyle = fe3, o.fillRect(0, 0, a, r), g.forEach((u2) => {
      let { x: c2, y: b, w: d2, h: w2, s: p, r: k3, angle: h = 0, fill: S2 = "darkseagreen" } = u2.value;
      if (d2 *= a, w2 *= r, k3 !== void 0 && h !== void 0) {
        const v = h * 2 * Math.PI, [y2, P2] = [(a - d2) / 2, (r - w2) / 2];
        c2 = y2 + Math.cos(v) * k3 * y2, b = P2 + Math.sin(v) * k3 * P2;
      } else
        c2 *= a - d2, b *= r - w2;
      const A2 = { ...u2.value, x: c2, y: b, w: d2, h: w2 };
      o.fillStyle = S2, p === "rect" ? o.fillRect(c2, b, d2, w2) : p === "ellipse" && (o.beginPath(), o.ellipse(c2 + d2 / 2, b + w2 / 2, d2 / 2, w2 / 2, 0, 0, 2 * Math.PI), o.fill()), t && t(o, A2, u2);
    }), window.frame = requestAnimationFrame(f2);
  };
  return window.frame = requestAnimationFrame(f2), q;
};
var { x: we2, y: xe3, w: et2, h: tt, angle: nt, r: rt2, fill: at2, smear: ot2 } = Cp("x", "y", "w", "h", "angle", "r", "fill", "smear");
var it2 = l("rescale", function(t, e) {
  return e.mul(we2(t).w(t).y(t).h(t));
});
var lt3 = l("moveXY", function(t, e, n2) {
  return n2.add(we2(t).y(e));
});
var st = l("zoomIn", function(t, e) {
  const n2 = C(1).sub(t).div(2);
  return e.rescale(t).move(n2, n2);
});
var G2 = (t, e, n2) => t * (n2 - e) + e;
var he2 = (t) => {
  let { value: e } = t;
  typeof t.value != "object" && (e = { value: e });
  let { note: n2, n: o, freq: a, s: r } = e;
  if (a)
    return Ze(a);
  if (n2 = n2 ?? o, typeof n2 == "string")
    try {
      return gt(n2);
    } catch {
      return 0;
    }
  return typeof n2 == "number" ? n2 : r ? "_" + r : e;
};
f.prototype.pianoroll = function(t = {}) {
  let { cycles: e = 4, playhead: n2 = 0.5, overscan: o = 0, hideNegative: a = false, ctx: r = Z2(), id: l2 = 1 } = t, f2 = -e * n2, i = e * (1 - n2);
  const g = (u2, c2) => (!a || u2.whole.begin >= 0) && u2.isWithinTime(c2 + f2, c2 + i);
  return this.draw(
    (u2, c2) => {
      ee2({
        ...t,
        time: c2,
        ctx: r,
        haps: u2.filter((b) => g(b, c2))
      });
    },
    {
      lookbehind: f2 - o,
      lookahead: i + o,
      id: l2
    }
  ), this;
};
function ee2({
  time: t,
  haps: e,
  cycles: n2 = 4,
  playhead: o = 0.5,
  flipTime: a = 0,
  flipValues: r = 0,
  hideNegative: l2 = false,
  inactive: f2 = W2().foreground,
  active: i = W2().foreground,
  background: g = "transparent",
  smear: u2 = 0,
  playheadColor: c2 = W2().foreground,
  minMidi: b = 10,
  maxMidi: d2 = 90,
  autorange: w2 = 0,
  timeframe: p,
  fold: k3 = 1,
  vertical: h = 0,
  labels: S2 = false,
  fill: A2 = 1,
  fillActive: v = false,
  strokeActive: y2 = true,
  stroke: P2,
  hideInactive: H3 = 0,
  colorizeInactive: q4 = 1,
  fontFamily: C3,
  ctx: s,
  id: _4
} = {}) {
  const T2 = s.canvas.width, I = s.canvas.height;
  let z3 = -n2 * o, j4 = n2 * (1 - o);
  _4 && (e = e.filter((m2) => m2.hasTag(_4))), p && (console.warn("timeframe is deprecated! use from/to instead"), z3 = 0, j4 = p);
  const N2 = h ? I : T2, E3 = h ? T2 : I;
  let L3 = h ? [N2, 0] : [0, N2];
  const J2 = j4 - z3, te2 = h ? [0, E3] : [E3, 0];
  let K2 = d2 - b + 1, D = E3 / K2, Q2 = [];
  a && L3.reverse(), r && te2.reverse();
  const { min: ke2, max: Pe2, values: Te3 } = e.reduce(
    ({ min: m2, max: F3, values: X }, Y3) => {
      const M = he2(Y3);
      return {
        min: M < m2 ? M : m2,
        max: M > F3 ? M : F3,
        values: X.includes(M) ? X : [...X, M]
      };
    },
    { min: 1 / 0, max: -1 / 0, values: [] }
  );
  w2 && (b = ke2, d2 = Pe2, K2 = d2 - b + 1), Q2 = Te3.sort(
    (m2, F3) => typeof m2 == "number" && typeof F3 == "number" ? m2 - F3 : typeof m2 == "number" ? 1 : String(m2).localeCompare(String(F3))
  ), D = k3 ? E3 / Q2.length : E3 / K2, s.fillStyle = g, s.globalAlpha = 1, u2 || (s.clearRect(0, 0, T2, I), s.fillRect(0, 0, T2, I)), e.forEach((m2) => {
    const F3 = m2.whole.begin <= t && m2.endClipped > t;
    let X = P2 ?? (y2 && F3), Y3 = !F3 && A2 || F3 && v;
    if (H3 && !F3)
      return;
    let M = m2.value?.color;
    i = M || i, f2 = q4 && M || f2, M = F3 ? i : f2, s.fillStyle = Y3 ? M : "transparent", s.strokeStyle = M;
    const { velocity: Ae3 = 1, gain: qe2 = 1 } = m2.value || {};
    s.globalAlpha = Ae3 * qe2;
    const Fe = (m2.whole.begin - (a ? j4 : z3)) / J2, ne3 = G2(Fe, ...L3);
    let B2 = G2(m2.duration / J2, 0, N2);
    const re3 = he2(m2), Me3 = k3 ? Q2.indexOf(re3) / Q2.length : (Number(re3) - b) / K2, ae3 = G2(Me3, ...te2);
    let oe2 = 0;
    const ie3 = G2(t / J2, ...L3);
    let V3;
    if (h ? V3 = [
      ae3 + 1 - (r ? D : 0),
      // x
      N2 - ie3 + ne3 + oe2 + 1 - (a ? 0 : B2),
      // y
      D - 2,
      // width
      B2 - 2
      // height
    ] : V3 = [
      ne3 - ie3 + oe2 + 1 - (a ? B2 : 0),
      // x
      ae3 + 1 - (r ? 0 : D),
      // y
      B2 - 2,
      // widith
      D - 2
      // height
    ], X && s.strokeRect(...V3), Y3 && s.fillRect(...V3), S2) {
      const Se2 = m2.value.note ?? m2.value.s + (m2.value.n ? `:${m2.value.n}` : ""), { label: le2, activeLabel: Ce4 } = m2.value, He2 = (F3 && Ce4 || le2) ?? Se2;
      let Ie = h ? B2 : D * 0.75;
      s.font = `${Ie}px ${C3 || "monospace"}`, s.fillStyle = /* isActive &&  */
      Y3 ? "black" : M, s.textBaseline = "top", s.fillText(He2, ...V3);
    }
  }), s.globalAlpha = 1;
  const U2 = G2(-z3 / J2, ...L3);
  return s.strokeStyle = c2, s.beginPath(), h ? (s.moveTo(0, U2), s.lineTo(E3, U2)) : (s.moveTo(U2, 0), s.lineTo(U2, E3)), s.stroke(), this;
}
function ve2(t, e = {}) {
  let [n2, o] = t;
  n2 = Math.abs(n2);
  const a = o + n2, r = a !== 0 ? n2 / a : 0;
  return { fold: 1, ...e, cycles: a, playhead: r };
}
var je2 = (t = {}) => (e, n2, o, a) => ee2({ ctx: e, time: n2, haps: o, ...ve2(a, t) });
f.prototype.punchcard = function(t) {
  return this.onPaint(je2(t));
};
f.prototype.wordfall = function(t) {
  return this.punchcard({ vertical: 1, labels: 1, stroke: 0, fillActive: 1, active: "white", ...t });
};
function Xe2(t, e, n2, o) {
  const a = (t - 90) * Math.PI / 180;
  return [n2 + Math.cos(a) * e, o + Math.sin(a) * e];
}
var ue3 = (t, e, n2, o, a = 0) => Xe2((t + a) * 360, e * t, n2, o);
function me2(t) {
  let {
    ctx: e,
    from: n2 = 0,
    to: o = 3,
    margin: a = 50,
    cx: r = 100,
    cy: l2 = 100,
    rotate: f2 = 0,
    thickness: i = a / 2,
    color: g = W2().foreground,
    cap: u2 = "round",
    stretch: c2 = 1,
    fromOpacity: b = 1,
    toOpacity: d2 = 1
  } = t;
  n2 *= c2, o *= c2, f2 *= c2, e.lineWidth = i, e.lineCap = u2, e.strokeStyle = g, e.globalAlpha = b, e.beginPath();
  let [w2, p] = ue3(n2, a, r, l2, f2);
  e.moveTo(w2, p);
  const k3 = 1 / 60;
  let h = n2;
  for (; h <= o; ) {
    const [S2, A2] = ue3(h, a, r, l2, f2);
    e.globalAlpha = (h - n2) / (o - n2) * d2, e.lineTo(S2, A2), h += k3;
  }
  e.stroke();
}
function Ye2(t) {
  let {
    stretch: e = 1,
    size: n2 = 80,
    thickness: o = n2 / 2,
    cap: a = "butt",
    // round butt squar,
    inset: r = 3,
    // start angl,
    playheadColor: l2 = "#ffffff",
    playheadLength: f2 = 0.02,
    playheadThickness: i = o,
    padding: g = 0,
    steady: u2 = 1,
    activeColor: c2 = W2().foreground,
    inactiveColor: b = W2().gutterForeground,
    colorizeInactive: d2 = 0,
    fade: w2 = true,
    // logSpiral = true,
    ctx: p,
    time: k3,
    haps: h,
    drawTime: S2,
    id: A2
  } = t;
  A2 && (h = h.filter((T2) => T2.hasTag(A2)));
  const [v, y2] = [p.canvas.width, p.canvas.height];
  p.clearRect(0, 0, v * 2, y2 * 2);
  const [P2, H3] = [v / 2, y2 / 2], q4 = {
    margin: n2 / e,
    cx: P2,
    cy: H3,
    stretch: e,
    cap: a,
    thickness: o
  }, C3 = {
    ...q4,
    thickness: i,
    from: r - f2,
    to: r,
    color: l2
  }, [s] = S2, _4 = u2 * k3;
  h.forEach((T2) => {
    const I = T2.whole.begin <= k3 && T2.endClipped > k3, z3 = T2.whole.begin - k3 + r, j4 = T2.endClipped - k3 + r - g, N2 = T2.value?.color || c2, E3 = d2 || I ? N2 : b, L3 = w2 ? 1 - Math.abs((T2.whole.begin - k3) / s) : 1;
    me2({
      ctx: p,
      ...q4,
      from: z3,
      to: j4,
      rotate: _4,
      color: E3,
      fromOpacity: L3,
      toOpacity: L3
    });
  }), me2({
    ctx: p,
    ...C3,
    rotate: _4
  });
}
f.prototype.spiral = function(t = {}) {
  return this.onPaint((e, n2, o, a) => Ye2({ ctx: e, time: n2, haps: o, drawTime: a, ...t }));
};
var Be2 = it(36);
var ge3 = (t, e, n2, o) => {
  o = o * Math.PI * 2;
  const a = Math.sin(o) * n2 + t, r = Math.cos(o) * n2 + e;
  return [a, r];
};
var be2 = (t, e) => 0.5 - Math.log2(t / e) % 1;
function Ve2({
  haps: t,
  ctx: e,
  id: n2,
  hapcircles: o = 1,
  circle: a = 0,
  edo: r = 12,
  root: l2 = Be2,
  thickness: f2 = 3,
  hapRadius: i = 6,
  mode: g = "flake",
  margin: u2 = 10
} = {}) {
  const c2 = g === "polygon", b = g === "flake", d2 = e.canvas.width, w2 = e.canvas.height;
  e.clearRect(0, 0, d2, w2);
  const p = W2().foreground, h = Math.min(d2, w2) / 2 - f2 / 2 - i - u2, S2 = d2 / 2, A2 = w2 / 2;
  n2 && (t = t.filter((y2) => y2.hasTag(n2))), e.strokeStyle = p, e.fillStyle = p, e.globalAlpha = 1, e.lineWidth = f2, a && (e.beginPath(), e.arc(S2, A2, h, 0, 2 * Math.PI), e.stroke()), r && (Array.from({ length: r }, (y2, P2) => {
    const H3 = be2(l2 * Math.pow(2, P2 / r), l2), [q4, C3] = ge3(S2, A2, h, H3);
    e.beginPath(), e.arc(q4, C3, i, 0, 2 * Math.PI), e.fill();
  }), e.stroke());
  let v = [];
  e.lineWidth = i, t.forEach((y2) => {
    let P2;
    try {
      P2 = rh(y2);
    } catch {
      return;
    }
    const H3 = be2(P2, l2), [q4, C3] = ge3(S2, A2, h, H3), s = y2.value.color || p;
    e.strokeStyle = s, e.fillStyle = s;
    const { velocity: _4 = 1, gain: T2 = 1 } = y2.value || {}, I = _4 * T2;
    e.globalAlpha = I, v.push([q4, C3, H3, s, I]), e.beginPath(), o && (e.moveTo(q4 + i, C3), e.arc(q4, C3, i, 0, 2 * Math.PI), e.fill()), b && (e.moveTo(S2, A2), e.lineTo(q4, C3)), e.stroke();
  }), e.strokeStyle = p, e.globalAlpha = 1, c2 && v.length && (v = v.sort((y2, P2) => y2[2] - P2[2]), e.beginPath(), e.moveTo(v[0][0], v[0][1]), v.forEach(([y2, P2, H3, q4, C3]) => {
    e.strokeStyle = q4, e.globalAlpha = C3, e.lineTo(y2, P2);
  }), e.lineTo(v[0][0], v[0][1]), e.stroke());
}
f.prototype.pitchwheel = function(t = {}) {
  let { ctx: e = Z2(), id: n2 = 1 } = t;
  return this.tag(n2).onPaint(
    (o, a, r) => Ve2({
      ...t,
      time: a,
      ctx: e,
      haps: r.filter((l2) => l2.isActive(a)),
      id: n2
    })
  );
};

// node_modules/@strudel/webaudio/dist/index.mjs
var C2;
function ie2() {
  const e = z2();
  C2 = q2(
    e,
    "dough-processor",
    {},
    {
      outputChannelCount: [2]
    }
  ), lc2(C2);
}
var A = /* @__PURE__ */ new Map();
var E2 = /* @__PURE__ */ new Map();
f.prototype.supradough = function() {
  return this.onTrigger((e, t, n2, o) => {
    e.value._begin = o, e.value._duration = e.duration / n2, !C2 && ie2();
    const s = (e.value.bank ? e.value.bank + "_" : "") + e.value.s, a = e.value.n ?? 0, r = `${s}:${a}`;
    if (A.has(s) && (e.value.s = r), A.has(s) && !E2.has(r)) {
      const i = A.get(s), c2 = i[a % i.length];
      console.log(`load ${r} from ${c2}`);
      const h = ue4(c2);
      E2.set(r, h), h.then(
        ({ channels: u2, sampleRate: l2 }) => C2.port.postMessage({
          sample: r,
          channels: u2,
          sampleRate: l2
        })
      );
    }
    C2.port.postMessage({ spawn: e.value });
  }, 1);
};
async function ue4(e) {
  const t = await fetch(e).then((o) => o.arrayBuffer()).then((o) => z2().decodeAudioData(o));
  let n2 = [];
  for (let o = 0; o < t.numberOfChannels; o++)
    n2.push(t.getChannelData(o));
  return { channels: n2, sampleRate: t.sampleRate };
}
var j3 = (e, t, n2) => Math.min(Math.max(e, t), n2);
var q3 = (e) => e / (1 + e);
var ve3 = (e, t) => (e % t + t) % t;
var be3 = (e, t) => (1 + t) * e / (1 + t * Math.abs(e));
var y = (e, t) => Math.tanh(e * (1 + t));
var we3 = (e, t) => j3((1 + t) * e, -1, 1);
var F2 = (e, t) => {
  let n2 = (1 + 0.5 * t) * e;
  const o = ve3(n2 + 1, 4);
  return 1 - Math.abs(o - 2);
};
var ye4 = (e, t) => Math.sin(Math.PI / 2 * F2(e, t));
var Ce3 = (e, t) => {
  const n2 = q3(Math.log1p(t)), o = (e - n2 / 3 * e * e * e) / (1 - n2 / 3);
  return y(o, t);
};
var L2 = (e, t, n2 = false) => {
  const o = 1 + 2 * t, a = 0.07 * q3(Math.log1p(t)), r = y(e + a, 2 * t), i = y(n2 ? a : -e + a, 2 * t), c2 = r - i, h = 1 / Math.cosh(o * a), u2 = h * h, l2 = Math.max(1e-8, (n2 ? 1 : 2) * o * u2);
  return y(c2 / l2, t);
};
var Ne = (e, t) => L2(e, t, true);
var Ae2 = (e, t) => {
  const n2 = 10 * Math.log1p(t);
  let o = 1, s = e, a, r = 0;
  for (let i = 1; i < 64; i++) {
    if (i < 2) {
      r += i == 0 ? o : s;
      continue;
    }
    a = 2 * e * o - s, s = o, o = a, i % 2 === 0 && (r += Math.min(1.3 * n2 / i, 2) * a);
  }
  return y(r, n2 / 20);
};
var Me2 = {
  scurve: be3,
  soft: y,
  hard: we3,
  cubic: Ce3,
  diode: L2,
  asym: Ne,
  fold: F2,
  sinefold: ye4,
  chebyshev: Ae2
};
Object.freeze(Object.keys(Me2));
ac2(us2);
var { Pattern: $e, logger: k2, repl: je3 } = dist_exports;
Bo2(k2);
$e.prototype.dough = function() {
  return this.onTrigger(Gc2, 1);
};
function Ue3(e, {
  align: t = true,
  color: n2 = "white",
  thickness: o = 3,
  scale: s = 0.25,
  pos: a = 0.75,
  trigger: r = 0,
  ctx: i = Z2(),
  id: c2 = 1
} = {}) {
  i.lineWidth = o, i.strokeStyle = n2;
  let h = i.canvas;
  if (!e) {
    i.beginPath();
    let g = a * h.height;
    i.moveTo(0, g), i.lineTo(h.width, g), i.stroke();
    return;
  }
  const u2 = ic2("time", c2);
  i.beginPath();
  const l2 = e.frequencyBinCount;
  let f2 = t ? Array.from(u2).findIndex((g, m2, b) => m2 && b[m2 - 1] > -r && g <= -r) : 0;
  f2 = Math.max(f2, 0);
  const p = h.width * 1 / l2;
  let d2 = 0;
  for (let g = f2; g < l2; g++) {
    const m2 = u2[g] + 1, b = (a - s * (m2 - 1)) * h.height;
    g === 0 ? i.moveTo(d2, b) : i.lineTo(d2, b), d2 += p;
  }
  i.stroke();
}
function Ve3(e, { color: t = "white", scale: n2 = 0.25, pos: o = 0.75, lean: s = 0.5, min: a = -150, max: r = 0, ctx: i = Z2(), id: c2 = 1 } = {}) {
  if (!e) {
    i.beginPath();
    let d2 = o * u2.height;
    i.moveTo(0, d2), i.lineTo(u2.width, d2), i.stroke();
    return;
  }
  const h = ic2("frequency", c2), u2 = i.canvas;
  i.fillStyle = t;
  const l2 = e.frequencyBinCount, f2 = u2.width * 1 / l2;
  let p = 0;
  for (let d2 = 0; d2 < l2; d2++) {
    const m2 = an((h[d2] - a) / (r - a), 0, 1) * n2, b = m2 * u2.height, J2 = (o - m2 * s) * u2.height;
    i.fillRect(p, J2, Math.max(f2, 1), b), p += f2;
  }
}
function H2(e = 0, t = "0,0,0", n2 = Z2()) {
  e ? (n2.fillStyle = `rgba(${t},${1 - e})`, n2.fillRect(0, 0, n2.canvas.width, n2.canvas.height)) : n2.clearRect(0, 0, n2.canvas.width, n2.canvas.height);
}
f.prototype.fscope = function(e = {}) {
  let t = e.id ?? 1;
  return this.analyze(t).draw(
    () => {
      H2(e.smear, "0,0,0", e.ctx), ne2[t] && Ve3(ne2[t], e);
    },
    { id: t }
  );
};
f.prototype.tscope = function(e = {}) {
  let t = e.id ?? 1;
  return this.analyze(t).draw(
    (n2) => {
      e.color = n2[0]?.value?.color || W2().foreground, e.color, H2(e.smear, "0,0,0", e.ctx), Ue3(ne2[t], e);
    },
    { id: t }
  );
};
f.prototype.scope = f.prototype.tscope;
var V2 = {};
f.prototype.spectrum = function(e = {}) {
  let t = e.id ?? 1;
  return this.analyze(t).draw(
    (n2) => {
      e.color = n2[0]?.value?.color || V2[t] || W2().foreground, V2[t] = e.color, xe4(ne2[t], e);
    },
    { id: t }
  );
};
f.prototype.scope = f.prototype.tscope;
var _3 = /* @__PURE__ */ new Map();
function xe4(e, { thickness: t = 3, speed: n2 = 1, min: o = -80, max: s = 0, ctx: a = Z2(), id: r = 1, color: i } = {}) {
  if (a.lineWidth = t, a.strokeStyle = i, !e)
    return;
  const c2 = n2, h = ic2("frequency", r), u2 = a.canvas;
  a.fillStyle = i;
  const l2 = e.frequencyBinCount;
  let f2 = _3.get(r) || a.getImageData(0, 0, u2.width, u2.height);
  _3.set(r, f2), a.clearRect(0, 0, a.canvas.width, a.canvas.height), a.putImageData(f2, -c2, 0);
  let p = u2.width - n2;
  for (let d2 = 0; d2 < l2; d2++) {
    const g = an((h[d2] - o) / (s - o), 0, 1);
    a.globalAlpha = g;
    const m2 = Math.log(d2 + 1) / Math.log(l2) * u2.height;
    a.fillRect(p, u2.height - m2, c2, 2);
  }
  _3.set(r, a.getImageData(0, 0, u2.width, u2.height));
}

// lib/vendor/soundfonts/gm.mjs
var gm_default = {
  gm_piano: [
    //'gm_acoustic_piano': [
    // Acoustic Grand Piano: Piano
    "0000_JCLive_sf2_file",
    "0000_FluidR3_GM_sf2_file",
    "0000_Aspirin_sf2_file",
    "0000_Chaos_sf2_file",
    "0000_GeneralUserGS_sf2_file",
    //0000_SBLive_sf2
    //0000_SoundBlasterOld_sf2
    "0001_FluidR3_GM_sf2_file",
    "0001_GeneralUserGS_sf2_file",
    //],
    //'gm_bright_acoustic_piano': [
    // Bright Acoustic Piano: Piano
    "0010_Aspirin_sf2_file",
    "0010_Chaos_sf2_file",
    "0010_FluidR3_GM_sf2_file",
    "0010_GeneralUserGS_sf2_file",
    "0010_JCLive_sf2_file",
    //0010_SBLive_sf2
    //0010_SoundBlasterOld_sf2
    "0011_Aspirin_sf2_file",
    "0011_FluidR3_GM_sf2_file",
    "0011_GeneralUserGS_sf2_file",
    "0012_GeneralUserGS_sf2_file",
    //],
    //'gm_electric_grand_piano': [
    // Electric Grand Piano: Piano
    "0020_Aspirin_sf2_file",
    "0020_Chaos_sf2_file",
    "0020_FluidR3_GM_sf2_file",
    "0020_GeneralUserGS_sf2_file",
    "0020_JCLive_sf2_file",
    //0020_SBLive_sf2
    //0020_SoundBlasterOld_sf2
    "0021_Aspirin_sf2_file",
    "0021_GeneralUserGS_sf2_file",
    // ?
    "0022_Aspirin_sf2_file",
    //],
    //'gm_honky_tonk_piano': [
    // Honky_tonk Piano: Piano
    "0030_Aspirin_sf2_file",
    "0030_Chaos_sf2_file",
    "0030_FluidR3_GM_sf2_file",
    "0030_GeneralUserGS_sf2_file",
    "0030_JCLive_sf2_file",
    //0030_SBLive_sf2
    //0030_SoundBlasterOld_sf2
    "0031_Aspirin_sf2_file",
    "0031_FluidR3_GM_sf2_file",
    "0031_GeneralUserGS_sf2_file"
    //0031_SoundBlasterOld_sf2 // pianos until her
  ],
  gm_epiano1: [
    // Electric Piano 1: Piano
    "0040_JCLive_sf2_file",
    "0040_FluidR3_GM_sf2_file",
    "0040_Aspirin_sf2_file",
    "0040_Chaos_sf2_file",
    "0040_GeneralUserGS_sf2_file",
    //0040_SBLive_sf2 // ?
    //0040_SoundBlasterOld_sf2 // ?
    "0041_FluidR3_GM_sf2_file",
    "0041_GeneralUserGS_sf2_file",
    //0041_SoundBlasterOld_sf2 // ?
    "0042_GeneralUserGS_sf2_file",
    "0043_GeneralUserGS_sf2_file",
    "0044_GeneralUserGS_sf2_file",
    //0045_GeneralUserGS_sf2_file // ?
    "0046_GeneralUserGS_sf2_file"
  ],
  gm_epiano2: [
    // Electric Piano 2: Piano
    "0050_JCLive_sf2_file",
    "0050_FluidR3_GM_sf2_file",
    "0050_Aspirin_sf2_file",
    "0050_Chaos_sf2_file",
    // ?
    "0050_GeneralUserGS_sf2_file",
    // cont
    //0050_SBLive_sf2 // ?
    //0050_SoundBlasterOld_sf2 // ?
    "0051_FluidR3_GM_sf2_file",
    "0051_GeneralUserGS_sf2_file",
    //0052_GeneralUserGS_sf2_file // ?
    "0053_GeneralUserGS_sf2_file",
    // normal piano...
    "0054_GeneralUserGS_sf2_file"
  ],
  gm_harpsichord: [
    // Harpsichord: Piano
    "0060_JCLive_sf2_file",
    "0060_FluidR3_GM_sf2_file",
    "0060_Aspirin_sf2_file",
    "0060_Chaos_sf2_file",
    "0060_GeneralUserGS_sf2_file",
    //0060_SBLive_sf2
    //0060_SoundBlasterOld_sf2
    "0061_Aspirin_sf2_file",
    "0061_GeneralUserGS_sf2_file",
    //0061_SoundBlasterOld_sf2
    "0062_GeneralUserGS_sf2_file"
  ],
  gm_clavinet: [
    // Clavinet: Piano
    "0070_JCLive_sf2_file",
    "0070_FluidR3_GM_sf2_file",
    "0070_Aspirin_sf2_file",
    "0070_Chaos_sf2_file"
    // 0070_GeneralUserGS_sf2_file // half broken
    //0070_SBLive_sf2
    //0070_SoundBlasterOld_sf2
    // 0071_GeneralUserGS_sf2_file // half broke
  ],
  gm_celesta: [
    // Celesta: Chromatic Percussion
    "0080_JCLive_sf2_file",
    "0080_Aspirin_sf2_file",
    "0080_Chaos_sf2_file",
    "0080_FluidR3_GM_sf2_file",
    "0080_GeneralUserGS_sf2_file",
    //0080_SBLive_sf2
    //0080_SoundBlasterOld_sf2
    "0081_FluidR3_GM_sf2_file"
    // 0081_GeneralUserGS_sf2_file // weird detuned
    //0081_SoundBlasterOld_sf
  ],
  gm_glockenspiel: [
    // Glockenspiel: Chromatic Percussion
    "0090_JCLive_sf2_file",
    "0090_Aspirin_sf2_file",
    "0090_Chaos_sf2_file",
    "0090_FluidR3_GM_sf2_file",
    "0090_GeneralUserGS_sf2_file"
    //0090_SBLive_sf2
    //0090_SoundBlasterOld_sf2
    //0091_SoundBlasterOld_sf
  ],
  gm_music_box: [
    // Music Box: Chromatic Percussion
    "0100_JCLive_sf2_file",
    "0100_Aspirin_sf2_file",
    "0100_Chaos_sf2_file",
    "0100_FluidR3_GM_sf2_file",
    "0100_GeneralUserGS_sf2_file"
    //0100_SBLive_sf2
    //0100_SoundBlasterOld_sf2
    // 0101_GeneralUserGS_sf2_file // weird detuned
    //0101_SoundBlasterOld_sf
  ],
  gm_vibraphone: [
    // Vibraphone: Chromatic Percussion
    "0110_JCLive_sf2_file",
    "0110_Aspirin_sf2_file",
    "0110_Chaos_sf2_file",
    "0110_FluidR3_GM_sf2_file",
    "0110_GeneralUserGS_sf2_file",
    //0110_SBLive_sf2
    //0110_SoundBlasterOld_sf2
    "0111_FluidR3_GM_sf2_file"
  ],
  gm_marimba: [
    // Marimba: Chromatic Percussion
    "0120_JCLive_sf2_file",
    "0120_Aspirin_sf2_file",
    "0120_Chaos_sf2_file",
    "0120_FluidR3_GM_sf2_file",
    "0120_GeneralUserGS_sf2_file",
    //0120_SBLive_sf2
    //0120_SoundBlasterOld_sf2
    "0121_FluidR3_GM_sf2_file",
    "0121_GeneralUserGS_sf2_file"
  ],
  gm_xylophone: [
    // Xylophone: Chromatic Percussion
    "0130_JCLive_sf2_file",
    "0130_Aspirin_sf2_file",
    "0130_Chaos_sf2_file",
    "0130_FluidR3_GM_sf2_file",
    "0130_GeneralUserGS_sf2_file",
    //0130_SBLive_sf2
    //0130_SoundBlasterOld_sf2
    "0131_FluidR3_GM_sf2_file"
  ],
  gm_tubular_bells: [
    // Tubular Bells: Chromatic Percussion
    "0140_JCLive_sf2_file",
    "0140_Aspirin_sf2_file",
    // 0140_Chaos_sf2_file // same as aspirin?
    "0140_FluidR3_GM_sf2_file",
    "0140_GeneralUserGS_sf2_file",
    //0140_SBLive_sf2
    //0140_SoundBlasterOld_sf2
    "0141_FluidR3_GM_sf2_file",
    //0141_GeneralUserGS_sf2_file
    "0142_GeneralUserGS_sf2_file"
    // 0143_GeneralUserGS_sf2_file // bugg
  ],
  gm_dulcimer: [
    // Dulcimer: Chromatic Percussion
    "0150_Aspirin_sf2_file",
    "0150_Chaos_sf2_file",
    "0150_FluidR3_GM_sf2_file",
    "0150_GeneralUserGS_sf2_file",
    // 0150_JCLive_sf2_file // detuned???
    //0150_SBLive_sf2
    //0150_SoundBlasterOld_sf2
    "0151_FluidR3_GM_sf2_file"
  ],
  gm_drawbar_organ: [
    // Drawbar Organ: Organ
    "0160_JCLive_sf2_file",
    "0160_Aspirin_sf2_file",
    "0160_Chaos_sf2_file",
    "0160_FluidR3_GM_sf2_file",
    "0160_GeneralUserGS_sf2_file",
    //0160_SBLive_sf2
    //0160_SoundBlasterOld_sf2
    "0161_Aspirin_sf2_file",
    "0161_FluidR3_GM_sf2_file"
    //0161_SoundBlasterOld_sf
  ],
  gm_percussive_organ: [
    // Percussive Organ: Organ
    "0170_JCLive_sf2_file",
    "0170_Aspirin_sf2_file",
    "0170_Chaos_sf2_file",
    "0170_FluidR3_GM_sf2_file",
    // 0170_GeneralUserGS_sf2_file // repitched
    //0170_SBLive_sf2
    //0170_SoundBlasterOld_sf2
    "0171_FluidR3_GM_sf2_file",
    // 0171_GeneralUserGS_sf2_file  // repitched
    "0172_FluidR3_GM_sf2_file"
  ],
  gm_rock_organ: [
    // Rock Organ: Organ
    "0180_JCLive_sf2_file",
    "0180_Aspirin_sf2_file",
    "0180_Chaos_sf2_file",
    "0180_FluidR3_GM_sf2_file",
    "0180_GeneralUserGS_sf2_file"
    //0180_SBLive_sf2
    //0180_SoundBlasterOld_sf2
    //0181_Aspirin_sf2_file // flute
    //0181_GeneralUserGS_sf2_file // marimbalike
    //0181_SoundBlasterOld_sf
  ],
  gm_church_organ: [
    // Church Organ: Organ
    "0190_JCLive_sf2_file",
    "0190_Aspirin_sf2_file",
    "0190_Chaos_sf2_file",
    "0190_FluidR3_GM_sf2_file",
    "0190_GeneralUserGS_sf2_file"
    //0190_SBLive_sf2
    //0190_SoundBlasterOld_sf2
    //0191_Aspirin_sf2_file // string??
    //0191_GeneralUserGS_sf2_file // weird organ
    //0191_SoundBlasterOld_sf
  ],
  gm_reed_organ: [
    // Reed Organ: Organ
    "0200_JCLive_sf2_file",
    "0200_Aspirin_sf2_file",
    "0200_Chaos_sf2_file",
    "0200_FluidR3_GM_sf2_file",
    "0200_GeneralUserGS_sf2_file",
    //0200_SBLive_sf2
    //0200_SoundBlasterOld_sf2
    "0201_Aspirin_sf2_file",
    "0201_FluidR3_GM_sf2_file",
    "0201_GeneralUserGS_sf2_file"
    //0201_SoundBlasterOld_sf2
    //0210_Aspirin_sf2_file // buggy
    //0210_Chaos_sf2_file // bugg
  ],
  gm_accordion: [
    // Accordion: Organ
    "0210_JCLive_sf2_file",
    "0210_FluidR3_GM_sf2_file",
    "0210_GeneralUserGS_sf2_file",
    //0210_SBLive_sf2
    //0210_SoundBlasterOld_sf2
    "0211_Aspirin_sf2_file",
    "0211_FluidR3_GM_sf2_file",
    "0211_GeneralUserGS_sf2_file",
    //0211_SoundBlasterOld_sf2
    "0212_GeneralUserGS_sf2_file"
  ],
  gm_harmonica: [
    // Harmonica: Organ
    "0220_FluidR3_GM_sf2_file",
    "0220_JCLive_sf2_file",
    "0220_Aspirin_sf2_file",
    "0220_Chaos_sf2_file",
    "0220_GeneralUserGS_sf2_file",
    //0220_SBLive_sf2
    //0220_SoundBlasterOld_sf2
    "0221_FluidR3_GM_sf2_file"
  ],
  gm_bandoneon: [
    // Tango Accordion: Organ
    "0230_Aspirin_sf2_file",
    "0230_JCLive_sf2_file",
    "0230_Chaos_sf2_file",
    "0230_FluidR3_GM_sf2_file",
    "0230_GeneralUserGS_sf2_file",
    //0230_SBLive_sf2
    //0230_SoundBlasterOld_sf2
    "0231_FluidR3_GM_sf2_file",
    "0231_GeneralUserGS_sf2_file",
    "0231_JCLive_sf2_file",
    //0231_SoundBlasterOld_sf2
    "0232_FluidR3_GM_sf2_file",
    "0233_FluidR3_GM_sf2_file"
  ],
  gm_acoustic_guitar_nylon: [
    // Acoustic Guitar (nylon): Guitar
    "0240_JCLive_sf2_file",
    "0240_Aspirin_sf2_file",
    "0240_Chaos_sf2_file",
    "0240_FluidR3_GM_sf2_file",
    "0240_GeneralUserGS_sf2_file",
    "0240_LK_Godin_Nylon_SF2_file",
    //0240_SBLive_sf2
    //0240_SoundBlasterOld_sf2
    // 0241_GeneralUserGS_sf2_file // organ like
    "0241_JCLive_sf2_file",
    "0242_JCLive_sf2_file",
    "0243_JCLive_sf2_file"
  ],
  gm_acoustic_guitar_steel: [
    // Acoustic Guitar (steel): Guitar
    "0253_Acoustic_Guitar_sf2_file",
    "0250_Aspirin_sf2_file",
    "0250_Chaos_sf2_file",
    "0250_FluidR3_GM_sf2_file",
    "0250_GeneralUserGS_sf2_file",
    // 0250_JCLive_sf2_file // detuned
    "0250_LK_AcousticSteel_SF2_file",
    //0250_SBLive_sf2
    //0250_SoundBlasterOld_sf2
    //0251_Acoustic_Guitar_sf2_file // detuned?
    // 0251_GeneralUserGS_sf2_file // broken: missing pitches
    // 0252_Acoustic_Guitar_sf2_file // detuned..
    // 0252_GeneralUserGS_sf2_file // broken: missing pitches
    "0253_Acoustic_Guitar_sf2_file",
    "0253_GeneralUserGS_sf2_file",
    "0254_Acoustic_Guitar_sf2_file",
    "0254_GeneralUserGS_sf2_file"
    //0255_GeneralUserGS_sf2_file // no guitar.
  ],
  gm_electric_guitar_jazz: [
    // Electric Guitar (jazz): Guitar
    "0260_JCLive_sf2_file",
    "0260_Aspirin_sf2_file",
    "0260_Chaos_sf2_file",
    "0260_FluidR3_GM_sf2_file",
    "0260_GeneralUserGS_sf2_file",
    //0260_SBLive_sf2
    //0260_SoundBlasterOld_sf2
    "0260_Stratocaster_sf2_file",
    "0261_GeneralUserGS_sf2_file",
    //0261_SoundBlasterOld_sf2
    "0261_Stratocaster_sf2_file",
    "0262_Stratocaster_sf2_file"
  ],
  gm_electric_guitar_clean: [
    // Electric Guitar (clean): Guitar
    "0270_Aspirin_sf2_file",
    "0270_Chaos_sf2_file",
    "0270_FluidR3_GM_sf2_file",
    "0270_GeneralUserGS_sf2_file",
    //0270_Gibson_Les_Paul_sf2_file // detuned
    // 0270_JCLive_sf2_file // broken: missing notes
    "0270_SBAWE32_sf2_file",
    //0270_SBLive_sf2
    //0270_SoundBlasterOld_sf2
    "0270_Stratocaster_sf2_file",
    "0271_GeneralUserGS_sf2_file",
    "0271_Stratocaster_sf2_file",
    "0272_Stratocaster_sf2_file"
  ],
  gm_electric_guitar_muted: [
    // Electric Guitar (muted): Guitar
    "0280_Aspirin_sf2_file",
    "0280_Chaos_sf2_file",
    // 0280_FluidR3_GM_sf2_file // broken: wrong notes
    "0280_GeneralUserGS_sf2_file",
    "0280_JCLive_sf2_file",
    //0280_LesPaul_sf2 // missing
    "0280_LesPaul_sf2_file",
    "0280_SBAWE32_sf2_file",
    //0280_SBLive_sf2
    //0280_SoundBlasterOld_sf2
    "0281_Aspirin_sf2_file",
    "0281_FluidR3_GM_sf2_file",
    "0281_GeneralUserGS_sf2_file",
    "0282_FluidR3_GM_sf2_file"
    // 0282_GeneralUserGS_sf2_file // broken: missing notes
    // 0283_GeneralUserGS_sf2_file // missin
  ],
  gm_overdriven_guitar: [
    // Overdriven Guitar: Guitar
    "0290_FluidR3_GM_sf2_file",
    "0290_Aspirin_sf2_file",
    "0290_Chaos_sf2_file",
    "0290_GeneralUserGS_sf2_file",
    //0290_JCLive_sf2_file // detuned....
    //0290_LesPaul_sf2 // broken
    "0290_LesPaul_sf2_file",
    "0290_SBAWE32_sf2_file",
    //0290_SBLive_sf2
    //0290_SoundBlasterOld_sf2
    // 0291_Aspirin_sf2_file // broken
    // 0291_LesPaul_sf2 // broken
    "0291_LesPaul_sf2_file",
    "0291_SBAWE32_sf2_file",
    //0291_SoundBlasterOld_sf2
    "0292_Aspirin_sf2_file",
    // 0292_LesPaul_sf2 // broken
    "0292_LesPaul_sf2_file"
  ],
  gm_distortion_guitar: [
    // Distortion Guitar: Guitar
    "0300_FluidR3_GM_sf2_file",
    "0300_Aspirin_sf2_file",
    "0300_Chaos_sf2_file",
    "0300_GeneralUserGS_sf2_file",
    // 0300_JCLive_sf2_file // broken
    // 0300_LesPaul_sf2 // broken
    "0300_LesPaul_sf2_file",
    //0300_SBAWE32_sf2_file // _2 octave
    //0300_SBLive_sf2
    //0300_SoundBlasterOld_sf2
    // 0301_Aspirin_sf2_file // missing
    //0301_FluidR3_GM_sf2_file // weird broken bell
    // 0301_GeneralUserGS_sf2_file // broken
    // 0301_JCLive_sf2_file // broken
    // 0301_LesPaul_sf2 // missing
    // 0301_LesPaul_sf2_file // + 1 oct?
    "0302_Aspirin_sf2_file",
    // 0302_GeneralUserGS_sf2_file // not a guitar..
    //0302_JCLive_sf2_file // broken...
    // 0303_Aspirin_sf2_file // guitar harmonic??
    "0304_Aspirin_sf2_file"
  ],
  gm_guitar_harmonics: [
    // Guitar Harmonics: Guitar
    "0310_Aspirin_sf2_file",
    "0310_FluidR3_GM_sf2_file",
    "0310_Chaos_sf2_file"
    //0310_GeneralUserGS_sf2_file // weird..
    // 0310_JCLive_sf2_file // weird
    //0310_LesPaul_sf2 // missing
    //0310_LesPaul_sf2_file // wrong pitches
    //0310_SBAWE32_sf2_file // wrong pitches
    //0310_SBLive_sf2
    //0310_SoundBlasterOld_sf2
    //0311_FluidR3_GM_sf2_file // knackt
    //0311_GeneralUserGS_sf2_file // wrong note
  ],
  gm_acoustic_bass: [
    // Acoustic Bass: Bass
    "0320_JCLive_sf2_file",
    "0320_FluidR3_GM_sf2_file",
    "0320_Aspirin_sf2_file",
    "0320_Chaos_sf2_file"
    // 0320_GeneralUserGS_sf2_file // missing notes
    //0320_SBLive_sf2
    //0320_SoundBlasterOld_sf2
    // 0321_GeneralUserGS_sf2_file // nice sound but missing notes
    // 0322_GeneralUserGS_sf2_file // missing note
  ],
  gm_electric_bass_finger: [
    // Electric Bass (finger): Bass
    "0330_JCLive_sf2_file",
    "0330_FluidR3_GM_sf2_fible",
    "0330_Aspirin_sf2_file",
    //0330_Chaos_sf2_file // same as last
    "0330_GeneralUserGS_sf2_file"
    //0330_SBLive_sf2
    //0330_SoundBlasterOld_sf2
    //0331_GeneralUserGS_sf2_file // knackt
    // 0332_GeneralUserGS_sf2_file // missin
  ],
  gm_electric_bass_pick: [
    // Electric Bass (pick): Bass
    "0340_JCLive_sf2_file",
    "0340_FluidR3_GM_sf2_file",
    "0340_Aspirin_sf2_file",
    //0340_Chaos_sf2_file // same as last
    "0340_GeneralUserGS_sf2_file",
    //0340_SBLive_sf2
    //0340_SoundBlasterOld_sf2
    "0341_Aspirin_sf2_file"
    //0341_GeneralUserGS_sf2_file // knack
  ],
  gm_fretless_bass: [
    // Fretless Bass: Bass
    "0350_Aspirin_sf2_file",
    // 0350_Chaos_sf2_file // same as last
    //0350_FluidR3_GM_sf2_file // knackt
    //0350_GeneralUserGS_sf2_file // _1 oct + knackt
    "0350_JCLive_sf2_file"
    //0350_SBLive_sf2
    //0350_SoundBlasterOld_sf2
    //0351_GeneralUserGS_sf2_file // missin
  ],
  gm_slap_bass_1: [
    // Slap Bass 1: Bass
    "0360_Aspirin_sf2_file",
    "0360_JCLive_sf2_file",
    "0360_FluidR3_GM_sf2_file",
    "0360_Chaos_sf2_file"
    //0360_GeneralUserGS_sf2_file // _1 oct
    //0360_SBLive_sf2
    //0360_SoundBlasterOld_sf2
    //0361_GeneralUserGS_sf2_file // missin
  ],
  gm_slap_bass_2: [
    // Slap Bass 2: Bass
    "0370_Aspirin_sf2_file",
    // 0370_Chaos_sf2_file // same as last
    "0370_FluidR3_GM_sf2_file",
    "0370_GeneralUserGS_sf2_fil e",
    "0370_JCLive_sf2_file"
    //0370_SBLive_sf2
    //0370_SoundBlasterOld_sf2
    //0371_GeneralUserGS_sf2_file // missing
    //0372_GeneralUserGS_sf2_file // detuned
    //0385_GeneralUserGS_sf2_file // missin
  ],
  gm_synth_bass_1: [
    // Synth Bass 1: Bass
    // '0380_Aspirin_sf2_file', // broken in safari https://codeberg.org/uzu/strudel/issues/1384
    "0380_Chaos_sf2_file",
    "0380_FluidR3_GM_sf2_file",
    // 0380_GeneralUserGS_sf2_file // laut
    "0380_JCLive_sf2_file",
    //0380_SBLive_sf2
    //0380_SoundBlasterOld_sf2
    "0381_FluidR3_GM_sf2_file",
    "0381_GeneralUserGS_sf2_file",
    //0382_FluidR3_GM_sf2_file // kein synth bass
    "0382_GeneralUserGS_sf2_file",
    "0383_GeneralUserGS_sf2_file",
    "0384_GeneralUserGS_sf2_file",
    //0386_GeneralUserGS_sf2_file // knackt
    "0387_GeneralUserGS_sf2_file"
  ],
  gm_synth_bass_2: [
    // Synth Bass 2: Bass
    "0390_Aspirin_sf2_file",
    // 0390_Chaos_sf2_file // same as last
    "0390_FluidR3_GM_sf2_file",
    "0390_GeneralUserGS_sf2_file",
    "0390_JCLive_sf2_file",
    //0390_SBLive_sf2
    //0390_SoundBlasterOld_sf2
    "0391_FluidR3_GM_sf2_file",
    // 0391_GeneralUserGS_sf2_file // missing
    //0391_SoundBlasterOld_sf2
    "0392_FluidR3_GM_sf2_file",
    //0392_GeneralUserGS_sf2_file // kein synth und _1oct
    "0393_GeneralUserGS_sf2_file"
  ],
  gm_violin: [
    // Violin: Strings
    "0400_Aspirin_sf2_file",
    "0400_Chaos_sf2_file",
    "0400_JCLive_sf2_file",
    "0400_FluidR3_GM_sf2_file",
    "0400_GeneralUserGS_sf2_file",
    //0400_SBLive_sf2
    //0400_SoundBlasterOld_sf2
    "0401_Aspirin_sf2_file",
    "0401_FluidR3_GM_sf2_file",
    "0401_GeneralUserGS_sf2_file",
    "0402_GeneralUserGS_sf2_file"
  ],
  gm_viola: [
    // Viola: Strings
    "0410_Aspirin_sf2_file",
    // 0410_Chaos_sf2_file // laut und sehr unstringy
    "0410_FluidR3_GM_sf2_file",
    "0410_GeneralUserGS_sf2_file",
    "0410_JCLive_sf2_file",
    //0410_SBLive_sf2
    //0410_SoundBlasterOld_sf2
    "0411_FluidR3_GM_sf2_file"
  ],
  gm_cello: [
    // Cello: Strings
    "0420_Aspirin_sf2_file",
    // 0420_Chaos_sf2_file // kein cello und laut
    "0420_FluidR3_GM_sf2_file",
    "0420_GeneralUserGS_sf2_file",
    "0420_JCLive_sf2_file",
    //0420_SBLive_sf2
    //0420_SoundBlasterOld_sf2
    "0421_FluidR3_GM_sf2_file",
    "0421_GeneralUserGS_sf2_file"
  ],
  gm_contrabass: [
    // Contrabass: Strings
    "0430_Aspirin_sf2_file",
    "0430_Chaos_sf2_file",
    // 0430_FluidR3_GM_sf2_file // missing notes
    "0430_GeneralUserGS_sf2_file"
    //0430_JCLive_sf2_file // _1 oct und meh
    //0430_SBLive_sf2
    //0430_SoundBlasterOld_sf2
    // 0431_FluidR3_GM_sf2_file // missing note
  ],
  gm_tremolo_strings: [
    // Tremolo Strings: Strings
    "0440_Aspirin_sf2_file",
    "0440_Chaos_sf2_file",
    //0440_FluidR3_GM_sf2_file // huuuge
    "0440_GeneralUserGS_sf2_file",
    "0440_JCLive_sf2_file",
    //0440_SBLive_sf2
    //0440_SoundBlasterOld_sf2
    "0441_GeneralUserGS_sf2_file",
    "0442_GeneralUserGS_sf2_file"
  ],
  gm_pizzicato_strings: [
    // Pizzicato Strings: Strings
    "0450_Aspirin_sf2_file",
    "0450_Chaos_sf2_file",
    "0450_FluidR3_GM_sf2_file",
    "0450_GeneralUserGS_sf2_file",
    "0450_JCLive_sf2_file",
    //0450_SBLive_sf2
    //0450_SoundBlasterOld_sf2
    "0451_FluidR3_GM_sf2_file"
  ],
  gm_orchestral_harp: [
    // Orchestral Harp: Strings
    "0460_Aspirin_sf2_file",
    // 0460_Chaos_sf2_file // knackt
    "0460_FluidR3_GM_sf2_file",
    "0460_GeneralUserGS_sf2_file",
    "0460_JCLive_sf2_file",
    //0460_SBLive_sf2
    //0460_SoundBlasterOld_sf2
    "0461_FluidR3_GM_sf2_file"
  ],
  gm_timpani: [
    // Timpani: Strings
    "0470_Aspirin_sf2_file",
    "0470_Chaos_sf2_file",
    "0470_FluidR3_GM_sf2_file",
    "0470_GeneralUserGS_sf2_file",
    // 0470_JCLive_sf2_file // wrong pitches
    //0470_SBLive_sf2
    //0470_SoundBlasterOld_sf2
    "0471_FluidR3_GM_sf2_file",
    "0471_GeneralUserGS_sf2_file"
  ],
  gm_string_ensemble_1: [
    // String Ensemble 1: Ensemble
    "0480_Aspirin_sf2_file",
    "0480_Chaos_sf2_file",
    "0480_FluidR3_GM_sf2_file",
    "0480_GeneralUserGS_sf2_file",
    "0480_JCLive_sf2_file",
    //0480_SBLive_sf2
    //0480_SoundBlasterOld_sf2
    // these dont work..
    //04810_GeneralUserGS_sf2_file // missing notes + brass
    //04811_GeneralUserGS_sf2_file  // missing notes + brass
    //04812_GeneralUserGS_sf2_file
    //04813_GeneralUserGS_sf2_file
    //04814_GeneralUserGS_sf2_file
    //04815_GeneralUserGS_sf2_file
    //04816_GeneralUserGS_sf2_file
    //04817_GeneralUserGS_sf2_file
    "0481_Aspirin_sf2_file",
    "0481_FluidR3_GM_sf2_file",
    "0481_GeneralUserGS_sf2_file",
    "0482_Aspirin_sf2_file",
    "0482_GeneralUserGS_sf2_file",
    "0483_GeneralUserGS_sf2_file"
    // another block of buggyness:
    //0484_GeneralUserGS_sf2_file // keys?! + knackt
    //0485_GeneralUserGS_sf2_file // missing notes
    //0486_GeneralUserGS_sf2_file
    //0487_GeneralUserGS_sf2_file
    //0488_GeneralUserGS_sf2_file
    //0489_GeneralUserGS_sf2_fil
  ],
  gm_string_ensemble_2: [
    // String Ensemble 2: Ensemble
    "0490_Aspirin_sf2_file",
    "0490_Chaos_sf2_file",
    "0490_FluidR3_GM_sf2_file",
    "0490_GeneralUserGS_sf2_file",
    "0490_JCLive_sf2_file",
    //0490_SBLive_sf2
    //0490_SoundBlasterOld_sf2
    "0491_GeneralUserGS_sf2_file",
    "0492_GeneralUserGS_sf2_file"
  ],
  gm_synth_strings_1: [
    // Synth Strings 1: Ensemble
    "0500_Aspirin_sf2_file",
    // 0500_Chaos_sf2_file // same as above
    //0500_FluidR3_GM_sf2_file // detune + knack
    "0500_GeneralUserGS_sf2_file",
    "0500_JCLive_sf2_file",
    //0500_SBLive_sf2
    //0500_SoundBlasterOld_sf2
    "0501_FluidR3_GM_sf2_file",
    // 0501_GeneralUserGS_sf2_file // crackles
    // 0502_FluidR3_GM_sf2_file // missing
    "0502_GeneralUserGS_sf2_file",
    "0503_FluidR3_GM_sf2_file",
    // 0504_FluidR3_GM_sf2_file // missing
    "0505_FluidR3_GM_sf2_file"
  ],
  gm_synth_strings_2: [
    // Synth Strings 2: Ensemble
    "0510_Aspirin_sf2_file",
    "0510_Chaos_sf2_file",
    // 0510_FluidR3_GM_sf2_file // detune + crackle
    "0510_GeneralUserGS_sf2_file",
    //0510_JCLive_sf2_file // laarge and meh
    //0510_SBLive_sf2 // missing
    //0510_SoundBlasterOld_sf2
    "0511_GeneralUserGS_sf2_file"
    //0511_SoundBlasterOld_sf
  ],
  gm_choir_aahs: [
    // Choir Aahs: Ensemble
    "0520_Aspirin_sf2_file",
    "0520_Chaos_sf2_file",
    "0520_FluidR3_GM_sf2_file",
    "0520_GeneralUserGS_sf2_file",
    "0520_JCLive_sf2_file",
    //0520_SBLive_sf2
    "0520_Soul_Ahhs_sf2_file",
    //0520_SoundBlasterOld_sf2
    "0521_FluidR3_GM_sf2_file",
    "0521_Soul_Ahhs_sf2_file",
    //0521_SoundBlasterOld_sf2
    "0522_Soul_Ahhs_sf2_file"
  ],
  gm_voice_oohs: [
    // Voice Oohs: Ensemble
    "0530_Aspirin_sf2_file",
    "0530_Chaos_sf2_file",
    "0530_FluidR3_GM_sf2_file",
    "0530_GeneralUserGS_sf2_file",
    //0530_JCLive_sf2_file // same as above
    //0530_SBLive_sf2
    // 0530_Soul_Ahhs_sf2_file // not ooh
    //0530_SoundBlasterOld_sf2
    "0531_FluidR3_GM_sf2_file",
    // 0531_GeneralUserGS_sf2_file // ends crackle
    "0531_JCLive_sf2_file"
    //0531_SoundBlasterOld_sf
  ],
  gm_synth_choir: [
    // Synth Choir: Ensemble
    "0540_Aspirin_sf2_file",
    "0540_Chaos_sf2_file",
    "0540_FluidR3_GM_sf2_file",
    "0540_GeneralUserGS_sf2_file",
    //0540_JCLive_sf2_file // large + crackles
    //0540_SBLive_sf2
    //0540_SoundBlasterOld_sf2
    "0541_FluidR3_GM_sf2_file"
  ],
  gm_orchestra_hit: [
    // Orchestra Hit: Ensemble
    "0550_Aspirin_sf2_file",
    "0550_Chaos_sf2_file",
    "0550_FluidR3_GM_sf2_file",
    "0550_GeneralUserGS_sf2_file",
    //0550_JCLive_sf2_file // same as above
    //0550_SBLive_sf2
    //0550_SoundBlasterOld_sf2
    //0551_Aspirin_sf2_file // not an orch hit..
    "0551_FluidR3_GM_sf2_file"
  ],
  gm_trumpet: [
    // Trumpet: Brass
    "0560_FluidR3_GM_sf2_file",
    "0560_JCLive_sf2_file",
    "0560_Aspirin_sf2_file",
    "0560_Chaos_sf2_file"
    //0560_GeneralUserGS_sf2_file // _1 oct
    //0560_SBLive_sf2
    //0560_SoundBlasterOld_sf
  ],
  gm_trombone: [
    // Trombone: Brass
    "0570_Aspirin_sf2_file",
    "0570_Chaos_sf2_file",
    "0570_FluidR3_GM_sf2_file",
    "0570_GeneralUserGS_sf2_file",
    //0570_JCLive_sf2_file // _1oct
    //0570_SBLive_sf2
    //0570_SoundBlasterOld_sf2
    "0571_GeneralUserGS_sf2_file"
  ],
  gm_tuba: [
    // Tuba: Brass
    "0580_FluidR3_GM_sf2_file",
    "0580_Aspirin_sf2_file",
    "0580_Chaos_sf2_file",
    "0580_GeneralUserGS_sf2_file"
    //0580_JCLive_sf2_file // _1oct
    //0580_SBLive_sf2
    //0580_SoundBlasterOld_sf2
    //0581_GeneralUserGS_sf2_file // missin
  ],
  gm_muted_trumpet: [
    // Muted Trumpet: Brass
    "0590_JCLive_sf2_file",
    "0590_Aspirin_sf2_file",
    "0590_Chaos_sf2_file",
    "0590_FluidR3_GM_sf2_file",
    "0590_GeneralUserGS_sf2_file"
    //0590_SBLive_sf2
    //0590_SoundBlasterOld_sf2
    // 0591_GeneralUserGS_sf2_file // missin
  ],
  gm_french_horn: [
    // French Horn: Brass
    "0600_Aspirin_sf2_file",
    //0600_Chaos_sf2_file // weird jumps
    "0600_FluidR3_GM_sf2_file",
    "0600_GeneralUserGS_sf2_file",
    "0600_JCLive_sf2_file",
    //0600_SBLive_sf2
    //0600_SoundBlasterOld_sf2
    "0601_FluidR3_GM_sf2_file"
    //0601_GeneralUserGS_sf2_file // tiny crackles
    // 0602_GeneralUserGS_sf2_file // bad gain diffs
    // 0603_GeneralUserGS_sf2_file // tiny crackle
  ],
  gm_brass_section: [
    // Brass Section: Brass
    "0610_JCLive_sf2_file",
    "0610_Aspirin_sf2_file",
    "0610_Chaos_sf2_file",
    "0610_FluidR3_GM_sf2_file",
    "0610_GeneralUserGS_sf2_file"
    //0610_SBLive_sf2
    //0610_SoundBlasterOld_sf2
    // 0611_GeneralUserGS_sf2_file // missing sounds
    // 0612_GeneralUserGS_sf2_file
    //0613_GeneralUserGS_sf2_file // _1 oct
    // 0614_GeneralUserGS_sf2_file // missing sounds
    // 0615_GeneralUserGS_sf2_file // missing sound
  ],
  gm_synth_brass_1: [
    // Synth Brass 1: Brass
    "0620_Aspirin_sf2_file",
    //0620_Chaos_sf2_file // weird gain diff
    "0620_FluidR3_GM_sf2_file",
    //0620_GeneralUserGS_sf2_file // loooud
    // 0620_JCLive_sf2_file // weird gain diff
    //0620_SBLive_sf2
    //0620_SoundBlasterOld_sf2
    "0621_Aspirin_sf2_file",
    "0621_FluidR3_GM_sf2_file"
    // 0621_GeneralUserGS_sf2_file // detune + loooud
    //0622_FluidR3_GM_sf2_file // loud..
    //0622_GeneralUserGS_sf2_file // loud + crackle
  ],
  gm_synth_brass_2: [
    // Synth Brass 2: Brass
    "0630_Aspirin_sf2_file",
    "0630_Chaos_sf2_file",
    "0630_FluidR3_GM_sf2_file",
    //0630_GeneralUserGS_sf2_file // detune + looud
    "0630_JCLive_sf2_file",
    //0630_SBLive_sf2
    //0630_SoundBlasterOld_sf2
    // 0631_Aspirin_sf2_file // looud + detune + gain diffs
    "0631_FluidR3_GM_sf2_file",
    //0631_GeneralUserGS_sf2_file // crackles
    "0632_FluidR3_GM_sf2_file",
    "0633_FluidR3_GM_sf2_file"
  ],
  gm_soprano_sax: [
    // Soprano Sax: Reed
    "0640_JCLive_sf2_file",
    "0640_Aspirin_sf2_file",
    "0640_Chaos_sf2_file",
    "0640_FluidR3_GM_sf2_file",
    // 0640_GeneralUserGS_sf2_file // crackles
    //0640_SBLive_sf2
    //0640_SoundBlasterOld_sf2
    "0641_FluidR3_GM_sf2_file"
  ],
  gm_alto_sax: [
    // Alto Sax: Reed
    //0650_Aspirin_sf2_file // this is not an alto sax
    "0650_JCLive_sf2_file",
    "0650_Chaos_sf2_file",
    "0650_FluidR3_GM_sf2_file",
    "0650_GeneralUserGS_sf2_file",
    //0650_SBLive_sf2
    //0650_SoundBlasterOld_sf2
    "0651_Aspirin_sf2_file",
    "0651_FluidR3_GM_sf2_file"
  ],
  gm_tenor_sax: [
    // Tenor Sax: Reed
    "0660_JCLive_sf2_file",
    "0660_Aspirin_sf2_file",
    "0660_Chaos_sf2_file",
    //0660_FluidR3_GM_sf2_file // weird pitches
    "0660_GeneralUserGS_sf2_file"
    //0660_SBLive_sf2
    //0660_SoundBlasterOld_sf2
    // 0661_FluidR3_GM_sf2_file // weird pitches
    // 0661_GeneralUserGS_sf2_file // missin
  ],
  gm_baritone_sax: [
    // Baritone Sax: Reed
    "0670_JCLive_sf2_file",
    "0670_Aspirin_sf2_file",
    "0670_Chaos_sf2_file",
    "0670_FluidR3_GM_sf2_file",
    "0670_GeneralUserGS_sf2_file",
    //0670_SBLive_sf2
    //0670_SoundBlasterOld_sf2
    "0671_FluidR3_GM_sf2_file"
  ],
  gm_oboe: [
    // Oboe: Reed
    //0680_Aspirin_sf2_file // tiny crackles
    "0680_JCLive_sf2_file",
    "0680_Chaos_sf2_file",
    "0680_FluidR3_GM_sf2_file",
    "0680_GeneralUserGS_sf2_file",
    //0680_SBLive_sf2
    //0680_SoundBlasterOld_sf2
    "0681_FluidR3_GM_sf2_file"
  ],
  gm_english_horn: [
    // English Horn: Reed
    "0690_JCLive_sf2_file",
    "0690_Aspirin_sf2_file",
    //0690_Chaos_sf2_file // detuned
    "0690_FluidR3_GM_sf2_file",
    //0690_GeneralUserGS_sf2_file // +1 oct
    //0690_SBLive_sf2
    //0690_SoundBlasterOld_sf2
    "0691_FluidR3_GM_sf2_file"
  ],
  gm_bassoon: [
    // Bassoon: Reed
    "0700_JCLive_sf2_file",
    //0700_Aspirin_sf2_file // detune + gain diffs
    // 0700_Chaos_sf2_file // detune + crackles
    "0700_FluidR3_GM_sf2_file",
    "0700_GeneralUserGS_sf2_file",
    //0700_SBLive_sf2
    //0700_SoundBlasterOld_sf2
    "0701_FluidR3_GM_sf2_file"
    //0701_GeneralUserGS_sf2_file // missin
  ],
  gm_clarinet: [
    // Clarinet: Reed
    "0710_JCLive_sf2_file",
    "0710_Aspirin_sf2_file",
    "0710_Chaos_sf2_file",
    "0710_FluidR3_GM_sf2_file",
    "0710_GeneralUserGS_sf2_file",
    //0710_SBLive_sf2
    //0710_SoundBlasterOld_sf2
    "0711_FluidR3_GM_sf2_file"
  ],
  gm_piccolo: [
    // Piccolo: Pipe
    "0720_JCLive_sf2_file",
    "0720_Aspirin_sf2_file",
    // 0720_Chaos_sf2_file // not a piccolo
    "0720_FluidR3_GM_sf2_file",
    "0720_GeneralUserGS_sf2_file",
    //0720_SBLive_sf2
    //0720_SoundBlasterOld_sf2
    "0721_FluidR3_GM_sf2_file"
    //0721_SoundBlasterOld_sf
  ],
  gm_flute: [
    // Flute: Pipe
    "0730_JCLive_sf2_file",
    "0730_Aspirin_sf2_file",
    //0730_Chaos_sf2_file // etune
    "0730_FluidR3_GM_sf2_file",
    "0730_GeneralUserGS_sf2_file",
    //0730_SBLive_sf2
    //0730_SoundBlasterOld_sf2
    //0731_Aspirin_sf2_file // not a flute
    "0731_FluidR3_GM_sf2_file"
    //0731_SoundBlasterOld_sf
  ],
  gm_recorder: [
    // Recorder: Pipe
    "0740_JCLive_sf2_file",
    "0740_Aspirin_sf2_file",
    "0740_Chaos_sf2_file",
    "0740_FluidR3_GM_sf2_file",
    "0740_GeneralUserGS_sf2_file"
    //0740_SBLive_sf2
    //0740_SoundBlasterOld_sf2
    // 0741_GeneralUserGS_sf2_file // missin
  ],
  gm_pan_flute: [
    // Pan Flute: Pipe
    "0750_JCLive_sf2_file",
    "0750_FluidR3_GM_sf2_file",
    "0750_Aspirin_sf2_file",
    "0750_Chaos_sf2_file",
    "0750_GeneralUserGS_sf2_file",
    //0750_SBLive_sf2
    //0750_SoundBlasterOld_sf2
    "0751_Aspirin_sf2_file",
    "0751_FluidR3_GM_sf2_file",
    "0751_GeneralUserGS_sf2_file"
    //0751_SoundBlasterOld_sf
  ],
  gm_blown_bottle: [
    // Blown bottle: Pipe
    "0760_FluidR3_GM_sf2_file",
    "0760_JCLive_sf2_file",
    // 0760_Aspirin_sf2_file // same as below w crackle
    "0760_Chaos_sf2_file",
    "0760_GeneralUserGS_sf2_file",
    //0760_SBLive_sf2
    //0760_SoundBlasterOld_sf2
    "0761_FluidR3_GM_sf2_file"
    // 0761_GeneralUserGS_sf2_file // missing
    //0761_SoundBlasterOld_sf2
    // 0762_GeneralUserGS_sf2_file // missin
  ],
  gm_shakuhachi: [
    // Shakuhachi: Pipe
    "0770_JCLive_sf2_file",
    "0771_FluidR3_GM_sf2_file",
    "0770_Aspirin_sf2_file",
    //0770_Chaos_sf2_file // not shakuhachi
    "0770_FluidR3_GM_sf2_file",
    "0770_GeneralUserGS_sf2_file"
    //0770_SBLive_sf2
    //0770_SoundBlasterOld_sf2
    // 0771_GeneralUserGS_sf2_file // missing
    // 0772_GeneralUserGS_sf2_file // missin
  ],
  gm_whistle: [
    // Whistle: Pipe
    "0780_FluidR3_GM_sf2_file",
    "0780_JCLive_sf2_file",
    "0780_Aspirin_sf2_file",
    "0780_Chaos_sf2_file"
    //0780_GeneralUserGS_sf2_file // loud..
    //0780_SBLive_sf2
    //0780_SoundBlasterOld_sf2
    // 0781_GeneralUserGS_sf2_file // detune + crackle
  ],
  gm_ocarina: [
    // Ocarina: Pipe
    "0790_FluidR3_GM_sf2_file",
    "0790_JCLive_sf2_file",
    "0790_Aspirin_sf2_file",
    //0790_Chaos_sf2_file // same as above
    "0790_GeneralUserGS_sf2_file"
    //0790_SBLive_sf2
    //0790_SoundBlasterOld_sf2
    //0791_GeneralUserGS_sf2_file // missin
  ],
  gm_lead_1_square: [
    // Lead 1 (square): Synth Lead
    "0800_Aspirin_sf2_file",
    "0800_Chaos_sf2_file",
    "0800_FluidR3_GM_sf2_file"
    // 0800_GeneralUserGS_sf2_file // detuned
    // 0800_JCLive_sf2_file // detuned
    //0800_SBLive_sf2
    //0800_SoundBlasterOld_sf2
    //0801_FluidR3_GM_sf2_file // detune
    // 0801_GeneralUserGS_sf2_file // detun
  ],
  gm_lead_2_sawtooth: [
    // Lead 2 (sawtooth): Synth Lead
    "0810_JCLive_sf2_file",
    "0810_Aspirin_sf2_file",
    "0810_Chaos_sf2_file",
    "0810_FluidR3_GM_sf2_file",
    "0810_GeneralUserGS_sf2_file",
    //0810_SBLive_sf2
    //0810_SoundBlasterOld_sf2
    "0811_Aspirin_sf2_file",
    "0811_GeneralUserGS_sf2_file"
    //0811_SoundBlasterOld_sf
  ],
  gm_lead_3_calliope: [
    // Lead 3 (calliope): Synth Lead
    "0820_JCLive_sf2_file",
    "0820_Aspirin_sf2_file",
    "0820_Chaos_sf2_file",
    "0820_FluidR3_GM_sf2_file",
    "0820_GeneralUserGS_sf2_file",
    //0820_SBLive_sf2
    //0820_SoundBlasterOld_sf2
    "0821_FluidR3_GM_sf2_file",
    "0821_GeneralUserGS_sf2_file"
    //0821_SoundBlasterOld_sf2
    // 0822_GeneralUserGS_sf2_file // missing
    //0823_GeneralUserGS_sf2_file // missin
  ],
  gm_lead_4_chiff: [
    // Lead 4 (chiff): Synth Lead
    "0830_JCLive_sf2_file",
    "0830_Aspirin_sf2_file",
    // 0830_Chaos_sf2_file // same as above
    "0830_FluidR3_GM_sf2_file",
    "0830_GeneralUserGS_sf2_file",
    //0830_SBLive_sf2
    //0830_SoundBlasterOld_sf2
    "0831_FluidR3_GM_sf2_file",
    "0831_GeneralUserGS_sf2_file"
    //0831_SoundBlasterOld_sf
  ],
  gm_lead_5_charang: [
    // Lead 5 (charang): Synth Lead
    "0840_JCLive_sf2_file",
    "0840_FluidR3_GM_sf2_file",
    "0840_Aspirin_sf2_file",
    "0840_Chaos_sf2_file",
    "0840_GeneralUserGS_sf2_file",
    //0840_SBLive_sf2
    //0840_SoundBlasterOld_sf2
    "0841_Aspirin_sf2_file",
    "0841_Chaos_sf2_file",
    "0841_FluidR3_GM_sf2_file",
    "0841_GeneralUserGS_sf2_file",
    //0841_JCLive_sf2_file // +1oct + detune
    //0841_SoundBlasterOld_sf2
    "0842_FluidR3_GM_sf2_file"
  ],
  gm_lead_6_voice: [
    // Lead 6 (voice): Synth Lead
    "0850_JCLive_sf2_file",
    "0850_Aspirin_sf2_file",
    // 0850_Chaos_sf2_file // same as above
    "0850_FluidR3_GM_sf2_file",
    // 0850_GeneralUserGS_sf2_file // no voice
    //0850_SBLive_sf2
    //0850_SoundBlasterOld_sf2
    "0851_FluidR3_GM_sf2_file",
    "0851_GeneralUserGS_sf2_file",
    "0851_JCLive_sf2_file"
    //0851_SoundBlasterOld_sf
  ],
  gm_lead_7_fifths: [
    // Lead 7 (fifths): Synth Lead
    "0860_JCLive_sf2_file",
    "0860_Aspirin_sf2_file",
    "0860_Chaos_sf2_file",
    // 0860_FluidR3_GM_sf2_file // loud and not fitting
    "0860_GeneralUserGS_sf2_file",
    //0860_SBLive_sf2
    //0860_SoundBlasterOld_sf2
    "0861_Aspirin_sf2_file"
    // 0861_FluidR3_GM_sf2_file // lout and not fitting
    //0861_SoundBlasterOld_sf
  ],
  gm_lead_8_bass_lead: [
    // Lead 8 (bass + lead): Synth Lead
    "0870_JCLive_sf2_file",
    "0870_Aspirin_sf2_file",
    "0870_Chaos_sf2_file",
    "0870_FluidR3_GM_sf2_file",
    "0870_GeneralUserGS_sf2_file"
    //0870_SBLive_sf2
    //0870_SoundBlasterOld_sf2
    // 0871_GeneralUserGS_sf2_file // loud + detune
    //0872_GeneralUserGS_sf2_file // loud
    //0873_GeneralUserGS_sf2_file // lou
  ],
  gm_pad_new_age: [
    // Pad 1 (new age): Synth Pad
    "0880_JCLive_sf2_file",
    "0880_Aspirin_sf2_file",
    "0880_Chaos_sf2_file",
    "0880_FluidR3_GM_sf2_file",
    "0880_GeneralUserGS_sf2_file",
    //0880_SBLive_sf2
    //0880_SoundBlasterOld_sf2
    "0881_Aspirin_sf2_file",
    "0881_FluidR3_GM_sf2_file",
    "0881_GeneralUserGS_sf2_file",
    //0881_SoundBlasterOld_sf2
    "0882_Aspirin_sf2_file",
    // 0882_FluidR3_GM_sf2_file // missing
    "0882_GeneralUserGS_sf2_file",
    //0883_GeneralUserGS_sf2_file // missing
    // 0884_GeneralUserGS_sf2_file // broken
    "0885_GeneralUserGS_sf2_file",
    //0886_GeneralUserGS_sf2_file // not a pad
    "0887_GeneralUserGS_sf2_file"
    //0888_GeneralUserGS_sf2_file // not a pad
    //0889_GeneralUserGS_sf2_file // not a pa
  ],
  gm_pad_warm: [
    // Pad 2 (warm): Synth Pad
    "0890_JCLive_sf2_file",
    "0890_Aspirin_sf2_file",
    "0890_Chaos_sf2_file",
    "0890_FluidR3_GM_sf2_file",
    "0890_GeneralUserGS_sf2_file",
    //0890_SBLive_sf2
    //0890_SoundBlasterOld_sf2
    "0891_Aspirin_sf2_file",
    "0891_FluidR3_GM_sf2_file"
    // 0891_GeneralUserGS_sf2_file // nois
  ],
  gm_pad_poly: [
    // Pad 3 (polysynth): Synth Pad
    //0900_Aspirin_sf2_file // same as belo
    "0900_JCLive_sf2_file",
    "0900_Chaos_sf2_file",
    "0900_FluidR3_GM_sf2_file",
    "0900_GeneralUserGS_sf2_file",
    //0900_SBLive_sf2
    //0900_SoundBlasterOld_sf2
    "0901_Aspirin_sf2_file",
    "0901_FluidR3_GM_sf2_file",
    "0901_GeneralUserGS_sf2_file"
    //0901_SoundBlasterOld_sf
  ],
  gm_pad_choir: [
    // Pad 4 (choir): Synth Pad
    "0910_FluidR3_GM_sf2_file",
    "0910_JCLive_sf2_file",
    "0910_Aspirin_sf2_file",
    //0910_Chaos_sf2_file // +1oct
    "0910_GeneralUserGS_sf2_file",
    //0910_SBLive_sf2
    //0910_SoundBlasterOld_sf2
    // 0911_Aspirin_sf2_file // fluty crackles
    "0911_GeneralUserGS_sf2_file",
    "0911_JCLive_sf2_file"
    //0911_SoundBlasterOld_sf
  ],
  gm_pad_bowed: [
    // Pad 5 (bowed): Synth Pad
    "0920_JCLive_sf2_file",
    "0920_Aspirin_sf2_file",
    //0920_Chaos_sf2_file // same as above
    //0920_FluidR3_GM_sf2_file // detuned?
    "0920_GeneralUserGS_sf2_file",
    //0920_SBLive_sf2
    //0920_SoundBlasterOld_sf2
    "0921_Aspirin_sf2_file",
    "0921_GeneralUserGS_sf2_file"
    //0921_SoundBlasterOld_sf
  ],
  gm_pad_metallic: [
    // Pad 6 (metallic): Synth Pad
    "0930_Aspirin_sf2_file",
    "0930_Chaos_sf2_file",
    "0930_FluidR3_GM_sf2_file",
    "0930_GeneralUserGS_sf2_file",
    // 0930_JCLive_sf2_file // buggy zones: guitar / synth
    //0930_SBLive_sf2
    //0930_SoundBlasterOld_sf2
    "0931_Aspirin_sf2_file",
    "0931_FluidR3_GM_sf2_file",
    "0931_GeneralUserGS_sf2_file"
    //0931_SoundBlasterOld_sf
  ],
  gm_pad_halo: [
    // Pad 7 (halo): Synth Pad
    // 0940_Aspirin_sf2_file // same as below
    "0940_Chaos_sf2_file",
    "0940_FluidR3_GM_sf2_file",
    "0940_GeneralUserGS_sf2_file",
    "0940_JCLive_sf2_file",
    //0940_SBLive_sf2
    //0940_SoundBlasterOld_sf2
    "0941_Aspirin_sf2_file",
    "0941_FluidR3_GM_sf2_file",
    "0941_GeneralUserGS_sf2_file",
    "0941_JCLive_sf2_file"
  ],
  gm_pad_sweep: [
    // Pad 8 (sweep): Synth Pad
    "0950_Aspirin_sf2_file",
    "0950_Chaos_sf2_file",
    "0950_FluidR3_GM_sf2_file",
    "0950_GeneralUserGS_sf2_file",
    "0950_JCLive_sf2_file",
    //0950_SBLive_sf2
    //0950_SoundBlasterOld_sf2
    "0951_FluidR3_GM_sf2_file",
    "0951_GeneralUserGS_sf2_file"
  ],
  gm_fx_rain: [
    // FX 1 (rain): Synth Effects
    //0960_Aspirin_sf2_file //mixed samples?
    "0960_FluidR3_GM_sf2_file",
    "0960_Chaos_sf2_file",
    "0960_GeneralUserGS_sf2_file",
    // 0960_JCLive_sf2_file // mixed samples?
    //0960_SBLive_sf2
    //0960_SoundBlasterOld_sf2
    "0961_Aspirin_sf2_file",
    "0961_FluidR3_GM_sf2_file",
    // 0961_GeneralUserGS_sf2_file // ?!?!
    //0961_SoundBlasterOld_sf2
    "0962_GeneralUserGS_sf2_file"
  ],
  gm_fx_soundtrack: [
    // FX 2 (soundtrack): Synth Effects
    "0970_FluidR3_GM_sf2_file",
    "0970_Aspirin_sf2_file",
    //0970_Chaos_sf2_file // wrong pitch
    "0970_GeneralUserGS_sf2_file",
    //0970_JCLive_sf2_file // wrong pitch
    //0970_SBLive_sf2
    //0970_SoundBlasterOld_sf2
    "0971_FluidR3_GM_sf2_file",
    "0971_GeneralUserGS_sf2_file"
    //0971_SoundBlasterOld_sf
  ],
  gm_fx_crystal: [
    // FX 3 (crystal): Synth Effects
    "0980_Aspirin_sf2_file",
    "0980_JCLive_sf2_file",
    "0980_Chaos_sf2_file",
    // 0980_FluidR3_GM_sf2_file // some notes are weird
    "0980_GeneralUserGS_sf2_file",
    "0981_FluidR3_GM_sf2_file",
    //0980_SBLive_sf2
    //0980_SoundBlasterOld_sf2
    "0981_Aspirin_sf2_file",
    "0981_GeneralUserGS_sf2_file",
    //0981_SoundBlasterOld_sf2
    "0982_GeneralUserGS_sf2_file",
    "0983_GeneralUserGS_sf2_file",
    "0984_GeneralUserGS_sf2_file"
  ],
  gm_fx_atmosphere: [
    // FX 4 (atmosphere): Synth Effects
    "0990_JCLive_sf2_file",
    "0990_Aspirin_sf2_file",
    "0990_Chaos_sf2_file",
    "0990_FluidR3_GM_sf2_file",
    "0990_GeneralUserGS_sf2_file",
    //0990_SBLive_sf2
    //0990_SoundBlasterOld_sf2
    "0991_Aspirin_sf2_file",
    "0991_FluidR3_GM_sf2_file",
    "0991_GeneralUserGS_sf2_file",
    "0991_JCLive_sf2_file",
    //0991_SoundBlasterOld_sf2
    "0992_FluidR3_GM_sf2_file",
    "0992_JCLive_sf2_file",
    "0993_JCLive_sf2_file",
    "0994_JCLive_sf2_file"
  ],
  gm_fx_brightness: [
    // FX 5 (brightness): Synth Effects
    "1000_JCLive_sf2_file",
    "1000_Aspirin_sf2_file",
    "1000_Chaos_sf2_file",
    "1000_FluidR3_GM_sf2_file",
    "1000_GeneralUserGS_sf2_file",
    //1000_SBLive_sf2
    //1000_SoundBlasterOld_sf2
    "1001_Aspirin_sf2_file",
    "1001_FluidR3_GM_sf2_file",
    "1001_GeneralUserGS_sf2_file",
    "1001_JCLive_sf2_file",
    //1001_SoundBlasterOld_sf2
    "1002_Aspirin_sf2_file",
    "1002_FluidR3_GM_sf2_file",
    "1002_GeneralUserGS_sf2_file"
  ],
  gm_fx_goblins: [
    // FX 6 (goblins): Synth Effects
    "1010_FluidR3_GM_sf2_file",
    "1010_JCLive_sf2_file",
    "1010_Aspirin_sf2_file",
    "1010_Chaos_sf2_file",
    "1010_GeneralUserGS_sf2_file",
    //1010_SBLive_sf2
    //1010_SoundBlasterOld_sf2
    "1011_Aspirin_sf2_file",
    "1011_FluidR3_GM_sf2_file",
    "1011_JCLive_sf2_file",
    "1012_Aspirin_sf2_file"
  ],
  gm_fx_echoes: [
    // FX 7 (echoes): Synth Effects
    "1020_FluidR3_GM_sf2_file",
    "1020_JCLive_sf2_file",
    "1020_Aspirin_sf2_file",
    "1020_Chaos_sf2_file",
    "1020_GeneralUserGS_sf2_file",
    //1020_SBLive_sf2
    //1020_SoundBlasterOld_sf2
    "1021_Aspirin_sf2_file",
    "1021_FluidR3_GM_sf2_file",
    "1021_GeneralUserGS_sf2_file",
    "1021_JCLive_sf2_file",
    //1021_SoundBlasterOld_sf2
    "1022_GeneralUserGS_sf2_file"
  ],
  gm_fx_sci_fi: [
    // FX 8 (sci_fi): Synth Effects
    "1030_FluidR3_GM_sf2_file",
    "1030_Aspirin_sf2_file",
    "1030_Chaos_sf2_file",
    "1030_GeneralUserGS_sf2_file",
    "1030_JCLive_sf2_file",
    //1030_SBLive_sf2
    //1030_SoundBlasterOld_sf2
    "1031_Aspirin_sf2_file",
    "1031_FluidR3_GM_sf2_file",
    "1031_GeneralUserGS_sf2_file",
    //1031_SoundBlasterOld_sf2
    "1032_FluidR3_GM_sf2_file"
  ],
  gm_sitar: [
    // Sitar: Ethnic
    "1040_Aspirin_sf2_file",
    "1040_FluidR3_GM_sf2_file",
    "1040_JCLive_sf2_file",
    "1040_Chaos_sf2_file",
    "1040_GeneralUserGS_sf2_file",
    //1040_SBLive_sf2
    //1040_SoundBlasterOld_sf2
    "1041_FluidR3_GM_sf2_file",
    "1041_GeneralUserGS_sf2_file"
  ],
  gm_banjo: [
    // Banjo: Ethnic
    "1050_FluidR3_GM_sf2_file",
    "1050_JCLive_sf2_file",
    "1050_Aspirin_sf2_file",
    "1050_Chaos_sf2_file",
    "1050_GeneralUserGS_sf2_file",
    //1050_SBLive_sf2
    //1050_SoundBlasterOld_sf2
    "1051_GeneralUserGS_sf2_file"
  ],
  gm_shamisen: [
    // Shamisen: Ethnic
    "1060_JCLive_sf2_file",
    "1060_FluidR3_GM_sf2_file",
    "1060_Aspirin_sf2_file",
    "1060_Chaos_sf2_file",
    "1060_GeneralUserGS_sf2_file",
    //1060_SBLive_sf2
    //1060_SoundBlasterOld_sf2
    "1061_FluidR3_GM_sf2_file",
    "1061_GeneralUserGS_sf2_file"
    //1061_SoundBlasterOld_sf
  ],
  gm_koto: [
    // Koto: Ethnic
    "1070_FluidR3_GM_sf2_file",
    "1070_JCLive_sf2_file",
    "1070_Aspirin_sf2_file",
    "1070_Chaos_sf2_file",
    "1070_GeneralUserGS_sf2_file",
    //1070_SBLive_sf2
    //1070_SoundBlasterOld_sf2
    "1071_FluidR3_GM_sf2_file",
    "1071_GeneralUserGS_sf2_file",
    "1072_GeneralUserGS_sf2_file",
    "1073_GeneralUserGS_sf2_file"
  ],
  gm_kalimba: [
    // Kalimba: Ethnic
    "1080_JCLive_sf2_file",
    "1080_FluidR3_GM_sf2_file",
    "1080_Aspirin_sf2_file",
    "1080_Chaos_sf2_file",
    "1080_GeneralUserGS_sf2_file"
    //1080_SBLive_sf2
    //1080_SoundBlasterOld_sf2
    //1081_SoundBlasterOld_sf
  ],
  gm_bagpipe: [
    // Bagpipe: Ethnic
    "1090_Aspirin_sf2_file"
    // '1090_Chaos_sf2_file', // broken pitches
    // '1090_GeneralUserGS_sf2_file', // broken pitches
    // '1090_FluidR3_GM_sf2_file', // broken pitches ?
    // '1090_JCLive_sf2_file', // broken pitches ?
    //1090_SBLive_sf2
    //1090_SoundBlasterOld_sf2
    //1091_SoundBlasterOld_sf
  ],
  gm_fiddle: [
    // Fiddle: Ethnic
    "1100_JCLive_sf2_file",
    "1100_Aspirin_sf2_file",
    "1100_Chaos_sf2_file",
    "1100_FluidR3_GM_sf2_file",
    "1100_GeneralUserGS_sf2_file",
    //1100_SBLive_sf2
    //1100_SoundBlasterOld_sf2
    "1101_Aspirin_sf2_file",
    "1101_FluidR3_GM_sf2_file",
    "1101_GeneralUserGS_sf2_file",
    "1102_GeneralUserGS_sf2_file"
  ],
  gm_shanai: [
    // Shanai: Ethnic
    "1110_Aspirin_sf2_file",
    "1110_FluidR3_GM_sf2_file",
    "1110_JCLive_sf2_file",
    "1110_Chaos_sf2_file",
    "1110_GeneralUserGS_sf2_file"
    //1110_SBLive_sf2
    //1110_SoundBlasterOld_sf
  ],
  gm_tinkle_bell: [
    // Tinkle Bell: Percussive
    "1120_Aspirin_sf2_file"
    // '1120_Chaos_sf2_file', // same as above
    // '1120_GeneralUserGS_sf2_file', // sounds exactly as Aspirin
    // '1120_FluidR3_GM_sf2_file', // +1oct
    // '1120_JCLive_sf2_file', // +1oct
    //1120_SBLive_sf2
    //1120_SoundBlasterOld_sf2
    //1121_SoundBlasterOld_sf
  ],
  gm_agogo: [
    // Agogo: Percussive
    "1130_JCLive_sf2_file",
    "1130_Aspirin_sf2_file",
    "1130_Chaos_sf2_file",
    "1130_FluidR3_GM_sf2_file",
    "1130_GeneralUserGS_sf2_file",
    //1130_SBLive_sf2
    //1130_SoundBlasterOld_sf2
    "1131_FluidR3_GM_sf2_file"
    //1131_SoundBlasterOld_sf
  ],
  gm_steel_drums: [
    // Steel Drums: Percussive
    "1140_FluidR3_GM_sf2_file",
    "1140_Aspirin_sf2_file",
    "1140_JCLive_sf2_file",
    "1140_Chaos_sf2_file",
    "1140_GeneralUserGS_sf2_file",
    //1140_SBLive_sf2
    //1140_SoundBlasterOld_sf2
    "1141_FluidR3_GM_sf2_file"
  ],
  gm_woodblock: [
    // Woodblock: Percussive
    "1150_JCLive_sf2_file",
    "1150_Aspirin_sf2_file",
    "1150_Chaos_sf2_file",
    "1150_FluidR3_GM_sf2_file",
    "1150_GeneralUserGS_sf2_file",
    //1150_SBLive_sf2
    //1150_SoundBlasterOld_sf2
    "1151_FluidR3_GM_sf2_file",
    "1151_GeneralUserGS_sf2_file",
    "1152_FluidR3_GM_sf2_file",
    "1152_GeneralUserGS_sf2_file"
  ],
  gm_taiko_drum: [
    // Taiko Drum: Percussive
    "1160_JCLive_sf2_file",
    "1160_FluidR3_GM_sf2_file",
    "1160_Aspirin_sf2_file",
    "1160_Chaos_sf2_file",
    "1160_GeneralUserGS_sf2_file",
    //1160_SBLive_sf2
    //1160_SoundBlasterOld_sf2
    "1161_FluidR3_GM_sf2_file",
    "1161_GeneralUserGS_sf2_file",
    //1161_SoundBlasterOld_sf2
    "1162_FluidR3_GM_sf2_file",
    "1162_GeneralUserGS_sf2_file",
    "1163_FluidR3_GM_sf2_file"
  ],
  gm_melodic_tom: [
    // Melodic Tom: Percussive
    "1170_JCLive_sf2_file",
    "1170_Aspirin_sf2_file",
    "1170_Chaos_sf2_file",
    "1170_FluidR3_GM_sf2_file",
    "1170_GeneralUserGS_sf2_file",
    //1170_SBLive_sf2
    //1170_SoundBlasterOld_sf2
    "1171_FluidR3_GM_sf2_file",
    "1171_GeneralUserGS_sf2_file",
    "1172_FluidR3_GM_sf2_file",
    "1173_FluidR3_GM_sf2_file"
  ],
  gm_synth_drum: [
    // Synth Drum: Percussive
    "1180_JCLive_sf2_file",
    "1180_Aspirin_sf2_file",
    "1180_Chaos_sf2_file",
    "1180_FluidR3_GM_sf2_file",
    "1180_GeneralUserGS_sf2_file",
    //1180_SBLive_sf2
    //1180_SoundBlasterOld_sf2
    "1181_FluidR3_GM_sf2_file",
    "1181_GeneralUserGS_sf2_file"
    //1181_SoundBlasterOld_sf
  ],
  gm_reverse_cymbal: [
    // Reverse Cymbal: Percussive
    "1190_JCLive_sf2_file",
    "1190_Aspirin_sf2_file",
    "1190_Chaos_sf2_file",
    "1190_FluidR3_GM_sf2_file",
    "1190_GeneralUserGS_sf2_file",
    //1190_SBLive_sf2
    //1190_SoundBlasterOld_sf2
    "1191_GeneralUserGS_sf2_file",
    "1192_GeneralUserGS_sf2_file",
    "1193_GeneralUserGS_sf2_file",
    "1194_GeneralUserGS_sf2_file"
  ],
  gm_guitar_fret_noise: [
    // Guitar Fret Noise: Sound effects
    "1200_JCLive_sf2_file",
    "1200_Aspirin_sf2_file",
    "1200_Chaos_sf2_file",
    "1200_FluidR3_GM_sf2_file",
    "1200_GeneralUserGS_sf2_file",
    //1200_SBLive_sf2
    //1200_SoundBlasterOld_sf2
    "1201_Aspirin_sf2_file",
    "1201_GeneralUserGS_sf2_file",
    "1202_GeneralUserGS_sf2_file"
  ],
  gm_breath_noise: [
    // Breath Noise: Sound effects
    "1210_FluidR3_GM_sf2_file",
    "1210_JCLive_sf2_file",
    "1210_Aspirin_sf2_file",
    "1210_Chaos_sf2_file",
    "1210_GeneralUserGS_sf2_file",
    //1210_SBLive_sf2
    //1210_SoundBlasterOld_sf2
    "1211_Aspirin_sf2_file",
    "1211_GeneralUserGS_sf2_file",
    "1212_GeneralUserGS_sf2_file"
  ],
  gm_seashore: [
    // Seashore: Sound effects
    "1220_JCLive_sf2_file",
    "1220_Aspirin_sf2_file",
    "1220_Chaos_sf2_file",
    "1220_FluidR3_GM_sf2_file",
    "1220_GeneralUserGS_sf2_file",
    //1220_SBLive_sf2
    //1220_SoundBlasterOld_sf2
    "1221_Aspirin_sf2_file",
    "1221_GeneralUserGS_sf2_file",
    "1221_JCLive_sf2_file",
    "1222_Aspirin_sf2_file",
    "1222_GeneralUserGS_sf2_file",
    "1223_Aspirin_sf2_file",
    "1223_GeneralUserGS_sf2_file",
    "1224_Aspirin_sf2_file",
    "1224_GeneralUserGS_sf2_file",
    "1225_GeneralUserGS_sf2_file",
    "1226_GeneralUserGS_sf2_file"
  ],
  gm_bird_tweet: [
    // Bird Tweet: Sound effects
    "1230_FluidR3_GM_sf2_file",
    "1230_JCLive_sf2_file",
    "1230_Aspirin_sf2_file",
    // '1230_Chaos_sf2_file',
    "1230_GeneralUserGS_sf2_file",
    //1230_SBLive_sf2
    //1230_SoundBlasterOld_sf2
    //'1231_Aspirin_sf2_file',
    "1231_GeneralUserGS_sf2_file",
    // dog
    // '1232_Aspirin_sf2_file',// ?
    "1232_GeneralUserGS_sf2_file",
    // horse
    // '1233_GeneralUserGS_sf2_file', //
    "1234_GeneralUserGS_sf2_file"
    // scratch
  ],
  gm_telephone: [
    // Telephone Ring: Sound effects
    "1240_JCLive_sf2_file",
    "1240_Aspirin_sf2_file",
    "1240_Chaos_sf2_file",
    "1240_FluidR3_GM_sf2_file",
    // '1240_GeneralUserGS_sf2_file',
    //1240_SBLive_sf2
    //1240_SoundBlasterOld_sf2
    "1241_Aspirin_sf2_file",
    // door?
    //'1241_GeneralUserGS_sf2_file',
    // '1242_Aspirin_sf2_file', // ?
    "1242_GeneralUserGS_sf2_file",
    // door
    "1243_Aspirin_sf2_file",
    // scratch
    "1243_GeneralUserGS_sf2_file",
    // door close?
    "1244_Aspirin_sf2_file",
    // bells
    "1244_GeneralUserGS_sf2_file"
    // bells
  ],
  gm_helicopter: [
    // Helicopter: Sound effects
    "1250_JCLive_sf2_file",
    "1250_Aspirin_sf2_file",
    // '1250_Chaos_sf2_file', // same as above
    "1250_FluidR3_GM_sf2_file",
    "1250_GeneralUserGS_sf2_file",
    //1250_SBLive_sf2
    //1250_SoundBlasterOld_sf2
    // '1251_Aspirin_sf2_file', // slooow
    "1251_FluidR3_GM_sf2_file",
    // guitar
    "1251_GeneralUserGS_sf2_file",
    // engine start with loop at end..
    "1252_Aspirin_sf2_file",
    // alien
    "1252_FluidR3_GM_sf2_file",
    // seashore
    "1252_GeneralUserGS_sf2_file",
    // carbreak
    // '1253_Aspirin_sf2_file', // plane
    "1253_GeneralUserGS_sf2_file",
    // racing car
    // '1254_Aspirin_sf2_file',
    "1254_GeneralUserGS_sf2_file",
    // breaking
    // '1255_Aspirin_sf2_file',
    "1255_GeneralUserGS_sf2_file",
    // siren
    // '1256_Aspirin_sf2_file',
    "1256_GeneralUserGS_sf2_file",
    // hmm
    // '1257_Aspirin_sf2_file',
    "1257_GeneralUserGS_sf2_file",
    // noise
    // '1258_Aspirin_sf2_file',
    "1258_GeneralUserGS_sf2_file",
    // metallic noise
    "1259_GeneralUserGS_sf2_file"
    // watery nosie
  ],
  gm_applause: [
    // Applause: Sound effects
    "1260_JCLive_sf2_file",
    "1260_Aspirin_sf2_file",
    "1260_Chaos_sf2_file",
    "1260_FluidR3_GM_sf2_file",
    "1260_GeneralUserGS_sf2_file",
    //1260_SBLive_sf2
    //1260_SoundBlasterOld_sf2
    "1261_Aspirin_sf2_file",
    "1261_GeneralUserGS_sf2_file",
    "1262_Aspirin_sf2_file",
    "1262_GeneralUserGS_sf2_file",
    "1263_Aspirin_sf2_file",
    "1263_GeneralUserGS_sf2_file",
    "1264_Aspirin_sf2_file",
    "1264_GeneralUserGS_sf2_file",
    "1265_Aspirin_sf2_file",
    "1265_GeneralUserGS_sf2_file"
  ],
  gm_gunshot: [
    // Gunshot: Sound effects
    "1270_JCLive_sf2_file",
    "1270_Aspirin_sf2_file",
    "1270_Chaos_sf2_file",
    "1270_FluidR3_GM_sf2_file",
    "1270_GeneralUserGS_sf2_file",
    //1270_SBLive_sf2
    //1270_SoundBlasterOld_sf2
    "1271_Aspirin_sf2_file",
    "1271_GeneralUserGS_sf2_file",
    "1272_Aspirin_sf2_file",
    "1272_GeneralUserGS_sf2_file",
    "1273_GeneralUserGS_sf2_file",
    "1274_GeneralUserGS_sf2_file",
    ""
  ]
};

// lib/vendor/soundfonts/fontloader.mjs
var defaultSoundfontUrl = "https://felixroos.github.io/webaudiofontdata/sound";
var soundfontUrl = defaultSoundfontUrl;
function setSoundfontUrl(value) {
  soundfontUrl = value;
}
var loadCache = {};
async function loadFont(name) {
  if (loadCache[name]) {
    return loadCache[name];
  }
  const load = async () => {
    const url = `${soundfontUrl}/${name}.js`;
    const preset = await fetch(url).then((res) => res.text());
    let [_, data] = preset.split("={");
    return eval("{" + data);
  };
  loadCache[name] = load();
  return loadCache[name];
}
async function getFontBufferSource(name3, value, ac3) {
  let { note = "c3", freq } = value;
  let midi;
  if (freq) {
    midi = Ze(freq);
  } else if (typeof note === "string") {
    midi = gt(note);
  } else if (typeof note === "number") {
    midi = note;
  } else {
    throw new Error(`unexpected "note" type "${typeof note}"`);
  }
  const { buffer, zone } = await getFontPitch(name3, midi, ac3);
  const src = ac3.createBufferSource();
  src.buffer = buffer;
  const baseDetune = zone.originalPitch - 100 * zone.coarseTune - zone.fineTune;
  const playbackRate = 1 * Math.pow(2, (100 * midi - baseDetune) / 1200);
  src.playbackRate.value = playbackRate;
  const loop = zone.loopStart > 1 && zone.loopStart < zone.loopEnd;
  if (!loop) {
  } else {
    src.loop = true;
    src.loopStart = zone.loopStart / zone.sampleRate;
    src.loopEnd = zone.loopEnd / zone.sampleRate;
  }
  return src;
}
function crossfadeLoop(buffer, zone) {
  if (globalThis.process?.env?.NO_XFADE) return;
  const loops = zone.loopStart > 1 && zone.loopStart < zone.loopEnd;
  if (!loops || !buffer) return;
  const sr2 = buffer.sampleRate;
  let start = Math.round(zone.loopStart / zone.sampleRate * sr2);
  const end = Math.round(zone.loopEnd / zone.sampleRate * sr2);
  let n2 = Math.round(sr2 * 8e-3);
  if (start < n2) {
    const shifted = Math.min(n2, Math.max(0, end - n2 * 2 - start));
    start += shifted;
    zone.loopStart = start / sr2 * zone.sampleRate;
  }
  n2 = Math.min(n2, start, end - start);
  if (n2 < 8) return;
  for (let ch2 = 0; ch2 < buffer.numberOfChannels; ch2++) {
    const d2 = buffer.getChannelData(ch2);
    for (let i = 0; i < n2; i++) {
      const w2 = (i + 1) / (n2 + 1);
      const at3 = end - n2 + i;
      d2[at3] = d2[at3] * (1 - w2) + d2[start - n2 + i] * w2;
    }
  }
}
var bufferCache = {};
async function getFontPitch(name3, pitch, ac3) {
  const key = `${name3}:::${pitch}`;
  if (bufferCache[key]) {
    return bufferCache[key];
  }
  const load2 = async () => {
    const preset2 = await loadFont(name3);
    if (!preset2) {
      throw new Error(`Could not load soundfont ${name3}`);
    }
    const zone = findZone(preset2, pitch);
    if (!zone) {
      throw new Error("no soundfont zone found for preset ", name3, "pitch", pitch);
    }
    const buffer = await getBuffer(zone, ac3);
    if (!buffer) {
      throw new Error(`no soundfont buffer found for preset ${name3}, pitch: ${pitch}`);
    }
    crossfadeLoop(buffer, zone);
    return { buffer, zone };
  };
  bufferCache[key] = load2();
  return bufferCache[key];
}
function findZone(preset2, pitch) {
  return preset2.find((zone) => {
    return zone.keyRangeLow <= pitch && zone.keyRangeHigh + 1 >= pitch;
  });
}
async function getBuffer(zone, audioContext) {
  if (zone.sample) {
    console.warn("zone.sample untested!");
    const decoded = atob(zone.sample);
    zone.buffer = audioContext.createBuffer(1, decoded.length / 2, zone.sampleRate);
    const float32Array = zone.buffer.getChannelData(0);
    let b1, b2, n2;
    for (var i = 0; i < decoded.length / 2; i++) {
      b1 = decoded.charCodeAt(i * 2);
      b2 = decoded.charCodeAt(i * 2 + 1);
      if (b1 < 0) {
        b1 = 256 + b1;
      }
      if (b2 < 0) {
        b2 = 256 + b2;
      }
      n2 = b2 * 256 + b1;
      if (n2 >= 65536 / 2) {
        n2 = n2 - 65536;
      }
      float32Array[i] = n2 / 65536;
    }
  } else {
    if (zone.file) {
      const datalen = zone.file.length;
      const arraybuffer = new ArrayBuffer(datalen);
      const view = new Uint8Array(arraybuffer);
      const decoded = atob(zone.file);
      let b;
      for (let i2 = 0; i2 < decoded.length; i2++) {
        b = decoded.charCodeAt(i2);
        view[i2] = b;
      }
      return new Promise((resolve) => audioContext.decodeAudioData(arraybuffer, resolve));
    }
  }
}
function registerSoundfonts() {
  Object.entries(gm_default).forEach(([name3, fonts]) => {
    ce2(
      name3,
      async (time, value, onended) => {
        const [attack, decay, sustain, release] = $2([
          value.attack,
          value.decay,
          value.sustain,
          value.release
        ]);
        const { duration } = value;
        const n2 = nh(value.n, fonts.length);
        const font2 = fonts[n2];
        const ctx2 = z2();
        const bufferSource = await getFontBufferSource(font2, value, ctx2);
        bufferSource.start(time);
        const envGain = ctx2.createGain();
        const node = bufferSource.connect(envGain);
        const holdEnd = time + duration;
        _2(node.gain, attack, decay, sustain, release, 0, 0.3, time, holdEnd, "linear");
        let envEnd = holdEnd + release + 0.01;
        const vibratoHandle = Te2(bufferSource.detune, value, time);
        He(bufferSource.detune, value, time, holdEnd);
        bufferSource.stop(envEnd);
        const stop = (releaseTime) => {
        };
        ue2(bufferSource, () => {
          Y2(bufferSource);
          vibratoHandle?.stop();
          onended();
        });
        return { node, stop, nodes: { source: [bufferSource], ...vibratoHandle?.nodes } };
      },
      { type: "soundfont", prebake: true, fonts }
    );
  });
}

// engine/golden/gm-zones.src.mjs
for (const k3 of Object.keys(nwaa)) if (!(k3 in globalThis)) globalThis[k3] = nwaa[k3];
globalThis.AudioContext = nwaa.AudioContext;
globalThis.OfflineAudioContext = nwaa.OfflineAudioContext;
globalThis.window = globalThis;
globalThis.self = globalThis;
{
  const _fetch = globalThis.fetch.bind(globalThis);
  const DIR = "/tmp/klt/httpcache";
  mkdirSync(DIR, { recursive: true });
  const keyOf = (u2) => DIR + "/" + Buffer.from(u2).toString("base64url").slice(0, 200);
  globalThis.fetch = async (url2, ...r) => {
    if (typeof url2 === "string" && url2.startsWith("/")) url2 = "https://klappn.com" + url2;
    if (typeof url2 !== "string" || !url2.startsWith("https://klappn.com")) return _fetch(url2, ...r);
    const key = keyOf(url2);
    if (existsSync(key)) return new Response(readFileSync(key));
    let lastErr;
    for (let a = 0; a < 3; a++) {
      try {
        const res = await _fetch(url2, ...r);
        if (!res.ok) throw new Error(`http ${res.status} ${url2}`);
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(key, buf);
        return new Response(buf);
      } catch (e) {
        lastErr = e;
        await new Promise((s) => setTimeout(s, 1e3 * (a + 1)));
      }
    }
    throw lastErr;
  };
}
setSoundfontUrl("https://klappn.com/api/snd/f");
var name2 = process.env.GM_NAME;
var midis = process.env.GM_MIDIS.split(",").map(Number);
var ctx = new nwaa.OfflineAudioContext(2, 48e3, 48e3);
var font = gm_default[name2][0];
var meta = [];
var chunks = [];
var off = 0;
for (const midi of midis) {
  const { buffer, zone } = await getFontPitch(font, midi, ctx);
  const ch2 = Math.min(2, buffer.numberOfChannels);
  const pcm = new Float32Array(buffer.length * ch2);
  for (let c2 = 0; c2 < ch2; c2++) {
    const d2 = buffer.getChannelData(c2);
    for (let i = 0; i < buffer.length; i++) pcm[i * ch2 + c2] = d2[i];
  }
  chunks.push(Buffer.from(pcm.buffer));
  const baseDetune = zone.originalPitch - 100 * (zone.coarseTune ?? 0) - (zone.fineTune ?? 0);
  const loop = zone.loopStart > 1 && zone.loopStart < zone.loopEnd;
  meta.push({
    off,
    frames: buffer.length,
    channels: ch2,
    rate: Math.pow(2, (100 * midi - baseDetune) / 1200),
    loop,
    loopBegin: loop ? zone.loopStart / zone.sampleRate / buffer.duration : 0,
    loopEnd: loop ? zone.loopEnd / zone.sampleRate / buffer.duration : 1
  });
  off += pcm.length;
}
writeFileSync("/tmp/klt/gmzones.bin", Buffer.concat(chunks));
console.log(JSON.stringify(meta));
