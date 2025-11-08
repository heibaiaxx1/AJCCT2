import cloudbase from "https://static.cloudbase.net/cloudbase-js-sdk/2.15.1/cloudbase.full.js";

// Fix: Add type declarations for cloudbase SDK and custom window properties.
declare var cloudbase: any;
declare global {
    interface Window {
        _debugDateOffset: number;
    }
}

// Fix: Add interfaces for state management to fix property access errors.
interface FlipCounterCol {
  stack: HTMLDivElement;
  value: number;
  pos: number;
  wrapPos: number;
}

interface Task {
  id: string;
  title: string;
  difficulty: number;
  totalHQ: number;
  totalSeconds: number;
  reward?: { type: string; amount: number };
}

interface Agg {
  totalHQ: number;
  totalSeconds: number;
}

interface BadgeMeta {
    rare_gem: number;
    epic_gem: number;
    rare_tokens: number;
    epic_tokens: number;
    legendary_tokens: number;
    owned: Record<string, any>;
    loadout: { slot1: any; slot2: any; slot3: any };
    loadoutCooldownUntil: number;
}

interface FunshopActivity {
    id: string;
    title: string;
    seconds: number;
    need: Record<string, number>;
    wear: Record<string, number>;
    timeWindow: { start: string, end: string } | null;
    running: { until: number } | null;
}

interface FunshopMeta {
    activities: FunshopActivity[];
    wearAccum: Record<string, number>;
}

interface CharacterMeta {
    name: string;
    title: string;
    avatar: string | null;
}

interface Buff {
    name: string;
    expiresAt: number;
}

interface Meta {
  streak: number;
  pity: number;
  arcade: boolean;
  freeze: number;
  badges: BadgeMeta;
  tickets: number;
  daily: Record<string, any>;
  dailyBuff: Record<string, any>;
  multDayCount: Record<string, any>;
  guardUsedToday: number;
  guardDay: string | null;
  nextWheelBoost: number;
  completed: Record<string, any>;
  funshop: FunshopMeta;
  character: CharacterMeta;
  buffs: Buff[];
}

interface ActiveTimer {
    taskId: string;
    startTime: number | null;
    accumulatedSeconds: number;
    isPaused: boolean;
    pauseTime: number | null;
    pauses: number;
}

interface State {
    tasks: Task[];
    agg: Agg;
    active: ActiveTimer | null;
    selectedTaskId: string | null;
}

interface RenderedState {
    sessionHQ?: number;
    sessionTime?: string;
    taskTotalHQ?: number;
    taskTime?: string;
    kpiTotalHQ?: number;
    charStatus?: string;
    activeBuffs?: string;
    headerKey?: string;
}


