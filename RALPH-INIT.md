# Ralph Wiggum — Project Initialization Prompt

You are generating the project-specific files for an autonomous development system called Ralph Wiggum. The user has described their project below. Based on that description, generate **4 files** in the current directory.

---

## File 1: `PRD.md`

Write a Product Requirements Document. Structure it as:

```
# PRD: <Project Name>

## Overview
<1-2 paragraph summary: what it is, what problem it solves, who it's for>

## Architecture
<High-level design, data flow diagram (ASCII), component relationships>

## Key Design Decisions
<Bullet list: language, dependencies, storage, protocols, key trade-offs>

## <Feature sections as needed>
<Detail each major feature area with enough spec that an autonomous agent can implement it without ambiguity>

## File Layout
<Expected file/directory structure when complete>

## Edge Cases
<Bullet list of edge cases and how to handle them>
```

Guidelines:
- Be specific enough that an agent can implement without asking questions
- Include concrete types, interfaces, and API shapes where relevant
- Specify exact dependencies and versions if known
- If the project description is vague, make reasonable decisions and document them
- Keep it under 200 lines — concise but complete

---

## File 2: `tasks.json`

Create a JSON array of task objects. Each task:

```json
{
  "id": 1,
  "category": "foundation",
  "description": "Short description of what to build",
  "steps": [
    "Specific implementation step",
    "Verify: <exact command to verify this works>"
  ],
  "passes": false
}
```

Guidelines:

**Categories** (use this progression):
1. `foundation` — project setup, core data structures, utilities (tasks 1-5ish)
2. `core` — main functionality, wiring components together (tasks 6-10ish)
3. `feature` — user-facing features built on the core (tasks 10-14ish)
4. `reliability` — error handling, cleanup, edge cases (task 14-15ish)
5. `testing` — integration tests, test scripts (task 15-16ish)
6. `verification` — final build/test/vet pass (last task)

**Task design rules:**
- Each task should be completable in one iteration (~5-15 minutes of agent work)
- Tasks must be ordered so each only depends on previous tasks
- Every task needs at least one `"Verify: <command>"` step with a concrete command
- The last task should always be a final verification task
- All tasks start with `"passes": false`
- Aim for 12-20 tasks total. More granular is better than too coarse.
- Each step should be specific and actionable — not "implement the feature" but "create foo.go with FooStruct containing fields X, Y, Z"

**Verification steps format:**
- `"Verify: go build ./..."` — must compile
- `"Verify: go test -run TestFoo -v -count=1"` — specific tests pass
- `"Verify: python3 -c \"import mymodule; print('ok')\""` — import works
- `"Verify: bash test_script.sh"` — integration test passes
- Always include the exact command, not "verify it works"

---

## File 3: `PROMPT.md`

This is the iteration prompt that gets fed to Claude each loop. It has two sections: a generic workflow (copy verbatim) and project-specific conventions (you generate).

**Copy this workflow section exactly:**

````markdown
# <Project Name> — Iteration Prompt

You are an autonomous coding agent building <one-line project description>. Each iteration you pick ONE task, implement it, and commit.

## Workflow

1. **Read `tasks.json`** — this is your source of truth. Find the lowest-id task where `"passes": false`.
2. **Read `progress.md`** for context on what happened in previous iterations.
3. **Read `PRD.md`** for detailed design context and specifications.
4. **Implement the task** following the conventions below.
5. **Run the verification steps** listed in the task's `"steps"` array.
6. **Run tests** if test files exist: `<test command for this project>`.
7. **Update `tasks.json`** — set `"passes": true` for the completed task. **ONLY change the `passes` field. Never edit, remove, or reorder tasks.**
8. **Update `progress.md`** with a log entry for this iteration.
9. **Commit** with descriptive message using `feat:` or `fix:` prefix.
10. **STOP.** You are done. Do not continue to the next task. Exit immediately after committing. The loop script will start a new process for the next task.

## Rules for tasks.json

- **NEVER** remove or edit task descriptions, steps, categories, or ids.
- **ONLY** change `"passes": false` to `"passes": true` after verifying all steps pass.
- If a task cannot be completed, leave `"passes": false` and log the blocker in `progress.md`.
- JSON format is intentional — treat it as immutable test definitions, not a scratchpad.
````

**Then generate a "Critical Conventions" section** tailored to the project:

```markdown
## Critical Conventions

### <Language> Patterns
<Language-specific coding standards: naming, error handling, imports, style>

### File Layout
<Expected file structure with one-line descriptions>

### <Other relevant sections>
<Interfaces, protocols, build commands, key dependencies — whatever the agent needs>

### Build
<Exact build/test/lint commands>

### Dependencies
<List with versions>
```

**Then copy this ending section exactly:**

````markdown
## CRITICAL: One Task Per Invocation

**You MUST stop after completing exactly ONE task.** This is the most important rule.

After you commit, your job is done. Do NOT read the next task. Do NOT continue working. The loop script (`ralph.sh`) will invoke you again in a fresh process with fresh context for the next task. This is by design — it keeps context windows clean and allows progress monitoring between tasks.

**If you complete a task and keep going to the next one, you are violating the core contract of this system.**

## Completion Signal

When ALL tasks have `"passes": true` in tasks.json and final verification is done, write this exact line to progress.md:

```
ALL_TASKS_COMPLETE
```

This signals the loop script to stop.

## Important Notes

- **ONE task, then STOP.** Complete one task, commit, and exit. Do not proceed to the next task.
- **Commit after each task.** Use `git add <specific files>` then `git commit -m "feat: ..."`.
- **If a task fails**, note the issue in progress.md and move on to the next task if possible. Come back to fix it later.
- **Read existing code** before writing. Check what files already exist.
- **Don't modify unrelated code.** Stay focused on the current task.
- **Test after every change.** Run your test/lint commands frequently.
````

---

## File 4: `progress.md`

Create the empty progress file:

```markdown
# Progress

## Iteration Log
```

---

## Important

- Write all 4 files to the current directory
- Do NOT modify any other files (ralph.sh, ralph-status.sh, .claude/, etc.)
- Use your best judgment to fill in gaps in the project description
- Make the PRD and tasks concrete enough that an autonomous agent can build the entire project without human intervention

---

## Project Description

Document e-signing software: esign.

We have an existing repo here that you can analyze:

/mnt/c/Users/Jeff/Desktop/esign

This is software for signign PDFs. The issue is that there is no free software (that I know of) that is easy to use and allows you to attach your signature to a PDF. It needs the ability to generate signatures of various fonts and place them in the PDF, the ability to add regular text to the PDF (for entering dates, and printing fields). I want this project to be cross-platform, so making it web-based like the current iteration is probably a good idea. I really want this tool to be easy to download / install so anything we can do to improve that would be good. I like the portability of Go but not sure it's right for this project, it might be best to stick with javascript.

Although I want it to be javascript, I still want it to be a desktop application. I do not want it to be a website that I have to host. I would prefer if it produced an easy binary or installer to use like with electron or something similar.

