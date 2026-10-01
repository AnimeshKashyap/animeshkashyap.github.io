# Deploying to GitHub Pages

This project is already configured for the `Animeshkashyap.github.io` repo
(a "user site", served at the domain root — not a project repo under
`/some-repo-name/`). If that's not the repo you end up pushing to, read the
callout at the bottom first.

There are two one-time setup steps (create the repo, enable Pages) and then
every future update is just `git push`.

## 0. Prerequisites

- Git installed and configured with your GitHub account (`git config --global user.name`/`user.email` already set).
- Node.js installed (this project was built/tested with Node 24, but anything ≥ 18 works).
- A GitHub account — you're using `Animeshkashyap` already based on the links in this site.

## 1. Create the GitHub repository

If `Animeshkashyap.github.io` doesn't exist yet on GitHub:

1. Go to https://github.com/new
2. Repository name: **exactly** `Animeshkashyap.github.io` (must match your username, case doesn't matter but the spelling does)
3. Keep it **Public** (GitHub Pages user sites must be public on free plans)
4. Do **not** initialize with a README/.gitignore/license — this local folder already has those

## 2. Push this project to GitHub

From this project folder:

```bash
git init
git add .
git commit -m "Initial portfolio site"
git branch -M main
git remote add origin https://github.com/Animeshkashyap/Animeshkashyap.github.io.git
git push -u origin main
```

If you use SSH instead of HTTPS for GitHub auth, use this remote URL instead:

```bash
git remote add origin git@github.com:Animeshkashyap/Animeshkashyap.github.io.git
```

## 3. Turn on GitHub Pages (one-time)

1. On GitHub, open the repo → **Settings** → **Pages** (left sidebar)
2. Under **Build and deployment** → **Source**, choose **GitHub Actions**
   (not "Deploy from a branch" — this repo already ships a workflow file
   at `.github/workflows/deploy.yml` that builds and deploys for you)
3. That's it — no further config needed here

## 4. Watch it deploy

After the push in step 2, GitHub automatically runs the workflow:

1. Go to the repo → **Actions** tab
2. You should see a run called "Deploy to GitHub Pages" — click it to watch
   the build + deploy steps
3. Once it finishes (green check), go back to **Settings → Pages** — it'll
   show your live URL: **https://animeshkashyap.github.io/**

First deploy can take a minute or two. Every subsequent `git push` to `main`
re-triggers the same workflow automatically — no commands to remember.

## Making changes after this

```bash
# edit files, e.g. src/data/experience.ts
git add .
git commit -m "Update experience section"
git push
```

Watch the **Actions** tab again if you want to confirm it deployed; the live
site updates within a minute or two of the push.

## Verifying the build locally before you push (optional but recommended)

```bash
npm install      # only needed once, or after pulling dependency changes
npm run build    # type-checks + builds to dist/
npm run preview  # serves dist/ locally so you can sanity-check the production build
```

If `npm run build` fails, fix that before pushing — the GitHub Actions
workflow runs the exact same command and will fail the same way.

## If you'd rather use a project repo instead of `username.github.io`

If you create this under a different repo name (e.g. `portfolio`) instead
of `Animeshkashyap.github.io`, the site is served at
`https://animeshkashyap.github.io/portfolio/` (note the extra path segment).
In that case:

1. Open `vite.config.ts` and change `base: '/'` to `base: '/portfolio/'`
   (replace `portfolio` with your actual repo name)
2. Commit that change before pushing
3. Everything else in this guide is identical

Getting this wrong (base path not matching the repo name) is the #1 cause
of a GitHub Pages site loading a blank white page with 404s in the console
for the JS/CSS files — if you ever see that, check this setting first.
