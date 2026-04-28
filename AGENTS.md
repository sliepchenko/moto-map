# Agent Workflow Instructions

## Mandatory Protocol for Every Task

Before starting any task, read these files in order:

1. `README.md` — project entry point for humans
2. `KNOWLEDGE.md` — AI knowledge storage, technical decisions, known issues, anything else what can be usefull for AI Agents during their duties
3. `ROADMAP.md` — current roadmap and feature status

After completing the task, update the following files:

### README.md
Update to reflect the current state of the project. This is the human entry point — keep it accurate, clear, and up to date regarding:
- What the project is
- How it works
- Current status

### KNOWLEDGE.md
This is the AI's own knowledge storage (also readable by humans). Keep it up to date with:
- Main knowledge about the project
- Technical decisions and their rationale
- Main concepts and architecture
- Known problems and limitations
- Anything useful for software developers
- All information must be well-structured

### ROADMAP.md
Only mark items as done if they were completed in the current task. Do **not** add new items or reorganize unless explicitly asked.

### src/version.js — MANDATORY after every task
After every task that touches application code or data, update `APP_VERSION_DATE` in `src/version.js` to today's date in `YYYY-MM-DD` format:

```js
export const APP_VERSION_DATE = 'YYYY-MM-DD';   // ← set to today
```

This value is displayed in the Settings panel as the "last updated" label visible to the user.
Do **not** skip this step — it is always required.

## Boundaries

The agent must **never** access, read, write, or execute anything outside of the repository root (`/Users/Mykola_Sliepchenko/WebstormProjects/hordes.io`). All file operations, searches, and commands must remain strictly within the repo.

## Commit and Push Strategy

When the user sends the command `push`, execute the following steps in order:

1. `git add .` — stage all changed and untracked files
2. `git commit -m "<message>"` — commit with a single-line message that is a short description of the feature or change implemented (no bullet points, no multi-line body)
3. `git push` — push to the remote repository

### Commit message rules
- One line only
- Must start with `[ADD]` for new features/additions or `[FIX]` for bug fixes (e.g. `[ADD] user auth`, `[FIX] booking overlap bug`)
- A commit may combine both prefixes if it both adds and fixes (e.g. `[ADD][FIX] refactor booking with bug fix`)
- Written in imperative mood after the prefix
- Describes **what was implemented or changed**, not the mechanical steps taken
- Keep it under 72 characters

