# Ralph Wiggum

An autonomous development system that uses Claude to build entire projects from a PRD and task list — one task per iteration, with verification at every step.

## How it works

Ralph Wiggum runs Claude in a loop. Each iteration, Claude:

1. Reads the task list (`tasks.json`) and picks the next incomplete task
2. Reads the PRD and progress log for context
3. Implements the task
4. Runs the verification steps defined in the task
5. Marks the task as passing and commits
6. Repeats until all tasks are done

The key insight: tasks are defined up front as immutable test definitions with concrete verification steps. Claude can only flip `"passes": false` to `"passes": true` — it can't edit, remove, or reorder tasks. This keeps the agent focused and prevents scope drift.

## Quick start

### New project (clone this repo)

```bash
git clone https://github.com/your-username/ralph-setup.git my-project
cd my-project

# Option A: Write your project description directly in RALPH-INIT.md
#   Edit the "Project Description" section at the bottom, then:
./ralph-init.sh

# Option B: Pass a separate description file
./ralph-init.sh my-project-description.txt

# Review the generated files, then start the loop
git init && git add -A && git commit -m "Initial commit"
./ralph.sh
```

### Existing project (copy files in)

```bash
# Copy the ralph files into your project
cp path/to/ralph-setup/{ralph.sh,ralph-status.sh,ralph-init.sh,RALPH-INIT.md} .
cp -r path/to/ralph-setup/.claude .

# Generate project-specific files
./ralph-init.sh

# Start the loop
./ralph.sh
```

## File structure

| File | Purpose |
|------|---------|
| `ralph.sh` | Autonomous loop orchestrator — runs Claude in a loop |
| `ralph-status.sh` | Monitor a running loop (progress, logs, task status) |
| `ralph-init.sh` | Generate project-specific files from a description |
| `RALPH-INIT.md` | Template prompt for project initialization |
| `PROMPT.md` | Iteration prompt fed to Claude each loop *(generated)* |
| `PRD.md` | Product requirements document *(generated)* |
| `tasks.json` | Task definitions with verification steps *(generated)* |
| `progress.md` | Iteration log maintained by Claude *(generated)* |
| `.claude/settings.local.json` | Safety permissions for autonomous mode |
| `.claude/hooks/validate-autonomous.py` | Defense-in-depth safety hook |

## ralph.sh

The main loop script. Runs `claude --print --dangerously-skip-permissions` in a loop, feeding `PROMPT.md` each iteration.

```bash
./ralph.sh          # Run with default 20 iterations max
./ralph.sh 50       # Run with 50 iterations max
```

Stops when:
- All tasks in `tasks.json` have `"passes": true`
- `ALL_TASKS_COMPLETE` appears in `progress.md`
- Max iterations reached

Each iteration is logged to `logs/ralph/iteration_N_TIMESTAMP.log`.

## ralph-status.sh

Monitor a running loop in a separate terminal:

```bash
./ralph-status.sh           # One-time status check
./ralph-status.sh --watch   # Live refresh every 5 seconds
./ralph-status.sh --tail    # Follow the latest iteration log
```

Shows: task progress bar, pass/fail per task, latest log output, run status.

## ralph-init.sh

Generates the 4 project-specific files by sending `RALPH-INIT.md` (with your project description) to Claude:

```bash
./ralph-init.sh                    # Read description from RALPH-INIT.md
./ralph-init.sh description.txt   # Read description from a file
./ralph-init.sh --help             # Show usage
```

## Safety guardrails

Ralph runs Claude with `--dangerously-skip-permissions` for unattended operation. Two layers of safety prevent destructive actions:

**1. `.claude/settings.local.json`** — Deny rules block obvious destructive commands:
- `git push`, `git reset --hard`
- `sudo`, `ssh`, `scp`
- `rm -rf`, `rm -r`
- `./deploy*`

**2. `.claude/hooks/validate-autonomous.py`** — A PreToolUse hook that catches edge cases the deny rules miss:
- Reordered flags (`git --force push`)
- Piped commands
- Destructive SQL via `docker exec`
- Network access (`curl`, `wget`)
- File deletion (`rm`, `rmdir`, `unlink`)
- Privilege escalation (`sudo`, `su`, `doas`)

The hook fails open (never blocks on its own errors) but blocks any command matching a destructive pattern.

## Task format

Tasks in `tasks.json` follow this structure:

```json
{
  "id": 1,
  "category": "foundation",
  "description": "What to build",
  "steps": [
    "Specific implementation step",
    "Verify: exact command to check it works"
  ],
  "passes": false
}
```

Categories progress from `foundation` -> `core` -> `feature` -> `reliability` -> `testing` -> `verification`.

## License

MIT
