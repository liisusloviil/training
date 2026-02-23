# Contributing Guide

## Branch Model

- `main`: production-ready branch. Direct push is forbidden.
- `testing`: QA validation branch. Direct push is forbidden.
- `dev`: active development branch for engineers.

## Delivery Flow

1. Development is done in `dev`.
2. When a feature/fix is ready, open a pull request `dev -> testing`.
3. QA validates on `testing`.
4. If QA passes, open a pull request `testing -> main`.
5. After merge to `main`, sync `main -> dev` to keep branches aligned.

## Pull Request Rules

- No direct push to `main` or `testing`.
- Every PR must have green checks:
- `npm test`
- `npm run lint`
- `npm run build`
- Every PR to `testing` and `main` requires at least one approval from QA.

## Hotfix Flow

1. Branch from `main` using `hotfix/<name>`.
2. Open PR `hotfix/<name> -> main`.
3. After merge, sync `main -> testing` and `main -> dev`.

## GitHub Branch Protection (required)

Configure branch protection in GitHub for `main` and `testing`:

- Require a pull request before merging.
- Require approvals (minimum 1).
- Require status checks to pass before merging:
- `quality`
- `e2e-smoke`
- Restrict who can push directly.
- Require branches to be up to date before merging.
