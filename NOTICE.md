# Notices

Klappn is licensed under the GNU Affero General Public License v3.0 (see
`LICENSE`). It stands on the shoulders of the live-coding community:

- **[Strudel](https://strudel.cc)** (`@strudel/web`, `@strudel/soundfonts`,
  `@strudel/hydra`) — the pattern language every Klappn loop is written in,
  and the superdough audio engine we ship as a fallback. AGPL-3.0, by the
  TidalCycles/Strudel contributors. Klappn's license matches Strudel's on
  purpose.
- **[TidalCycles](https://tidalcycles.org)** — the lineage the pattern
  language comes from.
- **[hydra](https://hydra.ojack.xyz)** (`hydra-synth`) — the visual synth
  behind song visuals. AGPL-3.0, by Olivia Jack and contributors.
- **[Dirt-Samples](https://github.com/tidalcycles/Dirt-Samples)** — the
  community sample library served via our sound proxy. Licensing varies by
  sample bank and some provenance is unclear upstream; treat individual banks
  accordingly. Bank-by-bank provenance review is ongoing — if a bank's
  licensing concerns you, please open an issue.
- **General MIDI soundfonts** via `@strudel/soundfonts` — a modified copy is
  vendored at `lib/vendor/soundfonts/` (AGPL-3.0-or-later; its README lists
  the changes).
- **zaltz** (`engine/zaltz.c`) — Klappn's WebAssembly audio engine. Written
  in C for this project, but its DSP semantics are a faithful PORT of
  superdough's
  (formulas carry superdough file:line citations inline; the ladder filter
  is a verbatim translation). It is therefore a derivative work of
  superdough and carries AGPL-3.0-or-later, with gratitude to the Strudel
  authors — it cannot be, and is not, licensed more permissively than its
  source. The lineage, plainly: SuperDirt → superdough → zaltz.

The AI-composition prompts, pipeline, and product code are original to
Klappn and carry the repository license.
