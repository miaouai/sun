/**
 * Sun App v1.4.1 - 阳台日照智能分析
 * ✅ 配置化管理 UI 文本版
 */

// ==================== 全局状态 ====================
const AppState = {
    currentAzimuth: null,
    isAutoDetecting: false,
    balconyType: 'protruding',
    enclosedType: 'open',
    obstructions: [],
    latitude: null,
    longitude: null,
    locationMode: null,
    cityName: '',
    manualLat: null,
    manualLng: null,
    lastSelectedCity: ''
};
window.AppState = AppState;

// Toast 工具
function showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }
}
window.showToast = showToast;

// ==================== 页面初始化 ====================
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 1. 加载配置
        await window.Config.load();
        
        // 2. 更新版本号
        document.getElementById('versionText').textContent = window.Config.get('app.version', 'v1.4.1');
        
        // 3. 渲染界面
        setupUIFromConfig();
        renderMonthModal();
        
        // 4. 初始化事件
        initModuleEvents();
        
        console.log('✅ Sun App v1.4.1 已启动');
    } catch (error) {
        console.error('❌ 初始化失败:', error);
        showToast('⚠️ 应用加载异常');
    }
});

// ==================== UI 渲染引擎 ====================

function setupUIFromConfig() {
    setupBalconySection();
    setupLocationSection();
    setupAnalysisSection();
}

function setupBalconySection() {
    const section = document.getElementById('balconyConfigSection');
    if (!section) return;
    
    const title = window.Config.get('ui.sections.balconyConfig.title');
    
    section.innerHTML = `
        <div class="module-header"><h2>${title}</h2></div>
        <div class="module-content">
            ${renderCompassHTML()}
            ${renderBalconyFormHTML()}
        </div>
    `;
}

function renderCompassHTML() {
    return `
        <div id="compassSection">
            <h3>🧭 阳台朝向检测</h3>
            <p class="description">点击下方按钮打开系统指南针，或将手机对准阳台正前方</p>
            
            <div class="compass-container">
                <div class="compass-needle" id="compassNeedle"><div class="compass-north"></div></div>
                <div class="compass-directions">
                    <span class="direction north">北</span>
                    <span class="direction east">东</span>
                    <span class="direction south">南</span>
                    <span class="direction west">西</span>
                </div>
            </div>
            
            <p class="current-direction"><strong>当前朝向：<span id="currentDirectionValue">未检测</span></strong></p>
            
            <div class="compass-actions">
                <button id="openCompassApp" class="btn btn-secondary">📱 打开系统指南针</button>
                <button id="useCurrentDirection" class="btn btn-success">✓ 确认此方向</button>
            </div>
            
            <p class="hint">💡 提示：确保手机水平放置并远离金属物体</p>
        </div>
    `;
}

function renderBalconyFormHTML() {
    const balconyTypes = window.Config.get('ui.balconyType', {});
    const enclosedTypes = window.Config.get('ui.enclosedType', {});
    const obstructionLabels = window.Config.get('ui.obstructionLabels', {});
    
    return `
        <div id="balconyForm">
            <h3>🏠 阳台类型配置</h3>
            
            <div class="form-group">
                <label>阳台形态</label>
                <select id="balconyTypeSelect">
                    ${Object.entries(balconyTypes).map(([value, text]) => 
                        `<option value="${value}" ${value === 'protruding' ? 'selected' : ''}>${text}</option>`
                    ).join('\n                ')}
                </select>
            </div>
            
            <div class="form-group">
                <label>封闭情况</label>
                <select id="enclosedTypeSelect">
                    ${Object.entries(enclosedTypes).map(([value, text]) => 
                        `<option value="${value}" ${value === 'open' ? 'selected' : ''}>${text}</option>`
                    ).join('\n                ')}
                </select>
            </div>
            
            <div class="form-group">
                <label>周边遮挡</label>
                <div class="checkbox-group">
                    ${Object.entries(obstructionLabels).map(([value, text]) => `
                        <label class="checkbox-label">
                            <input type="checkbox" value="${value}" name="obstruction">
                            ${text}
                        </label>
                    `).join('\n                    ')}
                </div>
            </div>
        </div>
    `;
}

