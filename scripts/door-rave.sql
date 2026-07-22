-- VOLTAGE — the door's ONE song. A festival-grade big-room ride in F minor,
-- 128 BPM, hand-composed (no model calls) in the house idiom: setcpm(bpm/beats),
-- one drum voice per layer, orbits per reverb signature, bass on the low
-- octaves, chords bracketed at octave 3+, delay times beat-derived
-- (128 BPM: 8th 0.234 · dotted 8th 0.352 · quarter 0.469).
--
-- The arc, looping forever like a set: gates → the engine → the climb →
-- THE DROP → teeth out → underwater → the second climb → THE DROP II —
-- with one-bar turns baked as plan.breaks where the arc needs a hinge.
--
-- Idempotent (fixed UUIDs). Also UN-FEATURES the six gallery songs: the door
-- plays ONE song. Owner = the house account, same fallback as door-seed.sql.
--
--   psql "$DATABASE_URL" -f scripts/door-rave.sql

begin;

create temporary table door_owner on commit drop as
  select id from (
    select u.id, 0 as pri
      from "user" u join user_billing b on b.user_id = u.id and b.plan = 'owner'
    union all
    select id, 1 from "user" where email = 'eli@veiter.ai'
    union all
    select id, 2 from "user" where email = 'demo@klappn.test'
  ) c
  order by pri
  limit 1;

-- ONE song on the door: the gallery six step back.
update songs set featured_at = null
 where id in (
  'a0000000-0000-4000-8000-000000000100',
  'a0000000-0000-4000-8000-000000000200',
  'a0000000-0000-4000-8000-000000000300',
  'a0000000-0000-4000-8000-000000000400',
  'a0000000-0000-4000-8000-000000000500',
  'a0000000-0000-4000-8000-000000000600');

insert into songs (id, user_id, title, global_prompt, plan, status, featured_at)
select 'a0000000-0000-4000-8000-000000000700', id,
  'Voltage',
  'hand-composed for the door',
  '{
    "bpm": 128, "key": "F minor", "genre": "Big Room EDM", "timeSignature": "4/4",
    "summary": "A festival-sized big-room ride in F minor: a four-on-the-floor engine, snare rolls that climb until the floor gives way, an anthem sawtooth lead over a driving low end, and one breakdown deep enough to make the second drop hit twice as hard.",
    "breaks": {
      "a0000000-0000-4000-8000-000000000705": { "chosen": 0, "options": [{ "label": "trapdoor", "strudel": "setcpm(128/4)\n$: sound(\"bd bd [bd bd] [bd bd bd bd]\").bank(\"RolandTR909\").gain(0.5).lpf(saw.range(2200, 500)).shape(0.14).orbit(1).postgain(1)\n$: sound(\"white\").lpf(saw.range(8000, 500)).hpf(200).gain(0.16).release(0.6).room(0.5).roomsize(4).orbit(2).postgain(1)" }] },
      "a0000000-0000-4000-8000-000000000708": { "chosen": 0, "options": [{ "label": "turnover", "strudel": "setcpm(128/4)\n$: sound(\"sd*4 sd*4 sd*8 [sd*16]\").bank(\"RolandTR909\").gain(saw.range(0.22, 0.46)).hpf(260).orbit(1).postgain(1)\n$: sound(\"bd ~ bd ~\").bank(\"RolandTR909\").gain(0.5).lpf(1400).shape(0.14).orbit(2).postgain(1)\n$: note(\"f1\").sound(\"sine\").lpf(170).gain(0.4).release(0.8).slow(1).orbit(3).postgain(1)" }] }
    }
  }'::jsonb,
  'ready', now()
from door_owner
on conflict (id) do update
  set title = excluded.title, plan = excluded.plan, status = 'ready',
      featured_at = now(), updated_at = now();

delete from parts where song_id = 'a0000000-0000-4000-8000-000000000700';
insert into parts (id, song_id, position, label, intent, strudel, status, bars, kind) values

