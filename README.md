# Fenna's Imposter — مين المندسّ؟

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

Regenerate the app icons after editing `public/icon.svg`:

```bash
podman compose exec web bun run icons
```

## Word packs

Packs are JSON files in the format described in spec §6.1. You can import them on the *Backup & import* screen, from a file or from an `https://` link. The host serving the link must allow cross-origin requests; raw GitHub and Gist URLs do.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages. One-time setup:

1. Create the GitHub repository and add it as the `origin` remote of this jj repo.
2. In the repo settings, go to **Pages** and set **Source** to **GitHub Actions**.
3. Add a DNS record: `CNAME fennas-game → <github-user>.github.io`.
4. After the first deploy, tick **Enforce HTTPS**. The service worker needs HTTPS.

The same `dist/` folder can be served by any static web server over HTTPS instead.
