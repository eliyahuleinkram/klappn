-- THE DOOR SONGS — six hand-composed songs for the signed-out gallery.
-- Written by hand (no model calls), in the house idiom: setcpm(bpm/beats),
-- one drum voice per layer, orbits managed per reverb signature, bass on the
-- low octaves, chords bracketed and voiced AT OCTAVE 3+ (anything dipping to
-- octave 2 legally classifies as bass and rides the door's Bass kill), every
-- part carrying the song's one visual (@vcontrols/@vlooks/@hydra blocks).
-- The visuals run FEEDBACK (src(o0)) — trails, wakes and afterglow — so the
-- room moves like the music, not like a screensaver.
--
-- Idempotent: re-running updates the same rows (fixed UUIDs). Owner = the
-- house account (plan 'owner'), falling back to known emails.
--
--   psql "$DATABASE_URL" -f scripts/door-seed.sql

begin;

create temporary table door_owner on commit drop as
  select id from (
    -- the house account first (plan = 'owner'), then known emails as fallback
    select u.id, 0 as pri
      from "user" u join user_billing b on b.user_id = u.id and b.plan = 'owner'
    union all
    select id, 1 from "user" where email = 'eli@veiter.ai'
    union all
    select id, 2 from "user" where email = 'demo@klappn.test'
  ) c
  order by pri
  limit 1;

-- ---------------------------------------------------------------------------
-- SONG 1 · Neon Meridian — melodic techno, 124 BPM, A minor
-- ---------------------------------------------------------------------------
insert into songs (id, user_id, title, global_prompt, plan, status, featured_at)
select 'a0000000-0000-4000-8000-000000000100', id,
  'Neon Meridian',
  'hand-composed for the door',
  '{
    "bpm": 124, "key": "A minor", "genre": "Melodic Techno", "timeSignature": "4/4",
    "summary": "A neon-lit melodic techno ride in A minor: a four-on-the-floor engine, twin filtered arps answering across the stereo field, warm pads and a sub that leans into every bar.",
    "breaks": {
      "a0000000-0000-4000-8000-000000000102": {
        "chosen": 0,
        "options": [{ "label": "riser wash", "strudel": "setcpm(124/4)\n$: sound(\"bd bd bd [bd bd]\").bank(\"RolandTR909\").gain(0.52).lpf(1800).shape(0.12).room(0.3).roomsize(2).orbit(3).postgain(1)\n$: sound(\"~ cp ~ [cp cp cp cp]\").bank(\"RolandTR909\").gain(0.4).room(0.4).roomsize(3).hpf(300).orbit(5).postgain(1)\n$: note(\"a1\").sound(\"sawtooth\").lpf(saw.range(250, 4200)).gain(0.34).attack(0.05).release(0.4).slow(1).orbit(2).postgain(1)" }]
      }
    }
  }'::jsonb,
  'ready', now()
from door_owner
on conflict (id) do update
  set title = excluded.title, plan = excluded.plan, status = 'ready',
      featured_at = now(), updated_at = now();

delete from parts where song_id = 'a0000000-0000-4000-8000-000000000100';
insert into parts (id, song_id, position, label, intent, strudel, status, bars, kind) values
('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000100', 0,
 'first light',
 'Sparse dawn: breathing pads, a heartbeat kick, a whispered arp, a slow noise tide.',
 $strudel$setcpm(124/4)
$: note("<[a3,c4,e4,b4] [f3,a3,c4,g4] [c4,e4,g4,d5] [g3,b3,d4,a4]>").sound("gm_pad_warm").lpf(sine.range(700,1700).slow(16)).gain(0.3).attack(1.5).release(3).room(0.85).roomsize(6).slow(1).orbit(1).postgain(1)
$: note("a4 ~ e4 a4 ~ c5 e5 ~").sound("triangle").lpf(2600).gain(0.24).release(0.4).delay(0.45).delaytime(0.363).pan(sine.range(0.35,0.65).slow(6)).room(0.6).roomsize(4).hpf(300).orbit(2).postgain(1)
$: note("<a1 f1 c2 g1>").sound("sine").lpf(190).gain(0.48).attack(0.4).release(2).slow(1).orbit(3).postgain(1)
$: sound("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR909").lpf(480).gain(0.44).shape(0.12).room(0.2).roomsize(2).orbit(4).postgain(1)
$: sound("white*2").lpf(saw.range(400,3800).slow(4)).hpf(250).gain(sine.range(0.02,0.07).slow(4)).release(0.5).room(0.6).roomsize(4).orbit(5).postgain(1)
$: note("<e6 c6 d6 b5>").sound("gm_fx_crystal").gain(0.15).attack(0.4).release(2.5).room(0.9).roomsize(7).slow(2).orbit(6).postgain(1)
$: sound("~ hh ~ hh ~ hh ~ hh").bank("RolandTR909").gain(0.1).hpf(900).release(0.06).orbit(7).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Neon Night","looks":[{"name":"Neon Night","set":{"vSaturation":1.2,"vContrast":1.2,"vBrightness":0,"vHue":0}},{"name":"Chrome Dawn","set":{"vSaturation":0.5,"vContrast":1.4,"vBrightness":0.08,"vHue":0.6}},{"name":"Deep Violet","set":{"vSaturation":1.4,"vContrast":1.3,"vBrightness":-0.08,"vHue":0.82}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(8, 0.11, 0.9)
  .color(1.0, 0.22, 0.75)
  .kaleid(4)
  .rotate(H(saw.range(0, 6.283).slow(20)))
  .modulate(voronoi(6, 0.4, 0.6), 0.18)
  .modulate(osc(3, 0.04).rotate(1.57), H(sine.range(0.05, 0.2).slow(8)))
  .scale(H(sine.range(0.9, 1.14).slow(8)))
  .saturate(H(sine.range(1.0, 1.35).slow(4)))
  .contrast(1.3)
  .brightness(0.02)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000100', 1,
 'the drive',
 'Full engine: four-on-the-floor with a clap fill, driving eighth bass that lifts on the fourth bar, twin arps answering across the stereo field.',
 $strudel$setcpm(124/4)
$: sound("bd*4").bank("RolandTR909").lpf(900).gain(0.56).shape(0.16).room(0.15).roomsize(2).orbit(4).postgain(1)
$: sound("<[~ cp ~ cp] [~ cp ~ cp] [~ cp ~ cp] [~ cp ~ [cp cp]]>").bank("RolandTR909").gain(0.36).room(0.3).roomsize(3).hpf(300).orbit(5).postgain(1)
$: sound("[~ oh]*4").bank("RolandTR909").gain(0.24).release(0.09).hpf(600).pan(0.6).orbit(7).postgain(1)
$: sound("hh*16").bank("RolandTR909").gain(saw.range(0.07,0.2).fast(4)).hpf(750).pan(sine.range(0.35,0.65).slow(3)).orbit(7).postgain(1)
$: note("<[a1 a1 a2 a1 a1 e2 g1 a1] [f1 f1 f2 f1 f1 c2 e1 f1] [c2 c2 c3 c2 c2 g2 b1 c2] [g1 g1 g2 g1 a1 b1 d2 e2]>").sound("gm_synth_bass_1").lpf(700).gain(0.5).release(0.16).shape(0.12).slow(1).orbit(3).postgain(1)
$: note("a3 c4 e4 a4 c5 a4 e4 c4").sound("sawtooth").lpf(sine.range(900,3400).slow(8)).gain(0.28).release(0.12).delay(0.3).delaytime(0.363).pan(0.42).room(0.4).roomsize(3).orbit(2).postgain(1)
$: note("~ e5 ~ a5 ~ c6 ~ e5").sound("triangle").hpf(500).gain(0.14).release(0.25).delay(0.5).delaytime(0.242).pan(0.62).room(0.55).roomsize(4).orbit(8).postgain(1)
$: note("<[a3,c4,e4,b4] [f3,a3,c4,g4] [c4,e4,g4,d5] [g3,b3,d4,a4]>").sound("gm_pad_warm").lpf(1500).gain(0.2).attack(1).release(2.5).room(0.8).roomsize(6).slow(1).orbit(1).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Neon Night","looks":[{"name":"Neon Night","set":{"vSaturation":1.2,"vContrast":1.2,"vBrightness":0,"vHue":0}},{"name":"Chrome Dawn","set":{"vSaturation":0.5,"vContrast":1.4,"vBrightness":0.08,"vHue":0.6}},{"name":"Deep Violet","set":{"vSaturation":1.4,"vContrast":1.3,"vBrightness":-0.08,"vHue":0.82}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(8, 0.11, 0.9)
  .color(1.0, 0.22, 0.75)
  .kaleid(4)
  .rotate(H(saw.range(0, 6.283).slow(20)))
  .modulate(voronoi(6, 0.4, 0.6), 0.18)
  .modulate(osc(3, 0.04).rotate(1.57), H(sine.range(0.05, 0.2).slow(8)))
  .scale(H(sine.range(0.9, 1.14).slow(8)))
  .saturate(H(sine.range(1.0, 1.35).slow(4)))
  .contrast(1.3)
  .brightness(0.02)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000100', 2,
 'afterglow',
 'Breakdown lift: the kick thins, a soft lead sings the motif, white noise swells underneath.',
 $strudel$setcpm(124/4)
$: note("<[c4,e4,a4,b4] [a3,c4,f4,g4] [e4,g4,c5,d5] [d4,g4,b4,a4]>").sound("gm_pad_warm").lpf(sine.range(900,2100).slow(8)).gain(0.3).attack(1.2).release(3).room(0.88).roomsize(7).slow(1).orbit(1).postgain(1)
$: note("<[a4 ~ c5 e5 ~ a5 e5 c5] [f4 ~ a4 c5 ~ f5 c5 a4] [e5 ~ g4 c5 ~ e5 g5 e5] [d5 ~ b4 g4 ~ d5 g5 d5]>").sound("gm_lead_2_sawtooth").lpf(2600).gain(0.2).attack(0.05).release(0.4).vib("0.4:0.06").delay(0.45).delaytime(0.363).room(0.6).roomsize(5).slow(1).orbit(2).postgain(1)
$: note("<a1 f1 c2 g1>").sound("gm_synth_bass_2").lpf(420).gain(0.46).attack(0.1).release(1.6).slow(1).orbit(3).postgain(1)
$: sound("bd ~ ~ ~ ~ ~ bd ~").bank("RolandTR909").lpf(700).gain(0.44).shape(0.1).orbit(4).postgain(1)
$: sound("~ ~ cp ~").bank("RolandTR909").gain(0.2).room(0.6).roomsize(5).hpf(300).orbit(5).postgain(1)
$: sound("hh*8").bank("RolandTR909").gain(sine.range(0.05,0.14).slow(2)).hpf(900).orbit(7).postgain(1)
$: note("<e6 a5 g5 d6>").sound("gm_fx_crystal").gain(0.15).attack(0.5).release(3).room(0.9).roomsize(8).slow(2).orbit(6).postgain(1)
$: sound("white*2").lpf(2800).hpf(400).gain(sine.range(0.02,0.08).slow(2)).release(0.5).room(0.7).roomsize(5).orbit(8).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Neon Night","looks":[{"name":"Neon Night","set":{"vSaturation":1.2,"vContrast":1.2,"vBrightness":0,"vHue":0}},{"name":"Chrome Dawn","set":{"vSaturation":0.5,"vContrast":1.4,"vBrightness":0.08,"vHue":0.6}},{"name":"Deep Violet","set":{"vSaturation":1.4,"vContrast":1.3,"vBrightness":-0.08,"vHue":0.82}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(8, 0.11, 0.9)
  .color(1.0, 0.22, 0.75)
  .kaleid(4)
  .rotate(H(saw.range(0, 6.283).slow(20)))
  .modulate(voronoi(6, 0.4, 0.6), 0.18)
  .modulate(osc(3, 0.04).rotate(1.57), H(sine.range(0.05, 0.2).slow(8)))
  .scale(H(sine.range(0.9, 1.14).slow(8)))
  .saturate(H(sine.range(1.0, 1.35).slow(4)))
  .contrast(1.3)
  .brightness(0.02)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop');

-- ---------------------------------------------------------------------------
-- SONG 2 · Velvet Hour — jazzhop, 84 BPM, D minor
-- ---------------------------------------------------------------------------
insert into songs (id, user_id, title, global_prompt, plan, status, featured_at)
select 'a0000000-0000-4000-8000-000000000200', id,
  'Velvet Hour',
  'hand-composed for the door',
  '{
    "bpm": 84, "key": "D minor", "genre": "Jazzhop", "timeSignature": "4/4",
    "summary": "Late-lounge jazzhop in D minor: dusty MPC drums with a ghost-note fourth bar, ninth-chord Rhodes answering itself across the stereo field, upright bass walking, vibraphone upstairs."
  }'::jsonb,
  'ready', now()
