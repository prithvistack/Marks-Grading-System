
import { useState, useRef, useEffect } from "react";

// ── colour palette ───────────────────────────────────────────────────────────
const TIER_COLORS = [
  "#A16207", // O  – deep amber-gold
  "#C2410C", // A+ – burnt orange
  "#0369A1", // A  – steel blue
  "#0891B2", // B+ – teal
  "#15803D", // B  – forest green
  "#6B7280", // C  – slate
  "#B45309", // D  – dark amber
  "#B91C1C", // F  – red
];

const GRADE_MAP = { "O":0,"A+":1,"A":2,"B+":3,"B":4,"C":5,"D":6,"F":7 };

function tierOf(grade)   { return GRADE_MAP[grade] ?? 7; }
function colorOf(tier)   { return TIER_COLORS[tier]; }
function gauss(x,mu,sig) { return Math.exp(-0.5*((x-mu)/sig)**2); }

// ── demo dataset ─────────────────────────────────────────────────────────────
const DEMO = {
  subject: "Computer Engineering",
  names: ["Aarav Shah","Priya Nair","Rohit Verma","Sneha Patil","Kiran Rao",
          "Meera Joshi","Arjun Kumar","Divya Menon","Yash Gupta","Ananya Singh",
          "Rahul Desai","Pooja Iyer","Nikhil More","Tanya Bose","Sameer Khan"],
  marks: [88,72,95,61,78,83,55,90,67,74,48,85,70,92,63],
};

// ── client-side grade logic (mirrors Python) ─────────────────────────────────
function computeStats(marks) {
  const n    = marks.length;
  const mean = marks.reduce((a,b)=>a+b,0)/n;
  const std  = Math.sqrt(marks.reduce((a,b)=>a+(b-mean)**2,0)/n);
  const s    = [...marks].sort((a,b)=>a-b);
  const med  = n%2===0 ? (s[n/2-1]+s[n/2])/2 : s[Math.floor(n/2)];
  return { mean, std, median:med,
           min:s[0], max:s[n-1], p25:s[Math.floor(n*.25)], p75:s[Math.floor(n*.75)], p90:s[Math.floor(n*.9)] };
}

function assignGrade(score, mean, std) {
  if (score >= mean+1.5*std) return {grade:"O",  cat:"Outstanding",  tier:0};
  if (score >= mean+1.0*std) return {grade:"A+", cat:"Excellent",     tier:1};
  if (score >= mean+0.5*std) return {grade:"A",  cat:"Very Good",     tier:2};
  if (score >= mean+0.0*std) return {grade:"B+", cat:"Good",          tier:3};
  if (score >= mean-0.5*std) return {grade:"B",  cat:"Above Average", tier:4};
  if (score >= mean-1.0*std) return {grade:"C",  cat:"Average",       tier:5};
  if (score >= mean-1.5*std) return {grade:"D",  cat:"Below Average", tier:6};
  return                            {grade:"F",  cat:"Fail",          tier:7};
}

// ── generate plausible history (mirrors api.py logic) ────────────────────────
function generateHistory(name, currentMark, nTests=5) {
  let seed = name.split("").reduce((a,c)=>a+c.charCodeAt(0), 0);
  function seededRand() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  }
  function seededNormal() {
    const u = seededRand(), v = seededRand();
    return Math.sqrt(-2*Math.log(u+1e-10))*Math.cos(2*Math.PI*v);
  }
  const history = [currentMark];
  for (let i = 1; i < nTests; i++) {
    const delta = seededNormal() * 8;
    const prev  = Math.min(100, Math.max(0, history[history.length-1] + delta));
    history.push(Math.round(prev*10)/10);
  }
  history.reverse();
  history[history.length-1] = currentMark;
  return history;
}

