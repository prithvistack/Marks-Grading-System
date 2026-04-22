import { useState, useMemo, useRef, useEffect } from "react";

// ── grade logic (mirrors your Python) ──────────────────────────────────────
const GRADE_ORDER = ["O","A+","A","B+","B","C","D","F"];

function computeStats(marks) {
  const n = marks.length;
  const mean = marks.reduce((a,b)=>a+b,0)/n;
  const variance = marks.reduce((a,b)=>a+(b-mean)**2,0)/n;
  const std = Math.sqrt(variance);
  const sorted = [...marks].sort((a,b)=>a-b);
  const median = n%2===0 ? (sorted[n/2-1]+sorted[n/2])/2 : sorted[Math.floor(n/2)];
  const p25 = sorted[Math.floor(n*0.25)];
  const p75 = sorted[Math.floor(n*0.75)];
  const p90 = sorted[Math.floor(n*0.90)];
  return { mean, std, median, variance, min:sorted[0], max:sorted[n-1],
           range:sorted[n-1]-sorted[0], p25, p75, p90 };
}

function assignGrade(score, mean, std) {
  if (score >= mean + 1.5*std) return { grade:"O",  cat:"Outstanding",  pts:10, tier:0 };
  if (score >= mean + 1.0*std) return { grade:"A+", cat:"Excellent",     pts:9,  tier:1 };
  if (score >= mean + 0.5*std) return { grade:"A",  cat:"Very Good",     pts:8,  tier:2 };
  if (score >= mean + 0.0*std) return { grade:"B+", cat:"Good",          pts:7,  tier:3 };
  if (score >= mean - 0.5*std) return { grade:"B",  cat:"Above Average", pts:6,  tier:4 };
  if (score >= mean - 1.0*std) return { grade:"C",  cat:"Average",       pts:5,  tier:5 };
  if (score >= mean - 1.5*std) return { grade:"D",  cat:"Below Average", pts:4,  tier:6 };
  return                               { grade:"F",  cat:"Fail",          pts:0,  tier:7 };
}

function zScore(score, mean, std) {
  return std === 0 ? 0 : (score - mean) / std;
}

// ── colour palette ──────────────────────────────────────────────────────────
const TIER_COLORS = [
  "#FFD700", // O  – gold
  "#FFA500", // A+ – amber
  "#00E5FF", // A  – cyan
  "#4FC3F7", // B+ – sky blue
  "#66BB6A", // B  – green
  "#FFF176", // C  – yellow
  "#FF7043", // D  – orange-red
  "#EF5350", // F  – red
];

function nodeColor(tier) { return TIER_COLORS[tier]; }

// ── demo data ──────────────────────────────────────────────────────────────
const DEMO = {
  subject: "Computer Engineering",
  names: ["Aarav Shah","Priya Nair","Rohit Verma","Sneha Patil","Kiran Rao",
          "Meera Joshi","Arjun Kumar","Divya Menon","Yash Gupta","Ananya Singh",
          "Rahul Desai","Pooja Iyer","Nikhil More","Tanya Bose","Sameer Khan"],
  marks: [88,72,95,61,78,83,55,90,67,74,48,85,70,92,63],
};

// ── gaussian PDF ───────────────────────────────────────────────────────────
function gauss(x, mean, std) {
  return Math.exp(-0.5*((x-mean)/std)**2);
}

