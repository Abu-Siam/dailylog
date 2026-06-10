#!/usr/bin/env python3
"""
Daily logger — write markdown in your terminal, save to folder structure, git push.

Setup (once):
    log --add-profile work     --repo ~/work-logs
    log --add-profile personal --repo ~/personal-logs

Usage:
    log                  # log to 'default' profile
    log work             # log to 'work' profile
    log --view           # view today's log
    log work --view
    log --list-profiles
    log --no-push        # save locally, skip git
"""

import os
import sys
import json
import subprocess
import argparse
import tempfile
from datetime import datetime
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

CONFIG_PATH = Path.home() / ".config" / "dailylog" / "profiles.json"

TEMPLATE = """\
# {date}

## Work


## Personal


## Mood
<!-- e.g. 8/10 — focused and productive -->

## Tomorrow

"""

# ── Profile management ────────────────────────────────────────────────────────

def load_profiles() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def save_profiles(profiles: dict):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(profiles, indent=2))


def add_profile(name: str, repo: Path):
    profiles = load_profiles()
    profiles[name] = {"repo": str(repo.expanduser().resolve())}
    save_profiles(profiles)
    print(f"  ✓  Profile '{name}' → {repo.expanduser().resolve()}")


def get_profile(name: str) -> dict:
    profiles = load_profiles()
    if name not in profiles:
        if profiles:
            print(f"\n✗  Profile '{name}' not found. Available: {', '.join(profiles)}")
        else:
            print(f"\n✗  No profiles yet.")
            print(f"   Add one:  log --add-profile {name} --repo ~/path/to/repo")
        sys.exit(1)
    return profiles[name]


def list_profiles():
    profiles = load_profiles()
    if not profiles:
        print("No profiles yet.")
        print("  log --add-profile work     --repo ~/work-logs")
        print("  log --add-profile personal --repo ~/personal-logs")
        return
    print(f"\n  {'Profile':<16} Repo")
    print("  " + "─" * 50)
    for name, cfg in profiles.items():
        repo = cfg["repo"].replace(str(Path.home()), "~")
        print(f"  {name:<16} {repo}")
    print(f"\n  Config: {CONFIG_PATH}")

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_log_path(repo: Path) -> Path:
    now = datetime.now()
    return repo / "dailylog" / f"{now.month:02d}-{now.day:02d}-{now.year}.md"


def get_editor() -> str:
    return os.environ.get("VISUAL") or os.environ.get("EDITOR") or "nano"


def open_in_editor(initial_content: str) -> str:
    """Open a temp file in the user's editor, return edited content."""
    with tempfile.NamedTemporaryFile(
        suffix=".md", mode="w", delete=False, prefix="dailylog_"
    ) as f:
        f.write(initial_content)
        tmp = Path(f.name)

    editor = get_editor()
    print(f"  Opening {editor}... (save and close to continue)\n")
    subprocess.run([editor, str(tmp)])

    content = tmp.read_text().strip()
    tmp.unlink()
    return content


def collect_inline() -> str:
    """Fallback: collect markdown line by line in terminal."""
    date_str = datetime.now().strftime("%A, %B %-d, %Y")
    print(f"\nWrite your log in markdown. End with a line containing only '---'\n")
    print(f"# {date_str}\n")
    lines = [f"# {date_str}", ""]
    try:
        while True:
            line = input()
            if line.strip() == "---":
                break
            lines.append(line)
    except EOFError:
        pass
    return "\n".join(lines).strip()


def save_log(content: str, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        existing = path.read_text().rstrip()
        content = existing + "\n\n---\n\n" + content
        print(f"  Appended → {path}")
    else:
        print(f"  Saved    → {path}")
    path.write_text(content + "\n")


def git_push(repo: Path, log_path: Path, profile_name: str):
    rel = log_path.relative_to(repo)
    date_str = datetime.now().strftime("%Y-%m-%d")

    def run(cmd):
        result = subprocess.run(cmd, cwd=repo, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip())
        return result.stdout.strip()

    try:
        run(["git", "add", str(rel)])
        run(["git", "commit", "-m", f"log({profile_name}): {date_str}"])
        print("  Committed.", end="", flush=True)
        run(["git", "push"])
        print(" Pushed ✓")
    except RuntimeError as e:
        print(f"\n  ✗  Git error: {e}")
        print("     Log saved locally. Push manually when ready.")


def view_today(repo: Path):
    path = get_log_path(repo)
    if path.exists():
        print(path.read_text())
    else:
        print(f"No log yet for today. ({path})")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Write markdown logs, save to folder structure, git push.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  log                                      log with 'default' profile
  log work                                 log with 'work' profile
  log personal --no-push                   save locally, skip git
  log --add-profile work --repo ~/work-logs
  log --list-profiles
  log work --view
        """,
    )
    parser.add_argument("profile", nargs="?", default="default",
                        help="Profile name (default: 'default')")
    parser.add_argument("--add-profile", metavar="NAME",
                        help="Register a new profile")
    parser.add_argument("--repo", type=Path,
                        help="Repo path (used with --add-profile)")
    parser.add_argument("--list-profiles", action="store_true")
    parser.add_argument("--no-push", action="store_true",
                        help="Save locally, skip git commit/push")
    parser.add_argument("--view", action="store_true",
                        help="Print today's log and exit")
    parser.add_argument("--no-editor", action="store_true",
                        help="Type inline in terminal instead of opening editor")
    args = parser.parse_args()

    # ── Management commands ──
    if args.list_profiles:
        list_profiles()
        return

    if args.add_profile:
        if not args.repo:
            print("✗  --repo is required with --add-profile")
            print(f"   Example: log --add-profile {args.add_profile} --repo ~/my-logs")
            sys.exit(1)
        add_profile(args.add_profile, args.repo)
        return

    # ── Logging ──
    profile_name = args.profile
    cfg = get_profile(profile_name)
    repo = Path(cfg["repo"])

    if args.view:
        view_today(repo)
        return

    if not repo.exists():
        print(f"\n✗  Repo not found: {repo}")
        print(f"   Create it:")
        print(f"     mkdir -p {repo} && cd {repo}")
        print(f"     git init && git remote add origin <url>")
        sys.exit(1)

    date_str = datetime.now().strftime("%A, %B %-d, %Y")
    print(f"\n── {profile_name.capitalize()} Log ── {date_str} ──")

    # Collect entry
    if args.no_editor:
        content = collect_inline()
    else:
        initial = TEMPLATE.format(date=date_str)
        content = open_in_editor(initial)

    if not content or content.strip() == TEMPLATE.format(date=date_str).strip():
        print("Nothing written. Exiting.")
        sys.exit(0)

    print()
    log_path = get_log_path(repo)
    save_log(content, log_path)

    if not args.no_push:
        git_push(repo, log_path, profile_name)

    print()


if __name__ == "__main__":
    main()