function setupLocationSection() {
    const section = document.getElementById('locationInfoSection');
    if (!section) return;
    
    const title = window.Config.get('ui.sections.locationInfo.title');
    const autoTitle = window.Config.get('location.autoPanel.title');
    const modeAuto = window.Config.get('location.modeSwitch.auto');
    const manualLatPlace = window.Config.get('location.manualPanel.latitudePlaceholder');
    const manualLngPlace = window.Config.get('location.manualPanel.longitudePlaceholder');
    const btnApply = window.Config.get('location.manualPanel.btnApply');
    const btnRetry = window.Config.get('location.autoPanel.btnRetry');
    
    section.innerHTML = `
        <div class="module-header"><h2>${title}</h2></div>
        <div class="module-content" id="locationContent">
            <div class="mode-switcher">
                <button id="locationModeSwitch" class="mode-btn active">
                    <span id="locationModeText">${modeAuto}</span>
                </button>
            </div>
            
            <div id="autoLocationPanel" class="location-panel active">
                <h3>${autoTitle}</h3>
                <div id="gpsStatus" class="status-info"><p>等待 GPS 信号...</p></div>
                <button id="triggerGPSBtn" class="btn btn-secondary">${btnRetry}</button>
            </div>
            
            <div id="manualLocationPanel" class="location-panel" style="display:none;">
                <h3>手动输入坐标</h3>
                <div class="form-row">
                    <input type="number" id="manualLat" placeholder="${manualLatPlace}" step="0.0001" class="coordinate-input">
                    <input type="number" id="manualLng" placeholder="${manualLngPlace}" step="0.0001" class="coordinate-input">
                </div>
                <button id="setCoordsBtn" class="btn btn-primary">${btnApply}</button>
            </div>
            
            <div class="footer-info">
                <span id="footerCoordinates">--</span>
                <span id="footerCityName">--</span>
            </div>
        </div>
    `;
}

function setupAnalysisSection() {
    const section = document.getElementById('analysisSection');
    if (!section) return;
    
    const title = window.Config.get('ui.sections.sunlightAnalysis.title');
    const btnStart = window.Config.get('analysis.btnStart');
    
    section.innerHTML = `
        <div class="module-header"><h2>${title}</h2></div>
        <div class="module-content">
            <button id="analyzeBtn" class="btn btn-large btn-analyze">${btnStart}</button>
            <div id="analysisResults" style="display:none;"></div>
        </div>
    `;
}

function renderMonthModal() {
    const modal = document.createElement('div');
    modal.id = 'monthModal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;justify-content:center;align-items:center;';
    modal.onclick = (e) => { if(e.target === modal) window.closeMonthModal(); };
    
    modal.innerHTML = `
        <div class="modal-content" style="background:white;border-radius:12px;padding:30px;max-width:800px;width:90%;max-height:80vh;overflow-y:auto;position:relative;">
            <button class="modal-close" onclick="window.closeMonthModal()" style="position:absolute;top:15px;right:15px;background:none;border:none;font-size:24px;cursor:pointer;color:#888;">×</button>
            <h2 id="modalMonthTitle" style="margin-bottom:10px;font-size:22px;"></h2>
            <p id="modalMonthDesc" style="color:#666;font-size:14px;margin-bottom:20px;"></p>
            <div id="modalMonthContent"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ==================== 事件初始化 ====================

function initModuleEvents() {
    // 罗盘控制
    setupCompassControls && setupCompassControls();
    
    // 阳台配置逻辑
    setupBalconyConfigLogic && setupBalconyConfigLogic();
    
    // 位置定位
    setupLocationModule && setupLocationModule();
    checkAndRequestPermissions && checkAndRequestPermissions();
    
    // 分析按钮
    setupAnalysisButton && setupAnalysisButton();
    
    // AI 助手
    window.AIAssistant.init && window.AIAssistant.init();
}

// ==================== 核心工具函数 ====================

function getCardinalDirection(angle) {
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return directions[Math.round((angle + 22.5) / 45) % 8];
}
window.getCardinalDirection = getCardinalDirection;

function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}小时${mins}分钟`;
}
window.formatDuration = formatDuration;

