# Neural Networks Company website

Source code for the bilingual website. This archive contains the tracked source at commit fb51b4b86b3fa8d087028fb41c5ae91f40f77091. It excludes dependencies, build output, environment files, credentials, and the deployment-specific Sites project identifier.

## Stack

React 19, TypeScript, Vinext (Next.js-compatible), Tailwind CSS, Drizzle ORM, Cloudflare D1. The lead form and CMS API use a D1 binding named `DB`. This is the implementation that was built and deployed; it is not a PostgreSQL/Prisma project.

## Development

Requirements: Node.js >=22.13.0 and pnpm 11.25.0. In a local environment, install with `pnpm install`, then run `pnpm dev`. Run `pnpm build` to compile the application.

For a hosted deployment, configure a Cloudflare D1 database binding named `DB` and apply the SQL files in `drizzle/` in numeric order. Set `ADMIN_PASSWORD` as a server-side secret. Do not commit the real secret or put it in frontend variables. The admin interface is at `/admin` and contacts are stored in D1. Configure actual phone, WhatsApp, email and social URLs from the admin interface. Avoid publishing until privacy and terms text are legally reviewed.

## Repository upload

Unzip this archive at the root of your new repository, preserving directory structure. Commit the source files and lockfile. Do not commit `.env`, `node_modules`, `dist`, or any deployment credentials.

This source currently references the private preview URL in `app/[...slug]/page.tsx`, `app/sitemap.ts`, `app/robots.ts`, and `app/layout.tsx`. Replace it with your production domain before launch. The current site is private; a GitHub upload alone does not deploy it.

The original site-specific deployment manifest was intentionally omitted. The included starter scripts contain Sites-specific helpers, so a different hosting provider may require adapting build and deployment configuration. The CMS supports projects, insights, and basic content/settings management; not every page section is editable in the admin panel yet.
