# GMVGANG Economics Calculator

Internal browser UI for the tested `@gmvgang/economics` Revenue Core.

## What it calculates

- net revenue after VAT
- affiliate / creator commission cost
- contribution before and after paid media
- contribution margin after marketing
- break-even ROAS
- target ROAS
- maximum marketing cost per order
- maximum marketing cost while preserving the selected target contribution margin

## Local development

From the repository root:

```bash
pnpm install
pnpm --filter @gmvgang/economics-calculator dev
```

Production build:

```bash
pnpm --filter @gmvgang/economics-calculator build
```

## Data handling

The calculator is stateless. It has no backend, persistence, analytics integration or external API dependency. Do not hardcode or commit real customer data into the public repository.
