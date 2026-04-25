import { useState, useRef, useEffect, useCallback } from "react";

// ── THEME SYSTEM ──────────────────────────────────────────────────────────────
const THEMES = {
  light: {
    bg:        "#F5EFE6",
    secondary: "#EDE4D3",
    text:      "#1A1A1A",
    subtext:   "#5C5448",
    border:    "#D8CEBF",
    cardBg:    "#FFFFFF",
    headerBg:  "#F5EFE6",
    mutedText: "#9A8E80",
    statBg:    "#FDFAF6",
    tag:       "#E8DFD0",
  },
  dark: {
    bg:        "#0B0F14",
    secondary: "#131920",
    text:      "#E8EFF7",
    subtext:   "#A0B0C4",
    border:    "#253040",
    cardBg:    "#111820",
    headerBg:  "#0B0F14",
    mutedText: "#607080",
    statBg:    "#0E1620",
    tag:       "#1A2535",
  },
};

// ── COLOUR PALETTE ────────────────────────────────────────────────────────────
const TIER_COLORS = [
  "#F59E0B", // O  – amber
  "#EA580C", // A+ – burnt orange
  "#0284C7", // A  – steel blue
  "#0891B2", // B+ – teal
  "#16A34A", // B  – forest green
  "#6B7280", // C  – slate
  "#92400E", // D  – dark amber
  "#DC2626", // F  – red
];

const GRADE_MAP: Record<string, number> = { O:0, "A+":1, A:2, "B+":3, B:4, C:5, D:6, F:7 };

function tierOf(grade: string)  { return GRADE_MAP[grade] ?? 7; }
function colorOf(tier: number)  { return TIER_COLORS[tier]; }
function gauss(x: number, mu: number, sig: number) {
  return Math.exp(-0.5 * ((x - mu) / sig) ** 2);
}

// ── DEMO DATASET ──────────────────────────────────────────────────────────────
const DEMO_RAW = {
  subject: "Computer Engineering",
  students: [
    { name: "Aarav Shah",     marks: 88, history: [70, 75, 80, 84, 88] },
    { name: "Priya Nair",     marks: 72, history: [78, 76, 74, 73, 72] },
    { name: "Rohit Verma",    marks: 95, history: [88, 90, 92, 94, 95] },
    { name: "Ishita Rao",     marks: 67, history: [65, 68, 66, 69, 67] },
    { name: "Karan Mehta",    marks: 78, history: [60, 68, 72, 75, 78] },
    { name: "Neha Joshi",     marks: 61, history: [58, 60, 62, 63, 61] },
    { name: "Vivek Singh",    marks: 85, history: [62, 68, 73, 79, 85] },
    { name: "Ananya Desai",   marks: 90, history: [85, 87, 88, 89, 90] },
    { name: "Arjun Reddy",    marks: 58, history: [65, 62, 60, 59, 58] },
    { name: "Sneha Kapoor",   marks: 74, history: [72, 73, 74, 75, 74] },
    { name: "Dev Patel",      marks: 82, history: [78, 80, 81, 82, 82] },
    { name: "Manav Sharma",   marks: 69, history: [50, 75, 60, 80, 69] },
    { name: "Pooja Iyer",     marks: 77, history: [70, 73, 75, 76, 77] },
    { name: "Riya Malhotra",  marks: 63, history: [40, 45, 50, 55, 63] },
    { name: "Yash Bansal",    marks: 92, history: [89, 90, 91, 92, 92] },
  ],
};