document.addEventListener('DOMContentLoaded', ()=>{

// ⚠️ ========================================================== ⚠️
// ⚠️  在此处粘贴你的腾讯云 CloudBase 环境 ID!
// ⚠️  Get it from your TCB project settings.
// ⚠️ ========================================================== ⚠️
const cloudbaseConfig = {
  env: "cloud1-4g8gnb2uda2a2c54"
};

// ====================================================================
// =================== 坚不可摧的初始化与 CloudBase 逻辑 ==================
// ====================================================================

let isCloudBaseConfigured = cloudbaseConfig && cloudbaseConfig.env && cloudbaseConfig.env !== "YOUR_TCB_ENV_ID";
let app: any, auth: any, db: any, realtimeListener: any = null;

if (isCloudBaseConfigured) {
  if (typeof cloudbase === 'undefined') {
    console.error("CloudBase SDK not loaded. Please check your network connection and ad blockers.");
    alert("CloudBase SDK 脚本加载失败，请检查网络连接或浏览器插件。应用将以本地模式运行。");
    isCloudBaseConfigured = false;
  } else {
    try {
      app = cloudbase.init(cloudbaseConfig);
      auth = app.auth({ persistence: "local" });
      db = app.database();
      console.log("Tencent CloudBase initialized successfully.");
    } catch (e: any) {
      console.error("CloudBase initialization failed:", e);
      alert(`CloudBase 初始化失败，请检查您的配置。\n\n错误详情: ${e.message || e.toString()}\n\n应用将以本地模式运行。`);
      isCloudBaseConfigured = false;
    }
  }
} else {
  console.warn("CloudBase is not configured. Running in local-only mode.");
}


/* ========== 存储兜底层 ========== */
const localStore = (() => {
  try {
    const t = '__hq_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch (e) {
    const m = new Map();
    return {
      getItem: (k: string) => (m.has(k) ? m.get(k) : null),
      setItem: (k: string, v: string) => m.set(k, v),
      removeItem: (k: string) => m.delete(k)
    };
  }
})();

const readJSON = (key: string, fallback: any) => {
  try { const s = localStore.getItem(key); return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
};
const writeJSON = (key: string, val: any) => {
  try { localStore.setItem(key, JSON.stringify(val)); } catch {}
};

/* ========== 静态数据（省略无关注释） ========== */
const PRIZE_NAMES = ['特等奖','一等奖','二等奖','三等奖','四等奖','五等奖','六等奖','七等奖'];
const WHEEL_SEGMENTS = PRIZE_NAMES.map((name, i) => {
  const types = ['hq','rare','epic','freeze'];
  const colors = ['#6f87ff','#28c686','#c38bff','#ff7b92'];
  return { type: types[i % types.length], label: name, color: colors[i % types.length] };
});

class FlipCounter{
  // Fix: Declare class properties for FlipCounter
  digits: number;
  comma: boolean;
  cellHeight: number;
  root: HTMLDivElement;
  cols: FlipCounterCol[];

  constructor(container: HTMLElement,{digits=6,small=false,comma=true,large=false}={}){
    this.digits=digits;this.comma=comma;this.cellHeight=small?24:(large?48:32);
    this.root=document.createElement('div');this.root.className='flip'+(small?' small':'')+(large?' large':'');this.cols=[];
    for(let i=0;i<this.digits;i++){
      const col=document.createElement('div');col.className='col';
      const stack=document.createElement('div');stack.className='digits';
      // Fix: Convert number to string for textContent
      for(let d=0;d<=9;d++){const cell=document.createElement('div');cell.className='digit';cell.textContent=String(d);stack.appendChild(cell)}
      // Fix: Convert number to string for textContent
      for(const e of [0,1]){const cell=document.createElement('div');cell.className='digit';cell.textContent=String(e);stack.appendChild(cell)}
      col.appendChild(stack);this.root.appendChild(col);this.cols.push({stack,value:0,pos:0,wrapPos:stack.childElementCount-2});
      if(this.comma&&(this.digits-i)%3===1&&i!==this.digits-1){const sep=document.createElement('div');sep.className='sep';sep.textContent=',';this.root.appendChild(sep)}
    }
    container.innerHTML='';container.appendChild(this.root);
    const sample=this.root.querySelector('.digit') as HTMLElement; if(sample){const rect=sample.getBoundingClientRect(); if(rect&&rect.height){this.cellHeight=rect.height;}}
    this.setValue(0,true)
  }
  _str(n: number){return Math.floor(n).toString().padStart(this.digits,'0').slice(-this.digits)}
  setValue(n: number,instant=false){
    const s=this._str(n);
    [...s].forEach((ch,i)=>{const v=ch.charCodeAt(0)-48;const c=this.cols[i];c.value=v;c.pos=v;
      if(instant)c.stack.style.transition='none';
      c.stack.style.transform=`translateY(${-c.pos*this.cellHeight}px)`;
      if(instant){void c.stack.offsetHeight;c.stack.style.transition=''}
    })
  }
  flipBy(step=1){
    for(let i=this.digits-1;i>=0;i--){
      const c=this.cols[i];const next=(c.value+step)%10;const wrap=(c.value+step)>=10;
      if(wrap){
        const wrapPos=c.wrapPos??10;
        c.pos=wrapPos;c.stack.style.transform=`translateY(${-c.pos*this.cellHeight}px)`;
        c.stack.addEventListener('transitionend',()=>{c.stack.style.transition='none';c.pos=0;c.stack.style.transform='translateY(0px)';void c.stack.offsetHeight;c.stack.style.transition=''}, {once:true});
      }else{c.pos=next;c.stack.style.transform=`translateY(${-c.pos*this.cellHeight}px)`}
      c.value=next;if(!wrap)break
    }
  }
  flipTo(n: number){
    const s=this._str(n);
    [...s].forEach((ch,i)=>{const v=ch.charCodeAt(0)-48;const c=this.cols[i];
      if(c.value===v) return;
      if(c.value===9&&v===0){
        const wrapPos=c.wrapPos??10;
        c.pos=wrapPos;c.stack.style.transform=`translateY(${-c.pos*this.cellHeight}px)`;
        c.stack.addEventListener('transitionend',()=>{c.stack.style.transition='none';c.pos=0;c.value=0;c.stack.style.transform='translateY(0px)';void c.stack.offsetHeight;c.stack.style.transition=''}, {once:true});
      }else{c.value=v;c.pos=v;c.stack.style.transform=`translateY(${-c.pos*this.cellHeight}px)`}
    })
  }
}

/* 经济参数/常量 */
const ECON={k:0.0009, baseFloorMinSec:180, streakStep:0.1, pauseBreakSec:90, bonusCapRatio:3, pityStep:1};
const LOOT_TABLE=[{id:'rare_gem',name:'稀有徽章碎片',rarity:'rare',p:0.22},{id:'epic_gem',name:'史诗徽章碎片',rarity:'epic',p:0.06},{id:'freeze_card',name:'冻结卡',rarity:'rare',p:0.10},{id:'ticket',name:'抽卡券',rarity:'rare',p:0.12}];
const REWARD_TYPES: Record<string, {label: string, apply: (amt: number) => void}> = {
  hq:{label:'豪情值',apply:amt=>{state.agg.totalHQ=(state.agg.totalHQ||0)+amt;}},
  ticket:{label:'抽卡券',apply:amt=>{meta.tickets=(meta.tickets||0)+amt;}},
  freeze:{label:'冻结卡',apply:amt=>{meta.freeze=(meta.freeze||0)+amt;}},
  rare_gem:{label:'稀有碎片',apply:amt=>{ensureBadgeMeta();meta.badges.rare_gem=(meta.badges.rare_gem||0)+amt;}},
  epic_gem:{label:'史诗碎片',apply:amt=>{ensureBadgeMeta();meta.badges.epic_gem=(meta.badges.epic_gem||0)+amt;}},
  rare_token:{label:'稀有徽章',apply:amt=>{ensureBadgeMeta();meta.badges.rare_tokens=(meta.badges.rare_tokens||0)+amt;}},
  epic_token:{label:'史诗徽章',apply:amt=>{ensureBadgeMeta();meta.badges.epic_tokens=(meta.badges.epic_tokens||0)+amt;}},
  legend_token:{label:'传说徽章',apply:amt=>{ensureBadgeMeta();meta.badges.legendary_tokens=(meta.badges.legendary_tokens||0)+amt;}}
};
const MAX_FLIPS_PER_SECOND=8, CYCLE_SECONDS_BASE=20, CIRCUM=2*Math.PI*90;

/* ========== 主逻辑 ========== */
const LS_KEYS = {
    TASKS: "haoqing_tasks_v2",
    AGG: "haoqing_agg_v2",
    META: "haoqing_meta_v2",
    RATES: "haoqing_rates_v2",
    FUNSHOP: "haoqing_funshop_v2",
    REWARD_PARAMS: "haoqing_reward_params_v2",
    SOUND_MUTED: "haoqing_sound_muted",
};
  
  const DEFAULT_RATES={1:1,2:2,3:4,4:7,5:11};
  let RATE_BY_DIFFICULTY = (()=>{ const r=readJSON(LS_KEYS.RATES,{}); return {...DEFAULT_RATES,...r} })();
  
  const DEFAULT_REWARD_PARAMS = { baseChance: 0.4, betCoefficient: 0.25, maxChance: 0.9, pityIncrement: 0.015 };
  let REWARD_PARAMS = readJSON(LS_KEYS.REWARD_PARAMS, { ...DEFAULT_REWARD_PARAMS });
  
  const getInitialState = (): State => ({
    tasks: [], 
    agg: {totalHQ:0,totalSeconds:0}, 
    active: null,
    selectedTaskId: null
  });

  const getInitialMeta = (): Meta => ({
      streak:0,pity:0,arcade:false,freeze:0,
      badges:{rare_gem:0, epic_gem:0, rare_tokens:0, epic_tokens:0, legendary_tokens:0, owned:{}, loadout:{slot1:null,slot2:null,slot3:null}, loadoutCooldownUntil:0},
      tickets:0,
      daily:{},dailyBuff:{},multDayCount:{},guardUsedToday:0,guardDay:null,nextWheelBoost:1,
      completed:{},
      funshop:{ activities:[], wearAccum:{} },
      character: { name: '', title: '', avatar: null },
      buffs: []
  });

  // Fix: Strongly type state and meta objects
  let state: State = getInitialState();
  let meta: Meta = getInitialMeta();
  let FUNSHOP: any = {};

  const loadStateFromLocalStorage = () => {
    state = { 
        tasks: readJSON(LS_KEYS.TASKS, []), 
        agg: readJSON(LS_KEYS.AGG, {totalHQ:0,totalSeconds:0}), 
        active: null, // Live timer is not persisted locally to avoid sync issues
        selectedTaskId: null
    };
    meta = readJSON(LS_KEYS.META, getInitialMeta());
    FUNSHOP = readJSON(LS_KEYS.FUNSHOP, {
        items: [
          {name:'放松呼吸训练', seconds:300, need:{rare_token:1}, wear:{rare_token:5}},
          {name:'豪情轮盘挑战', seconds:180, need:{epic_token:1}, wear:{epic_token:8}, window:{start:'19:00', end:'23:00'}},
          {name:'街机小游园', seconds:120, need:{rare_token:1}, wear:{rare_token:3, ticket:1}}
        ]
    });
    ensureBadgeMeta();
  };
  
  function resetAppToDefaults() {
      // Clear in-memory state
      state = getInitialState();
      meta = getInitialMeta();
      RATE_BY_DIFFICULTY = { ...DEFAULT_RATES };
      REWARD_PARAMS = { ...DEFAULT_REWARD_PARAMS };
      // Clear local storage
      Object.values(LS_KEYS).forEach(key => {
          // Keep sound setting
          if (key !== LS_KEYS.SOUND_MUTED) {
            localStore.removeItem(key);
          }
      });
      // Re-initialize with defaults, this time from memory, not storage
      loadStateFromLocalStorage();
      renderInitial();
      console.log("App has been reset to a clean state.");
  }

  const applyCloudData = (data: any) => {
    try {
        state.tasks = data.tasks || [];
        state.agg = data.agg || {totalHQ: 0, totalSeconds: 0};
        state.active = data.active || null; // Sync live timer state
        meta = { ...getInitialMeta(), ...data.meta };
        RATE_BY_DIFFICULTY = data.rates || DEFAULT_RATES;
        FUNSHOP = data.funshop || FUNSHOP;
        REWARD_PARAMS = data.rewardParams || DEFAULT_REWARD_PARAMS;
        ensureBadgeMeta();
        
        // Save the synced data to local storage for offline use
        writeJSON(LS_KEYS.TASKS, state.tasks);
        writeJSON(LS_KEYS.AGG, state.agg);
        writeJSON(LS_KEYS.META, meta);
        writeJSON(LS_KEYS.RATES, RATE_BY_DIFFICULTY);
        writeJSON(LS_KEYS.FUNSHOP, FUNSHOP);
        writeJSON(LS_KEYS.REWARD_PARAMS, REWARD_PARAMS);

        renderInitial();
    } catch (e) {
        console.error("Error applying cloud data:", e);
        pushToast("加载云端数据格式错误，将使用本地数据。", "warn");
        loadStateFromLocalStorage();
        renderInitial();
    }
  };

  function ensureBadgeMeta(){
    meta.badges = meta.badges || {rare_gem:0, epic_gem:0, rare_tokens:0, epic_tokens:0, legendary_tokens:0, owned:{}, loadout:{slot1:null,slot2:null,slot3:null}, loadoutCooldownUntil:0};
    meta.badges.rare_gem = meta.badges.rare_gem || 0;
    meta.badges.epic_gem = meta.badges.epic_gem || 0;
    meta.badges.rare_tokens = meta.badges.rare_tokens || 0;
    meta.badges.epic_tokens = meta.badges.epic_tokens || 0;
    meta.badges.legendary_tokens = meta.badges.legendary_tokens || 0;
    meta.badges.owned = meta.badges.owned || {};
    meta.badges.loadout = meta.badges.loadout || {slot1:null,slot2:null,slot3:null};
    meta.badges.loadoutCooldownUntil = meta.badges.loadoutCooldownUntil || 0;
    meta.nextWheelBoost = meta.nextWheelBoost || 1;
    meta.funshop = meta.funshop || { activities:[], wearAccum:{} };
    if (!meta.character) {
        meta.character = { name: '', title: '', avatar: null };
    }
    if (!meta.buffs) { meta.buffs = []; }
  }

  const $= (s: string) => document.querySelector(s);
  
  let isSoundMuted = readJSON(LS_KEYS.SOUND_MUTED, false);

  const sfx = {
    navTasks: $('#sfxNavTasks') as HTMLAudioElement, navTimer: $('#sfxNavTimer') as HTMLAudioElement, navBackpack: $('#sfxNavBackpack') as HTMLAudioElement,
    navClub: $('#sfxNavClub') as HTMLAudioElement, navYou: $('#sfxNavYou') as HTMLAudioElement, add: $('#sfxAddTask') as HTMLAudioElement, select: $('#sfxSelectTask') as HTMLAudioElement,
    delete: $('#sfxDeleteTask') as HTMLAudioElement, timerStart: $('#sfxTimerStart') as HTMLAudioElement, timerPause: $('#sfxTimerPause') as HTMLAudioElement,
    timerStop: $('#sfxTimerStop') as HTMLAudioElement, modalOpen: $('#sfxModalOpen') as HTMLAudioElement, modalClose: $('#sfxModalClose') as HTMLAudioElement,
    success: $('#sfxSuccess') as HTMLAudioElement, warn: $('#sfxWarn') as HTMLAudioElement, click: $('#sfxClick') as HTMLAudioElement,
  };

  function playSound(audioEl: HTMLAudioElement | null) {
    if (isSoundMuted || !audioEl) return;
    audioEl.currentTime = 0;
    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => { console.warn(`Audio playback for ${audioEl.id} was prevented.`); });
    }
  }

  const BADGE_META: Record<string, {label: string, cls: string, invKey: string | null}> = {
    rare_token:   {label:'稀有徽章', cls:'fb-rare',   invKey:'rare_tokens'}, epic_token:   {label:'史诗徽章', cls:'fb-epic',   invKey:'epic_tokens'},
    legend_token: {label:'传说徽章', cls:'fb-legend', invKey:'legendary_tokens'}, ticket:       {label:'抽卡券',   cls:'fb-util',   invKey:null},
    freeze:       {label:'冻结卡',   cls:'fb-util',   invKey:null}
  };
  const el = {
    kpiTotalValue: $('#kpiTotalValue') as HTMLElement, kpiTime: $('#kpiTime') as HTMLElement, taskTitle: $('#taskTitle') as HTMLInputElement, taskDiff: $('#taskDiff') as HTMLSelectElement,
    btnAdd: $('#btnAdd') as HTMLButtonElement, btnClearAll: $('#btnClearAll') as HTMLButtonElement, taskList: $('#taskList') as HTMLElement, emptyTask: $('#emptyTask') as HTMLElement, rateText: $('#rateText') as HTMLElement,
    sessionTime: $('#sessionTime') as HTMLElement, taskTotal: $('#taskTotal') as HTMLElement, taskTime: $('#taskTime') as HTMLElement, activeHint: $('#activeHint') as HTMLElement,
    btnStart: $('#btnStart') as HTMLButtonElement, btnPause: $('#btnPause') as HTMLButtonElement, btnStop: $('#btnStop') as HTMLButtonElement, modeSwitchBtn: $('#modeSwitchBtn') as HTMLButtonElement,
    rewardMask: $('#rewardMask') as HTMLElement, rewardBody: $('#rewardBody') as HTMLElement, btnCloseReward: $('#btnCloseReward') as HTMLButtonElement, helpMask: $('#helpMask') as HTMLElement,
    btnHelp: $('#btnHelp') as HTMLButtonElement, btnCloseHelp: $('#btnCloseHelp') as HTMLButtonElement, dailyList: $('#dailyList') as HTMLElement, btnDailyRefresh: $('#btnDailyRefresh') as HTMLButtonElement,
    invRow: $('#invRow') as HTMLElement, badgeWorkshopBody: $('#badgeWorkshopBody') as HTMLElement, toastWrap: $('#toastContainer') as HTMLElement, pauseIndicator: $('#pauseIndicator') as HTMLElement,
    pauseTime: $('#pauseTime') as HTMLElement, btnSpin: $('#btnSpin') as HTMLButtonElement, wheelResult: $('#wheelResult') as HTMLElement, btnDev: $('#btnDev') as HTMLButtonElement, devMask: $('#devMask') as HTMLElement,
    btnCloseDev: $('#btnCloseDev') as HTMLButtonElement, rate1: $('#rate1') as HTMLInputElement, rate2: $('#rate2') as HTMLInputElement, rate3: $('#rate3') as HTMLInputElement, rate4: $('#rate4') as HTMLInputElement, rate5: $('#rate5') as HTMLInputElement,
    btnSaveRates: $('#btnSaveRates') as HTMLButtonElement, btnResetRates: $('#btnResetRates') as HTMLButtonElement, btnForgeFreeze: $('#btnForgeFreeze') as HTMLButtonElement, btnRareRefresh: $('#btnRareRefresh') as HTMLButtonElement,
    btnWheelBoost: $('#btnWheelBoost') as HTMLButtonElement, btnSpeedChip: $('#btnSpeedChip') as HTMLButtonElement, prizeTicker: $('#prizeTicker') as HTMLElement, btnTaskLibrary: $('#btnTaskLibrary') as HTMLButtonElement,
    taskLibraryMask: $('#taskLibraryMask') as HTMLElement, btnCloseTaskLibrary: $('#btnCloseTaskLibrary') as HTMLButtonElement, taskLibraryInput: $('#taskLibraryInput') as HTMLTextAreaElement,
    btnImportTasks: $('#btnImportTasks') as HTMLButtonElement, btnTodayDone: $('#btnTodayDone') as HTMLButtonElement, todayDoneMask: $('#todayDoneMask') as HTMLElement, todayDoneBody: $('#todayDoneBody') as HTMLElement,
    btnCloseTodayDone: $('#btnCloseTodayDone') as HTMLButtonElement, funshopList: $('#funshopList') as HTMLElement, btnFunshopEdit: $('#btnFunshopEdit') as HTMLButtonElement,
    funshopEditMask: $('#funshopEditMask') as HTMLElement, btnCloseFunshopEdit: $('#btnCloseFunshopEdit') as HTMLButtonElement, funshopInput: $('#funshopInput') as HTMLTextAreaElement,
    btnFunshopImport: $('#btnFunshopImport') as HTMLButtonElement, avatarUploader: $('#avatarUploader') as HTMLElement, avatarInput: $('#avatarInput') as HTMLInputElement,
    charNameInput: $('#charNameInput') as HTMLInputElement, charTitleInput: $('#charTitleInput') as HTMLInputElement, charStatusTag: $('#charStatusTag') as HTMLElement,
    charLevelText: $('#charLevelText') as HTMLElement, charTotalHQText: $('#charTotalHQText') as HTMLElement, charBuffsList: $('#charBuffsList') as HTMLElement,
    devTotalHQ: $('#devTotalHQ') as HTMLInputElement, devTickets: $('#devTickets') as HTMLInputElement, devFreeze: $('#devFreeze') as HTMLInputElement, devRareGem: $('#devRareGem') as HTMLInputElement,
    devEpicGem: $('#devEpicGem') as HTMLInputElement, devRareToken: $('#devRareToken') as HTMLInputElement, devEpicToken: $('#devEpicToken') as HTMLInputElement, devLegendToken: $('#devLegendToken') as HTMLInputElement,
    btnSaveResources: $('#btnSaveResources') as HTMLButtonElement, btnSimulateNextDay: $('#btnSimulateNextDay') as HTMLButtonElement, btnResetDaily: $('#btnResetDaily') as HTMLButtonElement,
    btnHardReset: $('#btnHardReset') as HTMLButtonElement, devStateText: $('#devStateText') as HTMLTextAreaElement, btnExportState: $('#btnExportState') as HTMLButtonElement, btnImportState: $('#btnImportState') as HTMLButtonElement,
    devRewardBaseChance: $('#devRewardBaseChance') as HTMLInputElement, devRewardBetCoeff: $('#devRewardBetCoeff') as HTMLInputElement, devRewardMaxChance: $('#devRewardMaxChance') as HTMLInputElement,
    devRewardPityInc: $('#devRewardPityInc') as HTMLInputElement, btnSaveRewardParams: $('#btnSaveRewardParams') as HTMLButtonElement, btnResetRewardParams: $('#btnResetRewardParams') as HTMLButtonElement,
    authChipWrapper: $('#authChipWrapper') as HTMLElement, btnLogin: $('#btnLogin') as HTMLButtonElement, btnLogout: $('#btnLogout') as HTMLButtonElement,
    authStatusText: $('#authStatusText') as HTMLElement, userAvatar: $('#userAvatar') as HTMLElement, loadingOverlay: $('#loadingOverlay') as HTMLElement,
    mobileHeaderStatus: $('#mobileHeaderStatus') as HTMLElement, totalValorChip: $('#totalValorChip') as HTMLElement
  };

  const sessionFlip = new FlipCounter($('#sessionFlip') as HTMLElement, {digits:6,comma:true,large:true});
  
  // Fix: Use generic querySelectorAll to get correct element types
  const mobileTabButtons = document.querySelectorAll<HTMLElement>('.bottom-nav .tab-btn');
  const desktopTabButtons = document.querySelectorAll<HTMLElement>('.desktop-tab');
  const mainColumn = $('#mainColumn') as HTMLElement; const timerColumn = $('#timerCard') as HTMLElement;
  const allPanes: Record<string, HTMLElement | null> = {'tasks-pane': $('#tasks-pane'), 'backpack-pane': $('#backpack-pane'), 'club-pane': $('#club-pane'), 'you-pane': $('#you-pane')};
  const mobileMedia = window.matchMedia('(max-width: 767px) or (max-height: 500px)');
  let activeView = 'tasks-pane';

  function setView(targetId: string) {
    activeView = targetId;
    // Fix: btn.dataset exists on HTMLElement
    mobileTabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mobileTarget === targetId));
    desktopTabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.desktopTarget === targetId));
    const isMainContent = allPanes.hasOwnProperty(targetId);
    if (mobileMedia.matches) { mainColumn.classList.toggle('mobile-hidden', !isMainContent); timerColumn.classList.toggle('mobile-hidden', targetId !== 'timerCard'); }
    Object.keys(allPanes).forEach(paneId => { if (allPanes[paneId]) { (allPanes[paneId] as HTMLElement).style.display = (paneId === targetId) ? '' : 'none'; } });
    if (targetId === 'you-pane') { renderYou(); }
    window.scrollTo(0, 0);
  }

  function handleLayoutChange() {
      if (mobileMedia.matches) { const isMainContent = allPanes.hasOwnProperty(activeView); mainColumn.classList.toggle('mobile-hidden', !isMainContent); timerColumn.classList.toggle('mobile-hidden', activeView !== 'timerCard');
      } else { mainColumn.classList.remove('mobile-hidden'); timerColumn.classList.remove('mobile-hidden'); if (activeView === 'timerCard') { setView('tasks-pane'); } }
  }
  
  mobileTabButtons.forEach(btn => { btn.addEventListener('click', () => { const target = btn.dataset.mobileTarget; if (target) { const soundId = btn.dataset.soundId; if (soundId) { const soundKey = soundId.substring(3).replace(/^\w/, c => c.toLowerCase()); if ((sfx as any)[soundKey]) { playSound((sfx as any)[soundKey]); } } setView(target); } }); });
  desktopTabButtons.forEach(tab => { tab.addEventListener('click', () => { const targetId = tab.dataset.desktopTarget; const soundId = tab.dataset.soundId; if (soundId) { const soundKey = soundId.substring(3).replace(/^\w/, c => c.toLowerCase()); if ((sfx as any)[soundKey]) { playSound((sfx as any)[soundKey]); } } if(targetId) setView(targetId); }); });
  if(mobileMedia.addEventListener){ mobileMedia.addEventListener('change', handleLayoutChange); } else if(mobileMedia.addListener){ mobileMedia.addListener(handleLayoutChange); }
  handleLayoutChange();

  let tickerTimer: any = null, tickerTimeout: any = null, tickerIndex = 0;
  function clearTicker(){ if(tickerTimer){clearInterval(tickerTimer);tickerTimer=null;} if(tickerTimeout){clearTimeout(tickerTimeout);tickerTimeout=null;} }
  function rollWheelOutcomeType(){ const base=[{type:'hq',p:0.40},{type:'rare',p:0.32},{type:'epic',p:0.12},{type:'freeze',p:0.16}]; const r=Math.random(); let acc=0; for(const it of base){acc+=it.p;if(r<acc)return it.type} return 'hq'; }
  function applyWheelReward(type: string){
    const boost = Math.max(1, meta.nextWheelBoost || 1); let msg='';
    if(type==='hq'){ const add=Math.floor(50*boost); state.agg.totalHQ=(state.agg.totalHQ||0)+add; msg=`幸运轮获得豪情值 +${add}${boost>1?`（强运×${boost.toFixed(2)}）`:''}`; }
    else if(type==='rare'){ meta.badges.rare_gem=(meta.badges.rare_gem||0)+Math.max(1,Math.round(2*boost)); msg=`获得稀有碎片 ×${Math.max(1,Math.round(2*boost))}`; }
    else if(type==='epic'){ meta.badges.epic_gem=(meta.badges.epic_gem||0)+1; msg='获得史诗碎片 ×1'; }
    else if(type==='freeze'){ meta.freeze=(meta.freeze||0)+1; msg='获得冻结卡 ×1'; }
    meta.nextWheelBoost=1; save(); renderKPI(); renderInventory(); pushToast(msg,'success');
    if(el.wheelResult){ el.wheelResult.textContent=msg; el.wheelResult.classList.remove('muted'); }
  }
  function startNameTicker(){
    if((meta.tickets||0)<=0){pushToast('抽卡券不足', 'warn');return;}
    playSound(sfx.click); meta.tickets-=1; save(); renderInventory();
    tickerIndex = Math.floor(Math.random()*PRIZE_NAMES.length); if(el.prizeTicker) el.prizeTicker.textContent = PRIZE_NAMES[tickerIndex];
    if(el.wheelResult){el.wheelResult.textContent='跳动中…';el.wheelResult.classList.add('muted');} if(el.btnSpin) el.btnSpin.disabled=true; clearTicker();
    tickerTimer = setInterval(()=>{ tickerIndex=(tickerIndex+1)%PRIZE_NAMES.length; if(el.prizeTicker) el.prizeTicker.textContent=PRIZE_NAMES[tickerIndex]; }, 80);
    tickerTimeout = setTimeout(()=>{ clearTicker(); const outcome=rollWheelOutcomeType(); const chosen=WHEEL_SEGMENTS.find(seg=>seg.type===outcome) || WHEEL_SEGMENTS[0]; if(el.prizeTicker) el.prizeTicker.textContent=chosen.label; if (outcome) applyWheelReward(outcome); if(el.btnSpin) el.btnSpin.disabled=false; }, 2000);
  }

  function fmtTime(sec: number){ sec=Math.floor(sec); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60; const pad=(n: number)=>n.toString().padStart(2,'0'); return `${h}:${pad(m)}:${pad(s)}`; }
  function fmtPause(sec: number){ sec=Math.max(0,Math.floor(sec||0)); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60; const pad=(n: number)=>n.toString().padStart(2,'0'); return h>0?`${h}:${pad(m)}:${pad(s)}`:`${m}:${pad(s)}`;}
  const getToday = () => { const d = new Date(); d.setDate(d.getDate() + (window._debugDateOffset || 0)); return d; };
  function todayKey(){ return getToday().toISOString().slice(0,10); }

  function debounce(func: (...args: any[]) => void, wait: number) {
    let timeout: any;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const debouncedSaveToCloudBase = debounce(() => {
      const loginState = auth.currentUser;
      if (!isCloudBaseConfigured || !loginState) return;
      
      const fullState = { 
        tasks: state.tasks, agg: state.agg, active: state.active, 
        meta: meta, rates: RATE_BY_DIFFICULTY, funshop: FUNSHOP, 
        rewardParams: REWARD_PARAMS,
        lastUpdated: new Date()
      };
      
      // Use update() for a non-destructive merge, which is safer than set()
      db.collection('users').doc(loginState.uid).update(fullState)
        .then(() => {
            console.log("CloudBase save success.");
            pushToast('云端同步成功', 'success');
        })
        .catch((err: any) => {
            console.error("CloudBase save error:", err);
            let msg = '云端同步失败';
            if (err.code === 'permission-denied') msg = '云端同步失败：权限不足';
            pushToast(msg, 'warn');
        });
  }, 1500);

  function save(){
    writeJSON(LS_KEYS.TASKS, state.tasks);
    writeJSON(LS_KEYS.AGG, state.agg);
    writeJSON(LS_KEYS.META, meta);
    writeJSON(LS_KEYS.RATES, RATE_BY_DIFFICULTY);
    writeJSON(LS_KEYS.FUNSHOP, FUNSHOP);
    writeJSON(LS_KEYS.REWARD_PARAMS, REWARD_PARAMS);

    if (isCloudBaseConfigured && auth.currentUser) {
      debouncedSaveToCloudBase();
    }
  }

  function pushToast(message: string, variant='info'){
    if (variant === 'success') playSound(sfx.success);
    else if (variant === 'warn' || variant === 'err') playSound(sfx.warn);
    const wrap = el.toastWrap || document.getElementById('toastContainer'); if(!wrap) return;
    const toast = document.createElement('div'); toast.className = 'toast'; if(variant==='warn') toast.classList.add('warn'); if(variant==='success') toast.classList.add('success');
    toast.textContent = message; wrap.appendChild(toast);
    requestAnimationFrame(()=>toast.classList.add('show'));
    setTimeout(()=>{ toast.classList.remove('show'); toast.addEventListener('transitionend',()=>toast.remove(),{once:true}); },4000);
  }

  function updateModeButton() { if (!el.modeSwitchBtn) return; const isArcade = !!meta.arcade; el.modeSwitchBtn.textContent = isArcade ? '街机模式' : '专注模式'; el.modeSwitchBtn.classList.toggle('primary', !isArcade); }
  const uid=()=>Math.random().toString(36).slice(2,10);
  const clamp=(n: number,a: number,b: number)=>Math.max(a,Math.min(b,n));
  const getTask=(id: string | null)=>state.tasks.find(t=>t.id===id);
  function difficultyBadge(d: number){const map: Record<number, string>={1:"轻松",2:"较易",3:"标准",4:"较难",5:"硬仗"};return `<span class="tag">${"★".repeat(d)}${"☆".repeat(5-d)} <b style="margin-left:4px">D${d}</b> · ${map[d]}</span>`}
  const normalizeRewardAmount = (val: any) => Math.max(1, Math.floor(Number(val) || 0));
  function rewardLabel(reward: {type: string, amount: number} | undefined){
    if(!reward||!reward.type) return ''; const def=REWARD_TYPES[reward.type]; if(!def) return '';
    const amount=normalizeRewardAmount(reward.amount||1); return `${def.label} ×${amount}`;
  }
  function grantTaskReward(task: Task){
    if(!task||!task.reward||!task.reward.type) return null; const def=REWARD_TYPES[task.reward.type]; if(!def) return null;
    // Fix: use task.reward.amount instead of undefined 'reward'
    const amount=normalizeRewardAmount(task.reward.amount||1); def.apply(amount);
    return {message:`${task.title} 完成奖励：${def.label} +${amount}`, type:task.reward.type};
  }

  const WEAR_MAX: Record<string, number> = { rare_token:100, epic_token:140, legend_token:200 };
  function ensureWearPool(){ meta.funshop = meta.funshop || {activities:[], wearAccum:{}}; meta.funshop.wearAccum = meta.funshop.wearAccum || {}; }

  function parsePack(text: string | undefined, lead: string): Record<string, number> {
    if(!text) return {}; const s = text.trim().replace(/，/g,','); const t = lead && s.startsWith(lead) ? s.slice(lead.length).trim() : s;
    if(!t) return {}; const out: Record<string, number>={};
    t.split(',').map(x=>x.trim()).filter(Boolean).forEach(seg=>{ const m=seg.match(/^([a-zA-Z_]+)\*(\d+)$/); if(!m) return;
      const k=m[1].toLowerCase(); const v=Math.max(1,parseInt(m[2],10)||0); if(BADGE_META[k]) out[k]=(out[k]||0)+v; });
    return out;
  }
  function parseFunshopLines(text: string | undefined): FunshopActivity[] {
    const out: FunshopActivity[] = []; (text||'').split('\n').forEach(line=>{
      const s=line.trim(); if(!s) return; const p=s.split('|'); if(p.length<2) return;
      const title=p[0].trim(); const seconds=Math.max(1,parseInt(p[1].trim(),10)||0); const need=parsePack(p[2]||'','需求:'); const wear=parsePack(p[3]||'','磨损:');
      let timeWindow=null; const w=(p[4]||'').trim(); if(w && w.startsWith('时段:')){ const m=w.slice(3).trim().match(/(\d{2}:\d{2})-(\d{2}:\d{2})/); if(m) timeWindow={start:m[1],end:m[2]}; }
      out.push({ id:uid(), title, seconds, need, wear, timeWindow, running:null }); }); return out;
  }
  function withinWindow(tw: {start: string, end: string} | null){
    if(!tw) return true; const now=getToday();
    const cur=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    return (cur>=tw.start && cur<=tw.end);
  }
  function needChipsHTML(need: Record<string, number>){
    const parts: string[]=[]; const b=meta.badges||{};
    Object.entries(need||{}).forEach(([k,v])=>{ const metaK = BADGE_META[k]; if(!metaK) return;
      let have = 0; if(metaK.invKey) have = (b as any)[metaK.invKey]||0; else if(k==='ticket') have = meta.tickets||0; else if(k==='freeze') have = meta.freeze||0;
      const ok = have>=v; const cls = ok?metaK.cls:'fb-bad';
      parts.push(`<span class="fb-chip ${cls}">${metaK.label} ×${v}${ok?``:`（缺${v-have}）`}</span>`); });
    return parts.length?parts.join(''):'<span class="funshop-muted">无</span>';
  }
  function wearChipsHTML(wear: Record<string, number>){
    const parts: string[]=[]; Object.entries(wear||{}).forEach(([k,v])=>{ const metaK = BADGE_META[k]; if(!metaK) return;
      parts.push(`<span class="fb-chip ${metaK.cls}">${metaK.label} −${v} 耐久</span>`); });
    return parts.length?parts.join(''):'<span class="funshop-muted">无</span>';
  }

  function applyWearAndConsume(need: Record<string, number> = {}, wear: Record<string, number> = {}){
    ensureBadgeMeta(); ensureWearPool(); const b=meta.badges||{};
    const have: Record<string, number> = { rare_token:b.rare_tokens||0, epic_token:b.epic_tokens||0, legend_token:b.legendary_tokens||0, ticket:meta.tickets||0, freeze:meta.freeze||0 };
    for(const [k,req] of Object.entries(need)){ if((have[k]||0) < req) return {ok:false,msg:`${BADGE_META[k]?.label || k} 不足`}; }
    // Fix: Use bracket notation for property access on Record<string, number>
    if(need['rare_token']){ meta.badges.rare_tokens = Math.max(0,(meta.badges.rare_tokens||0) - need['rare_token']); }
    if(need['epic_token']){ meta.badges.epic_tokens = Math.max(0,(meta.badges.epic_tokens||0) - need['epic_token']); }
    if(need['legend_token']){ meta.badges.legendary_tokens = Math.max(0,(meta.badges.legendary_tokens||0) - need['legend_token']); }
    if(need['ticket']){ meta.tickets = Math.max(0,(meta.tickets||0) - need['ticket']); }
    if(need['freeze']){ meta.freeze  = Math.max(0,(meta.freeze||0)  - need['freeze']); }
    const pool=meta.funshop.wearAccum; Object.entries(wear||{}).forEach(([k,v])=>{ if(WEAR_MAX[k]) pool[k]=(pool[k]||0)+Math.max(0,v); });
    const report: string[]=[];
    [['rare_token','rare_tokens'],['epic_token','epic_tokens'],['legend_token','legendary_tokens']].forEach(([k,invKey])=>{
      const max=WEAR_MAX[k]; const have=(meta.badges as any)[invKey]||0; const w=pool[k]||0; const destroy=Math.min(have, Math.floor(w/max));
      if(destroy>0){ (meta.badges as any)[invKey]=Math.max(0,have-destroy); pool[k]=w - destroy*max; report.push(`${BADGE_META[k]?.label || k} -${destroy}`); } });
    return {ok:true,destroyed:report};
  }

  function renderFunshop(){
    const list = el.funshopList; if(!list) return; ensureBadgeMeta(); ensureWearPool();
    const acts = meta.funshop.activities||[]; const fragment = document.createDocumentFragment();
    if(!acts.length){ list.innerHTML = `<div class="funshop-muted">尚未配置娱乐活动。点右上角“调试/导入”。</div>`; return; }
    acts.forEach(a=>{ const row=document.createElement('div'); row.className='funshop-item'; const inTime=withinWindow(a.timeWindow);
      const timerHTML = a.running ? `<span class="mini-timer">进行中 · 剩余 <b><span class="remain" data-id="${a.id}">${fmtTime(Math.max(0,Math.ceil((a.running.until-Date.now())/1000)))}</span></b><button class="btn small" data-stop="${a.id}">停止</button></span>` : '';
      row.innerHTML = `
        <div class="funshop-grid-2"><div><b>${a.title}</b> <span class="funshop-muted">（${fmtTime(a.seconds)}）</span></div><div>${a.timeWindow?`<span class="funshop-muted">${inTime?'时段开放':'当前不在时段'}：${a.timeWindow.start}–${a.timeWindow.end}</span>`:''}</div></div>
        <div class="fb-line"><span class="funshop-muted">需求：</span>${needChipsHTML(a.need)}</div>
        <div class="fb-line"><span class="funshop-muted">磨损：</span>${wearChipsHTML(a.wear)}</div>
        <div class="funshop-row">${timerHTML}<span style="flex:1"></span><button class="btn small${inTime?'':' disabled'}" data-play="${a.id}" ${inTime?'':'disabled'}>${inTime?'兑换并开始':'未到时段'}</button></div>`;
      // Fix: Cast querySelector result to HTMLElement to access onclick
      const play = row.querySelector<HTMLElement>(`[data-play="${a.id}"]`); if(play) play.onclick=()=>startFunActivity(a.id);
      const stop = row.querySelector<HTMLElement>(`[data-stop="${a.id}"]`); if(stop) stop.onclick=()=>stopFunActivity(a.id,true);
      fragment.appendChild(row); });
    list.innerHTML = ''; list.appendChild(fragment);
  }

  function startFunActivity(id: string){
    ensureBadgeMeta(); ensureWearPool(); const acts=meta.funshop.activities||[]; const a=acts.find(x=>x.id===id); if(!a) return;
    if(a.running){ pushToast('已在进行中','warn'); return; } const res = applyWearAndConsume(a.need||{}, a.wear||{});
    if(!res.ok){ pushToast(res.msg||'条件不足','warn'); save(); renderInventory(); return; }
    if(res.destroyed && res.destroyed.length){ pushToast(`磨损导致销毁：${res.destroyed.join('、')}`,'warn'); }
    a.running = { until: Date.now() + Math.max(1,a.seconds)*1000 }; save(); renderInventory(); renderFunshop();
  }
  function stopFunActivity(id: string,byUser=false){ const acts=meta.funshop.activities||[]; const a=acts.find(x=>x.id===id); if(!a||!a.running) return;
    a.running=null; save(); renderFunshop(); if(byUser) pushToast('已停止娱乐活动','info');
  }
  function tickFunshopTimers(){
    const acts=meta.funshop.activities||[]; let dirty=false; const now=Date.now();
    acts.forEach(a=>{ if(a.running && a.running.until<=now){ a.running=null; dirty=true; }}); if(dirty){ save(); renderFunshop(); }
    document.querySelectorAll<HTMLElement>('.mini-timer .remain').forEach(span=>{ const id = span.getAttribute('data-id'); const a = acts.find(x=>x.id===id);
      if(a && a.running){ span.textContent = fmtTime(Math.max(0,Math.ceil((a.running.until-Date.now())/1000))); } });
    setTimeout(tickFunshopTimers,1000);
  }

  function renderKPI() {
      if (el.kpiTotalValue) el.kpiTotalValue.textContent = Math.floor(state.agg.totalHQ || 0).toLocaleString('en-US');
      if (el.kpiTime) el.kpiTime.textContent = fmtTime(state.agg.totalSeconds || 0);
  }

  function renderHeaderStatus() {
      const headerStatusEl = document.getElementById('mobileHeaderStatus');
      if (!headerStatusEl) return;
      
      const totalHQ = state.agg.totalHQ || 0;
      const hqForLevelUp = 1000;
      const currentLevel = Math.floor(totalHQ / hqForLevelUp) + 1;
      const currentLevelBaseHQ = (currentLevel - 1) * hqForLevelUp;
      const hqInCurrentLevel = totalHQ - currentLevelBaseHQ;
      const percent = Math.min(100, (hqInCurrentLevel / hqForLevelUp) * 100);

      const name = (meta.character && meta.character.name) ? meta.character.name : '英雄';
      const title = (meta.character && meta.character.title) ? meta.character.title : '初出茅庐';
      
      const now = Date.now();
      const activeBuffs = (meta.buffs || []).filter(b => b.expiresAt > now);
      const buffText = activeBuffs.length > 0 ? `${activeBuffs.length}个Buff生效中` : '';

      const avatarUrl = meta.character.avatar || '';

      headerStatusEl.innerHTML = `
      <div class="mobile-header-card">
          <div class="mobile-char-avatar" style="background-image: ${avatarUrl ? `url(${avatarUrl})` : 'none'};">
              ${!avatarUrl ? '👤' : ''}
          </div>
          <div class="mobile-char-details">
              <div class="mobile-char-status">
                  <div class="char-info">
                      <span class="char-name">${name}</span>
                      <span class="char-title">${title}</span>
                  </div>
                  <div class="exp-bar-container">
                      <div class="exp-bar-header">
                          <span class="exp-level">Lv.${currentLevel}</span>
                          <span class="exp-buffs">${buffText}</span>
                      </div>
                      <div class="exp-bar">
                          <div class="exp-bar-fill" style="width: ${percent}%;"></div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      `;
  }

  function renderTasks(){
    el.emptyTask.style.display = state.tasks.length?'none':'block'; const fragment = document.createDocumentFragment();
    const currentDisplayTaskId = (state.active && state.active.taskId) || state.selectedTaskId;
    state.tasks.forEach(t=>{ const row=document.createElement('div'); row.className='task'; if(currentDisplayTaskId ===t.id) row.classList.add('selected');
      row.innerHTML = `
        <div>${difficultyBadge(t.difficulty)}</div>
        <div> <div class="task-title">${t.title}</div> <div class="task-meta">累计豪情值：<b>${Math.floor(t.totalHQ||0)}</b> · 累计用时：<b>${fmtTime(t.totalSeconds||0)}</b></div> ${t.reward&&rewardLabel(t.reward)?`<div class="reward-tag">奖励：${rewardLabel(t.reward)}</div>`:''} </div>
        <div class="controls"><button class="btn small" data-act="edit">编辑</button><button class="btn small danger" data-act="del">删除</button></div>
        <div><button class="btn small accent" data-act="select">${currentDisplayTaskId === t.id ? '已选':'选择'}</button></div>`;
      // Fix: Cast querySelector result to HTMLElement to access onclick
      (row.querySelector('[data-act="edit"]') as HTMLElement).onclick=()=>editTask(t.id); (row.querySelector('[data-act="del"]') as HTMLElement).onclick=()=>deleteTask(t.id);
      (row.querySelector('[data-act="select"]') as HTMLElement).onclick=()=>selectTask(t.id); fragment.appendChild(row); });
    el.taskList.innerHTML = ''; el.taskList.appendChild(fragment);
  }
function setControls(){
  const btnStart = el.btnStart; const btnPause = el.btnPause; const btnStop  = el.btnStop; if(!btnStart || !btnPause || !btnStop) return;
  const setStartState = (disabled: boolean, label: string) => { btnStart.disabled = disabled; btnStart.textContent = label; btnStart.setAttribute('aria-label', label); };
  setStartState(true, '开始'); btnPause.disabled = true; btnStop.disabled  = true;
  if (state.active) { const a = state.active; if (!a.isPaused) { setStartState(true, '开始'); btnPause.disabled = false; btnStop.disabled = false; } else { setStartState(false, '继续'); btnPause.disabled = true; btnStop.disabled = false; }
  } else if (state.selectedTaskId) { setStartState(false, '开始'); }
}
  function showPauseIndicator(sec: number){ if(!el.pauseIndicator||!el.pauseTime) return; el.pauseIndicator.style.display='flex'; el.pauseTime.textContent=fmtPause(sec); }
  function hidePauseIndicator(){ if(!el.pauseIndicator||!el.pauseTime) return; el.pauseIndicator.style.display='none'; el.pauseTime.textContent='0:00'; }

  function addTask(){
    const title=el.taskTitle.value.trim(); const diff=parseInt(el.taskDiff.value,10); if(!title){playSound(sfx.warn); alert('请输入任务标题');return}
    playSound(sfx.add); state.tasks.unshift({id:uid(), title, difficulty:diff, totalHQ:0, totalSeconds:0});
    save(); renderTasks(); el.taskTitle.value='';
  }
  function editTask(id: string){
    const t=getTask(id); if(!t) return; const title=prompt('编辑任务标题：',t.title); if(title===null) return;
    let diffStr=prompt('编辑难度（1-5）：',String(t.difficulty)); if(diffStr===null) return;
    const diff=clamp(parseInt(diffStr,10)||t.difficulty,1,5);
    t.title=(title.trim()||t.title); t.difficulty=diff; playSound(sfx.click);
    save(); renderTasks(); if((state.active && state.active.taskId === id) || state.selectedTaskId === id){ updateRate(); }
  }
  function deleteTask(id: string){
    if(state.active&&state.active.taskId===id){ playSound(sfx.warn); alert('请先结束当前任务的计时，再删除。'); return; }
    if(state.selectedTaskId === id) { state.selectedTaskId = null; } playSound(sfx.delete);
    state.tasks=state.tasks.filter(t=>t.id!==id); save(); renderTasks();
  }

  function baseRateOfTask(task: Task){return RATE_BY_DIFFICULTY[task.difficulty as keyof typeof RATE_BY_DIFFICULTY]||1;}
  function todayBuff(){const day=todayKey(); meta.dailyBuff=meta.dailyBuff||{}; meta.dailyBuff[day]=meta.dailyBuff[day]||{rateBuff:0}; return meta.dailyBuff[day];}
  function effectiveRate(baseRate: number, difficulty: number){ let rate=baseRate; const chip = todayBuff().rateBuff || 0; rate *= (1 + chip); return rate; }
  function rateOfActive(){ if(!state.active) return 0; const task=getTask(state.active.taskId); if(!task) return 0; return effectiveRate(baseRateOfTask(task), task.difficulty); }
  
  function updateRate(){
    let task; if (state.active) { task = getTask(state.active.taskId); } else if (state.selectedTaskId) { task = getTask(state.selectedTaskId); }
    if(!task){ el.rateText.textContent='0'; return; } const eff=effectiveRate(baseRateOfTask(task), task.difficulty);
    el.rateText.textContent=eff.toFixed(2);
  }

  function selectTask(id: string){
    const t=getTask(id); if(!t) return;
    if(state.active && state.active.taskId !== id) { pushToast('当前有任务正在计时，请先结束。', 'warn'); return; }
    if(state.active && state.active.taskId === id) return; playSound(sfx.select); state.selectedTaskId = id;
    el.activeHint.textContent=`已选择：${t.title}（难度 ${t.difficulty}）`; sessionFlip.setValue(0,true); 
    el.sessionTime.textContent='0:00:00'; el.taskTotal.textContent=String(Math.floor(t.totalHQ||0)); el.taskTime.textContent=fmtTime(t.totalSeconds||0);
    hidePauseIndicator(); updateRate(); renderTasks(); setControls();
    if (mobileMedia.matches) { setView('timerCard'); }
  }
  
  function startTimer(){
    if (state.active && !state.active.isPaused) return;
    const taskId = state.active ? state.active.taskId : state.selectedTaskId; if (!taskId) { playSound(sfx.warn); alert('请先选择任务'); return; }
    const task = getTask(taskId); if (!task) return; playSound(sfx.timerStart);
    let newTimerState: ActiveTimer; const now = Date.now();
    if (state.active && state.active.isPaused) { const pausedDurationSec = (now - (state.active.pauseTime || now)) / 1000; newTimerState = { ...state.active, startTime: now, isPaused: false, pauseTime: null, pauses: (state.active.pauses || 0) + (pausedDurationSec > ECON.pauseBreakSec ? 1 : 0), };
    } else { newTimerState = { taskId: taskId, startTime: now, accumulatedSeconds: 0, isPaused: false, pauseTime: null, pauses: 0, }; }
    state.selectedTaskId = null; state.active = newTimerState; save();
    el.activeHint.textContent = `进行中：${task.title}（难度 ${task.difficulty}）`;
    renderTasks(); updateRate(); setControls(); hidePauseIndicator();
  }

  function pauseTimer(){
    if(!state.active || state.active.isPaused) return; playSound(sfx.timerPause); const now = Date.now();
    const elapsedSec = (now - (state.active.startTime || now)) / 1000;
    const newTimerState: ActiveTimer = { ...state.active, accumulatedSeconds: (state.active.accumulatedSeconds || 0) + elapsedSec, isPaused: true, pauseTime: now, startTime: null, };
    state.active = newTimerState; save(); setControls();
    const task = getTask(state.active.taskId);
    if(task) { const rate = effectiveRate(baseRateOfTask(task), task.difficulty);
      const finalSessionHQ = (state.active.accumulatedSeconds || 0) * rate; const finalSessionSeconds = state.active.accumulatedSeconds || 0;
      sessionFlip.setValue(Math.floor(finalSessionHQ), true); el.sessionTime.textContent = fmtTime(finalSessionSeconds);
      el.taskTotal.textContent = String(Math.floor((task.totalHQ || 0) + finalSessionHQ));
      el.taskTime.textContent = fmtTime((task.totalSeconds || 0) + finalSessionSeconds);
    }
  }

  function pushTodayDone(entry: any){ const d = todayObj(); d.completed.unshift(entry); save(); }
  function renderTodayDone(){
    const d = todayObj(); const list = d.completed || []; const box = document.getElementById('todayDoneBody'); if(!box) return;
    if(list.length === 0){ box.innerHTML = '<div class="muted">今天还没有完成的任务。</div>'; return; }
    const fragment = document.createDocumentFragment(); list.forEach(it => { const item = document.createElement('div');
        item.className = 'pane';
        item.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"> <div style="font-weight:600">${it.title}</div> <span class="tag">D${it.difficulty}</span> </div> <div class="muted" style="margin-top:6px;font-size:12px"> 用时：<b>${fmtTime(it.seconds)}</b> · 本次豪情值：<b>${Math.floor(it.hq)}</b> · 完成于：${new Date(it.ts).toLocaleTimeString()} </div>`;
        fragment.appendChild(item); });
    box.innerHTML = ''; box.appendChild(fragment);
  }

  function bindRewardClose() { const closeBtn = el.btnCloseReward; if (closeBtn) { closeBtn.onclick = () => { playSound(sfx.modalClose); el.rewardMask.style.display = 'none'; }; } }

  function openReward({baseHQ, seconds, difficulty, rawHQ}: {baseHQ: number, seconds: number, difficulty: number, rawHQ: number}){
    playSound(sfx.modalOpen); const streakMulti = 1 + (meta.streak || 0);
    const baseReward = Math.floor(baseHQ * streakMulti); const isArcade = !!meta.arcade;
    const body = el.rewardBody; if(!body) return;
    body.innerHTML = ` <div style="text-align:center;margin-bottom:16px"> <div style="font-size:24px;font-weight:800;margin-bottom:4px">${baseReward}</div> <div class="muted">基础奖励（连击 ×${streakMulti.toFixed(2)}）</div> </div> ${isArcade ? ` <div class="choice" id="betChoice"> <div class="opt" data-bet="0">不押注</div> <div class="opt" data-bet="0.5">押注 ×0.5（${Math.floor(baseReward*0.5)}）</div> <div class="opt" data-bet="1">押注 ×1（${baseReward}）</div> <div class="opt" data-bet="2">押注 ×2（${Math.floor(baseReward*2)}）</div> </div> <div class="muted" style="margin-top:10px;font-size:12px">街机模式：可押注赢取更多豪情值，失败则失去基础奖励</div> ` : ''} `;
    if(isArcade){
      // Fix: Use generic querySelectorAll to get correct element types
      const opts = body.querySelectorAll<HTMLElement>('.opt');
      opts.forEach(opt => { opt.onclick = () => { playSound(sfx.click); const bet = parseFloat(opt.dataset.bet || '0');
          if(bet === 0){ state.agg.totalHQ = (state.agg.totalHQ || 0) + baseReward; save(); renderKPI(); body.innerHTML += `<div class="result-bar result-ok" style="margin-top:16px">已领取基础奖励 +${baseReward}</div>`; bindRewardClose();
          }else{ const cost = Math.floor(baseReward * bet); const chance = Math.min(REWARD_PARAMS.maxChance, REWARD_PARAMS.baseChance + bet * REWARD_PARAMS.betCoefficient + (meta.pity || 0));
            const won = Math.random() < chance; const loot = won ? Math.floor(cost * (1.5 + Math.random() * 1.5)) : 0;
            if(won){ state.agg.totalHQ = (state.agg.totalHQ || 0) + loot; meta.pity = Math.max(0, (meta.pity || 0) - ECON.pityStep);
              body.innerHTML += `<div class="result-bar result-ok" style="margin-top:16px"> <div>🎉 押注成功！获得 +${loot} 豪情值</div> <div class="loots" style="margin-top:8px"> <span class="loot">基础消耗：${cost}</span> <span class="loot">倍率：×${(loot/cost).toFixed(2)}</span> <span class="loot">怜悯：+${(chance*100).toFixed(1)}%</span> </div> </div>`;
            }else{ meta.pity = (meta.pity || 0) + REWARD_PARAMS.pityIncrement;
              body.innerHTML += `<div class="result-bar result-err" style="margin-top:16px"> <div>💥 押注失败，失去基础奖励 -${baseReward}</div> <div class="loots" style="margin-top:8px"> <span class="loot">怜悯+${(REWARD_PARAMS.pityIncrement*100).toFixed(1)}%</span> </div> </div>`;
            } save(); renderKPI(); } bindRewardClose(); }; });
    }else{ state.agg.totalHQ = (state.agg.totalHQ || 0) + baseReward; save(); renderKPI(); body.innerHTML += `<div class="result-bar result-ok" style="margin-top:16px">已领取基础奖励 +${baseReward}</div>`; bindRewardClose(); }
    el.rewardMask.style.display = 'flex';
  }

  function triggerCompletionAnimation() {
    const container = document.getElementById('completion-animation-container'); if (!container) return; container.innerHTML = '';
    const textEl = document.createElement('div'); textEl.className = 'completion-text'; textEl.textContent = '任务完成!'; container.appendChild(textEl);
    const confettiCount = 50; const colors = ['var(--primary)', 'var(--accent)', '#e3b341', '#3fb950'];
    for (let i = 0; i < confettiCount; i++) { const confetti = document.createElement('div'); confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}vw`; confetti.style.top = `${Math.random() * -20}vh`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; confetti.style.animationDelay = `${Math.random() * 0.5}s`;
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`; container.appendChild(confetti); }
    setTimeout(() => { container.innerHTML = ''; }, 2500);
  }

  function stopTimer(){
    if(!state.active) return; playSound(sfx.timerStop);
    const activeSession = { ...state.active }; state.active = null;
    const t = getTask(activeSession.taskId); let sessionSeconds = activeSession.accumulatedSeconds || 0;
    if (!activeSession.isPaused && activeSession.startTime) { sessionSeconds += (Date.now() - activeSession.startTime) / 1000; }
    sessionSeconds = Math.floor(sessionSeconds);
    const taskRate = t ? effectiveRate(baseRateOfTask(t), t.difficulty) : 0;
    const sessionHQ = Math.floor(sessionSeconds * taskRate); const pauses = activeSession.pauses || 0;
    const diff = t ? t.difficulty : 3;
    if(t){ t.totalHQ = (t.totalHQ || 0) + sessionHQ; t.totalSeconds = (t.totalSeconds || 0) + sessionSeconds; }
    state.agg.totalSeconds = (state.agg.totalSeconds || 0) + sessionSeconds;
    pushTodayDone({ title: t ? t.title : '未知任务', difficulty: diff, seconds: sessionSeconds, hq: sessionHQ, ts: Date.now() });
    triggerCompletionAnimation(); const extraReward = t ? grantTaskReward(t) : null;
    state.tasks = state.tasks.filter(task => task.id !== activeSession.taskId); if(state.selectedTaskId === activeSession.taskId) state.selectedTaskId = null;
    save(); renderTasks(); renderKPI();
    el.activeHint.textContent='未选择任务'; sessionFlip.setValue(0,true); el.sessionTime.textContent='0:00:00'; el.taskTotal.textContent='0';
    el.taskTime.textContent='0:00:00'; el.rateText.textContent='0'; hidePauseIndicator(); setControls();
    if(extraReward){ if(extraReward.type!=='hq'){ renderInventory(); } pushToast(extraReward.message,'success'); }
    setTimeout(() => { onSegmentEnd_base(sessionSeconds, diff, pauses); singleMissionJudge(sessionSeconds, diff, pauses);
        openReward({ baseHQ: sessionHQ, seconds: sessionSeconds, difficulty: diff, rawHQ: sessionHQ }); }, 1800);
  }

  // Fix: Add type for lastRenderedState
  let lastRenderedState: RenderedState = {};
  function loop(){
      let needsRender = false;
      const now = Date.now();
      
      let currentTotalHQForDisplay = Math.floor(state.agg.totalHQ || 0);

      if (state.active && !state.active.isPaused) {
          const a = state.active;
          const task = getTask(a.taskId);
          if (task) {
              const rate = rateOfActive();
              const elapsedSinceStart = (now - (a.startTime || now)) / 1000;
              const currentSessionSeconds = (a.accumulatedSeconds || 0) + elapsedSinceStart;
              const currentSessionHQ = currentSessionSeconds * rate;
              const sessionHQInt = Math.floor(currentSessionHQ);
              
              if (sessionHQInt !== lastRenderedState.sessionHQ) {
                  sessionFlip.flipTo(sessionHQInt);
                  lastRenderedState.sessionHQ = sessionHQInt;
              }
              const fmtSessionTime = fmtTime(currentSessionSeconds);
              if (fmtSessionTime !== lastRenderedState.sessionTime) {
                  el.sessionTime.textContent = fmtSessionTime;
                  lastRenderedState.sessionTime = fmtSessionTime;
              }
              const taskTotalHQ = Math.floor((task.totalHQ || 0) + currentSessionHQ);
              if (taskTotalHQ !== lastRenderedState.taskTotalHQ) {
                  el.taskTotal.textContent = String(taskTotalHQ);
                  lastRenderedState.taskTotalHQ = taskTotalHQ;
              }
              const fmtTaskTime = fmtTime((task.totalSeconds || 0) + currentSessionSeconds);
              if (fmtTaskTime !== lastRenderedState.taskTime) {
                  el.taskTime.textContent = fmtTaskTime;
                  lastRenderedState.taskTime = fmtTaskTime;
              }
              currentTotalHQForDisplay += sessionHQInt;
          }
      } else if (state.active && state.active.isPaused) {
          const pausedFor = (now - (state.active.pauseTime || now)) / 1000;
          showPauseIndicator(pausedFor);
      } else {
          hidePauseIndicator();
      }
      
      if (currentTotalHQForDisplay !== lastRenderedState.kpiTotalHQ) {
          el.kpiTotalValue.textContent = currentTotalHQForDisplay.toLocaleString('en-US');
          lastRenderedState.kpiTotalHQ = currentTotalHQForDisplay;
      }
      
      if (activeView === 'you-pane') {
          let statusText = '离线';
          if (state.active) { statusText = state.active.isPaused ? '休息中' : '专注中'; }
          if (statusText !== lastRenderedState.charStatus) {
              el.charStatusTag.textContent = statusText;
              lastRenderedState.charStatus = statusText;
          }
          const activeBuffs = (meta.buffs || []).filter(b => b.expiresAt > now);
          if (JSON.stringify(activeBuffs) !== lastRenderedState.activeBuffs) {
              meta.buffs = activeBuffs;
              const buffList = el.charBuffsList;
              if (buffList) {
                  if (activeBuffs.length === 0) {
                      buffList.innerHTML = `<div class="char-buff-item muted">无</div>`;
                  } else {
                      buffList.innerHTML = activeBuffs.map(buff => {
                          const remainingSec = Math.max(0, Math.floor((buff.expiresAt - now) / 1000));
                          const m = Math.floor(remainingSec / 60).toString().padStart(2, '0');
                          const s = (remainingSec % 60).toString().padStart(2, '0');
                          return `<div class="char-buff-item">${buff.name}（剩余 ${m}:${s}）</div>`;
                      }).join('');
                  }
              }
              lastRenderedState.activeBuffs = JSON.stringify(activeBuffs);
          }
      }
      
      const headerKey = `${state.agg.totalHQ}|${meta.character.name}|${meta.character.title}|${meta.buffs.length}`;
      if (headerKey !== lastRenderedState.headerKey) {
        renderHeaderStatus();
        lastRenderedState.headerKey = headerKey;
      }

      requestAnimationFrame(loop);
  }
  
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && state.active && !state.active.isPaused){ pauseTimer(); }});
  
  if (el.modeSwitchBtn) { el.modeSwitchBtn.addEventListener('click', () => { playSound(sfx.click); meta.arcade = !meta.arcade; save(); updateModeButton(); pushToast(`已切换到${meta.arcade ? '街机' : '专注'}模式`); }); }
  if (el.btnHelp) el.btnHelp.onclick=()=>{ playSound(sfx.modalOpen); el.helpMask.style.display='flex'; };
  el.btnCloseHelp.onclick=()=>{ playSound(sfx.modalClose); el.helpMask.style.display='none'; };
  el.btnCloseDev.onclick=()=>{ playSound(sfx.modalClose); el.devMask.style.display='none'; };
  el.btnSaveRates.onclick=()=>{ playSound(sfx.click); const r1=parseFloat(el.rate1.value)||0, r2=parseFloat(el.rate2.value)||0, r3=parseFloat(el.rate3.value)||0, r4=parseFloat(el.rate4.value)||0, r5=parseFloat(el.rate5.value)||0; RATE_BY_DIFFICULTY={1:Math.max(0,r1),2:Math.max(0,r2),3:Math.max(0,r3),4:Math.max(0,r4),5:Math.max(0,r5)}; save(); updateRate(); pushToast('速率已保存并应用','success'); };
  el.btnResetRates.onclick=()=>{ playSound(sfx.click); RATE_BY_DIFFICULTY={...DEFAULT_RATES}; save(); updateRate(); pushToast('已恢复默认速率','success'); };
  el.btnAdd.onclick=addTask; el.taskTitle.addEventListener('keydown',e=>{ if(e.key==='Enter') addTask(); });
  el.btnClearAll.onclick=()=>{ playSound(sfx.click); if(confirm('清空所有任务与累计数据（不清空库存/连胜/每日/速率），确定？')){ state.tasks=[]; state.agg={totalHQ:0,totalSeconds:0}; state.active=null; save(); renderTasks(); renderKPI(); setControls(); el.activeHint.textContent='未选择任务'; sessionFlip.setValue(0,true); el.sessionTime.textContent='0:00:00'; el.taskTotal.textContent='0'; el.taskTime.textContent='0:00:00'; el.rateText.textContent='0'; } };
  el.btnStart.onclick=startTimer; el.btnPause.onclick=pauseTimer; el.btnStop.onclick=stopTimer;

  function setupButtonPair(mobileId: string, desktopId: string, callback: () => void) { const mobileBtn = document.getElementById(mobileId); const desktopBtn = document.getElementById(desktopId); if (mobileBtn) mobileBtn.onclick = callback; if (desktopBtn) desktopBtn.onclick = callback; }
  const refreshMissionsAction = () => { playSound(sfx.click); const ok = rollMissions(false, false); if (ok) { save(); renderDaily(); renderInventory(); pushToast('已刷新每日任务', 'success'); } };
  el.btnDailyRefresh.onclick = refreshMissionsAction;