// ==================== 罗盘控制模块 ====================

function setupCompassControls() {
    const compassBtn = document.getElementById('openCompassApp');
    const confirmBtn = document.getElementById('useCurrentDirection');
    
    if (compassBtn) compassBtn.onclick = () => openSystemCompass();
    if (confirmBtn) confirmBtn.onclick = () => confirmUseDirection(AppState.currentAzimuth || 0);
}

function openSystemCompass() {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/.test(ua)) window.location.href = 'intent://#Intent;action=android.intent.action.VIEW;end';
    else if (/iphone|ipad/i.test(ua)) window.open('x-apple-compass://', '_blank');
    else showToast('请手动打开手机指南针 App');
}

function confirmUseDirection(angle) {
    AppState.currentAzimuth = angle;
    updateCompassNeedle(angle);
    const dirVal = document.getElementById('currentDirectionValue');
    if (dirVal) dirVal.textContent = `${Math.round(angle)}° (${getCardinalDirection(angle)})`;
    showToast(`✅ 已设置为 ${Math.round(angle)}°`);
}

function updateCompassNeedle(azimuth) {
    const needle = document.getElementById('compassNeedle');
    if (!needle) return;
    const pointerAngle = (360 - azimuth) % 360;
    needle.style.transform = `translate(-50%, -50%) rotate(${pointerAngle}deg)`;
}

// ==================== 阳台配置逻辑 ====================

function setupBalconyConfigLogic() {
    const balconySelect = document.getElementById('balconyTypeSelect');
    const enclosedSelect = document.getElementById('enclosedTypeSelect');
    
    if (balconySelect) balconySelect.onchange = function() {
        AppState.balconyType = this.value;
        showToast(window.UI.getBalconyTypeText(this.value));
    };
    
    if (enclosedSelect) enclosedSelect.onchange = function() {
        AppState.enclosedType = this.value;
        showToast(window.UI.getEnclosedTypeText(this.value));
    };
    
    document.querySelectorAll('input[name="obstruction"]').forEach(cb => {
        cb.onchange = updateObstructions;
    });
}

function updateObstructions() {
    const checked = Array.from(document.querySelectorAll('input[name="obstruction"]:checked')).map(cb => cb.value);
    AppState.obstructions = checked;
    console.log('遮挡更新:', checked);
}


// ==================== 位置定位模块 ====================

function setupLocationModule() {
    const modeSwitch = document.getElementById('locationModeSwitch');
    const autoPanel = document.getElementById('autoLocationPanel');
    const manualPanel = document.getElementById('manualLocationPanel');
    const triggerGPSBtn = document.getElementById('triggerGPSBtn');
    const setCoordsBtn = document.getElementById('setCoordsBtn');
    
    let isAutoMode = true;
    
    if (modeSwitch) {
        modeSwitch.onclick = () => {
            isAutoMode = !isAutoMode;
            if (isAutoMode) {
                AppState.locationMode = 'auto';
                modeSwitch.querySelector('#locationModeText').textContent = window.Config.get('location.modeSwitch.auto', '自动定位');
                autoPanel.style.display = 'block';
                manualPanel.style.display = 'none';
                triggerGPSLocation();
            } else {
                AppState.locationMode = 'manual';
                modeSwitch.querySelector('#locationModeText').textContent = window.Config.get('location.modeSwitch.manual', '手动定位');
                autoPanel.style.display = 'none';
                manualPanel.style.display = 'block';
            }
        };
    }
    
    if (triggerGPSBtn) triggerGPSBtn.onclick = triggerGPSLocation;
    if (setCoordsBtn) setCoordsBtn.onclick = applyManualCoordinates;
}