-- 1 · GATES — the room is dark, the engine idles under a filter.
('a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000700', 0,
 'gates',
 'Muffled four-on-the-floor behind a closed filter, dark pluck teasing the hook, sub leaning in — the room before the lights.',
 $strudel$setcpm(128/4)
$: sound("bd*4").bank("RolandTR909").lpf(saw.range(420,950).slow(8)).gain(0.5).shape(0.14).orbit(1).postgain(1)
$: sound("[~ hh]*4").bank("RolandTR909").gain(0.12).hpf(1000).release(0.05).orbit(2).postgain(1)
$: note("<f1 f1 ab1 c2 f1 f1 eb1 c1>").sound("sine").lpf(180).gain(0.5).attack(0.05).release(1.2).slow(1).orbit(3).postgain(1)
$: note("<[f3 ~ ~ ab3 ~ c4 ~ ~] [f3 ~ ~ ab3 ~ eb4 ~ c4]>").sound("square").lpf(sine.range(500,1600).slow(8)).gain(0.24).release(0.14).delay(0.35).delaytime(0.352).room(0.35).roomsize(3).orbit(4).postgain(1)
$: sound("white*2").lpf(saw.range(300,2400).slow(8)).hpf(240).gain(sine.range(0.02,0.06).slow(4)).release(0.4).room(0.55).roomsize(4).orbit(5).postgain(1)
$: note("<[f3,ab3,c4,eb4] [db3,f3,ab3,c4] [ab3,c4,eb4,g4] [eb3,g3,bb3,db4]>").sound("gm_pad_halo").lpf(1100).gain(0.22).attack(1.4).release(3).room(0.85).roomsize(6).slow(2).orbit(6).postgain(1)
$: note("<f6 ~ eb6 ~>").sound("gm_fx_crystal").gain(0.1).attack(0.3).release(2).room(0.9).roomsize(7).slow(2).orbit(7).postgain(1)
$strudel$, 'ready', 8, 'loop'),

-- 2 · THE ENGINE — the groove locks, hips first.
('a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000700', 1,
 'the engine',
 'The filter opens: full kick, clap on the twos, offbeat opens, a rolling synth bass and a square stab hook — the groove that locks the hips.',
 $strudel$setcpm(128/4)
$: sound("bd*4").bank("RolandTR909").lpf(1300).gain(0.56).shape(0.17).room(0.12).roomsize(2).orbit(1).postgain(1)
$: sound("<[~ cp ~ cp] [~ cp ~ cp] [~ cp ~ cp] [~ cp ~ [cp cp]]>").bank("RolandTR909").gain(0.36).hpf(300).room(0.3).roomsize(3).orbit(2).postgain(1)
$: sound("[~ oh]*4").bank("RolandTR909").gain(0.22).release(0.09).hpf(650).pan(0.58).orbit(3).postgain(1)
$: sound("hh*16").bank("RolandTR909").gain(saw.range(0.06,0.18).fast(4)).hpf(800).pan(sine.range(0.38,0.62).slow(3)).orbit(4).postgain(1)
$: note("<[f1 f1 f2 f1 f1 c2 eb1 f1] [ab1 ab1 ab2 ab1 ab1 eb2 c1 ab1] [f1 f1 f2 f1 f1 c2 eb1 f1] [db1 db1 db2 db1 eb1 eb2 g1 c2]>").sound("gm_synth_bass_1").lpf(750).gain(0.5).release(0.16).shape(0.12).slow(1).orbit(5).postgain(1)
$: note("<[f4 ~ ab4 f4 ~ c5 ~ eb4] [f4 ~ ab4 f4 ~ db5 ~ c5]>").sound("square").lpf(2400).gain(0.26).release(0.12).delay(0.32).delaytime(0.352).pan(0.45).room(0.35).roomsize(3).orbit(6).postgain(1)
$: note("~ c6 ~ f6 ~ ab5 ~ c6").sound("gm_fx_crystal").gain(0.12).release(0.4).delay(0.4).delaytime(0.234).pan(0.62).room(0.6).roomsize(4).orbit(7).postgain(1)
$strudel$, 'ready', 8, 'loop'),

