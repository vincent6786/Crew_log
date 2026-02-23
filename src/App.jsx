import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// ─── CHANGE THIS to your own secret passcode ──────────────
const APP_PASSCODE = "crew2025";

const INITIAL_CREW = [
  { id: "2311860", name: "中村 江里佳", nickname: "Erika",  seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311700", name: "伊部 華恵",   nickname: "Hanae",  seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311720", name: "注連澤 美琴", nickname: "Miko",   seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311730", name: "藤本 宝",     nickname: "Takara", seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311740", name: "パイル てるみ",nickname: "Lumee",  seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311750", name: "金 千夏",     nickname: "Summer", seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311760", name: "安藤 優",     nickname: "Yu",     seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311780", name: "梅畑 洸之介", nickname: "Ume",    seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311828", name: "松川 実央",   nickname: "Mio",    seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311831", name: "木倉 ももか", nickname: "Momoka", seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311844", name: "瀬戸 那奈",   nickname: "Nana",   seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311857", name: "川村 香織",   nickname: "Kaori",  seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311873", name: "髙木 恵実",   nickname: "Emily",  seniority: "23G", status: null, tags: [], notes: "" },
  { id: "2311886", name: "神山 恵里華", nickname: "Erika2", seniority: "23G", status: null, tags: [], notes: "" },
];

const PRESET_TAGS = ["#好咖","#難搞","#細心","#新人","#好笑","#專業","#八卦","#準時"];
const AIRCRAFT    = ["A321N","A330","A350"];
const POSITIONS   = ["G1","G2","G3","G4","G5","L1","L2","L3","SA","PA"];
const STATUS_MAP  = {
  red:    { emoji:"🔴", label:"注意 / Warning", color:"#FF453A", bg:"rgba(255,69,58,0.13)",  border:"rgba(255,69,58,0.45)"  },
  yellow: { emoji:"🟡", label:"普通 / Neutral",  color:"#FFD60A", bg:"rgba(255,214,10,0.13)", border:"rgba(255,214,10,0.45)" },
  green:  { emoji:"🟢", label:"推薦 / Great!",   color:"#30D158", bg:"rgba(48,209,88,0.13)",  border:"rgba(48,209,88,0.45)"  },
};

const mkId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const today = () => new Date().toISOString().slice(0,10);

const DARK = { bg:"#0B0C14", card:"#111320", cardAlt:"#181A28", border:"#232538", text:"#ECEDFA", sub:"#6B7499", accent:"#F5B731", adk:"#0B0C14", pill:"#1C1F32", input:"#181A28" };
const LITE = { bg:"#EEEEF7", card:"#FFFFFF", cardAlt:"#F4F5FF", border:"#DDE0F0", text:"#0D0E1E", sub:"#6672A0", accent:"#C58C00", adk:"#FFFFFF", pill:"#E4E6F7", input:"#F0F1FA" };

// Firestore refs
const SHARED_DOC = doc(db, "crewlog", "shared");
const flightDoc  = (username) => doc(db, "crewlog", `flights-${username}`);

