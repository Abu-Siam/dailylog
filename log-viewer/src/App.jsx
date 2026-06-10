import { useState, useCallback } from "react";

// ── Parser ────────────────────────────────────────────────────────────────────

function parseLogFile(filename, content) {
  const match = filename.match(/(\d{2})-(\d{2})-(\d{4})/);
  let date = null;
  if (match) date = new Date(`${match[3]}-${match[1]}-${match[2]}`);

  const entries = content.split(/\n---\n/).map(e => e.trim()).filter(Boolean);
  const sections = {};
  let currentSection = null;

  for (const entry of entries) {
    for (const line of entry.split("\n")) {
      if (line.startsWith("## ")) {
        currentSection = line.replace("## ", "").trim();
        if (!sections[currentSection]) sections[currentSection] = [];
      } else if (currentSection && line.startsWith("- ")) {
        sections[currentSection].push(line.replace("- ", "").trim());
      } else if (currentSection && line && !line.startsWith("#") && !line.startsWith("<!--")) {
        const ex = sections[currentSection];
        if (ex.length === 0 || ex[ex.length - 1] !== line.trim())
          ex.push(line.trim());
      }
    }
  }
  return { filename, date, sections, raw: content, entryCount: entries.length };
}

// ── Colors ────────────────────────────────────────────────────────────────────

const SECTION_STYLES = {
  "Work":         { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD" },
  "Personal":     { bg: "#E1F5EE", text: "#085041", dot: "#1D9E75" },
  "Mood":         { bg: "#FAEEDA", text: "#633806", dot: "#BA7517" },
  "Wins":         { bg: "#EAF3DE", text: "#27500A", dot: "#639922" },
  "Tomorrow":     { bg: "#EEEDFE", text: "#3C3489", dot: "#7F77DD" },
  "Blockers":     { bg: "#FAECE7", text: "#712B13", dot: "#D85A30" },
  "Grateful for": { bg: "#FBEAF0", text: "#72243E", dot: "#D4537E" },
};
function sectionStyle(name) {
  return SECTION_STYLES[name] || { bg: "#F1EFE8", text: "#444441", dot: "#888780" };
}

// heatmap: 0=empty, 1-4 intensity
const HEAT = ["#F1EFE8", "#B5D4F4", "#378ADD", "#185FA5", "#042C53"];

function heatColor(count) {
  if (!count) return HEAT[0];
  if (count === 1) return HEAT[1];
  if (count === 2) return HEAT[2];
  if (count === 3) return HEAT[3];
  return HEAT[4];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeStreak(logs) {
  const sorted = [...logs].filter(l => l.date).sort((a, b) => b.date - a.date);
  if (!sorted.length) return 0;
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = (sorted[i].date - sorted[i + 1].date) / 86400000;
    if (diff <= 1.5) streak++; else break;
  }
  return streak;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// Build 52-week grid ending today
function buildHeatmapGrid() {
  const today = new Date(); today.setHours(0,0,0,0);
  const days = [];
  // go back to last Sunday, then 52 weeks back
  const end = new Date(today);
  const startOffset = (today.getDay()); // days since Sunday
  const start = new Date(today);
  start.setDate(start.getDate() - startOffset - 51 * 7);
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DropZone({ onFiles }) {
  const [dragging, setDragging] = useState(false);
  const handleFiles = (files) => {
    const md = Array.from(files).filter(f => f.name.endsWith(".md"));
    if (!md.length) return;
    Promise.all(md.map(f => f.text().then(t => ({ name: f.name, content: t })))).then(onFiles);
  };
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => document.getElementById("file-input").click()}
      style={{
        border: `2px dashed ${dragging ? "var(--color-border-primary)" : "var(--color-border-secondary)"}`,
        borderRadius: 12, padding: "48px 32px", textAlign: "center",
        background: dragging ? "var(--color-background-secondary)" : "transparent",
        transition: "all 0.15s", cursor: "pointer",
      }}
    >
      <input id="file-input" type="file" accept=".md" multiple style={{ display: "none" }}
        onChange={e => handleFiles(e.target.files)} />
      <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
        Drop your log files here
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
        Upload your <code style={{ fontSize: 12 }}>mm-dd-yyyy.md</code> files from the <code style={{ fontSize: 12 }}>dailylog/</code> folder
      </div>
    </div>
  );
}

function SectionPill({ name }) {
  const s = sectionStyle(name);
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 500, background: s.bg, color: s.text, letterSpacing: "0.03em",
    }}>{name}</span>
  );
}

