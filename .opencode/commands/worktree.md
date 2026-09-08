---
description: Crea worktree en .worktrees/<nombre>
---

Ejecuta EXACTAMENTE y nada más. No cambies de directorio:

!`NAME="$ARGUMENTS"; if [ -z "$NAME" ]; then echo "ERROR: falta nombre"; exit 1; fi; SLUG=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -s '-' | sed 's/[^a-z0-9._-]//g'); git worktree add ".worktrees/$SLUG"`