function triggerGPSLocation() {
    if (!navigator.geolocation) return showToast('此浏览器不支持定位');
    if (AppState.locationMode !== 'auto') return console.log('当前不是自动模式，跳过 GPS 定位');
    
    const gpsStatus = document.getElementById('gpsStatus');
    if (gpsStatus) gpsStatus.innerHTML = '<p style="color:#666;">正在获取 GPS 信号...</p>';
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            
            if (AppState.locationMode === 'auto') {
                AppState.latitude = lat;
                AppState.longitude = lng;
                
                if (gpsStatus) gpsStatus.innerHTML = `<p style="color:green;">✅ GPS 定位成功!<br><small>${lat.toFixed(4)}, ${lng.toFixed(4)}</small></p>`;
                updateFooterInfo(lat, lng);
                showToast('✅ 定位成功');
            }
        },
        (err) => {
            if (gpsStatus) gpsStatus.innerHTML = '<p style="color:red;">❌ GPS 定位失败</p>';
            showToast('定位失败，请切换至手动模式');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function applyManualCoordinates() {
    const latInput = document.getElementById('manualLat');
    const lngInput = document.getElementById('manualLng');
    
    const lat = parseFloat(latInput?.value);
    const lng = parseFloat(lngInput?.value);
    
    if (isNaN(lat) || isNaN(lng)) return showToast('请输入有效的经纬度');
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return showToast('纬度范围：-90~90，经度范围：-180~180');
    
    AppState.latitude = lat;
    AppState.longitude = lng;
    
    updateFooterInfo(lat, lng);
    showToast('坐标已设置');
    
    latInput.value = '';
    lngInput.value = '';
}

function updateFooterInfo(lat, lng, cityName = null) {
    const coordsEl = document.getElementById('footerCoordinates');
    const cityEl = document.getElementById('footerCityName');
    
    if (coordsEl && typeof lat === 'number' && typeof lng === 'number') {
        coordsEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    if (cityEl) cityEl.textContent = cityName || '当前位置';
}

function checkAndRequestPermissions() {
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'denied') console.warn('⚠️ 定位权限已被拒绝');
    });
}


// ==================== 日照分析核心逻辑 ====================

function setupAnalysisButton() {
    const btn = document.getElementById('analyzeBtn');
    if (btn) btn.onclick = performSunlightAnalysis;
}

async function performSunlightAnalysis() {
    // 验证输入
    if (AppState.currentAzimuth === null || AppState.currentAzimuth === undefined) {
        showToast(window.Config.get('errors.noDirection', '❌ 请先设置阳台朝向!'));
        return false;
    }
    
    if (!AppState.latitude || !AppState.longitude) {
        showToast(window.Config.get('errors.noPosition', '❌ 请先设置位置信息!'));
        return false;
    }
    
    showLoading(true);
    
    const lat = parseFloat(AppState.latitude);
    const lng = parseFloat(AppState.longitude);
    const today = new Date().toISOString().split('T')[0];
    
    console.log('[Sunlight] 创建 Worker 进行精确计算...');
    
    let workerCompleted = false;
    const timeoutId = setTimeout(() => {
        if (!workerCompleted) {
            console.error('[Sunlight] ⚠️ Worker 超时保护触发!');
            workerCompleted = true;
            try { /* eslint-disable-next-line no-undef */ worker.terminate(); } catch(e) {}
            showLoading(false);
            showToast('计算超时，请重试');
        }
    }, 15000);
    
    const worker = new Worker('data/solar_worker.js?v=' + Date.now());
    
    worker.onmessage = async (e) => {
        if (workerCompleted) return;
        
        clearTimeout(timeoutId);
        const data = e.data;
        
        if (data.success) {
            workerCompleted = true;
            const result = data.data;
            
            // 更新结果显示
            await displayAnalysisResults({
                direction: `${getCardinalDirection(AppState.currentAzimuth)} (${Math.round(AppState.currentAzimuth)}°)`,
                duration: formatDuration(result.durationHours * 60),
                sunrise: result.sunrise,
                sunset: result.sunset,
                solarNoon: result.solarNoon || '--:--',
                balconyType: window.UI.getBalconyTypeText(AppState.balconyType),
                enclosedType: AppState.enclosedType,
                enclosedTypeName: window.UI.getEnclosedTypeText(AppState.enclosedType),
                obstructions: formatObstructions(),
                latitude: lat,
                longitude: lng,
                effectiveHours: result.durationHours,
                periods: result.periods || []
            });
            
            worker.terminate();
            setTimeout(() => showLoading(false), 800);
        } else {
            workerCompleted = true;
            console.error('[Sunlight] 计算失败:', data.error);
            showToast('计算出错：' + data.error);
            worker.terminate();
            setTimeout(() => showLoading(false), 500);
        }
    };
    
    worker.onerror = (e) => {
        workerCompleted = true;
        console.error('[Sunlight] Worker 错误:', e);
        showToast(window.Config.get('errors.calculationFailed', '计算引擎错误'));
        setTimeout(() => showLoading(false), 500);
    };
    
    const params = {
        lat: lat,
        lon: lng,
        dateStr: today,
        azimuth: AppState.currentAzimuth,
        hasLeftWall: AppState.balconyType === 'protruding' && AppState.obstructions.includes('left'),
        hasRightWall: AppState.balconyType === 'protruding' && AppState.obstructions.includes('right'),
        hasRoof: AppState.obstructions.includes('top'),
        roofDepth: 1.2,
        windowHeight: 2.0,
        timeStep: 5,
        timezone: 8
    };
    
    console.log('[Sunlight] 计算参数:', params);
    worker.postMessage(params);
}

