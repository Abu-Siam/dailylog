# dailylog

A minimal personal logging system. Write your day in markdown from the terminal — it saves to a structured folder and pushes to git automatically. A React viewer lets you browse and visualize all your logs with a dashboard, heatmap, and mood chart.

---

## What's in this repo

```
dailylog/
├── dailylog.py          # CLI tool — write logs, push to git
└── log-viewer/          # React app — browse and visualize logs
    └── src/
        └── App.jsx
```

---

## dailylog.py

### Requirements

- Python 3.7+
- git installed and configured
- A git repo where your logs will live (separate from this one)

### Install

```bash
# Download or clone this repo, then:
cp dailylog.py /usr/local/bin/dailylog
chmod +x /usr/local/bin/dailylog
```

### Setup

Create a git repo for your logs (do this once):

```bash
mkdir ~/my-logs && cd ~/my-logs
git init
git remote add origin https://github.com/yourname/my-logs.git
```

Register it as a profile:

```bash
dailylog --add-profile default --repo ~/my-logs
```

You can have multiple profiles for different repos:

```bash
dailylog --add-profile work     --repo ~/work-logs
dailylog --add-profile personal --repo ~/personal-logs
dailylog --add-profile journal  --repo ~/journal
```

Profiles are stored in `~/.config/dailylog/profiles.json`.

### Daily usage

```bash
dailylog              # opens editor with markdown template, saves + pushes to 'default'
dailylog work         # uses 'work' profile
dailylog personal     # uses 'personal' profile
```

Your editor opens with a prefilled template:

```markdown
# Wednesday, June 10, 2026

## Work

## Personal

## Mood

## Tomorrow
```

Fill it in, save, and close. The script saves your entry to:

```
~/my-logs/dailylog/06-10-2026.md
```

Then runs `git add`, `git commit`, and `git push` automatically.

If you log more than once in a day, the new entry is **appended** to the same file with a `---` separator — nothing is overwritten.

### Other commands

```bash
dailylog --view              # print today's log
dailylog work --view         # print today's work log
dailylog --no-push           # save locally, skip git
dailylog --no-editor         # type inline in terminal instead of opening editor
dailylog --list-profiles     # show all profiles and their repos
```

### Set your preferred editor

Add to `~/.zshrc` or `~/.bashrc`:

```bash
export EDITOR=vim      # or: nano, micro, code, hx
```

### Markdown syntax

```markdown
# Heading 1        ← date title (auto-filled)
## Heading 2       ← sections: Work, Personal, Mood, etc.

- bullet point
- another point

**bold**   *italic*   `code`

> a note to yourself

8/10 — focused but tired    ← mood rating (plain text under ## Mood)
```

---

## log-viewer (React app)

A browser-based viewer for your logs. Two views:

- **Logs** — browse all entries, search by keyword, filter by section
- **Dashboard** — activity heatmap, daily bar chart (work vs personal), mood over time, streak counter

### Requirements

- Node.js 18+

### Setup

```bash
cd log-viewer

# First time only:
npm create vite@latest . -- --template react
# (say yes to overwrite when prompted)
npm install

# Replace the default App:
cp src/App.jsx src/App.jsx.bak   # optional backup
# (the App.jsx in this repo is already the viewer)

# Remove default CSS imports from src/main.jsx:
# Delete the line: import './index.css'
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Load your logs

1. Open your `~/my-logs/dailylog/` folder
2. Drag and drop your `mm-dd-yyyy.md` files into the browser window
3. Browse the timeline, search entries, or switch to Dashboard

### Dashboard

| Widget | What it shows |
|---|---|
| Stat cards | Total logs, current streak, avg work items/day, best day |
| Activity heatmap | 52-week GitHub-style grid — darker = more work items |
| Daily bar chart | Last 30 days, Work (blue) + Personal (green) stacked |
| Mood chart | Mood score over time with rolling average |

Click any heatmap cell to jump to that day's log entry.

---

## Log folder structure

Your logs repo (the one you push to) looks like this:

```
my-logs/
└── dailylog/
    ├── 06-08-2026.md
    ├── 06-09-2026.md
    └── 06-10-2026.md
```

Each file is named `MM-DD-YYYY.md`. Git commit messages follow the format:

```
log(work): 2026-06-10
log(personal): 2026-06-10
```

---

## Customizing sections

Edit `~/.config/dailylog/profiles.json` directly:

```json
{
  "work": {
    "repo": "/Users/you/work-logs",
    "sections": [
      ["Work", "tasks, meetings, decisions"],
      ["Blockers", "anything slowing you down"],
      ["Wins", "something that went well"],
      ["Tomorrow", "planned tasks"],
      ["Mood", "1-10 rating and a phrase"]
    ]
  }
}
```

---

## License

MIT