function generateInsights(students, stats) {
  const { mean, std, median } = stats;
  const skew      = (mean - median) / std;
  const cv        = (std / mean) * 100;
  const failCount = students.filter(s => s.grade === "F").length;
  const topCount  = students.filter(s => s.tier <= 1).length;
  const lines = [];

  if      (cv < 15)  lines.push("tightly clustered distribution");
  else if (cv < 25)  lines.push("moderate spread across the curve");
  else               lines.push("wide score dispersion");

  if      (Math.abs(skew) < 0.12) lines.push("near-symmetric bell shape");
  else if (skew > 0)               lines.push(`right skew — stronger high performers`);
  else                             lines.push(`left skew — more below-average scores`);

  if (failCount === 0) lines.push("no students in fail zone");
  else lines.push(`${failCount} student${failCount>1?"s":""} in fail zone — attention required`);

  if (topCount > 0) lines.push(`${topCount} student${topCount>1?"s":""} in O/A+ tier`);
  if (mean > 70)    lines.push("class performing above baseline");
  else if (mean < 50) lines.push("class performance below target threshold");

  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TREND SPARKLINE (SVG)
// ═══════════════════════════════════════════════════════════════════════════
function TrendLine({ history, color, width=120, height=40 }) {
  if (!history || history.length < 2) return null;
  const pad  = 4;
  const minV = Math.min(...history);
  const maxV = Math.max(...history);
  const rng  = maxV - minV || 1;
  const toX  = i => pad + (i/(history.length-1))*(width-2*pad);
  const toY  = v => height - pad - ((v-minV)/rng)*(height-2*pad);
  const pts  = history.map((v,i) => `${toX(i)},${toY(v)}`).join(" ");

  // fill area under line
  const fillPts = [
    `${toX(0)},${height}`,
    ...history.map((v,i)=>`${toX(i)},${toY(v)}`),
    `${toX(history.length-1)},${height}`,
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{width, height, display:"block"}}>
      <polygon points={fillPts} fill={color} opacity="0.08"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* last point dot */}
      <circle
        cx={toX(history.length-1)} cy={toY(history[history.length-1])}
        r="2.5" fill={color}
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  STUDENT DETAIL PANEL (slide-up on double-click)
// ═══════════════════════════════════════════════════════════════════════════
function DetailPanel({ student, onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  const color = colorOf(student.tier);

  return (
    <div
      onClick={handleClose}
      style={{
        position:"fixed", inset:0, zIndex:100,
        background:"rgba(15,23,42,0.18)",
        backdropFilter:"blur(2px)",
        display:"flex", alignItems:"flex-end", justifyContent:"center",
        transition:"opacity 0.25s",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:"#FAFAF8",
          borderTop:"1px solid #E5E7EB",
          borderLeft:"1px solid #E5E7EB",
          borderRight:"1px solid #E5E7EB",
          borderRadius:"12px 12px 0 0",
          padding:"28px 32px 36px",
          width:"100%", maxWidth:520,
          fontFamily:"'JetBrains Mono', monospace",
          transform: visible ? "translateY(0)" : "translateY(40px)",
          transition:"transform 0.26s cubic-bezier(0.34,1.2,0.64,1)",
          boxShadow:"0 -8px 40px rgba(15,23,42,0.08)",
        }}
      >
        {/* drag handle */}
        <div style={{
          width:36, height:3, borderRadius:2,
          background:"#D1D5DB", margin:"0 auto 24px",
        }}/>

        {/* name + close */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20}}>
          <div>
            <div style={{fontSize:16, fontWeight:700, color:"#0F172A"}}>{student.name}</div>
            <div style={{fontSize:11, color:"#9CA3AF", marginTop:2}}>double-click node to close</div>
          </div>
          <button onClick={handleClose} style={{
            background:"none", border:"none", cursor:"pointer",
            color:"#9CA3AF", fontSize:18, padding:"0 4px",
          }}>×</button>
        </div>

        {/* grade badge */}
        <div style={{
          display:"inline-flex", alignItems:"center", gap:8,
          marginBottom:24,
        }}>
          <span style={{
            fontSize:22, fontWeight:700, color,
          }}>{student.grade}</span>
          <span style={{fontSize:11, color:"#6B7280"}}>{student.cat}</span>
          <span style={{
            fontSize:11, color:"#9CA3AF",
            borderLeft:"1px solid #E5E7EB", paddingLeft:8, marginLeft:4,
          }}>rank #{student.rank}</span>
        </div>

        {/* inline stats row */}
        <div style={{
          display:"flex", gap:24, marginBottom:24,
          borderTop:"1px solid #F3F4F6", borderBottom:"1px solid #F3F4F6",
          padding:"12px 0",
        }}>
          {[["marks", student.marks], ["z-score", (student.z>=0?"+":"")+student.z.toFixed(2)], ["points", student.pts ?? "—"]].map(([l,v]) => (
            <div key={l}>
              <div style={{fontSize:9, color:"#9CA3AF", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3}}>{l}</div>
              <div style={{fontSize:15, fontWeight:600, color:"#0F172A"}}>{v}</div>
            </div>
          ))}
        </div>

        {/* trend graph */}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:9, color:"#9CA3AF", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10}}>
            Score Trend — last {student.history?.length ?? 0} tests
          </div>
          <div style={{display:"flex", alignItems:"flex-end", gap:8}}>
            <TrendLine history={student.history} color={color} width={300} height={60}/>
            <div style={{fontSize:10, color:"#9CA3AF", paddingBottom:4}}>
              {student.history && (
                <>
                  <div>{Math.min(...student.history).toFixed(0)} ↓</div>
                  <div style={{marginTop:6}}>{Math.max(...student.history).toFixed(0)} ↑</div>
                </>
              )}
            </div>
          </div>
          {/* test labels */}
          {student.history && (
            <div style={{display:"flex", justifyContent:"space-between", marginTop:4, paddingRight:24}}>
              {student.history.map((_,i) => (
                <span key={i} style={{fontSize:9, color:"#D1D5DB"}}>T{i+1}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOVER CARD
// ═══════════════════════════════════════════════════════════════════════════
function HoverCard({ student }) {
  const color = colorOf(student.tier);
  return (
    <div style={{
      position:"absolute", top:8, right:8,
      background:"#FFFFFF",
      border:"1px solid #E5E7EB",
      borderRadius:8,
      padding:"13px 16px",
      minWidth:180,
      boxShadow:"0 2px 12px rgba(15,23,42,0.07)",
      pointerEvents:"none",
      zIndex:20,
      fontFamily:"'JetBrains Mono', monospace",
    }}>
      <div style={{
        fontSize:12, fontWeight:700, color, marginBottom:9,
        paddingBottom:8, borderBottom:"1px solid #F3F4F6",
      }}>
        {student.name}
      </div>
      {[
        ["marks",    student.marks],
        ["z",        (student.z>=0?"+":"")+student.z.toFixed(2)],
        ["grade",    student.grade],
        ["category", student.cat],
        ["rank",     `#${student.rank}`],
      ].map(([l,v]) => (
        <div key={l} style={{display:"flex", justifyContent:"space-between", gap:12, marginBottom:3, fontSize:11}}>
          <span style={{color:"#9CA3AF"}}>{l}</span>
          <span style={{color: l==="grade" ? color : "#0F172A", fontWeight:600}}>{v}</span>
        </div>
      ))}
      <div style={{marginTop:10}}>
        <TrendLine history={student.history} color={color} width={148} height={30}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  BELL CURVE SVG
// ═══════════════════════════════════════════════════════════════════════════
function DNACurve({ students, stats, filter, animKey }) {
  const [hovered,  setHovered]  = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [clicked,  setClicked]  = useState(null);
  const [nodesOn,  setNodesOn]  = useState(false);
  const path1 = useRef(null);
  const path2 = useRef(null);
  const W=800, H=310, PAD=44;
  const { mean, std } = stats;
  const xMin = mean-3.2*std, xMax = mean+3.2*std;
  const toX  = v => PAD + ((v-xMin)/(xMax-xMin))*(W-2*PAD);
  const toY  = v => H-PAD - v*(H-2*PAD);

  const PTS=280;
  const c1 = Array.from({length:PTS}, (_,i) => {
    const x=xMin+(i/(PTS-1))*(xMax-xMin);
    return `${toX(x)},${toY(gauss(x,mean,std))}`;
  });
  const c2 = Array.from({length:PTS}, (_,i) => {
    const x=xMin+(i/(PTS-1))*(xMax-xMin);
    const y=gauss(x,mean,std)*0.88-0.04;
    return `${toX(x)},${toY(Math.max(0,y))}`;
  });
  const links = Array.from({length:14}, (_,i) => {
    const x=xMin+((i+1)/15)*(xMax-xMin);
    const y1=gauss(x,mean,std);
    const y2=Math.max(0,y1*0.88-0.04);
    return {x1:toX(x),y1:toY(y1),x2:toX(x),y2:toY(y2)};
  });

  const nodes = students.map(s => {
    const ny = gauss(s.marks, mean, std);
    const jitter = Math.sin(s.marks*7.3)*0.025;
    return {
      ...s,
      cx: toX(s.marks),
      cy: toY(ny + jitter),
      color: colorOf(s.tier),
      dimmed: filter==="top" ? s.tier>2 : filter==="risk" ? s.tier<6 : false,
    };
  });

  // curve draw animation
  useEffect(() => {
    setNodesOn(false);
    setHovered(null);
    setClicked(null);

    const animate = (ref, delay) => {
      if (!ref.current) return;
      const len = ref.current.getTotalLength?.() ?? 1800;
      ref.current.style.strokeDasharray = len;
      ref.current.style.strokeDashoffset = len;
      ref.current.style.transition = "none";
      setTimeout(() => {
        if (!ref.current) return;
        ref.current.style.transition = `stroke-dashoffset 1.35s cubic-bezier(0.4,0,0.2,1) ${delay}ms`;
        ref.current.style.strokeDashoffset = "0";
      }, 40);
    };
    animate(path1, 0);
    animate(path2, 110);
    const t = setTimeout(() => setNodesOn(true), 880);
    return () => clearTimeout(t);
  }, [animKey]);

  return (
    <>
      <div style={{position:"relative", width:"100%"}}>
        <style>{`
          @keyframes breathe {
            0%,100% { filter:drop-shadow(0 0 2px rgba(14,165,233,0.12)); }
            50%      { filter:drop-shadow(0 0 9px rgba(14,165,233,0.30)); }
          }
          @keyframes nodeIn {
            from { opacity:0; transform:scale(0.2); }
            to   { opacity:1; transform:scale(1); }
          }
          .curve-glow { animation: breathe 3s ease-in-out infinite; }
          .node-in    { animation: nodeIn 0.3s cubic-bezier(0.34,1.5,0.64,1) both; }
        `}</style>

        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%", overflow:"visible"}}>
          <defs>
            <filter id="nshadow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="s1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#0EA5E9" stopOpacity="0.08"/>
              <stop offset="35%"  stopColor="#0EA5E9" stopOpacity="0.65"/>
              <stop offset="65%"  stopColor="#0EA5E9" stopOpacity="0.65"/>
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.08"/>
            </linearGradient>
            <linearGradient id="s2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#38BDF8" stopOpacity="0.03"/>
              <stop offset="40%"  stopColor="#38BDF8" stopOpacity="0.28"/>
              <stop offset="60%"  stopColor="#38BDF8" stopOpacity="0.28"/>
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.03"/>
            </linearGradient>
          </defs>

          {/* axis */}
          <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} stroke="#D1D5DB" strokeWidth="0.75"/>

          {/* σ tick marks */}
          {[-1.5,-1,1,1.5].map(s => (
            <line key={s} x1={toX(mean+s*std)} y1={PAD+8} x2={toX(mean+s*std)} y2={H-PAD}
              stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="2 5"/>
          ))}

          {/* x labels */}
          {[0,20,40,60,80,100].map(v => (
            <g key={v}>
              <line x1={toX(v)} y1={H-PAD} x2={toX(v)} y2={H-PAD+4} stroke="#D1D5DB" strokeWidth="0.6"/>
              <text x={toX(v)} y={H-PAD+13} fill="#9CA3AF" fontSize="9" textAnchor="middle"
                fontFamily="'JetBrains Mono', monospace">{v}</text>
            </g>
          ))}

          {/* DNA cross-links */}
          {links.map((l,i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#BAE6FD" strokeWidth="0.7" opacity="0.45"/>
          ))}

          {/* strand 2 */}
          <polyline ref={path2} points={c2.join(" ")} fill="none"
            stroke="url(#s2)" strokeWidth="1.6"
            style={{strokeDasharray:2000,strokeDashoffset:2000}}/>

          {/* strand 1 with glow */}
          <g className="curve-glow">
            <polyline ref={path1} points={c1.join(" ")} fill="none"
              stroke="url(#s1)" strokeWidth="2.4"
              style={{strokeDasharray:2000,strokeDashoffset:2000}}/>
          </g>

          {/* nodes */}
          {nodesOn && nodes.map((n,i) => {
            const isH = hovered?.name===n.name;
            const isC = clicked?.name===n.name;
            const r   = isC ? 8 : isH ? 7 : 4.5;
            return (
              <g key={i} className="node-in"
                style={{
                  cursor:"pointer",
                  opacity: n.dimmed ? 0.1 : 1,
                  transition:"opacity 0.25s",
                  animationDelay:`${i*52}ms`,
                }}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setClicked(c => c?.name===n.name ? null : n)}
                onDoubleClick={() => { setDetail(n); setHovered(null); }}
              >
                <circle cx={n.cx} cy={n.cy} r={r+4} fill="none"
                  stroke={n.color} strokeWidth="1"
                  opacity={isH||isC ? 0.35 : 0.1}
                  style={{transition:"all 0.18s"}}/>
                <circle cx={n.cx} cy={n.cy} r={r} fill={n.color}
                  filter="url(#nshadow)"
                  opacity={isH||isC ? 1 : 0.78}
                  style={{transition:"all 0.18s"}}/>
              </g>
            );
          })}
        </svg>

        {hovered && <HoverCard student={hovered}/>}
      </div>

      {/* detail panel */}
      {detail && <DetailPanel student={detail} onClose={() => setDetail(null)}/>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  GRADE LEGEND
// ═══════════════════════════════════════════════════════════════════════════
function GradeLegend({ students }) {
  const grades = ["O","A+","A","B+","B","C","D","F"];
  return (
    <div style={{display:"flex", flexWrap:"wrap", gap:"5px 14px", marginBottom:18}}>
      {grades.map(g => {
        const count = students.filter(s=>s.grade===g).length;
        if (!count) return null;
        const tier = tierOf(g);
        return (
          <div key={g} style={{display:"flex",alignItems:"center",gap:5,
            fontFamily:"'JetBrains Mono', monospace", fontSize:11}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:colorOf(tier), flexShrink:0}}/>
            <span style={{color:"#374151"}}>{g}</span>
            <span style={{color:"#9CA3AF"}}>×{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  ANIMATED INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════
function Insights({ students, stats, visible }) {
  const lines = generateInsights(students, stats);
  return (
    <div style={{fontFamily:"'JetBrains Mono', monospace", marginTop:30}}>
      <div style={{
        fontSize:9, letterSpacing:"0.2em", color:"#9CA3AF",
        textTransform:"uppercase", marginBottom:10,
      }}>Insights</div>
      {lines.map((line, i) => (
        <div key={i} style={{
          display:"flex", alignItems:"baseline", gap:8,
          marginBottom:5, fontSize:12, color:"#4B5563",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: `opacity 0.4s ease ${i*90+200}ms, transform 0.4s ease ${i*90+200}ms`,
        }}>
          <span style={{color:"#D1D5DB", flexShrink:0}}>—</span>
          {line}
        </div>
      ))}
      <div style={{
        marginTop:14, fontSize:11, color:"#9CA3AF", letterSpacing:"0.04em",
        opacity: visible ? 1 : 0,
        transition:`opacity 0.4s ease ${lines.length*90+400}ms`,
      }}>
        μ {stats.mean.toFixed(1)}&nbsp;&nbsp;&nbsp;σ {stats.std.toFixed(1)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  CLI-FEEL FORM INPUT
// ═══════════════════════════════════════════════════════════════════════════
function RowInput({ index, name, marks, onChange, onRemove, active, onFocus }) {
  return (
    <div
      onFocus={onFocus}
      style={{
        display:"grid",
        gridTemplateColumns:"16px 1fr 88px 20px",
        gap:"0 10px",
        alignItems:"end",
        marginBottom:0,
        padding:"6px 0",
        borderBottom: active
          ? "1px solid #0EA5E9"
          : "1px solid transparent",
        transition:"border-color 0.15s",
      }}
    >
      <span style={{
        fontFamily:"'JetBrains Mono', monospace",
        fontSize:11, color: active ? "#0EA5E9" : "#D1D5DB",
        paddingBottom:2, transition:"color 0.15s",
        alignSelf:"end",
      }}>›</span>

      <input
        value={name}
        onChange={e => onChange(index,"name",e.target.value)}
        placeholder={`student ${index+1}`}
        style={{
          background:"transparent", border:"none", outline:"none",
          borderBottom:"1px solid #E5E7EB",
          fontFamily:"'JetBrains Mono', monospace",
          fontSize:12, color:"#0F172A",
          padding:"4px 0",
          width:"100%",
        }}
      />
      <input
        value={marks}
        onChange={e => onChange(index,"marks",e.target.value)}
        placeholder="0–100"
        type="number" min="0" max="100"
        style={{
          background:"transparent", border:"none", outline:"none",
          borderBottom:"1px solid #E5E7EB",
          fontFamily:"'JetBrains Mono', monospace",
          fontSize:12, color:"#0F172A",
          padding:"4px 0", textAlign:"right", width:"100%",
        }}
      />
      <button onClick={() => onRemove(index)} style={{
        background:"none", border:"none", cursor:"pointer",
        color:"#D1D5DB", fontSize:14, padding:0,
        alignSelf:"end", paddingBottom:4,
        transition:"color 0.15s",
        lineHeight:1,
      }}
        onMouseEnter={e=>e.target.style.color="#EF4444"}
        onMouseLeave={e=>e.target.style.color="#D1D5DB"}
      >×</button>
    </div>
  );
}

function FormInput({ onAnalyze }) {
  const [subject, setSubject] = useState("");
  const [rows, setRows] = useState(
    Array.from({length:5}, (_,i) => ({name:`Student ${i+1}`, marks:""}))
  );
  const [active, setActive] = useState(null);

  const update = (i, field, val) =>
    setRows(r => r.map((row,j) => j===i ? {...row,[field]:val} : row));

  const addRow = () =>
    setRows(r => [...r, {name:`Student ${r.length+1}`, marks:""}]);

  const removeRow = i =>
    setRows(r => r.filter((_,j)=>j!==i));

  const submit = () => {
    const valid = rows.filter(r=>r.name && r.marks!=="" && !isNaN(+r.marks) && +r.marks>=0 && +r.marks<=100);
    if (valid.length < 2) return;
    onAnalyze({subject: subject||"Analysis", names: valid.map(r=>r.name), marks: valid.map(r=>+r.marks)});
  };

  const loadDemo = () => onAnalyze(DEMO);

  const inp = (extra={}) => ({
    background:"transparent", border:"none", outline:"none",
    fontFamily:"'JetBrains Mono', monospace",
    fontSize:12, color:"#0F172A",
    width:"100%",
    ...extra,
  });

  return (
    <div style={{maxWidth:520, margin:"0 auto"}}>
      {/* subject field */}
      <div style={{
        display:"flex", alignItems:"end", gap:10,
        borderBottom:"1px solid #E5E7EB",
        marginBottom:24, paddingBottom:6,
      }}>
        <span style={{
          fontFamily:"'JetBrains Mono', monospace", fontSize:9,
          color:"#9CA3AF", letterSpacing:"0.15em", textTransform:"uppercase",
          paddingBottom:3, flexShrink:0,
        }}>subject</span>
        <input
          value={subject}
          onChange={e=>setSubject(e.target.value)}
          placeholder="e.g. Data Structures"
          style={{...inp(), padding:"4px 0"}}
        />
      </div>

      {/* header */}
      <div style={{
        display:"grid", gridTemplateColumns:"16px 1fr 88px 20px", gap:"0 10px",
        marginBottom:6,
      }}>
        <span/>
        <span style={{fontFamily:"'JetBrains Mono', monospace", fontSize:9,
          color:"#9CA3AF", letterSpacing:"0.14em", textTransform:"uppercase"}}>name</span>
        <span style={{fontFamily:"'JetBrains Mono', monospace", fontSize:9,
          color:"#9CA3AF", letterSpacing:"0.14em", textTransform:"uppercase", textAlign:"right"}}>marks</span>
        <span/>
      </div>

      {/* rows */}
      <div style={{maxHeight:260, overflowY:"auto", marginBottom:12}}>
        {rows.map((r,i) => (
          <RowInput key={i} index={i} name={r.name} marks={r.marks}
            onChange={update} onRemove={removeRow}
            active={active===i} onFocus={()=>setActive(i)}
          />
        ))}
      </div>

      {/* add row */}
      <button onClick={addRow} style={{
        background:"none", border:"none", cursor:"pointer",
        fontFamily:"'JetBrains Mono', monospace", fontSize:11,
        color:"#9CA3AF", padding:"6px 0", marginBottom:20,
        transition:"color 0.15s",
      }}
        onMouseEnter={e=>e.target.style.color="#374151"}
        onMouseLeave={e=>e.target.style.color="#9CA3AF"}
      >+ add row</button>

      {/* action row */}
      <div style={{display:"flex", gap:10}}>
        <button onClick={loadDemo} style={{
          flex:1, background:"none",
          border:"1px solid #E5E7EB", borderRadius:6,
          color:"#6B7280", padding:"9px",
          cursor:"pointer", fontFamily:"'JetBrains Mono', monospace",
          fontSize:11, transition:"all 0.15s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#9CA3AF";e.currentTarget.style.color="#374151";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="#E5E7EB";e.currentTarget.style.color="#6B7280";}}
        >demo</button>
        <button onClick={submit} style={{
          flex:2.5, background:"#0F172A",
          border:"1px solid #0F172A", borderRadius:6,
          color:"#F8FAFC", padding:"9px",
          cursor:"pointer", fontFamily:"'JetBrains Mono', monospace",
          fontSize:11, fontWeight:600, transition:"all 0.15s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.background="#1E293B";}}
          onMouseLeave={e=>{e.currentTarget.style.background="#0F172A";}}
        >run analysis →</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  APP ROOT
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [processed, setProcessed] = useState(null);
  const [filter,    setFilter]    = useState("all");
  const [animKey,   setAnimKey]   = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState(null);
  const [insightsVisible, setInsightsVisible] = useState(false);

  async function handleAnalyze(d) {
    setLoading(true);
    setApiError(null);
    setInsightsVisible(false);

    try {
      // Try Flask API first
      const res  = await fetch("http://localhost:5000/api/analyze", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({subject:d.subject, names:d.names, marks:d.marks}),
      });
      const json = await res.json();

      if (!res.ok) { setApiError(json.error || "Server error"); setLoading(false); return; }

      const enriched = json.students.map(s => ({
        ...s,
        cat  : s.category,
        z    : s.z_score,
        tier : tierOf(s.grade),
        history: s.history ?? generateHistory(s.name, s.marks),
      }));
      setProcessed({subject:json.subject, students:enriched, stats:json.stats});
      setAnimKey(k=>k+1);
      setFilter("all");
      setTimeout(()=>setInsightsVisible(true), 1200);

    } catch {
      // Fallback: compute entirely client-side (no Flask needed)
      const stats    = computeStats(d.marks);
      const sorted   = [...d.marks].map((m,i)=>({m,i})).sort((a,b)=>b.m-a.m);
      const rankMap  = {};
      sorted.forEach((r,pos) => { rankMap[r.i] = pos+1; });

      const students = d.marks.map((m,i) => {
        const g = assignGrade(m, stats.mean, stats.std);
        return {
          name: d.names[i] || `Student ${i+1}`,
          marks: m,
          z: stats.std===0 ? 0 : (m-stats.mean)/stats.std,
          rank: rankMap[i],
          pts: g.tier <= 1 ? 10 : g.tier <= 3 ? 7 : g.tier <= 5 ? 5 : g.grade==="F" ? 0 : 4,
          history: generateHistory(d.names[i]||`Student ${i+1}`, m),
          ...g,
        };
      });

      setProcessed({subject:d.subject, students, stats});
      setAnimKey(k=>k+1);
      setFilter("all");
      setTimeout(()=>setInsightsVisible(true), 1200);
    }

    setLoading(false);
  }

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(180deg, #F8F6F2 0%, #EEF2F7 100%)",
      fontFamily:"'JetBrains Mono', monospace",
      color:"#0F172A",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#D1D5DB; border-radius:4px; }
        input[type=number]::-webkit-inner-spin-button { opacity:0; }
        input[type=number]:hover::-webkit-inner-spin-button { opacity:0.3; }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fade-up { animation: fadeUp 0.38s ease both; }
      `}</style>

      {/* header */}
      <div style={{
        borderBottom:"1px solid #E5E7EB",
        padding:"16px 36px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div>
          <div style={{fontSize:9,letterSpacing:"0.22em",color:"#9CA3AF",textTransform:"uppercase",marginBottom:2}}>
            Grading Intelligence
          </div>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:"-0.02em"}}>
            Bell Curve Analyzer
          </div>
        </div>
        {processed && (
          <button onClick={()=>{setProcessed(null);setInsightsVisible(false);}} style={{
            background:"none", border:"1px solid #E5E7EB", borderRadius:5,
            color:"#9CA3AF", padding:"6px 13px",
            cursor:"pointer", fontSize:10, fontFamily:"'JetBrains Mono', monospace",
            transition:"all 0.15s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.color="#374151";e.currentTarget.style.borderColor="#9CA3AF";}}
            onMouseLeave={e=>{e.currentTarget.style.color="#9CA3AF";e.currentTarget.style.borderColor="#E5E7EB";}}
          >← reset</button>
        )}
      </div>

      <div style={{maxWidth:860, margin:"0 auto", padding:"40px 24px"}}>

        {/* error */}
        {apiError && (
          <div style={{
            fontFamily:"'JetBrains Mono', monospace", fontSize:11,
            color:"#B91C1C", marginBottom:20,
            borderLeft:"2px solid #FCA5A5", paddingLeft:12,
          }}>
            {apiError}
            <button onClick={()=>setApiError(null)} style={{
              background:"none",border:"none",cursor:"pointer",color:"#B91C1C",marginLeft:12,
            }}>dismiss</button>
          </div>
        )}

        {/* loading */}
        {loading && (
          <div style={{textAlign:"center", padding:"52px 0", color:"#9CA3AF", fontSize:11, letterSpacing:"0.12em"}}>
            computing...
          </div>
        )}

        {/* input view */}
        {!loading && !processed && (
          <div className="fade-up">
            <div style={{
              textAlign:"center", marginBottom:40,
            }}>
              <div style={{fontSize:11,color:"#9CA3AF",marginBottom:4}}>
                enter student data below
              </div>
              <div style={{fontSize:10,color:"#D1D5DB"}}>
                double-click a node on the curve for student details
              </div>
            </div>
            <FormInput onAnalyze={handleAnalyze}/>
          </div>
        )}

        {/* result view */}
        {!loading && processed && (
          <div className="fade-up">
            {/* subject + filter */}
            <div style={{
              display:"flex", alignItems:"baseline",
              justifyContent:"space-between", flexWrap:"wrap",
              gap:12, marginBottom:18,
            }}>
              <div>
                <div style={{fontSize:15,fontWeight:700}}>{processed.subject}</div>
                <div style={{fontSize:10,color:"#9CA3AF",marginTop:2}}>
                  {processed.students.length} students
                </div>
              </div>
              <div style={{display:"flex", gap:4}}>
                {[["all","all"],["top","top"],["risk","risk"]].map(([v,l]) => (
                  <button key={v} onClick={()=>setFilter(v)} style={{
                    background:"transparent",
                    border: filter===v ? "1px solid #0EA5E9" : "1px solid #E5E7EB",
                    borderRadius:4, color: filter===v ? "#0EA5E9" : "#9CA3AF",
                    padding:"4px 11px", cursor:"pointer",
                    fontSize:10, fontFamily:"'JetBrains Mono', monospace",
                    transition:"all 0.12s",
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* legend */}
            <GradeLegend students={processed.students}/>

            {/* curve */}
            <DNACurve
              students={processed.students}
              stats={processed.stats}
              filter={filter}
              animKey={animKey}
            />

            <div style={{
              textAlign:"center", color:"#D1D5DB",
              fontSize:9, letterSpacing:"0.12em", marginTop:6,
              fontFamily:"'JetBrains Mono', monospace",
            }}>
              hover · click · double-click for detail
            </div>

            {/* insights */}
            <Insights
              students={processed.students}
              stats={processed.stats}
              visible={insightsVisible}
            />
          </div>
        )}

        {/* empty hint */}
        {!loading && !processed && false && (
          <div style={{textAlign:"center",padding:"52px 0",color:"#D1D5DB",fontSize:11}}>
            enter marks and run to see the curve
          </div>
        )}
      </div>
    </div>
  );
}
