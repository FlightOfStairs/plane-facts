# plane-facts

Plane facts website.

This NPM workspace consists of two packages: `website` produces a static React application (Vite + MUI); `infrastructure` defines a CDK stack for AWS hosting (S3 + CloudFront + Route53). CDK deployment also uploads the built static site.

## Development

```sh
npm install
npm run dev -w packages/website
```

Checks:

```sh
npm run lint
npm run typecheck
npm test
```

## Deployment

```sh
# Assuming `aws configure sso` has been run
aws sso login --sso-session flightofstairs

npm run build -w packages/website
AWS_PROFILE=flightofstairs-planefacts npm run deploy -w packages/infrastructure
```

Live at [planefacts.flightofstairs.org](https://planefacts.flightofstairs.org).

## Toolchain notes

Everything runs on the TypeScript 7 native compiler: `tsc` for type-checking,
[oxlint](https://oxc.rs) (with type-aware rules via `oxlint-tsgolint`, which
embeds typescript-go) for linting, and `tsx` to execute the CDK app. Prettier
handles formatting. ESLint/typescript-eslint are not used as they cannot run on
TS 7 until its stable API lands in 7.1.
