import { useState, useEffect, useCallback, useRef } from "react";

// ── レスポンシブ ─────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return w;
}

// ── 定数 ────────────────────────────────────────────
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const CHORD_TYPES_V1 = {
  "M":[0,4,7],"m":[0,3,7],"7":[0,4,7,10],
  "M7":[0,4,7,11],"m7":[0,3,7,10],"m7b5":[0,3,6,10],"dim7":[0,3,6,9],
};
const CHORD_TYPE_LABELS = {
  "M":"M (メジャー)","m":"m (マイナー)","7":"7 (ドミナント7)",
  "M7":"M7 (メジャー7)","m7":"m7 (マイナー7)","m7b5":"m7b5 (ハーフディム)","dim7":"dim7",
};
const CHORD_TYPES = {
  "M7":{intervals:[0,4,7,11],label:"メジャー7"},
  "m7":{intervals:[0,3,7,10],label:"マイナー7"},
  "7": {intervals:[0,4,7,10],label:"ドミナント7"},
  "m7b5":{intervals:[0,3,6,10],label:"ハーフディム"},
  "dim7":{intervals:[0,3,6,9],label:"ディミニッシュ7"},
};
const INTERVAL_NAMES_FULL = {
  0:"R (ルート)",3:"♭3 / #9",4:"3",6:"#11 / ♭5",7:"5",9:"6 / 13",10:"♭7",11:"7",
};
const INTERVAL_LABEL = {0:"R",3:"♭3",4:"3",6:"♭5",7:"5",9:"6",10:"♭7",11:"7"};
const INTERVAL_COLOR = {0:"#e05252",3:"#4a9eff",4:"#4a9eff",6:"#bb88ff",7:"#52c97a",9:"#52c97a",10:"#f4a535",11:"#f4a535"};
const INTERVAL_COLORS_V1 = {0:"#e74c3c",3:"#3498db",4:"#3498db",7:"#2ecc71",10:"#f39c12",11:"#f39c12"};
const PROGRESSIONS = [
  {name:"II–V–I (Cメジャー)",chords:[{root:"D",type:"m7",label:"Dm7",description:"IIm7"},{root:"G",type:"7",label:"G7",description:"V7"},{root:"C",type:"M7",label:"CM7",description:"IM7"}]},
  {name:"II–V–I (Fメジャー)",chords:[{root:"G",type:"m7",label:"Gm7",description:"IIm7"},{root:"C",type:"7",label:"C7",description:"V7"},{root:"F",type:"M7",label:"FM7",description:"IM7"}]},
  {name:"ブルース (Gキー)",chords:[{root:"G",type:"7",label:"G7",description:"I7"},{root:"C",type:"7",label:"C7",description:"IV7"},{root:"D",type:"7",label:"D7",description:"V7"}]},
  {name:"小室進行 (Aマイナー)",chords:[{root:"A",type:"m7",label:"Am7",description:"VIm7"},{root:"F",type:"M7",label:"FM7",description:"IVM7"},{root:"C",type:"M7",label:"CM7",description:"IM7"},{root:"G",type:"7",label:"G7",description:"V7"}]},
  {name:"I–VI–II–V (Cメジャー)",chords:[{root:"C",type:"M7",label:"CM7",description:"IM7"},{root:"A",type:"m7",label:"Am7",description:"VIm7"},{root:"D",type:"m7",label:"Dm7",description:"IIm7"},{root:"G",type:"7",label:"G7",description:"V7"}]},
];
const TRAINING_STEPS = [
  {title:"Step 1 — コードトーンを「音名」で言える",desc:"コードを見た瞬間に、構成音を音名で即答できるようにする。",drill:"例: Cm7 → C, E♭, G, B♭ と声に出す。全12ルートで。",tip:"最初は全部書き出す。指板は後。"},
  {title:"Step 2 — 1弦上でコードトーンを弾く",desc:"1弦（e弦）のみを使い、ルートからコードトーンだけを上下する。",drill:"Am7なら: A → C → E → G → A（上）→ G → E → C → A（下）",tip:"メトロノーム♩=60から。速さより正確さ優先。"},
  {title:"Step 3 — 各弦でコードトーン位置を暗記",desc:"6弦→5弦→4弦と、弦ごとにコードトーンの場所を覚える。",drill:"C7のコードトーン(C/E/G/B♭)を1弦ずつ全ポジション探す",tip:"1弦に慣れたら2弦、3弦と拡張。"},
  {title:"Step 4 — ポジション内でつなぐ（箱弾き）",desc:"3〜5フレット幅の「箱」の中でコードトーンだけを使いフレーズを作る。",drill:"Dm7: 5フレット周辺でD/F/A/Cのみ使い8小節即興",tip:"テンションは一切禁止。コードトーンのみ。"},
  {title:"Step 5 — コード進行に乗せる",desc:"II-V-I などを弾きながら、各コードにコードトーンで乗る。",drill:"Dm7→G7→CM7 を繰り返しながら、コードチェンジごとにコードトーンを意識",tip:"チェンジのタイミングでコードトーンに着地する練習。"},
];
// 上から 1弦e（高音）→ 6弦E（低音）：TAB譜と同じ視点
const STRING_TUNING = [4,11,7,2,9,4]; // 1e,2B,3G,4D,5A,6E
const STRING_LABELS = ["e","B","G","D","A","E"]; // 上=高音弦、下=低音弦
const FRET_COUNT = 15;
function getNoteAtFret(s,f){return(STRING_TUNING[s]+f)%12;}

