# Contributing

Market Signal Deck is an educational market research application. Contributions must keep the product research-only and must not add trade execution, brokerage connection, deposits, or gambling-like language.

## Local workflow

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and fill only public local values needed for development.
3. Run `npm run dev`.
4. Run `npm run lint`, `npm test`, and `npm run build` before opening a pull request.

## Safety rules

- Do not commit secrets, tokens, webhook URLs, real `.env` files, or provider credentials.
- Do not expose private market provider keys in `VITE_*` variables.
- Use Watch, Wait, Avoid, Worth researching, or Research further labels instead of directive trading language.
- Keep predictions explainable, immutable, and visibly uncertain.
