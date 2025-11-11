// =================== 豪情应用主应用类 ===================
class HaoqingApp {
    constructor() {
        this.init();
    }

    // 初始化应用
    init() {
        try {
            // 1. 防止重复加载
            if (window.__HAOQING_APP_LOADED__) {
                console.warn('豪情应用已加载，跳过重复执行');
                return;
            }
            window.__HAOQING_APP_LOADED__ = true;

            // 2. 文件完整性检查
            this.checkFileIntegrity();

            // 3. 等待DOM加载完成后初始化
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeApp());
            } else {
                this.initializeApp();
            }

        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showError('应用初始化失败，请刷新页面重试');
        }
    }

    // 文件完整性检查
    checkFileIntegrity() {
        try {
            const lastLine = document.currentScript ? document.currentScript.textContent.split('\n').pop() : '';
            if (lastLine && !lastLine.includes('});')) {
                console.error('代码文件可能被截断，重新加载页面');
                if (confirm('应用文件加载不完整，是否重新加载？')) {
                    window.location.reload();
                }
            }
        } catch (e) {
            console.warn('文件完整性检查失败:', e);
        }
    }

    // 初始化应用
    initializeApp() {
        console.log('开始初始化豪情应用...');

        // 初始化顺序很重要！
        this.initUIElements();      // 1. 先初始化UI元素
        this.initEventHandlers();   // 2. 再绑定事件处理
        this.initCloudServices();   // 3. 初始化云服务
        this.initDataSync();        // 4. 初始化数据同步
        this.initChallengeSystem(); // 5. 初始化挑战系统

        console.log('豪情应用初始化完成');
    }

    // 初始化UI元素
    initUIElements() {
        this.el = {
            // 核心UI元素
            kpiTotalValue: this.$('#kpiTotalValue'),
            kpiTime: this.$('#kpiTime'),
            taskTitle: this.$('#taskTitle'),
            taskDiff: this.$('#taskDiff'),
            btnAdd: this.$('#btnAdd'),
            btnClearAll: this.$('#btnClearAll'),
            taskList: this.$('#taskList'),
            emptyTask: this.$('#emptyTask'),
            rateText: this.$('#rateText'),
            sessionTime: this.$('#sessionTime'),
            taskTotal: this.$('#taskTotal'),
            taskTime: this.$('#taskTime'),
            activeHint: this.$('#activeHint'),
            btnStart: this.$('#btnStart'),
            btnPause: this.$('#btnPause'),
            btnStop: this.$('#btnStop'),
            
            // 模态框相关
            rewardMask: this.$('#rewardMask'),
            rewardBody: this.$('#rewardBody'),
            btnCloseReward: this.$('#btnCloseReward'),
            helpMask: this.$('#helpMask'),
            btnHelp: this.$('#btnHelp'),
            btnCloseHelp: this.$('#btnCloseHelp'),
            
            // 同步状态
            syncStatus: this.$('#syncStatus'),
            syncStatusText: this.$('#syncStatusText'),
            
            // 挑战系统
            challengeCard: this.$('#challengeCard'),
            challengeDesc: this.$('#challengeDesc'),
            challengeTarget: this.$('#challengeTarget'),
            challengeReward: this.$('#challengeReward'),
            challengeProgressFill: this.$('#challengeProgressFill'),
            challengeProgressText: this.$('#challengeProgressText'),
            challengeStatus: this.$('#challengeStatus'),
            
            // 其他UI元素
            loadingOverlay: this.$('#loadingOverlay'),
            mobileHeaderStatus: this.$('#mobileHeaderStatus'),
            totalValorChip: this.$('#totalValorChip'),
            dStreakDisplay: this.$('#dStreakDisplay'),
            sStreakDisplay: this.$('#sStreakDisplay')
        };

        // 初始化基本UI状态
        this.hideLoading();
        this.setupResponsiveDesign();
    }

    // 安全的元素选择器
    $(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`元素未找到: ${selector}`);
        }
        return element;
    }

    // 隐藏加载界面
    hideLoading() {
        if (this.el.loadingOverlay) {
            this.el.loadingOverlay.style.display = 'none';
        }
    }

    // 设置响应式设计
    setupResponsiveDesign() {
        const rootEl = document.documentElement;
        const isIOSDevice = /iP(hone|od|ad)/i.test(navigator.userAgent) || 
                          (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

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
            ['resize','orientationchange'].forEach(evt => 
                window.addEventListener(evt, applyDynamicSafeAreas));
            ['resize','scroll'].forEach(evt => 
                window.visualViewport.addEventListener(evt, applyDynamicSafeAreas));
        }
    }

    // 初始化事件处理
    initEventHandlers() {
        console.log('初始化事件处理...');
        
        // 核心按钮事件
        this.bindEvent(this.el.btnStart, 'click', () => this.startTimer());
        this.bindEvent(this.el.btnPause, 'click', () => this.pauseTimer());
        this.bindEvent(this.el.btnStop, 'click', () => this.stopTimer());
        this.bindEvent(this.el.btnAdd, 'click', () => this.addTask());
        
        // 模态框事件
        this.bindEvent(this.el.btnCloseReward, 'click', () => this.hideRewardModal());
        this.bindEvent(this.el.btnCloseHelp, 'click', () => this.hideHelpModal());
        
        // 窗口事件
        window.addEventListener('beforeunload', () => this.handleBeforeUnload());
        
        console.log('事件处理初始化完成');
    }

    // 安全的事件绑定
    bindEvent(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`无法绑定事件: 元素不存在`);
        }
    }

    // 初始化云服务
    initCloudServices() {
        console.log('初始化云服务...');
        
        this.cloudServices = {
            isCloudBaseConfigured: false,
            isFirebaseConnected: false,
            app: null,
            auth: null,
            db: null
        };

        // CloudBase 配置
        this.cloudbaseConfig = {
            env: "cloud1-4g8gnb2uda2a2c54"
        };

        this.initCloudBase();
    }

    // 初始化 CloudBase
    initCloudBase() {
        try {
            if (!this.cloudbaseConfig.env || this.cloudbaseConfig.env === "YOUR_TCB_ENV_ID") {
                console.warn('CloudBase 未配置，运行在本地模式');
                return;
            }

            if (typeof cloudbase === 'undefined') {
                console.warn('CloudBase SDK 未加载');
                return;
            }

            this.cloudServices.app = cloudbase.init({
                env: this.cloudbaseConfig.env
            });
            this.cloudServices.auth = this.cloudServices.app.auth({ persistence: "local" });
            this.cloudServices.db = this.cloudServices.app.database();
            
            this.cloudServices.isCloudBaseConfigured = true;
            console.log('Tencent CloudBase 初始化成功');
            
            // 初始化 Firebase
            this.initFirebase();

        } catch (error) {
            console.error('CloudBase 初始化失败:', error);
            this.updateSyncStatus(false, 'CloudBase 初始化失败');
        }
    }

    // Firebase 功能已移除

    // 初始化数据同步
    initDataSync() {
        console.log('初始化数据同步...');
        
        this.syncConfig = {
            interval: 5000, // 5秒同步间隔
            docId: 'master_timer_state',
            heartbeatInterval: 2000,
            deviceTimeout: 30000
        };

        // 如果有云服务，启动同步
        if (this.cloudServices.isCloudBaseConfigured) {
            this.startDataSync();
        }
    }

    // 初始化挑战系统
    initChallengeSystem() {
        console.log('初始化挑战系统...');
        
        // 延迟初始化，确保UI元素已准备
        setTimeout(() => {
            if (typeof initializeChallengeSystem === 'function') {
                initializeChallengeSystem();
            }
            if (typeof initializeChallengeDebug === 'function') {
                initializeChallengeDebug();
            }
        }, 1000);
    }

    // =================== 核心功能方法 ===================

    // 开始计时器
    startTimer() {
        console.log('开始计时器');
        this.updateSyncStatus(true, '计时器启动');
    }

    // 暂停计时器
    pauseTimer() {
        console.log('暂停计时器');
        this.updateSyncStatus(false, '计时器暂停');
    }

    // 停止计时器
    stopTimer() {
        console.log('停止计时器');
        this.updateSyncStatus(false, '计时器停止');
    }

    // 添加任务
    addTask() {
        console.log('添加任务');
    }

    // 隐藏奖励模态框
    hideRewardModal() {
        if (this.el.rewardMask) {
            this.el.rewardMask.style.display = 'none';
        }
    }

    // 隐藏帮助模态框
    hideHelpModal() {
        if (this.el.helpMask) {
            this.el.helpMask.style.display = 'none';
        }
    }

    // 处理页面关闭
    handleBeforeUnload() {
        // 保存数据等清理操作
        console.log('处理页面关闭');
    }

    // =================== 同步状态更新 ===================

    // 更新同步状态
    updateSyncStatus(connected, message = '') {
        // 检查元素是否存在
        if (!this.el || !this.el.syncStatus) {
            console.warn('同步状态元素未找到');
            return;
        }

        this.el.syncStatus.style.display = 'flex';
        
        if (connected) {
            this.el.syncStatus.className = 'sync-status';
            this.el.syncStatus.innerHTML = `
                <span class="sync-indicator"></span>
                <span>实时同步中</span>
            `;
        } else {
            this.el.syncStatus.className = 'sync-status warning';
            this.el.syncStatus.innerHTML = `
                <span class="sync-indicator"></span>
                <span>${message || '同步异常'}</span>
            `;
        }
    }

    // =================== 错误处理 ===================

    // 显示错误信息
    showError(message) {
        console.error('应用错误:', message);
        // 可以在这里添加用户友好的错误提示
        alert(`应用错误: ${message}`);
    }

    // Firebase 相关功能已移除

    // 启动数据同步（占位方法）
    startDataSync() {
        console.log('启动数据同步');
        // 具体实现在专门的模块中
    }
}

// =================== 应用启动 ===================

// 创建全局应用实例
window.HaoqingApp = HaoqingApp;

// 自动启动应用
window.addEventListener('load', () => {
    try {
        new HaoqingApp();
    } catch (error) {
        console.error('应用启动失败:', error);
        alert('应用启动失败，请刷新页面重试');
    }
});