// フレット間隔: スマホは画面幅から逆算、PCは余裕あり
function getFretSpacing(windowWidth) {
  if (windowWidth < 480) return Math.floor((windowWidth - 56) / (FRET_COUNT + 1));
  if (windowWidth < 768) return 28;
  return 40;
}

// ── Web Audio ────────────────────────────────────────
const audioCtxRef = {current: null};
function getAudioCtx() {
  if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
  return audioCtxRef.current;
}
function noteToHz(noteIdx, octave=4) {
  return 440 * Math.pow(2, ((octave+1)*12 + noteIdx - 69) / 12);
}
function playString(ctx, freq, vol=0.5, startTime=0) {
  const sampleRate=ctx.sampleRate, N=Math.round(sampleRate/freq);
  const bufLen=sampleRate*2, buf=ctx.createBuffer(1,bufLen,sampleRate);
  const data=buf.getChannelData(0);
  const ks=new Float32Array(N);
  for(let i=0;i<N;i++) ks[i]=Math.random()*2-1;
  for(let i=0;i<bufLen;i++){
    const idx=i%N, nextIdx=(i+1)%N;
    if(i<N){data[i]=ks[i];}
    else{ks[idx]=0.996*0.5*(ks[idx]+ks[nextIdx]);data[i]=ks[idx];}
  }
  const src=ctx.createBufferSource(); src.buffer=buf;
  const gain=ctx.createGain();
  gain.gain.setValueAtTime(vol,startTime);
  gain.gain.exponentialRampToValueAtTime(0.001,startTime+2.0);
  const filter=ctx.createBiquadFilter(); filter.type="lowpass"; filter.frequency.value=3000;
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start(startTime); src.stop(startTime+2.0);
}
function playNote(noteIdx, octave=3, vol=0.5, delay=0) {
  try { const ctx=getAudioCtx(); playString(ctx, noteToHz(noteIdx,octave), vol, ctx.currentTime+delay); } catch(e){}
}
function playChord(root, type, mode="strum") {
  try {
    const ctx=getAudioCtx();
    const rootIdx=NOTES.indexOf(root);
    const intervals=CHORD_TYPES[type]?.intervals||CHORD_TYPES_V1[type]||[0,4,7];
    const notes=intervals.map(i=>(rootIdx+i)%12);
    notes.forEach((n,i)=>playString(ctx,noteToHz(n,3),0.4,ctx.currentTime+(mode==="strum"?i*0.04:i*0.18)));
  } catch(e){}
}
function playSE(correct) {
  try {
    const ctx=getAudioCtx(), osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if(correct){
      osc.frequency.setValueAtTime(880,ctx.currentTime); osc.frequency.setValueAtTime(1100,ctx.currentTime+0.1);
      gain.gain.setValueAtTime(0.15,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.4);
    } else {
      osc.type="sawtooth";
      osc.frequency.setValueAtTime(220,ctx.currentTime); osc.frequency.setValueAtTime(180,ctx.currentTime+0.15);
      gain.gain.setValueAtTime(0.1,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.35);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.35);
    }
  } catch(e){}
}

// ── ストレージ ───────────────────────────────────────
const STORAGE_KEY = "chordtone_stats_v1";
function loadStats(){try{const s=sessionStorage.getItem(STORAGE_KEY);return s?JSON.parse(s):{}}catch{return{}}}
function saveStats(s){try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(s))}catch{}}
function useStats(){
  const [stats,setStats]=useState(()=>loadStats());
  const record=useCallback((label,ok)=>{
    setStats(prev=>{
      const next={...prev};
      if(!next[label])next[label]={correct:0,total:0};
      next[label]={correct:next[label].correct+(ok?1:0),total:next[label].total+1};
      saveStats(next);return next;
    });
  },[]);
  const resetStats=useCallback(()=>{setStats({});saveStats({});},[]);
  return{stats,record,resetStats};
}
function pickWeightedChord(stats){
  const typeKeys=Object.keys(CHORD_TYPES);
  const candidates=[];
  for(let ri=0;ri<12;ri++){
    for(const type of typeKeys){
      const key=`${NOTES[ri]}${type}`;
      const s=stats[key];
      const acc=s&&s.total>0?s.correct/s.total:0.5;
      candidates.push({rootIdx:ri,type,weight:Math.max(1,Math.round((1-acc)*4+1))});
    }
  }
  const total=candidates.reduce((s,c)=>s+c.weight,0);
  let r=Math.random()*total;
  for(const c of candidates){r-=c.weight;if(r<=0)return c;}
  return candidates[0];
}

// ── 共通UIパーツ ─────────────────────────────────────
function PlayButton({onClick,label="▶",size="sm",style={}}){
  const [active,setActive]=useState(false);
  const handleClick=()=>{setActive(true);setTimeout(()=>setActive(false),300);onClick();};
  const base=size==="sm"?{padding:"3px 8px",fontSize:10,borderRadius:4}:{padding:"7px 14px",fontSize:13,borderRadius:6};
  return(
    <button onClick={handleClick} style={{...base,cursor:"pointer",border:"none",background:active?"#52c97a":"#1e3a1e",color:active?"#fff":"#52c97a",transition:"all 0.15s",fontWeight:600,...style}}>{label}</button>
  );
}