from door_owner
on conflict (id) do update
  set title = excluded.title, plan = excluded.plan, status = 'ready',
      featured_at = now(), updated_at = now();

delete from parts where song_id = 'a0000000-0000-4000-8000-000000000200';
insert into parts (id, song_id, position, label, intent, strudel, status, bars, kind) values
('a0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000200', 0,
 'dust settles',
 'Crackle and filtered Rhodes ninths, brushed kick pulse, tape warmth underneath.',
 $strudel$setcpm(84/4)
$: note("<[d3,f3,a3,c4,e4] [g3,bf3,d4,f4,a4] [bf3,d4,f4,a4] [a3,c4,e4,g4]>").sound("gm_epiano1").lpf(sine.range(650,1400).slow(8)).vib("0.7:0.12").gain(0.55).attack(0.25).release(2).pan(0.45).room(0.7).roomsize(4).slow(1).orbit(1).postgain(1)
$: sound("crackle*8").density(0.45).gain(0.26).lpf(3400).hpf(280).pan(0.58).room(0.5).roomsize(3).orbit(2).postgain(1)
$: sound("bd ~ ~ ~ ~ ~ bd ~").bank("AkaiMPC60").lpf(420).gain(0.48).shape(0.08).release(0.4).orbit(3).postgain(1)
$: note("<d1 g1 bf1 a1>").sound("gm_acoustic_bass").lpf(480).gain(0.5).attack(0.02).release(1.4).slow(1).orbit(4).postgain(1)
$: sound("~ ~ ~ ~ ~ ~ [~ hh] ~").bank("AkaiMPC60").gain(0.14).hpf(600).orbit(5).postgain(1)
$: note("<[a4,d5] ~ [f4,c5] ~>").sound("gm_pad_warm").lpf(1500).gain(0.16).attack(1.4).release(3).room(0.85).roomsize(6).slow(2).orbit(6).postgain(1)
$: sound("brown*2").lpf(1100).gain(0.06).release(0.5).orbit(7).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Velvet","looks":[{"name":"Velvet","set":{"vSaturation":1.1,"vContrast":1.1,"vBrightness":0.02,"vHue":0}},{"name":"Sepia Reel","set":{"vSaturation":0.4,"vContrast":1.25,"vBrightness":0.06,"vHue":0.08}},{"name":"Blue Smoke","set":{"vSaturation":1.2,"vContrast":1.15,"vBrightness":-0.05,"vHue":0.55}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(2.2, 0.05, 0.8)
  .color(1.0, 0.68, 0.35)
  .modulate(osc(1.2, 0.02).rotate(0.8), 0.15)
  .diff(voronoi(3, 0.15, 0.4).color(0.4, 0.16, 0.1).brightness(0.05))
  .rotate(H(sine.range(-0.06, 0.06).slow(14)))
  .scale(H(sine.range(0.95, 1.12).slow(10)))
  .brightness(0.05)
  .contrast(1.12)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000200', 1,
 'the pocket',
 'Full head-nod kit with a ghost-note fourth bar, walking upright, Rhodes calls and little answers, vibraphone floating.',
 $strudel$setcpm(84/4)
$: sound("bd ~ ~ bd ~ ~ bd ~").bank("AkaiMPC60").lpf(500).gain(0.52).shape(0.1).release(0.4).orbit(3).postgain(1)
$: sound("<[~ ~ sd ~ ~ ~ sd ~] [~ ~ sd ~ ~ ~ sd ~] [~ ~ sd ~ ~ ~ sd ~] [~ ~ sd ~ ~ [~ sd] sd ~]>").bank("AkaiMPC60").gain(0.4).room(0.35).roomsize(2).hpf(200).orbit(4).postgain(1)
$: sound("hh ~ hh hh ~ hh hh ~").bank("AkaiMPC60").gain(saw.range(0.1,0.2).fast(2)).hpf(650).pan(sine.range(0.4,0.6).slow(4)).orbit(5).postgain(1)
$: note("<[d1 ~ a1 ~ d2 ~ c2 a1] [g1 ~ d2 ~ g1 ~ f1 d1] [bf1 ~ f1 ~ bf1 ~ a1 f1] [a1 ~ e2 ~ a1 ~ g1 e1]>").sound("gm_acoustic_bass").lpf(500).gain(0.55).attack(0.02).release(1.1).slow(1).orbit(6).postgain(1)
$: note("<[d3,f3,a3,c4,e4] [g3,bf3,d4,f4,a4] [bf3,d4,f4,a4,c5] [a3,c4,e4,g4,bf4]>").sound("gm_epiano1").lpf(1500).vib("0.7:0.12").gain(0.5).attack(0.15).release(1.8).pan(0.42).room(0.7).roomsize(4).slow(1).orbit(1).postgain(1)
$: note("<~ [~ ~ ~ ~ ~ [a4 c5] ~ ~] ~ [~ ~ ~ ~ ~ [g4 bf4] ~ ~]>").sound("gm_epiano1").lpf(2000).gain(0.22).release(0.9).hpf(400).pan(0.6).delay(0.3).delaytime(0.536).slow(1).orbit(7).postgain(1)
$: note("<[f5 ~ e5 ~ d5 ~ ~ ~] ~ [d5 ~ c5 ~ a4 ~ ~ ~] ~>").sound("gm_vibraphone").lpf(2400).gain(0.34).release(1.2).vib("0.5:0.1").room(0.8).roomsize(5).delay(0.3).delaytime(0.536).slow(1).orbit(8).postgain(1)
$: sound("crackle*8").density(0.4).gain(0.22).lpf(3200).hpf(300).room(0.5).roomsize(3).orbit(2).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Velvet","looks":[{"name":"Velvet","set":{"vSaturation":1.1,"vContrast":1.1,"vBrightness":0.02,"vHue":0}},{"name":"Sepia Reel","set":{"vSaturation":0.4,"vContrast":1.25,"vBrightness":0.06,"vHue":0.08}},{"name":"Blue Smoke","set":{"vSaturation":1.2,"vContrast":1.15,"vBrightness":-0.05,"vHue":0.55}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(2.2, 0.05, 0.8)
  .color(1.0, 0.68, 0.35)
  .modulate(osc(1.2, 0.02).rotate(0.8), 0.15)
  .diff(voronoi(3, 0.15, 0.4).color(0.4, 0.16, 0.1).brightness(0.05))
  .rotate(H(sine.range(-0.06, 0.06).slow(14)))
  .scale(H(sine.range(0.95, 1.12).slow(10)))
  .brightness(0.05)
  .contrast(1.12)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000200', 2,
 'upstairs',
 'B-section lift: voicings climb, muted trumpet takes one chorus, Rhodes comps offbeat under it.',
 $strudel$setcpm(84/4)
$: note("<[f3,a3,c4,e4] [bf3,d4,f4,a4] [g3,bf3,d4,f4] [a3,cs4,e4,g4]>").sound("gm_epiano1").lpf(1700).vib("0.6:0.1").gain(0.5).attack(0.15).release(1.8).pan(0.44).room(0.75).roomsize(4).slow(1).orbit(1).postgain(1)
$: note("<[~ [f4,a4] ~ ~ ~ [f4,a4] ~ ~] [~ [f4,bf4] ~ ~ ~ [f4,bf4] ~ ~] [~ [g4,bf4] ~ ~ ~ [g4,bf4] ~ ~] [~ [g4,cs5] ~ ~ ~ [g4,cs5] ~ ~]>").sound("gm_epiano2").lpf(1900).gain(0.18).release(0.5).hpf(350).pan(0.6).delay(0.25).delaytime(0.536).slow(1).orbit(7).postgain(1)
$: note("<[a4 ~ ~ g4 f4 ~ e4 ~] [f4 ~ d4 ~ ~ ~ ~ ~] [g4 ~ ~ f4 d4 ~ bf3 ~] [e4 ~ cs4 ~ ~ ~ ~ ~]>").sound("gm_muted_trumpet").lpf(1900).gain(0.3).attack(0.06).release(0.8).vib("0.5:0.08").room(0.7).roomsize(5).delay(0.25).delaytime(0.536).slow(1).orbit(8).postgain(1)
$: note("<f1 bf1 g1 a1>").sound("gm_acoustic_bass").lpf(480).gain(0.52).attack(0.02).release(1.4).slow(1).orbit(6).postgain(1)
$: sound("bd ~ ~ ~ bd ~ ~ ~").bank("AkaiMPC60").lpf(460).gain(0.46).shape(0.08).orbit(3).postgain(1)
$: sound("~ ~ [~ sd] ~ ~ ~ sd ~").bank("AkaiMPC60").gain(0.3).room(0.4).roomsize(3).hpf(200).orbit(4).postgain(1)
$: sound("~ hh ~ hh ~ hh ~ [hh hh]").bank("AkaiMPC60").gain(0.13).hpf(700).orbit(5).postgain(1)
$: sound("crackle*8").density(0.4).gain(0.22).lpf(3000).hpf(300).room(0.5).roomsize(3).orbit(2).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Velvet","looks":[{"name":"Velvet","set":{"vSaturation":1.1,"vContrast":1.1,"vBrightness":0.02,"vHue":0}},{"name":"Sepia Reel","set":{"vSaturation":0.4,"vContrast":1.25,"vBrightness":0.06,"vHue":0.08}},{"name":"Blue Smoke","set":{"vSaturation":1.2,"vContrast":1.15,"vBrightness":-0.05,"vHue":0.55}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(2.2, 0.05, 0.8)
  .color(1.0, 0.68, 0.35)
  .modulate(osc(1.2, 0.02).rotate(0.8), 0.15)
  .diff(voronoi(3, 0.15, 0.4).color(0.4, 0.16, 0.1).brightness(0.05))
  .rotate(H(sine.range(-0.06, 0.06).slow(14)))
  .scale(H(sine.range(0.95, 1.12).slow(10)))
  .brightness(0.05)
  .contrast(1.12)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop');

-- ---------------------------------------------------------------------------
-- SONG 3 · Glass Tides — liquid drum & bass, 172 BPM, E minor
-- ---------------------------------------------------------------------------
insert into songs (id, user_id, title, global_prompt, plan, status, featured_at)
select 'a0000000-0000-4000-8000-000000000300', id,
  'Glass Tides',
  'hand-composed for the door',
  '{
    "bpm": 172, "key": "E minor", "genre": "Liquid Drum & Bass", "timeSignature": "4/4",
    "summary": "Liquid drum & bass in E minor: rolling two-step with ghost snares, a deep moving sub, halo pads, choir underneath and an e-piano motif glinting off the water."
  }'::jsonb,
  'ready', now()