// ═══════════════════════════════════════════════════════════════════════════
//  DNA BELL CURVE (SVG)
// ═══════════════════════════════════════════════════════════════════════════
function DNACurve({ students, stats, filter }) {
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);
  const W = 800, H = 340, PAD = 48;

  const { mean, std } = stats;
  const xMin = mean - 3.2*std, xMax = mean + 3.2*std;
  const toX = v => PAD + ((v-xMin)/(xMax-xMin))*(W-2*PAD);
  const toY = v => H - PAD - v*(H-2*PAD);

  // smooth curve path
  const pts = 260;
  const curve1 = Array.from({length:pts}, (_,i) => {
    const x = xMin + (i/(pts-1))*(xMax-xMin);
    const y = gauss(x, mean, std);
    return `${toX(x)},${toY(y)}`;
  });
  // second strand (DNA offset)
  const curve2 = Array.from({length:pts}, (_,i) => {
    const x = xMin + (i/(pts-1))*(xMax-xMin);
    const y = gauss(x, mean, std) * 0.88 - 0.04;
    return `${toX(x)},${toY(Math.max(0,y))}`;
  });

  // cross-links for DNA feel
  const links = Array.from({length:18}, (_,i) => {
    const x = xMin + ((i+1)/19)*(xMax-xMin);
    const y1 = gauss(x, mean, std);
    const y2 = Math.max(0, y1*0.88-0.04);
    return { x1:toX(x), y1:toY(y1), x2:toX(x), y2:toY(y2) };
  });

  // student nodes
  const nodes = students.map((s) => {
    const normY = gauss(s.marks, mean, std);
    const jitter = (Math.sin(s.marks*7.3)*0.03); // tiny vertical noise
    return {
      ...s,
      cx: toX(s.marks),
      cy: toY(normY + jitter),
      color: nodeColor(s.tier),
      dimmed: filter === "top"
        ? s.tier > 2
        : filter === "risk"
        ? s.tier < 6
        : false,
    };
  });

  return (
    <div style={{position:"relative", width:"100%"}}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{width:"100%", overflow:"visible"}}
      >
        <defs>
          {/* glow filters */}
          <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="strand1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#00E5FF" stopOpacity="0.2"/>
            <stop offset="40%"  stopColor="#00E5FF" stopOpacity="0.9"/>
            <stop offset="60%"  stopColor="#00E5FF" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.2"/>
          </linearGradient>
          <linearGradient id="strand2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#0288D1" stopOpacity="0.1"/>
            <stop offset="40%"  stopColor="#0288D1" stopOpacity="0.7"/>
            <stop offset="60%"  stopColor="#0288D1" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#0288D1" stopOpacity="0.1"/>
          </linearGradient>
        </defs>

        {/* grade zone fills */}
        {[
          { lo: mean+1.5*std, hi: xMax,          color:"#FFD700", opacity:0.05 },
          { lo: mean+1.0*std, hi: mean+1.5*std,  color:"#FFA500", opacity:0.05 },
          { lo: mean+0.5*std, hi: mean+1.0*std,  color:"#00E5FF", opacity:0.04 },
          { lo: mean,         hi: mean+0.5*std,  color:"#4FC3F7", opacity:0.04 },
          { lo: mean-0.5*std, hi: mean,          color:"#66BB6A", opacity:0.04 },
          { lo: mean-1.0*std, hi: mean-0.5*std,  color:"#FFF176", opacity:0.04 },
          { lo: mean-1.5*std, hi: mean-1.0*std,  color:"#FF7043", opacity:0.05 },
          { lo: xMin,         hi: mean-1.5*std,  color:"#EF5350", opacity:0.06 },
        ].map((z,i) => (
          <rect key={i}
            x={toX(z.lo)} y={PAD}
            width={toX(z.hi)-toX(z.lo)}
            height={H-2*PAD}
            fill={z.color} opacity={z.opacity}
          />
        ))}

        {/* cross-links */}
        {links.map((l,i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="#00E5FF" strokeWidth="0.8" opacity="0.25"/>
        ))}

        {/* strand 2 (background) */}
        <polyline
          points={curve2.join(" ")}
          fill="none"
          stroke="url(#strand2)"
          strokeWidth="2"
          filter="url(#glow-cyan)"
        />

        {/* strand 1 (foreground) */}
        <polyline
          points={curve1.join(" ")}
          fill="none"
          stroke="url(#strand1)"
          strokeWidth="2.5"
          filter="url(#glow-cyan)"
        />

        {/* mean line */}
        <line
          x1={toX(mean)} y1={PAD}
          x2={toX(mean)} y2={H-PAD}
          stroke="#00E5FF" strokeWidth="1" strokeDasharray="4 4" opacity="0.4"
        />
        <text x={toX(mean)} y={PAD-6} fill="#00E5FF" fontSize="10"
          textAnchor="middle" opacity="0.7" fontFamily="monospace">μ={mean.toFixed(1)}</text>

        {/* ±1σ ±1.5σ markers */}
        {[-1.5,-1,1,1.5].map(s => (
          <line key={s}
            x1={toX(mean+s*std)} y1={PAD+6}
            x2={toX(mean+s*std)} y2={H-PAD}
            stroke="#ffffff" strokeWidth="0.6" strokeDasharray="2 5" opacity="0.18"
          />
        ))}

        {/* axis */}
        <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD}
          stroke="#ffffff" strokeWidth="0.5" opacity="0.2"/>

        {/* x-axis labels */}
        {[0,20,40,60,80,100].map(v => (
          <g key={v}>
            <line x1={toX(v)} y1={H-PAD} x2={toX(v)} y2={H-PAD+4}
              stroke="#fff" strokeWidth="0.5" opacity="0.3"/>
            <text x={toX(v)} y={H-PAD+14} fill="#ffffff" fontSize="9"
              textAnchor="middle" opacity="0.4" fontFamily="monospace">{v}</text>
          </g>
        ))}

        {/* student nodes */}
        {nodes.map((n,i) => (
          <g key={i}
            style={{cursor:"pointer", transition:"opacity 0.3s"}}
            opacity={n.dimmed ? 0.15 : 1}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* outer glow ring */}
            <circle cx={n.cx} cy={n.cy} r={hovered?.name===n.name ? 11 : 8}
              fill="none" stroke={n.color} strokeWidth="1.5"
              opacity={hovered?.name===n.name ? 0.5 : 0.25}
              style={{transition:"r 0.2s"}}
            />
            {/* core dot */}
            <circle cx={n.cx} cy={n.cy} r={hovered?.name===n.name ? 6 : 4}
              fill={n.color}
              filter="url(#node-glow)"
              opacity={hovered?.name===n.name ? 1 : 0.85}
              style={{transition:"r 0.2s"}}
            />
          </g>
        ))}
      </svg>

      {/* hover card */}
      {hovered && (
        <HoverCard student={hovered} />
      )}
    </div>
  );
}

