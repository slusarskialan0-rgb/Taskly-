# Contributing to TASKLY PRO

Thank you for taking the time to contribute! Please follow the guidelines below to keep the project history clean and consistent.

## Commit Message Format

This project follows the **[Conventional Commits](https://www.conventionalcommits.org/)** specification.

### Structure

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | When to use |
|------------|-------------|
| `feat`     | A new feature |
| `fix`      | A bug fix |
| `docs`     | Documentation changes only |
| `style`    | Formatting, whitespace – no logic change |
| `refactor` | Code restructuring without feature/fix |
| `test`     | Adding or correcting tests |
| `chore`    | Build process, tooling, or dependency updates |

### Scope (optional)

Scope describes the part of the codebase affected, e.g. `api`, `ui`, `auth`, `dashboard`, `jobs`, `workers`, `clients`.

### Short Description Rules

- Use the **imperative mood** ("add feature", not "added feature" or "adds feature")
- Start with a **lowercase** letter
- Do **not** end with a period
- Keep it under **72 characters**

### Examples

```
feat(jobs): add city filter to jobs list

fix(auth): redirect to login when session is missing

docs: add CONTRIBUTING guide with commit message format

style(ui): fix inconsistent button spacing in modal footer

refactor(api): extract localStorage helpers into separate functions

chore: update .gitignore to exclude OS artifacts
```

### Breaking Changes

Add `BREAKING CHANGE:` in the footer (or append `!` after the type/scope) when a commit introduces an incompatible change:

```
feat(api)!: replace localStorage keys with namespaced versions

BREAKING CHANGE: existing localStorage data must be migrated manually
```

## Pull Requests

- Branch name: `<type>/<short-description>`, e.g. `feat/export-pdf` or `fix/login-redirect`
- PR title should mirror the main commit message
- Keep each PR focused on a single concern