export default function App() {
  const [dark, setDark] = useState(true);

  // Auth — persisted in localStorage
  const [authStep, setAuthStep]         = useState("loading"); // "loading"|"passcode"|"username"|"app"
  const [username, setUsername]         = useState("");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeErr, setPasscodeErr]   = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameErr, setUsernameErr]   = useState("");

  // Shared data
  const [crew,   setCrew]   = useState([]);
  const [routes, setRoutes] = useState([]);
  // Private data
  const [flights, setFlights] = useState([]);

  const [ready, setReady]         = useState(false);
  const [syncStatus, setSyncStatus] = useState("loading");
  const [view, setView]           = useState("dashboard");
  const [profileId, setProfileId] = useState(null);

  const isRemoteShared  = useRef(false);
  const isRemoteFlights = useRef(false);

  // Dashboard
  const [search, setSearch]       = useState("");
  const [filterTag, setFilterTag] = useState(null);
  const [sortMode, setSortMode]   = useState("alpha");

  // QuickLog
  const EMPTY = { crewId:"", crewTxt:"", date:today(), flightNum:"", route:"", aircraft:"", position:"", memo:"", status:null, tags:[] };
  const [form, setForm]           = useState(EMPTY);
  const [sugg, setSugg]           = useState([]);
  const [addR, setAddR]           = useState(false);
  const [rf, setRf]               = useState({ num:"", route:"", ac:"" });
  const [editFlightId, setEditFlightId] = useState(null);

  // Add Crew
  const [newCrew, setNewCrew]       = useState({ id:"", name:"", nickname:"", seniority:"" });
  const [addCrewErr, setAddCrewErr] = useState("");

  // Profile
  const [editNotes, setEditNotes]   = useState(false);
  const [tempNotes, setTempNotes]   = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const c = dark ? DARK : LITE;

  // ── Check localStorage for existing session ───────────────
  useEffect(() => {
    const saved = localStorage.getItem("cl-username");
    const auth  = localStorage.getItem("cl-auth");
    if (auth === "ok" && saved) { setUsername(saved); setAuthStep("app"); }
    else if (auth === "ok")     { setAuthStep("username"); }
    else                        { setAuthStep("passcode"); }
  }, []);

  // ── Firestore: shared (crew + routes) ─────────────────────
  useEffect(() => {
    if (authStep !== "app") return;
    const unsub = onSnapshot(SHARED_DOC, (snap) => {
      isRemoteShared.current = true;
      if (snap.exists()) { const d=snap.data(); setCrew(d.crew||INITIAL_CREW); setRoutes(d.routes||[]); }
      else               { setCrew(INITIAL_CREW); setRoutes([]); }
      setSyncStatus("synced"); setReady(true);
    }, () => { setSyncStatus("error"); setReady(true); });
    return () => unsub();
  }, [authStep]);

  // ── Firestore: private flights ─────────────────────────────
  useEffect(() => {
    if (authStep !== "app" || !username) return;
    const unsub = onSnapshot(flightDoc(username), (snap) => {
      isRemoteFlights.current = true;
      setFlights(snap.exists() ? (snap.data().flights||[]) : []);
    }, () => {});
    return () => unsub();
  }, [authStep, username]);

  // ── Write shared ───────────────────────────────────────────
  useEffect(() => {
    if (!ready || authStep!=="app") return;
    if (isRemoteShared.current) { isRemoteShared.current=false; return; }
    setDoc(SHARED_DOC, { crew, routes }).catch(()=>setSyncStatus("error"));
  }, [crew, routes, ready, authStep]);

  // ── Write private flights ──────────────────────────────────
  useEffect(() => {
    if (!ready || authStep!=="app" || !username) return;
    if (isRemoteFlights.current) { isRemoteFlights.current=false; return; }
    setDoc(flightDoc(username), { flights }).catch(()=>setSyncStatus("error"));
  }, [flights, ready, authStep, username]);

  // ── Auth handlers ──────────────────────────────────────────
  const submitPasscode = () => {
    if (passcodeInput === APP_PASSCODE) {
      localStorage.setItem("cl-auth","ok"); setPasscodeErr("");
      const saved = localStorage.getItem("cl-username");
      if (saved) { setUsername(saved); setAuthStep("app"); } else setAuthStep("username");
    } else { setPasscodeErr("密碼錯誤 Wrong passcode ✈"); setPasscodeInput(""); }
  };

  const submitUsername = () => {
    const name = usernameInput.trim();
    if (!name)        { setUsernameErr("請輸入你的名字 Enter your name"); return; }
    if (name.length>20){ setUsernameErr("名字太長了 Too long"); return; }
    localStorage.setItem("cl-username", name);
    setUsername(name); setAuthStep("app");
  };

  const logout = () => {
    localStorage.removeItem("cl-auth"); localStorage.removeItem("cl-username");
    setUsername(""); setPasscodeInput(""); setAuthStep("passcode");
    setReady(false); setCrew([]); setFlights([]); setRoutes([]);
  };

  // ── App helpers ────────────────────────────────────────────
  const patchCrew = (id,patch) => setCrew(cr=>cr.map(m=>m.id===id?{...m,...patch}:m));
  const flipTag   = (id,tag)   => setCrew(cr=>cr.map(m=>{
    if(m.id!==id) return m;
    return {...m,tags:m.tags.includes(tag)?m.tags.filter(t=>t!==tag):[...m.tags,tag]};
  }));

  const goProfile = (id) => { setProfileId(id); setEditNotes(false); setConfirmDel(null); setView("profile"); };

  const openQL = (id=null, flightToEdit=null) => {
    if (flightToEdit) {
      const m=crew.find(x=>x.id===flightToEdit.crewId);
      setForm({crewId:flightToEdit.crewId,crewTxt:m?`${m.nickname} — ${m.name}`:"",date:flightToEdit.date,flightNum:flightToEdit.flightNum||"",route:flightToEdit.route||"",aircraft:flightToEdit.aircraft||"",position:flightToEdit.position||"",memo:flightToEdit.memo||"",status:null,tags:[]});
      setEditFlightId(flightToEdit.id);
    } else {
      const f={...EMPTY,date:today()};
      if(id){const m=crew.find(x=>x.id===id);if(m){f.crewId=m.id;f.crewTxt=`${m.nickname} — ${m.name}`;f.status=m.status;f.tags=[...m.tags];}}
      setForm(f); setEditFlightId(null);
    }
    setSugg([]); setAddR(false); setView("quicklog");
  };

  const handleCrewInput = (val) => {
    setForm(f=>({...f,crewTxt:val,crewId:""}));
    if(!val.trim()){setSugg([]);return;}
    const q=val.toLowerCase();
    setSugg(crew.filter(m=>m.id.includes(q)||m.name.toLowerCase().includes(q)||m.nickname.toLowerCase().includes(q)).slice(0,5));
  };

  const pickCrew = (m) => {
    setForm(f=>({...f,crewId:m.id,crewTxt:`${m.nickname} — ${m.name}`,status:m.status??f.status,tags:[...m.tags]}));
    setSugg([]);
  };

  const saveLog = () => {
    if(!form.crewId||!form.date) return;
    const entry={id:editFlightId||mkId(),crewId:form.crewId,date:form.date,flightNum:form.flightNum,route:form.route,aircraft:form.aircraft,position:form.position,memo:form.memo};
    if(editFlightId){ setFlights(fl=>fl.map(f=>f.id===editFlightId?entry:f)); }
    else {
      setFlights(fl=>[...fl,entry]);
      setCrew(cr=>cr.map(m=>{if(m.id!==form.crewId)return m;return{...m,status:form.status??m.status,tags:[...new Set([...m.tags,...form.tags])]};} ));
    }
    setForm(EMPTY); setEditFlightId(null);
    setView(profileId===form.crewId?"profile":"dashboard");
  };

  const deleteFlight = (id) => { setFlights(fl=>fl.filter(f=>f.id!==id)); setConfirmDel(null); };

  const saveRoute = () => {
    if(!rf.num.trim()) return;
    setRoutes(r=>[...r,{id:mkId(),flightNum:rf.num.trim(),route:rf.route.trim(),aircraft:rf.ac}]);
    setRf({num:"",route:"",ac:""}); setAddR(false);
  };

  const addNewCrew = () => {
    setAddCrewErr("");
    if(!newCrew.id.trim()||!newCrew.nickname.trim()){setAddCrewErr("ID 和英文名為必填");return;}
    if(crew.find(m=>m.id===newCrew.id.trim())){setAddCrewErr("此 ID 已存在");return;}
    setCrew(cr=>[...cr,{id:newCrew.id.trim(),name:newCrew.name.trim(),nickname:newCrew.nickname.trim(),seniority:newCrew.seniority.trim(),status:null,tags:[],notes:""}]);
    setNewCrew({id:"",name:"",nickname:"",seniority:""});
  };

  const exportJSON = () => {
    const blob=new Blob([JSON.stringify({crew,flights,routes,user:username,at:new Date().toISOString()},null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`crewlog-${username}-${today()}.json`;a.click();
  };

  // ── Derived ────────────────────────────────────────────────
  const pMember  = crew.find(m=>m.id===profileId);
  const pFlights = flights.filter(f=>f.crewId===profileId).sort((a,b)=>new Date(b.date)-new Date(a.date));

  const lastFlownMap = {};
  flights.forEach(f=>{if(!lastFlownMap[f.crewId]||f.date>lastFlownMap[f.crewId])lastFlownMap[f.crewId]=f.date;});

  const recentIds = [...new Set([...flights].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(f=>f.crewId))].slice(0,3);

  const filtered = crew
    .filter(m=>{
      const q=search.toLowerCase();
      const memoMatch=search.length>1&&flights.filter(f=>f.crewId===m.id).some(f=>(f.memo||"").toLowerCase().includes(q));
      const basic=!q||m.id.includes(q)||m.name.toLowerCase().includes(q)||m.nickname.toLowerCase().includes(q)||memoMatch;
      return basic&&(!filterTag||m.tags.includes(filterTag));
    })
    .sort((a,b)=>{
      if(sortMode==="recent"){const la=lastFlownMap[a.id]||"0000",lb=lastFlownMap[b.id]||"0000";return lb.localeCompare(la);}
      return a.nickname.localeCompare(b.nickname,"ja");
    });

  // ── Atoms ──────────────────────────────────────────────────
  const Dot=({status,sz=10})=>{
    const col=status?STATUS_MAP[status].color:c.border;
    return <span style={{display:"inline-block",width:sz,height:sz,borderRadius:"50%",background:col,flexShrink:0,boxShadow:status?`0 0 6px ${col}70`:0}}/>;
  };
  const Tag=({on,onClick,children})=>(
    <button onClick={onClick} style={{background:on?c.accent:c.pill,color:on?c.adk:c.sub,border:"none",borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>{children}</button>
  );
  const Sect=({label,children})=>(
    <div style={{marginBottom:18}}>
      <div style={{fontSize:10,letterSpacing:3,color:c.sub,fontWeight:700,marginBottom:8}}>{label}</div>
      {children}
    </div>
  );
  const inp={background:c.input,border:`1px solid ${c.border}`,borderRadius:12,padding:"11px 14px",color:c.text,fontSize:14,fontFamily:"inherit",outline:"none",width:"100%"};
  const NavBar=({title,sub,onBack,right})=>(
    <div style={{padding:"16px 16px 12px",background:c.card,borderBottom:`1px solid ${c.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
      {onBack&&<button onClick={onBack} style={{background:c.pill,border:"none",color:c.sub,borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:18,flexShrink:0}}>←</button>}
      <div style={{flex:1}}>
        <div style={{fontSize:9,letterSpacing:4,color:c.accent,fontWeight:700}}>{sub}</div>
        <div style={{fontSize:18,fontWeight:800,color:c.text}}>{title}</div>
      </div>
      {right}
    </div>
  );
  const SyncBadge=()=>{
    const map={loading:{icon:"⏳",color:c.sub},synced:{icon:"☁️",color:"#30D158"},error:{icon:"⚠️",color:"#FF453A"}};
    const s=map[syncStatus];
    return <span style={{fontSize:13,color:s.color}}>{s.icon}</span>;
  };

  const globalStyle=`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Noto+Sans+JP:wght@300;400;500;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
    body{background:${c.bg};}
    input,textarea,button{font-family:'Syne','Noto Sans JP',sans-serif;}
    input::placeholder,textarea::placeholder{color:${c.sub};opacity:1;}
    ::-webkit-scrollbar{width:3px;height:3px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:${c.border};border-radius:2px;}
    input[type=date]::-webkit-calendar-picker-indicator{filter:${dark?"invert(0.65)":"none"};opacity:0.7;}
    button{transition:transform .1s,opacity .1s;}
    button:active{transform:scale(0.93);opacity:0.8;}
    textarea{outline:none;}
  `;

  // ════════════════════════════════════════════════════════════
  // AUTH SCREENS
  // ════════════════════════════════════════════════════════════
  if (authStep==="loading") return (
    <div style={{background:"#0B0C14",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:"#F5B731",fontSize:20,letterSpacing:4,fontFamily:"sans-serif"}}>✈ LOADING...</span>
    </div>
  );

  if (authStep==="passcode") return (
    <div style={{background:c.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32}}>
      <style>{globalStyle}</style>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:52,marginBottom:12}}>✈</div>
          <div style={{fontSize:9,letterSpacing:5,color:c.accent,fontWeight:700,marginBottom:6}}>CREW LOG</div>
          <div style={{fontSize:26,fontWeight:800,color:c.text,lineHeight:1.2}}>空中生存指南</div>
          <div style={{fontSize:13,color:c.sub,marginTop:8}}>Enter passcode to continue</div>
        </div>
        <div style={{background:c.card,borderRadius:20,padding:24,border:`1px solid ${c.border}`}}>
          <div style={{fontSize:10,letterSpacing:3,color:c.sub,fontWeight:700,marginBottom:8}}>通關密語 PASSCODE</div>
          <input type="password" value={passcodeInput} onChange={e=>setPasscodeInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submitPasscode()}
            placeholder="••••••••" autoFocus
            style={{...inp,marginBottom:passcodeErr?8:16,fontSize:20,letterSpacing:6,textAlign:"center"}}/>
          {passcodeErr&&<div style={{color:"#FF453A",fontSize:12,marginBottom:12,textAlign:"center"}}>{passcodeErr}</div>}
          <button onClick={submitPasscode} style={{width:"100%",background:c.accent,color:c.adk,border:"none",borderRadius:14,padding:"14px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",letterSpacing:1}}>
            進入 ENTER ✈
          </button>
        </div>
      </div>
    </div>
  );

  if (authStep==="username") return (
    <div style={{background:c.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32}}>
      <style>{globalStyle}</style>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:10}}>👋</div>
          <div style={{fontSize:22,fontWeight:800,color:c.text}}>你叫什麼名字？</div>
          <div style={{fontSize:13,color:c.sub,marginTop:8,lineHeight:1.7}}>
            Pick a name to identify yourself.<br/>
            Your flight logs will be <strong style={{color:c.accent}}>private</strong> — only you can see them.
          </div>
        </div>
        <div style={{background:c.card,borderRadius:20,padding:24,border:`1px solid ${c.border}`}}>
          <div style={{fontSize:10,letterSpacing:3,color:c.sub,fontWeight:700,marginBottom:8}}>你的名字 YOUR NAME</div>
          <input value={usernameInput} onChange={e=>setUsernameInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submitUsername()}
            placeholder="e.g. Erika, Hanae, Summer..." autoFocus
            style={{...inp,marginBottom:usernameErr?8:16,fontSize:18,textAlign:"center"}}/>
          {usernameErr&&<div style={{color:"#FF453A",fontSize:12,marginBottom:12,textAlign:"center"}}>{usernameErr}</div>}
          <button onClick={submitUsername} style={{width:"100%",background:c.accent,color:c.adk,border:"none",borderRadius:14,padding:"14px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
            開始 START 🚀
          </button>
        </div>
      </div>
    </div>
  );

  if (!ready) return (
    <div style={{background:"#0B0C14",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
      <span style={{color:"#F5B731",fontSize:20,letterSpacing:4,fontFamily:"sans-serif"}}>✈ LOADING...</span>
      <span style={{color:"#6B7499",fontSize:12,letterSpacing:2}}>連接雲端資料庫...</span>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════
  const DashView=()=>(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>
      <div style={{padding:"18px 16px 12px",background:c.card,borderBottom:`1px solid ${c.border}`,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:9,letterSpacing:4,color:c.accent,fontWeight:700,marginBottom:2}}>CREW LOG ✈ 空中生存指南</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:22,fontWeight:800,color:c.text}}>Dashboard</div>
              <SyncBadge/>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={exportJSON} style={{background:c.pill,border:"none",color:c.sub,borderRadius:10,padding:"8px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>⬇ 備份</button>
            <button onClick={()=>setDark(d=>!d)} style={{background:c.pill,border:"none",color:c.sub,borderRadius:10,padding:"8px 10px",cursor:"pointer",fontSize:16}}>{dark?"☀":"🌙"}</button>
          </div>
        </div>

        {/* User banner */}
        <div style={{background:c.pill,borderRadius:12,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>👤</span>
            <span style={{fontSize:13,fontWeight:700,color:c.text}}>{username}</span>
            <span style={{fontSize:11,color:c.sub}}>· {flights.length} 筆私人記錄</span>
          </div>
          <button onClick={logout} style={{background:"none",border:"none",color:c.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit",padding:"2px 6px"}}>登出</button>
        </div>

        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:c.sub}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ID / 姓名 / Nickname / 備忘..."
            style={{...inp,paddingLeft:36}}/>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"14px 16px 80px"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
          <Tag on={!filterTag} onClick={()=>setFilterTag(null)}>ALL</Tag>
          {PRESET_TAGS.map(t=><Tag key={t} on={filterTag===t} onClick={()=>setFilterTag(filterTag===t?null:t)}>{t}</Tag>)}
          <div style={{marginLeft:"auto",display:"flex",gap:4}}>
            <button onClick={()=>setSortMode("alpha")} style={{background:sortMode==="alpha"?c.accent:c.pill,color:sortMode==="alpha"?c.adk:c.sub,border:"none",borderRadius:10,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>A–Z</button>
            <button onClick={()=>setSortMode("recent")} style={{background:sortMode==="recent"?c.accent:c.pill,color:sortMode==="recent"?c.adk:c.sub,border:"none",borderRadius:10,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>最近</button>
          </div>
        </div>

        {recentIds.length>0&&!search&&!filterTag&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:9,letterSpacing:3,color:c.sub,fontWeight:700,marginBottom:8}}>我的最近合飛 MY RECENT</div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
              {recentIds.map(id=>{
                const m=crew.find(x=>x.id===id);if(!m)return null;
                const last=flights.filter(f=>f.crewId===id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
                const si=m.status?STATUS_MAP[m.status]:null;
                return(
                  <div key={id} onClick={()=>goProfile(id)} style={{background:si?si.bg:c.card,border:`1px solid ${si?si.border:c.border}`,borderRadius:14,padding:"10px 12px",minWidth:115,flexShrink:0,cursor:"pointer"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}><Dot status={m.status} sz={8}/><span style={{fontWeight:800,fontSize:15,color:c.text}}>{m.nickname}</span></div>
                    <div style={{fontSize:11,color:c.sub,marginBottom:5}}>{m.name}</div>
                    {last&&<div style={{fontSize:11,color:c.accent,fontWeight:600}}>{last.date}</div>}
                    <button onClick={e=>{e.stopPropagation();openQL(id)}} style={{marginTop:5,background:c.accent,color:c.adk,border:"none",borderRadius:8,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ 新增</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{fontSize:9,letterSpacing:3,color:c.sub,fontWeight:700,marginBottom:10}}>全部組員 ALL CREW ({filtered.length})</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(m=>{
            const si=m.status?STATUS_MAP[m.status]:null;
            const last=flights.filter(f=>f.crewId===m.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
            const memoMatch=search.length>1&&flights.filter(f=>f.crewId===m.id).some(f=>(f.memo||"").toLowerCase().includes(search.toLowerCase()));
            return(
              <div key={m.id} onClick={()=>goProfile(m.id)} style={{background:si?si.bg:c.card,border:`1px solid ${si?si.border:c.border}`,borderRadius:14,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,outline:memoMatch?`2px solid ${c.accent}`:"none"}}>
                <Dot status={m.status} sz={12}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:3}}>
                    <span style={{fontWeight:800,fontSize:16,color:c.text}}>{m.nickname}</span>
                    <span style={{fontSize:13,color:c.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
                    <span style={{fontSize:10,color:c.accent,fontWeight:700,marginLeft:"auto",flexShrink:0}}>{m.seniority}</span>
                  </div>
                  <div style={{fontSize:11,color:c.sub,marginBottom:m.tags.length?4:0}}>#{m.id}{memoMatch&&<span style={{color:c.accent,marginLeft:6}}>📝 備忘符合</span>}</div>
                  {m.tags.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{m.tags.map(t=><span key={t} style={{background:c.pill,color:c.sub,borderRadius:10,padding:"2px 7px",fontSize:10,fontWeight:600}}>{t}</span>)}</div>}
                </div>
                <div style={{flexShrink:0,textAlign:"right"}}>
                  <div style={{fontSize:11,color:last?c.sub:c.border}}>{last?last.date:"—"}</div>
                  <button onClick={e=>{e.stopPropagation();openQL(m.id)}} style={{marginTop:4,background:c.pill,color:c.accent,border:"none",borderRadius:8,padding:"4px 10px",fontSize:14,fontWeight:700,cursor:"pointer"}}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{marginTop:24,background:c.card,border:`1px dashed ${c.border}`,borderRadius:16,padding:16}}>
          <div style={{fontSize:10,letterSpacing:3,color:c.accent,fontWeight:700,marginBottom:4}}>新增組員 ADD CREW</div>
          <div style={{fontSize:10,color:c.sub,marginBottom:12}}>⚠ Shared with all users</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input value={newCrew.id} onChange={e=>setNewCrew(n=>({...n,id:e.target.value}))} placeholder="員工 ID *" style={{...inp,fontSize:13,padding:"9px 12px"}}/>
            <input value={newCrew.nickname} onChange={e=>setNewCrew(n=>({...n,nickname:e.target.value}))} placeholder="Nickname *" style={{...inp,fontSize:13,padding:"9px 12px"}}/>
            <input value={newCrew.name} onChange={e=>setNewCrew(n=>({...n,name:e.target.value}))} placeholder="姓名 (中文/日文)" style={{...inp,fontSize:13,padding:"9px 12px"}}/>
            <input value={newCrew.seniority} onChange={e=>setNewCrew(n=>({...n,seniority:e.target.value}))} placeholder="期別 e.g. 24G" style={{...inp,fontSize:13,padding:"9px 12px"}}/>
          </div>
          {addCrewErr&&<div style={{color:"#FF453A",fontSize:12,marginBottom:8}}>{addCrewErr}</div>}
          <button onClick={addNewCrew} style={{width:"100%",background:c.accent,color:c.adk,border:"none",borderRadius:12,padding:"10px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ 新增 Add Member</button>
        </div>
      </div>

      <button onClick={()=>openQL()} style={{position:"fixed",bottom:24,right:24,background:c.accent,color:c.adk,border:"none",borderRadius:"50%",width:58,height:58,fontSize:28,fontWeight:700,cursor:"pointer",boxShadow:`0 4px 24px ${c.accent}66`,display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>+</button>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // QUICK-LOG
  // ════════════════════════════════════════════════════════════
  const QLView=()=>(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>
      <NavBar sub={editFlightId?"EDIT LOG":"QUICK-LOG"} title={editFlightId?"編輯飛行紀錄":"新增飛行紀錄"}
        onBack={()=>{setView(profileId===form.crewId?"profile":"dashboard");setEditFlightId(null);}}/>
      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 32px"}}>
        <Sect label="組員 CREW MEMBER">
          <div style={{position:"relative"}}>
            <input value={form.crewTxt} onChange={e=>handleCrewInput(e.target.value)} placeholder="搜尋 ID / 姓名 / Nickname..."
              disabled={!!editFlightId} style={{...inp,border:`1px solid ${form.crewId?c.accent:c.border}`,opacity:editFlightId?0.7:1}}/>
            {sugg.length>0&&(
              <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:c.card,border:`1px solid ${c.border}`,borderRadius:12,overflow:"hidden",zIndex:99,boxShadow:"0 8px 32px rgba(0,0,0,.4)"}}>
                {sugg.map(m=>(
                  <div key={m.id} onClick={()=>pickCrew(m)} style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${c.border}`,display:"flex",alignItems:"center",gap:10}}>
                    <Dot status={m.status} sz={9}/>
                    <span style={{fontWeight:700,color:c.text}}>{m.nickname}</span>
                    <span style={{color:c.sub,fontSize:12}}>{m.name}</span>
                    <span style={{color:c.sub,fontSize:11,marginLeft:"auto"}}>#{m.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {form.crewId&&<div style={{marginTop:5,fontSize:12,color:c.accent,fontWeight:600}}>✓ ID: {form.crewId}</div>}
        </Sect>

        <Sect label="日期 DATE">
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp}/>
        </Sect>

        <Sect label="航班 FLIGHT">
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            {routes.map(r=>(
              <button key={r.id} onClick={()=>setForm(f=>({...f,flightNum:r.flightNum,route:r.route,aircraft:r.aircraft}))}
                style={{background:form.flightNum===r.flightNum?c.accent:c.pill,color:form.flightNum===r.flightNum?c.adk:c.sub,border:"none",borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                {r.flightNum}{r.route&&` · ${r.route}`}
              </button>
            ))}
            <button onClick={()=>setAddR(v=>!v)} style={{background:"transparent",border:`1px dashed ${c.border}`,color:c.sub,borderRadius:10,padding:"5px 12px",fontSize:12,cursor:"pointer"}}>{addR?"▲":"+"} 新增航班</button>
          </div>
          {addR&&(
            <div style={{background:c.cardAlt,border:`1px solid ${c.border}`,borderRadius:12,padding:12,marginBottom:10}}>
              <div style={{fontSize:9,letterSpacing:3,color:c.accent,fontWeight:700,marginBottom:8}}>ADD ROUTE</div>
              <input value={rf.num} onChange={e=>setRf(r=>({...r,num:e.target.value}))} placeholder="航班號 e.g. CI001" style={{...inp,marginBottom:6,borderRadius:10,padding:"8px 12px",fontSize:13}}/>
              <input value={rf.route} onChange={e=>setRf(r=>({...r,route:e.target.value}))} placeholder="航線 e.g. TPE→NRT" style={{...inp,marginBottom:6,borderRadius:10,padding:"8px 12px",fontSize:13}}/>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                {AIRCRAFT.map(a=><button key={a} onClick={()=>setRf(r=>({...r,ac:a}))} style={{flex:1,background:rf.ac===a?c.accent:c.pill,color:rf.ac===a?c.adk:c.sub,border:"none",borderRadius:8,padding:"7px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{a}</button>)}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveRoute} style={{flex:1,background:c.accent,color:c.adk,border:"none",borderRadius:10,padding:"9px",fontSize:13,fontWeight:700,cursor:"pointer"}}>儲存</button>
                <button onClick={()=>setAddR(false)} style={{flex:1,background:c.pill,color:c.sub,border:"none",borderRadius:10,padding:"9px",fontSize:13,cursor:"pointer"}}>取消</button>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <input value={form.flightNum} onChange={e=>setForm(f=>({...f,flightNum:e.target.value}))} placeholder="航班號 No." style={{...inp,width:"auto",flex:1}}/>
            <input value={form.route} onChange={e=>setForm(f=>({...f,route:e.target.value}))} placeholder="航線 Route" style={{...inp,width:"auto",flex:1}}/>
          </div>
        </Sect>

        <Sect label="機型 AIRCRAFT">
          <div style={{display:"flex",gap:8}}>
            {AIRCRAFT.map(a=>(
              <button key={a} onClick={()=>setForm(f=>({...f,aircraft:f.aircraft===a?"":a}))} style={{flex:1,background:form.aircraft===a?c.accent:c.pill,color:form.aircraft===a?c.adk:c.sub,border:"none",borderRadius:12,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{a}</button>
            ))}
          </div>
        </Sect>

        <Sect label="職位 POSITION">
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            {POSITIONS.map(p=>(
              <button key={p} onClick={()=>setForm(f=>({...f,position:f.position===p?"":p}))} style={{background:form.position===p?c.accent:c.pill,color:form.position===p?c.adk:c.sub,border:"none",borderRadius:8,padding:"6px 12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{p}</button>
            ))}
          </div>
          <input value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="或自行輸入..." style={inp}/>
        </Sect>

        {!editFlightId&&(
          <>
            <Sect label="紅黃綠燈 STATUS">
              <div style={{display:"flex",gap:8}}>
                {Object.entries(STATUS_MAP).map(([k,v])=>(
                  <button key={k} onClick={()=>setForm(f=>({...f,status:f.status===k?null:k}))} style={{flex:1,background:form.status===k?v.bg:c.pill,border:`2px solid ${form.status===k?v.color:c.border}`,color:form.status===k?v.color:c.sub,borderRadius:14,padding:"13px 4px",fontSize:22,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <span>{v.emoji}</span><span style={{fontSize:9,fontWeight:700,letterSpacing:1}}>{k.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </Sect>
            <Sect label="標籤 TAGS">
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {PRESET_TAGS.map(t=>(
                  <button key={t} onClick={()=>setForm(f=>({...f,tags:f.tags.includes(t)?f.tags.filter(x=>x!==t):[...f.tags,t]}))} style={{background:form.tags.includes(t)?c.accent:c.pill,color:form.tags.includes(t)?c.adk:c.sub,border:"none",borderRadius:20,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{t}</button>
                ))}
              </div>
            </Sect>
          </>
        )}

        <Sect label="備忘 MEMO">
          <textarea value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} rows={3}
            placeholder="這次飛行的備忘... Notes for this flight..." style={{...inp,resize:"vertical"}}/>
        </Sect>

        <button onClick={saveLog} disabled={!form.crewId} style={{width:"100%",background:form.crewId?c.accent:"#2a2a2a",color:form.crewId?c.adk:"#555",border:"none",borderRadius:16,padding:"15px",fontSize:16,fontWeight:800,cursor:form.crewId?"pointer":"not-allowed",letterSpacing:1,fontFamily:"inherit",boxShadow:form.crewId?`0 4px 24px ${c.accent}55`:"none"}}>
          {editFlightId?"✏ 更新紀錄 UPDATE LOG":"✈ 儲存紀錄 SAVE LOG"}
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // PROFILE
  // ════════════════════════════════════════════════════════════
  const ProfView=()=>{
    if(!pMember) return null;
    const m=pMember;const si=m.status?STATUS_MAP[m.status]:null;
    return(
      <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>
        <div style={{padding:"16px 16px 14px",background:si?si.bg:c.card,borderBottom:`2px solid ${si?si.border:c.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <button onClick={()=>setView("dashboard")} style={{background:"rgba(128,128,128,0.15)",border:"none",color:c.text,borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:18}}>←</button>
            <div style={{flex:1}}/>
            <button onClick={()=>openQL(m.id)} style={{background:c.accent,color:c.adk,border:"none",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 新增飛行</button>
          </div>
          {si&&<div style={{background:si.bg,border:`1px solid ${si.border}`,borderRadius:10,padding:"7px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>{si.emoji}</span><span style={{color:si.color,fontWeight:800,fontSize:13}}>{si.label}</span></div>}
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
            <div style={{width:54,height:54,borderRadius:16,flexShrink:0,background:si?si.bg:c.pill,border:`2px solid ${si?si.color:c.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:si?si.color:c.accent}}>{m.nickname[0]}</div>
            <div>
              <div style={{fontSize:22,fontWeight:800,color:c.text,lineHeight:1.1}}>{m.nickname}</div>
              <div style={{fontSize:14,color:c.sub}}>{m.name}</div>
              <div style={{fontSize:11,color:c.accent,fontWeight:700,marginTop:2}}>{m.seniority} · #{m.id} · {pFlights.length} 次 (我的)</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            {Object.entries(STATUS_MAP).map(([k,v])=>(
              <button key={k} onClick={()=>patchCrew(m.id,{status:m.status===k?null:k})} style={{flex:1,background:m.status===k?v.bg:c.pill,border:`1px solid ${m.status===k?v.color:c.border}`,color:m.status===k?v.color:c.sub,borderRadius:10,padding:"7px 4px",fontSize:16,cursor:"pointer"}}>{v.emoji}</button>
            ))}
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"14px 16px 32px"}}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:3,color:c.sub,fontWeight:700,marginBottom:8}}>標籤 TAGS <span style={{fontWeight:400,fontSize:8}}>(everyone sees this)</span></div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {PRESET_TAGS.map(t=>(
                <button key={t} onClick={()=>flipTag(m.id,t)} style={{background:m.tags.includes(t)?c.accent:c.pill,color:m.tags.includes(t)?c.adk:c.sub,border:"none",borderRadius:20,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:3,color:c.sub,fontWeight:700,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>長期筆記 NOTES <span style={{fontWeight:400,fontSize:8}}>(everyone sees this)</span></span>
              <button onClick={()=>{if(editNotes){patchCrew(m.id,{notes:tempNotes});setEditNotes(false);}else{setTempNotes(m.notes);setEditNotes(true);}}} style={{background:"none",border:"none",color:c.accent,fontSize:12,fontWeight:700,cursor:"pointer"}}>{editNotes?"💾 儲存":"✏ 編輯"}</button>
            </div>
            {editNotes
              ?<textarea value={tempNotes} onChange={e=>setTempNotes(e.target.value)} rows={3} style={{...inp,resize:"vertical",border:`1px solid ${c.accent}`}}/>
              :<div style={{background:c.cardAlt,border:`1px solid ${c.border}`,borderRadius:12,padding:"11px 14px",color:m.notes?c.text:c.sub,fontSize:14,minHeight:48,lineHeight:1.6}}>{m.notes||"尚無備忘。No notes yet."}</div>
            }
          </div>

          <div>
            <div style={{fontSize:9,letterSpacing:3,color:c.sub,fontWeight:700,marginBottom:14}}>
              我的合飛紀錄 MY HISTORY ({pFlights.length})
              <span style={{fontWeight:400,fontSize:8,marginLeft:6}}>🔒 only you can see this</span>
            </div>
            {pFlights.length===0
              ?<div style={{textAlign:"center",color:c.sub,fontSize:14,padding:"28px 0"}}>尚無紀錄<br/>No flights logged yet</div>
              :<div style={{position:"relative"}}>
                <div style={{position:"absolute",left:15,top:6,bottom:6,width:1,background:c.border}}/>
                {pFlights.map(f=>(
                  <div key={f.id} style={{position:"relative",paddingLeft:38,marginBottom:14}}>
                    <div style={{position:"absolute",left:9,top:14,width:13,height:13,borderRadius:"50%",background:c.accent,border:`2px solid ${c.bg}`}}/>
                    <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:12,padding:"10px 12px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                        <span style={{fontWeight:700,color:c.text,fontSize:14}}>{f.flightNum||"—"}{f.route&&<span style={{color:c.sub,fontSize:12,fontWeight:400,marginLeft:8}}>{f.route}</span>}</span>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:8}}>
                          <span style={{fontSize:11,color:c.sub}}>{f.date}</span>
                          <button onClick={()=>openQL(null,f)} style={{background:"none",border:"none",color:c.sub,cursor:"pointer",fontSize:13,padding:"0 2px"}}>✏</button>
                          {confirmDel===f.id
                            ?<div style={{display:"flex",gap:4}}>
                              <button onClick={()=>deleteFlight(f.id)} style={{background:"#FF453A",color:"#fff",border:"none",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>確認刪除</button>
                              <button onClick={()=>setConfirmDel(null)} style={{background:c.pill,color:c.sub,border:"none",borderRadius:6,padding:"2px 6px",fontSize:11,cursor:"pointer"}}>取消</button>
                            </div>
                            :<button onClick={()=>setConfirmDel(f.id)} style={{background:"none",border:"none",color:"#FF453A",cursor:"pointer",fontSize:13,padding:"0 2px"}}>🗑</button>
                          }
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:f.memo?5:0}}>
                        {f.aircraft&&<span style={{background:c.pill,color:c.accent,borderRadius:8,padding:"2px 8px",fontSize:11,fontWeight:700}}>{f.aircraft}</span>}
                        {f.position&&<span style={{background:c.pill,color:c.sub,borderRadius:8,padding:"2px 8px",fontSize:11}}>{f.position}</span>}
                      </div>
                      {f.memo&&<div style={{fontSize:13,color:c.sub,borderTop:`1px solid ${c.border}`,paddingTop:5,marginTop:2}}>📝 {f.memo}</div>}
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{globalStyle}</style>
      <div style={{fontFamily:"'Syne','Noto Sans JP',sans-serif",background:c.bg,color:c.text,minHeight:"100vh",maxWidth:440,margin:"0 auto",boxShadow:"0 0 80px rgba(0,0,0,0.5)"}}>
        {view==="dashboard"&&<DashView/>}
        {view==="quicklog"&&<QLView/>}
        {view==="profile"&&<ProfView/>}
      </div>
    </>
  );
}
