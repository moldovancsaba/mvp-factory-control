# Command Access Policy

This document defines how local command access is governed for agents operating through `mvp-factory-control`.

## Purpose

Agents may need local command access to inspect repositories, run builds, validate work, or operate the internal control app.

Command access must be tracked in a durable, auditable format based on the core executable that needs access.

## Environment Rule

Agents use the active local environment configured for the current chat or execution session.

That includes:

- the current working directory
- available repositories under `/Users/moldovancsaba/Projects`
- local shells, binaries, and credentials already configured in the operator environment

This includes the operator's authenticated GitHub access when available.

Agents should use that access for:

- repository inspection
- remote sync
- commit creation
- push to GitHub

Those actions are permitted for delivery work, but they remain subject to the command registry and the documented engineering rules.

## Policy Model

Every command family is represented by its core executable.

Examples:

- `gh`
- `git`
- `cd`
- `mkdir`
- `npm`
- `node`
- `docker`

Arguments and flags do not create a new command family. The governing key is the executable itself.

## Required States

Each command family should be tracked with one of these states:

- `approved`
- `declined`
- `pending`

## Maintenance Rule

When an agent needs a command family that is not yet represented, add it to the command registry before or at the same time the command family is introduced into the workflow.

Do not leave a newly used command family undocumented.

When an agent uses GitHub or repository mutation commands as part of delivery, the corresponding command families must already be approved or must be added to the registry as part of the same update.

## Suggested Registry Format

Maintain the active registry as a table in shared docs or in the internal control app settings UI with:

- core command
- state
- scope or notes
- last reviewed date

## Initial Command Registry

| Core command | State | Scope |
| --- | --- | --- |
| `gh` | approved | GitHub issues, boards, repository metadata |
| `git` | approved | repository state, diff, branch, commit, push |
| `cd` | approved | repository and workspace navigation |
| `mkdir` | approved | local directory creation for work output |
| `ls` | approved | local inspection |
| `find` | approved | local file discovery |
| `grep` | approved | local text search |
| `sed` | approved | local text inspection |
| `node` | approved | scripts and validation tools |
| `npm` | approved | install, build, run, test for Node-based repositories |
| `docker` | pending | container workflow requires explicit review per environment |

## Internal App Expectation

The internal control app should expose this registry as a switchable list so operators can see which command families are approved or declined and add new families when required.
