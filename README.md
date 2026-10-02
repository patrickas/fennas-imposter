# Fennass, Imposter — فنّاص

*Fennass* comes from فنّاص, Levantine for a liar or bluffer.

A pass-and-play "imposter" word party game in English and Levantine Arabic. It installs as a PWA and works fully offline after the first visit.

- Design spec: `docs/superpowers/specs/2026-09-27-fennas-imposter-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-27-fennas-imposter.md`

## Toolchain

Bun 1.4 is the package manager, script runner and unit-test runner. Node appears only inside the containers, for the two tools that cannot run on Bun: `vue-tsc` and Playwright's test runner.

## Develop (podman)

```bash
podman compose build                         # once: dev + e2e images (node/playwright base + Bun)
podman compose up -d web                     # bun install + Vite dev server on http://localhost:5180 (host port; 5173 is used by another project)
podman compose exec web bun test             # unit tests
podman compose exec web bun run lint
podman compose exec web bun run build        # type-check + production build into dist/
podman compose run --rm e2e                  # Playwright end-to-end tests against the production preview
```

Regenerate the app icons after replacing `public/icon.png` (a square, transparent PNG, at least 512px):

```bash
podman compose exec web bun run icons
```

## Word packs

Packs are JSON files in the format described in spec §6.1. A word can be marked `"level": "hard"`, and an easy word can carry a `subtle` hint (with an optional `why`) for hard rounds; see `docs/superpowers/specs/2026-10-03-difficulty-design.md` §3.2. You can import them on the *Backup & import* screen, from a file or from an `https://` link. The host serving the link must allow cross-origin requests; raw GitHub and Gist URLs do.

On the dev server, **test mode** is on by default: every random round deals "Secret word" / "Secret hint" / "Category", so the UI can be tried again and again. Switch it off in *Players & settings* to play real words. Production builds never show or use it.

## Deploy

The site is served by GitHub Pages from [patrickas/fennas-imposter](https://github.com/patrickas/fennas-imposter) at <https://fennas-game.abisalloum.com>. Pushing the `main` bookmark runs `.github/workflows/deploy.yml`, which installs, runs the unit tests, builds, and publishes `dist/`.

### One-time setup

1. **Pages source:** in the repo, go to *Settings → Pages* and set **Source** to **GitHub Actions**.
2. **DNS:** at the DNS provider for `abisalloum.com`, add `CNAME fennas-game → patrickas.github.io`.
3. **Custom domain:** in *Settings → Pages → Custom domain*, enter `fennas-game.abisalloum.com` and save. GitHub ignores the `public/CNAME` file when Pages publishes from Actions, so this setting is what counts.
4. **HTTPS:** once GitHub has issued the certificate (this can take a while after DNS resolves), tick **Enforce HTTPS**. The service worker and offline mode need HTTPS.

The `origin` remote is already set to `https://github.com/patrickas/fennas-imposter.git`, and a local `main` bookmark exists.

### Publishing

```bash
jj bookmark set main -r @-          # point main at the latest commit
jj git push --bookmark main         # GitHub builds and deploys in a few minutes
```

The workflow can also be re-run by hand from the *Actions* tab.

To host it yourself instead, run `podman compose exec web bun run build` and serve `dist/` from any static web server over HTTPS.

### How updates reach players

- **Check on open:** each time the app is opened online, it checks for a new version and downloads it in the background. The current game carries on undisturbed.
- **Update prompt:** "New version available — tap to reload" appears only on Home and Setup, never mid-round. Tapping it switches to the new version.
- **If the prompt is ignored:** the old version stays until the app is fully closed and reopened. Offline phones update the next time they open the app online.
- **Saved data:** players, custom words, settings, scores and a round in progress all survive updates. The data carries a version number, so future format changes can migrate it, and an older copy of the app never overwrites data saved by a newer one.
- **Word packs:** built-in packs update with the app, and the used-word history carries over.
