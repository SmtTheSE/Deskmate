# Contributing

Thanks for helping. Deskmate is for people who are not developers, so the bar for any change is: **could a school office manager use this without help?**

## Getting started

```sh
npm install
npm run dev      # API on :3000, web on :5173
npm test
npm run typecheck
```

## Guidelines

- Use plain language in the UI. Avoid technical words in labels, errors, and empty states.
- Keep dependencies small. The server runs TypeScript directly with Node's type stripping, so use only erasable syntax there (no enums, namespaces, or constructor parameter properties) and import with `.ts` extensions.
- Never send personal details to a model. New pipeline steps must work on redacted text.
- Every action a person or the AI takes should be recorded with `svc.audit(...)`.
- Add a test for behavior changes in `packages/core/test` or `apps/server/test`.

## Good first issues

New templates (for example clinics or libraries), translations of the UI, better PDF handling, and more redaction patterns for other countries' ID numbers.