from door_owner
on conflict (id) do update
  set title = excluded.title, plan = excluded.plan, status = 'ready',
      featured_at = now(), updated_at = now();

delete from parts where song_id = 'a0000000-0000-4000-8000-000000000300';
insert into parts (id, song_id, position, label, intent, strudel, status, bars, kind) values
('a0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000300', 0,
 'surface',
 'Pads, sub and a slow shaker — the tide before the drums come in.',
 $strudel$setcpm(172/4)
$: note("<[e3,g3,b3,d4] [c3,e3,g3,b3] [a3,c4,e4,g4] [b3,d4,fs4,a4]>").sound("gm_pad_halo").lpf(sine.range(800,1800).slow(16)).gain(0.32).attack(1.8).release(3.5).room(0.88).roomsize(7).slow(2).orbit(1).postgain(1)
$: note("<e1 c1 a0 b0>").sound("sine").lpf(160).gain(0.5).attack(0.3).release(2.5).slow(2).orbit(2).postgain(1)
$: note("<[b4 ~ ~ g4 ~ ~ e4 ~] [~ ~ g4 ~ ~ b4 ~ ~]>").sound("gm_epiano2").lpf(2100).gain(0.26).release(0.9).delay(0.4).delaytime(0.349).pan(sine.range(0.4,0.6).slow(8)).room(0.7).roomsize(5).slow(1).orbit(3).postgain(1)
$: sound("~ ~ ~ ~ ~ ~ ~ [~ sd]").bank("RolandTR909").gain(0.16).room(0.7).roomsize(5).hpf(300).orbit(4).postgain(1)
$: sound("hh*8").bank("RolandTR909").gain(sine.range(0.04,0.1).slow(4)).hpf(1000).orbit(5).postgain(1)
$: sound("~ sh ~ sh").bank("RolandTR909").gain(0.09).hpf(800).pan(0.6).orbit(6).postgain(1)
$: note("<e6 b5 g5 fs5>").sound("gm_fx_crystal").gain(0.14).attack(0.6).release(3).room(0.92).roomsize(8).slow(4).orbit(7).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Tideline","looks":[{"name":"Tideline","set":{"vSaturation":1.15,"vContrast":1.1,"vBrightness":0,"vHue":0}},{"name":"Abyss","set":{"vSaturation":1.3,"vContrast":1.4,"vBrightness":-0.12,"vHue":0.08}},{"name":"Pearl","set":{"vSaturation":0.35,"vContrast":1.2,"vBrightness":0.1,"vHue":0}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(4, 0.05, 0.85)
  .color(0.15, 0.65, 0.95)
  .modulate(osc(3, 0.02).rotate(1.57), H(sine.range(0.1, 0.38).slow(6)))
  .mult(voronoi(3, 0.35, 0.25).color(0.45, 0.85, 0.95).brightness(0.18), 0.6)
  .modulate(osc(1.5, 0.015), 0.1)
  .scale(H(sine.range(1, 1.09).slow(4)))
  .rotate(H(sine.range(-0.03, 0.03).slow(9)))
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000300', 1,
 'undertow',
 'The rolling two-step arrives: ghost snares in the gaps, moving sub that lifts on the fourth bar, pads held wide.',
 $strudel$setcpm(172/4)
$: sound("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("RolandTR909").lpf(800).gain(0.54).shape(0.12).orbit(4).postgain(1)
$: sound("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").gain(0.42).room(0.3).roomsize(2).hpf(200).orbit(5).postgain(1)
$: sound("~ ~ ~ ~ ~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ ~").bank("RolandTR909").gain(0.12).hpf(350).room(0.4).roomsize(2).orbit(5).postgain(1)
$: sound("hh*16").bank("RolandTR909").gain(saw.range(0.06,0.16).fast(8)).hpf(800).pan(sine.range(0.38,0.62).slow(3)).orbit(6).postgain(1)
$: sound("[~ sh]*4").bank("RolandTR909").gain(0.1).hpf(900).pan(0.4).orbit(6).postgain(1)
$: note("<[e1 ~ ~ e1 ~ g1 ~ ~] [c1 ~ ~ c1 ~ e1 ~ ~] [a0 ~ ~ a0 ~ c1 ~ ~] [b0 ~ ~ b0 ~ d1 ~ b1]>").sound("sine").lpf(180).gain(0.52).release(0.5).slow(1).orbit(2).postgain(1)
$: note("<[e3,g3,b3,d4] [c3,e3,g3,b3] [a3,c4,e4,g4] [b3,d4,fs4,a4]>").sound("gm_pad_halo").lpf(1500).gain(0.24).attack(1.2).release(3).room(0.85).roomsize(6).slow(1).orbit(1).postgain(1)
$: note("<[b4 ~ ~ g4 ~ ~ e4 ~] [~ ~ g4 ~ ~ b4 ~ ~] [~ c5 ~ ~ g4 ~ ~ e4] [~ ~ b4 ~ ~ fs4 ~ ~]>").sound("gm_epiano2").lpf(2300).gain(0.24).release(0.8).delay(0.4).delaytime(0.349).pan(sine.range(0.42,0.58).slow(6)).room(0.6).roomsize(4).slow(1).orbit(3).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Tideline","looks":[{"name":"Tideline","set":{"vSaturation":1.15,"vContrast":1.1,"vBrightness":0,"vHue":0}},{"name":"Abyss","set":{"vSaturation":1.3,"vContrast":1.4,"vBrightness":-0.12,"vHue":0.08}},{"name":"Pearl","set":{"vSaturation":0.35,"vContrast":1.2,"vBrightness":0.1,"vHue":0}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(4, 0.05, 0.85)
  .color(0.15, 0.65, 0.95)
  .modulate(osc(3, 0.02).rotate(1.57), H(sine.range(0.1, 0.38).slow(6)))
  .mult(voronoi(3, 0.35, 0.25).color(0.45, 0.85, 0.95).brightness(0.18), 0.6)
  .modulate(osc(1.5, 0.015), 0.1)
  .scale(H(sine.range(1, 1.09).slow(4)))
  .rotate(H(sine.range(-0.03, 0.03).slow(9)))
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000303', 'a0000000-0000-4000-8000-000000000300', 2,
 'bloom',
 'The lift: strings swell over the roll, choir opens underneath, the motif answers itself in octaves, a snare fill turns the corner.',
 $strudel$setcpm(172/4)
$: sound("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("RolandTR909").lpf(800).gain(0.5).shape(0.12).orbit(4).postgain(1)
$: sound("<[~ ~ ~ ~ sd ~ ~ [~ sd] ~ ~ ~ ~ sd ~ ~ ~] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ [sd sd] ~]>").bank("RolandTR909").gain(0.4).room(0.3).roomsize(2).hpf(200).orbit(5).postgain(1)
$: sound("hh*16").bank("RolandTR909").gain(saw.range(0.05,0.14).fast(8)).hpf(900).pan(sine.range(0.4,0.6).slow(2)).orbit(6).postgain(1)
$: note("<[g3,b3,e4] [g3,c4,e4] [e3,a3,c4] [fs3,b3,d4]>").sound("gm_string_ensemble_1").lpf(sine.range(1000,2200).slow(8)).gain(0.26).attack(1).release(2.5).room(0.85).roomsize(6).slow(2).orbit(1).postgain(1)
$: note("<[e3,g3,b3] [c3,g3,e4] [a3,c4,e4] [b3,d4,fs4]>").sound("gm_synth_choir").lpf(1300).gain(0.14).attack(1.6).release(3).room(0.9).roomsize(7).slow(2).orbit(8).postgain(1)
$: note("<e1 c1 a0 b0>").sound("sine").lpf(170).gain(0.5).attack(0.2).release(2).slow(2).orbit(2).postgain(1)
$: note("<[b4 ~ b5 ~ g4 ~ g5 ~] [c5 ~ c6 ~ g4 ~ e5 ~]>").sound("gm_epiano2").lpf(2600).gain(0.22).release(0.7).delay(0.45).delaytime(0.262).pan(sine.range(0.4,0.6).slow(4)).room(0.65).roomsize(5).slow(1).orbit(3).postgain(1)
$: note("<e6 g6 c6 b5>").sound("gm_fx_crystal").gain(0.13).attack(0.5).release(3).room(0.92).roomsize(8).slow(2).orbit(7).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Tideline","looks":[{"name":"Tideline","set":{"vSaturation":1.15,"vContrast":1.1,"vBrightness":0,"vHue":0}},{"name":"Abyss","set":{"vSaturation":1.3,"vContrast":1.4,"vBrightness":-0.12,"vHue":0.08}},{"name":"Pearl","set":{"vSaturation":0.35,"vContrast":1.2,"vBrightness":0.1,"vHue":0}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(4, 0.05, 0.85)
  .color(0.15, 0.65, 0.95)
  .modulate(osc(3, 0.02).rotate(1.57), H(sine.range(0.1, 0.38).slow(6)))
  .mult(voronoi(3, 0.35, 0.25).color(0.45, 0.85, 0.95).brightness(0.18), 0.6)
  .modulate(osc(1.5, 0.015), 0.1)
  .scale(H(sine.range(1, 1.09).slow(4)))
  .rotate(H(sine.range(-0.03, 0.03).slow(9)))
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop');

-- ---------------------------------------------------------------------------
-- SONG 4 · Amber Signals — deep house, 121 BPM, C minor
-- ---------------------------------------------------------------------------
insert into songs (id, user_id, title, global_prompt, plan, status, featured_at)
select 'a0000000-0000-4000-8000-000000000400', id,
  'Amber Signals',
  'hand-composed for the door',
  '{
    "bpm": 121, "key": "C minor", "genre": "Deep House", "timeSignature": "4/4",
    "summary": "Deep house in C minor: a warm four-to-the-floor with tom accents, finger bass talking under ninth chords, drawbar organ answering the rim like street lights going amber.",
    "breaks": {
      "a0000000-0000-4000-8000-000000000402": {
        "chosen": 0,
        "options": [{ "label": "brake light", "strudel": "setcpm(121/4)\n$: sound(\"~ cp ~ [cp cp cp cp]\").bank(\"RolandTR909\").gain(0.42).room(0.5).roomsize(3).hpf(250).orbit(5).postgain(1)\n$: note(\"[c3,g3]\").sound(\"gm_drawbar_organ\").lpf(saw.range(400, 2800)).gain(0.3).attack(0.05).release(0.5).slow(1).orbit(2).postgain(1)" }]
      }
    }
  }'::jsonb,
  'ready', now()
from door_owner
on conflict (id) do update
  set title = excluded.title, plan = excluded.plan, status = 'ready',
      featured_at = now(), updated_at = now();

delete from parts where song_id = 'a0000000-0000-4000-8000-000000000400';
insert into parts (id, song_id, position, label, intent, strudel, status, bars, kind) values
('a0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000400', 0,
 'dusk',
 'Warm-up: kick and shaker, one held ninth with an organ dab every other bar, the bass just touching the ones.',
 $strudel$setcpm(121/4)
$: sound("bd*4").bank("RolandTR909").lpf(750).gain(0.5).shape(0.12).orbit(3).postgain(1)
$: sound("sh*8").bank("RolandTR909").gain(saw.range(0.07,0.15).fast(4)).hpf(800).pan(0.55).orbit(4).postgain(1)
$: note("<c1 ~ af0 ~>").sound("gm_electric_bass_finger").lpf(420).gain(0.5).release(1.2).slow(2).orbit(2).postgain(1)
$: note("<[c3,ef3,g3,bf3,d4] ~ [af3,c4,ef4,g4] ~>").sound("gm_epiano2").lpf(sine.range(700,1500).slow(16)).gain(0.34).attack(0.4).release(2.2).room(0.75).roomsize(5).slow(2).orbit(1).postgain(1)
$: note("<~ [~ ~ ~ [c4,ef4,g4]] ~ [~ ~ ~ [af3,c4,ef4]]>").sound("gm_drawbar_organ").lpf(1700).gain(0.18).release(0.4).delay(0.35).delaytime(0.372).pan(0.6).room(0.5).roomsize(4).slow(1).orbit(5).postgain(1)
$: sound("~ ~ ~ ~ ~ ~ [~ rim] ~").bank("RolandTR909").gain(0.18).room(0.4).roomsize(3).orbit(6).postgain(1)
$: sound("crackle*4").density(0.25).gain(0.14).hpf(500).room(0.4).roomsize(3).orbit(7).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Amber","looks":[{"name":"Amber","set":{"vSaturation":1.2,"vContrast":1.15,"vBrightness":0.02,"vHue":0}},{"name":"Neon Rain","set":{"vSaturation":1.4,"vContrast":1.25,"vBrightness":-0.04,"vHue":0.7}},{"name":"Fog","set":{"vSaturation":0.45,"vContrast":0.95,"vBrightness":0.1,"vHue":0}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
voronoi(9, 0.22, 0.5)
  .color(1.0, 0.52, 0.16)
  .modulate(osc(2, 0.04), 0.12)
  .diff(osc(6, 0.07, 0.5).color(0.5, 0.2, 0.05).rotate(H(saw.range(0, 6.283).slow(28))))
  .mult(osc(1.3, 0.02, 0.9).color(1.0, 0.8, 0.5).brightness(0.3), 0.5)
  .scale(H(sine.range(0.96, 1.08).slow(12)))
  .brightness(0.03)
  .contrast(1.22)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000402', 'a0000000-0000-4000-8000-000000000400', 1,
 'warm engine',
 'The room fills: offbeat opens, organ stabs answer the rim, a tom walks the far side, bass starts talking.',
 $strudel$setcpm(121/4)
$: sound("bd*4").bank("RolandTR909").lpf(800).gain(0.54).shape(0.14).orbit(3).postgain(1)
$: sound("[~ oh]*4").bank("RolandTR909").gain(0.24).release(0.1).hpf(650).orbit(4).postgain(1)
$: sound("sh*8").bank("RolandTR909").gain(saw.range(0.08,0.17).fast(4)).hpf(850).pan(sine.range(0.4,0.6).slow(3)).orbit(4).postgain(1)
$: sound("~ ~ rim ~ ~ rim ~ ~").bank("RolandTR909").gain(0.26).room(0.4).roomsize(3).orbit(6).postgain(1)
$: sound("~ ~ ~ ~ ~ ~ [~ lt] ~").bank("RolandTR909").gain(0.2).lpf(1200).pan(0.35).room(0.3).roomsize(2).orbit(6).postgain(1)
$: note("<[c1 ~ c1 ef1 ~ c1 ~ bf0] [af0 ~ af0 c1 ~ af0 ~ g0] [ef1 ~ ef1 g1 ~ ef1 ~ d1] [g0 ~ g0 bf0 ~ g0 c1 d1]>").sound("gm_electric_bass_finger").lpf(460).gain(0.54).release(0.5).slow(1).orbit(2).postgain(1)
$: note("<[~ [c3,ef3,g3,bf3] ~ [c3,ef3,g3,bf3]] [~ [af3,c4,ef4,g4] ~ [af3,c4,ef4,g4]] [~ [ef3,g3,bf3,d4] ~ [ef3,g3,bf3,d4]] [~ [g3,bf3,d4,f4] ~ [g3,bf3,d4,f4]]>").sound("gm_drawbar_organ").lpf(1600).gain(0.26).release(0.25).room(0.5).roomsize(4).delay(0.3).delaytime(0.372).pan(0.58).slow(1).orbit(5).postgain(1)
$: note("<[c3,ef3,g3,bf3,d4] [af3,c4,ef4,g4,bf4] [ef3,g3,bf3,d4] [g3,bf3,d4,f4]>").sound("gm_epiano2").lpf(1400).gain(0.3).attack(0.3).release(2).pan(0.44).room(0.7).roomsize(5).slow(1).orbit(1).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Amber","looks":[{"name":"Amber","set":{"vSaturation":1.2,"vContrast":1.15,"vBrightness":0.02,"vHue":0}},{"name":"Neon Rain","set":{"vSaturation":1.4,"vContrast":1.25,"vBrightness":-0.04,"vHue":0.7}},{"name":"Fog","set":{"vSaturation":0.45,"vContrast":0.95,"vBrightness":0.1,"vHue":0}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
voronoi(9, 0.22, 0.5)
  .color(1.0, 0.52, 0.16)
  .modulate(osc(2, 0.04), 0.12)
  .diff(osc(6, 0.07, 0.5).color(0.5, 0.2, 0.05).rotate(H(saw.range(0, 6.283).slow(28))))
  .mult(osc(1.3, 0.02, 0.9).color(1.0, 0.8, 0.5).brightness(0.3), 0.5)
  .scale(H(sine.range(0.96, 1.08).slow(12)))
  .brightness(0.03)
  .contrast(1.22)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000403', 'a0000000-0000-4000-8000-000000000400', 2,
 'open windows',
 'The lift: chords climb to the relative major, clean guitar riffs over piano colour on the and-of-two.',
 $strudel$setcpm(121/4)
$: sound("bd*4").bank("RolandTR909").lpf(800).gain(0.52).shape(0.12).orbit(3).postgain(1)
$: sound("[~ oh]*4").bank("RolandTR909").gain(0.22).release(0.1).hpf(650).orbit(4).postgain(1)
$: sound("~ cp ~ cp").bank("RolandTR909").gain(0.3).room(0.4).roomsize(3).hpf(250).orbit(6).postgain(1)
$: sound("sh*8").bank("RolandTR909").gain(saw.range(0.07,0.15).fast(4)).hpf(850).pan(sine.range(0.42,0.58).slow(3)).orbit(4).postgain(1)
$: note("<[ef1 ~ ef1 g1 ~ ef1 ~ bf0] [af0 ~ af0 c1 ~ af0 ~ ef1] [bf0 ~ bf0 d1 ~ bf0 ~ f1] [c1 ~ c1 ef1 ~ c1 g0 c1]>").sound("gm_electric_bass_finger").lpf(460).gain(0.52).release(0.5).slow(1).orbit(2).postgain(1)
$: note("<[ef3,g3,bf3,d4] [af3,c4,ef4,g4] [bf3,d4,f4,af4] [c4,ef4,g4,bf4]>").sound("gm_epiano2").lpf(1600).gain(0.3).attack(0.25).release(2).pan(0.44).room(0.7).roomsize(5).slow(1).orbit(1).postgain(1)
$: note("<[~ [g4,bf4] ~ ~] [~ [af4,c5] ~ ~] [~ [f4,bf4] ~ ~] [~ [g4,c5] ~ ~]>").sound("gm_piano").lpf(2400).gain(0.2).release(0.9).pan(0.6).delay(0.25).delaytime(0.372).room(0.55).roomsize(4).slow(1).orbit(7).postgain(1)
$: note("<[g4 ~ bf4 ~ c5 ~ ~ ~] [~ ef5 ~ c5 ~ ~ g4 ~] [f4 ~ af4 ~ bf4 ~ ~ ~] [~ d5 ~ bf4 ~ ~ ef5 ~]>").sound("gm_electric_guitar_clean").lpf(2200).gain(0.26).release(0.6).delay(0.35).delaytime(0.372).pan(0.38).room(0.6).roomsize(4).slow(1).orbit(5).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Amber","looks":[{"name":"Amber","set":{"vSaturation":1.2,"vContrast":1.15,"vBrightness":0.02,"vHue":0}},{"name":"Neon Rain","set":{"vSaturation":1.4,"vContrast":1.25,"vBrightness":-0.04,"vHue":0.7}},{"name":"Fog","set":{"vSaturation":0.45,"vContrast":0.95,"vBrightness":0.1,"vHue":0}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
voronoi(9, 0.22, 0.5)
  .color(1.0, 0.52, 0.16)
  .modulate(osc(2, 0.04), 0.12)
  .diff(osc(6, 0.07, 0.5).color(0.5, 0.2, 0.05).rotate(H(saw.range(0, 6.283).slow(28))))
  .mult(osc(1.3, 0.02, 0.9).color(1.0, 0.8, 0.5).brightness(0.3), 0.5)
  .scale(H(sine.range(0.96, 1.08).slow(12)))
  .brightness(0.03)
  .contrast(1.22)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop');

-- ---------------------------------------------------------------------------
-- SONG 5 · Night Bloom — trip-hop, 92 BPM, G minor
-- ---------------------------------------------------------------------------
insert into songs (id, user_id, title, global_prompt, plan, status, featured_at)
select 'a0000000-0000-4000-8000-000000000500', id,
  'Night Bloom',
  'hand-composed for the door',
  '{
    "bpm": 92, "key": "G minor", "genre": "Trip-Hop", "timeSignature": "4/4",
    "summary": "Trip-hop in G minor: a heavy slow-motion kit doubled by an 808 boom, tremolo strings low in the mix, cello underneath, a music-box motif that only comes out after midnight."
  }'::jsonb,
  'ready', now()
from door_owner
on conflict (id) do update
  set title = excluded.title, plan = excluded.plan, status = 'ready',
      featured_at = now(), updated_at = now();

delete from parts where song_id = 'a0000000-0000-4000-8000-000000000500';
insert into parts (id, song_id, position, label, intent, strudel, status, bars, kind) values
('a0000000-0000-4000-8000-000000000501', 'a0000000-0000-4000-8000-000000000500', 0,
 'closing time',
 'The room empties: low strings breathe, a heavy kick drags, rim keeps the clock, the music box hints at the theme.',
 $strudel$setcpm(92/4)
$: note("<[g2,bf2,d3] [ef2,g2,bf2] [c2,ef2,g2] [d2,fs2,a2]>").sound("gm_tremolo_strings").lpf(sine.range(500,1100).slow(16)).gain(0.34).attack(1.2).release(3).room(0.8).roomsize(6).slow(2).orbit(1).postgain(1)
$: sound("bd ~ ~ ~ ~ ~ [~ bd] ~").bank("RolandTR808").lpf(380).gain(0.55).shape(0.12).release(0.5).orbit(2).postgain(1)
$: sound("~ ~ ~ ~ rim ~ ~ ~").bank("RolandTR808").gain(0.22).room(0.5).roomsize(4).orbit(3).postgain(1)
$: sound("~ ~ hh ~ ~ ~ hh ~").bank("RolandTR808").gain(0.09).hpf(800).orbit(4).postgain(1)
$: note("<g0 ef1 c1 d1>").sound("sine").lpf(150).gain(0.5).attack(0.3).release(2.2).slow(2).orbit(5).postgain(1)
$: sound("crackle*8").density(0.5).gain(0.24).lpf(2800).hpf(250).room(0.5).roomsize(3).orbit(6).postgain(1)
$: note("<[d5 ~ ~ bf4 ~ ~ g4 ~] ~ [ef5 ~ ~ c5 ~ ~ g4 ~] ~>").sound("gm_music_box").gain(0.2).release(1.5).room(0.85).roomsize(7).delay(0.35).delaytime(0.489).slow(2).orbit(7).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Midnight","looks":[{"name":"Midnight","set":{"vSaturation":1.15,"vContrast":1.25,"vBrightness":-0.04,"vHue":0}},{"name":"Ashes","set":{"vSaturation":0.25,"vContrast":1.35,"vBrightness":-0.02,"vHue":0}},{"name":"Rose Glass","set":{"vSaturation":1.35,"vContrast":1.1,"vBrightness":0.04,"vHue":0.9}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(3, 0.025, 0.7)
  .color(0.62, 0.3, 0.85)
  .kaleid(5)
  .modulate(voronoi(2.5, 0.2, 0.4), 0.25)
  .rotate(H(saw.range(0, 6.283).slow(40)))
  .scale(H(sine.range(0.78, 1.22).slow(12)))
  .mult(osc(2, 0.02, 0.6).color(0.45, 0.18, 0.62).brightness(0.4), 0.6)
  .contrast(1.32)
  .brightness(-0.02)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000502', 'a0000000-0000-4000-8000-000000000500', 1,
 'smoke ring',
 'The full slow-motion kit lands with an 808 boom underneath; cello takes the low melody under the strings.',
 $strudel$setcpm(92/4)
$: sound("bd ~ ~ bd ~ ~ ~ bd").bank("RolandTR808").lpf(400).gain(0.56).shape(0.14).release(0.5).orbit(2).postgain(1)
$: sound("bd ~ ~ ~ ~ ~ ~ ~").bank("RolandTR808").lpf(200).gain(0.4).release(1).orbit(8).postgain(1)
$: sound("~ ~ sd ~ ~ ~ sd ~").bank("RolandTR808").gain(0.38).room(0.45).roomsize(3).hpf(180).orbit(3).postgain(1)
$: sound("hh ~ [hh hh] ~ hh ~ [~ hh] ~").bank("RolandTR808").gain(saw.range(0.09,0.17).fast(2)).hpf(600).pan(0.55).orbit(4).postgain(1)
$: note("<[g1 ~ ~ g1 ~ bf1 ~ f1] [ef1 ~ ~ ef1 ~ g1 ~ ef1] [c1 ~ ~ c1 ~ ef1 ~ c1] [d1 ~ ~ d1 ~ fs1 ~ d1]>").sound("gm_fretless_bass").lpf(420).gain(0.52).release(0.7).slow(1).orbit(5).postgain(1)
$: note("<[g3 ~ ~ ~ f3 ~ ef3 ~] [ef3 ~ ~ ~ d3 ~ c3 ~] [c3 ~ ~ ~ ef3 ~ g3 ~] [d3 ~ ~ a3 ~ ~ fs3 ~]>").sound("gm_cello").lpf(900).gain(0.3).attack(0.15).release(1.2).vib("0.5:0.1").room(0.7).roomsize(5).slow(1).orbit(7).postgain(1)
$: note("<[g2,bf2,d3] [ef2,g2,bf2] [c2,ef2,g2] [d2,fs2,a2]>").sound("gm_tremolo_strings").lpf(900).gain(0.26).attack(1).release(2.5).room(0.8).roomsize(6).slow(1).orbit(1).postgain(1)
$: sound("crackle*8").density(0.5).gain(0.22).lpf(2600).hpf(250).room(0.5).roomsize(3).orbit(6).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Midnight","looks":[{"name":"Midnight","set":{"vSaturation":1.15,"vContrast":1.25,"vBrightness":-0.04,"vHue":0}},{"name":"Ashes","set":{"vSaturation":0.25,"vContrast":1.35,"vBrightness":-0.02,"vHue":0}},{"name":"Rose Glass","set":{"vSaturation":1.35,"vContrast":1.1,"vBrightness":0.04,"vHue":0.9}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(3, 0.025, 0.7)
  .color(0.62, 0.3, 0.85)
  .kaleid(5)
  .modulate(voronoi(2.5, 0.2, 0.4), 0.25)
  .rotate(H(saw.range(0, 6.283).slow(40)))
  .scale(H(sine.range(0.78, 1.22).slow(12)))
  .mult(osc(2, 0.02, 0.6).color(0.45, 0.18, 0.62).brightness(0.4), 0.6)
  .contrast(1.32)
  .brightness(-0.02)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000503', 'a0000000-0000-4000-8000-000000000500', 2,
 'last bus',
 'Wind-down: the kit thins to kick and rim, choir pads rise, glockenspiel glints, the music box says goodnight.',
 $strudel$setcpm(92/4)
$: note("<[g3,bf3,d4] [ef3,g3,bf3] [c3,ef3,g3] [d3,fs3,a3]>").sound("gm_pad_choir").lpf(sine.range(700,1400).slow(8)).gain(0.28).attack(1.5).release(3.5).room(0.88).roomsize(7).slow(1).orbit(1).postgain(1)
$: note("<[d5 ~ ~ bf4 ~ ~ g4 ~] [ef5 ~ ~ bf4 ~ ~ g4 ~] [ef5 ~ ~ c5 ~ ~ g4 ~] [d5 ~ a4 ~ ~ fs4 ~ ~]>").sound("gm_music_box").gain(0.24).release(1.6).room(0.85).roomsize(7).delay(0.4).delaytime(0.489).slow(1).orbit(7).postgain(1)
$: note("<~ [d6 ~ bf5 ~] ~ [a5 ~ fs5 ~]>").sound("gm_glockenspiel").gain(0.1).release(1.8).room(0.9).roomsize(8).slow(2).orbit(8).postgain(1)
$: sound("bd ~ ~ ~ ~ ~ [~ bd] ~").bank("RolandTR808").lpf(380).gain(0.5).shape(0.1).release(0.5).orbit(2).postgain(1)
$: sound("~ ~ ~ ~ rim ~ ~ ~").bank("RolandTR808").gain(0.2).room(0.55).roomsize(4).orbit(3).postgain(1)
$: note("<g0 ef1 c1 d1>").sound("sine").lpf(150).gain(0.48).attack(0.4).release(2.5).slow(1).orbit(5).postgain(1)
$: sound("crackle*8").density(0.45).gain(0.22).lpf(2600).hpf(250).room(0.5).roomsize(3).orbit(6).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Midnight","looks":[{"name":"Midnight","set":{"vSaturation":1.15,"vContrast":1.25,"vBrightness":-0.04,"vHue":0}},{"name":"Ashes","set":{"vSaturation":0.25,"vContrast":1.35,"vBrightness":-0.02,"vHue":0}},{"name":"Rose Glass","set":{"vSaturation":1.35,"vContrast":1.1,"vBrightness":0.04,"vHue":0.9}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
osc(3, 0.025, 0.7)
  .color(0.62, 0.3, 0.85)
  .kaleid(5)
  .modulate(voronoi(2.5, 0.2, 0.4), 0.25)
  .rotate(H(saw.range(0, 6.283).slow(40)))
  .scale(H(sine.range(0.78, 1.22).slow(12)))
  .mult(osc(2, 0.02, 0.6).color(0.45, 0.18, 0.62).brightness(0.4), 0.6)
  .contrast(1.32)
  .brightness(-0.02)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop');

-- ---------------------------------------------------------------------------
-- SONG 6 · Paper Lanterns — ambient waltz, 76 BPM, C major, 3/4
-- ---------------------------------------------------------------------------
insert into songs (id, user_id, title, global_prompt, plan, status, featured_at)
select 'a0000000-0000-4000-8000-000000000600', id,
  'Paper Lanterns',
  'hand-composed for the door',
  '{
    "bpm": 76, "key": "C major", "genre": "Ambient", "timeSignature": "3/4",
    "summary": "An ambient waltz in C major: music box doubled by celesta, harp arpeggios in three, a soft heartbeat underneath, lanterns drifting upward and leaving trails."
  }'::jsonb,
  'ready', now()
from door_owner
on conflict (id) do update
  set title = excluded.title, plan = excluded.plan, status = 'ready',
      featured_at = now(), updated_at = now();

delete from parts where song_id = 'a0000000-0000-4000-8000-000000000600';
insert into parts (id, song_id, position, label, intent, strudel, status, bars, kind) values
('a0000000-0000-4000-8000-000000000601', 'a0000000-0000-4000-8000-000000000600', 0,
 'first lantern',
 'The lullaby alone: music box in three, celesta shadowing it a breath behind, a warm pad and a deep slow root.',
 $strudel$setcpm(76/3)
$: note("<[e5 g5 c6] [d5 f5 a5] [c5 e5 g5] [b4 d5 g5]>").sound("gm_music_box").gain(0.3).release(1.8).room(0.85).roomsize(7).delay(0.3).delaytime(0.789).slow(1).orbit(1).postgain(1)
$: note("<[e5 g5 c6] [d5 f5 a5] [c5 e5 g5] [b4 d5 g5]>").sound("gm_celesta").gain(0.12).release(1.4).pan(0.6).delay(0.4).delaytime(1.579).room(0.85).roomsize(7).slow(1).orbit(2).postgain(1)
$: note("<[c3,e3,g3] [f3,a3,c4] [a3,c4,e4] [g3,b3,d4]>").sound("gm_pad_new_age").lpf(sine.range(700,1400).slow(16)).gain(0.3).attack(2).release(4).room(0.9).roomsize(8).slow(1).orbit(3).postgain(1)
$: note("<c1 f0 a0 g0>").sound("sine").lpf(140).gain(0.46).attack(0.6).release(3).slow(1).orbit(4).postgain(1)
$: sound("~ ~ [~ hh]").bank("RolandTR808").gain(0.08).hpf(1200).orbit(5).postgain(1)
$: note("<e6 ~ g6 ~>").sound("gm_glockenspiel").gain(0.12).release(2).room(0.9).roomsize(8).slow(4).orbit(6).postgain(1)
$: sound("crackle*3").density(0.2).gain(0.12).hpf(600).room(0.5).roomsize(4).orbit(7).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Lantern","looks":[{"name":"Lantern","set":{"vSaturation":1.1,"vContrast":1.05,"vBrightness":0.04,"vHue":0}},{"name":"Moonpaper","set":{"vSaturation":0.3,"vContrast":1.1,"vBrightness":0.1,"vHue":0}},{"name":"Festival","set":{"vSaturation":1.5,"vContrast":1.15,"vBrightness":0.02,"vHue":0.12}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
voronoi(5, 0.12, 0.85)
  .color(1.0, 0.72, 0.4)
  .scrollY(H(saw.range(0.5, -0.5).slow(30)))
  .add(voronoi(8, 0.1, 0.9).color(0.95, 0.45, 0.65).scrollY(H(saw.range(0.8, -0.6).slow(44))), 0.6)
  .modulate(osc(1.2, 0.02), 0.08)
  .mult(osc(0.8, 0.01, 0.9).color(1.0, 0.85, 0.6).brightness(0.35), 0.55)
  .brightness(0.03)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000602', 'a0000000-0000-4000-8000-000000000600', 1,
 'lanterns rising',
 'The harp takes the pulse in arpeggios, flute floats a counter-melody, a soft heartbeat lands on the ones.',
 $strudel$setcpm(76/3)
$: note("<[c3 e3 g3 c4 e4 g4] [f3 a3 c4 f4 a4 c5] [a3 c4 e4 a4 c5 e5] [g3 b3 d4 g4 b4 d5]>").sound("gm_orchestral_harp").gain(0.32).release(1.2).pan(sine.range(0.42,0.58).slow(8)).room(0.8).roomsize(6).slow(1).orbit(1).postgain(1)
$: note("<[g5 ~ ~] [a5 ~ f5] [e5 ~ ~] [d5 ~ g5]>").sound("gm_flute").lpf(2400).gain(0.2).attack(0.12).release(0.8).vib("0.5:0.08").room(0.75).roomsize(6).slow(1).orbit(2).postgain(1)
$: note("<[c3,e3,g3] [f3,a3,c4] [a3,c4,e4] [g3,b3,d4]>").sound("gm_pad_new_age").lpf(1200).gain(0.24).attack(1.8).release(4).room(0.9).roomsize(8).slow(1).orbit(3).postgain(1)
$: note("<c1 f0 a0 g0>").sound("sine").lpf(140).gain(0.46).attack(0.5).release(3).slow(1).orbit(4).postgain(1)
$: sound("bd ~ ~").bank("RolandTR808").lpf(180).gain(0.26).release(0.5).orbit(5).postgain(1)
$: note("<e6 g6 a6 d6>").sound("gm_tinkle_bell").gain(0.1).release(1.5).room(0.9).roomsize(8).slow(2).orbit(6).postgain(1)
$: sound("~ hh hh").bank("RolandTR808").gain(0.07).hpf(1400).orbit(7).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Lantern","looks":[{"name":"Lantern","set":{"vSaturation":1.1,"vContrast":1.05,"vBrightness":0.04,"vHue":0}},{"name":"Moonpaper","set":{"vSaturation":0.3,"vContrast":1.1,"vBrightness":0.1,"vHue":0}},{"name":"Festival","set":{"vSaturation":1.5,"vContrast":1.15,"vBrightness":0.02,"vHue":0.12}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
voronoi(5, 0.12, 0.85)
  .color(1.0, 0.72, 0.4)
  .scrollY(H(saw.range(0.5, -0.5).slow(30)))
  .add(voronoi(8, 0.1, 0.9).color(0.95, 0.45, 0.65).scrollY(H(saw.range(0.8, -0.6).slow(44))), 0.6)
  .modulate(osc(1.2, 0.02), 0.08)
  .mult(osc(0.8, 0.01, 0.9).color(1.0, 0.85, 0.6).brightness(0.35), 0.55)
  .brightness(0.03)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop'),

('a0000000-0000-4000-8000-000000000603', 'a0000000-0000-4000-8000-000000000600', 2,
 'sky full',
 'Everything aloft at once — strings join, the lullaby and the harp interleave over the heartbeat, then breathe.',
 $strudel$setcpm(76/3)
$: note("<[e5 g5 c6] [f5 a5 c6] [e5 a5 c6] [d5 g5 b5]>").sound("gm_music_box").gain(0.28).release(1.8).room(0.85).roomsize(7).delay(0.35).delaytime(0.789).slow(1).orbit(1).postgain(1)
$: note("<[e5 g5 c6] [f5 a5 c6] [e5 a5 c6] [d5 g5 b5]>").sound("gm_celesta").gain(0.11).release(1.4).pan(0.62).delay(0.45).delaytime(1.579).room(0.85).roomsize(7).slow(1).orbit(2).postgain(1)
$: note("<[c3 g3 e4] [f3 c4 a4] [a3 e4 c5] [g3 d4 b4]>").sound("gm_orchestral_harp").gain(0.28).release(1.2).pan(0.4).room(0.8).roomsize(6).slow(1).orbit(3).postgain(1)
$: note("<[c3,e3,g3,b3] [f3,a3,c4,e4] [a3,c4,e4,g4] [g3,b3,d4,f4]>").sound("gm_string_ensemble_2").lpf(sine.range(800,1500).slow(8)).gain(0.24).attack(1.5).release(3.5).room(0.88).roomsize(7).slow(1).orbit(4).postgain(1)
$: note("<c1 f0 a0 g0>").sound("sine").lpf(140).gain(0.46).attack(0.5).release(3).slow(1).orbit(5).postgain(1)
$: sound("bd ~ ~").bank("RolandTR808").lpf(180).gain(0.24).release(0.5).orbit(6).postgain(1)
$: note("<g6 ~ e6 c6>").sound("gm_glockenspiel").gain(0.11).release(2).room(0.92).roomsize(8).slow(2).orbit(7).postgain(1)
$: sound("crackle*3").density(0.2).gain(0.1).hpf(600).room(0.5).roomsize(4).orbit(8).postgain(1)

/* @vcontrols
[{"name":"vSaturation","label":"Colour","desc":"Raise for richer, more vivid colour; lower toward greyscale.","min":0,"max":2,"step":0.05,"default":1},{"name":"vContrast","label":"Contrast","desc":"Raise for punchier light and shadow; lower for a flatter, softer image.","min":0.5,"max":2,"step":0.05,"default":1},{"name":"vBrightness","label":"Brightness","desc":"Raise to lift the whole visual brighter; lower to sink it darker.","min":-0.3,"max":0.3,"step":0.02,"default":0},{"name":"vHue","label":"Hue shift","desc":"Rotate the entire colour palette around the wheel.","min":0,"max":1,"step":0.02,"default":0}]
*/

/* @vlooks
{"default":"Lantern","looks":[{"name":"Lantern","set":{"vSaturation":1.1,"vContrast":1.05,"vBrightness":0.04,"vHue":0}},{"name":"Moonpaper","set":{"vSaturation":0.3,"vContrast":1.1,"vBrightness":0.1,"vHue":0}},{"name":"Festival","set":{"vSaturation":1.5,"vContrast":1.15,"vBrightness":0.02,"vHue":0.12}}]}
*/

/* @hydra
const vSaturation = 1
const vContrast = 1
const vBrightness = 0
const vHue = 0
voronoi(5, 0.12, 0.85)
  .color(1.0, 0.72, 0.4)
  .scrollY(H(saw.range(0.5, -0.5).slow(30)))
  .add(voronoi(8, 0.1, 0.9).color(0.95, 0.45, 0.65).scrollY(H(saw.range(0.8, -0.6).slow(44))), 0.6)
  .modulate(osc(1.2, 0.02), 0.08)
  .mult(osc(0.8, 0.01, 0.9).color(1.0, 0.85, 0.6).brightness(0.35), 0.55)
  .brightness(0.03)
  .saturate(vSaturation).contrast(vContrast).brightness(vBrightness).hue(vHue).out()
*/
$strudel$, 'ready', 8, 'loop');

commit;