// ── 指板図（見える化用・音名表示）──────────────────
function FretboardDiagram({root,intervals,colorMap,onNoteClick}){
  const ww=useWindowWidth();
  const FS=getFretSpacing(ww);
  const FC=15;
  const rootIdx=NOTES.indexOf(root);
  const chordTones=intervals.map(i=>(rootIdx+i)%12);
  const svgW=FC*FS+52, svgH=160;
  return(
    <div style={{overflowX:"auto",marginTop:8}}>
      <svg width={svgW} height={svgH} style={{display:"block"}}>
        {Array.from({length:FC+1},(_,f)=><text key={f} x={48+f*FS} y={14} fontSize={10} fill="#888" textAnchor="middle">{f}</text>)}
        <rect x={48} y={20} width={3} height={120} fill="#aaa"/>
        {Array.from({length:FC},(_,f)=><rect key={f} x={55+(f+1)*FS} y={20} width={1} height={120} fill="#444"/>)}
        {STRING_TUNING.map((_,s)=><line key={s} x1={48} y1={28+s*22} x2={48+FC*FS} y2={28+s*22} stroke="#666" strokeWidth={1.5-s*0.15}/>)}
        {STRING_LABELS.map((lbl,s)=><text key={s} x={30} y={32+s*22} fontSize={11} fill="#aaa" textAnchor="middle">{lbl}</text>)}
        {STRING_TUNING.map((_,s)=>Array.from({length:FC+1},(_,f)=>{
          const note=getNoteAtFret(s,f);
          const ctIdx=chordTones.indexOf(note);
          if(ctIdx===-1)return null;
          const iv=intervals[ctIdx];
          const color=colorMap[iv]||"#e74c3c";
          return(
            <g key={`${s}-${f}`} onClick={()=>onNoteClick&&onNoteClick(note)} style={{cursor:onNoteClick?"pointer":"default"}}>
              <circle cx={48+f*FS} cy={28+s*22} r={Math.min(10,FS/2-2)} fill={color} opacity={0.9}/>
              <text x={48+f*FS} y={32+s*22} fontSize={8} fill="white" textAnchor="middle" fontWeight="bold">
                {NOTES[(rootIdx+iv)%12]}
              </text>
            </g>
          );
        }))}
      </svg>
    </div>
  );
}

// ── 指板図（クイズ・進行用・インターバル表示）──────
function FretboardFull({root,type,highlightInterval,onNoteClick}){
  const ww=useWindowWidth();
  const FS=getFretSpacing(ww);
  const rootIdx=NOTES.indexOf(root);
  const intervals=CHORD_TYPES[type].intervals;
  const chordTones=intervals.map(i=>(rootIdx+i)%12);
  const w=FRET_COUNT*FS+56, h=6*26+36;
  return(
    <div style={{overflowX:"auto"}}>
      <svg width={w} height={h} style={{display:"block",minWidth:w}}>
        {Array.from({length:FRET_COUNT+1},(_,f)=><text key={f} x={52+f*FS} y={13} fontSize={9} fill="#444" textAnchor="middle">{f}</text>)}
        <rect x={52} y={18} width={3} height={h-30} fill="#777" rx={1}/>
        {Array.from({length:FRET_COUNT},(_,f)=><rect key={f} x={52+(f+1)*FS} y={18} width={1} height={h-30} fill="#222"/>)}
        {STRING_TUNING.map((_,s)=><line key={s} x1={52} y1={26+s*26} x2={52+FRET_COUNT*FS} y2={26+s*26} stroke="#2a2a2a" strokeWidth={1}/>)}
        {STRING_LABELS.map((lbl,s)=><text key={s} x={36} y={30+s*26} fontSize={10} fill="#444" textAnchor="middle">{lbl}</text>)}
        {STRING_TUNING.map((_,s)=>Array.from({length:FRET_COUNT+1},(_,f)=>{
          const note=getNoteAtFret(s,f);
          const ctIdx=chordTones.indexOf(note);
          if(ctIdx===-1)return null;
          const iv=intervals[ctIdx];
          const lit=highlightInterval===null||iv===highlightInterval;
          const color=INTERVAL_COLOR[iv]||"#888";
          return(
            <g key={`${s}-${f}`} onClick={()=>onNoteClick&&onNoteClick(note,s)} style={{cursor:onNoteClick?"pointer":"default"}}>
              <circle cx={52+f*FS} cy={26+s*26} r={Math.min(10,FS/2-2)} fill={color} opacity={lit?0.95:0.18}/>
              <text x={52+f*FS} y={30+s*26} fontSize={8} fill={lit?"white":"#444"} textAnchor="middle" fontWeight="bold">{INTERVAL_LABEL[iv]}</text>
            </g>
          );
        }))}
      </svg>
    </div>
  );
}

// ── クロマチック円 ───────────────────────────────────
function IntervalCircle({root,intervals,colorMap}){
  const rootIdx=NOTES.indexOf(root);
  const chordTones=intervals.map(i=>(rootIdx+i)%12);
  const cx=110,cy=110,r=85;
  return(
    <svg width={220} height={220}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#333" strokeWidth={1}/>
      {NOTES.map((note,i)=>{
        const angle=(i/12)*2*Math.PI-Math.PI/2;
        const x=cx+r*Math.cos(angle),y=cy+r*Math.sin(angle);
        const ctIdx=chordTones.indexOf(i);
        const isCT=ctIdx!==-1;
        const iv=isCT?intervals[ctIdx]:null;
        const color=isCT?(colorMap[iv]||"#e74c3c"):"#333";
        return(
          <g key={note}>
            {isCT?<circle cx={x} cy={y} r={18} fill={color} opacity={0.9}/>:<circle cx={x} cy={y} r={14} fill="#1a1a1a" stroke="#333" strokeWidth={1}/>}
            <text x={x} y={y+4} fontSize={isCT?11:10} fill={isCT?"white":"#666"} textAnchor="middle" fontWeight={isCT?"bold":"normal"}>{note}</text>
          </g>
        );
      })}
      {chordTones.map((ct,idx)=>{
        if(idx===chordTones.length-1)return null;
        const a1=(ct/12)*2*Math.PI-Math.PI/2,a2=(chordTones[idx+1]/12)*2*Math.PI-Math.PI/2;
        return <line key={idx} x1={cx+r*Math.cos(a1)} y1={cy+r*Math.sin(a1)} x2={cx+r*Math.cos(a2)} y2={cy+r*Math.sin(a2)} stroke="#555" strokeWidth={1} strokeDasharray="3,3"/>;
      })}
    </svg>
  );
}

