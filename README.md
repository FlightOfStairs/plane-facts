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
AWS_PROFILE=flightofstairs-plane-facts npm run deploy -w packages/infrastructure
```

### One-time setup

1. Create the member account and SSO profile in the
   [flightofstairs-infrastructure](https://github.com/FlightOfStairs/flightofstairs-infrastructure)
   repo, and bootstrap CDK in it (`npx cdk bootstrap`).
2. After the first deploy, take the `NameServers` stack output and add an NS
   delegation record for `planefacts.flightofstairs.org` to the parent zone in
   [flightofstairs.org](https://github.com/FlightOfStairs/flightofstairs.org).
   Certificate validation (and therefore the first deploy) will not complete
   until the delegation exists.

## Toolchain notes

Everything runs on the TypeScript 7 native compiler: `tsc` for type-checking,
[oxlint](https://oxc.rs) (with type-aware rules via `oxlint-tsgolint`, which
embeds typescript-go) for linting, and `tsx` to execute the CDK app. Prettier
handles formatting. ESLint/typescript-eslint are not used as they cannot run on
TS 7 until its stable API lands in 7.1.
