# Boolean Logic Simplifier & Circuit Visualizer

A client-side React + TypeScript Boolean design tool covering truth tables, minterms/maxterms, expression parsing, Quine–McCluskey minimization, SOP/POS output, and programmatic SVG gate graphs.

## Features
- 2–6 variables (A–F)
- Truth table, minterm/maxterm, or Boolean-expression input
- Don't-care support
- Quine–McCluskey prime implicant generation + minimum-cover selection
- SOP and POS outputs
- Basic AND/OR/NOT, NAND-only, and NOR-only SVG schematics
- Exhaustive verification table
- No backend; all processing stays in the browser

## Local development
```bash
npm install
npm run dev
```

## Tests
```bash
npm test
```

The Boolean engine lives in `src/engine/boolean.ts` and is intentionally UI-independent. Tests cover XOR, majority, full-adder sum/carry, POS, and don't-care minimization.

## Deployment
Build with `npm run build` and deploy the generated `dist/` directory to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.