function formatObstructions() {
    if (!AppState.obstructions.length) return '无';
    return AppState.obstructions.map(o => o === 'left' ? '左' : o === 'right' ? '右' : '上').join(',');
}


// ==================== 结果显示逻辑 ====================

async function displayAnalysisResults(data) {
    const resultsDiv = document.getElementById('analysisResults');
    if (!resultsDiv) return;
    
    // 计算季节
    const today = new Date();
    const month = today.getMonth() + 1;
    let seasonText = '';
    if (month >= 3 && month <= 5) seasonText = window.Config.get('seasons.spring', '春季 🌸');
    else if (month >= 6 && month <= 8) seasonText = window.Config.get('seasons.summer', '夏季 ☀️');
    else if (month >= 9 && month <= 11) seasonText = window.Config.get('seasons.autumn', '秋季 🍂');
    else seasonText = window.Config.get('seasons.winter', '冬季 ❄️');
    
    const dateStr = today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    
    // 有效时段格式化
    let effectiveTimeText = '无';
    if (Array.isArray(data.periods) && data.periods.length > 0) {
        effectiveTimeText = data.periods.map(p => `${p.start} - ${p.end}`).join('\n');
    }
    
    // 光照评分（考虑封闭程度透光率）
    const ENCLOSURE_TRANSMISSION = {
        'open': 1.0, 'semi-closed': 0.8, 'closed-single': 0.7, 'closed-double': 0.65, 'closed-low-e': 0.55
    };
    
    let transmissionCoeff = ENCLOSURE_TRANSMISSION[data.enclosedType] || 1.0;
    const actualHours = parseFloat(data.effectiveHours) || 0;
    const effectiveHours = actualHours * transmissionCoeff;
    
    let score = '⭐';
    let desc = window.Config.get('analysis.summary.poor', '采光不足');
    
    if (effectiveHours >= 7) { score = '⭐⭐⭐⭐⭐'; desc = window.Config.get('analysis.summary.excellent', '采光极佳！🌟'); }
    else if (effectiveHours >= 5.5) { score = '⭐⭐⭐⭐'; desc = window.Config.get('analysis.summary.good', '采光优秀'); }
    else if (effectiveHours >= 4) { score = '⭐⭐⭐'; desc = window.Config.get('analysis.summary.fair', '采光良好'); }
    else if (effectiveHours >= 2.5) { score = '⭐⭐'; desc = window.Config.get('analysis.summary.average', '采光一般'); }
    
    resultsDiv.innerHTML = `
        <h3 class="result-title">${window.Config.get('analysis.resultTitle')} <span style="font-size:0.85em;color:#888;font-weight:normal;">${dateStr} ${seasonText}</span></h3>
        
        <div class="quick-stats">
            <div class="stat-item">
                <span class="stat-icon">🧭</span>
                <div><p class="stat-label">${window.Config.get('analysis.labels.direction')}</p><p class="stat-value">${data.direction}</p></div>
            </div>
            <div class="stat-item">
                <span class="stat-icon">⏱️</span>
                <div><p class="stat-label">${window.Config.get('analysis.labels.duration')}</p><p class="stat-value">${data.duration}</p></div>
            </div>
            <div class="stat-item">
                <span class="stat-icon">⭐</span>
                <div><p class="stat-label">${window.Config.get('analysis.detailTable.lightScore')}</p><p class="stat-value" style="color:${score.includes('★★★★')?'#FF9500':'inherit'}">${score} ${transmissionCoeff < 1 ? `(×${(transmissionCoeff*100).toFixed(0)}%)` : ''}</p></div>
            </div>
        </div>
        
        <table class="info-table">
            <tr><td style="color:#888;">${window.Config.get('analysis.labels.sunrise')}</td><td style="color:#333;font-weight:500;">${data.sunrise}</td></tr>
            <tr><td style="color:#888;">${window.Config.get('analysis.labels.sunset')}</td><td style="color:#333;font-weight:500;">${data.sunset}</td></tr>
            <tr><td style="color:#888;">${window.Config.get('analysis.labels.solarNoon')}</td><td style="color:#333;font-weight:500;">${data.solarNoon}</td></tr>
            <tr><td style="color:#888;">${window.Config.get('analysis.detailTable.effectiveTime')}</td><td style="color:#333;font-weight:500;">${effectiveTimeText}</td></tr>
        </table>
        
        <!-- AI 助手模块 -->
        <div id="aiAssistant" style="margin-top:25px;">
            <h4 style="color:#666;font-size:15px;margin-bottom:15px;">${window.Config.get('aiAssistant.sectionTitle')}</h4>
            <p style="color:#999;font-size:13px;margin-bottom:15px;">${window.Config.get('aiAssistant.statusReady')}</p>
            
            <button id="copyPromptBtn" class="btn btn-outline" style="width:100%;margin-bottom:10px;">
                ${window.Config.get('aiAssistant.buttons.copyPrompt.icon')} ${window.Config.get('aiAssistant.buttons.copyPrompt.text')}
            </button>
            
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
                <button class="btn btn-secondary btn-ai-platform" data-platform="deepseek" style="font-size:12px;">
                    ${window.Config.get('aiAssistant.buttons.deepseek.icon')} ${window.Config.get('aiAssistant.buttons.deepseek.text')}
                </button>
                <button class="btn btn-secondary btn-ai-platform" data-platform="qwen" style="font-size:12px;">
                    ${window.Config.get('aiAssistant.buttons.qwen.icon')} ${window.Config.get('aiAssistant.buttons.qwen.text')}
                </button>
                <button class="btn btn-secondary btn-ai-platform" data-platform="doubao" style="font-size:12px;">
                    ${window.Config.get('aiAssistant.buttons.doubao.icon')} ${window.Config.get('aiAssistant.buttons.doubao.text')}
                </button>
            </div>
            
            <p style="text-align:center;color:#bbb;font-size:11px;margin-top:10px;">${window.Config.get('aiAssistant.tip')}</p>
        </div>
        
        <button id="monthDetailBtn" class="btn btn-large" style="margin-top:15px;width:100%;">
            ${window.Config.get('analysis.monthDetailBtn', '📅 查看全年日照详情')}
        </button>
    `;
    
    resultsDiv.style.display = 'block';
    
    // 绑定点击事件
    document.getElementById('monthDetailBtn').onclick = () => window.showMonthOverview();
    
    // 滚动到结果区域
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}


