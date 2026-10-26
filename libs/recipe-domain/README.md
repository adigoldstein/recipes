# recipe-domain

Pure TypeScript recipe rules shared by the feature libs, the app and `ui-components`: scaling, amount formatting and parsing, the countable-unit rule and the library filter.

- Tag `type:domain`: imports no other workspace lib, and lint bans React, TanStack Query and the generated API client. No Node types are loaded, so Node built-ins (`fs`, `http`, ...) fail typecheck.
- Held to 100% coverage: `nx test recipe-domain` always measures coverage and fails below 100%.

Run `npx nx test recipe-domain`.
