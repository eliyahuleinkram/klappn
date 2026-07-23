# Contributing to Klappn

Thanks for being here. Klappn is built in the open and steered
with its community — contributions of every size are welcome, from a typo fix
to a new engine feature.

## Ground rules

- **Be direct and be kind.** See `CODE_OF_CONDUCT.md`.
- **The ear is the acceptance test.** For anything that changes sound —
  engine code, prompts, effects — metrics and gates are necessary but not
  sufficient. Listen before you open the PR, and say in the PR what you
  listened to.
- **Music never waits on the network.** Playback is 100% in-browser; don't
  add server round-trips to the audio path.
- **Arrangement ops never call AI.** Drag, delete, insert are instant and
  local. AI runs only when the user explicitly asks for generation.
- **Prompts over guards.** When model output is wrong, fix the prompt rather
  than post-processing the output.

## Getting started

Dev setup lives in `README.md` (Node ≥ 22.15, Postgres, `npm run dev`). You
can run the whole app locally without any AI key — generation is the only
thing that needs one. Bring your own key (`ANTHROPIC_API_KEY`) and generation
runs at your own cost, on your own account.

## Licensing of contributions

Klappn is AGPL-3.0 (same license family as Strudel). By contributing you agree your
contribution is licensed under the repository license. We use the
[Developer Certificate of Origin](https://developercertificate.org/) —
sign off the commits in your PRs (`git commit -s`). There is no CLA and no copyright
assignment: your work stays yours, licensed to everyone under the same terms
ours is.

Contributions to this repository are never used to train models. (The hosted
service's training policy covers hosted generations only, is consented in the
ToS, and is documented on the `/open` page.)

## Pull requests

- Keep PRs focused; small is fast.
- Match the surrounding code's style and comment density.
- `npx tsc --noEmit`, `npm test`, `npm run lint`, and the build must pass.
- For sound-affecting changes, include what you listened to and on what
  device/browser.

## Questions

Open a GitHub issue or ask in the Discord (links in the README once live).
