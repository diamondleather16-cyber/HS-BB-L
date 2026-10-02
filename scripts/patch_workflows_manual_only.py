from pathlib import Path
import re

wf_dir = Path(".github/workflows")
if not wf_dir.exists():
    raise SystemExit(".github/workflows not found")

changed = []
for path in sorted(list(wf_dir.glob("build_2025_*.yml")) + list(wf_dir.glob("build_2025_*.yaml"))):
    text = path.read_text(encoding="utf-8")

    # One-time data builders should not all run on every push.
    # Keep manual execution only.
    new = re.sub(
        r"(?ms)^on:\s*\n(?:[ \t]+push:\s*\n(?:[ \t]+.*\n)*?)?[ \t]+workflow_dispatch:\s*(?:\{\})?\s*\n",
        "on:\n  workflow_dispatch:\n",
        text,
        count=1,
    )

    # Handle compact push + workflow_dispatch block if formatting differs.
    if new == text:
        new = re.sub(
            r"(?ms)^on:\s*\n[ \t]+push:\s*\n[ \t]+branches:\s*\[main\]\s*\n[ \t]+workflow_dispatch:\s*\n",
            "on:\n  workflow_dispatch:\n",
            text,
            count=1,
        )

    # Make commit step robust if workflow is manually re-run after another commit.
    new = new.replace(
        "            git push\n",
        "            git pull --rebase origin main\n            git push\n"
    )

    if new != text:
        path.write_text(new, encoding="utf-8")
        changed.append(str(path))

print("Patched workflows:")
for p in changed:
    print(" -", p)
print(f"Total: {len(changed)}")
