# Animesh Kashyap — Portfolio

A frontend-only portfolio site: React + TypeScript + Vite, with a hand-rolled
Three.js "constellation" background (no react-three-fiber — it's plain
`three.js` wrapped in one class so it's easy to read end-to-end) and a
light/dark theme toggle. No backend, no build step required to view it
beyond a static file server — it's designed to be hosted on GitHub Pages.

👉 **First time setting this up?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for
the exact commands to get this live on GitHub Pages.

## Stack

- **React 19 + TypeScript** — components, one concern per file
- **Vite** — dev server + production build
- **Three.js** (vanilla, no R3F) — the animated background, in `src/three/ParticleNetwork.ts`
- **CSS Modules** — scoped styles per component, no CSS framework
- Zero backend: the contact "form" builds a `mailto:` link and hands off to the visitor's email client

## Project structure

```
src/
  data/            Plain-data files — edit these to change page content.
                    No JSX/HTML in here, just arrays and objects.
    profile.ts       Name, title, summary, contact links, hero stats
    skills.ts        Skill groups shown in the Skills section
    experience.ts     Work history timeline
    projects.ts       Personal projects grid
    education.ts      Education, awards, languages

  three/
    ParticleNetwork.ts  The Three.js scene: particles, connecting lines,
                         pointer parallax, scroll-driven motion blur /
                         chromatic aberration post-processing pass.
                         Framework-agnostic — works outside React too.

  theme/
    ThemeProvider.tsx  Light/dark theme state, persisted to localStorage,
                        defaults to the OS preference on first visit.

  components/        One folder per component: Component.tsx + Component.module.css
    NavBar/             Sticky header, section links, mobile menu
    ThemeToggle/        The light/dark switch in the header
    NetworkBackground/  Mounts the Three.js canvas + readability scrim, fixed behind everything
    Hero/               Landing section
    About/              Summary + quick contact card
    Skills/             Skill chips grouped by category
    Experience/         Work history timeline
    Projects/           Personal projects grid
    Education/          Education / awards / languages
    Contact/            mailto:-based contact form
    Footer/
    Reveal/             Generic "fade in on scroll" wrapper used by every section
    SectionHeading/     Shared eyebrow + title + description header

  hooks/
    useActiveSection.ts  Powers the nav's active-link highlighting
```

## Editing content

Almost everything you'd want to change day-to-day lives in `src/data/*.ts` —
plain TypeScript objects/arrays, no component code to touch. For example, to
add a new job, open `src/data/experience.ts` and add an entry to the array;
the Experience timeline re-renders automatically.

To change colors/fonts/spacing, edit the CSS variables at the top of
`src/styles/global.css` (`--bg`, `--accent-cyan`, `--font-display`, etc.) —
every component reads from those variables, including the light theme
override block right below `:root`.

Your résumé PDF lives at `public/resume.pdf` — replace that file to update
the "Download résumé" link (the filename must stay the same, or update
`resumeFile` in `src/data/profile.ts`).

## Local development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Hot reload is on — edit any file and the
browser updates instantly.

## Building for production

```bash
npm run build
```

Type-checks the project and outputs static files to `dist/`. Preview that
build locally with:

```bash
npm run preview
```

## Deploying

This repo is wired up to deploy automatically to GitHub Pages on every push
to `main` via `.github/workflows/deploy.yml`. See
[DEPLOYMENT.md](./DEPLOYMENT.md) for the one-time setup steps.