function todayObj(){ const k = todayKey(); if (!meta.daily[k]) { meta.daily[k] = { progressSec: 0, hardSec: 0, sessions: 0, zeroPauseSessions: 0, missions: null, refreshUsed: false, done: {}, completed: [] }; } if (!Array.isArray(meta.daily[k].completed)) { meta.daily[k].completed = []; } return meta.daily[k]; }
  const FIXED_MISSIONS=[{id:'total25',type:'totalSec',need:25*60,label:'今日累计 ≥ 25 分钟',reward:{ticket:1}},{id:'total45',type:'totalSec',need:45*60,label:'今日累计 ≥ 45 分钟',reward:{freeze:1}}];
  const RANDOM_POOL=[{id:'total90',type:'totalSec',need:90*60,label:'今日累计 ≥ 90 分钟',reward:{ticket:2}},{id:'single15',type:'singleSec',need:15*60,label:'单次 ≥ 15 分钟',reward:{ticket:1}},{id:'single30',type:'singleSec',need:30*60,label:'单次 ≥ 30 分钟',reward:{ticket:2}},{id:'hard20',type:'hardSec',need:20*60,label:'难度≥4 今日累计 ≥ 20 分钟',reward:{ticket:1}},{id:'noPause10',type:'noPauseSingle',need:10*60,label:'单次 ≥ 10 分钟且无暂停',reward:{freeze:1}},{id:'sessions3',type:'sessions',need:3,label:'今日完成 ≥ 3 次计时',reward:{ticket:1}}];
  function addTodayProgress({seconds,difficulty,pauses}: {seconds: number, difficulty: number, pauses: number}){const d=todayObj(); d.progressSec+=seconds; if(difficulty>=4) d.hardSec+=seconds; d.sessions+=1; if(pauses===0 && seconds>=10*60) d.zeroPauseSessions+=1; save(); renderDaily();}
  function onSegmentEnd_base(seconds: number,difficulty: number,pauses: number){ if(seconds>=ECON.baseFloorMinSec){ meta.streak=+(meta.streak+ECON.streakStep).toFixed(2)} addTodayProgress({seconds,difficulty,pauses}); save(); }
  function singleMissionJudge(seconds: number,diff: number,pauses: number){ const d=todayObj(); if(!d.missions) return; d.missions.forEach((m: any)=>{ if(d.done[m.id]) return; if(m.type==='singleSec' && seconds>=m.need) d.done[m.id]=true; if(m.type==='noPauseSingle' && seconds>=m.need && pauses===0) d.done[m.id]=true; }); save(); renderDaily(); }
  function rollMissions(firstFree=false,useRare=false){
    const d=todayObj(); if(useRare){ if((meta.badges.rare_gem||0)<6){alert('稀有碎片不足');return false;} meta.badges.rare_gem-=6; }
    else{ if(d.refreshUsed && (meta.tickets||0)<=0){alert('抽卡券不足（每日首次刷新免费）');return false;} if(d.refreshUsed) meta.tickets-=1; }
    d.refreshUsed=true; const pool=[...RANDOM_POOL], pick=[]; for(let i=0;i<3;i++){const j=Math.floor(Math.random()*pool.length); pick.push(pool.splice(j,1)[0]);}
    d.missions=[...FIXED_MISSIONS,...pick]; d.done={}; save(); renderDaily(); renderInventory(); return true;
  }
  function renderDaily(){
    const d=todayObj(); if(!d.missions){rollMissions(true);return} const fragment = document.createDocumentFragment();
    d.missions.forEach((m: any)=>{ const ok=(()=>{if(m.type==='totalSec')return d.progressSec>=m.need; if(m.type==='hardSec')return d.hardSec>=m.need; if(m.type==='sessions')return d.sessions>=m.need; return false})();
      const done=!!d.done[m.id]; const progress=(()=>{if(m.type==='totalSec')return `${fmtTime(Math.min(d.progressSec,m.need))}/${fmtTime(m.need)}`; if(m.type==='hardSec')return `${fmtTime(Math.min(d.hardSec,m.need))}/${fmtTime(m.need)}`; if(m.type==='sessions')return `${Math.min(d.sessions,m.need)}/${m.need}`; if(m.type==='singleSec')return `完成一次 ≥ ${fmtTime(m.need)}`; if(m.type==='noPauseSingle')return `完成一次 ≥ ${fmtTime(m.need)}(0暂停)`; return ''})();
      const buttonText = done ? '已领取' : '领取'; const row = document.createElement('div'); row.className = 'daily-task-card';
      row.innerHTML = `<div class="daily-task-info"> <div class="daily-task-label">${m.label}</div> <div class="daily-task-progress muted">${progress ? `${progress}` : ''}</div> </div> <div class="daily-task-action"> <button class="btn small" ${(!ok || done) ? 'disabled' : ''}>${buttonText}</button> </div>`;
      (row.querySelector('button') as HTMLElement).onclick=()=>{ if(done||!ok)return; playSound(sfx.success); d.done[m.id]=true; if(m.reward.ticket)meta.tickets=(meta.tickets||0)+m.reward.ticket; if(m.reward.freeze)meta.freeze=(meta.freeze||0)+m.reward.freeze; save(); renderDaily(); renderInventory(); };
      fragment.appendChild(row); });
    el.dailyList.innerHTML = ''; el.dailyList.appendChild(fragment);
  }

  function renderInventory(){
    ensureBadgeMeta(); const b=meta.badges||{}; const buff=todayBuff();
    el.invRow.innerHTML=`<div class="badge">稀有碎片：<b>${b.rare_gem||0}</b></div><div class="badge">史诗碎片：<b>${b.epic_gem||0}</b></div><div class="badge">稀有徽章：<b>${b.rare_tokens||0}</b></div><div class="badge">史诗徽章：<b>${b.epic_tokens||0}</b></div><div class="badge">传说徽章：<b>${b.legendary_tokens||0}</b></div><div class="badge">冻结卡：<b>${meta.freeze||0}</b></div><div class="badge">抽卡券：<b>${meta.tickets||0}</b></div><div class="badge">当日速率加成：<b>${Math.round((buff.rateBuff||0)*100)}%</b></div>${meta.nextWheelBoost>1?`<div class="badge">下一次幸运轮奖池 ×${meta.nextWheelBoost.toFixed(2)}</div>`:''}`;
    renderWorkshop();
  }

  function renderWorkshop(){
    const body = el.badgeWorkshopBody; if (!body) return; ensureBadgeMeta(); const b = meta.badges || {};
    const rare = b.rare_gem || 0; const epic = b.epic_gem || 0;
    body.innerHTML = ` <div class="workshop-section"> <div class="muted" style="margin-bottom:6px">碎片库存</div> <div class="badge-card">稀有碎片：<b>${rare}</b> · 史诗碎片：<b>${epic}</b></div> </div> <div class="workshop-section"> <div class="muted" style="margin-bottom:6px">合成与消耗</div> <div class="loadout-grid"> <div class="loadout-slot"> <div class="muted">合成冻结卡（稀有×15）</div> <button class="btn small" id="wsForgeFreeze"${rare<15?' disabled':''}>锻造</button> </div> <div class="loadout-slot"> <div class="muted">刷新每日（稀有×6）</div> <button class="btn small" id="wsRareRefresh"${rare<6?' disabled':''}>使用</button> </div> <div class="loadout-slot"> <div class="muted">幸运轮强运（稀有×10）</div> <button class="btn small" id="wsWheelBoost"${rare<10?' disabled':''}>注入</button> </div> <div class="loadout-slot"> <div class="muted">调速芯片 +5%（稀有×20，上限20%）</div> <button class="btn small" id="wsSpeedChip"${rare<20?' disabled':''}>安装</button> </div> </div> </div> `;
    const bind = (id: string, fn: () => void) => { const x = document.getElementById(id); if (x) x.onclick = fn; };
    bind('wsForgeFreeze', forgeFreeze); bind('wsRareRefresh', rareRefresh); bind('wsWheelBoost', activateWheelBoost); bind('wsSpeedChip', applySpeedChip);
  }

  function forgeFreeze(){ playSound(sfx.click); if((meta.badges.rare_gem||0)<15){alert('稀有碎片不足');return;} meta.badges.rare_gem-=15; meta.freeze=(meta.freeze||0)+1; save(); renderInventory(); pushToast('锻造成功，获得冻结卡×1','success'); }
  function rareRefresh(){ playSound(sfx.click); if(rollMissions(false,true)){ save(); renderInventory(); pushToast('已使用稀有碎片刷新每日任务','success'); } }
  function activateWheelBoost(){ playSound(sfx.click); if((meta.badges.rare_gem||0)<10){alert('稀有碎片不足');return;} meta.badges.rare_gem-=10; meta.nextWheelBoost=Math.min((meta.nextWheelBoost||1)*1.5,3); save(); renderInventory(); pushToast('已注入强运，下一次幸运轮提升','success'); }
  function applySpeedChip(){ playSound(sfx.click); if((meta.badges.rare_gem||0)<20){alert('稀有碎片不足');return;} const buff=todayBuff(); if(buff.rateBuff>=0.20){alert('今日加成已达上限');return;} meta.badges.rare_gem-=20; buff.rateBuff=+(Math.min(0.20,(buff.rateBuff||0)+0.05).toFixed(2)); save(); renderInventory(); updateRate(); pushToast('当日基础速率 +5%','success'); }
  
  const openTaskLibrary = () => { playSound(sfx.modalOpen); el.taskLibraryMask.style.display = 'flex'; }; el.btnTaskLibrary.onclick = openTaskLibrary;
  if(el.btnCloseTaskLibrary) el.btnCloseTaskLibrary.onclick=()=>{ playSound(sfx.modalClose); el.taskLibraryMask.style.display='none'; };
  if(el.btnImportTasks) el.btnImportTasks.onclick=()=>{
    playSound(sfx.click); const inputText = (el.taskLibraryInput.value||'').trim(); if(!inputText){ pushToast('任务库输入为空','warn'); return; }
    const lines = inputText.split('\n'); let imported=0;
    lines.forEach(line=>{ const s=line.trim(); if(!s) return; const parts = s.split('|');
      if(parts.length<2){ pushToast(`跳过无效行: ${s}`,'warn'); return; } const title=parts[0].trim(); const difficulty=parseInt((parts[1]||'').trim(),10);
      if(!title || isNaN(difficulty) || difficulty<1 || difficulty>5){ pushToast(`跳过无效任务: ${s}`,'warn'); return; }
      let reward=null; const rewardTypeKey=(parts[2]||'').trim().toLowerCase();
      if(rewardTypeKey){ if(!REWARD_TYPES[rewardTypeKey]){ pushToast(`未知奖励类型：${rewardTypeKey}`,'warn'); return; }
        const amountRaw=parts[3]!==undefined?parts[3].trim():''; const amountVal=amountRaw?Number(amountRaw):1;
        if(Number.isNaN(amountVal)){ pushToast(`奖励数量无效：${s}`,'warn'); return; }
        reward={type:rewardTypeKey,amount:normalizeRewardAmount(amountVal||1)}; }
      state.tasks.unshift({id:uid(), title, difficulty, totalHQ:0, totalSeconds:0, reward}); imported++; });
    if(imported>0){ save(); renderTasks(); pushToast(`成功导入 ${imported} 个任务`,'success'); el.taskLibraryInput.value=''; } else { pushToast('未导入任何任务','warn'); }
  };

  const openTodayDone = () => { playSound(sfx.modalOpen); renderTodayDone(); el.todayDoneMask.style.display = 'flex'; };
  el.btnTodayDone.onclick = openTodayDone;
  el.btnCloseTodayDone.onclick = () => { playSound(sfx.modalClose); el.todayDoneMask.style.display = 'none'; };
  el.btnSpin.onclick=startNameTicker;
  
  function renderYou() {
    ensureBadgeMeta(); const { avatarUploader, charNameInput, charTitleInput, charLevelText, charTotalHQText } = el;
    const totalHQ = state.agg.totalHQ || 0; const hqForLevelUp = 1000;
    const currentLevel = Math.floor(totalHQ / hqForLevelUp) + 1; const nextLevel = currentLevel + 1;
    const currentLevelBaseHQ = (currentLevel - 1) * hqForLevelUp; const hqInCurrentLevel = totalHQ - currentLevelBaseHQ;
    const hqNeeded = hqForLevelUp - hqInCurrentLevel;
    const expLevelNowEl = document.getElementById("expLevelNow"); const expLevelNextEl = document.getElementById("expLevelNext");
    const expBarFillEl = document.getElementById("expBarFill") as HTMLElement; const expValueTextEl = document.getElementById("expValueText");
    const expGapEl = document.querySelector(".exp-bar-info .exp-gap");
    if (expLevelNowEl) expLevelNowEl.textContent = String(currentLevel); if (expLevelNextEl) expLevelNextEl.textContent = String(nextLevel);
    if (expBarFillEl) { const percent = Math.min(99.5, (hqInCurrentLevel / hqForLevelUp) * 100); expBarFillEl.style.width = `${percent}%`; }
    if (expValueTextEl) expValueTextEl.textContent = `${Math.floor(hqInCurrentLevel)} / ${hqForLevelUp}`;
    if (expGapEl) expGapEl.textContent = `距下级：${Math.ceil(hqNeeded)} 豪情值`;
    avatarUploader.style.backgroundImage = meta.character.avatar ? `url(${meta.character.avatar})` : 'none';
    if (!meta.character.avatar) avatarUploader.innerHTML = '点击<br>上传头像'; else avatarUploader.innerHTML = '';
    charNameInput.value = meta.character.name; charTitleInput.value = meta.character.title;
    charLevelText.textContent = `Lv. ${currentLevel}`; charTotalHQText.textContent = `${Math.floor(totalHQ).toLocaleString()} HQ`;
  }
  
  if (el.avatarUploader) {
    el.avatarUploader.onclick = () => { if (!isCloudBaseConfigured || !auth.currentUser) { pushToast('请先登录', 'warn'); return; } el.avatarInput.click(); };
    
    const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
        return new Promise((resolve, reject) => { const reader = new FileReader();
            reader.onload = e => { const img = new Image(); img.onload = () => { let width = img.width; let height = img.height;
                    if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } } else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
                    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); if (!ctx) { return reject(new Error('Could not get canvas context')); } ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality)); };
                img.onerror = reject; 
                // Fix: ensure e.target.result is a string before assigning to img.src
                if (e.target && typeof e.target.result === 'string') {
                    img.src = e.target.result;
                } else {
                    reject(new Error('FileReader result is not a string'));
                }
            };
            reader.onerror = reject; reader.readAsDataURL(file); }); };

    function dataURLtoFile(dataurl: string, filename: string) {
        var arr = dataurl.split(','), mimeMatch = arr[0].match(/:(.*?);/),
            mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream',
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new File([u8arr], filename, {type:mime});
    }

    el.avatarInput.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0]; 
      const loginState = auth.currentUser;
      if (!file || !isCloudBaseConfigured || !loginState) return;
      el.avatarUploader.innerHTML = '处理中...'; el.avatarInput.value = '';
      try {
        const resizedDataUrl = await resizeImage(file, 256, 256, 0.8);
        const imageFile = dataURLtoFile(resizedDataUrl, 'avatar.jpg');
        const cloudPath = `avatars/${loginState.uid}.jpg`;
        
        const uploadResult = await app.uploadFile({ cloudPath: cloudPath, filePath: imageFile });
        const fileListResult = await app.getTempFileURL({ fileList: [uploadResult.fileID] });
        const downloadURL = fileListResult.fileList[0].tempFileURL;

        meta.character.avatar = downloadURL;
        save();
        pushToast('头像已上传并同步', 'success');
      } catch (error: any) {
        console.error("Avatar upload failed:", error);
        pushToast(`头像上传失败: ${error.code || error.message}`, 'warn');
      } finally {
        renderYou();
      }
    };
  }

  if (el.charNameInput) { el.charNameInput.onblur = () => { meta.character.name = el.charNameInput.value.trim(); save(); }; }
  if (el.charTitleInput) { el.charTitleInput.onblur = () => { meta.character.title = el.charTitleInput.value.trim(); save(); }; }

  function renderInitial(){ renderTasks(); renderKPI(); renderDaily(); renderInventory(); renderWorkshop(); renderFunshop(); renderYou(); renderHeaderStatus(); hidePauseIndicator(); setControls(); updateModeButton();}

  if(el.btnFunshopEdit) el.btnFunshopEdit.onclick=()=>{ playSound(sfx.modalOpen); const acts=meta.funshop.activities||[];
    const lines=acts.map(a=>{ const need=Object.entries(a.need||{}).map(([k,v])=>`${k}*${v}`).join(',');
      const wear=Object.entries(a.wear||{}).map(([k,v])=>`${k}*${v}`).join(',');
      const win=a.timeWindow?`${a.timeWindow.start}-${a.timeWindow.end}`:'';
      return `${a.title}|${a.seconds}|需求: ${need}|磨损: ${wear}|时段: ${win}`; }).join('\n');
    if(el.funshopInput) el.funshopInput.value=lines; el.funshopEditMask.style.display='flex'; };
  if(el.btnCloseFunshopEdit) el.btnCloseFunshopEdit.onclick=()=>{ playSound(sfx.modalClose); el.funshopEditMask.style.display='none'; };
  if(el.btnFunshopImport) el.btnFunshopImport.onclick=()=>{ playSound(sfx.click); const text=(el.funshopInput.value||'').trim();
    const acts=parseFunshopLines(text); meta.funshop.activities=acts; save(); renderFunshop(); pushToast('已导入娱乐活动','success'); };
  
  const btnCopyFunshopFormat = document.getElementById('btnCopyFunshopFormat');
  if(btnCopyFunshopFormat) { btnCopyFunshopFormat.onclick = () => { playSound(sfx.click);
      const textToCopy = `放松呼吸训练|300|需求: rare_token*1|磨损: rare_token*5|\n豪情轮盘挑战|180|需求: epic_token*1|磨损: epic_token*8|时段: 19:00-23:00\n街机小游园|120|需求: rare_token*1|磨损: rare_token*3,ticket*1|`;
      navigator.clipboard.writeText(textToCopy.trim()).then(() => { pushToast('已复制示例格式到剪贴板', 'success');
      }).catch(err => { pushToast('复制失败', 'warn'); console.error('Copy failed', err); }); }; }
  
  const youPageHelpBtn = document.getElementById('youPageHelpBtn');
  if (youPageHelpBtn) { youPageHelpBtn.onclick = () => { playSound(sfx.modalOpen); if (el.helpMask) el.helpMask.style.display = 'flex'; }; }
  
  const setupDevTrigger = (element: HTMLElement | null) => {
    if (!element) return;
    let clickCount = 0;
    let clickTimer: any = null;
    element.addEventListener('click', () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 600);
        if (clickCount === 3) {
            clickCount = 0;
            clearTimeout(clickTimer);
            if (el.devMask) {
                playSound(sfx.modalOpen);
                // Fix: Convert number to string for input value
                el.rate1.value=String(RATE_BY_DIFFICULTY[1]); el.rate2.value=String(RATE_BY_DIFFICULTY[2]); el.rate3.value=String(RATE_BY_DIFFICULTY[3]); el.rate4.value=String(RATE_BY_DIFFICULTY[4]); el.rate5.value=String(RATE_BY_DIFFICULTY[5]);
                el.devRewardBaseChance.value = String(REWARD_PARAMS.baseChance); el.devRewardBetCoeff.value = String(REWARD_PARAMS.betCoefficient);
                el.devRewardMaxChance.value = String(REWARD_PARAMS.maxChance); el.devRewardPityInc.value = String(REWARD_PARAMS.pityIncrement);
                ensureBadgeMeta(); const b = meta.badges || {};
                el.devTotalHQ.value = String(Math.floor(state.agg.totalHQ || 0)); el.devTickets.value = String(meta.tickets || 0);
                el.devFreeze.value = String(meta.freeze || 0); el.devRareGem.value = String(b.rare_gem || 0); el.devEpicGem.value = String(b.epic_gem || 0);
                el.devRareToken.value = String(b.rare_tokens || 0); el.devEpicToken.value = String(b.epic_tokens || 0); el.devLegendToken.value = String(b.legendary_tokens || 0);
                el.devMask.style.display = 'flex';
            }
        }
    });
  };
  setupDevTrigger(el.totalValorChip);
  setupDevTrigger(el.mobileHeaderStatus);
  
  if (el.btnSaveResources) { el.btnSaveResources.onclick = () => { playSound(sfx.click); const p = (s: string) => parseInt(s, 10) || 0;
      state.agg.totalHQ = p(el.devTotalHQ.value); meta.tickets = p(el.devTickets.value); meta.freeze = p(el.devFreeze.value);
      ensureBadgeMeta(); meta.badges.rare_gem = p(el.devRareGem.value); meta.badges.epic_gem = p(el.devEpicGem.value);
      meta.badges.rare_tokens = p(el.devRareToken.value); meta.badges.epic_tokens = p(el.devEpicToken.value);
      meta.badges.legendary_tokens = p(el.devLegendToken.value);
      save(); renderKPI(); renderInventory(); pushToast('资源已更新', 'success'); }; }

  if (el.btnSaveRewardParams) { el.btnSaveRewardParams.onclick = () => { playSound(sfx.click); const p = (s: string) => parseFloat(s) || 0;
      REWARD_PARAMS.baseChance = p(el.devRewardBaseChance.value); REWARD_PARAMS.betCoefficient = p(el.devRewardBetCoeff.value);
      REWARD_PARAMS.maxChance = p(el.devRewardMaxChance.value); REWARD_PARAMS.pityIncrement = p(el.devRewardPityInc.value);
      save(); pushToast('奖励赔率已保存', 'success'); }; }
  
  if (el.btnResetRewardParams) { el.btnResetRewardParams.onclick = () => { playSound(sfx.click); REWARD_PARAMS = { ...DEFAULT_REWARD_PARAMS };
      el.devRewardBaseChance.value = String(REWARD_PARAMS.baseChance); el.devRewardBetCoeff.value = String(REWARD_PARAMS.betCoefficient);
      el.devRewardMaxChance.value = String(REWARD_PARAMS.maxChance); el.devRewardPityInc.value = String(REWARD_PARAMS.pityIncrement);
      save(); pushToast('已恢复默认赔率', 'success'); }; }

  if (el.btnSimulateNextDay) { el.btnSimulateNextDay.onclick = () => { playSound(sfx.click); window._debugDateOffset = (window._debugDateOffset || 0) + 1; renderInitial(); pushToast(`已模拟到下一天 (${getToday().toLocaleDateString()})`, 'success'); }; }
  if (el.btnResetDaily) { el.btnResetDaily.onclick = () => { playSound(sfx.click); const d = todayObj();
          d.progressSec = 0; d.hardSec = 0; d.sessions = 0; d.zeroPauseSessions = 0; d.missions = null; d.refreshUsed = false; d.done = {};
          rollMissions(true); save(); renderDaily(); pushToast('每日进度已重置', 'success'); }; }
  
  if (el.btnHardReset) { el.btnHardReset.onclick = () => { playSound(sfx.warn);
          if (confirm('危险操作：这将清除此浏览器中的所有应用数据，确定吗？')) { resetAppToDefaults(); location.reload(); } }; }
  
  if (el.btnExportState) { el.btnExportState.onclick = () => { playSound(sfx.click);
      const fullState = { tasks: state.tasks, agg: state.agg, meta: meta, rates: RATE_BY_DIFFICULTY, funshop: FUNSHOP, rewardParams: REWARD_PARAMS, active: state.active };
      el.devStateText.value = JSON.stringify(fullState, null, 2); pushToast('状态已导出到文本框。'); }; }
  
  if (el.btnImportState) { el.btnImportState.onclick = () => { playSound(sfx.click); const json = el.devStateText.value;
      if (!json) { pushToast('导入框为空。', 'warn'); return; }
      try { const imported = JSON.parse(json); 
        state.tasks = imported.tasks || []; state.agg = imported.agg || {totalHQ: 0, totalSeconds: 0}; state.active = imported.active || null;
        meta = imported.meta || getInitialMeta(); RATE_BY_DIFFICULTY = imported.rates || DEFAULT_RATES;
        FUNSHOP = imported.funshop || FUNSHOP; REWARD_PARAMS = imported.rewardParams || DEFAULT_REWARD_PARAMS;
        save(); renderInitial(); pushToast('状态导入成功！', 'success'); el.devStateText.value = '';
      } catch (e) { pushToast('解析JSON时出错，请检查控制台。', 'warn'); console.error("Import Error:", e); } }; }
  
  const btnToggleSound = document.getElementById('btnToggleSound');
  function updateSoundButton() { if (btnToggleSound) { btnToggleSound.textContent = `音效：${isSoundMuted ? '关闭' : '开启'}`; } }
  if(btnToggleSound){ btnToggleSound.onclick = () => { isSoundMuted = !isSoundMuted; writeJSON(LS_KEYS.SOUND_MUTED, isSoundMuted); updateSoundButton(); if (!isSoundMuted) { playSound(sfx.click); } }; updateSoundButton(); }
  
  const showLoader = (text: string) => { if(el.loadingOverlay) { el.loadingOverlay.textContent = text; el.loadingOverlay.style.display = 'flex'; }};
  const hideLoader = () => { if(el.loadingOverlay) el.loadingOverlay.style.display = 'none'; };

  const signIn = async () => {
    if (!isCloudBaseConfigured) return;
    try {
        await auth.signInAnonymously();
        pushToast('匿名登录成功', 'success');
    } catch (error: any) {
        console.error("Anonymous Sign-In Error:", error);
        pushToast(`登录失败: ${error.message}`, 'warn');
    }
  };
  const signOut = () => {
    if (!isCloudBaseConfigured) return;
    auth.signOut();
  };

  el.btnLogin.onclick = signIn;
  el.btnLogout.onclick = signOut;

  const setupCloudBaseListener = (uid: string) => {
    if (realtimeListener) realtimeListener.close();
    
    realtimeListener = db.collection('users').doc(uid).watch({
      onChange: (snapshot: any) => {
        if (snapshot.docs.length > 0) {
          const data = snapshot.docs[0];
          delete data._id;
          applyCloudData(data);
        }
        // No 'else' block needed, initial creation is handled in initializeApp
      },
      onError: (err: any) => {
        console.error("CloudBase listener error:", err);
        pushToast('与云端同步时出错', 'warn');
        hideLoader();
      }
    });
  };

  async function initializeApp() {
    loadStateFromLocalStorage();
    renderInitial();
    loop();
    tickFunshopTimers();

    if (!isCloudBaseConfigured) {
        el.authChipWrapper.style.display = 'none';
        pushToast('CloudBase未配置，应用在本地模式下运行', 'info');
        return;
    }
    
    auth.onLoginStateChanged(async (loginState: any) => {
      if (loginState) {
          el.authChipWrapper.classList.add('logged-in');
          el.authStatusText.textContent = '已登录 (匿名)';
          el.userAvatar.style.backgroundImage = 'none'; // No avatar for anonymous
          showLoader('同步云端数据...');
          
          try {
            const userDocRef = db.collection('users').doc(loginState.user.uid);
            const docSnap = await userDocRef.get();

            if (docSnap.data && docSnap.data.length > 0) {
                console.log("Existing user, applying cloud data.");
                const data = docSnap.data[0];
                delete data._id;
                applyCloudData(data);
            } else {
                console.log("New user, creating document in CloudBase from local state.");
                const fullState = { 
                    tasks: state.tasks, agg: state.agg, active: null, 
                    meta: meta, rates: RATE_BY_DIFFICULTY, funshop: FUNSHOP, 
                    rewardParams: REWARD_PARAMS,
                    _id: loginState.user.uid,
                    lastUpdated: new Date()
                };
                await userDocRef.set(fullState);
            }
            setupCloudBaseListener(loginState.user.uid);
          } catch (err) {
              console.error("Error during initial data sync:", err);
              pushToast("同步初始数据失败", "warn");
          } finally {
              hideLoader();
          }

      } else {
          if (realtimeListener) {
              realtimeListener.close();
              realtimeListener = null;
          }
          el.authChipWrapper.classList.remove('logged-in');
          resetAppToDefaults();
          hideLoader();
      }
    });

    // Check initial login state
    const loginState = await auth.getLoginState();
    if (!loginState) {
        signIn(); // Automatically sign in anonymously on first load
    }
  }

  initializeApp();
});