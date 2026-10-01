# Neural Networks Company website

## Business Hub / CRM (phase one)

The new `portal/` and `platform/` directories implement a bilingual customer portal and role-protected CRM, projects and tasks. See [BUSINESS_PLATFORM.md](BUSINESS_PLATFORM.md) for scope, permissions, deployment steps, tested behavior, limitations and the Meta Inbox roadmap.

GitHub Pages previews the public website and portal sign-in screen only. A Cloudflare Worker + separate D1 database, owner account and Turnstile configuration are required for real account creation and lead delivery. The website form reports success only after the server confirms storage; while the API is unavailable it explicitly offers local brief download instead. No default administrator credentials are committed.


Source code for the bilingual website. This archive contains the tracked source at commit fb51b4b86b3fa8d087028fb41c5ae91f40f77091. It excludes dependencies, build output, environment files, credentials, and the deployment-specific Sites project identifier.

## Stack

React 19, TypeScript, Vinext (Next.js-compatible), Tailwind CSS, Drizzle ORM, Cloudflare D1. The lead form and CMS API use a D1 binding named `DB`. This is the implementation that was built and deployed; it is not a PostgreSQL/Prisma project.

## Development

Requirements: Node.js >=22.13.0 and pnpm 11.25.0. In a local environment, install with `pnpm install`, then run `pnpm dev`. Run `pnpm build` to compile the application.

For a hosted deployment, configure a Cloudflare D1 database binding named `DB` and apply the SQL files in `drizzle/` in numeric order. Set `ADMIN_PASSWORD` as a server-side secret. Do not commit the real secret or put it in frontend variables. The admin interface is at `/admin` and contacts are stored in D1. Configure actual phone, WhatsApp, email and social URLs from the admin interface. Avoid publishing until privacy and terms text are legally reviewed.

## GitHub Pages

The repository root contains `index.html`, a standalone bilingual static presentation served from `https://omaralabaseery.github.io/neuralnetworkco/` when Pages is configured to publish from `main` / `(root)`. It uses the existing logo at `public/assets/neural-logo.png` and has no build step. Edit `index.html` to update the GitHub Pages version.

GitHub Pages cannot run this project's server routes, database, CMS, or lead form. The static presentation intentionally does not display a contact form or invented contact details. To launch the complete application, deploy the Vinext server with its Cloudflare D1 binding and configure verified contact information. The static `index.html` is separate from the React/Vinext source under `app/` and `components/`.

## Repository upload

Unzip this archive at the root of your new repository, preserving directory structure. Commit the source files and lockfile. Do not commit `.env`, `node_modules`, `dist`, or any deployment credentials.

This source currently references the private preview URL in `app/[...slug]/page.tsx`, `app/sitemap.ts`, `app/robots.ts`, and `app/layout.tsx`. Replace it with your production domain before launch. The server-backed application is separate from the GitHub Pages static presentation.

The original site-specific deployment manifest was intentionally omitted. The included starter scripts contain Sites-specific helpers, so a different hosting provider may require adapting build and deployment configuration. The CMS supports projects, insights, and basic content/settings management; not every page section is editable in the admin panel yet.