function HoverCard({ student }) {
  return (
    <div style={{
      position:"absolute", top:10, right:10,
      background:"rgba(10,20,35,0.88)",
      backdropFilter:"blur(16px)",
      border:`1px solid ${student.color}44`,
      borderRadius:12,
      padding:"16px 20px",
      minWidth:200,
      boxShadow:`0 0 24px ${student.color}33`,
      pointerEvents:"none",
      zIndex:20,
      fontFamily:"'JetBrains Mono', monospace",
    }}>
      <div style={{color:student.color, fontWeight:700, fontSize:15, marginBottom:8}}>
        {student.name}
      </div>
      <Row label="Marks"    value={student.marks} />
      <Row label="Z-score"  value={(student.z >= 0 ? "+" : "") + student.z.toFixed(2)} />
      <Row label="Grade"    value={student.grade} color={student.color} />
      <Row label="Category" value={student.cat} />
      <Row label="Rank"     value={`#${student.rank}`} />
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{display:"flex", justifyContent:"space-between",
      gap:16, marginBottom:4, fontSize:12}}>
      <span style={{color:"#607D8B"}}>{label}</span>
      <span style={{color: color || "#E0E0E0", fontWeight:600}}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  INSIGHT CARDS
// ═══════════════════════════════════════════════════════════════════════════
function InsightCards({ students, stats }) {
  const { mean, std, median, variance } = stats;

  const topCount = students.filter(s=>s.tier<=1).length;
  const riskCount = students.filter(s=>s.marks<40).length;
  const skew = ((mean-median)/std).toFixed(2);
  const skewLabel = Math.abs(skew) < 0.1 ? "Symmetric"
    : skew > 0 ? "Right-skewed" : "Left-skewed";
  const skewNote = skew > 0
    ? "stronger high-performers"
    : skew < 0
    ? "more students below average"
    : "even distribution";

  const cvPercent = ((std/mean)*100).toFixed(1);
  const spreadLabel = cvPercent < 15 ? "tight cluster" : cvPercent < 25 ? "moderate spread" : "wide spread";

  const cards = [
    {
      icon:"◈", title:"Class Structure",
      accent:"#00E5FF",
      body:`Scores show a ${spreadLabel} — CV ${cvPercent}%. Mean ${mean.toFixed(1)}, σ ${std.toFixed(1)}.`,
    },
    {
      icon:"◆", title:"Top Performers",
      accent:"#FFD700",
      body:`${topCount} student${topCount!==1?"s":""} in O/A+ tier — significantly above class average.`,
    },
    {
      icon:"▲", title:"Risk Zone",
      accent:"#EF5350",
      body: riskCount > 0
        ? `${riskCount} student${riskCount!==1?"s":""} below safe threshold (< 40 marks). Needs intervention.`
        : `No students below the 40-mark threshold. Class is on track.`,
    },
    {
      icon:"◉", title:"Distribution Shape",
      accent:"#66BB6A",
      body:`${skewLabel} distribution (skew ≈ ${skew}) — ${skewNote}.`,
    },
  ];

  return (
    <div style={{
      display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",
      gap:16, marginTop:32,
    }}>
      {cards.map((c,i) => (
        <InsightCard key={i} {...c} delay={i*80} />
      ))}
    </div>
  );
}

function InsightCard({ icon, title, accent, body, delay }) {
  const [lifted, setLifted] = useState(false);
  return (
    <div
      onMouseEnter={()=>setLifted(true)}
      onMouseLeave={()=>setLifted(false)}
      style={{
        background:"rgba(255,255,255,0.03)",
        border:`1px solid ${accent}22`,
        borderRadius:14,
        padding:"20px 22px",
        cursor:"default",
        transform: lifted ? "translateY(-4px)" : "translateY(0)",
        boxShadow: lifted ? `0 8px 32px ${accent}22` : "none",
        transition:"all 0.25s ease",
        animationDelay:`${delay}ms`,
        fontFamily:"'JetBrains Mono', monospace",
      }}
    >
      <div style={{color:accent, fontSize:20, marginBottom:10}}>{icon}</div>
      <div style={{color:"#E0E0E0", fontSize:12, fontWeight:700,
        letterSpacing:"0.08em", marginBottom:8, textTransform:"uppercase"}}>{title}</div>
      <div style={{color:"#78909C", fontSize:12, lineHeight:1.6}}>{body}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  GRADE LEGEND
// ═══════════════════════════════════════════════════════════════════════════
function GradeLegend({ students }) {
  const gradeInfo = [
    { g:"O",  cat:"Outstanding",  tier:0 },
    { g:"A+", cat:"Excellent",    tier:1 },
    { g:"A",  cat:"Very Good",    tier:2 },
    { g:"B+", cat:"Good",         tier:3 },
    { g:"B",  cat:"Above Avg",    tier:4 },
    { g:"C",  cat:"Average",      tier:5 },
    { g:"D",  cat:"Below Avg",    tier:6 },
    { g:"F",  cat:"Fail",         tier:7 },
  ];

  return (
    <div style={{
      display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center",
      marginBottom:24,
    }}>
      {gradeInfo.map(({g, cat, tier}) => {
        const count = students.filter(s=>s.grade===g).length;
        return (
          <div key={g} style={{
            display:"flex", alignItems:"center", gap:7,
            background:"rgba(255,255,255,0.03)",
            borderRadius:20, padding:"5px 12px",
            border:`1px solid ${nodeColor(tier)}33`,
            fontFamily:"'JetBrains Mono', monospace",
          }}>
            <div style={{width:8,height:8,borderRadius:"50%",background:nodeColor(tier),
              boxShadow:`0 0 6px ${nodeColor(tier)}`}}/>
            <span style={{color:nodeColor(tier), fontSize:11, fontWeight:700}}>{g}</span>
            <span style={{color:"#546E7A", fontSize:10}}>{cat}</span>
            <span style={{color:"#78909C", fontSize:10, marginLeft:2}}>×{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  INPUT PANEL
// ═══════════════════════════════════════════════════════════════════════════
function InputPanel({ onAnalyze }) {
  const [subject, setSubject] = useState("");
  const [rows, setRows] = useState(
    Array.from({length:5}, (_,i) => ({ name:`Student ${i+1}`, marks:"" }))
  );

  function addRow() {
    setRows(r => [...r, { name:`Student ${r.length+1}`, marks:"" }]);
  }
  function removeRow(i) {
    setRows(r => r.filter((_,j)=>j!==i));
  }
  function update(i, field, val) {
    setRows(r => r.map((row,j) => j===i ? {...row, [field]:val} : row));
  }
  function submit() {
    const valid = rows.filter(r=>r.name && r.marks !== "" && !isNaN(+r.marks));
    if (valid.length < 2) { alert("Need at least 2 valid students."); return; }
    onAnalyze({ subject: subject || "General", names: valid.map(r=>r.name), marks: valid.map(r=>+r.marks) });
  }
  function loadDemo() {
    onAnalyze(DEMO);
  }

  const inp = (extra) => ({
    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:8, color:"#E0E0E0", padding:"8px 12px", fontSize:13,
    outline:"none", fontFamily:"'JetBrains Mono', monospace",
    width:"100%", boxSizing:"border-box",
    ...extra,
  });

  return (
    <div style={{maxWidth:560, margin:"0 auto"}}>
      <input style={{...inp(), marginBottom:18, fontSize:14}}
        placeholder="Subject name (e.g. Data Structures)"
        value={subject} onChange={e=>setSubject(e.target.value)}
      />

      <div style={{display:"grid", gridTemplateColumns:"1fr 100px 36px",
        gap:8, marginBottom:8}}>
        <span style={{color:"#546E7A", fontSize:11, fontFamily:"monospace", paddingLeft:4}}>NAME</span>
        <span style={{color:"#546E7A", fontSize:11, fontFamily:"monospace"}}>MARKS</span>
        <span/>
      </div>

      <div style={{maxHeight:280, overflowY:"auto", marginBottom:14}}>
        {rows.map((r,i) => (
          <div key={i} style={{display:"grid", gridTemplateColumns:"1fr 100px 36px",
            gap:8, marginBottom:8}}>
            <input style={inp()} placeholder={`Student ${i+1}`}
              value={r.name} onChange={e=>update(i,"name",e.target.value)}/>
            <input style={inp({textAlign:"right"})} placeholder="0–100" type="number" min="0" max="100"
              value={r.marks} onChange={e=>update(i,"marks",e.target.value)}/>
            <button onClick={()=>removeRow(i)} style={{
              background:"rgba(239,83,80,0.15)", border:"1px solid #EF535044",
              borderRadius:8, color:"#EF5350", cursor:"pointer", fontSize:14,
            }}>×</button>
          </div>
        ))}
      </div>

      <button onClick={addRow} style={{
        width:"100%", background:"rgba(255,255,255,0.04)", border:"1px dashed rgba(255,255,255,0.15)",
        borderRadius:8, color:"#607D8B", padding:"9px", cursor:"pointer",
        fontFamily:"monospace", fontSize:12, marginBottom:20,
      }}>+ Add Student</button>

      <div style={{display:"flex", gap:12}}>
        <button onClick={loadDemo} style={{
          flex:1, background:"rgba(0,229,255,0.08)", border:"1px solid #00E5FF44",
          borderRadius:10, color:"#00E5FF", padding:"11px", cursor:"pointer",
          fontFamily:"'JetBrains Mono', monospace", fontSize:13, fontWeight:600,
        }}>⚗ Load Demo</button>
        <button onClick={submit} style={{
          flex:2, background:"linear-gradient(135deg, #00E5FF22, #0288D133)",
          border:"1px solid #00E5FF66",
          borderRadius:10, color:"#00E5FF", padding:"11px", cursor:"pointer",
          fontFamily:"'JetBrains Mono', monospace", fontSize:13, fontWeight:700,
          boxShadow:"0 0 20px #00E5FF22",
        }}>▶ Analyze</button>
      </div>
    </div>
  );
}

// ── tier helper (maps grade string → tier index for colour) ────────────────
function gradeToTier(grade) {
  return { "O":0, "A+":1, "A":2, "B+":3, "B":4, "C":5, "D":6, "F":7 }[grade] ?? 7;
}

// ═══════════════════════════════════════════════════════════════════════════
//  APP ROOT
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [processed, setProcessed] = useState(null);
  const [filter, setFilter]       = useState("all");
  const [view, setView]           = useState("input"); // "input" | "result"
  const [loading, setLoading]     = useState(false);
  const [apiError, setApiError]   = useState(null);

  async function handleAnalyze(d) {
    setLoading(true);
    setApiError(null);

    try {
      const res = await fetch("http://localhost:5000/api/analyze", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({
          subject: d.subject,
          names  : d.names,
          marks  : d.marks,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setApiError(json.error || "Server error");
        setLoading(false);
        return;
      }

      // attach tier (for colours) to each student coming from Python
      const enriched = json.students.map(s => ({
        ...s,
        cat  : s.category,
        z    : s.z_score,
        tier : gradeToTier(s.grade),
      }));

      setProcessed({ subject: json.subject, students: enriched, stats: json.stats, summary: json.summary });
      setView("result");
      setFilter("all");

    } catch (err) {
      setApiError("Cannot reach the Python server. Is api.py running?");
    }

    setLoading(false);
  }

  return (
    <div style={{
      minHeight:"100vh", background:"#060D17",
      fontFamily:"'JetBrains Mono', monospace",
      color:"#E0E0E0",
    }}>
      {/* google font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #00E5FF33; border-radius:4px; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease both; }
      `}</style>

      {/* header */}
      <div style={{
        borderBottom:"1px solid rgba(0,229,255,0.1)",
        padding:"20px 40px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div>
          <span style={{
            fontSize:11, letterSpacing:"0.2em", color:"#00E5FF",
            textTransform:"uppercase", opacity:0.7,
          }}>Grading Intelligence</span>
          <div style={{fontSize:20, fontWeight:700, letterSpacing:"-0.02em", marginTop:2}}>
            🧬 DNA Bell Curve
          </div>
        </div>
        {view === "result" && (
          <button onClick={()=>setView("input")} style={{
            background:"transparent", border:"1px solid rgba(255,255,255,0.12)",
            borderRadius:8, color:"#607D8B", padding:"8px 16px",
            cursor:"pointer", fontSize:12, fontFamily:"monospace",
          }}>← New Analysis</button>
        )}
      </div>

      <div style={{maxWidth:900, margin:"0 auto", padding:"40px 24px"}}>

        {/* error banner */}
        {apiError && (
          <div style={{
            background:"rgba(239,83,80,0.1)", border:"1px solid #EF535055",
            borderRadius:10, padding:"12px 18px", marginBottom:24,
            color:"#EF5350", fontSize:12, fontFamily:"monospace",
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            ⚠ {apiError}
            <button onClick={()=>setApiError(null)} style={{
              background:"none", border:"none", color:"#EF5350", cursor:"pointer", fontSize:16,
            }}>×</button>
          </div>
        )}

        {/* loading */}
        {loading && (
          <div style={{textAlign:"center", padding:"60px 0", color:"#00E5FF", fontFamily:"monospace"}}>
            <div style={{fontSize:28, marginBottom:12, display:"inline-block",
              animation:"spin 1.2s linear infinite"}}>◈</div>
            <div style={{fontSize:12, letterSpacing:"0.15em", opacity:0.6}}>COMPUTING BELL CURVE...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && view === "input" && (
          <div className="fade-up">
            <div style={{textAlign:"center", marginBottom:40}}>
              <div style={{
                fontSize:13, color:"#546E7A", letterSpacing:"0.1em",
                textTransform:"uppercase", marginBottom:12,
              }}>Enter Student Data</div>
              <div style={{
                fontSize:11, color:"#37474F",
                lineHeight:1.8,
              }}>
                Marks are graded on a bell curve relative to the class mean + standard deviation
              </div>
            </div>
            <InputPanel onAnalyze={handleAnalyze} />
          </div>
        )}

        {!loading && view === "result" && processed && (
          <div className="fade-up">
            {/* subject + filter bar */}
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:28, flexWrap:"wrap", gap:12,
            }}>
              <div>
                <div style={{color:"#546E7A", fontSize:10, letterSpacing:"0.15em",
                  textTransform:"uppercase", marginBottom:4}}>Subject</div>
                <div style={{fontSize:18, fontWeight:700}}>{processed.subject}</div>
                <div style={{color:"#546E7A", fontSize:11, marginTop:2}}>
                  {processed.students.length} students · μ={processed.stats.mean.toFixed(1)} · σ={processed.stats.std.toFixed(1)}
                </div>
              </div>
              {/* toggle */}
              <div style={{
                display:"flex", gap:6, background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:4,
              }}>
                {[["all","All Students"],["top","Highlight Top"],["risk","Highlight Risk"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setFilter(v)} style={{
                    background: filter===v ? "rgba(0,229,255,0.12)" : "transparent",
                    border: filter===v ? "1px solid #00E5FF44" : "1px solid transparent",
                    borderRadius:7, color: filter===v ? "#00E5FF" : "#546E7A",
                    padding:"7px 14px", cursor:"pointer", fontSize:11, fontFamily:"monospace",
                    transition:"all 0.2s",
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* legend */}
            <GradeLegend students={processed.students} />

            {/* main curve */}
            <div style={{
              background:"rgba(0,229,255,0.02)",
              border:"1px solid rgba(0,229,255,0.08)",
              borderRadius:16, padding:"28px 16px 16px",
              marginBottom:8,
              position:"relative",
            }}>
              <DNACurve
                students={processed.students}
                stats={processed.stats}
                filter={filter}
              />
            </div>
            <div style={{
              textAlign:"center", color:"#37474F",
              fontSize:10, letterSpacing:"0.1em", marginBottom:32,
            }}>
              HOVER ANY NODE FOR DETAILS · MARKS AXIS 0–100
            </div>

            {/* insight cards */}
            <div style={{
              color:"#546E7A", fontSize:10, letterSpacing:"0.18em",
              textTransform:"uppercase", marginBottom:16,
            }}>◈ Intelligence Layer</div>
            <InsightCards students={processed.students} stats={processed.stats} />

            {/* stats row */}
            <div style={{
              display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",
              gap:12, marginTop:32,
            }}>
              {[
                ["Mean",    processed.stats.mean.toFixed(1)],
                ["Median",  processed.stats.median.toFixed(1)],
                ["Std Dev", processed.stats.std.toFixed(1)],
                ["Max",     processed.stats.max],
                ["Min",     processed.stats.min],
                ["P90",     processed.stats.p90.toFixed(1)],
              ].map(([l,v])=>(
                <div key={l} style={{
                  background:"rgba(255,255,255,0.02)",
                  border:"1px solid rgba(255,255,255,0.06)",
                  borderRadius:10, padding:"14px 16px",
                  textAlign:"center",
                }}>
                  <div style={{color:"#37474F", fontSize:9, letterSpacing:"0.14em",
                    textTransform:"uppercase", marginBottom:6}}>{l}</div>
                  <div style={{fontSize:20, fontWeight:700, color:"#E0E0E0"}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
