# Git rules

- NEVER run `git commit` or `git push` until Adi has reviewed the changes and explicitly approved them. Adi reviews everything first.
- When work is ready, stop and summarize the changes (e.g. `git status` / `git diff`) for review instead of committing.

# Architecture decisions

- Never make architecture decisions on your own (libraries, folder structure, patterns, service boundaries, state management, DB/schema design, APIs, LLM provider, etc.). Propose options with a recommendation and discuss them with Adi first; implement only after Adi agrees.

# Design system & design tokens

- No hardcoded values: all UI styling must use design tokens defined via the Tailwind CSS and shadcn/ui configuration (semantic colors like `bg-primary`, the spacing scale, typography tokens). No raw hex/rgb colors, arbitrary pixel values, or inline style values.
- Single source of truth: every shared component in `libs/ui-components` must consume these tokens so the theme can be adjusted in one place.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