// ==================== 全年日照概览模块 ====================

function showMonthOverview() {
    const modal = document.getElementById('monthModal');
    if (!modal) return;
    
    const year = new Date().getFullYear();
    document.getElementById('modalMonthTitle').textContent = `${year}年全年日照概览`;
    document.getElementById('modalMonthDesc').textContent = '点击下方月份查看当日详细光照数据';
    
    renderMonthGrid(year);
    modal.style.display = 'flex';
}

function renderMonthGrid(year) {
    const container = document.getElementById('modalMonthContent');
    if (!container) return;
    
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const colors = {1:'#1565C0',2:'#42A5F5',3:'#F8BBD0',4:'#F06292',5:'#81C784',6:'#4CAF50',
                   7:'#FFC107',8:'#FFF176',9:'#FFD54F',10:'#FF7043',11:'#E64A19',12:'#1976D2'};
    
    const monthsHtml = Array.from({length: 12}, (_, i) => {
        const month = i + 1;
        let seasonText = '';
        if (month >= 3 && month <= 5) seasonText = window.Config.get('seasons.spring', '春季 🌸');
        else if (month >= 6 && month <= 8) seasonText = window.Config.get('seasons.summer', '夏季 ☀️');
        else if (month >= 9 && month <= 11) seasonText = window.Config.get('seasons.autumn', '秋季 🍂');
        else seasonText = window.Config.get('seasons.winter', '冬季 ❄️');
        
        return `<div class="month-card" data-month="${month}" onclick="window.showMonthDays(${year}, ${month})" style="background-color:${colors[month]};color:white;border:none;border-radius:8px;padding:20px;font-size:16px;text-align:center;cursor:pointer;">
                    <span style="font-size:18px;font-weight:bold;">${monthNames[month-1]}</span><br>
                    <span style="font-size:12px;opacity:0.9;">${seasonText}</span>
                </div>`;
    }).join('');
    
    container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin-bottom:20px;">${monthsHtml}</div>`;
}

