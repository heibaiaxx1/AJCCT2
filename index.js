
document.addEventListener('DOMContentLoaded', ()=>{

const rootEl = document.documentElement;
const isIOSDevice = /iP(hone|od|ad)/i.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

const applyDynamicSafeAreas = () => {
  if (!isIOSDevice || !window.visualViewport) {
    rootEl.style.setProperty('--safe-area-bottom-dynamic', '0px');
    return;
  }
  const vv = window.visualViewport;
  const bottomInset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  rootEl.style.setProperty('--safe-area-bottom-dynamic', `${Math.round(bottomInset)}px`);
};

applyDynamicSafeAreas();
if (isIOSDevice && window.visualViewport) {
  ['resize','orientationchange'].forEach(evt => window.addEventListener(evt, applyDynamicSafeAreas));
  ['resize','scroll'].forEach(evt => window.visualViewport.addEventListener(evt, applyDynamicSafeAreas));
}

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
let app, auth, db, realtimeListener = null;
let currentLoginState = null;
let cloudSyncReady = false; // Flag to prevent premature writes
let CLIENT_ID = '';
let lastRemoteSyncStamp = 0;
let isApplyingRemoteSnapshot = false;

// Cross-device sync state
let timerHeartbeatInterval = null;
const HEARTBEAT_INTERVAL_MS = 2000; // 减少到2秒，提高实时性
const DEVICE_TIMEOUT_MS = 30000; // 30秒无心跳则视为离线


if (isCloudBaseConfigured) {
  if (typeof cloudbase === 'undefined') {
    console.error("CloudBase SDK not loaded. Please check your network connection and ad blockers.");
    alert("CloudBase SDK 脚本加载失败，请检查网络连接或浏览器插件。应用将以本地模式运行。");
    isCloudBaseConfigured = false;
  } else {
    try {
      app = cloudbase.init({
        env: cloudbaseConfig.env
      });
      auth = app.auth({ persistence: "local" });
      db = app.database();
      console.log("Tencent CloudBase initialized successfully.");
    } catch (e) {
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
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, v),
      removeItem: (k) => m.delete(k)
    };
  }
})();