-- 3 · THE CLIMB — rolls tighten, the riser leaves the ground.
('a0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000700', 2,
 'the climb',
 'The snare roll doubles and doubles again, the white riser leaves the ground, the lead pushes through an opening filter — eight bars of held breath.',
 $strudel$setcpm(128/4)
$: sound("bd*4").bank("RolandTR909").lpf(1300).gain(0.54).shape(0.16).orbit(1).postgain(1)
$: sound("<[sd*4] [sd*4] [sd*8] [sd*8] [sd*16] [sd*16] [sd*16] [sd*32]>").bank("RolandTR909").gain(saw.range(0.18,0.48).slow(8)).hpf(280).room(0.25).roomsize(2).orbit(2).postgain(1)
$: sound("white").lpf(saw.range(400,9500).slow(8)).hpf(220).gain(saw.range(0.04,0.24).slow(8)).release(0.5).room(0.5).roomsize(4).orbit(3).postgain(1)
$: note("<[f4 f4 ~ eb4 f4 ~ ab4 ~] [g4 g4 ~ f4 eb4 ~ c4 ~]>").sound("gm_lead_2_sawtooth").lpf(saw.range(600,5200).slow(8)).gain(0.3).release(0.14).delay(0.3).delaytime(0.352).room(0.35).roomsize(3).orbit(4).postgain(1)
$: note("<f1 f1 f1 [f1 c2] f1 f1 ab1 [c2 eb2]>").sound("sine").lpf(180).gain(0.48).release(0.9).slow(1).orbit(5).postgain(1)
$: sound("hh*16").bank("RolandTR909").gain(saw.range(0.08,0.22).slow(8)).hpf(850).orbit(6).postgain(1)
$: sound("<cr ~ ~ ~ ~ ~ ~ ~>").bank("RolandTR909").gain(0.26).release(1.2).hpf(400).room(0.4).roomsize(3).orbit(7).postgain(1)
$strudel$, 'ready', 8, 'loop'),

-- 4 · THE DROP — the anthem, fists in the air.
('a0000000-0000-4000-8000-000000000704', 'a0000000-0000-4000-8000-000000000700', 3,
 'THE DROP',
 'Everything at once: the anthem sawtooth hook in F minor, a driving eighth bass under a punchy four-on-the-floor, opens hot, crash on the head.',
 $strudel$setcpm(128/4)
$: sound("bd*4").bank("RolandTR909").lpf(1500).gain(0.58).shape(0.2).room(0.1).roomsize(2).orbit(1).postgain(1)
$: sound("<[~ cp ~ cp] [~ cp ~ cp] [~ cp ~ cp] [~ cp ~ [cp cp cp cp]]>").bank("RolandTR909").gain(0.38).hpf(300).room(0.3).roomsize(3).orbit(2).postgain(1)
$: sound("[~ oh]*4").bank("RolandTR909").gain(0.26).release(0.1).hpf(600).pan(0.6).orbit(3).postgain(1)
$: note("<[f4 f4 ~ eb4 f4 ~ ab4 ~] [g4 g4 ~ f4 eb4 ~ c4 ~] [f4 f4 ~ eb4 f4 ~ c5 ~] [bb4 ab4 ~ g4 f4 ~ eb4 ~]>").sound("gm_lead_2_sawtooth").lpf(3800).gain(0.34).release(0.16).delay(0.28).delaytime(0.352).room(0.35).roomsize(3).orbit(4).postgain(1)
$: note("<[f1 f1 f1 f1 f1 f1 eb1 f1] [ab1 ab1 ab1 ab1 ab1 ab1 g1 ab1] [f1 f1 f1 f1 f1 f1 eb1 f1] [db1 db1 db1 db1 eb1 eb1 eb1 c1]>").sound("sawtooth").lpf(620).gain(0.42).release(0.14).shape(0.14).slow(1).orbit(5).postgain(1)
$: note("<f1 ab1 f1 [db1 eb1]>").sound("sine").lpf(160).gain(0.46).release(0.8).slow(1).orbit(6).postgain(1)
$: sound("hh*16").bank("RolandTR909").gain(saw.range(0.07,0.2).fast(4)).hpf(800).pan(sine.range(0.36,0.64).slow(3)).orbit(7).postgain(1)
$: sound("<cr ~ ~ ~>").bank("RolandTR909").gain(0.24).release(1.4).hpf(400).room(0.45).roomsize(3).orbit(8).postgain(1)
$strudel$, 'ready', 8, 'loop'),