function showMonthDays(year, month) {
    const titleEl = document.getElementById('modalMonthTitle');
    const descEl = document.getElementById('modalMonthDesc');
    const contentEl = document.getElementById('modalMonthContent');
    if (!contentEl) return;
    
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    titleEl.textContent = `📅 ${year}年${monthNames[month-1]}`;
    descEl.textContent = '点击下方日期查看详细日照分析结果';
    
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const backBtn = document.createElement('button');
    backBtn.textContent = '← 返回月份选择';
    backBtn.style.cssText = 'display:inline-block;padding:8px 20px;margin-bottom:15px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;';
    backBtn.onclick = () => showMonthOverview();
    
    contentEl.innerHTML = '';
    contentEl.appendChild(backBtn);
    
    const dateGrid = document.createElement('div');
    dateGrid.id = 'dateGrid';
    dateGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(50px,1fr));gap:8px;margin-bottom:20px;';
    
    for (let d = 1; d <= daysInMonth; d++) {
        const btn = document.createElement('button');
        btn.textContent = d;
        btn.style.cssText = 'width:100%;aspect-ratio:1;border:1px solid #ddd;background:#f8f9fa;border-radius:4px;cursor:pointer;';
        btn.onclick = () => window.calculateDateSunlight(year, month, d);
        dateGrid.appendChild(btn);
    }
    
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'monthResultsContainer';
    resultsContainer.style.cssText = 'margin-bottom:20px;';
    
    const hint = document.createElement('p');
    hint.id = 'monthHint';
    hint.style.cssText = 'text-align:center;color:#888;font-size:14px;margin-top:20px;';
    hint.textContent = '点击上方日期查看详细日照数据';
    
    contentEl.appendChild(dateGrid);
    contentEl.appendChild(resultsContainer);
    contentEl.appendChild(hint);
}

