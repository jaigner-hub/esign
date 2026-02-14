#!/usr/bin/env bash
#
# ralph-init.sh - Generate project-specific files for Ralph Wiggum
#
# Uses Claude to generate PRD.md, tasks.json, PROMPT.md, and progress.md
# based on a project description.
#
# Usage:
#   ./ralph-init.sh                  # Reads project description from RALPH-INIT.md
#   ./ralph-init.sh description.txt  # Reads project description from a file
#   ./ralph-init.sh --help           # Show usage

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[ralph-init]${NC} $1"; }
warn() { echo -e "${YELLOW}[ralph-init]${NC} $1"; }
error() { echo -e "${RED}[ralph-init]${NC} $1"; }
success() { echo -e "${GREEN}[ralph-init]${NC} $1"; }

INIT_TEMPLATE="RALPH-INIT.md"
TARGET_FILES=("PRD.md" "tasks.json" "PROMPT.md" "progress.md")

usage() {
    echo "Usage: ./ralph-init.sh [options] [description_file]"
    echo ""
    echo "Generate project-specific files for the Ralph Wiggum autonomous dev loop."
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo ""
    echo "Arguments:"
    echo "  description_file   Optional file containing your project description."
    echo "                     If omitted, reads from the '## Project Description'"
    echo "                     section of RALPH-INIT.md (edit it first)."
    echo ""
    echo "Generated files:"
    echo "  PRD.md        Product requirements document"
    echo "  tasks.json    Task definitions for the autonomous loop"
    echo "  PROMPT.md     Iteration prompt with workflow + conventions"
    echo "  progress.md   Empty progress log"
    echo ""
    echo "After running:"
    echo "  git init && git add -A && git commit -m 'Initial commit'"
    echo "  ./ralph.sh"
}

# Handle --help
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
fi

# Check that claude CLI is available
if ! command -v claude &>/dev/null; then
    error "claude CLI not found. Install it first:"
    echo "  https://docs.anthropic.com/en/docs/claude-code"
    exit 1
fi

# Check that RALPH-INIT.md exists
if [[ ! -f "$INIT_TEMPLATE" ]]; then
    error "Missing $INIT_TEMPLATE — are you in the ralph-setup directory?"
    exit 1
fi

# Check for existing target files (guard against overwriting)
EXISTING=()
for f in "${TARGET_FILES[@]}"; do
    if [[ -f "$f" ]]; then
        # Check if file has real content (not just a placeholder)
        line_count=$(wc -l < "$f")
        if [[ $line_count -gt 5 ]]; then
            EXISTING+=("$f")
        fi
    fi
done

if [[ ${#EXISTING[@]} -gt 0 ]]; then
    warn "These files already have content and would be overwritten:"
    for f in "${EXISTING[@]}"; do
        echo "  - $f"
    done
    echo ""
    read -rp "Continue and overwrite? [y/N] " confirm
    if [[ "${confirm,,}" != "y" ]]; then
        log "Aborted."
        exit 0
    fi
fi

# Build the prompt
TEMPLATE=$(cat "$INIT_TEMPLATE")

if [[ -n "${1:-}" ]]; then
    # Read project description from provided file
    DESC_FILE="$1"
    if [[ ! -f "$DESC_FILE" ]]; then
        error "File not found: $DESC_FILE"
        exit 1
    fi
    DESCRIPTION=$(cat "$DESC_FILE")
    # Replace the Project Description section in the template
    # Everything after "## Project Description" gets replaced
    PROMPT=$(echo "$TEMPLATE" | sed '/^## Project Description$/,$d')
    PROMPT="${PROMPT}
## Project Description

${DESCRIPTION}"
else
    # Use RALPH-INIT.md as-is (user should have filled in the Project Description section)
    PROMPT="$TEMPLATE"

    # Warn if the Project Description section still has placeholder text
    if grep -q "Replace this section with your project idea" "$INIT_TEMPLATE"; then
        warn "The Project Description section in $INIT_TEMPLATE still has placeholder text."
        warn "Edit $INIT_TEMPLATE first, or pass a description file: ./ralph-init.sh myproject.txt"
        echo ""
        read -rp "Continue anyway? [y/N] " confirm
        if [[ "${confirm,,}" != "y" ]]; then
            log "Aborted. Edit the Project Description section in $INIT_TEMPLATE and try again."
            exit 0
        fi
    fi
fi

log "Generating project files with Claude..."
log "Claude will create: ${TARGET_FILES[*]}"
echo ""

# Run claude (interactive mode so user can review/approve file writes)
claude -p "$PROMPT"

# Restore terminal in case claude left it in a weird state
stty sane 2>/dev/null || true

echo ""

# Validate that expected files were created
MISSING=()
for f in "${TARGET_FILES[@]}"; do
    if [[ ! -f "$f" ]]; then
        MISSING+=("$f")
    fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    warn "Some files were not created:"
    for f in "${MISSING[@]}"; do
        echo "  - $f"
    done
    warn "You may need to run ralph-init.sh again or create them manually."
    exit 1
fi

success "All project files generated!"
echo ""
log "Next steps:"
echo "  1. Review the generated files (PRD.md, tasks.json, PROMPT.md)"
echo "  2. Initialize git: git init && git add -A && git commit -m 'Initial commit'"
echo "  3. Start the autonomous loop: ./ralph.sh"