// ── 見える化モード ───────────────────────────────────
function VisualizeMode(){
  const [root,setRoot]=useState("C");
  const [chordType,setChordType]=useState("M7");
  const [activeStep,setActiveStep]=useState(-1);
  const intervals=CHORD_TYPES_V1[chordType];
  const rootIdx=NOTES.indexOf(root);
  const chordTones=intervals.map(i=>({note:NOTES[(rootIdx+i)%12],interval:INTERVAL_NAMES_FULL[i]||"",color:INTERVAL_COLORS_V1[i]||"#e74c3c",noteIdx:(rootIdx+i)%12}));
  return(
    <div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
        <div>
          <div style={{fontSize:11,color:"#888",marginBottom:4}}>ルート</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {NOTES.map(n=><button key={n} onClick={()=>setRoot(n)} style={{padding:"4px 10px",borderRadius:4,fontSize:13,cursor:"pointer",background:root===n?"#e74c3c":"#222",color:root===n?"#fff":"#aaa",border:"1px solid "+(root===n?"#e74c3c":"#333")}}>{n}</button>)}
          </div>
        </div>
        <div>
          <div style={{fontSize:11,color:"#888",marginBottom:4}}>コードタイプ</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {Object.keys(CHORD_TYPES_V1).map(ct=><button key={ct} onClick={()=>setChordType(ct)} style={{padding:"4px 10px",borderRadius:4,fontSize:12,cursor:"pointer",background:chordType===ct?"#3498db":"#222",color:chordType===ct?"#fff":"#aaa",border:"1px solid "+(chordType===ct?"#3498db":"#333")}}>{CHORD_TYPE_LABELS[ct]||ct}</button>)}
          </div>
        </div>
      </div>
      <div style={{fontSize:28,fontWeight:800,color:"#fff",marginBottom:8}}>
        {root}{chordType}
        <span style={{fontSize:14,color:"#888",marginLeft:12,fontWeight:400}}>構成音: {chordTones.map(ct=>ct.note).join(" - ")}</span>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
        {chordTones.map(ct=>(
          <div key={ct.note+ct.interval} onClick={()=>playNote(ct.noteIdx,3,0.5)} style={{background:ct.color,borderRadius:6,padding:"6px 14px",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer"}}>
            <span style={{fontSize:18,fontWeight:700,color:"#fff"}}>{ct.note}</span>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.8)"}}>{ct.interval}</span>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"#555",marginBottom:12}}>↑ タップして音を確認</div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <PlayButton label="🎸 ストローク" size="md" onClick={()=>playChord(root,chordType,"strum")}/>
        <PlayButton label="🎵 アルペジオ" size="md" onClick={()=>playChord(root,chordType,"arp")}/>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:24}}>
        <div style={{background:"#1a1a1a",borderRadius:8,padding:16,flex:"1 1 220px"}}>
          <div style={{fontSize:13,color:"#888",marginBottom:8}}>🔵 クロマチック円</div>
          <IntervalCircle root={root} intervals={intervals} colorMap={INTERVAL_COLORS_V1}/>
          <div style={{fontSize:11,color:"#555",marginTop:8}}>赤=R 青=3rd 緑=5th オレンジ=7th</div>
        </div>
        <div style={{background:"#1a1a1a",borderRadius:8,padding:16,flex:"3 1 300px"}}>
          <div style={{fontSize:13,color:"#888",marginBottom:8}}>🎸 指板上の全コードトーン <span style={{fontSize:10,color:"#555"}}>（タップで発音）</span></div>
          <FretboardDiagram root={root} intervals={intervals} colorMap={INTERVAL_COLORS_V1} onNoteClick={(n)=>playNote(n,3,0.5)}/>
        </div>
      </div>
      <div style={{marginBottom:8,fontSize:14,color:"#aaa",fontWeight:600}}>📋 習得ロードマップ（5ステップ）</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {TRAINING_STEPS.map((step,i)=>(
          <div key={i} onClick={()=>setActiveStep(activeStep===i?-1:i)} style={{background:activeStep===i?"#1e2a3a":"#1a1a1a",border:"1px solid "+(activeStep===i?"#3498db":"#2a2a2a"),borderRadius:8,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:600,fontSize:14,color:activeStep===i?"#3498db":"#ccc"}}>{step.title}</span>
              <span style={{color:"#555"}}>{activeStep===i?"▲":"▼"}</span>
            </div>
            {activeStep===i&&(
              <div style={{marginTop:10,fontSize:13,lineHeight:1.7}}>
                <p style={{color:"#bbb",margin:"0 0 6px"}}>{step.desc}</p>
                <div style={{background:"#111",borderRadius:6,padding:"8px 12px",marginBottom:6}}>
                  <span style={{color:"#f39c12",fontWeight:600}}>📌 練習: </span><span style={{color:"#ddd"}}>{step.drill}</span>
                </div>
                <div style={{color:"#888",fontSize:12}}>💡 {step.tip}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{marginTop:24,padding:"12px 16px",background:"#1a1a1a",borderRadius:8,fontSize:12,color:"#666",borderLeft:"3px solid #e74c3c"}}>
        目標: コードを見た瞬間に「指板上の光る場所」がイメージできる状態。<br/>
      </div>
    </div>
  );
}

// ── クイズ ───────────────────────────────────────────
function generateSingleQ(rootIdx,type){
  const intervals=CHORD_TYPES[type].intervals;
  const targetIv=intervals[Math.floor(Math.random()*intervals.length)];
  const correctNote=NOTES[(rootIdx+targetIv)%12];
  const wrongs=NOTES.filter(n=>n!==correctNote).sort(()=>Math.random()-0.5).slice(0,3);
  return{mode:"single",root:NOTES[rootIdx],type,chordLabel:`${NOTES[rootIdx]}${type}`,targetIv,intervalLabel:INTERVAL_LABEL[targetIv],correctNote,choices:[correctNote,...wrongs].sort(()=>Math.random()-0.5)};
}
function generateContextQ(){
  const prog=PROGRESSIONS[Math.floor(Math.random()*PROGRESSIONS.length)];
  const focusIdx=Math.floor(Math.random()*prog.chords.length);
  const chord=prog.chords[focusIdx];
  const intervals=CHORD_TYPES[chord.type].intervals;
  const targetIv=intervals[Math.floor(Math.random()*intervals.length)];
  const rootIdx=NOTES.indexOf(chord.root);
  const correctNote=NOTES[(rootIdx+targetIv)%12];
  const wrongs=NOTES.filter(n=>n!==correctNote).sort(()=>Math.random()-0.5).slice(0,3);
  return{mode:"context",progression:prog,focusIdx,root:chord.root,type:chord.type,chordLabel:chord.label,targetIv,intervalLabel:INTERVAL_LABEL[targetIv],correctNote,choices:[correctNote,...wrongs].sort(()=>Math.random()-0.5)};
}

function StatsPanel({stats,onReset}){
  const entries=Object.entries(stats).map(([key,s])=>({key,acc:s.total>0?s.correct/s.total:0,total:s.total})).filter(e=>e.total>=2).sort((a,b)=>a.acc-b.acc);
  if(entries.length===0)return<div style={{padding:"16px",background:"#1a1a1a",borderRadius:10,color:"#555",fontSize:13,textAlign:"center"}}>まだデータなし。クイズを解くと苦手コードが表示されます。</div>;
  return(
    <div style={{background:"#1a1a1a",borderRadius:10,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:13,color:"#aaa",fontWeight:600}}>コード別正答率</div>
        <button onClick={onReset} style={{fontSize:11,color:"#555",background:"none",border:"1px solid #333",borderRadius:4,padding:"3px 8px",cursor:"pointer"}}>リセット</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {entries.slice(0,10).map(e=>{
          const pct=Math.round(e.acc*100);
          const barColor=pct<40?"#e05252":pct<70?"#f4a535":"#52c97a";
          return(
            <div key={e.key} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:12,fontWeight:700,color:"#ccc",width:52,flexShrink:0}}>{e.key}</div>
              <div style={{flex:1,background:"#111",borderRadius:3,height:8,overflow:"hidden"}}>
                <div style={{width:`${pct}%`,height:"100%",background:barColor,borderRadius:3,transition:"width 0.4s"}}/>
              </div>
              <div style={{fontSize:11,color:barColor,width:36,textAlign:"right",flexShrink:0}}>{pct}%</div>
              <div style={{fontSize:10,color:"#555",width:28,flexShrink:0}}>{e.total}問</div>
            </div>
          );
        })}
      </div>
      {entries.length>0&&entries[0].acc<0.6&&(
        <div style={{marginTop:12,padding:"8px 12px",background:"#2a1a0a",borderRadius:6,fontSize:12,color:"#f4a535",borderLeft:"3px solid #f4a535"}}>
          🎯 優先練習: <strong>{entries.slice(0,3).map(e=>e.key).join(", ")}</strong>
        </div>
      )}
    </div>
  );
}

function QuizMode({stats,record,resetStats}){
  const [score,setScore]=useState({correct:0,total:0});
  const [question,setQuestion]=useState(null);
  const [selected,setSelected]=useState(null);
  const [streak,setStreak]=useState(0);
  const [history,setHistory]=useState([]);
  const [quizType,setQuizType]=useState("mixed");
  const [showStats,setShowStats]=useState(false);
  const nextQ=useCallback(()=>{
    let q;
    if(quizType==="context"){q=generateContextQ();}
    else if(quizType==="single"){const p=pickWeightedChord(stats);q=generateSingleQ(p.rootIdx,p.type);}
    else{if(Math.random()<0.6){const p=pickWeightedChord(stats);q=generateSingleQ(p.rootIdx,p.type);}else{q=generateContextQ();}}
    setQuestion(q);setSelected(null);
    setTimeout(()=>{try{playChord(q.root,q.type,"strum");}catch(e){}},100);
  },[quizType,stats]);
  useEffect(()=>{nextQ();},[quizType]);
  const handleAnswer=(note)=>{
    if(selected!==null)return;
    setSelected(note);
    const ok=note===question.correctNote;
    setScore(s=>({correct:s.correct+(ok?1:0),total:s.total+1}));
    setStreak(s=>ok?s+1:0);
    setHistory(h=>[...h.slice(-19),{correct:ok}]);
    record(question.chordLabel,ok);
    playNote(NOTES.indexOf(question.correctNote),3,0.55,0);
    setTimeout(()=>playSE(ok),200);
  };
  if(!question)return null;
  const intervals=CHORD_TYPES[question.type].intervals;
  const rootIdx=NOTES.indexOf(question.root);
  const accuracy=score.total>0?Math.round((score.correct/score.total)*100):0;
  return(
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{background:"#1a1a1a",borderRadius:8,padding:"7px 14px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#f4a535"}}>{accuracy}%</div><div style={{fontSize:10,color:"#555"}}>正答率</div></div>
        <div style={{background:"#1a1a1a",borderRadius:8,padding:"7px 14px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#4a9eff"}}>{score.correct}/{score.total}</div><div style={{fontSize:10,color:"#555"}}>正解/出題</div></div>
        <div style={{background:"#1a1a1a",borderRadius:8,padding:"7px 14px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:streak>=3?"#52c97a":"#ddd"}}>🔥{streak}</div><div style={{fontSize:10,color:"#555"}}>連続</div></div>
        <div style={{display:"flex",gap:3,alignItems:"center",flexWrap:"wrap"}}>{history.map((h,i)=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:h.correct?"#52c97a":"#e05252",opacity:0.3+(i/history.length)*0.7}}/>)}</div>
        <button onClick={()=>setShowStats(s=>!s)} style={{marginLeft:"auto",fontSize:11,color:showStats?"#4a9eff":"#555",background:"none",border:"1px solid "+(showStats?"#4a9eff":"#333"),borderRadius:4,padding:"4px 10px",cursor:"pointer"}}>{showStats?"▲ 閉じる":"📊 苦手分析"}</button>
      </div>
      {showStats&&<div style={{marginBottom:16}}><StatsPanel stats={stats} onReset={resetStats}/></div>}
      <div style={{display:"flex",gap:4,marginBottom:14,background:"#1a1a1a",borderRadius:6,padding:3}}>
        {[{k:"mixed",l:"ミックス"},{k:"single",l:"単体コード"},{k:"context",l:"進行文脈"}].map(t=>(
          <button key={t.k} onClick={()=>setQuizType(t.k)} style={{flex:1,padding:"6px",borderRadius:4,cursor:"pointer",background:quizType===t.k?"#fff":"transparent",border:"none",fontSize:11,fontWeight:700,color:quizType===t.k?"#000":"#555"}}>{t.l}</button>
        ))}
      </div>
      <div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:12,padding:"18px 18px 14px",marginBottom:14}}>
        {question.mode==="context"&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#555",marginBottom:6}}>📍 {question.progression.name}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {question.progression.chords.map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{padding:"5px 10px",borderRadius:6,fontSize:13,fontWeight:700,background:i===question.focusIdx?"#1e2a3a":"#1a1a1a",color:i===question.focusIdx?"#fff":"#555",border:`1px solid ${i===question.focusIdx?"#4a9eff":"#2a2a2a"}`}}>
                    {c.label}{i===question.focusIdx&&<span style={{fontSize:9,color:"#4a9eff",marginLeft:4}}>← ここ</span>}
                  </div>
                  {i<question.progression.chords.length-1&&<span style={{color:"#333",fontSize:12}}>→</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
          <div>
            <div style={{fontSize:11,color:"#555",marginBottom:4}}>問題 {score.total+1} <span style={{padding:"2px 6px",borderRadius:3,fontSize:10,background:question.mode==="context"?"#1e2a3a":"#1a1a1a",color:question.mode==="context"?"#4a9eff":"#666"}}>{question.mode==="context"?"進行文脈":"単体コード"}</span></div>
            <div style={{fontSize:26,fontWeight:800,color:"#fff"}}>{question.chordLabel}<span style={{fontSize:13,color:"#555",fontWeight:400,marginLeft:10}}>({CHORD_TYPES[question.type].label})</span></div>
          </div>
          <PlayButton label="▶ 聴く" size="md" onClick={()=>playChord(question.root,question.type,"strum")} style={{marginTop:4}}/>
        </div>
        <div style={{fontSize:14,color:"#aaa",marginBottom:14}}>の <span style={{color:INTERVAL_COLOR[question.targetIv],fontWeight:700,fontSize:17}}>{question.intervalLabel}</span> はどの音？</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {question.choices.map(note=>{
            let bg="#1a1a1a",border="#333",color="#ccc";
            if(selected!==null){
              if(note===question.correctNote){bg="#1a3a1a";border="#52c97a";color="#52c97a";}
              else if(note===selected&&note!==question.correctNote){bg="#3a1a1a";border="#e05252";color="#e05252";}
            }
            return<button key={note} onClick={()=>handleAnswer(note)} style={{padding:"13px",borderRadius:8,fontSize:19,fontWeight:700,background:bg,border:`1px solid ${border}`,color,cursor:selected!==null?"default":"pointer",transition:"all 0.15s"}}>{note}{selected!==null&&note===question.correctNote&&<span style={{fontSize:10,fontWeight:400,marginLeft:6}}>✓</span>}</button>;
          })}
        </div>
        {selected!==null&&(
          <div style={{marginTop:12,padding:"10px 13px",borderRadius:8,background:selected===question.correctNote?"#0d2a0d":"#2a0d0d",borderLeft:`3px solid ${selected===question.correctNote?"#52c97a":"#e05252"}`}}>
            <div style={{fontSize:13,color:selected===question.correctNote?"#52c97a":"#e05252",fontWeight:600,marginBottom:5}}>{selected===question.correctNote?"✓ 正解！":`✗ 不正解。正解は ${question.correctNote}`}</div>
            <div style={{fontSize:12,color:"#888",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              構成音: {intervals.map(iv=>{
                const n=NOTES[(rootIdx+iv)%12];
                return<span key={iv} onClick={()=>playNote((rootIdx+iv)%12,3,0.5)} style={{color:INTERVAL_COLOR[iv],fontWeight:600,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted"}}>{n}<span style={{color:"#555",fontSize:9,marginLeft:2}}>({INTERVAL_LABEL[iv]})</span></span>;
              })}
              <span style={{fontSize:10,color:"#444"}}>← タップで発音</span>
            </div>
          </div>
        )}
      </div>
      {selected!==null&&(
        <div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:12,padding:13,marginBottom:13}}>
          <div style={{fontSize:11,color:"#555",marginBottom:7}}>指板上の全コードトーン <span style={{color:"#444",fontSize:10}}>（タップで発音）</span></div>
          <FretboardFull root={question.root} type={question.type} highlightInterval={null} onNoteClick={(n)=>playNote(n,3,0.5)}/>
        </div>
      )}
      <button onClick={nextQ} style={{width:"100%",padding:"13px",borderRadius:8,fontSize:14,fontWeight:700,background:"#4a9eff",color:"#fff",border:"none",cursor:"pointer"}}>{selected!==null?"次の問題 →":"スキップ"}</button>
    </div>
  );
}

// ── コード進行モード ──────────────────────────────────
function CommonToneAnalysis({progression,activeChord}){
  const curr=progression.chords[activeChord];
  const next=progression.chords[(activeChord+1)%progression.chords.length];
  const currTones=new Set(CHORD_TYPES[curr.type].intervals.map(i=>(NOTES.indexOf(curr.root)+i)%12));
  const nextTones=new Set(CHORD_TYPES[next.type].intervals.map(i=>(NOTES.indexOf(next.root)+i)%12));
  const common=NOTES.filter((_,i)=>currTones.has(i)&&nextTones.has(i));
  return(
    <div style={{background:"#0d1a0d",border:"1px solid #1a2a1a",borderRadius:10,padding:"12px 16px"}}>
      <div style={{fontSize:11,color:"#3a5a3a",marginBottom:8}}>📌 {curr.label} → {next.label} の共通音</div>
      {common.length>0?(
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {common.map(n=><span key={n} onClick={()=>playNote(NOTES.indexOf(n),3,0.5)} style={{padding:"4px 10px",borderRadius:5,background:"#1a3a1a",color:"#52c97a",fontWeight:700,fontSize:14,cursor:"pointer"}}>{n}</span>)}
          <span style={{fontSize:11,color:"#3a5a3a",marginLeft:4}}>← タップで発音 / チェンジ前後でキープ</span>
        </div>
      ):(
        <div style={{fontSize:12,color:"#3a5a3a"}}>共通音なし — コードトーンを意識したジャンプが必要</div>
      )}
    </div>
  );
}

function ProgressionMode(){
  const [progIdx,setProgIdx]=useState(0);
  const [activeChord,setActiveChord]=useState(0);
  const [highlightInterval,setHighlightInterval]=useState(null);
  const progression=PROGRESSIONS[progIdx];
  const chord=progression.chords[activeChord];
  const intervals=CHORD_TYPES[chord.type].intervals;
  const rootIdx=NOTES.indexOf(chord.root);
  const handleChordSelect=(i)=>{setActiveChord(i);setHighlightInterval(null);playChord(progression.chords[i].root,progression.chords[i].type,"strum");};
  const playAll=()=>{progression.chords.forEach((c,i)=>setTimeout(()=>playChord(c.root,c.type,"strum"),i*900));};
  return(
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:"#555",marginBottom:8}}>コード進行を選ぶ</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {PROGRESSIONS.map((p,i)=><button key={i} onClick={()=>{setProgIdx(i);setActiveChord(0);setHighlightInterval(null);}} style={{padding:"6px 12px",borderRadius:6,fontSize:12,cursor:"pointer",background:progIdx===i?"#1e2a3a":"#1a1a1a",color:progIdx===i?"#4a9eff":"#666",border:`1px solid ${progIdx===i?"#4a9eff":"#2a2a2a"}`}}>{p.name}</button>)}
        </div>
      </div>
      <div style={{marginBottom:16}}><PlayButton label={`▶ ${progression.name} を通しで聴く`} size="md" onClick={playAll}/></div>
      <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"stretch",flexWrap:"wrap"}}>
        {progression.chords.map((c,i)=>{
          const cIvs=CHORD_TYPES[c.type].intervals,cRoot=NOTES.indexOf(c.root);
          return(
            <button key={i} onClick={()=>handleChordSelect(i)} style={{flex:"1 1 80px",padding:"12px 8px",borderRadius:10,cursor:"pointer",background:activeChord===i?"#1e2a3a":"#111",border:`1px solid ${activeChord===i?"#4a9eff":"#2a2a2a"}`,textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:activeChord===i?"#fff":"#777"}}>{c.label}</div>
              <div style={{fontSize:10,color:activeChord===i?"#4a9eff":"#444",marginTop:2}}>{c.description}</div>
              <div style={{display:"flex",justifyContent:"center",gap:3,marginTop:6,flexWrap:"wrap"}}>
                {cIvs.map(iv=><span key={iv} style={{width:18,height:18,borderRadius:"50%",fontSize:7,display:"flex",alignItems:"center",justifyContent:"center",background:INTERVAL_COLOR[iv],color:"#fff",fontWeight:700}}>{NOTES[(cRoot+iv)%12]}</span>)}
              </div>
              <div style={{fontSize:9,color:activeChord===i?"#4a9eff":"#444",marginTop:4}}>▶ タップで発音</div>
            </button>
          );
        })}
      </div>
      <div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:12,padding:16,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
          <div>
            <div style={{fontSize:26,fontWeight:800,color:"#fff"}}>{chord.label}</div>
            <div style={{fontSize:12,color:"#555",marginTop:2}}>{chord.description} — {CHORD_TYPES[chord.type].label}</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <PlayButton label="▶ ストローク" size="sm" onClick={()=>playChord(chord.root,chord.type,"strum")}/>
            <PlayButton label="🎵 アルペジオ" size="sm" onClick={()=>playChord(chord.root,chord.type,"arp")}/>
            <button onClick={()=>setHighlightInterval(null)} style={{padding:"5px 10px",borderRadius:5,fontSize:11,cursor:"pointer",background:highlightInterval===null?"#4a9eff":"#1a1a1a",color:highlightInterval===null?"#fff":"#666",border:`1px solid ${highlightInterval===null?"#4a9eff":"#333"}`}}>全て</button>
            {intervals.map(iv=><button key={iv} onClick={()=>setHighlightInterval(highlightInterval===iv?null:iv)} style={{padding:"5px 10px",borderRadius:5,fontSize:11,cursor:"pointer",background:highlightInterval===iv?INTERVAL_COLOR[iv]:"#1a1a1a",color:highlightInterval===iv?"#fff":"#666",border:`1px solid ${highlightInterval===iv?INTERVAL_COLOR[iv]:"#333"}`}}>{INTERVAL_LABEL[iv]}</button>)}
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {intervals.map(iv=>(
            <div key={iv} onClick={()=>{setHighlightInterval(highlightInterval===iv?null:iv);playNote((rootIdx+iv)%12,3,0.5);}} style={{borderRadius:8,padding:"8px 14px",cursor:"pointer",background:highlightInterval===null||highlightInterval===iv?INTERVAL_COLOR[iv]:"#1a1a1a",opacity:highlightInterval===null||highlightInterval===iv?1:0.4,border:`1px solid ${INTERVAL_COLOR[iv]}`}}>
              <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>{NOTES[(rootIdx+iv)%12]}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.7)"}}>{INTERVAL_LABEL[iv]}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:"#555",marginBottom:6}}>指板 <span style={{color:"#444"}}>（タップで発音）</span></div>
        <FretboardFull root={chord.root} type={chord.type} highlightInterval={highlightInterval} onNoteClick={(n)=>playNote(n,3,0.5)}/>
      </div>
      <CommonToneAnalysis progression={progression} activeChord={activeChord}/>
    </div>
  );
}

// ── メイン ────────────────────────────────────────────
export default function App(){
  const [mode,setMode]=useState("visualize");
  const {stats,record,resetStats}=useStats();
  const ww=useWindowWidth();
  // PC: 1100px, タブレット: 900px, スマホ: full
  const maxWidth = ww >= 1024 ? 1100 : ww >= 768 ? 900 : "100%";
  const weakChords=Object.entries(stats).filter(([,s])=>s.total>=3&&s.correct/s.total<0.6).sort(([,a],[,b])=>a.correct/a.total-b.correct/b.total).slice(0,3).map(([k])=>k);
  const tabs=[
    {key:"visualize",label:"👁️ 見える化",desc:"円・指板・ロードマップ"},
    {key:"quiz",label:"🎯 クイズ",desc:"単体 / 進行文脈"},
    {key:"progression",label:"🎸 コード進行",desc:"実戦コンテキスト"},
  ];
  return(
    <div style={{background:"#111",color:"#ddd",minHeight:"100vh",fontFamily:"'Helvetica Neue',sans-serif",padding:"20px 16px",maxWidth,margin:"0 auto"}}>
      <h1 style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:2}}>🎸 コードトーン・トレーナー</h1>
      <p style={{fontSize:13,color:"#888",marginBottom:weakChords.length>0?8:18}}>コードを選んで「見える化」→ クイズ・コード進行で実戦定着</p>
      {weakChords.length>0&&(
        <div style={{marginBottom:16,padding:"8px 12px",background:"#2a1a0a",borderRadius:6,fontSize:12,color:"#f4a535",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span>🎯 苦手コード:</span>
          {weakChords.map(k=><span key={k} style={{fontWeight:700,background:"#3a2a0a",padding:"2px 8px",borderRadius:4}}>{k}</span>)}
          <span style={{color:"#7a5a30"}}>← クイズで優先出題中</span>
        </div>
      )}
      <div style={{display:"flex",gap:2,marginBottom:22,background:"#1a1a1a",borderRadius:8,padding:3}}>
        {tabs.map(tab=>(
          <button key={tab.key} onClick={()=>setMode(tab.key)} style={{flex:1,padding:"10px 8px",borderRadius:6,cursor:"pointer",background:mode===tab.key?"#fff":"transparent",border:"none",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:mode===tab.key?"#000":"#555"}}>{tab.label}</div>
            <div style={{fontSize:9,color:mode===tab.key?"#888":"#333",marginTop:1}}>{tab.desc}</div>
          </button>
        ))}
      </div>
      {mode==="visualize"&&<VisualizeMode/>}
      {mode==="quiz"&&<QuizMode stats={stats} record={record} resetStats={resetStats}/>}
      {mode==="progression"&&<ProgressionMode/>}
    </div>
  );
}
