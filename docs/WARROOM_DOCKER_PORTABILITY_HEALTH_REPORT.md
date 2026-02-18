# WarRoom Docker Portability Health Report

Last updated: 2026-02-13
Scope: `apps/warroom`
Umbrella issue: [`#116`](https://github.com/moldovancsaba/mvp-factory-control/issues/116)

## 1) Dependency completion evidence

All dependency issues are completed on the board (`Done`) with linked evidence:

| Issue | Status | Evidence |
|---|---|---|
| [`#111`](https://github.com/moldovancsaba/mvp-factory-control/issues/111) Docker preflight contract | Done | [issue evidence comment](https://github.com/moldovancsaba/mvp-factory-control/issues/111#issuecomment-3896652452) |
| [`#112`](https://github.com/moldovancsaba/mvp-factory-control/issues/112) App containerization | Done | [issue evidence comment](https://github.com/moldovancsaba/mvp-factory-control/issues/112#issuecomment-3896699282) |
| [`#113`](https://github.com/moldovancsaba/mvp-factory-control/issues/113) Compose stack + health model | Done | [issue evidence comment](https://github.com/moldovancsaba/mvp-factory-control/issues/113#issuecomment-3896732052) |
| [`#114`](https://github.com/moldovancsaba/mvp-factory-control/issues/114) One-command bootstrap | Done | [issue evidence comment](https://github.com/moldovancsaba/mvp-factory-control/issues/114#issuecomment-3896747291) |
| [`#115`](https://github.com/moldovancsaba/mvp-factory-control/issues/115) Automated portability gate | Done | [issue evidence comment](https://github.com/moldovancsaba/mvp-factory-control/issues/115#issuecomment-3896770462) |

## 2) Portability health rubric (operator decision model)

| Level | Name | Entry condition | Delivery decision |
|---|---|---|---|
| L0 | Not portable | Docker CLI/daemon/compose unavailable or compose parse fails | Block delivery |
| L1 | Partially portable | Image builds but stack startup/health is not deterministic | Block delivery |
| L2 | Locally portable | Bootstrap path succeeds with deterministic `db/app healthy` + `/signin` check | Candidate only; still needs regression gate |
| L3 | Gate-protected portable | Automated portability gate exists and passes deterministic healthy/unhealthy assertions, route checks, and known runtime-regression signature checks | Eligible for delivery (with app build pass) |
| L4 | Continuously verified | Gate is active in CI on PR/push and remains green for current change set | Preferred release posture |

Minimum healthy-enough threshold for WarRoom delivery:
- L3 or higher, and
- `cd apps/warroom && npm run build` passes.

## 3) Current assessed level (2026-02-13)

Assessment:
- current level: **L3 (Gate-protected portable)**.

Basis:
- deterministic preflight and bootstrap flows are implemented and validated.
- automated gate exists as:
  - script: `scripts/warroom-docker-portability-gate.sh`
  - CI workflow: `.github/workflows/warroom-docker-portability-gate.yml`
- gate defaults are aligned with runtime defaults (`WARROOM_DB_PORT=3579`, `WARROOM_APP_PORT=3577`).
- latest local gate run passed:
  - `WARROOM_DB_PORT=55432 WARROOM_APP_PORT=3107 NEXTAUTH_URL=http://localhost:3107 ./scripts/warroom-docker-portability-gate.sh`
- latest app build gate passed:
  - `cd apps/warroom && npm run build`

## 4) Deterministic health signals

Expected healthy signals:
- `warroom-db` container health = `healthy`
- `warroom-app` container health = `healthy`
- app endpoint `GET /signin` returns `200` on mapped host port
- protected routes `GET /products` and `GET /agents` return redirect status (`302/303/307/308`) with `Location` containing `/signin`

Expected unhealthy signal:
- invalid endpoint probe returns non-success (for example `404`), confirming the gate is not silently permissive.

## 5) Regression guard

Regression protection is active via:
- `.github/workflows/warroom-docker-portability-gate.yml`

Known regression signatures blocked by the gate:
- `EACCES: permission denied, mkdir '/app/.warroom'`
- `ps: bad -o argument 'command'`

This workflow runs portability checks on relevant WarRoom/container changes and fails fast with remediation-oriented diagnostics if portability expectations regress.

## 6) Residual risks and remediations

Known residual risks:
- host-specific Docker behavior differences.
- startup timing variance on slower runners.

Operational remediation path:
1. run `./scripts/warroom-docker-preflight.sh`
2. run `./scripts/warroom-docker-bootstrap.sh`
3. inspect `docker compose ps` and container logs
4. rerun `./scripts/warroom-docker-portability-gate.sh`