const readJSON = (key, fallback) => {
  try { const s = localStore.getItem(key); return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
};
const writeJSON = (key, val) => {
  try { localStore.setItem(key, JSON.stringify(val)); } catch {}
};

const CLIENT_ID_STORAGE_KEY = 'haoqing_client_id';
CLIENT_ID = readJSON(CLIENT_ID_STORAGE_KEY, null);
if (!CLIENT_ID) {
  CLIENT_ID = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  writeJSON(CLIENT_ID_STORAGE_KEY, CLIENT_ID);
}

/* ========== 静态数据（省略无关注释） ========== */
const PRIZE_NAMES = ['特等奖','一等奖','二等奖','三等奖','四等奖','五等奖','六等奖','七等奖'];
const WHEEL_SEGMENTS = PRIZE_NAMES.map((name, i) => {
  const types = ['hq','rare','epic','freeze'];
  const colors = ['#6f87ff','#28c686','#c38bff','#ff7b92'];
  return { type: types[i % types.length], label: name, color: colors[i % types.length] };
});

class FlipCounter{
  constructor(container,{digits=6,small=false,comma=true,large=false}={}){
    this.digits=digits;this.comma=comma;this.cellHeight=small?24:(large?48:32);
    this.root=document.createElement('div');this.root.className='flip'+(small?' small':'')+(large?' large':'');this.cols=[];
    for(let i=0;i<this.digits;i++){
      const col=document.createElement('div');col.className='col';
      const stack=document.createElement('div');stack.className='digits';
      for(let d=0;d<=9;d++){const cell=document.createElement('div');cell.className='digit';cell.textContent=String(d);stack.appendChild(cell)}
      for(const e of [0,1]){const cell=document.createElement('div');cell.className='digit';cell.textContent=String(e);stack.appendChild(cell)}
      col.appendChild(stack);this.root.appendChild(col);this.cols.push({stack,value:0,pos:0,wrapPos:stack.childElementCount-2});
      if(this.comma&&(this.digits-i)%3===1&&i!==this.digits-1){const sep=document.createElement('div');sep.className='sep';sep.textContent=',';this.root.appendChild(sep)}
    }
    container.innerHTML='';container.appendChild(this.root);
    const sample=this.root.querySelector('.digit'); if(sample){const rect=sample.getBoundingClientRect(); if(rect&&rect.height){this.cellHeight=rect.height;}}
    this.setValue(0,true)
  }
  _str(n){return Math.floor(n).toString().padStart(this.digits,'0').slice(-this.digits)}
  setValue(n,instant=false){
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
  flipTo(n){
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
const REWARD_TYPES = {
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

function persistLocalState() {
    writeJSON(LS_KEYS.TASKS, state.tasks);
    writeJSON(LS_KEYS.AGG, state.agg);
    writeJSON(LS_KEYS.META, meta);
    writeJSON(LS_KEYS.RATES, RATE_BY_DIFFICULTY);
    writeJSON(LS_KEYS.FUNSHOP, FUNSHOP);
    writeJSON(LS_KEYS.REWARD_PARAMS, REWARD_PARAMS);
}

function getFullStateSnapshot(syncStamp = Date.now()) {
    // 增加版本号，确保数据同步的可靠性
    const currentVersion = (state.syncVersion || 0) + 1;
    state.syncVersion = currentVersion;
    
    return {
        tasks: state.tasks,
        agg: state.agg,
        active: state.active,
        meta,
        rates: RATE_BY_DIFFICULTY,
        funshop: FUNSHOP,
        rewardParams: REWARD_PARAMS,
        syncVersion: currentVersion, // 新增版本号字段
        syncMeta: {
            clientId: CLIENT_ID,
            updatedAt: syncStamp,
            version: currentVersion, // 在元数据中也包含版本号
        },
    };
}
  
  const DEFAULT_RATES={1:1,2:2,3:4,4:7,5:11};
  let RATE_BY_DIFFICULTY = (()=>{ const r=readJSON(LS_KEYS.RATES,{}); return {...DEFAULT_RATES,...r} })();
  
  const DEFAULT_REWARD_PARAMS = { baseChance: 0.4, betCoefficient: 0.25, maxChance: 0.9, pityIncrement: 0.015 };
  let REWARD_PARAMS = readJSON(LS_KEYS.REWARD_PARAMS, { ...DEFAULT_REWARD_PARAMS });
  
  const getInitialState = () => ({
    tasks: [], 
    agg: {totalHQ:0,totalSeconds:0}, 
    active: null,
    selectedTaskId: null,
    syncVersion: 0, // 添加同步版本号
    saveRetryCount: 0, // 添加保存重试计数
  });

  const getInitialMeta = () => ({
      streak:0,pity:0,arcade:false,freeze:0,
      badges:{rare_gem:0, epic_gem:0, rare_tokens:0, epic_tokens:0, legendary_tokens:0, owned:{}, loadout:{slot1:null,slot2:null,slot3:null}, loadoutCooldownUntil:0},
      tickets:0,
      daily:{},dailyBuff:{},multDayCount:{},guardUsedToday:0,guardDay:null,nextWheelBoost:1,
      completed:{},
      funshop:{ activities:[], wearAccum:{} },
      character: { name: '', title: '', avatar: null },
      buffs: []
  });

  let state = getInitialState();
  let meta = getInitialMeta();
  let FUNSHOP = {};

  const loadStateFromLocalStorage = () => {
    state = { 
        tasks: readJSON(LS_KEYS.TASKS, []), 
        agg: readJSON(LS_KEYS.AGG, {totalHQ:0,totalSeconds:0}), 
        active: null, // Always start with no active timer from local state
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

const applyCloudData = (data) => {
    if (!data || typeof data !== 'object') {
        console.warn("Received invalid cloud data (not an object).");
        return;
    }

    try {
        isApplyingRemoteSnapshot = true;
        
        let incoming = { ...data };
        if (incoming.data && typeof incoming.data === 'object' && !Array.isArray(incoming.data) && !incoming.tasks && !incoming.agg) {
            incoming = { ...incoming.data };
        }
        delete incoming._id;

        const syncMeta = incoming.syncMeta || {};
        if (syncMeta.clientId === CLIENT_ID) {
            // 检查版本号，如果是旧数据则忽略
            const localVersion = state.syncVersion || 0;
            const remoteVersion = syncMeta.version || 0;
            if (remoteVersion <= localVersion) {
                console.log("Ignoring outdated data from cloud");
                isApplyingRemoteSnapshot = false;
                return;
            }
        }

        const remoteStamp = typeof syncMeta.updatedAt === 'number' ? syncMeta.updatedAt : Date.parse(syncMeta.updatedAt);
        if (!isNaN(remoteStamp) && remoteStamp <= lastRemoteSyncStamp) {
            console.log("Ignoring data with older timestamp");
            isApplyingRemoteSnapshot = false;
            return;
        }

        // 检查活动会话是否有重大状态变化（开始、结束、暂停）
        const localActiveSession = state.active;
        const remoteActiveSession = incoming.active;
        let hasActiveStateChange = false;
        
        if (localActiveSession && remoteActiveSession) {
            // 检查状态变化：isPaused、taskId、是否存在等
            const localStateKey = `${localActiveSession.taskId}|${localActiveSession.isPaused}|${localActiveSession.isStopped || false}`;
            const remoteStateKey = `${remoteActiveSession.taskId}|${remoteActiveSession.isPaused}|${remoteActiveSession.isStopped || false}`;
            
            if (localStateKey !== remoteStateKey) {
                hasActiveStateChange = true;
                
                // 根据变化类型显示不同的提示
                if (localActiveSession.taskId !== remoteActiveSession.taskId) {
                    const taskTitle = getTask(remoteActiveSession.taskId)?.title || '未知任务';
                    pushToast(`已切换到"${taskTitle}"的计时`, 'info');
                } else if (localActiveSession.isPaused !== remoteActiveSession.isPaused) {
                    pushToast(remoteActiveSession.isPaused ? '计时器已暂停' : '计时器已继续', 'info');
                } else if (remoteActiveSession.isStopped) {
                    pushToast('计时器已停止', 'info');
                }
            }
        } else if (!localActiveSession && remoteActiveSession) {
            // 从无活动会话到有活动会话
            hasActiveStateChange = true;
            const taskTitle = getTask(remoteActiveSession.taskId)?.title || '未知任务';
            pushToast(`"${taskTitle}"的计时已开始`, 'info');
        } else if (localActiveSession && !remoteActiveSession) {
            // 从有活动会话到无活动会话
            hasActiveStateChange = true;
            pushToast('计时器已停止', 'info');
        }
        
        // 只有在有状态变化时才显示通用提示，避免干扰
        if (!hasActiveStateChange) {
            pushToast('接收到云端同步数据...', 'info');
        }

        // --- Data Integrity Firewall ---
        const isValidNumber = (val) => typeof val === 'number' && !isNaN(val) && val >= 0;
        
        let hasRejectedData = false;

        const validatedAgg = { ...state.agg };
        if (incoming.agg && isValidNumber(incoming.agg.totalHQ) && isValidNumber(incoming.agg.totalSeconds)) {
            validatedAgg.totalHQ = incoming.agg.totalHQ;
            validatedAgg.totalSeconds = incoming.agg.totalSeconds;
        } else if (incoming.agg) {
            console.error("Corrupted agg data from cloud, rejecting.", incoming.agg);
            pushToast('云端聚合数据异常，已拒绝同步。', 'warn');
            hasRejectedData = true;
        }

        const validatedTasks = [];
        if (Array.isArray(incoming.tasks)) {
            incoming.tasks.forEach(task => {
                if (task && isValidNumber(task.totalHQ) && isValidNumber(task.totalSeconds)) {
                    validatedTasks.push(task);
                } else {
                    console.error("Corrupted task data from cloud, rejecting.", task);
                    pushToast(`任务"${task.title || '未知'}"数据异常，已拒绝。`, 'warn');
                    hasRejectedData = true;
                    // Try to find local version to keep it from disappearing
                    const localVersion = state.tasks.find(t => t.id === task.id);
                    if (localVersion) validatedTasks.push(localVersion);
                }
            });
        } else {
            validatedTasks.push(...state.tasks);
        }

        // 优化活动会话状态同步逻辑
        const incomingIsActive = !!incoming.active;
        const currentActiveSession = state.active;
        
        let finalActiveSession = incoming.active;
        
        // 检查远程会话是否标记为已停止
        if (finalActiveSession && finalActiveSession.isStopped) {
            finalActiveSession = null; // 清除活动会话
        }
        
        // 如果本地有活动会话，进行更精细的合并
        if (currentActiveSession && incoming.active) {
            const localTimestamp = currentActiveSession.lastUpdatedAt || currentActiveSession.startTime || 0;
            const remoteTimestamp = incoming.active.lastUpdatedAt || incoming.active.startTime || 0;
                
            // 使用版本号和时间戳进行更精确的冲突解决
            const localVersion = currentActiveSession.version || 0;
            const remoteVersion = incoming.active.version || 0;
            
            // 如果本地版本更新或者时间戳更新，保留本地会话
            if ((localVersion > remoteVersion) || 
                (localVersion === remoteVersion && localTimestamp >= remoteTimestamp)) {
                finalActiveSession = currentActiveSession;
                
                // 如果远程会话是不同的任务，提醒用户
                if (incoming.active.taskId !== currentActiveSession.taskId) {
                    pushToast(`本地保留了"${getTask(currentActiveSession.taskId)?.title || '未知任务'}"的计时`, 'info');
                }
            } else {
                // 采用远程会话
                if (incoming.active.taskId !== (currentActiveSession?.taskId || '')) {
                    const taskTitle = getTask(incoming.active.taskId)?.title || '未知任务';
                    pushToast(`已切换到"${taskTitle}"的计时`, 'info');
                }
            }
        } else if (currentActiveSession && !incoming.active) {
            // 如果本地有活动会话但远程没有，保留本地会话
            finalActiveSession = currentActiveSession;
        }

        // 更新数据状态
        state.tasks = validatedTasks;
        state.agg = validatedAgg;
        meta = { ...getInitialMeta(), ...incoming.meta };
        RATE_BY_DIFFICULTY = incoming.rates || DEFAULT_RATES;
        FUNSHOP = incoming.funshop || FUNSHOP;
        REWARD_PARAMS = incoming.rewardParams || REWARD_PARAMS;
        
        // 更新同步版本号
        state.syncVersion = Math.max(state.syncVersion || 0, (syncMeta.version || 0) + 1);
        
        state.active = finalActiveSession || null;
        
        // 如果有活动会话且未暂停，启动心跳
        if (state.active && !state.active.isPaused) {
            // 更新服务器时间检查点
            if (incoming.lastServerTimeCheck) {
                state.active.lastServerTime = incoming.lastServerTimeCheck;
            }
            
            if (timerHeartbeatInterval) clearInterval(timerHeartbeatInterval);
            timerHeartbeatInterval = setInterval(sendTimerHeartbeat, HEARTBEAT_INTERVAL_MS);
        } else {
            // 如果没有活动会话或已暂停，清除心跳
            if (timerHeartbeatInterval) {
                clearInterval(timerHeartbeatInterval);
                timerHeartbeatInterval = null;
            }
        }
        
        if (!isNaN(remoteStamp)) {
            lastRemoteSyncStamp = remoteStamp;
        }

        ensureBadgeMeta();
        persistLocalState();
        renderInitial();

    } catch (e) {
        console.error("Error applying cloud data:", e);
        pushToast("加载云端数据格式错误，将使用本地数据。", "warn");
        loadStateFromLocalStorage();
        renderInitial();
    } finally {
        isApplyingRemoteSnapshot = false;
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

  const $= (s) => document.querySelector(s);
  
  let isSoundMuted = readJSON(LS_KEYS.SOUND_MUTED, false);

  const sfx = {
    navTasks: $('#sfxNavTasks'), navTimer: $('#sfxNavTimer'), navBackpack: $('#sfxNavBackpack'),
    navClub: $('#sfxNavClub'), navYou: $('#sfxNavYou'), add: $('#sfxAddTask'), select: $('#sfxSelectTask'),
    delete: $('#sfxDeleteTask'), timerStart: $('#sfxTimerStart'), timerPause: $('#sfxTimerPause'),
    timerStop: $('#sfxTimerStop'), modalOpen: $('#sfxModalOpen'), modalClose: $('#sfxModalClose'),
    success: $('#sfxSuccess'), warn: $('#sfxWarn'), click: $('#sfxClick'),
  };

  function playSound(audioEl) {
    if (isSoundMuted || !audioEl) return;
    audioEl.currentTime = 0;
    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => { console.warn(`Audio playback for ${audioEl.id} was prevented.`); });
    }
  }

  const BADGE_META = {
    rare_token:   {label:'稀有徽章', cls:'fb-rare',   invKey:'rare_tokens'}, epic_token:   {label:'史诗徽章', cls:'fb-epic',   invKey:'epic_tokens'},
    legend_token: {label:'传说徽章', cls:'fb-legend', invKey:'legendary_tokens'}, ticket:       {label:'抽卡券',   cls:'fb-util',   invKey:null},
    freeze:       {label:'冻结卡',   cls:'fb-util',   invKey:null}
  };
  const el = {
    kpiTotalValue: $('#kpiTotalValue'), kpiTime: $('#kpiTime'), taskTitle: $('#taskTitle'), taskDiff: $('#taskDiff'),
    btnAdd: $('#btnAdd'), btnClearAll: $('#btnClearAll'), taskList: $('#taskList'), emptyTask: $('#emptyTask'), rateText: $('#rateText'),
    sessionTime: $('#sessionTime'), taskTotal: $('#taskTotal'), taskTime: $('#taskTime'), activeHint: $('#activeHint'),
    btnStart: $('#btnStart'), btnPause: $('#btnPause'), btnStop: $('#btnStop'), modeSwitchBtn: $('#modeSwitchBtn'),
    rewardMask: $('#rewardMask'), rewardBody: $('#rewardBody'), btnCloseReward: $('#btnCloseReward'), helpMask: $('#helpMask'),
    btnHelp: $('#btnHelp'), btnCloseHelp: $('#btnCloseHelp'), dailyList: $('#dailyList'), btnDailyRefresh: $('#btnDailyRefresh'),
    invRow: $('#invRow'), badgeWorkshopBody: $('#badgeWorkshopBody'), toastWrap: $('#toastContainer'), pauseIndicator: $('#pauseIndicator'),
    pauseTime: $('#pauseTime'), btnSpin: $('#btnSpin'), wheelResult: $('#wheelResult'), btnDev: $('#btnDev'), devMask: $('#devMask'),
    btnCloseDev: $('#btnCloseDev'), rate1: $('#rate1'), rate2: $('#rate2'), rate3: $('#rate3'), rate4: $('#rate4'), rate5: $('#rate5'),
    btnSaveRates: $('#btnSaveRates'), btnResetRates: $('#btnResetRates'), btnForgeFreeze: $('#btnForgeFreeze'), btnRareRefresh: $('#btnRareRefresh'),
    btnWheelBoost: $('#btnWheelBoost'), btnSpeedChip: $('#btnSpeedChip'), prizeTicker: $('#prizeTicker'), btnTaskLibrary: $('#btnTaskLibrary'),
    taskLibraryMask: $('#taskLibraryMask'), btnCloseTaskLibrary: $('#btnCloseTaskLibrary'), taskLibraryInput: $('#taskLibraryInput'),
    btnImportTasks: $('#btnImportTasks'), btnTodayDone: $('#btnTodayDone'), todayDoneMask: $('#todayDoneMask'), todayDoneBody: $('#todayDoneBody'),
    btnCloseTodayDone: $('#btnCloseTodayDone'), funshopList: $('#funshopList'), btnFunshopEdit: $('#btnFunshopEdit'),
    funshopEditMask: $('#funshopEditMask'), btnCloseFunshopEdit: $('#btnCloseFunshopEdit'), funshopInput: $('#funshopInput'),
    btnFunshopImport: $('#btnFunshopImport'), avatarUploader: $('#avatarUploader'), avatarInput: $('#avatarInput'),
    charNameInput: $('#charNameInput'), charTitleInput: $('#charTitleInput'), charStatusTag: $('#charStatusTag'),
    charLevelText: $('#charLevelText'), charTotalHQText: $('#charTotalHQText'), charBuffsList: $('#charBuffsList'),
    devTotalHQ: $('#devTotalHQ'), devTickets: $('#devTickets'), devFreeze: $('#devFreeze'), devRareGem: $('#devRareGem'),
    devEpicGem: $('#devEpicGem'), devRareToken: $('#devRareToken'), devEpicToken: $('#devEpicToken'), devLegendToken: $('#devLegendToken'),
    btnSaveResources: $('#btnSaveResources'), btnSimulateNextDay: $('#btnSimulateNextDay'), btnResetDaily: $('#btnResetDaily'),
    btnHardReset: $('#btnHardReset'), devStateText: $('#devStateText'), btnExportState: $('#btnExportState'), btnImportState: $('#btnImportState'),
    devRewardBaseChance: $('#devRewardBaseChance'), devRewardBetCoeff: $('#devRewardBetCoeff'), devRewardMaxChance: $('#devRewardMaxChance'),
    devRewardPityInc: $('#devRewardPityInc'), btnSaveRewardParams: $('#btnSaveRewardParams'), btnResetRewardParams: $('#btnResetRewardParams'),
    authChipWrapper: $('#authChipWrapper'), btnLogin: $('#btnLogin'), btnLogout: $('#btnLogout'),
    authStatusText: $('#authStatusText'), userAvatar: $('#userAvatar'), loadingOverlay: $('#loadingOverlay'),
    mobileHeaderStatus: $('#mobileHeaderStatus'), totalValorChip: $('#totalValorChip'),
    // Login Modal Elements
    loginMask: $('#loginMask'), btnCloseLogin: $('#btnCloseLogin'), loginEmail: $('#loginEmail'),
    loginPassword: $('#loginPassword'), btnDoLogin: $('#btnDoLogin'), btnDoRegister: $('#btnDoRegister'),
    loginResult: $('#loginResult'),
    // Sync status elements
    syncStatus: $('#syncStatus'), syncStatusText: $('#syncStatusText'),
  };

  const sessionFlip = new FlipCounter($('#sessionFlip'), {digits:6,comma:true,large:true});
  
  const mobileTabButtons = document.querySelectorAll('.bottom-nav .tab-btn');
  const desktopTabButtons = document.querySelectorAll('.desktop-tab');
  const mainColumn = $('#mainColumn'); const timerColumn = $('#timerCard');
  const allPanes = {'tasks-pane': $('#tasks-pane'), 'backpack-pane': $('#backpack-pane'), 'club-pane': $('#club-pane'), 'you-pane': $('#you-pane')};
  const mobileMedia = window.matchMedia('(max-width: 767px) or (max-height: 500px)');
  let activeView = 'tasks-pane';

  function setView(targetId) {
    activeView = targetId;
    mobileTabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mobileTarget === targetId));
    desktopTabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.desktopTarget === targetId));
    const isMainContent = allPanes.hasOwnProperty(targetId);
    if (mobileMedia.matches) { mainColumn.classList.toggle('mobile-hidden', !isMainContent); timerColumn.classList.toggle('mobile-hidden', targetId !== 'timerCard'); }
    Object.keys(allPanes).forEach(paneId => { if (allPanes[paneId]) { allPanes[paneId].style.display = (paneId === targetId) ? '' : 'none'; } });
    if (targetId === 'you-pane') { renderYou(); }
    window.scrollTo(0, 0);
  }

  function handleLayoutChange() {
      if (mobileMedia.matches) { const isMainContent = allPanes.hasOwnProperty(activeView); mainColumn.classList.toggle('mobile-hidden', !isMainContent); timerColumn.classList.toggle('mobile-hidden', activeView !== 'timerCard');
      } else { mainColumn.classList.remove('mobile-hidden'); timerColumn.classList.remove('mobile-hidden'); if (activeView === 'timerCard') { setView('tasks-pane'); } }
  }
  
  mobileTabButtons.forEach(btn => { btn.addEventListener('click', () => { const target = btn.dataset.mobileTarget; if (target) { const soundId = btn.dataset.soundId; if (soundId) { const soundKey = soundId.substring(3).replace(/^\w/, c => c.toLowerCase()); if (sfx[soundKey]) { playSound(sfx[soundKey]); } } setView(target); } }); });
  desktopTabButtons.forEach(tab => { tab.addEventListener('click', () => { const targetId = tab.dataset.desktopTarget; const soundId = tab.dataset.soundId; if (soundId) { const soundKey = soundId.substring(3).replace(/^\w/, c => c.toLowerCase()); if (sfx[soundKey]) { playSound(sfx[soundKey]); } } if(targetId) setView(targetId); }); });
  if(mobileMedia.addEventListener){ mobileMedia.addEventListener('change', handleLayoutChange); } else if(mobileMedia.addListener){ mobileMedia.addListener(handleLayoutChange); }
  handleLayoutChange();

  let tickerTimer = null, tickerTimeout = null, tickerIndex = 0;
  function clearTicker(){ if(tickerTimer){clearInterval(tickerTimer);tickerTimer=null;} if(tickerTimeout){clearTimeout(tickerTimeout);tickerTimeout=null;} }
  function rollWheelOutcomeType(){ const base=[{type:'hq',p:0.40},{type:'rare',p:0.32},{type:'epic',p:0.12},{type:'freeze',p:0.16}]; const r=Math.random(); let acc=0; for(const it of base){acc+=it.p;if(r<acc)return it.type} return 'hq'; }
  function applyWheelReward(type){
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

  function fmtTime(sec){ sec=Math.floor(sec); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60; const pad=(n)=>n.toString().padStart(2,'0'); return `${h}:${pad(m)}:${pad(s)}`; }
  function fmtPause(sec){ sec=Math.max(0,Math.floor(sec||0)); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60; const pad=(n)=>n.toString().padStart(2,'0'); return h>0?`${h}:${pad(m)}:${pad(s)}`:`${m}:${pad(s)}`;}
  const getToday = () => { const d = new Date(); d.setDate(d.getDate() + (window._debugDateOffset || 0)); return d; };
  function todayKey(){ return getToday().toISOString().slice(0,10); }

  let saveQueued = false;
  let isSavingToCloud = false;

const processSaveQueue = async () => {
    if (isSavingToCloud || !saveQueued) {
        return;
    }

    isSavingToCloud = true;
    saveQueued = false; // Consume the flag for this particular save operation
    document.body.classList.add('is-saving');
    
    // The actual save operation
    const uid = currentLoginState?.user?.uid;
    if (isCloudBaseConfigured && cloudSyncReady && !isApplyingRemoteSnapshot && uid) {
        const syncStamp = Date.now();
        const payload = getFullStateSnapshot(syncStamp);
        
        try {
            // 使用事务操作确保数据一致性
            const transaction = await db.startTransaction();
            try {
                await transaction.collection('users').doc(uid).set(payload);
                await transaction.commit();
                lastRemoteSyncStamp = Math.max(lastRemoteSyncStamp, syncStamp);
            } catch (txError) {
                await transaction.rollback();
                throw txError;
            }
        } catch (err) {
            console.error("CloudBase save error:", err);
            pushToast('云端同步失败，将重试', 'warn');
            
            // 如果同步失败，标记需要重试
            saveQueued = true;
            
            // 指数退避重试机制
            const retryDelay = Math.min(1000 * Math.pow(2, state.saveRetryCount || 0), 30000);
            state.saveRetryCount = (state.saveRetryCount || 0) + 1;
            
            setTimeout(() => {
                if (saveQueued) processSaveQueue();
            }, retryDelay);
        }
    }
    
    isSavingToCloud = false;
    document.body.classList.remove('is-saving');
    
    // After finishing, check if another save was requested during the operation and run again
    if (saveQueued) {
        processSaveQueue();
    }
};

  function save() {
    persistLocalState();
    saveQueued = true;
    processSaveQueue();
  }

  function pushToast(message, variant='info'){
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
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const getTask=(id)=>state.tasks.find(t=>t.id===id);
  function difficultyBadge(d){const map={1:"轻松",2:"较易",3:"标准",4:"较难",5:"硬仗"};return `<span class="tag">${"★".repeat(d)}${"☆".repeat(5-d)} <b style="margin-left:4px">D${d}</b> · ${map[d]}</span>`}
  const normalizeRewardAmount = (val) => Math.max(1, Math.floor(Number(val) || 0));
  function rewardLabel(reward){
    if(!reward||!reward.type) return ''; const def=REWARD_TYPES[reward.type]; if(!def) return '';
    const amount=normalizeRewardAmount(reward.amount||1); return `${def.label} ×${amount}`;
  }
  function grantTaskReward(task){
    if(!task||!task.reward||!task.reward.type) return null; const def=REWARD_TYPES[task.reward.type]; if(!def) return null;
    const amount=normalizeRewardAmount(task.reward.amount||1); def.apply(amount);
    return {message:`${task.title} 完成奖励：${def.label} +${amount}`, type:task.reward.type};
  }

  const WEAR_MAX = { rare_token:100, epic_token:140, legend_token:200 };
  function ensureWearPool(){ meta.funshop = meta.funshop || {activities:[], wearAccum:{}}; meta.funshop.wearAccum = meta.funshop.wearAccum || {}; }

  function parsePack(text, lead) {
    if(!text) return {}; const s = text.trim().replace(/，/g,','); const t = lead && s.startsWith(lead) ? s.slice(lead.length).trim() : s;
    if(!t) return {}; const out={};
    t.split(',').map(x=>x.trim()).filter(Boolean).forEach(seg=>{ const m=seg.match(/^([a-zA-Z_]+)\*(\d+)$/); if(!m) return;
      const k=m[1].toLowerCase(); const v=Math.max(1,parseInt(m[2],10)||0); if(BADGE_META[k]) out[k]=(out[k]||0)+v; });
    return out;
  }
  function parseFunshopLines(text) {
    const out = []; (text||'').split('\n').forEach(line=>{
      const s=line.trim(); if(!s) return; const p=s.split('|'); if(p.length<2) return;
      const title=p[0].trim(); const seconds=Math.max(1,parseInt(p[1].trim(),10)||0); const need=parsePack(p[2]||'','需求:'); const wear=parsePack(p[3]||'','磨损:');
      let timeWindow=null; const w=(p[4]||'').trim(); if(w && w.startsWith('时段:')){ const m=w.slice(3).trim().match(/(\d{2}:\d{2})-(\d{2}:\d{2})/); if(m) timeWindow={start:m[1],end:m[2]}; }
      out.push({ id:uid(), title, seconds, need, wear, timeWindow, running:null }); }); return out;
  }
  function withinWindow(tw){
    if(!tw) return true; const now=getToday();
    const cur=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    return (cur>=tw.start && cur<=tw.end);
  }
  function needChipsHTML(need){
    const parts=[]; const b=meta.badges||{};
    Object.entries(need||{}).forEach(([k,v])=>{ const metaK = BADGE_META[k]; if(!metaK) return;
      let have = 0; if(metaK.invKey) have = b[metaK.invKey]||0; else if(k==='ticket') have = meta.tickets||0; else if(k==='freeze') have = meta.freeze||0;
      const ok = have>=v; const cls = ok?metaK.cls:'fb-bad';
      parts.push(`<span class="fb-chip ${cls}">${metaK.label} ×${v}${ok?``:`（缺${v-have}）`}</span>`); });
    return parts.length?parts.join(''):'<span class="funshop-muted">无</span>';
  }
  function wearChipsHTML(wear){
    const parts=[]; Object.entries(wear||{}).forEach(([k,v])=>{ const metaK = BADGE_META[k]; if(!metaK) return;
      parts.push(`<span class="fb-chip ${metaK.cls}">${metaK.label} −${v} 耐久</span>`); });
    return parts.length?parts.join(''):'<span class="funshop-muted">无</span>';
  }

  function applyWearAndConsume(need = {}, wear = {}){
    ensureBadgeMeta(); ensureWearPool(); const b=meta.badges||{};
    const have = { rare_token:b.rare_tokens||0, epic_token:b.epic_tokens||0, legend_token:b.legendary_tokens||0, ticket:meta.tickets||0, freeze:meta.freeze||0 };
    for(const [k,req] of Object.entries(need)){ if((have[k]||0) < req) return {ok:false,msg:`${BADGE_META[k]?.label || k} 不足`}; }
    if(need['rare_token']){ meta.badges.rare_tokens = Math.max(0,(meta.badges.rare_tokens||0) - need['rare_token']); }
    if(need['epic_token']){ meta.badges.epic_tokens = Math.max(0,(meta.badges.epic_tokens||0) - need['epic_token']); }
    if(need['legend_token']){ meta.badges.legendary_tokens = Math.max(0,(meta.badges.legendary_tokens||0) - need['legend_token']); }
    if(need['ticket']){ meta.tickets = Math.max(0,(meta.tickets||0) - need['ticket']); }
    if(need['freeze']){ meta.freeze  = Math.max(0,(meta.freeze||0)  - need['freeze']); }
    const pool=meta.funshop.wearAccum; Object.entries(wear||{}).forEach(([k,v])=>{ if(WEAR_MAX[k]) pool[k]=(pool[k]||0)+Math.max(0,v); });
    const report=[];
    [['rare_token','rare_tokens'],['epic_token','epic_tokens'],['legend_token','legendary_tokens']].forEach(([k,invKey])=>{
      const max=WEAR_MAX[k]; const have=meta.badges[invKey]||0; const w=pool[k]||0; const destroy=Math.min(have, Math.floor(w/max));
      if(destroy>0){ meta.badges[invKey]=Math.max(0,have-destroy); pool[k]=w - destroy*max; report.push(`${BADGE_META[k]?.label || k} -${destroy}`); } });
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
      const play = row.querySelector(`[data-play="${a.id}"]`); if(play) play.onclick=()=>startFunActivity(a.id);
      const stop = row.querySelector(`[data-stop="${a.id}"]`); if(stop) stop.onclick=()=>stopFunActivity(a.id,true);
      fragment.appendChild(row); });
    list.innerHTML = ''; list.appendChild(fragment);
  }

  function startFunActivity(id){
    ensureBadgeMeta(); ensureWearPool(); const acts=meta.funshop.activities||[]; const a=acts.find(x=>x.id===id); if(!a) return;
    if(a.running){ pushToast('已在进行中','warn'); return; } const res = applyWearAndConsume(a.need||{}, a.wear||{});
    if(!res.ok){ pushToast(res.msg||'条件不足','warn'); save(); renderInventory(); return; }
    if(res.destroyed && res.destroyed.length){ pushToast(`磨损导致销毁：${res.destroyed.join('、')}`,'warn'); }
    a.running = { until: Date.now() + Math.max(1,a.seconds)*1000 }; save(); renderInventory(); renderFunshop();
  }
  function stopFunActivity(id,byUser=false){ const acts=meta.funshop.activities||[]; const a=acts.find(x=>x.id===id); if(!a||!a.running) return;
    a.running=null; save(); renderFunshop(); if(byUser) pushToast('已停止娱乐活动','info');
  }
  function tickFunshopTimers(){
    const acts=meta.funshop.activities||[]; let dirty=false; const now=Date.now();
    acts.forEach(a=>{ if(a.running && a.running.until<=now){ a.running=null; dirty=true; }}); if(dirty){ save(); renderFunshop(); }
    document.querySelectorAll('.mini-timer .remain').forEach(span=>{ const id = span.getAttribute('data-id'); const a = acts.find(x=>x.id===id);
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
      row.querySelector('[data-act="edit"]').onclick=()=>editTask(t.id); row.querySelector('[data-act="del"]').onclick=()=>deleteTask(t.id);
      row.querySelector('[data-act="select"]').onclick=()=>selectTask(t.id); fragment.appendChild(row); });
    el.taskList.innerHTML = ''; el.taskList.appendChild(fragment);
  }

function setControls(){
    const btnStart = el.btnStart; const btnPause = el.btnPause; const btnStop  = el.btnStop; if(!btnStart || !btnPause || !btnStop) return;

    // 多设备协同控制：任何设备都可以控制计时器
    const setStartState = (disabled, label) => { btnStart.disabled = disabled; btnStart.textContent = label; btnStart.setAttribute('aria-label', label); };
    setStartState(true, '开始'); btnPause.disabled = true; btnStop.disabled  = true;
    
    if (state.active) {
        const task = getTask(state.active.taskId);
        if (task) el.activeHint.textContent = `进行中：${task.title}（难度 ${task.difficulty}）`;
        if (!state.active.isPaused) {
            setStartState(true, '开始'); btnPause.disabled = false; btnStop.disabled = false;
        } else {
            setStartState(false, '继续'); btnPause.disabled = true; btnStop.disabled = false;
        }
        
        // 更新同步状态显示
        updateSyncStatus(state.active);
    } else if (state.selectedTaskId) {
        const task = getTask(state.selectedTaskId);
        if (task) el.activeHint.textContent = `已选择：${task.title}（难度 ${task.difficulty}）`;
        setStartState(false, '开始');
        
        // 隐藏同步状态
        if (el.syncStatus) el.syncStatus.style.display = 'none';
    } else {
        el.activeHint.textContent = '未选择任务';
        
        // 隐藏同步状态
        if (el.syncStatus) el.syncStatus.style.display = 'none';
    }
}

// 更新同步状态显示的函数
function updateSyncStatus(activeSession) {
    if (!el.syncStatus || !el.syncStatusText) return;
    
    const now = Date.now();
    const lastHeartbeatAt = activeSession.lastHeartbeatAt || 0;
    const lastHeartbeatFrom = activeSession.lastHeartbeatFrom || '';
    const isCurrentDevice = lastHeartbeatFrom === CLIENT_ID;
    const isTimedOut = now - lastHeartbeatAt > DEVICE_TIMEOUT_MS;
    
    // 确定状态类型和消息
    let statusClass = '';
    let statusText = '';
    
    if (isCurrentDevice) {
        statusClass = '';
        statusText = '当前设备控制中';
    } else if (isTimedOut) {
        statusClass = 'error';
        statusText = '控制设备已离线';
    } else {
        statusClass = 'warning';
        statusText = `其他设备控制中 (${lastHeartbeatFrom.slice(-6)})`;
    }
    
    // 更新DOM
    el.syncStatus.className = `sync-status ${statusClass}`;
    el.syncStatus.innerHTML = `
        <span class="sync-indicator"></span>
        <span>${statusText}</span>
    `;
    el.syncStatus.style.display = 'flex';
}

  function showPauseIndicator(sec){ if(!el.pauseIndicator||!el.pauseTime) return; el.pauseIndicator.style.display='flex'; el.pauseTime.textContent=fmtPause(sec); }
  function hidePauseIndicator(){ if(!el.pauseIndicator||!el.pauseTime) return; el.pauseIndicator.style.display='none'; el.pauseTime.textContent='0:00'; }

  function addTask(){
    const title=el.taskTitle.value.trim(); const diff=parseInt(el.taskDiff.value,10); if(!title){playSound(sfx.warn); alert('请输入任务标题');return}
    playSound(sfx.add); state.tasks.unshift({id:uid(), title, difficulty:diff, totalHQ:0, totalSeconds:0});
    save(); renderTasks(); el.taskTitle.value='';
  }
  function editTask(id){
    const t=getTask(id); if(!t) return; const title=prompt('编辑任务标题：',t.title); if(title===null) return;
    let diffStr=prompt('编辑难度（1-5）：',String(t.difficulty)); if(diffStr===null) return;
    const diff=clamp(parseInt(diffStr,10)||t.difficulty,1,5);
    t.title=(title.trim()||t.title); t.difficulty=diff; playSound(sfx.click);
    save(); renderTasks(); if((state.active && state.active.taskId === id) || state.selectedTaskId === id){ updateRate(); }
  }
  function deleteTask(id){
    if(state.active&&state.active.taskId===id){ playSound(sfx.warn); alert('请先结束当前任务的计时，再删除。'); return; }
    if(state.selectedTaskId === id) { state.selectedTaskId = null; } playSound(sfx.delete);
    state.tasks=state.tasks.filter(t=>t.id!==id); save(); renderTasks();
  }

  function baseRateOfTask(task){return RATE_BY_DIFFICULTY[task.difficulty]||1;}
  function todayBuff(){const day=todayKey(); meta.dailyBuff=meta.dailyBuff||{}; meta.dailyBuff[day]=meta.dailyBuff[day]||{rateBuff:0}; return meta.dailyBuff[day];}
  function effectiveRate(baseRate, difficulty){ let rate=baseRate; const chip = todayBuff().rateBuff || 0; rate *= (1 + chip); return rate; }
  
  function rateOfActive() {
    let task;
    if (state.active) {
        task = getTask(state.active.taskId);
    } else if (state.selectedTaskId) {
        task = getTask(state.selectedTaskId);
    }
    if (!task) return 0;
    return effectiveRate(baseRateOfTask(task), task.difficulty);
}

  function updateRate(){
    let task; if (state.active) { task = getTask(state.active.taskId); } else if (state.selectedTaskId) { task = getTask(state.selectedTaskId); }
    if(!task){ el.rateText.textContent='0'; return; } const eff=effectiveRate(baseRateOfTask(task), task.difficulty);
    el.rateText.textContent=eff.toFixed(2);
  }

  function selectTask(id){
    const t=getTask(id); if(!t) return;
    if(state.active && state.active.taskId !== id) {
        pushToast('当前有任务正在计时，请先结束。', 'warn');
        return;
    }
    if(state.active && state.active.taskId === id) return; 
    
    playSound(sfx.select);
    state.selectedTaskId = id;
    el.activeHint.textContent=`已选择：${t.title}（难度 ${t.difficulty}）`;
    sessionFlip.setValue(0,true); 
    el.sessionTime.textContent='0:00:00';
    el.taskTotal.textContent=String(Math.floor(t.totalHQ||0));
    el.taskTime.textContent=fmtTime(t.totalSeconds||0);
    hidePauseIndicator();
    updateRate();
    renderTasks();
    setControls();
    if (mobileMedia.matches) { setView('timerCard'); }
  }
  
async function sendTimerHeartbeat() {
    if (!state.active || state.active.isPaused) {
        if (timerHeartbeatInterval) clearInterval(timerHeartbeatInterval);
        return;
    }
    const a = state.active;
    const task = getTask(a.taskId);
    if (!task) return;
    
    try {
        // 获取同步后的时间作为基准
        await syncTimeOffset(); // 确保时间偏移量是最新的
        const localTime = Date.now();
        const now = getSyncedTime(); // 统一使用同步后的时间
        
        // 计算经过的时间，始终使用服务器时间
        let elapsed = 0;
        if (a.startTime) {
            // 如果有服务器时间基准，使用服务器时间计算
            if (a.serverStartTime) {
                elapsed = (now - a.serverStartTime) / 1000;
            } else {
                // 如果没有serverStartTime，计算并存储
                a.serverStartTime = now - ((localTime - a.startTime) / 1000) * 1000;
                elapsed = (now - a.serverStartTime) / 1000;
            }
        }
        
        const sessionSeconds = (a.accumulatedSeconds || 0) + (elapsed > 0 ? elapsed : 0);
        const rate = effectiveRate(baseRateOfTask(task), task.difficulty);
        const currentSessionHQ = sessionSeconds * rate;
        
        // 更新当前设备的心跳信息
        a.currentSeconds = Math.max(0, sessionSeconds);
        a.currentHQ = Math.max(0, currentSessionHQ);
        a.lastHeartbeatFrom = CLIENT_ID;
        a.lastHeartbeatAt = now;
        a.lastServerTime = now; // 记录最新的服务器时间
        
        // 检查是否需要接管计时器（设备接管机制）
        checkAndTakeOverTimer(a, now);
        
        // 优化保存频率：减少不必要的保存，只在必要时保存
        const shouldSave = !a.lastUpdatedBy || 
                         a.lastUpdatedBy === CLIENT_ID || 
                         now - (a.lastUpdatedAt || 0) > HEARTBEAT_INTERVAL_MS ||
                         Math.abs((a.currentSeconds || 0) - sessionSeconds) > 1; // 秒数变化超过1秒时保存
        
        if (shouldSave) {
            // 增加版本号，确保数据同步的可靠性
            a.version = (a.version || 0) + 1;
            a.lastUpdatedAt = now;
            a.lastUpdatedBy = CLIENT_ID;
            
            // 使用防抖机制，避免频繁保存
            if (a.saveTimeout) clearTimeout(a.saveTimeout);
            a.saveTimeout = setTimeout(() => {
                save();
                delete a.saveTimeout;
            }, 1000); // 延迟1秒保存，减少网络请求
        }
    } catch (error) {
        console.error("Error in sendTimerHeartbeat:", error);
        // 如果获取服务器时间失败，回退到本地时间
        const now = Date.now();
        const elapsed = a.startTime ? (now - a.startTime) / 1000 : 0;
        const sessionSeconds = (a.accumulatedSeconds || 0) + (elapsed > 0 ? elapsed : 0);
        const rate = effectiveRate(baseRateOfTask(task), task.difficulty);
        const currentSessionHQ = sessionSeconds * rate;
        
        a.currentSeconds = Math.max(0, sessionSeconds);
        a.currentHQ = Math.max(0, currentSessionHQ);
        a.lastHeartbeatFrom = CLIENT_ID;
        a.lastHeartbeatAt = now;
        
        // 检查是否需要接管计时器（设备接管机制）
        checkAndTakeOverTimer(a, now);
        
        // 优化保存频率
        const shouldSave = !a.lastUpdatedBy || 
                         a.lastUpdatedBy === CLIENT_ID || 
                         now - (a.lastUpdatedAt || 0) > HEARTBEAT_INTERVAL_MS;
        
        if (shouldSave) {
            a.version = (a.version || 0) + 1;
            a.lastUpdatedAt = now;
            a.lastUpdatedBy = CLIENT_ID;
            
            if (a.saveTimeout) clearTimeout(a.saveTimeout);
            a.saveTimeout = setTimeout(() => {
                save();
                delete a.saveTimeout;
            }, 1000);
        }
    }
}

// 检查并接管计时器的函数
function checkAndTakeOverTimer(activeSession, currentTime) {
    const lastHeartbeatAt = activeSession.lastHeartbeatAt || 0;
    const lastHeartbeatFrom = activeSession.lastHeartbeatFrom || '';
    
    // 如果最后心跳不是来自当前设备，且已超时，则显示接管选项
    if (lastHeartbeatFrom !== CLIENT_ID && (currentTime - lastHeartbeatAt > DEVICE_TIMEOUT_MS)) {
        // 如果用户尚未被提示过接管选项
        if (!activeSession.takeoverOfferedAt || (currentTime - activeSession.takeoverOfferedAt > 60000)) {
            const task = getTask(activeSession.taskId);
            const taskTitle = task ? task.title : '未知任务';
            
            // 显示接管提示
            pushToast(`${taskTitle} 的控制设备可能已离线，您现在可以完全控制计时器`, 'info', 8000);
            
            // 标记已提示过
            activeSession.takeoverOfferedAt = currentTime;
            activeSession.lastUpdatedBy = CLIENT_ID;
            activeSession.lastUpdatedAt = currentTime;
            save();
        }
    }
}

// 获取服务器时间的函数
async function getServerTime() {
    if (!isCloudBaseConfigured || !db) return null;
    
    try {
        // 使用CloudBase的服务器时间戳
        const serverTimestamp = await db.serverDate();
        return serverTimestamp.getTime();
    } catch (error) {
        console.error("Failed to get server time:", error);
        return null;
    }
}

// 同步时间偏移量，确保所有设备使用相同的时间基准
async function syncTimeOffset() {
    if (!isCloudBaseConfigured || !db) return;
    
    try {
        const serverTime = await getServerTime();
        const localTime = Date.now();
        
        if (serverTime) {
            // 更新全局时间偏移量
            window.GLOBAL_TIME_OFFSET = serverTime - localTime;
            console.log("Time offset synced:", window.GLOBAL_TIME_OFFSET, "ms");
            
            // 如果有活动会话，更新其时间信息
            if (state.active) {
                state.active.lastServerTime = serverTime;
                if (!state.active.serverStartTime && state.active.startTime) {
                    // 如果还没有服务器开始时间，计算并设置
                    state.active.serverStartTime = serverTime - ((localTime - state.active.startTime) / 1000) * 1000;
                }
            }
        }
    } catch (error) {
        console.error("Failed to sync time offset:", error);
    }
}

// 获取同步后的时间（服务器时间）
function getSyncedTime() {
    const localTime = Date.now();
    return window.GLOBAL_TIME_OFFSET ? localTime + window.GLOBAL_TIME_OFFSET : localTime;
}

async function startTimer() {
    if (state.active && !state.active.isPaused) return;
    
    const taskId = state.active ? state.active.taskId : state.selectedTaskId;
    if (!taskId) { playSound(sfx.warn); alert('请先选择任务'); return; }
    const task = getTask(taskId);
    if (!task) return;
    playSound(sfx.timerStart);
    
        try {
        // 获取同步后的时间作为基准
        await syncTimeOffset(); // 确保时间偏移量是最新的
        const localTime = Date.now();
        const now = getSyncedTime();
        
        let newTimerState;
        if (state.active && state.active.isPaused) {
            // 恢复暂停的计时
            // 计算暂停时长，使用服务器时间
            let pausedDurationSec = 0;
            if (state.active.pauseTime) {
                if (state.active.serverPauseTime) {
                    pausedDurationSec = (now - state.active.serverPauseTime) / 1000;
                } else {
                    // 如果没有服务器暂停时间，估算
                    const localPauseDuration = (localTime - state.active.pauseTime) / 1000;
                    pausedDurationSec = localPauseDuration;
                }
            }
            
            newTimerState = {
                ...state.active,
                startTime: localTime, // 保留本地开始时间作为备份
                serverStartTime: now, // 使用服务器时间作为主要基准
                isPaused: false,
                pauseTime: null,
                serverPauseTime: null, // 清除服务器暂停时间
                pauses: (state.active.pauses || 0) + (pausedDurationSec > ECON.pauseBreakSec ? 1 : 0),
                lastUpdatedBy: CLIENT_ID,
                lastUpdatedAt: now,
                lastServerTime: now, // 记录最新的服务器时间
                version: (state.active.version || 0) + 1, // 增加版本号，确保同步
            };
        } else {
            // 开始新的计时
            newTimerState = {
                taskId: taskId,
                startTime: localTime, // 保留本地开始时间作为备份
                serverStartTime: now, // 使用服务器时间作为主要基准
                accumulatedSeconds: 0,
                isPaused: false,
                pauseTime: null,
                serverPauseTime: null,
                pauses: 0,
                lastUpdatedBy: CLIENT_ID,
                lastUpdatedAt: now,
                lastServerTime: now, // 记录最新的服务器时间
                version: 1, // 新会话的初始版本号
            };
        }
        
        // 启动心跳定时器（多设备都可以发送心跳）
        if (timerHeartbeatInterval) clearInterval(timerHeartbeatInterval);
        timerHeartbeatInterval = setInterval(sendTimerHeartbeat, HEARTBEAT_INTERVAL_MS);
        
        state.selectedTaskId = null;
        state.active = newTimerState;
        save();
        
        el.activeHint.textContent = `进行中：${task.title}（难度 ${task.difficulty}）`;
        renderTasks();
        updateRate();
        setControls();
        hidePauseIndicator();
    } catch (error) {
        console.error("Error starting timer:", error);
        pushToast("启动计时器失败，请重试", "warn");
    }
}

async function pauseTimer() {
    if (!state.active || state.active.isPaused) return;
    if (timerHeartbeatInterval) {
        clearInterval(timerHeartbeatInterval);
        timerHeartbeatInterval = null;
    }
    playSound(sfx.timerPause);
    
    try {
        // 获取同步后的时间作为基准
        await syncTimeOffset(); // 确保时间偏移量是最新的
        const localTime = Date.now();
        const now = getSyncedTime();
        
        // 计算经过的时间，使用同步后的时间基准
        let elapsedSec = 0;
        if (state.active.serverStartTime) {
            // 使用同步后的时间计算
            elapsedSec = (now - state.active.serverStartTime) / 1000;
        } else {
            // 回退到本地开始时间计算
            const startTime = state.active.startTime || localTime;
            elapsedSec = (now - startTime) / 1000;
        }
        
        const newTimerState = {
            ...state.active,
            accumulatedSeconds: (state.active.accumulatedSeconds || 0) + elapsedSec,
            isPaused: true,
            pauseTime: localTime, // 保留本地暂停时间作为备份
            serverPauseTime: now, // 使用服务器时间作为主要基准
            startTime: null,
            lastUpdatedBy: CLIENT_ID,
            lastUpdatedAt: now,
            lastServerTime: now, // 记录最新的服务器时间
            version: (state.active.version || 0) + 1, // 增加版本号，确保同步
        };
        state.active = newTimerState;
        save();
        setControls();
        const task = getTask(state.active.taskId);
        if (task) {
            const rate = effectiveRate(baseRateOfTask(task), task.difficulty);
            const finalSessionHQ = (state.active.accumulatedSeconds || 0) * rate;
            const finalSessionSeconds = state.active.accumulatedSeconds || 0;
            sessionFlip.setValue(Math.floor(finalSessionHQ), true);
            el.sessionTime.textContent = fmtTime(finalSessionSeconds);
            el.taskTotal.textContent = String(Math.floor((task.totalHQ || 0) + finalSessionHQ));
            el.taskTime.textContent = fmtTime((task.totalSeconds || 0) + finalSessionSeconds);
        }
    } catch (error) {
        console.error("Error pausing timer:", error);
        pushToast("暂停计时器失败，请重试", "warn");
    }
}


  function pushTodayDone(entry){ const d = todayObj(); d.completed.unshift(entry); save(); }
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

  function openReward({baseHQ, seconds, difficulty, rawHQ}){
    playSound(sfx.modalOpen);
    const streakMulti = 1 + (meta.streak || 0);
    const baseReward = Math.floor(baseHQ * streakMulti);
    const isArcade = !!meta.arcade;
    const body = el.rewardBody; if(!body) return;
    body.innerHTML = ` <div style="text-align:center;margin-bottom:16px"> <div style="font-size:24px;font-weight:800;margin-bottom:4px">${baseReward}</div> <div class="muted">基础奖励（连击 ×${streakMulti.toFixed(2)}）</div> </div> ${isArcade ? ` <div class="choice" id="betChoice"> <div class="opt" data-bet="0">不押注</div> <div class="opt" data-bet="0.5">押注 ×0.5（${Math.floor(baseReward*0.5)}）</div> <div class="opt" data-bet="1">押注 ×1（${baseReward}）</div> <div class="opt" data-bet="2">押注 ×2（${Math.floor(baseReward*2)}）</div> </div> <div class="muted" style="margin-top:10px;font-size:12px">街机模式：可押注赢取更多豪情值，失败则失去基础奖励</div> ` : ''} `;
    
    if(isArcade){
      const opts = body.querySelectorAll('.opt');
      opts.forEach(opt => {
        opt.onclick = () => { 
          playSound(sfx.click); 
          const bet = parseFloat(opt.dataset.bet || '0');
          if(bet === 0){ 
            state.agg.totalHQ = (state.agg.totalHQ || 0) + baseReward; 
            save(); renderKPI(); 
            body.innerHTML += `<div class="result-bar result-ok" style="margin-top:16px">已领取基础奖励 +${baseReward}</div>`; 
            bindRewardClose();
          } else { 
            const cost = Math.floor(baseReward * bet); 
            const chance = Math.min(REWARD_PARAMS.maxChance, REWARD_PARAMS.baseChance + bet * REWARD_PARAMS.betCoefficient + (meta.pity || 0));
            const won = Math.random() < chance; 
            const loot = won ? Math.floor(cost * (1.5 + Math.random() * 1.5)) : 0;
            if(won){ 
              state.agg.totalHQ = (state.agg.totalHQ || 0) + loot; 
              meta.pity = Math.max(0, (meta.pity || 0) - ECON.pityStep);
              body.innerHTML += `<div class="result-bar result-ok" style="margin-top:16px"> <div>🎉 押注成功！获得 +${loot} 豪情值</div> <div class="loots" style="margin-top:8px"> <span class="loot">基础消耗：${cost}</span> <span class="loot">倍率：×${(loot/cost).toFixed(2)}</span> <span class="loot">怜悯：+${(chance*100).toFixed(1)}%</span> </div> </div>`;
            } else { 
              meta.pity = (meta.pity || 0) + REWARD_PARAMS.pityIncrement;
              body.innerHTML += `<div class="result-bar result-err" style="margin-top:16px"> <div>💥 押注失败，失去基础奖励 -${baseReward}</div> <div class="loots" style="margin-top:8px"> <span class="loot">怜悯+${(REWARD_PARAMS.pityIncrement*100).toFixed(1)}%</span> </div> </div>`;
            } 
            save(); renderKPI(); 
          } 
          bindRewardClose(); 
        }; 
      });
    } else { 
        // In non-arcade mode, the state was already updated in stopTimer.
        // This is now just for display.
        body.innerHTML += `<div class="result-bar result-ok" style="margin-top:16px">已领取基础奖励 +${baseReward}</div>`; 
        bindRewardClose();
    }
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

function stopTimer() {
    if (!state.active) return;
    if (timerHeartbeatInterval) {
        clearInterval(timerHeartbeatInterval);
        timerHeartbeatInterval = null;
    }
    playSound(sfx.timerStop);
    
    const activeSession = { ...state.active };
    const t = getTask(activeSession.taskId);
    
    // --- START OF IMMEDIATE, ATOMIC UPDATE ---
    
    // 1. Calculate session results using synced time for consistency
    let sessionSeconds = activeSession.accumulatedSeconds || 0;
    if (!activeSession.isPaused && activeSession.serverStartTime) {
        // 使用同步后的时间计算经过时间
        const now = getSyncedTime();
        const elapsed = (now - activeSession.serverStartTime) / 1000;
        sessionSeconds += elapsed > 0 ? elapsed : 0;
    } else if (!activeSession.isPaused && activeSession.startTime) {
        // 回退到本地时间计算
        const now = getSyncedTime();
        sessionSeconds += (now - activeSession.startTime) / 1000;
    }
    sessionSeconds = Math.max(0, Math.floor(sessionSeconds));
    
    const taskRate = t ? effectiveRate(baseRateOfTask(t), t.difficulty) : 0;
    const sessionHQ = Math.floor(sessionSeconds * taskRate);
    const pauses = activeSession.pauses || 0;
    const diff = t ? t.difficulty : 3;
    
    // 2. Update streak and daily progress *before* calculating final reward
    onSegmentEnd_base(sessionSeconds, diff, pauses);
    singleMissionJudge(sessionSeconds, diff, pauses);

    // 3. Update task-specific and global time aggregates
    if (t) {
        t.totalHQ = (t.totalHQ || 0) + sessionHQ;
        t.totalSeconds = (t.totalSeconds || 0) + sessionSeconds;
    }
    state.agg.totalSeconds = (state.agg.totalSeconds || 0) + sessionSeconds;
    
    // 4. Handle other rewards and side-effects
    pushTodayDone({ title: t ? t.title : '未知任务', difficulty: diff, seconds: sessionSeconds, hq: sessionHQ, ts: Date.now() });
    const extraReward = t ? grantTaskReward(t) : null;
    
    // 5. Calculate final HQ reward and update global HQ if not in arcade mode
    const streakMulti = 1 + (meta.streak || 0);
    const finalBaseReward = Math.floor(sessionHQ * streakMulti);
    const isArcade = !!meta.arcade;
    if (!isArcade) {
        state.agg.totalHQ = (state.agg.totalHQ || 0) + finalBaseReward;
    }
    
    // 6. Clean up task list and active session state
    state.tasks = state.tasks.filter(task => task.id !== activeSession.taskId);
    if (state.selectedTaskId === activeSession.taskId) state.selectedTaskId = null;
    
    // 在清除活动会话前，先标记为已停止，以便其他设备能够正确同步
    activeSession.isStopped = true;
    activeSession.lastUpdatedAt = Date.now();
    activeSession.lastUpdatedBy = CLIENT_ID;
    
    // 临时保存已停止的会话状态，然后清除
    const stoppedSession = { ...activeSession };
    state.active = null;

    // 7. Save the fully consistent state
    // 先保存已停止的会话状态，然后再保存最终状态
    save();
    
    // 保存后清除已停止的会话标记（避免重复处理）
    state.active = null;
    
    // --- END OF ATOMIC UPDATE ---

    // --- START OF UI/EFFECTS ---
    
    triggerCompletionAnimation();
    renderTasks();
    renderKPI();
    
    el.activeHint.textContent='未选择任务';
    sessionFlip.setValue(0,true);
    el.sessionTime.textContent='0:00:00';
    el.taskTotal.textContent='0';
    el.taskTime.textContent='0:00:00';
    el.rateText.textContent='0';
    hidePauseIndicator();
    setControls();
    
    if (extraReward) {
        if (extraReward.type !== 'hq') { renderInventory(); }
        pushToast(extraReward.message, 'success');
    }
    
    // Open reward modal after a delay for the animation
    setTimeout(() => {
        // baseHQ is the pre-streak value, rawHQ is also pre-streak
        openReward({ baseHQ: sessionHQ, seconds: sessionSeconds, difficulty: diff, rawHQ: sessionHQ });
    }, 1800);
}


  let lastRenderedState = {};
function loop() {
    // 使用同步后的时间，确保所有设备时间一致
    const now = getSyncedTime();
    const isActive = !!state.active;
    const baseTotalHQ = Math.floor(state.agg.totalHQ || 0);
    let sessionHQInt = 0;

    if (isActive) {
        const a = state.active;
        const task = getTask(a.taskId);

        if (task) {
            let sessionSeconds;
            let currentSessionHQ;

            // 多设备协同控制：任何设备都可以计算实时进度
            if (a.isPaused) {
                sessionSeconds = a.accumulatedSeconds || 0;
                // 使用服务器暂停时间计算已暂停时长
                let pausedFor = 0;
                if (a.serverPauseTime) {
                    pausedFor = (now - a.serverPauseTime) / 1000;
                } else if (a.pauseTime) {
                    // 如果没有服务器暂停时间，使用本地暂停时间
                    pausedFor = (now - a.pauseTime) / 1000;
                }
                showPauseIndicator(pausedFor);
                
                // 显示上次更新设备的提示
                if (a.lastUpdatedBy && a.lastUpdatedBy !== CLIENT_ID) {
                    if (el.activeHint) el.activeHint.textContent = `暂停中 (由其他设备操作)`;
                }
            } else {
            // 计算实时进度，使用服务器时间基准
            let elapsed;
            if (a.startTime) {
                // 优先使用服务器时间基准
                if (a.serverStartTime && a.lastServerTime) {
                    // 使用服务器时间计算当前进度
                    elapsed = (a.lastServerTime - a.serverStartTime) / 1000;
                } else if (a.serverStartTime) {
                    // 如果有服务器开始时间但没有最新服务器时间，使用同步后的时间
                    const syncedNow = getSyncedTime();
                    elapsed = (syncedNow - a.serverStartTime) / 1000;
                } else {
                    // 回退到本地时间计算，但会尽力通过心跳更新
                    elapsed = (now - a.startTime) / 1000;
                }
            } else {
                elapsed = 0;
            }
                
                sessionSeconds = (a.accumulatedSeconds || 0) + (elapsed > 0 ? elapsed : 0);
                hidePauseIndicator();
                
                // 显示上次更新设备的提示
                if (a.lastUpdatedBy && a.lastUpdatedBy !== CLIENT_ID) {
                    if (el.activeHint) el.activeHint.textContent = `进行中：${task.title} (由其他设备操作)`;
                } else if (a.lastUpdatedBy === CLIENT_ID) {
                    if (el.activeHint) el.activeHint.textContent = `进行中：${task.title}`;
                } else {
                    if (el.activeHint) el.activeHint.textContent = `进行中：${task.title}`;
                }
            }
            
            // 更新同步状态显示
            updateSyncStatus(a);
            
            const rate = effectiveRate(baseRateOfTask(task), task.difficulty);
            currentSessionHQ = sessionSeconds * rate;
            
            sessionSeconds = Math.max(0, sessionSeconds);
            currentSessionHQ = Math.max(0, currentSessionHQ);
            sessionHQInt = Math.floor(currentSessionHQ);
            
            // 检查是否需要强制刷新UI（处理远程状态变化）
            if (a.lastUpdatedBy && a.lastUpdatedBy !== CLIENT_ID) {
                const timeSinceLastUpdate = now - (a.lastUpdatedAt || 0);
                // 如果有状态变化但UI未更新，强制刷新
                if (timeSinceLastUpdate < 3000) { // 最近3秒内更新
                    const shouldRefresh = (
                        (sessionSeconds !== lastRenderedState.sessionSeconds) ||
                        (a.isPaused !== lastRenderedState.isPaused) ||
                        (a.taskId !== lastRenderedState.taskId)
                    );
                    
                    if (shouldRefresh) {
                        console.log("Forcing UI refresh due to remote state change");
                        setControls(); // 更新按钮状态
                        renderTasks(); // 更新任务列表
                    }
                }
            }

            // UI updates for timer card
            if (sessionHQInt !== lastRenderedState.sessionHQ) {
                sessionFlip.flipTo(sessionHQInt);
                lastRenderedState.sessionHQ = sessionHQInt;
            }
            const fmtSessionTime = fmtTime(sessionSeconds);
            if (fmtSessionTime !== lastRenderedState.sessionTime) {
                el.sessionTime.textContent = fmtSessionTime;
                lastRenderedState.sessionTime = fmtSessionTime;
            }
            const taskTotalHQ = Math.floor((task.totalHQ || 0) + currentSessionHQ);
            if (taskTotalHQ !== lastRenderedState.taskTotalHQ) {
                el.taskTotal.textContent = String(taskTotalHQ);
                lastRenderedState.taskTotalHQ = taskTotalHQ;
            }
            const fmtTaskTime = fmtTime((task.totalSeconds || 0) + sessionSeconds);
            if (fmtTaskTime !== lastRenderedState.taskTime) {
                el.taskTime.textContent = fmtTaskTime;
                lastRenderedState.taskTime = fmtTaskTime;
            }
        }
    } else {
        hidePauseIndicator();
    }

    const currentTotalHQForDisplay = Math.max(baseTotalHQ, baseTotalHQ + sessionHQInt);

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
  
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && state.active && !state.active.isPaused && state.active.leaderClientId === CLIENT_ID){ pauseTimer(); }});
  
  if (el.modeSwitchBtn) { el.modeSwitchBtn.addEventListener('click', () => { playSound(sfx.click); meta.arcade = !meta.arcade; save(); updateModeButton(); pushToast(`已切换到${meta.arcade ? '街机' : '专注'}模式`); }); }
  if (el.btnHelp) el.btnHelp.onclick=()=>{ playSound(sfx.modalOpen); el.helpMask.style.display='flex'; };
  el.btnCloseHelp.onclick=()=>{ playSound(sfx.modalClose); el.helpMask.style.display='none'; };
  el.btnCloseDev.onclick=()=>{ playSound(sfx.modalClose); el.devMask.style.display='none'; };
  el.btnSaveRates.onclick=()=>{ playSound(sfx.click); const r1=parseFloat(el.rate1.value)||0, r2=parseFloat(el.rate2.value)||0, r3=parseFloat(el.rate3.value)||0, r4=parseFloat(el.rate4.value)||0, r5=parseFloat(el.rate5.value)||0; RATE_BY_DIFFICULTY={1:Math.max(0,r1),2:Math.max(0,r2),3:Math.max(0,r3),4:Math.max(0,r4),5:Math.max(0,r5)}; save(); updateRate(); pushToast('速率已保存并应用','success'); };
  el.btnResetRates.onclick=()=>{ playSound(sfx.click); RATE_BY_DIFFICULTY={...DEFAULT_RATES}; save(); updateRate(); pushToast('已恢复默认速率','success'); };
  el.btnAdd.onclick=addTask; el.taskTitle.addEventListener('keydown',e=>{ if(e.key==='Enter') addTask(); });
  el.btnClearAll.onclick=()=>{ playSound(sfx.click); if(confirm('清空所有任务与累计数据（不清空库存/连胜/每日/速率），确定？')){ state.tasks=[]; state.agg={totalHQ:0,totalSeconds:0}; state.active=null; save(); renderTasks(); renderKPI(); setControls(); el.activeHint.textContent='未选择任务'; sessionFlip.setValue(0,true); el.sessionTime.textContent='0:00:00'; el.taskTotal.textContent='0'; el.taskTime.textContent='0:00:00'; el.rateText.textContent='0'; } };
  el.btnStart.onclick=startTimer; el.btnPause.onclick=pauseTimer; el.btnStop.onclick=stopTimer;

  function setupButtonPair(mobileId, desktopId, callback) { const mobileBtn = document.getElementById(mobileId); const desktopBtn = document.getElementById(desktopId); if (mobileBtn) mobileBtn.onclick = callback; if (desktopBtn) desktopBtn.onclick = callback; }
  const refreshMissionsAction = () => { playSound(sfx.click); const ok = rollMissions(false, false); if (ok) { save(); renderDaily(); renderInventory(); pushToast('已刷新每日任务', 'success'); } };
  el.btnDailyRefresh.onclick = refreshMissionsAction;

function todayObj(){ const k = todayKey(); if (!meta.daily[k]) { meta.daily[k] = { progressSec: 0, hardSec: 0, sessions: 0, zeroPauseSessions: 0, missions: null, refreshUsed: false, done: {}, completed: [] }; } if (!Array.isArray(meta.daily[k].completed)) { meta.daily[k].completed = []; } return meta.daily[k]; }
  const FIXED_MISSIONS=[{id:'total25',type:'totalSec',need:25*60,label:'今日累计 ≥ 25 分钟',reward:{ticket:1}},{id:'total45',type:'totalSec',need:45*60,label:'今日累计 ≥ 45 分钟',reward:{freeze:1}}];
  const RANDOM_POOL=[{id:'total90',type:'totalSec',need:90*60,label:'今日累计 ≥ 90 分钟',reward:{ticket:2}},{id:'single15',type:'singleSec',need:15*60,label:'单次 ≥ 15 分钟',reward:{ticket:1}},{id:'single30',type:'singleSec',need:30*60,label:'单次 ≥ 30 分钟',reward:{ticket:2}},{id:'hard20',type:'hardSec',need:20*60,label:'难度≥4 今日累计 ≥ 20 分钟',reward:{ticket:1}},{id:'noPause10',type:'noPauseSingle',need:10*60,label:'单次 ≥ 10 分钟且无暂停',reward:{freeze:1}},{id:'sessions3',type:'sessions',need:3,label:'今日完成 ≥ 3 次计时',reward:{ticket:1}}];
  function addTodayProgress({seconds,difficulty,pauses}){const d=todayObj(); d.progressSec+=seconds; if(difficulty>=4) d.hardSec+=seconds; d.sessions+=1; if(pauses===0 && seconds>=10*60) d.zeroPauseSessions+=1; save(); renderDaily();}
  function onSegmentEnd_base(seconds,difficulty,pauses){ if(seconds>=ECON.baseFloorMinSec){ meta.streak=+(meta.streak+ECON.streakStep).toFixed(2)} addTodayProgress({seconds,difficulty,pauses}); save(); }
  function singleMissionJudge(seconds,diff,pauses){ const d=todayObj(); if(!d.missions) return; d.missions.forEach((m)=>{ if(d.done[m.id]) return; if(m.type==='singleSec' && seconds>=m.need) d.done[m.id]=true; if(m.type==='noPauseSingle' && seconds>=m.need && pauses===0) d.done[m.id]=true; }); save(); renderDaily(); }
  function rollMissions(firstFree=false,useRare=false){
    const d=todayObj(); if(useRare){ if((meta.badges.rare_gem||0)<6){alert('稀有碎片不足');return false;} meta.badges.rare_gem-=6; }
    else{ if(d.refreshUsed && (meta.tickets||0)<=0){alert('抽卡券不足（每日首次刷新免费）');return false;} if(d.refreshUsed) meta.tickets-=1; }
    d.refreshUsed=true; const pool=[...RANDOM_POOL], pick=[]; for(let i=0;i<3;i++){const j=Math.floor(Math.random()*pool.length); pick.push(pool.splice(j,1)[0]);}
    d.missions=[...FIXED_MISSIONS,...pick]; d.done={}; save(); renderDaily(); renderInventory(); return true;
  }
  function renderDaily(){
    const d=todayObj(); if(!d.missions){rollMissions(true);return} const fragment = document.createDocumentFragment();
    d.missions.forEach((m)=>{ const ok=(()=>{if(m.type==='totalSec')return d.progressSec>=m.need; if(m.type==='hardSec')return d.hardSec>=m.need; if(m.type==='sessions')return d.sessions>=m.need; return false})();
      const done=!!d.done[m.id]; const progress=(()=>{if(m.type==='totalSec')return `${fmtTime(Math.min(d.progressSec,m.need))}/${fmtTime(m.need)}`; if(m.type==='hardSec')return `${fmtTime(Math.min(d.hardSec,m.need))}/${fmtTime(m.need)}`; if(m.type==='sessions')return `${Math.min(d.sessions,m.need)}/${m.need}`; if(m.type==='singleSec')return `完成一次 ≥ ${fmtTime(m.need)}`; if(m.type==='noPauseSingle')return `完成一次 ≥ ${fmtTime(m.need)}(0暂停)`; return ''})();
      const buttonText = done ? '已领取' : '领取'; const row = document.createElement('div'); row.className = 'daily-task-card';
      row.innerHTML = `<div class="daily-task-info"> <div class="daily-task-label">${m.label}</div> <div class="daily-task-progress muted">${progress ? `${progress}` : ''}</div> </div> <div class="daily-task-action"> <button class="btn small" ${(!ok || done) ? 'disabled' : ''}>${buttonText}</button> </div>`;
      row.querySelector('button').onclick=()=>{ if(done||!ok)return; playSound(sfx.success); d.done[m.id]=true; if(m.reward.ticket)meta.tickets=(meta.tickets||0)+m.reward.ticket; if(m.reward.freeze)meta.freeze=(meta.freeze||0)+m.reward.freeze; save(); renderDaily(); renderInventory(); };
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
    const bind = (id, fn) => { const x = document.getElementById(id); if (x) x.onclick = fn; };
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
    const expBarFillEl = document.getElementById("expBarFill"); const expValueTextEl = document.getElementById("expValueText");
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
    el.avatarUploader.onclick = () => { if (!isCloudBaseConfigured || !currentLoginState?.user) { pushToast('请先登录', 'warn'); return; } el.avatarInput.click(); };
    
    const resizeImage = (file, maxWidth, maxHeight, quality) => {
        return new Promise((resolve, reject) => { const reader = new FileReader();
            reader.onload = e => { const img = new Image(); img.onload = () => { let width = img.width; let height = img.height;
                    if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } } else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
                    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); if (!ctx) { return reject(new Error('Could not get canvas context')); } ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality)); };
                img.onerror = reject; 
                if (e.target && typeof e.target.result === 'string') {
                    img.src = e.target.result;
                } else {
                    reject(new Error('FileReader result is not a string'));
                }
            };
            reader.onerror = reject; reader.readAsDataURL(file); }); };

    function dataURLtoFile(dataurl, filename) {
        var arr = dataurl.split(','), mimeMatch = arr[0].match(/:(.*?);/),
            mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream',
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new File([u8arr], filename, {type:mime});
    }

    el.avatarInput.onchange = async e => {
      const file = e.target.files?.[0]; 
      const user = currentLoginState?.user;
      const uid = user?.uid;
      if (!file || !isCloudBaseConfigured || !uid) return;
      el.avatarUploader.innerHTML = '处理中...'; el.avatarInput.value = '';
      try {
        const resizedDataUrl = await resizeImage(file, 256, 256, 0.8);
        const imageFile = dataURLtoFile(resizedDataUrl, 'avatar.jpg');
        const cloudPath = `avatars/${uid}.jpg`;
        
        const uploadResult = await app.uploadFile({ cloudPath: cloudPath, filePath: imageFile });
        const fileListResult = await app.getTempFileURL({ fileList: [uploadResult.fileID] });
        const downloadURL = fileListResult.fileList[0].tempFileURL;

        meta.character.avatar = downloadURL;
        save();
        pushToast('头像已上传并同步', 'success');
      } catch (error) {
        console.error("Avatar upload failed:", error);
        pushToast(`头像上传失败: ${error.code || error.message}`, 'warn');
      } finally {
        renderYou();
      }
    };
  }

  if (el.charNameInput) { el.charNameInput.onblur = () => { meta.character.name = el.charNameInput.value.trim(); save(); }; }
  if (el.charTitleInput) { el.charTitleInput.onblur = () => { meta.character.title = el.charTitleInput.value.trim(); save(); }; }

  function renderInitial(){ 
    renderTasks(); 
    renderKPI(); 
    renderDaily(); 
    renderInventory(); 
    renderWorkshop(); 
    renderFunshop(); 
    renderYou(); 
    renderHeaderStatus(); 
    hidePauseIndicator(); 
    setControls(); 
    updateModeButton();
    
    // 重置渲染状态，确保UI更新
    lastRenderedState = {};
  }

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
  
  const setupDevTrigger = (element) => {
    if (!element) return;
    let clickCount = 0;
    let clickTimer = null;
    element.addEventListener('click', () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 600);
        if (clickCount === 3) {
            clickCount = 0;
            clearTimeout(clickTimer);
            if (el.devMask) {
                playSound(sfx.modalOpen);
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
  
  if (el.btnSaveResources) { el.btnSaveResources.onclick = () => { playSound(sfx.click); const p = (s) => parseInt(s, 10) || 0;
      state.agg.totalHQ = p(el.devTotalHQ.value); meta.tickets = p(el.devTickets.value); meta.freeze = p(el.devFreeze.value);
      ensureBadgeMeta(); meta.badges.rare_gem = p(el.devRareGem.value); meta.badges.epic_gem = p(el.devEpicGem.value);
      meta.badges.rare_tokens = p(el.devRareToken.value); meta.badges.epic_tokens = p(el.devEpicToken.value);
      meta.badges.legendary_tokens = p(el.devLegendToken.value);
      save(); renderKPI(); renderInventory(); pushToast('资源已更新', 'success'); }; }

  if (el.btnSaveRewardParams) { el.btnSaveRewardParams.onclick = () => { playSound(sfx.click); const p = (s) => parseFloat(s) || 0;
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
  
  const showLoader = (text) => { if(el.loadingOverlay) { el.loadingOverlay.textContent = text; el.loadingOverlay.style.display = 'flex'; }};
  const hideLoader = () => { if(el.loadingOverlay) el.loadingOverlay.style.display = 'none'; };

  const signOut = async () => {
    if (timerHeartbeatInterval) {
        clearInterval(timerHeartbeatInterval);
        timerHeartbeatInterval = null;
    }
    if (!isCloudBaseConfigured) return;
    try {
      await auth.signOut();
      pushToast('已退出登录', 'info');
    } catch (error) {
      console.error("Sign out failed:", error);
      pushToast('退出登录失败，请重试', 'warn');
    }
  };

  const openLoginModal = () => { playSound(sfx.modalOpen); el.loginMask.style.display = 'flex'; el.loginEmail.value = ''; el.loginPassword.value = ''; el.loginResult.style.display = 'none'; };
  const closeLoginModal = () => { playSound(sfx.modalClose); el.loginMask.style.display = 'none'; };
  const showLoginError = (message) => { el.loginResult.textContent = message; el.loginResult.className = 'result-bar result-err'; el.loginResult.style.display = 'block'; };
  const handleLogin = async () => {
    const username = el.loginEmail.value.trim();
    const password = el.loginPassword.value;
    if (!username || !password) { showLoginError('请输入用户名和密码。'); return; }
    showLoader('登录中...');
    try {
        await auth.signIn({ username, password });
        closeLoginModal(); pushToast('登录成功！', 'success');
    } catch (error) {
        console.error("Login Error:", error);
        showLoginError(`登录失败：${error.message || '请检查您的凭据。'}`);
    } finally { hideLoader(); }
  };

  const handleRegister = async () => {
    const username = el.loginEmail.value.trim();
    const password = el.loginPassword.value;
    if (!username || !password) { showLoginError('请输入用户名和密码。'); return; }
    if (password.length < 6) { showLoginError('密码长度至少需要 6 位。'); return; }
    showLoader('注册中...');
    try {
        await auth.signUp({ username, password });
        closeLoginModal(); pushToast('注册并登录成功！', 'success');
    } catch (error) {
        console.error("Registration Error:", error);
        showLoginError(`注册失败：${error.message || '请稍后再试。'}`);
    } finally { hideLoader(); }
  };
  el.btnLogin.onclick = openLoginModal;
  el.btnLogout.onclick = signOut;
  el.btnCloseLogin.onclick = closeLoginModal;
  el.btnDoLogin.onclick = handleLogin;
  el.btnDoRegister.onclick = handleRegister;

  const setupCloudBaseListener = (uid) => {
    if (realtimeListener) realtimeListener.close();
    
    // 增强监听器，添加错误重试机制和主动检查机制
    let retryCount = 0;
    const maxRetries = 5;
    let lastKnownVersion = state.syncVersion || 0;
    
    const createListener = () => {
        try {
            realtimeListener = db.collection('users').doc(uid).watch({
                onChange: (snapshot) => {
                    retryCount = 0; // 重置重试计数
                    
                    const docs = snapshot?.docs || [];
                    if (docs.length > 0) {
                        // 添加数据验证，确保接收到的数据有效
                        const data = docs[0];
                        if (data && typeof data === 'object' && data.syncMeta) {
                            // 检查版本号，确保处理最新数据
                            const newVersion = data.syncVersion || 0;
                            if (newVersion > lastKnownVersion) {
                                lastKnownVersion = newVersion;
                                applyCloudData(data);
                            } else if (newVersion < lastKnownVersion) {
                                // 如果接收到较旧的数据，强制刷新当前状态
                                console.log("Received older version, forcing sync");
                                save();
                            }
                        } else {
                            console.warn("Received invalid data structure from CloudBase listener");
                        }
                    }
                },
                onError: (err) => {
                    console.error("CloudBase listener error:", err);
                    pushToast(`与云端同步时出错 (尝试 ${retryCount + 1}/${maxRetries})`, 'warn');
                    
                    // 指数退避重试
                    if (retryCount < maxRetries) {
                        retryCount++;
                        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                        
                        setTimeout(() => {
                            if (currentLoginState?.user?.uid === uid) {
                                createListener();
                            }
                        }, delay);
                    } else {
                        pushToast('云端同步重试次数已达上限，请刷新页面', 'err');
                        hideLoader();
                    }
                }
            });
            
            // 添加主动检查机制，定期检查数据同步状态
            setInterval(async () => {
                if (currentLoginState?.user?.uid === uid) {
                    try {
                        // 同时获取文档和服务器时间
                        const [docRes, serverTime] = await Promise.all([
                            db.collection('users').doc(uid).get(),
                            getServerTime().catch(() => Date.now()) // 获取服务器时间，失败则用本地时间
                        ]);
                        
                        if (docRes.data && typeof docRes.data === 'object') {
                            const currentVersion = docRes.data.syncVersion || 0;
                            if (currentVersion > lastKnownVersion) {
                                console.log("Detected newer version during periodic check");
                                lastKnownVersion = currentVersion;
                                
                                // 将服务器时间附加到数据中
                                docRes.data.lastServerTimeCheck = serverTime;
                                applyCloudData(docRes.data);
                            }
                        }
                    } catch (error) {
                        console.error("Error during periodic sync check:", error);
                    }
                }
            }, 3000); // 减少到3秒检查一次，提高同步频率
            
        } catch (error) {
            console.error("Failed to create CloudBase listener:", error);
            if (retryCount < maxRetries) {
                retryCount++;
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                
                setTimeout(() => {
                    if (currentLoginState?.user?.uid === uid) {
                        createListener();
                    }
                }, delay);
            }
        }
    };
    
    createListener();
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
    
    const handleLoginStateChange = async (loginState) => {
      currentLoginState = loginState || null;

      if (loginState && loginState.user) {
          const user = loginState.user;
          el.authChipWrapper.classList.add('logged-in');
          if (user.isAnonymous) {
             el.authStatusText.textContent = '已登录(匿名)';
             el.userAvatar.style.backgroundImage = 'none';
          } else {
             const identifier = user.email || user.username || '已登录';
             const displayEmail = identifier.length > 18 ? identifier.substring(0, 15) + '...' : identifier;
             el.authStatusText.textContent = displayEmail;
             if(meta.character && meta.character.avatar){ el.userAvatar.style.backgroundImage = `url(${meta.character.avatar})`; }

          }

          
          showLoader('同步云端数据...');
          
          try {
            const userDocRef = db.collection('users').doc(user.uid);
            const docSnap = await userDocRef.get();
            const existingDocs = docSnap?.data || [];

            if (existingDocs.length > 0) {
                console.log("Existing user, applying cloud data.");
                applyCloudData(existingDocs[0]);
            } else {
                console.log("New user, creating document in CloudBase from local state.");
                const syncStamp = Date.now();
                const fullState = getFullStateSnapshot(syncStamp);
                await userDocRef.set(fullState);
                lastRemoteSyncStamp = syncStamp;
            }
            if (state.active && state.active.leaderClientId === CLIENT_ID && !state.active.isPaused) {
                console.log("Resuming heartbeat for existing session where I am the leader.");
                if (timerHeartbeatInterval) clearInterval(timerHeartbeatInterval);
                timerHeartbeatInterval = setInterval(sendTimerHeartbeat, HEARTBEAT_INTERVAL_MS);
            }
            // 立即同步时间偏移量
            syncTimeOffset().then(() => {
                // 设置定期时间同步
                if (window.timeSyncInterval) clearInterval(window.timeSyncInterval);
                window.timeSyncInterval = setInterval(syncTimeOffset, 30000); // 每30秒同步一次时间
            });
            
            setupCloudBaseListener(user.uid);
            cloudSyncReady = true;
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
          if (timerHeartbeatInterval) {
            clearInterval(timerHeartbeatInterval);
            timerHeartbeatInterval = null;
          }
          cloudSyncReady = false;
          el.authChipWrapper.classList.remove('logged-in');
          resetAppToDefaults();
          hideLoader();
      }
    };

    if (typeof auth.onLoginStateChanged === 'function') {
      auth.onLoginStateChanged(handleLoginStateChange);
    } else if (typeof auth.getLoginState === 'function') {
      const loginState = await auth.getLoginState();
      await handleLoginStateChange(loginState);
    }
  }

  initializeApp();
});