function LogCard({ log, isSelected, onClick }) {
  const dateLabel = log.date
    ? log.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : log.filename;
  const mood = log.sections["Mood"]?.[0];
  const workCount = log.sections["Work"]?.length || 0;
  return (
    <div onClick={onClick} style={{
      padding: "14px 16px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
      border: `1px solid ${isSelected ? "var(--color-border-primary)" : "var(--color-border-tertiary)"}`,
      background: isSelected ? "var(--color-background-secondary)" : "var(--color-background-primary)",
      transition: "all 0.12s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{dateLabel}</div>
        {log.entryCount > 1 && (
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", background: "var(--color-background-tertiary)", padding: "1px 7px", borderRadius: 99 }}>
            {log.entryCount}×
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: mood ? 6 : 0 }}>
        {Object.keys(log.sections).map(n => <SectionPill key={n} name={n} />)}
      </div>
      {mood && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>😐 {mood}</div>}
    </div>
  );
}

function LogDetail({ log }) {
  const dateLabel = log.date
    ? log.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : log.filename;
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: 4 }}>
          {log.filename}
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>{dateLabel}</div>
        {log.entryCount > 1 && <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 3 }}>{log.entryCount} entries this day</div>}
      </div>
      {Object.entries(log.sections).map(([section, items]) => {
        const s = sectionStyle(section);
        return (
          <div key={section} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: s.text }}>{section}</div>
            </div>
            <div style={{ paddingLeft: 16 }}>
              {items.map((item, i) => (
                <div key={i} style={{ fontSize: 14, color: "var(--color-text-primary)", lineHeight: 1.65, marginBottom: 4, display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}>–</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Heatmap({ logs, onSelectDate }) {
  const [tooltip, setTooltip] = useState(null);

  const logMap = {};
  logs.forEach(l => {
    if (l.date) {
      const k = dateKey(l.date);
      logMap[k] = l;
    }
  });

  const days = buildHeatmapGrid();
  // group into columns of 7 (Sun–Sat)
  const cols = [];
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7));

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  // month labels: find first day of each month in the grid
  const monthLabels = [];
  cols.forEach((col, ci) => {
    const first = col[0];
    if (first.getDate() <= 7) {
      monthLabels.push({ ci, label: MONTHS[first.getMonth()] });
    }
  });

  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const CELL = 13, GAP = 3;

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 0 }}>
        {/* Month labels */}
        <div style={{ display: "flex", marginLeft: 32, marginBottom: 4, position: "relative", height: 16 }}>
          {monthLabels.map(({ ci, label }) => (
            <div key={ci} style={{
              position: "absolute", left: ci * (CELL + GAP),
              fontSize: 11, color: "var(--color-text-tertiary)",
            }}>{label}</div>
          ))}
        </div>
        {/* Grid */}
        <div style={{ display: "flex", gap: GAP }}>
          {/* Day labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: GAP, marginRight: 4 }}>
            {DAYS.map((d, i) => (
              <div key={d} style={{
                height: CELL, fontSize: 10, color: "var(--color-text-tertiary)",
                lineHeight: `${CELL}px`, width: 24, textAlign: "right",
                visibility: i % 2 === 0 ? "visible" : "hidden",
              }}>{d}</div>
            ))}
          </div>
          {/* Cells */}
          {cols.map((col, ci) => (
            <div key={ci} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
              {col.map((day, di) => {
                const k = dateKey(day);
                const log = logMap[k];
                const workCount = log?.sections["Work"]?.length || 0;
                const future = day > new Date();
                return (
                  <div
                    key={di}
                    onClick={() => log && onSelectDate(log)}
                    onMouseEnter={e => setTooltip({ log, day, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      width: CELL, height: CELL,
                      borderRadius: 3,
                      background: future ? "transparent" : heatColor(workCount),
                      border: future ? "none" : `1px solid ${log ? "rgba(0,0,0,0.08)" : "var(--color-border-tertiary)"}`,
                      cursor: log ? "pointer" : "default",
                      transition: "transform 0.1s",
                    }}
                    onMouseOver={e => { if (log) e.currentTarget.style.transform = "scale(1.3)"; }}
                    onMouseOut={e => { e.currentTarget.style.transform = "scale(1)"; }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, marginLeft: 32 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Less</span>
          {HEAT.map((c, i) => (
            <div key={i} style={{ width: CELL, height: CELL, borderRadius: 3, background: c, border: "1px solid rgba(0,0,0,0.08)" }} />
          ))}
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>More work</span>
        </div>
      </div>
      {/* Tooltip */}
      {tooltip && tooltip.log && (
        <div style={{
          position: "fixed", left: tooltip.x + 12, top: tooltip.y - 10,
          background: "var(--color-background-primary)",
          border: "1px solid var(--color-border-secondary)",
          borderRadius: 8, padding: "8px 12px", fontSize: 12,
          color: "var(--color-text-primary)", pointerEvents: "none", zIndex: 99,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}>
          <div style={{ fontWeight: 500, marginBottom: 3 }}>
            {tooltip.day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
          <div style={{ color: "var(--color-text-secondary)" }}>
            {tooltip.log.sections["Work"]?.length || 0} work items
          </div>
          {tooltip.log.sections["Mood"]?.[0] && (
            <div style={{ color: "var(--color-text-tertiary)" }}>😐 {tooltip.log.sections["Mood"][0]}</div>
          )}
        </div>
      )}
    </div>
  );
}

function BarChart({ logs }) {
  // last 30 days
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    days.push(d);
  }
  const logMap = {};
  logs.forEach(l => { if (l.date) logMap[dateKey(l.date)] = l; });

  const data = days.map(d => ({
    day: d,
    work: logMap[dateKey(d)]?.sections["Work"]?.length || 0,
    personal: logMap[dateKey(d)]?.sections["Personal"]?.length || 0,
    label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const maxVal = Math.max(...data.map(d => d.work + d.personal), 1);
  const BAR_H = 120;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: BAR_H + 28, minWidth: 600 }}>
        {data.map((d, i) => {
          const workH = (d.work / maxVal) * BAR_H;
          const persH = (d.personal / maxVal) * BAR_H;
          const showLabel = i % 5 === 0 || i === 29;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: BAR_H, width: "100%", gap: 1 }}>
                {d.personal > 0 && (
                  <div style={{ height: persH, background: "#1D9E75", borderRadius: "2px 2px 0 0", minHeight: d.personal ? 3 : 0 }} />
                )}
                {d.work > 0 && (
                  <div style={{ height: workH, background: "#378ADD", borderRadius: d.personal ? 0 : "2px 2px 0 0", minHeight: d.work ? 3 : 0 }} />
                )}
                {d.work === 0 && d.personal === 0 && (
                  <div style={{ height: 2, background: "var(--color-border-tertiary)", borderRadius: 2 }} />
                )}
              </div>
              <div style={{
                fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 4,
                whiteSpace: "nowrap", visibility: showLabel ? "visible" : "hidden",
              }}>{d.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        {[["#378ADD", "Work"], ["#1D9E75", "Personal"]].map(([color, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoodChart({ logs }) {
  const moodLogs = logs
    .filter(l => l.date && l.sections["Mood"]?.[0])
    .sort((a, b) => a.date - b.date)
    .slice(-30);

  if (moodLogs.length < 2) return (
    <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", padding: "20px 0" }}>
      Not enough mood data yet (need at least 2 entries with a Mood section).
    </div>
  );

  const parseMood = str => {
    const m = str.match(/(\d+)/);
    return m ? parseInt(m[1]) : null;
  };

  const points = moodLogs.map(l => ({ date: l.date, score: parseMood(l.sections["Mood"][0]), raw: l.sections["Mood"][0] }))
    .filter(p => p.score !== null);

  if (points.length < 2) return null;

  const W = 500, H = 100, PAD = 20;
  const minD = points[0].date.getTime(), maxD = points[points.length-1].date.getTime();
  const xScale = d => PAD + ((d.getTime() - minD) / (maxD - minD || 1)) * (W - PAD * 2);
  const yScale = s => H - PAD - ((s - 1) / 9) * (H - PAD * 2);

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.date)} ${yScale(p.score)}`).join(" ");
  const avg = Math.round(points.reduce((s, p) => s + p.score, 0) / points.length * 10) / 10;

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 8 }}>
        Average mood: <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{avg}/10</span> over last {points.length} entries
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {/* Grid lines */}
        {[2, 4, 6, 8, 10].map(y => (
          <g key={y}>
            <line x1={PAD} y1={yScale(y)} x2={W - PAD} y2={yScale(y)} stroke="var(--color-border-tertiary)" strokeWidth="0.5" />
            <text x={PAD - 4} y={yScale(y)} textAnchor="end" fontSize="9" fill="var(--color-text-tertiary)" dominantBaseline="central">{y}</text>
          </g>
        ))}
        {/* Line */}
        <path d={pathD} fill="none" stroke="#BA7517" strokeWidth="2" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={xScale(p.date)} cy={yScale(p.score)} r="3" fill="#BA7517" />
        ))}
      </svg>
    </div>
  );
}

function Dashboard({ logs, onSelectLog }) {
  const streak = computeStreak(logs);
  const totalWork = logs.reduce((s, l) => s + (l.sections["Work"]?.length || 0), 0);
  const avgWork = logs.length ? (totalWork / logs.length).toFixed(1) : 0;
  const bestDay = [...logs].sort((a, b) => (b.sections["Work"]?.length || 0) - (a.sections["Work"]?.length || 0))[0];

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: 16 }}>
        Dashboard
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total logs", value: logs.length },
          { label: "Day streak", value: `${streak} 🔥` },
          { label: "Avg work items/day", value: avgWork },
          { label: "Best day", value: bestDay?.date?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) || "—" },
        ].map((s, i) => (
          <div key={i} style={{
            padding: "16px 18px",
            border: "1px solid var(--color-border-tertiary)",
            borderRadius: 10, background: "var(--color-background-secondary)",
          }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 12 }}>
          Activity heatmap — work items logged
        </div>
        <Heatmap logs={logs} onSelectDate={onSelectLog} />
      </div>

      {/* Bar chart */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 12 }}>
          Daily breakdown — last 30 days
        </div>
        <BarChart logs={logs} />
      </div>

      {/* Mood chart */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 12 }}>
          Mood over time
        </div>
        <MoodChart logs={logs} />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("logs"); // "logs" | "dashboard"
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState(null);

  const handleFiles = useCallback((files) => {
    const parsed = files
      .map(f => parseLogFile(f.name, f.content))
      .sort((a, b) => (b.date || 0) - (a.date || 0));
    setLogs(parsed);
    setSelected(parsed[0] || null);
  }, []);

  const allSections = [...new Set(logs.flatMap(l => Object.keys(l.sections)))];
  const filtered = logs.filter(l => {
    const matchSearch = !search || JSON.stringify(l.sections).toLowerCase().includes(search.toLowerCase());
    const matchSection = !filterSection || l.sections[filterSection];
    return matchSearch && matchSection;
  });

  if (!logs.length) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: 6 }}>Daily log viewer</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>Your logs, visualized</div>
          <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
            Upload your <code style={{ fontSize: 13 }}>mm-dd-yyyy.md</code> files from your <code style={{ fontSize: 13 }}>dailylog/</code> folder.
          </div>
        </div>
        <DropZone onFiles={handleFiles} />
      </div>
    );
  }

  const TAB_STYLE = (active) => ({
    padding: "6px 14px", fontSize: 13, borderRadius: 6, cursor: "pointer",
    border: "none", fontWeight: active ? 500 : 400,
    background: active ? "var(--color-background-primary)" : "transparent",
    color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  });

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "var(--font-sans)", overflow: "hidden" }}>

      {/* Sidebar */}
      <div style={{
        width: 272, flexShrink: 0,
        borderRight: "1px solid var(--color-border-tertiary)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Tab switcher */}
        <div style={{
          padding: "12px 12px 10px",
          borderBottom: "1px solid var(--color-border-tertiary)",
          background: "var(--color-background-secondary)",
        }}>
          <div style={{ display: "flex", gap: 4, background: "var(--color-background-tertiary)", borderRadius: 8, padding: 3 }}>
            <button style={TAB_STYLE(tab === "logs")} onClick={() => setTab("logs")}>Logs</button>
            <button style={TAB_STYLE(tab === "dashboard")} onClick={() => setTab("dashboard")}>Dashboard</button>
          </div>
        </div>

        {/* Filters (logs tab only) */}
        {tab === "logs" && (
          <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid var(--color-border-tertiary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{filtered.length} logs</span>
              <button onClick={() => { setLogs([]); setSelected(null); }}
                style={{ fontSize: 11, color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                clear
              </button>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{
                width: "100%", padding: "6px 10px", fontSize: 12,
                border: "1px solid var(--color-border-tertiary)", borderRadius: 6,
                background: "var(--color-background-secondary)", color: "var(--color-text-primary)",
                outline: "none", boxSizing: "border-box",
              }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 7 }}>
              {allSections.map(s => {
                const st = sectionStyle(s); const active = filterSection === s;
                return (
                  <button key={s} onClick={() => setFilterSection(active ? null : s)} style={{
                    fontSize: 11, padding: "2px 7px", borderRadius: 99, cursor: "pointer",
                    border: `1px solid ${active ? st.dot : "transparent"}`,
                    background: active ? st.bg : "var(--color-background-tertiary)",
                    color: active ? st.text : "var(--color-text-secondary)",
                    fontWeight: active ? 500 : 400,
                  }}>{s}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* Log list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
          {tab === "logs" && filtered.map(log => (
            <LogCard key={log.filename} log={log}
              isSelected={selected?.filename === log.filename}
              onClick={() => { setSelected(log); }} />
          ))}
          {tab === "dashboard" && logs.map(log => (
            <LogCard key={log.filename} log={log}
              isSelected={selected?.filename === log.filename}
              onClick={() => { setSelected(log); setTab("logs"); }} />
          ))}
        </div>
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "dashboard" ? (
          <Dashboard logs={logs} onSelectLog={(log) => { setSelected(log); setTab("logs"); }} />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
            {selected
              ? <LogDetail log={selected} />
              : <div style={{ color: "var(--color-text-tertiary)", fontSize: 14, marginTop: 40, textAlign: "center" }}>Select a log to view</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
