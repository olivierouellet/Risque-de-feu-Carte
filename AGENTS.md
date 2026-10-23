# Agent instructions

For AI coding assistants (Claude Code, GitHub Copilot, Codex, Cursor and others) working in this repository.
People should start with [CONTRIBUTING.md](CONTRIBUTING.md).

## What this is

A Home Assistant dashboard card (Lit and TypeScript, bundled by Rollup, distributed through HACS) for
SOPFEU's forest fire danger in Québec. It reads the
[Risque de feu](https://github.com/olivierouellet/Risque-de-feu) integration's *Alert* sensor, or queries
SOPFEU directly by zone, municipality, home location or device position.

## Before you finish

```bash
corepack enable && yarn install   # once
yarn build                        # lint, translations, type check, tests, then dist/risque-de-feu-carte.js
```

`yarn build` must pass; CI runs the same, plus HACS validation. For a visible change, look at it with
`yarn start` (`http://localhost:5050/?dark&lang=en&width=320`) in light and dark, and at 320 px.

## Conventions

* **French first.** Every document is bilingual, French section first; a change users see goes in both.
* `src/localize/languages/fr.json` is the reference: `yarn lint` checks that `en.json` has the same keys and
  `{placeholders}`, and the card falls back to French. Add every string to both files.
* The day rules in `src/danger.ts` are mirrored in Risque de feu's
  `custom_components/risque_de_feu/danger.py`: change one, change the other.
* Tests use SOPFEU responses recorded in `tests/fixtures/`, never the network.
* SOPFEU's colours and levels are in `src/const.ts`; the danger itself is never computed or corrected.
* Nothing from the network is inserted as HTML: no `unsafeHTML` or `innerHTML`; let Lit escape the text.
* `localStorage` may be missing or full: wrap every access in `try`.
* `dist/` is never committed; the release workflow builds `risque-de-feu-carte.js` from the tag and
  attaches it.
* A release bumps `package.json` and `CARD_VERSION` in `src/const.ts` in a commit titled
  `[Card] Version X.Y.Z`, then a GitHub release tagged `vX.Y.Z`.

## Commits and publishing

* Commit titles read `[Topic] What changed`, one topic per commit. Topics in use: `[Card]`, `[Tests]`, `[Tooling]`, `[Docs]`.
* **Never commit, push, tag, publish a release, or open an issue or pull request unless asked.** Approval for
  one of these is not approval for the next.
* `main` is protected against force-pushes and deletion: never rewrite history that is already pushed.
* Never post comments on issues or pull requests on the user's behalf without their review.

## AI policy

This project follows its [AI policy](AI_POLICY.md): a person reviews and understands every change, no
autonomous contributions, and nothing is posted on someone's behalf without their review.