async function calculateDateSunlight(year, month, day) {
    if (!AppState.latitude || !AppState.longitude) return showToast(window.Config.get('errors.noPosition', '❌ 请先设置位置'));
    
    const lat = parseFloat(AppState.latitude);
    const lng = parseFloat(AppState.longitude);
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dateKey = dateStr;
    
    const container = document.getElementById('monthResultsContainer');
    const hint = document.getElementById('monthHint');
    if (!container) return;
    
    // 显示 loading
    const loadingDiv = document.createElement('div');
    loadingDiv.id = `loading-${dateKey}`;
    loadingDiv.style.cssText = 'padding:20px;text-align:center;background:#fff3cd;border-radius:8px;margin-bottom:10px;';
    loadingDiv.innerHTML = '<div class="loading-spinner"></div><p style="color:#856404;margin-top:10px;">正在计算中...</p>';
    if (hint) hint.parentNode.insertBefore(loadingDiv, hint);
    else container.appendChild(loadingDiv);
    
    try {
        const worker = new Worker('data/solar_worker.js?v=' + Date.now());
        worker.onmessage = (e) => {
            const data = e.data;
            if (data.success) {
                displayDayResult(container, hint, {
                    dateKey,
                    sunrise: data.data.sunrise || '--:--',
                    sunset: data.data.sunset || '--:--',
                    solarNoon: data.data.solarNoon || '--:--',
                    durationHours: data.data.durationHours || 0,
                    periods: data.data.periods || []
                });
            } else {
                loadingDiv.remove();
                showToast('计算失败：' + (data.error || '未知错误'));
            }
            worker.terminate();
        };
        worker.onerror = () => {
            loadingDiv.remove();
            showToast('Worker 错误');
        };
        
        worker.postMessage({
            dateStr: dateStr,
            lat: lat,
            lon: lng,
            azimuth: AppState.currentAzimuth || 0,
            hasLeftWall: AppState.balconyType === 'protruding' && AppState.obstructions.includes('left'),
            hasRightWall: AppState.balconyType === 'protruding' && AppState.obstructions.includes('right'),
            hasRoof: AppState.obstructions.includes('top'),
            roofDepth: 1.2,
            windowHeight: 2.0,
            timeStep: 5,
            timezone: 8
        });
    } catch (error) {
        console.error('❌ 计算失败:', error);
        if (loadingDiv) loadingDiv.remove();
        showToast('⚠️ 计算失败');
    }
}

function displayDayResult(container, hint, data) {
    const loadingId = `loading-${data.dateKey}`;
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) loadingDiv.remove();
    
    let effectiveTimeText = '无';
    if (Array.isArray(data.periods) && data.periods.length > 0) {
        effectiveTimeText = data.periods.map(p => `${p.start} - ${p.end}`).join('\n');
    }
    
    const durationMins = Math.round(data.durationHours * 60);
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const durationText = `${hours}小时${mins}分钟`;
    
    const resultDiv = document.createElement('div');
    resultDiv.id = `result-${data.dateKey}`;
    resultDiv.style.cssText = 'background:#f8f9fa;border-left:4px solid #28a745;border-radius:8px;padding:15px;margin-bottom:10px;';
    resultDiv.innerHTML = `
        <h4 style="margin:0 0 10px 0;color:#333;font-size:16px;">📅 ${data.dateKey}</h4>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:5px 0;color:#666;">🌅 日出</td><td style="padding:5px 0;font-weight:bold;text-align:right;">${data.sunrise}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">🌇 日落</td><td style="padding:5px 0;font-weight:bold;text-align:right;">${data.sunset}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">☀️ 正午</td><td style="padding:5px 0;font-weight:bold;text-align:right;">${data.solarNoon}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">⏱️ 日照时长</td><td style="padding:5px 0;font-weight:bold;text-align:right;color:#28a745;">${durationText}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">🕐 有效时段</td><td style="padding:5px 0;text-align:left;white-space:pre-line;font-size:12px;color:#555;">${effectiveTimeText}</td></tr>
        </table>
    `;
    
    // 删除已存在的结果（防止重复）
    const existingResult = document.getElementById(`result-${data.dateKey}`);
    if (existingResult) existingResult.remove();
    
    // 插入到容器开头（最新结果在最上）
    if (container.firstChild) container.insertBefore(resultDiv, container.firstChild);
    else container.appendChild(resultDiv);
}

function closeMonthModal() {
    const modal = document.getElementById('monthModal');
    if (modal) modal.style.display = 'none';
}

// ESC 键关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('monthModal');
        if (modal && modal.style.display !== 'none') closeMonthModal();
    }
});

// ==================== 全局导出 ====================

window.showMonthOverview = showMonthOverview;
window.showMonthDays = showMonthDays;
window.calculateDateSunlight = calculateDateSunlight;
window.displayDayResult = displayDayResult;
window.closeMonthModal = closeMonthModal;

