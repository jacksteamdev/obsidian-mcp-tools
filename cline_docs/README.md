# cline_docs — task summary records

This directory holds the **task summary records** referenced in `.clinerules` (see the _"Task Summary Records"_ section). It is the canonical place to leave a short markdown file per task, so that any agent (Cline, Claude Code, a human maintainer) can understand what has been attempted, what worked, and what didn't, without re-reading the full git history.

The directory is created so the `.clinerules` reference is no longer dangling. Using it is **optional** — the project does not enforce the Cline task-record workflow, and most recent work in the fork has been tracked via `git log` + `CLAUDE.md` snapshots instead. But if you do want to follow the prescribed workflow, this is where your files go.

## When to create a task record

Follow the lifecycle documented in `.clinerules`:

1. **Starting a task**
   - Create a new markdown file in this directory, named after the task (e.g. `2026-04-11-install-location.md`, `fix-patch-vault-file-headings.md`).
   - Record the initial objective in 1-3 sentences.
   - List the subtasks as a checklist.

2. **During the task**
   - Update the checklist as subtasks complete.
   - Record what worked and what didn't — especially failed approaches, so the next agent doesn't reproduce them.

3. **Completing the task**
   - Summarize the outcome at the top of the file (or in a final section).
   - Verify the initial objective was met.
   - Leave the file in place — it's history, not scratch.

## What does NOT go here

- **Design documents** — those live in `docs/design/` (e.g. `docs/design/issue-29-command-execution.md`). Design docs are long-lived architectural references and are treated as specs; task records are short-term working notes.
- **Feature specs** — those live in `docs/features/`.
- **Ephemeral scratch files** — use `cline_docs/temp/` for anything that should not be committed. That subdirectory is already listed in `.gitignore`.

## Current state

The directory contains only this README. No active task records are tracked here right now. If the fork starts getting picked up by multiple contributors, or if Claude Code sessions become long-running enough to benefit from across-session memory, that's the moment to start populating this directory.

## Relationship to CLAUDE.md

`CLAUDE.md` (at the repo root) is a different animal: it is a **snapshot** of the project as a whole, meant to be re-read at the start of every session. It contains architecture, gotchas, the issue/PR map, and the roadmap status. `cline_docs/` files are per-task and much more short-lived.

Do not duplicate content between the two. If something is worth carrying across sessions, it belongs in `CLAUDE.md`. If it's only relevant while one task is in flight, it belongs here.