-- 5 · TEETH OUT — the drop bares its teeth.
('a0000000-0000-4000-8000-000000000705', 'a0000000-0000-4000-8000-000000000700', 4,
 'teeth out',
 'The hook answers itself an octave up, square stabs bite between the lines, ghost snares tighten the pocket — the drop with its teeth out.',
 $strudel$setcpm(128/4)
$: sound("bd*4").bank("RolandTR909").lpf(1500).gain(0.58).shape(0.2).room(0.1).roomsize(2).orbit(1).postgain(1)
$: sound("<[~ cp ~ cp] [~ cp ~ cp] [~ cp ~ cp] [~ cp [~ cp] [cp cp]]>").bank("RolandTR909").gain(0.38).hpf(300).room(0.3).roomsize(3).orbit(2).postgain(1)
$: sound("[~ oh]*4").bank("RolandTR909").gain(0.24).release(0.1).hpf(600).pan(0.42).orbit(3).postgain(1)
$: note("<[f5 ~ eb5 ~ f5 ~ ab5 ~] [g5 ~ f5 ~ eb5 ~ c5 ~]>").sound("gm_lead_2_sawtooth").lpf(4200).gain(0.28).release(0.14).delay(0.34).delaytime(0.234).pan(0.6).room(0.4).roomsize(3).orbit(4).postgain(1)
$: note("<[~ f3 ~ ab3 ~ ~ c4 ~] [~ f3 ~ bb3 ~ ~ db4 ~]>").sound("square").lpf(2100).gain(0.24).release(0.1).pan(0.38).room(0.3).roomsize(3).orbit(5).postgain(1)
$: note("<[f1 f1 f1 f1 f1 f1 eb1 f1] [ab1 ab1 ab1 ab1 ab1 ab1 g1 ab1] [f1 f1 f1 f1 f1 f1 eb1 f1] [db1 db1 db1 db1 eb1 eb1 eb1 c1]>").sound("sawtooth").lpf(640).gain(0.42).release(0.14).shape(0.14).slow(1).orbit(6).postgain(1)
$: sound("~ ~ [~ sd] ~ ~ [~ sd] ~ [sd sd]").bank("RolandTR909").gain(0.14).hpf(350).orbit(7).postgain(1)
$: note("<f1 ab1 f1 [db1 eb1]>").sound("sine").lpf(160).gain(0.46).release(0.8).slow(1).orbit(8).postgain(1)
$strudel$, 'ready', 8, 'loop'),

-- 6 · UNDERWATER — the floor gives way; the room breathes.
('a0000000-0000-4000-8000-000000000706', 'a0000000-0000-4000-8000-000000000700', 5,
 'underwater',
 'No kick — wide halo pads over a slow sub swell, a delayed triangle arp drifting across the field, crystal high above: the deep breath before it all comes back.',
 $strudel$setcpm(128/4)
$: note("<[f3,ab3,c4,eb4] [db3,f3,ab3,c4] [ab3,c4,eb4,g4] [eb3,g3,bb3,db4]>").sound("gm_pad_halo").lpf(sine.range(800,2000).slow(16)).gain(0.32).attack(1.8).release(3.5).room(0.9).roomsize(7).slow(2).orbit(1).postgain(1)
$: note("f4 ab4 c5 eb5 c5 ab4 f4 c4").sound("triangle").lpf(2800).gain(0.2).release(0.35).delay(0.5).delaytime(0.352).pan(sine.range(0.3,0.7).slow(6)).room(0.7).roomsize(5).hpf(280).orbit(2).postgain(1)
$: note("<f1 db1 ab1 eb1>").sound("sine").lpf(170).gain(0.44).attack(0.8).release(2.5).slow(1).orbit(3).postgain(1)
$: sound("white*2").lpf(sine.range(500,2600).slow(8)).hpf(260).gain(sine.range(0.02,0.07).slow(8)).release(0.5).room(0.6).roomsize(5).orbit(4).postgain(1)
$: note("<[f6 ~ eb6 ~] [ab6 ~ c6 ~]>").sound("gm_fx_crystal").gain(0.13).attack(0.3).release(2.4).room(0.9).roomsize(7).slow(2).orbit(5).postgain(1)
$: note("<[f4 ~ ~ ab4 ~ c5 ~ ~] [~ ~ eb5 ~ db5 ~ c5 ~]>").sound("square").lpf(1500).gain(0.16).release(0.3).delay(0.45).delaytime(0.469).room(0.6).roomsize(5).orbit(6).postgain(1)
$strudel$, 'ready', 8, 'loop'),

