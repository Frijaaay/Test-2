# Google Apps Script Best Practices

Apply these rules to this workspace when editing or adding Google Apps Script code.

## Project Structure

- Keep the existing module style: global singleton namespaces like `const Name = { ... }` and top-level functions for Apps Script entry points.
- Preserve the current split between routing, services, repositories, and sheet utilities.
- Keep spreadsheet access centralized in `src/Repositories/SheetRepository.js`; do not scatter raw sheet lookups or hardcoded column indexes through feature code.
- Put environment-specific values, URLs, sheet IDs, and secrets behind `src/Config.js` and script properties.

## Server-Side Apps Script

- Treat `src/Routing.js` as the server entry point and keep browser/server boundaries explicit.
- Prefer small, composable service functions over large procedural blocks.
- Use `PropertiesService`, `CacheService`, and `LockService` where they fit the existing design.
- Keep auth, permissions, token checks, and request validation on the server, not in client HTML.
- Be careful with quota-sensitive calls; batch reads and writes where possible.

## HTMLService UI

- Preserve the template composition pattern in `src/Index.html` and the shared partials in the HTML files.
- Keep client logic in the browser layer and use `google.script.run` for server calls.
- Reuse the existing role-based views and request flows instead of collapsing them into a single generic UI.
- Match the current styling system in `src/Stylesheet.html` and the existing UI tokens/classes.

## Data And Security

- Avoid exposing direct Drive or spreadsheet URLs to the client unless the current flow already requires it.
- Do not move sensitive values into HTML files or client-side scripts.
- Prefer least-privilege access patterns and explicit validation for requestor, tester, and approver actions.

## Change Discipline

- Make the smallest change that satisfies the request.
- Keep edits conservative and aligned with the current code conventions.
- If a change affects behavior, update the relevant helper or service at the owning layer rather than patching around it in the UI.