// ── CLIENT-SIDE GRADING & STATS ───────────────────────────────────────────────
function computeStats(marks: number[]) {
  const n    = marks.length;
  const mean = marks.reduce((a, b) => a + b, 0) / n;
  const std  = Math.sqrt(marks.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const sorted = [...marks].sort((a, b) => a - b);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // Mode
  const freq: Record<number, number> = {};
  marks.forEach(m => { freq[m] = (freq[m] || 0) + 1; });
  const maxFreq = Math.max(...Object.values(freq));
  const modes   = Object.entries(freq).filter(([, f]) => f === maxFreq).map(([v]) => +v);
  const mode    = modes.length === marks.length ? null : modes;

  return {
    mean:    +mean.toFixed(2),
    median:  +median.toFixed(2),
    std:     +std.toFixed(2),
    variance: +(std * std).toFixed(2),
    min:     Math.min(...marks),
    max:     Math.max(...marks),
    range:   Math.max(...marks) - Math.min(...marks),
    p25:     +sorted[Math.floor(n * 0.25)].toFixed(2),
    p75:     +sorted[Math.floor(n * 0.75)].toFixed(2),
    p90:     +sorted[Math.floor(n * 0.90)].toFixed(2),
    mode,
    n,
  };
}

function assignGrade(score: number, mean: number, std: number) {
  if (score >= mean + 1.5 * std) return { grade: "O",  cat: "Outstanding",   points: 10 };
  if (score >= mean + 1.0 * std) return { grade: "A+", cat: "Excellent",      points: 9  };
  if (score >= mean + 0.5 * std) return { grade: "A",  cat: "Very Good",      points: 8  };
  if (score >= mean              ) return { grade: "B+", cat: "Good",           points: 7  };
  if (score >= mean - 0.5 * std) return { grade: "B",  cat: "Above Average",  points: 6  };
  if (score >= mean - 1.0 * std) return { grade: "C",  cat: "Average",        points: 5  };
  if (score >= mean - 1.5 * std) return { grade: "D",  cat: "Below Average",  points: 4  };
  return { grade: "F", cat: "Fail", points: 0 };
}

function processDataset(subject: string, names: string[], marksRaw: number[], histories?: number[][]) {
  const stats   = computeStats(marksRaw);
  const { mean, std } = stats;
  const sorted  = [...marksRaw].map((m, i) => ({ m, i })).sort((a, b) => b.m - a.m);
  const rankArr = new Array(marksRaw.length).fill(0);
  sorted.forEach(({ i }, rank) => { rankArr[i] = rank + 1; });

  const students = names.map((name, i) => {
    const marks = marksRaw[i];
    const z     = std ? +((marks - mean) / std).toFixed(3) : 0;
    const { grade, cat, points } = assignGrade(marks, mean, std);
    const hist = histories?.[i] ?? generateFallbackHistory(name, marks);
    return { name, marks, grade, cat, points, z, rank: rankArr[i], tier: tierOf(grade), history: hist };
  });

  return { subject, students, stats };
}

function generateFallbackHistory(name: string, mark: number): number[] {
  let seed = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  const hist = [mark];
  for (let t = 0; t < 4; t++) {
    const delta = (rand() - 0.5) * 16;
    hist.push(Math.round(Math.min(100, Math.max(0, hist[hist.length - 1] + delta))));
  }
  hist.reverse();
  hist[hist.length - 1] = mark;
  return hist;
}

// ── TREND INSIGHT ─────────────────────────────────────────────────────────────
function trendInsight(history: number[]): { label: string; color: string } {
  if (!history || history.length < 2) return { label: "no data", color: "#6B7280" };
  const diffs = history.slice(1).map((v, i) => v - history[i]);
  const avg   = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((a, b) => a + (b - avg) ** 2, 0) / diffs.length;
  const std   = Math.sqrt(variance);
  if (std > 8)       return { label: "high variance",        color: "#F59E0B" };
  if (avg > 3)       return { label: "consistently improving", color: "#16A34A" };
  if (avg < -3)      return { label: "declining trend",        color: "#DC2626" };
  return { label: "stable performance", color: "#0891B2" };
}

// ── INSIGHTS ──────────────────────────────────────────────────────────────────
function generateInsights(students: any[], stats: any): string[] {
  const { mean, std, median } = stats;
  const skew      = (mean - median) / (std || 1);
  const cv        = (std / (mean || 1)) * 100;
  const failCount = students.filter(s => s.grade === "F").length;
  const topCount  = students.filter(s => s.tier <= 1).length;
  const improving = students.filter(s => trendInsight(s.history).label === "consistently improving").length;
  const declining = students.filter(s => trendInsight(s.history).label === "declining trend").length;
  const lines: string[] = [];

  if      (cv < 15) lines.push("tightly clustered distribution");
  else if (cv < 25) lines.push("moderate spread across the curve");
  else              lines.push("wide score dispersion detected");

  if      (Math.abs(skew) < 0.12) lines.push("near-symmetric bell shape");
  else if (skew > 0)               lines.push("right skew — stronger high performers");
  else                             lines.push("left skew — more below-average scores");

  if (failCount === 0) lines.push("no students in fail zone — strong cohort");
  else lines.push(`${failCount} student${failCount > 1 ? "s" : ""} in fail zone — attention required`);

  if (topCount > 0) lines.push(`${topCount} student${topCount > 1 ? "s" : ""} in O/A+ tier`);

  if (improving > 0) lines.push(`${improving} student${improving > 1 ? "s" : ""} on a consistent upward trajectory`);
  if (declining > 0) lines.push(`${declining} student${declining > 1 ? "s" : ""} showing declining trend`);

  if      (mean > 70) lines.push("class performing above baseline");
  else if (mean < 50) lines.push("class performance below target threshold");

  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ANIMATED NUMBER
// ═══════════════════════════════════════════════════════════════════════════════
function AnimatedNumber({ target, decimals = 1, duration = 900, delay = 0, prefix = "", suffix = "" }: {
  target: number; decimals?: number; duration?: number; delay?: number; prefix?: string; suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStarted(true);
      const start  = performance.now();
      const tick   = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        setDisplay(+(eased * target).toFixed(decimals));
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
        else       setDisplay(target);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(rafRef.current); };
  }, [target, duration, delay, decimals]);

  return (
    <span style={{ opacity: started ? 1 : 0, transition: "opacity 0.2s", display: "inline-block" }}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TREND SPARKLINE
// ═══════════════════════════════════════════════════════════════════════════════
function TrendLine({ history, color, width = 120, height = 40 }: {
  history: number[]; color: string; width?: number; height?: number;
}) {
  if (!history || history.length < 2) return null;
  const pad  = 4;
  const minV = Math.min(...history);
  const maxV = Math.max(...history);
  const rng  = maxV - minV || 1;
  const toX  = (i: number) => pad + (i / (history.length - 1)) * (width - 2 * pad);
  const toY  = (v: number) => height - pad - ((v - minV) / rng) * (height - 2 * pad);
  const pts  = history.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const fillPts = [
    `${toX(0)},${height}`,
    ...history.map((v, i) => `${toX(i)},${toY(v)}`),
    `${toX(history.length - 1)},${height}`,
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display:"block" }}>
      <polygon points={fillPts} fill={color} opacity="0.10" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(history.length - 1)} cy={toY(history[history.length - 1])}
        r="2.5" fill={color} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MINI HISTORY ANALYSIS (shown when clicking history item)
// ═══════════════════════════════════════════════════════════════════════════════
function HistoryAnalysisModal({ session, onClose, theme }: { session: any; onClose: () => void; theme: any }) {
  const T = theme;
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 260); };

  const processed = session._processed;
  if (!processed) return null;

  const { students, stats } = processed;
  const insights = generateInsights(students, stats);

  return (
    <div onClick={handleClose} style={{
      position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      opacity: visible ? 1 : 0, transition:"opacity 0.25s",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.cardBg,
        border:`1px solid ${T.border}`,
        borderRadius:14,
        padding:"28px 32px",
        width:"90%", maxWidth:720,
        maxHeight:"82vh", overflowY:"auto",
        fontFamily:"'JetBrains Mono', monospace",
        color: T.text,
        transform: visible ? "scale(1)" : "scale(0.95)",
        transition:"transform 0.26s cubic-bezier(0.34,1.2,0.64,1)",
        boxShadow:"0 24px 80px rgba(0,0,0,0.25)",
      }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{processed.subject}</div>
            <div style={{ fontSize:10, color:T.subtext, marginTop:3 }}>
              Historical Session — {students.length} students
            </div>
          </div>
          <button onClick={handleClose} style={{
            background:"none", border:"none", cursor:"pointer",
            color:T.subtext, fontSize:22, lineHeight:1,
          }}>×</button>
        </div>

        {/* Stats row */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(4, 1fr)",
          gap:10, marginBottom:24,
        }}>
          {[
            ["mean",    stats.mean.toFixed(1)],
            ["std σ",   stats.std.toFixed(1)],
            ["median",  stats.median.toFixed(1)],
            ["students", stats.n],
          ].map(([l, v]) => (
            <div key={String(l)} style={{
              background:T.statBg, border:`1px solid ${T.border}`,
              borderRadius:8, padding:"12px 14px",
            }}>
              <div style={{ fontSize:8, color:T.mutedText, letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:5 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:700, color:T.text }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Students list */}
        <div style={{
          fontSize:9, color:T.mutedText, letterSpacing:"0.18em",
          textTransform:"uppercase", marginBottom:10,
        }}>Student Breakdown</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
          {students.sort((a:any,b:any) => a.rank - b.rank).map((s:any, i:number) => {
            const insight = trendInsight(s.history);
            return (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:10,
                background:T.statBg, border:`1px solid ${T.border}`,
                borderRadius:7, padding:"9px 12px",
              }}>
                <span style={{ fontSize:9, color:T.mutedText, width:18 }}>#{s.rank}</span>
                <div style={{ width:8, height:8, borderRadius:"50%", background:colorOf(s.tier), flexShrink:0 }} />
                <span style={{ flex:1, fontSize:11, color:T.text }}>{s.name}</span>
                <span style={{ fontSize:11, fontWeight:700, color:colorOf(s.tier), width:32, textAlign:"right" }}>{s.grade}</span>
                <span style={{ fontSize:10, color:T.subtext, width:30, textAlign:"right" }}>{s.marks}</span>
                <TrendLine history={s.history} color={insight.color} width={60} height={22} />
                <span style={{ fontSize:8, color:insight.color, width:110, textAlign:"right" }}>{insight.label}</span>
              </div>
            );
          })}
        </div>

        {/* Insights */}
        <div style={{ fontSize:9, color:T.mutedText, letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:8 }}>Insights</div>
        {insights.map((line, i) => (
          <div key={i} style={{ display:"flex", gap:8, marginBottom:5, fontSize:11, color:T.subtext }}>
            <span style={{ color:T.mutedText }}>—</span>{line}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STUDENT DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function DetailPanel({ student, onClose, theme }: { student: any; onClose: () => void; theme: any }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 260); };
  const color   = colorOf(student.tier);
  const T       = theme;
  const insight = trendInsight(student.history);

  // Mini stats of student history
  const histStats = student.history ? computeStats(student.history) : null;

  return (
    <div onClick={handleClose} style={{
      position:"fixed", inset:0, zIndex:100,
      background:"rgba(0,0,0,0.22)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      opacity: visible ? 1 : 0, transition:"opacity 0.25s",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.cardBg,
        borderTop:`1px solid ${T.border}`,
        borderLeft:`1px solid ${T.border}`,
        borderRight:`1px solid ${T.border}`,
        borderRadius:"14px 14px 0 0",
        padding:"28px 32px 40px",
        width:"100%", maxWidth:540,
        fontFamily:"'JetBrains Mono', monospace",
        color: T.text,
        transform: visible ? "translateY(0)" : "translateY(48px)",
        transition:"transform 0.26s cubic-bezier(0.34,1.2,0.64,1)",
        boxShadow:"0 -8px 48px rgba(0,0,0,0.14)",
      }}>
        <div style={{ width:32, height:3, borderRadius:2, background:T.border, margin:"0 auto 24px" }}/>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{student.name}</div>
            <div style={{ fontSize:10, color:T.subtext, marginTop:3 }}>tap outside to close</div>
          </div>
          <button onClick={handleClose} style={{
            background:"none", border:"none", cursor:"pointer",
            color:T.subtext, fontSize:22, lineHeight:1,
          }}>×</button>
        </div>

        {/* Grade + rank */}
        <div style={{ display:"inline-flex", alignItems:"center", gap:12, marginBottom:22 }}>
          <span style={{ fontSize:26, fontWeight:700, color }}>{student.grade}</span>
          <span style={{ fontSize:11, color:T.subtext }}>{student.cat}</span>
          <span style={{
            fontSize:10, color:T.mutedText,
            borderLeft:`1px solid ${T.border}`, paddingLeft:12, marginLeft:4,
          }}>rank #{student.rank}</span>
        </div>

        {/* Stats row */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginBottom:22,
          borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`,
          padding:"14px 0",
        }}>
          {[
            ["marks",   student.marks],
            ["z-score", (student.z >= 0 ? "+" : "") + student.z.toFixed(2)],
            ["points",  student.points],
            ["trend",   <span style={{ color:insight.color, fontSize:9 }}>{insight.label}</span>],
          ].map(([l, v]) => (
            <div key={String(l)}>
              <div style={{ fontSize:8, color:T.mutedText, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Trend graph */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:8, color:T.mutedText, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>
            Score History — {student.history?.length ?? 0} tests
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:12 }}>
            <TrendLine history={student.history} color={color} width={320} height={72} />
            <div style={{ fontSize:9, color:T.mutedText, paddingBottom:4 }}>
              {student.history && (
                <>
                  <div style={{ color:"#16A34A" }}>↑ {Math.max(...student.history)}</div>
                  <div style={{ color:"#DC2626", marginTop:4 }}>↓ {Math.min(...student.history)}</div>
                </>
              )}
            </div>
          </div>
          {student.history && (
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, paddingRight:28 }}>
              {student.history.map((_: number, i: number) => (
                <span key={i} style={{ fontSize:8, color:T.mutedText }}>T{i+1}</span>
              ))}
            </div>
          )}
        </div>

        {/* History mini-stats */}
        {histStats && (
          <div style={{ marginTop:4 }}>
            <div style={{ fontSize:8, color:T.mutedText, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>
              History Analysis
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8 }}>
              {[
                ["avg",    histStats.mean.toFixed(1)],
                ["σ",      histStats.std.toFixed(1)],
                ["peak",   histStats.max],
                ["low",    histStats.min],
              ].map(([l, v]) => (
                <div key={String(l)} style={{
                  background:T.statBg, border:`1px solid ${T.border}`,
                  borderRadius:6, padding:"8px 10px",
                }}>
                  <div style={{ fontSize:8, color:T.mutedText, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HOVER CARD
// ═══════════════════════════════════════════════════════════════════════════════
function HoverCard({ student, theme }: { student: any; theme: any }) {
  const T     = theme;
  const color = colorOf(student.tier);
  const insight = trendInsight(student.history);
  return (
    <div style={{
      position:"absolute", top:8, right:8,
      background: T.cardBg, border:`1px solid ${T.border}`,
      borderRadius:9, padding:"13px 16px", minWidth:195,
      boxShadow:"0 4px 20px rgba(0,0,0,0.12)",
      pointerEvents:"none", zIndex:20,
      fontFamily:"'JetBrains Mono', monospace", color:T.text,
    }}>
      <div style={{
        fontSize:12, fontWeight:700, color,
        marginBottom:9, paddingBottom:8,
        borderBottom:`1px solid ${T.border}`,
      }}>{student.name}</div>
      {([
        ["marks",    String(student.marks)],
        ["z-score",  (student.z >= 0 ? "+" : "") + student.z.toFixed(2)],
        ["grade",    student.grade],
        ["category", student.cat],
        ["rank",     `#${student.rank}`],
      ] as [string,string][]).map(([l, v]) => (
        <div key={l} style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:3, fontSize:11 }}>
          <span style={{ color:T.subtext }}>{l}</span>
          <span style={{ color: l === "grade" ? color : T.text, fontWeight:600 }}>{v}</span>
        </div>
      ))}
      <div style={{ marginTop:10 }}>
        <TrendLine history={student.history} color={insight.color} width={158} height={32} />
        <div style={{ fontSize:8, color:insight.color, marginTop:4 }}>{insight.label}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BELL CURVE (DNA) VISUALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
function DNACurve({ students, stats, filter, animKey, theme }: {
  students: any[]; stats: any; filter: string; animKey: number; theme: any;
}) {
  const [hovered, setHovered] = useState<any>(null);
  const [detail,  setDetail]  = useState<any>(null);
  const [nodesOn, setNodesOn] = useState(false);
  const path1 = useRef<SVGPolylineElement>(null);
  const path2 = useRef<SVGPolylineElement>(null);
  const T = theme;

  const W = 800, H = 300, PAD = 44;
  const { mean, std } = stats;
  const xMin = mean - 3.2 * std;
  const xMax = mean + 3.2 * std;
  const toX  = (v: number) => PAD + ((v - xMin) / (xMax - xMin)) * (W - 2 * PAD);
  const toY  = (v: number) => H - PAD - v * (H - 2 * PAD);

  const PTS = 280;
  const c1  = Array.from({ length:PTS }, (_, i) => {
    const x = xMin + (i / (PTS - 1)) * (xMax - xMin);
    return `${toX(x)},${toY(gauss(x, mean, std))}`;
  });
  const c2 = Array.from({ length:PTS }, (_, i) => {
    const x = xMin + (i / (PTS - 1)) * (xMax - xMin);
    const y = gauss(x, mean, std) * 0.88 - 0.04;
    return `${toX(x)},${toY(Math.max(0, y))}`;
  });
  const links = Array.from({ length:14 }, (_, i) => {
    const x  = xMin + ((i + 1) / 15) * (xMax - xMin);
    const y1 = gauss(x, mean, std);
    const y2 = Math.max(0, y1 * 0.88 - 0.04);
    return { x1:toX(x), y1:toY(y1), x2:toX(x), y2:toY(y2) };
  });

  const nodes = students.map(s => {
    const ny     = gauss(s.marks, mean, std);
    const jitter = Math.sin(s.marks * 7.3) * 0.025;
    const dimmed = filter === "top"  ? s.tier > 1
                 : filter === "risk" ? s.tier < 6
                 : false;
    return { ...s, cx:toX(s.marks), cy:toY(ny + jitter), color:colorOf(s.tier), dimmed };
  });

  useEffect(() => {
    setNodesOn(false);
    setHovered(null);

    const animate = (ref: React.RefObject<SVGPolylineElement | null>, delay: number) => {
      if (!ref.current) return;
      const el  = ref.current;
      const len = 1800;
      el.style.strokeDasharray  = String(len);
      el.style.strokeDashoffset = String(len);
      el.style.transition       = "none";
      setTimeout(() => {
        el.style.transition      = `stroke-dashoffset 1.35s cubic-bezier(0.4,0,0.2,1) ${delay}ms`;
        el.style.strokeDashoffset = "0";
      }, 40);
    };

    animate(path1, 0);
    animate(path2, 110);
    const t = setTimeout(() => setNodesOn(true), 880);
    return () => clearTimeout(t);
  }, [animKey]);

  const strandColor  = T === THEMES.dark ? "#38BDF8" : "#0EA5E9";
  const strandColor2 = T === THEMES.dark ? "#7DD3FC" : "#38BDF8";
  const linkColor    = T === THEMES.dark ? "#1E4A6E" : "#BAE6FD";

  return (
    <>
      <div style={{ position:"relative", width:"100%" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", overflow:"visible" }}>
          <defs>
            <filter id="nshadow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="sg1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={strandColor} stopOpacity="0.06"/>
              <stop offset="35%"  stopColor={strandColor} stopOpacity="0.75"/>
              <stop offset="65%"  stopColor={strandColor} stopOpacity="0.75"/>
              <stop offset="100%" stopColor={strandColor} stopOpacity="0.06"/>
            </linearGradient>
            <linearGradient id="sg2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={strandColor2} stopOpacity="0.03"/>
              <stop offset="40%"  stopColor={strandColor2} stopOpacity="0.35"/>
              <stop offset="60%"  stopColor={strandColor2} stopOpacity="0.35"/>
              <stop offset="100%" stopColor={strandColor2} stopOpacity="0.03"/>
            </linearGradient>
          </defs>

          <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} stroke={T.border} strokeWidth="0.75"/>
          {[-1.5,-1,1,1.5].map(s => (
            <line key={s} x1={toX(mean+s*std)} y1={PAD+8} x2={toX(mean+s*std)} y2={H-PAD}
              stroke={T.border} strokeWidth="0.5" strokeDasharray="2 5"/>
          ))}
          {[0,20,40,60,80,100].map(v => (
            <g key={v}>
              <line x1={toX(v)} y1={H-PAD} x2={toX(v)} y2={H-PAD+4} stroke={T.border} strokeWidth="0.6"/>
              <text x={toX(v)} y={H-PAD+14} fill={T.mutedText} fontSize="9"
                textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{v}</text>
            </g>
          ))}
          {links.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={linkColor} strokeWidth="0.7" opacity="0.5"/>
          ))}
          <polyline ref={path2} points={c2.join(" ")} fill="none"
            stroke="url(#sg2)" strokeWidth="1.6"
            style={{ strokeDasharray:"2000", strokeDashoffset:"2000" }}/>
          <g className="curve-glow">
            <polyline ref={path1} points={c1.join(" ")} fill="none"
              stroke="url(#sg1)" strokeWidth="2.4"
              style={{ strokeDasharray:"2000", strokeDashoffset:"2000" }}/>
          </g>

          {nodesOn && nodes.map((n, i) => {
            const isH = hovered?.name === n.name;
            const r   = isH ? 7 : 4.5;
            return (
              <g key={i} className="node-in" style={{
                cursor:"pointer",
                opacity: n.dimmed ? 0.07 : 1,
                transition:"opacity 0.25s",
                animationDelay:`${i * 52}ms`,
              }}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(null)}
                onDoubleClick={() => { setDetail(n); setHovered(null); }}
              >
                <circle cx={n.cx} cy={n.cy} r={r+5} fill="none"
                  stroke={n.color} strokeWidth="1"
                  opacity={isH ? 0.35 : 0.08}
                  style={{ transition:"all 0.18s" }}/>
                <circle cx={n.cx} cy={n.cy} r={r} fill={n.color}
                  filter="url(#nshadow)"
                  opacity={isH ? 1 : 0.82}
                  style={{ transition:"all 0.18s" }}/>
              </g>
            );
          })}
        </svg>
        {hovered && <HoverCard student={hovered} theme={T}/>}
      </div>
      {detail && <DetailPanel student={detail} onClose={() => setDetail(null)} theme={T}/>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GRAPH MODE (BAR + LINE)
// ═══════════════════════════════════════════════════════════════════════════════
function GraphView({ students, stats, theme }: { students: any[]; stats: any; theme: any }) {
  const T      = theme;
  const sorted = [...students].sort((a, b) => a.marks - b.marks);
  const W = 800, H = 260, PAD = 44;
  const barW   = Math.max(6, Math.floor((W - 2 * PAD) / sorted.length) - 3);
  const toX    = (i: number) => PAD + i * ((W - 2 * PAD) / sorted.length) + barW / 2;
  const toY    = (v: number) => H - PAD - (v / 100) * (H - 2 * PAD);
  const linePts = sorted.map((s, i) => `${toX(i)},${toY(s.marks)}`).join(" ");

  return (
    <div style={{ position:"relative", width:"100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", overflow:"visible" }}>
        <line x1={PAD} y1={PAD} x2={PAD} y2={H-PAD} stroke={T.border} strokeWidth="0.75"/>
        <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} stroke={T.border} strokeWidth="0.75"/>
        {[0,25,50,75,100].map(v => (
          <g key={v}>
            <line x1={PAD} y1={toY(v)} x2={W-PAD} y2={toY(v)}
              stroke={T.border} strokeWidth="0.5" strokeDasharray="2 6"/>
            <text x={PAD-6} y={toY(v)+3.5} fill={T.mutedText} fontSize="9"
              textAnchor="end" fontFamily="'JetBrains Mono', monospace">{v}</text>
          </g>
        ))}
        <line x1={PAD} y1={toY(stats.mean)} x2={W-PAD} y2={toY(stats.mean)}
          stroke="#0EA5E9" strokeWidth="0.8" strokeDasharray="4 4" opacity="0.5"/>
        <text x={W-PAD+4} y={toY(stats.mean)+3.5} fill="#0EA5E9" fontSize="9"
          fontFamily="'JetBrains Mono', monospace">μ</text>
        {sorted.map((s, i) => (
          <rect key={i} x={toX(i)-barW/2} y={toY(s.marks)}
            width={barW} height={toY(0)-toY(s.marks)}
            fill={colorOf(s.tier)} opacity="0.55" rx="2"/>
        ))}
        <polyline points={linePts} fill="none" stroke="#0EA5E9"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75"/>
        {sorted.map((s, i) => (
          <circle key={i} cx={toX(i)} cy={toY(s.marks)} r="3"
            fill={colorOf(s.tier)} opacity="0.9"/>
        ))}
        {sorted.length <= 15 && sorted.map((s, i) => (
          <text key={i} x={toX(i)} y={H-PAD+13} fill={T.mutedText} fontSize="8"
            textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
            {s.name.split(" ")[0]}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GRADE LEGEND
// ═══════════════════════════════════════════════════════════════════════════════
function GradeLegend({ students, theme }: { students: any[]; theme: any }) {
  const T = theme;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"5px 14px", marginBottom:20 }}>
      {["O","A+","A","B+","B","C","D","F"].map(g => {
        const count = students.filter(s => s.grade === g).length;
        if (!count) return null;
        return (
          <div key={g} style={{ display:"flex", alignItems:"center", gap:5,
            fontFamily:"'JetBrains Mono', monospace", fontSize:11 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:colorOf(tierOf(g)), flexShrink:0 }}/>
            <span style={{ color:T.text }}>{g}</span>
            <span style={{ color:T.subtext }}>×{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STATISTICS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function StatisticsPanel({ stats, animKey, theme }: { stats: any; animKey: number; theme: any }) {
  const T = theme;
  const modeDisplay = stats.mode == null
    ? "multimodal"
    : Array.isArray(stats.mode)
      ? stats.mode.slice(0, 3).join(", ") + (stats.mode.length > 3 ? "…" : "")
      : String(stats.mode);

  const items = [
    { label: "students",   value: stats.n,       decimals: 0, suffix: "" },
    { label: "mean μ",     value: stats.mean,     decimals: 1, suffix: "" },
    { label: "std σ",      value: stats.std,      decimals: 2, suffix: "" },
    { label: "median",     value: stats.median,   decimals: 1, suffix: "" },
    { label: "variance σ²",value: stats.variance, decimals: 1, suffix: "" },
    { label: "range",      value: stats.range,    decimals: 0, suffix: "" },
  ];

  return (
    <div style={{ fontFamily:"'JetBrains Mono', monospace" }}>
      <div style={{
        fontSize:9, letterSpacing:"0.2em", color:T.mutedText,
        textTransform:"uppercase", marginBottom:14,
      }}>Statistics</div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
        {items.map((item, i) => (
          <div key={item.label} style={{
            background:T.statBg, border:`1px solid ${T.border}`,
            borderRadius:8, padding:"12px 14px",
            animation:`fadeUp 0.35s ease ${i * 60}ms both`,
          }}>
            <div style={{
              fontSize:8, color:T.mutedText,
              letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:5,
            }}>{item.label}</div>
            <div style={{ fontSize:17, fontWeight:700, color:T.text }}>
              <AnimatedNumber
                key={`${animKey}-${item.label}`}
                target={item.value}
                decimals={item.decimals}
                duration={800}
                delay={i * 60}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Mode */}
      <div style={{
        background:T.statBg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:"10px 14px", marginBottom:8,
      }}>
        <div style={{ fontSize:8, color:T.mutedText, letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:4 }}>mode</div>
        <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{modeDisplay}</div>
      </div>

      {/* Percentiles */}
      <div style={{
        background:T.statBg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:"10px 14px",
      }}>
        <div style={{ fontSize:8, color:T.mutedText, letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:8 }}>percentiles</div>
        <div style={{ display:"flex", gap:16 }}>
          {[["p25", stats.p25], ["p75", stats.p75], ["p90", stats.p90]].map(([l, v]) => (
            <div key={String(l)}>
              <div style={{ fontSize:8, color:T.mutedText, marginBottom:2 }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text }}>
                <AnimatedNumber key={`${animKey}-${l}`} target={Number(v)} decimals={1} duration={700} delay={400}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INSIGHTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function InsightsPanel({ students, stats, visible, theme }: {
  students: any[]; stats: any; visible: boolean; theme: any;
}) {
  const T     = theme;
  const lines = generateInsights(students, stats);

  // Per-student trend summary
  const trendCounts = { improving: 0, declining: 0, stable: 0, volatile: 0 };
  students.forEach(s => {
    const t = trendInsight(s.history).label;
    if (t === "consistently improving")  trendCounts.improving++;
    else if (t === "declining trend")    trendCounts.declining++;
    else if (t === "high variance")      trendCounts.volatile++;
    else                                 trendCounts.stable++;
  });

  return (
    <div style={{ fontFamily:"'JetBrains Mono', monospace" }}>
      <div style={{
        fontSize:9, letterSpacing:"0.2em", color:T.mutedText,
        textTransform:"uppercase", marginBottom:14,
      }}>Insights</div>

      {/* Trend breakdown */}
      <div style={{
        background:T.statBg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:"12px 14px", marginBottom:12,
      }}>
        <div style={{ fontSize:8, color:T.mutedText, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>trend breakdown</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {([
            ["improving",  trendCounts.improving,  "#16A34A"],
            ["declining",  trendCounts.declining,  "#DC2626"],
            ["stable",     trendCounts.stable,     "#0891B2"],
            ["volatile",   trendCounts.volatile,   "#F59E0B"],
          ] as [string, number, string][]).map(([label, count, color]) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:color, flexShrink:0 }}/>
              <span style={{ fontSize:10, color:T.subtext }}>{label}</span>
              <span style={{ fontSize:10, fontWeight:700, color:T.text, marginLeft:"auto" }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insight lines */}
      <div style={{
        background:T.statBg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:"12px 14px",
      }}>
        <div style={{ fontSize:8, color:T.mutedText, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>analysis</div>
        {lines.map((line, i) => (
          <div key={i} style={{
            display:"flex", alignItems:"baseline", gap:8,
            marginBottom:7, fontSize:11, color:T.text, fontWeight:700,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(8px)",
            transition:`opacity 0.4s ease ${i*80+200}ms, transform 0.4s ease ${i*80+200}ms`,
          }}>
            <span style={{ color:T.mutedText, flexShrink:0 }}>—</span>{line}
          </div>
        ))}
        <div style={{
          marginTop:12, fontSize:10, color:T.mutedText,
          borderTop:`1px solid ${T.border}`, paddingTop:10,
          opacity: visible ? 1 : 0,
          transition:`opacity 0.4s ease ${lines.length*80+350}ms`,
        }}>
          μ {stats.mean.toFixed(1)}&nbsp;&nbsp;σ {stats.std.toFixed(1)}&nbsp;&nbsp;n {stats.n}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HISTORY SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════
function HistorySidebar({ history, theme, onSelectSession }: {
  history: any[]; theme: any; onSelectSession: (s: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const T = theme;

  if (!history || history.length === 0) return null;

  return (
    <>
      <button onClick={() => setOpen(!open)} style={{
        position:"fixed", right:0, top:"50%",
        transform:"translateY(-50%)",
        background:T.cardBg, border:`1px solid ${T.border}`,
        borderRight:"none", borderRadius:"8px 0 0 8px",
        padding:"12px 8px", cursor:"pointer",
        fontSize:10, color:T.subtext,
        fontFamily:"'JetBrains Mono', monospace",
        transition:"all 0.2s", zIndex:50,
        writingMode:"vertical-rl", letterSpacing:"0.1em",
      }}
        onMouseEnter={e => (e.currentTarget.style.color = T.text)}
        onMouseLeave={e => (e.currentTarget.style.color = T.subtext)}
      >
        HISTORY ({history.length})
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.25)", zIndex:59,
          }}/>
          <div style={{
            position:"fixed", right:0, top:0, bottom:0, width:330,
            background:T.cardBg, borderLeft:`1px solid ${T.border}`,
            padding:"24px", overflowY:"auto", zIndex:60,
            boxShadow:"-4px 0 32px rgba(0,0,0,0.15)",
            fontFamily:"'JetBrains Mono', monospace",
            animation:"slideInRight 0.25s ease",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.text, letterSpacing:"0.06em" }}>Past Sessions</div>
              <button onClick={() => setOpen(false)} style={{
                background:"none", border:"none", cursor:"pointer",
                color:T.subtext, fontSize:20, lineHeight:1,
              }}>×</button>
            </div>

            {history.map((session, i) => (
              <div key={i}
                onClick={() => { onSelectSession(session); setOpen(false); }}
                style={{
                  background:T.secondary, border:`1px solid ${T.border}`,
                  borderRadius:7, padding:"12px 14px", marginBottom:10,
                  cursor:"pointer", transition:"all 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = T.subtext;
                  (e.currentTarget as HTMLDivElement).style.background  = T.tag;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
                  (e.currentTarget as HTMLDivElement).style.background  = T.secondary;
                }}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:T.text }}>{session.subject}</div>
                  <div style={{
                    fontSize:8, color:"#0EA5E9",
                    background: T === THEMES.dark ? "#0C2A40" : "#E0F2FE",
                    padding:"2px 7px", borderRadius:4,
                  }}>view →</div>
                </div>
                <div style={{ fontSize:9, color:T.subtext, display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span>{session.n_students} students</span>
                  <span>μ {session.mean?.toFixed(1)}</span>
                </div>
                <div style={{
                  fontSize:9, color:T.mutedText, marginTop:6, paddingTop:6,
                  borderTop:`1px solid ${T.border}`,
                }}>
                  Top: {session.topper_name} ({session.topper_marks})
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ERROR MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════
function ErrorMessage({ message, onDismiss, theme }: { message: string; onDismiss: () => void; theme: any }) {
  const T = theme;
  return (
    <div style={{
      background: T === THEMES.dark ? "#2D1414" : "#FEE2E2",
      border:`1px solid ${T === THEMES.dark ? "#5C1F1F" : "#FCA5A5"}`,
      borderRadius:8, padding:"16px 20px", marginBottom:24,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      fontFamily:"'JetBrains Mono', monospace", animation:"fadeUp 0.3s ease",
    }}>
      <div>
        <div style={{ fontSize:11, fontWeight:600, color:"#EF4444", marginBottom:4, letterSpacing:"0.08em" }}>ERROR</div>
        <div style={{ fontSize:12, color: T === THEMES.dark ? "#FCA5A5" : "#7F1D1D" }}>{message}</div>
      </div>
      <button onClick={onDismiss} style={{
        background:"none", border:"none", cursor:"pointer",
        color:"#EF4444", fontSize:18, lineHeight:1,
      }}>×</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FORM INPUT
// ═══════════════════════════════════════════════════════════════════════════════
function RowInput({ index, name, marks, onChange, onRemove, active, onFocus, theme }: any) {
  const T = theme;
  return (
    <div onFocus={onFocus} style={{
      display:"grid", gridTemplateColumns:"16px 1fr 80px 20px",
      gap:"0 10px", alignItems:"end",
      padding:"7px 0",
      borderBottom:`1px solid ${active ? "#0EA5E9" : "transparent"}`,
      transition:"border-color 0.15s",
    }}>
      <span style={{
        fontFamily:"'JetBrains Mono', monospace", fontSize:11,
        color: active ? "#0EA5E9" : T.mutedText,
        paddingBottom:2, transition:"color 0.15s", alignSelf:"end",
      }}>›</span>
      <input value={name} onChange={e => onChange(index, "name", e.target.value)}
        placeholder={`student ${index + 1}`}
        style={{ background:"transparent", border:"none", outline:"none",
          borderBottom:`1px solid ${T.border}`, fontFamily:"'JetBrains Mono', monospace",
          fontSize:12, color:T.text, padding:"4px 0", width:"100%" }}/>
      <input value={marks} onChange={e => onChange(index, "marks", e.target.value)}
        placeholder="0–100" type="number" min="0" max="100"
        style={{ background:"transparent", border:"none", outline:"none",
          borderBottom:`1px solid ${T.border}`, fontFamily:"'JetBrains Mono', monospace",
          fontSize:12, color:T.text, padding:"4px 0", textAlign:"right", width:"100%" }}/>
      <button onClick={() => onRemove(index)} style={{
        background:"none", border:"none", cursor:"pointer",
        color:T.mutedText, fontSize:14, padding:0, alignSelf:"end", paddingBottom:4,
        transition:"color 0.15s", lineHeight:1,
      }}
        onMouseEnter={e => ((e.target as HTMLElement).style.color = "#EF4444")}
        onMouseLeave={e => ((e.target as HTMLElement).style.color = T.mutedText)}
      >×</button>
    </div>
  );
}

function FormInput({ onAnalyze, theme }: { onAnalyze: (d: any) => void; theme: any }) {
  const T = theme;
  const [subject, setSubject] = useState("");
  const [rows, setRows]       = useState(
    Array.from({ length: 5 }, (_, i) => ({ name: `Student ${i + 1}`, marks: "" }))
  );
  const [active, setActive] = useState<number | null>(null);

  const update  = (i: number, field: string, val: string) =>
    setRows(r => r.map((row, j) => j === i ? { ...row, [field]: val } : row));
  const addRow  = () => setRows(r => [...r, { name: `Student ${r.length + 1}`, marks: "" }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, j) => j !== i));

  const submit = () => {
    const valid = rows.filter(r => r.name && r.marks !== "" && !isNaN(+r.marks) && +r.marks >= 0 && +r.marks <= 100);
    if (valid.length < 2) return;
    onAnalyze({ subject: subject || "Analysis", names: valid.map(r => r.name), marks: valid.map(r => +r.marks) });
  };

  const loadDemo = () => onAnalyze({
    subject:  DEMO_RAW.subject,
    names:    DEMO_RAW.students.map(s => s.name),
    marks:    DEMO_RAW.students.map(s => s.marks),
    histories: DEMO_RAW.students.map(s => s.history),
  });

  return (
    <div style={{ maxWidth:480, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"end", gap:10,
        borderBottom:`1px solid ${T.border}`, marginBottom:24, paddingBottom:6 }}>
        <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:9, color:T.mutedText,
          letterSpacing:"0.15em", textTransform:"uppercase", paddingBottom:3, flexShrink:0 }}>subject</span>
        <input value={subject} onChange={e => setSubject(e.target.value)}
          placeholder="e.g. Data Structures"
          style={{ background:"transparent", border:"none", outline:"none",
            fontFamily:"'JetBrains Mono', monospace", fontSize:12, color:T.text, width:"100%", padding:"4px 0" }}/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"16px 1fr 80px 20px", gap:"0 10px", marginBottom:4 }}>
        <span/>
        {["name","marks"].map(h => (
          <span key={h} style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:9, color:T.mutedText,
            letterSpacing:"0.14em", textTransform:"uppercase", textAlign: h === "marks" ? "right" : "left" }}>{h}</span>
        ))}
        <span/>
      </div>
      <div style={{ maxHeight:240, overflowY:"auto", marginBottom:12 }}>
        {rows.map((r, i) => (
          <RowInput key={i} index={i} name={r.name} marks={r.marks}
            onChange={update} onRemove={removeRow}
            active={active === i} onFocus={() => setActive(i)} theme={T}/>
        ))}
      </div>
      <button onClick={addRow} style={{
        background:"none", border:"none", cursor:"pointer",
        fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:T.subtext,
        padding:"5px 0", marginBottom:22, transition:"color 0.15s",
      }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = T.text)}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = T.subtext)}
      >+ add row</button>

      <div style={{ display:"flex", gap:10 }}>
        <button onClick={loadDemo} style={{
          flex:1, background:"none", border:`1px solid ${T.border}`,
          borderRadius:5, color:T.subtext, padding:"9px",
          cursor:"pointer", fontFamily:"'JetBrains Mono', monospace",
          fontSize:11, transition:"all 0.15s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.subtext; (e.currentTarget as HTMLElement).style.color = T.text; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border;  (e.currentTarget as HTMLElement).style.color = T.subtext; }}
        >demo</button>
        <button onClick={submit} style={{
          flex:2.5,
          background: T === THEMES.dark ? "#E8EFF7" : "#1A1A1A",
          border:"none", borderRadius:5,
          color: T === THEMES.dark ? "#0B0F14" : "#F5EFE6",
          padding:"9px", cursor:"pointer",
          fontFamily:"'JetBrains Mono', monospace",
          fontSize:11, fontWeight:600, transition:"opacity 0.15s",
        }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        >run analysis →</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HEADER CONTROLS
// ═══════════════════════════════════════════════════════════════════════════════
function ThemeToggle({ isDark, onToggle, theme }: { isDark: boolean; onToggle: () => void; theme: any }) {
  const T = theme;
  return (
    <button onClick={onToggle} style={{
      background:"none", border:`1px solid ${T.border}`,
      borderRadius:5, color:T.subtext, padding:"5px 13px",
      cursor:"pointer", fontSize:10,
      fontFamily:"'JetBrains Mono', monospace",
      letterSpacing:"0.06em", transition:"all 0.2s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.subtext; (e.currentTarget as HTMLElement).style.color = T.text; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border;  (e.currentTarget as HTMLElement).style.color = T.subtext; }}
    >{isDark ? "light" : "dark"}</button>
  );
}

function ModeToggle({ mode, onToggle, theme }: { mode: string; onToggle: (m: string) => void; theme: any }) {
  const T = theme;
  return (
    <div style={{ display:"inline-flex", border:`1px solid ${T.border}`, borderRadius:5, overflow:"hidden", fontSize:10 }}>
      {["curve","graph"].map(m => (
        <button key={m} onClick={() => onToggle(m)} style={{
          background: mode === m ? (T === THEMES.dark ? "#1E2D3D" : "#EDE4D3") : "transparent",
          border:"none", color: mode === m ? T.text : T.subtext,
          padding:"5px 13px", cursor:"pointer",
          fontFamily:"'JetBrains Mono', monospace",
          fontSize:10, transition:"all 0.18s", letterSpacing:"0.04em",
        }}>{m}</button>
      ))}
    </div>
  );
}

function FilterPills({ filter, setFilter, theme }: { filter: string; setFilter: (f: string) => void; theme: any }) {
  const T = theme;
  const options: [string, string, string][] = [
    ["all",  "all",  T.subtext],
    ["top",  "top performers (O/A+)",  "#F59E0B"],
    ["risk", "at-risk (D/F)", "#DC2626"],
  ];
  return (
    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
      {options.map(([v, l, activeColor]) => {
        const isActive = filter === v;
        return (
          <button key={v} onClick={() => setFilter(v)} style={{
            background: isActive
              ? (v === "top"  ? (T === THEMES.dark ? "#2A1A00" : "#FEF3C7")
                : v === "risk" ? (T === THEMES.dark ? "#2A0A0A" : "#FEE2E2")
                : T === THEMES.dark ? "#1E2D3D" : "#EDE4D3")
              : "transparent",
            border:`1px solid ${isActive ? activeColor : T.border}`,
            borderRadius:5,
            color: isActive ? activeColor : T.subtext,
            padding:"4px 12px", cursor:"pointer",
            fontSize:10, fontFamily:"'JetBrains Mono', monospace",
            transition:"all 0.15s", fontWeight: isActive ? 600 : 400,
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [isDark,          setIsDark]          = useState(false);
  const [processed,       setProcessed]       = useState<any>(null);
  const [filter,          setFilter]          = useState("all");
  const [mode,            setMode]            = useState("curve");
  const [animKey,         setAnimKey]         = useState(0);
  const [loading,         setLoading]         = useState(false);
  const [insightsVisible, setInsightsVisible] = useState(false);
  const [vizVisible,      setVizVisible]      = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [history,         setHistory]         = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('analysis_history') || '[]');
    } catch { return []; }
  });
  const [historySession,  setHistorySession]  = useState<any>(null);

  const T = isDark ? THEMES.dark : THEMES.light;

  const handleModeToggle = useCallback((newMode: string) => {
    if (newMode === mode) return;
    setVizVisible(false);
    setTimeout(() => { setMode(newMode); setVizVisible(true); }, 220);
  }, [mode]);

  function runAnalysis(d: { subject: string; names: string[]; marks: number[]; histories?: number[][] }) {
    // Client-side analysis — no server needed
    const result = processDataset(d.subject, d.names, d.marks, d.histories);
    setProcessed(result);
    setAnimKey(k => k + 1);
    setFilter("all");
    setMode("curve");
    setVizVisible(true);
    setLoading(false);
    setTimeout(() => setInsightsVisible(true), 1100);

    // Add to local history
    const topIdx = d.marks.indexOf(Math.max(...d.marks));
    const newEntry = {
      subject:      d.subject,
      n_students:   d.marks.length,
      mean:         result.stats.mean,
      std:          result.stats.std,
      topper_name:  d.names[topIdx],
      topper_marks: d.marks[topIdx],
      _processed:   result, // store full result for modal
    };
    setHistory(prev => {
      const newHistory = [newEntry, ...prev].slice(0, 20);
      try { localStorage.setItem('analysis_history', JSON.stringify(newHistory)); } catch { /* storage full */ }
      return newHistory;
    });

    // Also try server (optional, graceful fallback)
    (async () => {
      try {
        await fetch("http://localhost:5000/api/analyze", {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ subject:d.subject, names:d.names, marks:d.marks }),
          signal: AbortSignal.timeout(3000),
        });
      } catch { /* no server — that's fine */ }
    })();
  }

  async function handleAnalyze(d: any) {
    setLoading(true);
    setInsightsVisible(false);
    setError(null);
    // Small delay for UX feedback
    setTimeout(() => runAnalysis(d), 350);
  }

  function handleSelectHistorySession(session: any) {
    if (session._processed) {
      setHistorySession(session);
    }
    // silently ignore sessions without full data
  }

  return (
    <div style={{
      minHeight:"100vh", background:T.bg, color:T.text,
      fontFamily:"'JetBrains Mono', monospace",
      transition:"background 0.35s ease, color 0.35s ease",
    }}>
      <style>{`
        input::placeholder { color: ${T.mutedText}; opacity: 0.7; }
      `}</style>

      {/* History Sidebar */}
      <HistorySidebar history={history} theme={T} onSelectSession={handleSelectHistorySession}/>

      {/* History Analysis Modal */}
      {historySession && (
        <HistoryAnalysisModal session={historySession} onClose={() => setHistorySession(null)} theme={T}/>
      )}

      {/* ── HEADER ── */}
      <div style={{
        borderBottom:`1px solid ${T.border}`,
        padding:"15px 36px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        background:T.headerBg,
        transition:"background 0.35s ease, border-color 0.35s ease",
      }}>
        <div>
          <div style={{ fontSize:9, letterSpacing:"0.22em", color:T.mutedText, textTransform:"uppercase", marginBottom:2 }}>
            Grading Intelligence
          </div>
          <div style={{ fontSize:15, fontWeight:700, letterSpacing:"-0.02em", color:T.text }}>
            Bell Curve Analyzer
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {processed && <ModeToggle mode={mode} onToggle={handleModeToggle} theme={T}/>}
          <ThemeToggle isDark={isDark} onToggle={() => setIsDark(d => !d)} theme={T}/>
          {processed && (
            <button onClick={() => { setProcessed(null); setInsightsVisible(false); }} style={{
              background:"none", border:`1px solid ${T.border}`,
              borderRadius:5, color:T.subtext, padding:"5px 13px",
              cursor:"pointer", fontSize:10,
              fontFamily:"'JetBrains Mono', monospace", transition:"all 0.15s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.text; (e.currentTarget as HTMLElement).style.borderColor = T.subtext; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.subtext; (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
            >← reset</button>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ maxWidth:960, margin:"0 auto", padding:"40px 24px" }}>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} theme={T}/>}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign:"center", padding:"60px 0", color:T.mutedText, fontSize:11, letterSpacing:"0.14em" }}>
            <div style={{ marginBottom:12 }}>computing...</div>
            <div style={{ width:40, height:3, background:T.border, margin:"0 auto", borderRadius:2, overflow:"hidden" }}>
              <div style={{ width:"50%", height:"100%", background:"#0EA5E9", animation:"loadSlide 1.2s ease-in-out infinite" }}/>
            </div>
          </div>
        )}

        {/* INPUT VIEW */}
        {!loading && !processed && (
          <div className="fade-up">
            <div style={{ textAlign:"center", marginBottom:44 }}>
              <div style={{ fontSize:11, color:T.subtext, marginBottom:4 }}>enter student data below</div>
              <div style={{ fontSize:10, color:T.mutedText }}>
                double-click a node on the curve to view student trend &amp; analysis
              </div>
            </div>
            <FormInput onAnalyze={handleAnalyze} theme={T}/>
          </div>
        )}

        {/* RESULT VIEW */}
        {!loading && processed && (
          <div className="fade-up">
            {/* Subject + filter row */}
            <div style={{
              display:"flex", alignItems:"baseline", justifyContent:"space-between",
              flexWrap:"wrap", gap:12, marginBottom:18,
            }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{processed.subject}</div>
                <div style={{ fontSize:10, color:T.subtext, marginTop:2 }}>{processed.students.length} students</div>
              </div>
              {mode === "curve" && (
                <FilterPills filter={filter} setFilter={setFilter} theme={T}/>
              )}
            </div>

            {(() => {
              const filteredStudents = filter === "top"
                ? processed.students.filter((s: any) => s.tier <= 1)
                : filter === "risk"
                ? processed.students.filter((s: any) => s.tier >= 6)
                : processed.students;
              return (
                <>
                  <GradeLegend students={filteredStudents} theme={T}/>

                  {filter !== "all" && (
                    <div style={{
                      fontSize: 10, color: filter === "top" ? "#F59E0B" : "#DC2626",
                      fontFamily: "'JetBrains Mono', monospace",
                      marginBottom: 12, fontWeight: 600,
                    }}>
                      showing {filteredStudents.length} of {processed.students.length} students
                    </div>
                  )}

                  {/* VISUALIZATION */}
                  <div style={{
                    opacity: vizVisible ? 1 : 0,
                    transform: vizVisible ? "translateY(0)" : "translateY(6px)",
                    transition:"opacity 0.22s ease, transform 0.22s ease",
                  }}>
                    {mode === "curve" ? (
                      <DNACurve students={filteredStudents} stats={processed.stats}
                        filter={"all"} animKey={animKey} theme={T}/>
                    ) : (
                      <GraphView students={filteredStudents} stats={processed.stats} theme={T}/>
                    )}
                  </div>

                  <div style={{
                    textAlign:"center", color:T.mutedText, fontSize:9,
                    letterSpacing:"0.12em", marginTop:6, marginBottom:28,
                    fontFamily:"'JetBrains Mono', monospace",
                  }}>
                    {mode === "curve"
                      ? "hover to inspect · double-click for trend & history analysis"
                      : "sorted performance · bars colored by grade tier"}
                  </div>

                  {/* ── STATS + INSIGHTS SIDE BY SIDE ── */}
                  <div style={{
                    display:"grid",
                    gridTemplateColumns:"1fr 1fr",
                    gap:20,
                  }}>
                    <StatisticsPanel stats={processed.stats} animKey={animKey} theme={T}/>
                    <InsightsPanel students={filteredStudents} stats={processed.stats}
                      visible={insightsVisible} theme={T}/>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}