-- 7 · THE SECOND CLIMB — it climbs harder than the first.
('a0000000-0000-4000-8000-000000000707', 'a0000000-0000-4000-8000-000000000700', 6,
 'the second climb',
 'The kick returns and doubles at the tail, the roll runs all the way to thirty-seconds, the riser goes higher than before — the second climb outclimbs the first.',
 $strudel$setcpm(128/4)
$: sound("<[bd*4] [bd*4] [bd*4] [bd*4] [bd*4] [bd*4] [bd*8] [bd*8]>").bank("RolandTR909").lpf(1400).gain(0.55).shape(0.17).orbit(1).postgain(1)
$: sound("<[sd*4] [sd*8] [sd*8] [sd*16] [sd*16] [sd*16] [sd*32] [sd*32]>").bank("RolandTR909").gain(saw.range(0.2,0.5).slow(8)).hpf(280).room(0.25).roomsize(2).orbit(2).postgain(1)
$: sound("white").lpf(saw.range(500,11000).slow(8)).hpf(220).gain(saw.range(0.05,0.26).slow(8)).release(0.5).room(0.5).roomsize(4).orbit(3).postgain(1)
$: note("<[f4 f4 ~ eb4 f4 ~ ab4 ~] [g4 g4 ~ f4 eb4 ~ c4 ~] [f5 f5 ~ eb5 f5 ~ ab5 ~] [g5 g5 ~ f5 eb5 ~ c5 ~]>").sound("gm_lead_2_sawtooth").lpf(saw.range(800,6500).slow(8)).gain(0.3).release(0.14).delay(0.3).delaytime(0.352).room(0.35).roomsize(3).orbit(4).postgain(1)
$: note("<f1 f1 ab1 ab1 db1 db1 eb1 [eb1 eb2]>").sound("sine").lpf(180).gain(0.48).release(0.9).slow(1).orbit(5).postgain(1)
$: sound("hh*16").bank("RolandTR909").gain(saw.range(0.08,0.24).slow(8)).hpf(850).orbit(6).postgain(1)
$: sound("<cr ~ ~ ~ cr ~ ~ ~>").bank("RolandTR909").gain(0.24).release(1.2).hpf(400).room(0.4).roomsize(3).orbit(7).postgain(1)
$strudel$, 'ready', 8, 'loop'),

-- 8 · THE DROP II — twice as hard, nothing held back.
('a0000000-0000-4000-8000-000000000708', 'a0000000-0000-4000-8000-000000000700', 7,
 'THE DROP II',
 'The peak: the anthem reaches for F5 with a square counter-voice snapping back, the bass drives, opens on every offbeat, crash on the head — nothing held back.',
 $strudel$setcpm(128/4)
$: sound("bd*4").bank("RolandTR909").lpf(1600).gain(0.6).shape(0.22).room(0.1).roomsize(2).orbit(1).postgain(1)
$: sound("<[~ cp ~ cp] [~ cp ~ cp] [~ cp ~ cp] [[cp cp] cp [~ cp] [cp cp cp cp]]>").bank("RolandTR909").gain(0.4).hpf(300).room(0.3).roomsize(3).orbit(2).postgain(1)
$: sound("[~ oh]*4").bank("RolandTR909").gain(0.28).release(0.11).hpf(580).pan(0.6).orbit(3).postgain(1)
$: note("<[f4 f4 ~ eb4 f4 ~ ab4 ~] [g4 g4 ~ f4 eb4 ~ c4 ~] [f4 ab4 ~ c5 eb5 ~ f5 ~] [eb5 db5 ~ c5 bb4 ~ ab4 ~]>").sound("gm_lead_2_sawtooth").lpf(4200).gain(0.35).release(0.16).delay(0.28).delaytime(0.352).room(0.35).roomsize(3).orbit(4).postgain(1)
$: note("<[~ f4 ~ ~ ~ f4 ~ ~] [~ g4 ~ ~ ~ eb4 ~ ~] [~ ab4 ~ ~ ~ c5 ~ ~] [~ bb4 ~ ~ ~ g4 ~ ~]>").sound("square").lpf(2600).gain(0.22).release(0.1).pan(0.36).room(0.3).roomsize(3).orbit(5).postgain(1)
$: note("<[f1 f1 f1 f1 f1 f1 eb1 f1] [ab1 ab1 ab1 ab1 ab1 ab1 g1 ab1] [f1 f1 f1 f1 f1 f1 eb1 f1] [db1 db1 db1 db1 eb1 eb1 c1 c2]>").sound("sawtooth").lpf(650).gain(0.44).release(0.14).shape(0.15).slow(1).orbit(6).postgain(1)
$: sound("hh*16").bank("RolandTR909").gain(saw.range(0.08,0.22).fast(4)).hpf(800).pan(sine.range(0.35,0.65).slow(3)).orbit(7).postgain(1)
$: sound("<cr ~ ~ ~>").bank("RolandTR909").gain(0.26).release(1.4).hpf(400).room(0.45).roomsize(3).orbit(8).postgain(1)
$strudel$, 'ready', 8, 'loop');

commit;
