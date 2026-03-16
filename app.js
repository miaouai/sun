// ==================== 向日窥 - Sun Peek v1.0.0 ====================
// 阳台光照智能分析应用核心逻辑

(function() {
    'use strict';

    // ✅ 立即导出全年日照功能（在 IIFE 开始处定义，确保 onclick 可调用）
    // ===== 全年日照详情功能 =====
    
    function showMonthDetail() {
        const modal = document.getElementById('monthModal');
        if (!modal) return;
        
        const titleEl = document.getElementById('modalMonthTitle');
        const contentEl = document.getElementById('modalMonthContent');
        
        if (!titleEl || !contentEl) return;
        
        const year = new Date().getFullYear();
        titleEl.textContent = `📅 ${year}年全年日照概览`;
        contentEl.innerHTML = '';
        
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                           '七月', '八月', '九月', '十月', '十一月', '十二月'];
        const colors = {1:'#1565C0',2:'#42A5F5',3:'#F8BBD0',4:'#F06292',5:'#81C784',
                       6:'#4CAF50',7:'#FFC107',8:'#FFF176',9:'#FFD54F',10:'#FF7043',
                       11:'#E64A19',12:'#1976D2'};
        
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin-bottom:20px;';
        
        for (let m = 1; m <= 12; m++) {
            const card = document.createElement('button');
            let season = m>=3&&m<=5?'春季🌸':m>=6&&m<=8?'夏季☀️':m>=9&&m<=11?'秋季🍂':'冬季❄️';
            card.style.cssText = 'width:100%;padding:20px;background-color:'+colors[m]+';color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;';
            card.innerHTML = '<span style="font-size:18px;font-weight:bold;">'+monthNames[m-1]+'</span><span style="font-size:12px;opacity:0.9;">'+season+'</span>';
            card.onclick = () => showMonthDays(m);
            grid.appendChild(card);
        }
        contentEl.appendChild(grid);
        
        const hint = document.createElement('p');
        hint.style.cssText = 'text-align:center;color:#888;font-size:14px;margin-top:20px;';
        hint.textContent = '点击月份查看该月每日详细日照数据';
        contentEl.appendChild(hint);
        
        modal.style.display = 'flex';
    }
    
    function showMonthDays(month) {
        const year = new Date().getFullYear();
        const titleEl = document.getElementById('modalMonthTitle');
        const descEl = document.getElementById('modalMonthDesc');
        const contentEl = document.getElementById('modalMonthContent');
        if (!contentEl) return;
        
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                           '七月', '八月', '九月', '十月', '十一月', '十二月'];
        titleEl.textContent = `📅 ${year}年${monthNames[month-1]}`;
        descEl.textContent = '点击下方日期查看详细日照分析结果';
        
        // ✅ 添加"返回月份选择"按钮
        const backBtn = document.createElement('button');
        backBtn.textContent = '← 返回月份选择';
        backBtn.style.cssText = 'display:inline-block;padding:8px 20px;margin-bottom:15px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;';
        backBtn.onclick = () => showMonthDetail();
        contentEl.innerHTML = '';
        contentEl.appendChild(backBtn);
        
        const daysInMonth = new Date(year, month, 0).getDate();
        const dateGrid = document.createElement('div');
        dateGrid.id = 'dateGrid';
        dateGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(50px,1fr));gap:8px;margin-bottom:20px;';
        
        for (let d = 1; d <= daysInMonth; d++) {
            const btn = document.createElement('button');
            btn.textContent = d;
            btn.style.cssText = 'width:100%;aspect-ratio:1;border:1px solid #ddd;background:#f8f9fa;border-radius:4px;cursor:pointer;';
            btn.onmouseover = () => btn.style.background = '#e9ecef';
            btn.onmouseout = () => btn.style.background = '#f8f9fa';
            btn.onclick = () => calculateDateSunlight(year, month, d);
            dateGrid.appendChild(btn);
        }
        
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'monthResultsContainer';
        resultsContainer.style.cssText = 'margin-bottom:20px;';
        
        const hint = document.createElement('p');
        hint.id = 'monthHint';
        hint.style.cssText = 'text-align:center;color:#888;font-size:14px;margin-top:20px;';
        hint.textContent = '点击上方日期查看详细日照数据';
        
        contentEl.innerHTML = '';
        contentEl.appendChild(dateGrid);
        contentEl.appendChild(resultsContainer);
        contentEl.appendChild(hint);
    }
    
    function calculateDateSunlight(year, month, day) {
        // ✅ 必须设置位置信息才能计算
        if (!window.AppState?.latitude || !window.AppState?.longitude) {
            showToast('❌ 请先设置您的位置信息！');
            return;
        }
        
        const lat = parseFloat(window.AppState.latitude);
        const lng = parseFloat(window.AppState.longitude);
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        
        // 如果确实没设置位置，提示一下但不阻止计算
        if (!window.AppState?.latitude || !window.AppState?.longitude) {
            console.log('[自动使用默认坐标] 重庆綦江: ' + lat + '°N, ' + lng + '°E');
        }
        
        const container = document.getElementById('monthResultsContainer');
        const hint = document.getElementById('monthHint');
        if (!container) return;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.id = `loading-${dateKey}`;
        loadingDiv.style.cssText = 'padding:20px;text-align:center;background:#fff3cd;border-radius:8px;margin-bottom:10px;';
        loadingDiv.innerHTML = '<div class="loading-spinner"></div><p style="color:#856404;margin-top:10px;">正在计算中...</p>';
        if (hint) hint.parentNode.insertBefore(loadingDiv, hint);
        else container.appendChild(loadingDiv);
        
        const params = {
            dateStr: dateStr,               // ✅ 使用正确的日期字段
            lat: parseFloat(lat),           // ✅ 确保是数字
            lon: parseFloat(lng),           // ✅ 确保是数字
            azimuth: window.AppState.currentAzimuth || 0,
        // ✅ 注意：如果 currentAzimuth 为 null，这里会是 NaN，需要后续验证
            hasLeftWall: window.AppState.balconyType === 'protruding' && (window.AppState.obstructions?.includes('left') || false),
            hasRightWall: window.AppState.balconyType === 'protruding' && (window.AppState.obstructions?.includes('right') || false),
            hasRoof: window.AppState.obstructions?.includes('top') || false,
            roofDepth: 1.2,
            windowHeight: 2.0,
            timeStep: 5,
            timezone: 8  // ✅ 中国标准时间 UTC+8
        };
        
        console.log('[单日计算] 参数:', params);
        
        const worker = new Worker('data/solar_worker.js?v=' + Date.now());
        worker.onmessage = function(e) {
            const data = e.data;
            if (data.success) {
                const r = data.data;  // ✅ Worker 返回的是 data.data，不是 data.result
                const displayData = {
                    dateKey,
                    sunrise: r.sunrise || '--:--',
                    sunset: r.sunset || '--:--',
                    solarNoon: r.solarNoon || '--:--',
                    durationHours: r.durationHours || 0,
                    periods: r.periods || []
                };
                displayDayResult(container, hint, displayData);
            } else {
                loadingDiv.remove();
                if (window.showToast) showToast('计算失败：' + (data.error || '未知错误'));
            }
            worker.terminate();
        };
        worker.onerror = function() {
            loadingDiv.remove();
            if (window.showToast) showToast('Worker 错误');
        };
        worker.postMessage(params);
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
        
        // ✅ 确保最新结果始终显示在日期网格下方第一条位置
        // 策略：先查找是否已有相同日期的结果，如果有则删除它
        const existingResult = document.getElementById(`result-${data.dateKey}`);
        if (existingResult) {
            existingResult.remove();
        }
        
        // 将新结果插入到 resultsContainer 的开头（紧接在日期网格之后）
        if (container.firstChild) {
            container.insertBefore(resultDiv, container.firstChild);
        } else {
            container.appendChild(resultDiv);
        }
    }
    
    // ===== 全局状态管理（无默认值）=====
    const AppState = {
        currentAzimuth: null,           // ✅ 必须手动设置阳台朝向角度 (0-360)
        isAutoDetecting: false,         // 是否正在自动检测
        balconyType: 'protruding',      // 阳台类型：protruding|recessed|embedded_left|embedded_right
        enclosedType: 'open',           // 封闭类型：open|semi-closed|closed-single|closed-double|closed-low-e
        obstructions: [],               // 遮挡列表：['left', 'right', 'top']
        latitude: null,                 // ✅ 必须手动设置纬度
        longitude: null,                // ✅ 必须手动设置经度
        locationMode: null,             // 位置模式：'auto'|'manual'|'city'
        cityName: '',                   // 城市名称（显示用）
        manualLat: null,                // 手动选择的纬度
        manualLng: null,                // 手动选择的经度
        lastSelectedCity: ''            // 最后选择的城市
    };
    
    // ✅ 导出 AppState 供外部模块访问
    window.AppState = AppState;

    // ===== Toast 提示工具 =====
    function showToast(message, duration = 2500) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), duration);
        }
    }
    
    // ✅ 导出 showToast
    window.showToast = showToast;

    // ===== 指南针方向转换 =====
    function getCardinalDirection(angle) {
        const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
        return directions[Math.round((angle + 22.5) / 45) % 8];
    }

    // ===== 日照时长格式化工具 =====
    function formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}小时${mins}分钟`;
    }

    // ===== 日出日落时间计算（简化版）=====
    function calculateSunTimes(lat, lng, date) {
        const rad = Math.PI / 180;
        const deg = 180 / Math.PI;
        
        // 儒略日计算
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const Dn = Date.UTC(year, month - 1, day, 12, 0, 0) / 86400000 - Date.UTC(1970, 0, 1, 0, 0, 0) / 86400000 - 1;
        
        // 赤纬角
        const delta = -23.44 * Math.sin(rad * (360 / 365 * (Dn - 81)));
        
        // 时差方程
        const b = rad * 360 / 409 * (Dn - 242);
        const EqTime = -1.25 - 32.19 * Math.cos(b) + 6.23 * Math.sin(b);
        
        // 正午时刻
        const solarNoon = 720 - 4 * lng - EqTime;
        
        // 昼长（小时）- 修正：delta 是角度，需要转为弧度
        const sunRiseSetHourOffset = (2 / 15) * Math.acos(-Math.tan(rad * lat) * Math.tan(delta * rad));
        
        const sunriseMin = solarNoon - sunRiseSetHourOffset * 60;
        const sunsetMin = solarNoon + sunRiseSetHourOffset * 60;
        
        const dayLength = (sunsetMin - sunriseMin); // 分钟数
        
        const sunriseHours = Math.floor(sunriseMin / 60);
        const sunriseMins = Math.round(sunriseMin % 60);
        const sunsetHours = Math.floor(sunsetMin / 60);
        const sunsetMins = Math.round(sunsetMin % 60);
        
        return {
            sunrise: `${String(sunriseHours).padStart(2, '0')}:${String(sunriseMins).padStart(2, '0')}`,
            sunset: `${String(sunsetHours).padStart(2, '0')}:${String(sunsetMins).padStart(2, '0')}`,
            dayLength: dayLength
        };
    }

    // ===== 权限管理模块（简化版）=====
    function checkAndRequestPermissions() {
        const statusEl = document.getElementById('permissionStatus');
        if (!statusEl) return;

        statusEl.innerHTML = '<span class="status-icon">📡</span><span class="status-text">正在检测设备能力...</span>';

        // 检查设备方向传感器支持
        if (typeof DeviceOrientationEvent !== 'undefined') {
            // iOS 13+ 需要显式请求权限
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                    .then(permissionState => {
                        if (permissionState === 'granted') {
                            statusEl.innerHTML = '<span class="status-icon">✅</span><span class="status-text">已获得全部权限</span>';
                        } else {
                            statusEl.innerHTML = '<span class="status-icon">⚠️</span><span class="status-text">方向检测权限被拒绝，请使用手动模式</span>';
                        }
                    })
                    .catch(err => console.log('权限请求错误:', err));
            } else {
                // Android 或非 iOS 13 设备
                statusEl.innerHTML = '<span class="status-icon">✅</span><span class="status-text">已获得定位和方向权限</span>';
            }
        } else {
            statusEl.innerHTML = '<span class="status-icon">ℹ️</span><span class="status-text">设备不支持方向传感器，请使用手动输入</span>';
        }

        // 自动定位模式下触发 GPS 定位
        if (AppState.locationMode === 'auto') {
            triggerGPSLocation();
        }
    }

    // ===== 方向检测模块（修复版）=====
    let orientationHandler = null; // 保存事件处理器引用

    function setupCompassControls() {
        const autoBtn = document.getElementById('autoDetectBtn');
        const manualInput = document.getElementById('manualAngleInput');
        const manualBtn = document.getElementById('manualSetBtn');
        
        if (!autoBtn || !manualInput || !manualBtn) return;

        // 自动检测按钮点击
        autoBtn.addEventListener('click', () => toggleAutoDetection(autoBtn));

        // 手动设置确认按钮
        manualBtn.addEventListener('click', () => {
            const angle = parseFloat(manualInput.value);
            if (isNaN(angle) || angle < 0 || angle > 360) {
                showToast('请输入有效的角度 (0-360)');
                return;
            }
            setManualDirection(angle);
            // 清空输入框以便下次使用
            manualInput.value = '';
        });

        // 支持回车键提交
        manualInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                manualBtn.click();
            }
        });
    }

    function toggleAutoDetection(btn) {
        const isStarting = !AppState.isAutoDetecting;
        AppState.isAutoDetecting = isStarting;
        
        if (isStarting) {
            btn.classList.add('active');
            btn.querySelector('.btn-icon').textContent = '⏹️';
            btn.querySelector('.btn-text').textContent = '停止检测';
            document.getElementById('modeDisplay').textContent = '自动检测中...';
            document.getElementById('modeDisplay').style.color = '#34C759';
            
            // 禁用手动输入框和确认按钮
            const manualInput = document.getElementById('manualAngleInput');
            const manualBtn = document.getElementById('manualSetBtn');
            manualInput.disabled = true;
            manualBtn.disabled = true;
            manualInput.placeholder = '自动检测中...';
            
            startOrientationListener();
        } else {
            btn.classList.remove('active');
            btn.querySelector('.btn-icon').textContent = '▶️';
            btn.querySelector('.btn-text').textContent = '自动检测';
            const lastAngle = AppState.currentAzimuth !== null ? AppState.currentAzimuth : '--';
            document.getElementById('modeDisplay').textContent = `已停止 (${lastAngle}°)`;
            document.getElementById('modeDisplay').style.color = '#FF9500';
            
            stopOrientationListener();
            
            // 启用手动输入框和确认按钮（变为绿色）
            const manualInput = document.getElementById('manualAngleInput');
            const manualBtn = document.getElementById('manualSetBtn');
            manualInput.disabled = false;
            manualBtn.disabled = false;
            manualInput.placeholder = '输入角度 (0-360)';
            manualInput.value = '';
        }
    }

    function startOrientationListener() {
        console.log('🔄 [启动] 开始注册方向传感器...');
        
        // 检查设备支持性
        if (typeof DeviceOrientationEvent === 'undefined') {
            console.warn('⚠️ 浏览器不支持 DeviceOrientationEvent');
            showToast('您的浏览器不支持方向传感器');
            setTimeout(() => {
                const btn = document.getElementById('autoDetectBtn');
                if (btn && AppState.isAutoDetecting) toggleAutoDetection(btn);
            }, 2000);
            return;
        }

        // 创建统一的处理函数
        orientationHandler = function(event) {
            let azimuth = null;
            
            // iOS Safari: webkitCompassHeading (真实罗盘角度)
            if (event.webkitCompassHeading !== undefined) {
                azimuth = event.webkitCompassHeading;
                console.log(`[iOS Compass] ${azimuth.toFixed(1)}°`);
            }
            // Android Chrome: alpha (相对初始位置的旋转角度)
            else if (event.alpha !== undefined) {
                // alpha 是相对于页面加载时的设备姿态
                // 将逆时针的 alpha 转换为顺时针的方位角
                azimuth = (360 - event.alpha) % 360;
                if (azimuth < 0) azimuth += 360;
                console.log(`[Android Alpha] ${event.alpha.toFixed(1)}° → ${(azimuth).toFixed(1)}°`);
            }
            
            // 验证并更新 UI
            if (azimuth !== null && typeof azimuth === 'number' && !isNaN(azimuth)) {
                azimuth = Math.round(((azimuth % 360) + 360) % 360);
                
                AppState.currentAzimuth = azimuth;
                updateCompassNeedle(azimuth);
                document.getElementById('currentAngle').textContent = `${azimuth}°`;
            }
        };

        // ========== 关键修复：Android 权限申请 ==========
        requestDevicePermissions().then(granted => {
            if (granted) {
                console.log('✅ 设备权限已授予，开始监听方向数据...');
                registerListeners();
            } else {
                console.warn('⚠️ 用户拒绝设备权限或使用受限模式');
                showToast('需要授权才能使用自动检测');
                // 降级方案：尝试直接注册（可能被系统拦截）
                console.log('💡 尝试在不请求权限的情况下注册监听器...');
                registerListeners();
            }
        }).catch(err => {
            console.error('❌ 权限处理出错:', err);
            showToast('权限请求失败，请重试');
        });

        async function requestDevicePermissions() {
            // 检测是否是 iOS 13+（需要特殊权限 API）
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                console.log('📱 检测到 iOS 13+，调用官方权限 API...');
                try {
                    const permissionState = await DeviceOrientationEvent.requestPermission();
                    console.log(`iOS 权限状态：${permissionState}`);
                    return permissionState === 'granted';
                } catch (err) {
                    console.error('iOS 权限请求错误:', err.message);
                    throw err;
                }
            }
            
            // Android 权限申请方案
            console.log('🤖 检测到 Android 设备，准备申请运动传感器权限...');
            
            // 方案 1: 使用 Permissions API（Chrome 87+）
            if ('permissions' in navigator) {
                try {
                    const permissionsStatus = await checkAndroidPermissions();
                    if (permissionsStatus) return true;
                } catch (err) {
                    console.log('Permissions API 不可用:', err.message);
                }
            }
            
            // 方案 2: 检查 User-Agent（简单的 Android 识别）
            const isAndroid = /Android/i.test(navigator.userAgent);
            if (isAndroid) {
                console.log('ℹ️ Android 设备确认，提示用户可能需要授权');
                showAndroidPermissionGuide();
            }
            
            // 默认返回 true 以继续尝试注册监听器
            console.log('ℹ️ 跳过显式权限检查，直接尝试注册监听器');
            return true;
        }

        async function checkAndroidPermissions() {
            try {
                const query = { name: 'deviceOrientation', sensitive: true };
                const status = await navigator.permissions.query(query);
                console.log(`deviceOrientation 权限状态：${status.state}`);
                
                if (status.state === 'granted') {
                    return true;
                } else if (status.state === 'prompt') {
                    // 等待用户操作
                    return true;
                }
                return false;
            } catch (err) {
                console.warn('无法查询 deviceOrientation 权限:', err.message);
                return null;
            }
        }

        function showAndroidPermissionGuide() {
            const guideHTML = `
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0;">
                    <strong style="color: #856404; display: block; margin-bottom: 8px;">📱 Android 设备使用说明：</strong>
                    <small style="color: #6c5b2e; line-height: 1.6;">
                        <p style="margin: 4px 0;">某些国产 ROM（如 MIUI、EMUI）可能限制了传感器访问。</p>
                        <strong style="display: block; margin-top: 8px;">如果检测到无数据，请：</strong>
                        1. 在应用信息中允许"身体传感器"权限<br>
                        2. 重启浏览器后重试<br>
                        <a href="#" onclick="openCompassApp(); return false;" 
                           style="color: #007bff; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 8px;">
                           🧭 打开手机指南针 App 获取精确度数
                        </a>
                    </small>
                </div>
            `;
            
            const module = document.querySelector('.orientation-module .module-content');
            if (module) {
                const existingGuide = module.querySelector('.android-guide');
                if (!existingGuide) {
                    const div = document.createElement('div');
                    div.className = 'android-guide';
                    div.innerHTML = guideHTML;
                    div.style.marginBottom = '16px';
                    module.insertBefore(div, module.firstChild);
                }
            }
        }
        
        // 打开手机指南针 App 的函数（需要全局可访问）
        window.openCompassApp = function() {
            console.log('🧭 尝试打开指南针 App...');
            
            // 不同品牌的意图格式
            const intents = [
                // 通用 Android Intent
                'intent://com.google.android.apps.maps/#Intent;scheme=com.google.android.apps.maps;end',
                // 华为/荣耀指南针
                'intent://com.huawei.compass/#Intent;scheme=com.huawei.compass;end',
                // 小米指南针
                'intent://com.miui.compass/#Intent;scheme=com.miui.compass;end',
                // OPPO/VIVO指南针
                'intent://com.coloros.compass/#Intent;scheme=com.coloros.compass;end',
                // Samsung 指南针
                'intent://samsung.android.app.bixbyvision.service#Intent;scheme=samsung.android.app.bixbyvision.service;end',
            ];
            
            let opened = false;
            
            // 先尝试直接跳转到设置中的指南针
            try {
                // iOS Safari: 使用 intent 或 x-callback-url
                if (navigator.userAgent.match(/iPhone|iPad/i)) {
                    window.location.href = 'x-apple-compass://';
                    opened = true;
                }
                // Android: 尝试多个可能的 package
                else if (navigator.userAgent.match(/Android/i)) {
                    // 方法 1: 通过 Chrome Custom Tab 尝试打开
                    window.location.href = 'https://play.google.com/store/apps/details?id=com.google.android.apps.maps';
                    
                    // 同时提示用户
                    showToast('如自动跳转失败，请手动打开：设置 > 应用 > 指南针');
                    opened = true;
                }
            } catch (err) {
                console.warn('自动跳转失败:', err.message);
            }
            
            if (!opened) {
                showToast('请手动打开手机自带的指南针 App');
            }
        };

        function registerListeners() {
            try {
                window.addEventListener('deviceorientation', orientationHandler);
                console.log('✅ deviceorientation 监听器已注册成功');
                
                // 延迟显示成功提示
                setTimeout(() => {
                    console.log('📡 方向检测已就绪，请在手机上移动设备测试');
                    
                    // iOS 特定提示
                    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
                        console.log('💡 检测到 iOS 设备，建议使用横屏获得更好的精度');
                    }
                }, 1000);
            } catch (err) {
                console.error('❌ 无法注册监听器:', err.message);
                throw err;
            }
        }
    }

    function stopOrientationListener() {
        if (orientationHandler) {
            try {
                window.removeEventListener('deviceorientation', orientationHandler);
                console.log('⏹️ 方向传感器监听已停止');
            } catch (e) {
                console.warn('⚠️ 移除监听器出错:', e.message);
            }
            orientationHandler = null;
        }
    }

    function setManualDirection(angle) {
        const validAngle = Math.round(parseFloat(angle));
        if (isNaN(validAngle) || validAngle < 0 || validAngle > 360) {
            showToast('无效的角度值');
            return;
        }
        
        AppState.currentAzimuth = validAngle;
        updateCompassNeedle(validAngle);
        document.getElementById('currentAngle').textContent = `${validAngle}°`;
        document.getElementById('modeDisplay').textContent = `手动设置：${validAngle}°`;
        document.getElementById('modeDisplay').style.color = '#007AFF';
        showToast(`朝向已设置为 ${validAngle}°`);
    }

    function updateCompassNeedle(azimuth) {
        const needle = document.getElementById('compassNeedle');
        if (needle && azimuth !== null && azimuth !== undefined) {
            // 🧭 核心修正：红色指针始终指北！
            // azimuth 是设备顶部朝向的角度（例如 90°= 朝东）
            // 要让指针指北，需要反向旋转：pointerAngle = (360 - azimuth) % 360
            // 例子：设备朝东 (90°) → 北在左边 → 指针应转到 270°
            const pointerAngle = (360 - azimuth) % 360;
            
            // transform 顺序：先 translate(-50%, -50%) 居中，再 rotate 旋转
            needle.style.transform = `translate(-50%, -50%) rotate(${pointerAngle}deg)`;
        }
    }

    // ===== 阳台配置模块（增强版）=====
    function setupBalconyConfig() {
        const obstructionSection = document.getElementById('obstructionSection');
        
        // 阳台类型切换
        const balconyRadios = document.querySelectorAll('input[name="balconyType"]');
        balconyRadios.forEach(radio => {
            radio.addEventListener('change', e => {
                AppState.balconyType = e.target.value;
                const typeName = e.target.closest('label').querySelector('strong').textContent;
                
                // 控制遮挡选项的显示/隐藏
                if (e.target.value === 'protruding') {
                    obstructionSection.style.display = 'block';
                    // 凸出式阳台：清空所有遮挡选项，让用户重新选择
                    AppState.obstructions = [];
                    document.querySelectorAll('input[name="obstruction"]').forEach(cb => {
                        cb.checked = false;
                    });
                    showToast(`已选择：${typeName}（请手动设置遮挡）`);
                } else {
                    obstructionSection.style.display = 'none';
                    // 内嵌式阳台默认三向全遮挡（左、右、上）
                    AppState.obstructions = ['left', 'right', 'top'];
                    document.querySelectorAll('input[name="obstruction"]').forEach(cb => {
                        cb.checked = ['left', 'right', 'top'].includes(cb.value);
                    });
                    showToast(`已选择：${typeName}（默认左右上三向遮挡）`);
                }
                
                // 触发遮挡更新以刷新提示
                updateObstructions();
            });
        });

        // 封闭式选项切换
        const enclosedRadios = document.querySelectorAll('input[name="enclosedType"]');
        enclosedRadios.forEach(radio => {
            radio.addEventListener('change', e => {
                AppState.enclosedType = e.target.value;
                const typeName = e.target.closest('label').querySelector('strong').textContent;
                showToast(`已选择：${typeName}`);
            });
        });

        // 遮挡选项（复选框）
        const obstructionCheckboxes = document.querySelectorAll('input[name="obstruction"]');
        obstructionCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', e => {
                updateObstructions();
            });
        });

        // 初始化：凸出式阳台默认显示遮挡选项，内嵌式默认隐藏
        const defaultBalcony = document.querySelector('input[name="balconyType"]:checked');
        if (defaultBalcony) {
            if (defaultBalcony.value === 'protruding') {
                obstructionSection.style.display = 'block';
            } else {
                obstructionSection.style.display = 'none';
            }
        }
    }

    function updateObstructions() {
        const checkedBoxes = document.querySelectorAll('input[name="obstruction"]:checked');
        AppState.obstructions = Array.from(checkedBoxes).map(cb => cb.value);
        
        // 更新动态提示
        const tipElement = document.getElementById('obstructionTip');
        if (tipElement) {
            const tipText = tipElement.querySelector('.tip-text');
            const tipIcon = tipElement.querySelector('.tip-icon');
            
            const count = AppState.obstructions.length;
            if (count === 0) {
                tipIcon.textContent = '✨';
                tipText.textContent = '暂无遮挡，视野开阔，日照最佳！';
                tipElement.style.background = '#f0fdf4';
                tipElement.style.borderColor = '#86efac';
            } else if (count === 1) {
                tipIcon.textContent = '🌤️';
                const obs = AppState.obstructions[0];
                if (obs === 'left') {
                    tipText.textContent = '左侧有遮挡，早晨日照受影响较小';
                } else if (obs === 'right') {
                    tipText.textContent = '右侧有遮挡，傍晚日照受影响较小';
                } else if (obs === 'top') {
                    tipText.textContent = '顶部有遮挡，正午高角度阳光受阻';
                }
                tipElement.style.background = '#fffbe6';
                tipElement.style.borderColor = '#fde047';
            } else if (count === 2) {
                tipIcon.textContent = '⚠️';
                tipText.textContent = '两方向有遮挡，有效采光时段明显减少';
                tipElement.style.background = '#fef3c7';
                tipElement.style.borderColor = '#fbbf24';
            } else {
                tipIcon.textContent = '❗';
                tipText.textContent = '三向全遮，日照严重不足，建议选择其他朝向';
                tipElement.style.background = '#fef2f2';
                tipElement.style.borderColor = '#fca5a5';
            }
        }
        
        console.log(`🏢 遮挡更新：${count}个方向`);
    }

    // ===== 地区选择模块 =====
    // ===== 位置信息模块（重构版 v1.2.0）=====
    function setupLocationModule() {
        // DOM 元素引用
        const modeSwitchBtn = document.getElementById('locationModeSwitch');
        const modeText = document.getElementById('locationModeText');
        const autoPanel = document.getElementById('autoLocationPanel');
        const manualPanel = document.getElementById('manualLocationPanel');
        const manualLatInput = document.getElementById('manualLat');
        const manualLngInput = document.getElementById('manualLng');
        const setCoordsBtn = document.getElementById('setCoordsBtn');
        const citySelectSimple = document.getElementById('citySelectSimple');
        const applyCityBtn = document.getElementById('applyCityBtn');
        const footerCoords = document.getElementById('footerCoordinates');
        const footerCity = document.getElementById('footerCityName');

        if (!modeSwitchBtn || !autoPanel || !manualPanel) {
            console.warn('位置模块部分元素未找到，可能已移除或修改');
            return;
        }

        // 模式切换逻辑
        modeSwitchBtn.addEventListener('click', () => {
            if (AppState.locationMode === 'auto' || AppState.locationMode === null) {
                // 切换到手动模式（包括初始状态）
                AppState.locationMode = 'manual';
                modeText.textContent = '手动定位';
                modeSwitchBtn.classList.add('manual-mode');
                autoPanel.style.display = 'none';
                manualPanel.style.display = 'block';
                showToast('已切换至手动定位模式');
                
                // 懒加载：切换到手动模式时才初始化城市联级菜单
                setTimeout(() => {
                    if (typeof window.initCityCascadeMenu === 'function') {
                        console.log('🏙️ [联级菜单] 开始初始化城市选择器...');
                        window.initCityCascadeMenu();
                    } else {
                        console.warn('⚠️ 未找到 initCityCascadeMenu，联级菜单模块可能未加载');
                    }
                }, 100);
            } else {
                // 切换到自动模式
                AppState.locationMode = 'auto';
                modeText.textContent = '自动定位';
                modeSwitchBtn.classList.remove('manual-mode');
                manualPanel.style.display = 'none';
                autoPanel.style.display = 'block';
                showToast('已切换至自动定位模式');
                // 重新触发 GPS 定位
                triggerGPSLocation();
            }
        });

        // 手动设置坐标按钮
        if (setCoordsBtn) {
            setCoordsBtn.addEventListener('click', () => {
                const lat = parseFloat(manualLatInput?.value);
                const lng = parseFloat(manualLngInput?.value);

                if (isNaN(lat) || isNaN(lng)) {
                    showToast('请输入有效的经纬度');
                    return;
                }

                if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    showToast('纬度范围：-90~90, 经度范围：-180~180');
                    return;
                }

                // 更新状态
                AppState.latitude = lat;
                AppState.longitude = lng;

                // 更新 UI 显示
                updateLocationDisplay(lat, lng, '手动输入坐标');
                updateFooterInfo(lat, lng, '手动输入坐标');

                // 尝试反向地理编码获取城市名
                reverseGeocode(lat, lng).then(cityName => {
                    if (cityName) {
                        AppState.cityName = cityName;
                        document.getElementById('footerCityName').textContent = cityName;
                    }
                }).catch(() => {});

                showToast('坐标已设置');
            });
        }

        // 应用城市选择（已移除：联级菜单会自动保存）
        if (applyCityBtn && citySelectSimple) {
            // TODO: 已迁移到 cities-cascade.js 模块，不再使用老式单选框
            console.log('🏙️ [位置模块] 使用新的联级菜单系统');
        }
    }

    // 触发 GPS 定位
    function triggerGPSLocation() {
        // ✅ 重要修复：只在自动模式下执行 GPS 定位
        if (AppState.locationMode !== 'auto') {
            console.log('⏸️ [GPS] 当前不是自动模式，跳过 GPS 定位');
            return;
        }
        
        if (!navigator.geolocation) {
            showToast('此浏览器不支持地理定位');
            return;
        }

        const gpsIndicator = document.getElementById('gpsIndicator');
        const dot = gpsIndicator?.querySelector('.indicator-dot');
        const text = gpsIndicator?.querySelector('.indicator-text');
        
        if (dot) dot.className = 'indicator-dot loading';
        if (text) text.textContent = 'GPS: 定位中...';

        navigator.geolocation.getCurrentPosition(
            pos => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                
                // ✅ 只在自动模式下才覆盖 AppState 坐标
                if (AppState.locationMode === 'auto') {
                    AppState.latitude = lat;
                    AppState.longitude = lng;
                    
                    updateLocationDisplay(lat, lng, 'GPS: 定位成功');
                } else {
                    console.log('⚠️ [GPS] 定位成功但处于手动模式，不覆盖已选坐标');
                }
                
                if (dot) dot.className = 'indicator-dot active';
                if (text) text.textContent = 'GPS: 定位成功';

                // 更新底部信息，但不再尝试获取城市名称（显示"当前位置"）
                updateFooterInfo(lat, lng, null);
            },
            err => {
                console.log('定位失败:', err.message);
                
                if (dot) dot.className = 'indicator-dot inactive';
                if (text) text.textContent = 'GPS: 定位失败';
                document.getElementById('currentAddress').textContent = '定位失败，请手动设置';
                
                if (footerCityEl) footerCityEl.textContent = '未确定';
                
                showToast('GPS 定位失败，请手动选择地区', 3000);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    // 反向地理编码（使用 IP 查询 API）
    async function reverseGeocode(lat, lng) {
        try {
            // 使用 ipapi.co API (更准确，支持反向地理编码)
            const resp = await fetch(`https://ipapi.co/${lat},${lng}/json/`);
            if (!resp.ok) throw new Error('API 错误');
            
            const data = await resp.json();
            
            // 构建地址字符串
            let address = '';
            if (data.city) address += data.city;
            if (data.region) address += `, ${data.region}`;
            if (data.country_code === 'CN') {
                if (address) address += ', 中国';
                else address = '中国';
            } else if (data.country_name) {
                if (address) address += `, ${data.country_name}`;
                else address = data.country_name;
            }
            
            return address || null;
        } catch (e) {
            console.log('反向地理编码失败:', e);
            
            // 降级方案：使用 ip.sb
            try {
                const resp = await fetch('https://api.ip.sb/geocoding');
                const data = await resp.json();
                const addrText = data.city ? `${data.city}${data.region ? ', ' + data.region : ''}` : null;
                return addrText || null;
            } catch (e2) {
                console.log('降级 API 也失败了');
                return null;
            }
        }
    }

    // 更新位置显示
    function updateLocationDisplay(lat, lng, address) {
        document.getElementById('latitudeValue').textContent = lat.toFixed(6);
        document.getElementById('longitudeValue').textContent = lng.toFixed(6);
        document.getElementById('currentAddress').textContent = address;
        updateFooterInfo(lat, lng, address);
    }

    // 更新底部信息栏
    function updateFooterInfo(lat, lng, cityName) {
        const coordsEl = document.getElementById('footerCoordinates');
        const cityEl = document.getElementById('footerCityName');
        
        if (coordsEl && typeof lat === 'number' && typeof lng === 'number') {
            coordsEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
        
        if (cityEl) {
            // 如果是自动定位模式且没有明确的城市名，显示"当前位置"
            if (AppState.locationMode === 'auto' && !cityName) {
                cityEl.textContent = '当前位置';
            } else {
                cityEl.textContent = cityName || '未确定';
            }
        }
    }

    // ===== 分析结果模块 =====
    function setupAnalysisButton() {
        const btn = document.getElementById('analyzeBtn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            performSunlightAnalysis();
        });
    }

    function performSunlightAnalysis() {
        // ✅ 必须设置阳台朝向才能开始分析
        if (AppState.currentAzimuth === null || AppState.currentAzimuth === undefined) {
            showToast('❌ 请先设置阳台朝向！');
            return;
        }

        showLoading(true);

        // ✅ 验证坐标必须已设置
        if (!AppState.latitude || !AppState.longitude) {
            console.error('[Sunlight] ⚠️ 位置信息未设置！');
            showLoading(false);
            showToast('❌ 请先设置您的位置信息（经纬度）');
            return;
        }

        // ✅ 调试日志：输出当前使用的坐标
        console.log(`📍 [分析开始] 当前 AppState: lat=${AppState.latitude}, lng=${AppState.longitude}`);
        
        const lat = parseFloat(AppState.latitude);
        const lng = parseFloat(AppState.longitude);
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        console.log('[Sunlight] 创建 Worker 进行精确计算...');
        
        // 准备计算参数 (与 test_worker.html 完全一致)
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
            timezone: 8  // 中国标准时间 UTC+8
        };
        
        console.log('[Sunlight] 计算参数:', params);
        
        // ✅ 修复超时逻辑：添加 workerCompleted 标志 + 更强的错误恢复
        let workerCompleted = false;
        const timeoutId = setTimeout(() => {
            if (!workerCompleted) {
                console.error('[Sunlight] ⚠️ Worker 超时保护触发！');
                workerCompleted = true;
                try {
                    worker.terminate();
                } catch(e) {
                    console.error('终止 Worker 失败:', e);
                }
                showLoading(false);
                showToast('计算超时，请重试');
            }
        }, 15000);
        
        // 创建 Worker (使用版本号避免缓存)
        const worker = new Worker('data/solar_worker.js?v=' + Date.now());
        
        // 消息处理
        worker.onmessage = function(e) {
            console.log('[Sunlight] 📨 Worker 返回消息:', e.data);
            
            if (workerCompleted) {
                console.warn('[Sunlight] 忽略延迟的消息（已超时）');
                return;
            }
            
            clearTimeout(timeoutId);
            
            const data = e.data;
            
            if (data.success) {
                workerCompleted = true;
                
                const result = data.data;
                console.log('[Sunlight] 计算成功:', result);
                
                // 获取阳台类型显示文本
                const balconyRadio = document.querySelector('input[name="balconyType"]:checked');
                const balconyTypeName = balconyRadio?.closest('label')?.querySelector('strong')?.textContent || '凸出式阳台';
                
                // 获取封闭式状态显示文本
                const enclosedRadio = document.querySelector('input[name="enclosedType"]:checked');
                const enclosedTypeName = enclosedRadio?.closest('label')?.querySelector('strong')?.textContent || '开放式';
                
                // 获取遮挡信息
                let obstructionText = '无';
                if (AppState.balconyType === 'protruding' && AppState.obstructions.length > 0) {
                    const obsLabels = AppState.obstructions.map(obs => {
                        return obs === 'left' ? '左' : obs === 'right' ? '右' : '上';
                    });
                    obstructionText = `${obsLabels.join(',')}侧`;
                }
                
                // 更新结果显示 - 传递 periods 和 enclosedType 用于科学评分
                updateAnalysisResults({
                    direction: `${getCardinalDirection(AppState.currentAzimuth)} (${Math.round(AppState.currentAzimuth)}°)`,
                    duration: formatDuration(result.durationHours * 60),
                    sunrise: result.sunrise,
                    sunset: result.sunset,
                    solarNoon: result.solarNoon || '--:--',
                    balconyType: balconyTypeName,
                    enclosedType: AppState.enclosedType,         // ✅ 新增：实际封闭类型
                    enclosedTypeName: enclosedTypeName,         // 显示用名称
                    obstructions: obstructionText,
                    latitude: lat,
                    longitude: lng,
                    effectiveHours: result.durationHours,
                    dayLengthMinutes: result.dayLengthMinutes || (result.durationHours * 60),
                    periods: result.periods || []  // 时段列表供科学选择
                });
                
                // 关闭 Worker
                worker.terminate();
                setTimeout(() => showLoading(false), 800);
            } else {
                workerCompleted = true;  // ✅ 即使失败也要标记完成
                
                console.error('[Sunlight] 计算失败:', data.error);
                showToast('计算出错：' + data.error);
                worker.terminate();
                setTimeout(() => showLoading(false), 500);
            }
        };
        
        // 错误处理
        worker.onerror = function(e) {
            workerCompleted = true;  // ✅ 即使错误也要标记完成
            
            console.error('[Sunlight] Worker 错误:', e);
            showToast('计算引擎错误');
            setTimeout(() => showLoading(false), 500);
        };
        
        // 发送计算请求
        worker.postMessage(params);
    }

    function updateAnalysisResults(data) {
        const resultsContainer = document.getElementById('analysisResults');
        if (!resultsContainer) return;

        // ✅ 添加日期与季节显示
        const today = new Date();
        const dateStr = today.toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        });
        
        // 计算季节（北半球）
        const month = today.getMonth() + 1;
        const day = today.getDate();
        let season = '';
        let seasonEmoji = '';
        
        if (month >= 3 && month <= 5) {
            season = '春季';
            seasonEmoji = '🌸';
        } else if (month >= 6 && month <= 8) {
            season = '夏季';
            seasonEmoji = '☀️';
        } else if (month >= 9 && month <= 11) {
            season = '秋季';
            seasonEmoji = '🍂';
        } else {
            season = '冬季';
            seasonEmoji = '❄️';
        }
        
        // 更新今日光照概览标题，添加日期和季节
        const resultPrimary = document.querySelector('.result-primary h3');
        if (resultPrimary) {
            resultPrimary.innerHTML = `今日光照概览 <span style="font-size: 0.85em; color: #888; font-weight: normal;">${dateStr} ${seasonEmoji}${season}</span>`;
        }

        document.getElementById('resultDirection').textContent = data.direction;
        document.getElementById('resultDuration').textContent = data.duration;
        document.getElementById('resultSunrise').textContent = data.sunrise;
        document.getElementById('resultSunset').textContent = data.sunset;
        document.getElementById('resultSolarNoon').textContent = data.solarNoon || '--:--';
        document.getElementById('detailBalconyType').textContent = data.balconyType;
        // ✅ 使用中文名显示封闭情况
        document.getElementById('detailEnclosedType').textContent = data.enclosedTypeName || data.enclosedType;
        document.getElementById('detailObstructions').textContent = data.obstructions;
        
        // 显示经纬度而非位置名称
        document.getElementById('detailLatitude').textContent = `${data.latitude.toFixed(6)}°`;
        document.getElementById('detailLongitude').textContent = `${data.longitude.toFixed(6)}°`;
        
        // ✅ 科学方案：展示 Worker 计算的所有有效日照时段（多个时段都显示）
        let effectiveTimeText;
        
        if (Array.isArray(data.periods) && data.periods.length > 0) {
            // 拼接所有时段，用换行符分隔（每个时段一行）
            const periodsText = data.periods.map(p => `${p.start} - ${p.end}`).join('\n');
            effectiveTimeText = periodsText;
        } else if ((typeof data.effectiveHours === 'number' && data.effectiveHours <= 0) || !data.effectiveHours) {
            // 没有有效光照
            effectiveTimeText = '无';
        } else {
            // 回退逻辑（理论上不触发，防止数据异常）
            const sunriseStr = data.sunrise;
            const [sunriseH, sunriseM] = sunriseStr.split(':').map(Number);
            const sunriseDecimal = sunriseH + sunriseM / 60;
            const effectiveEndDecimal = sunriseDecimal + parseFloat(data.effectiveHours);
            const effectiveEndStr = formatEndTime(effectiveEndDecimal);
            effectiveTimeText = `${sunriseStr} - ${effectiveEndStr}`;
        }
        
        document.getElementById('detailEffectiveTime').textContent = effectiveTimeText;
        
        // ✅ 光照评分 - 考虑封闭程度影响的科学算法 (依据 GB50033-2013)
        
        // 封闭程度透光率系数 (基于建筑采光设计标准)
        const ENCLOSURE_TRANSMISSION = {
            'open': 1.0,           // 开放式：100% 透光 (基准值)
            'semi-closed': 0.8,    // 半封闭（纱窗/百叶）：80% 透光
            'closed-single': 0.7,  // 单层玻璃封闭：70% 透光
            'closed-double': 0.65, // 双层中空玻璃：65% 透光
            'closed-low-e': 0.55   // Low-E 镀膜玻璃：55% 透光
        };
        
        // 获取当前封闭类型的透光系数
        let transmissionCoeff = 1.0;
        if (data.enclosedType && ENCLOSURE_TRANSMISSION[data.enclosedType]) {
            transmissionCoeff = ENCLOSURE_TRANSMISSION[data.enclosedType];
        } else if (typeof data.enclosedTypeName === 'string') {
            // 兼容字符串类型名称
            if (data.enclosedTypeName.includes('开放')) transmissionCoeff = 1.0;
            else if (data.enclosedTypeName.includes('半封闭')) transmissionCoeff = 0.8;
            else if (data.enclosedTypeName.includes('双层')) transmissionCoeff = 0.65;
            else if (data.enclosedTypeName.includes('Low-E')) transmissionCoeff = 0.55;
            else transmissionCoeff = 0.7;  // 默认按普通封闭处理
        }
        
        // 计算等效日照时长（真实感受的采光量）
        const actualHours = parseFloat(data.effectiveHours) || 0;
        const effectiveHours = actualHours * transmissionCoeff;
        
        // 根据等效时长评分
        let score = '⭐';
        let desc = '采光不足';
        
        if (effectiveHours >= 7) {
            score = '⭐⭐⭐⭐⭐';
            desc = '采光极佳！🌟';
        } else if (effectiveHours >= 5.5) {
            score = '⭐⭐⭐⭐';
            desc = '采光优秀';
        } else if (effectiveHours >= 4) {
            score = '⭐⭐⭐';
            desc = '采光良好';
        } else if (effectiveHours >= 2.5) {
            score = '⭐⭐';
            desc = '采光一般';
        } else {
            score = '⭐';
            desc = '采光不足';
        }
        
        // 显示评分（包含透明提示）
        document.getElementById('lightScore').innerHTML = 
            `<span style="color:${score.includes('★★★★')?'#FF9500':'inherit'}">${score} ${transmissionCoeff < 1 ? `(×${(transmissionCoeff*100).toFixed(0)}%)` : ''}</span>`;
        document.getElementById('summaryRating').innerHTML = 
            `<span class="rating-stars">${score}</span><span class="rating-text">${desc}</span>`;
        document.getElementById('summaryDesc').textContent = 
            `${desc} (${actualHours.toFixed(1)}h → ${effectiveHours.toFixed(1)}h)`;

        resultsContainer.style.display = 'block';
        
        // ✅ 显示 AI 智能分析助手模块
        const aiSection = document.getElementById('aiAssistantSection');
        if (aiSection) {
            aiSection.style.display = 'block';
        }
        
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function formatEndTime(decimalHour) {
        decimalHour = ((decimalHour % 24) + 24) % 24;  // 处理负数情况
        const h = Math.floor(decimalHour);
        const m = Math.round((decimalHour - h) * 60);
        if (m >= 60) {
            return `${String((h + 1) % 24).padStart(2,'0')}:00`;
        }
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    
    /**
     * 将时间字符串 "HH:MM" 转换为从午夜开始的分钟数
     */
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    function showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.toggle('show', show);
        }
    }

    // ===== 页面初始化 =====
    document.addEventListener('DOMContentLoaded', function() {
        // 初始化指针位置为北 (0 度)
        updateCompassNeedle(0);
        
        checkAndRequestPermissions();
        setupCompassControls();
        setupBalconyConfig();
        setupLocationModule();  // 使用新的位置模块函数
        setupAnalysisButton();
        setupMoreInfoModule();  // ✅ 添加了解更多模块
    });

    // ==================== 全年日照详情功能 ====================
    
    function showMonthDetail() {
        const modal = document.getElementById('monthModal');
        if (!modal) return;
        
        const titleEl = document.getElementById('modalMonthTitle');
        const contentEl = document.getElementById('modalMonthContent');
        
        if (!titleEl || !contentEl) return;
        
        const year = new Date().getFullYear();
        titleEl.textContent = `📅 ${year}年全年日照概览`;
        contentEl.innerHTML = '';
        
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                           '七月', '八月', '九月', '十月', '十一月', '十二月'];
        const colors = {1:'#1565C0',2:'#42A5F5',3:'#F8BBD0',4:'#F06292',5:'#81C784',
                       6:'#4CAF50',7:'#FFC107',8:'#FFF176',9:'#FFD54F',10:'#FF7043',
                       11:'#E64A19',12:'#1976D2'};
        
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin-bottom:20px;';
        
        for (let m = 1; m <= 12; m++) {
            const card = document.createElement('button');
            let season = m>=3&&m<=5?'春季🌸':m>=6&&m<=8?'夏季☀️':m>=9&&m<=11?'秋季🍂':'冬季❄️';
            card.style.cssText = 'width:100%;padding:20px;background-color:'+colors[m]+';color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;';
            card.innerHTML = '<span style="font-size:18px;font-weight:bold;">'+monthNames[m-1]+'</span><span style="font-size:12px;opacity:0.9;">'+season+'</span>';
            card.onclick = () => showMonthDays(m);
            grid.appendChild(card);
        }
        contentEl.appendChild(grid);
        
        const hint = document.createElement('p');
        hint.style.cssText = 'text-align:center;color:#888;font-size:14px;margin-top:20px;';
        hint.textContent = '点击月份查看该月每日详细日照数据';
        contentEl.appendChild(hint);
        
        modal.style.display = 'flex';
    }
    
    function showMonthDays(month) {
        const year = new Date().getFullYear();
        const titleEl = document.getElementById('modalMonthTitle');
        const descEl = document.getElementById('modalMonthDesc');
        const contentEl = document.getElementById('modalMonthContent');
        if (!contentEl) return;
        
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                           '七月', '八月', '九月', '十月', '十一月', '十二月'];
        titleEl.textContent = `📅 ${year}年${monthNames[month-1]}`;
        descEl.textContent = '点击下方日期查看详细日照分析结果';
        
        // ✅ 添加"返回月份选择"按钮
        const backBtn = document.createElement('button');
        backBtn.textContent = '← 返回月份选择';
        backBtn.style.cssText = 'display:inline-block;padding:8px 20px;margin-bottom:15px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;';
        backBtn.onclick = () => showMonthDetail();
        contentEl.innerHTML = '';
        contentEl.appendChild(backBtn);
        
        const daysInMonth = new Date(year, month, 0).getDate();
        const dateGrid = document.createElement('div');
        dateGrid.id = 'dateGrid';
        dateGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(50px,1fr));gap:8px;margin-bottom:20px;';
        
        for (let d = 1; d <= daysInMonth; d++) {
            const btn = document.createElement('button');
            btn.textContent = d;
            btn.style.cssText = 'width:100%;aspect-ratio:1;border:1px solid #ddd;background:#f8f9fa;border-radius:4px;cursor:pointer;';
            btn.onmouseover = () => btn.style.background = '#e9ecef';
            btn.onmouseout = () => btn.style.background = '#f8f9fa';
            btn.onclick = () => calculateDateSunlight(year, month, d);
            dateGrid.appendChild(btn);
        }
        
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'monthResultsContainer';
        resultsContainer.style.cssText = 'margin-bottom:20px;';
        
        const hint = document.createElement('p');
        hint.id = 'monthHint';
        hint.style.cssText = 'text-align:center;color:#888;font-size:14px;margin-top:20px;';
        hint.textContent = '点击上方日期查看详细日照数据';
        
        contentEl.innerHTML = '';
        contentEl.appendChild(dateGrid);
        contentEl.appendChild(resultsContainer);
        contentEl.appendChild(hint);
    }

    // ==================== 全局导出 ====================
    
    // ✅ 导出 AppState 供外部模块访问
    window.AppState = AppState;

    // ✅ 导出 showToast
    window.showToast = showToast;

    // ✅ 导出全年日照相关函数
    window.showMonthDetail = showMonthDetail;
    window.showMonthDays = showMonthDays;
    window.calculateDateSunlight = calculateDateSunlight;
    window.displayDayResult = displayDayResult;
    
    // ✅ 关闭月份模态框函数（带 ESC 键支持）
    window.closeMonthModal = function() {
        const modal = document.getElementById('monthModal');
        if (modal) modal.style.display = 'none';
    };

    // ✅ ESC 键关闭弹窗
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('monthModal');
            if (modal && modal.style.display !== 'none') {
                window.closeMonthModal();
            }
        }
    });

    // ==================== 了解更多模块 ====================
    
    /**
     * 生成完整的阳台分析提示词
     */
    function generateSunlightPrompt() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        // 收集基础数据
        const lat = window.AppState?.latitude || '未设置';
        const lng = window.AppState?.longitude || '未设置';
        const azimuth = window.AppState?.currentAzimuth ?? '未检测';
        const balconyType = window.AppState?.balconyType || '未知';
        const obstructions = window.AppState?.obstructions || [];
        
        // 阳台类型描述
        let balconyDesc = '';
        switch(balconyType) {
            case 'protruding': balconyDesc = '凸阳台（三面采光）'; break;
            case 'recessed': balconyDesc = '凹阳台（单面采光）'; break;
            case 'embedded_left': balconyDesc = 'L型左嵌入阳台'; break;
            case 'embedded_right': balconyDesc = 'L型右嵌入阳台'; break;
            default: balconyDesc = '普通阳台';
        }
        
        // 遮挡描述
        let obstructionText = '无明显遮挡';
        if (obstructions.length > 0) {
            obstructionText = obstructions.map(o => {
                switch(o) {
                    case 'left': return '左侧有建筑物';
                    case 'right': return '右侧有建筑物';
                    case 'top': return '顶部有雨蓬或屋檐';
                    default: return o;
                }
            }).join('、');
        }
        
        const prompt = `【阳台日照智能分析报告请求】

=== 基础位置信息 ===
📍 经纬度：${lat}°N, ${lng}°E
📅 当前日期：${dateStr}
🧭 阳台朝向：${azimuth}°（${getCompassDirection(azimuth)}）
🏠 阳台类型：${balconyDesc}
🚧 遮挡情况：${obstructionText}

=== 分析任务清单 ===

## 任务 1：今日太阳运动数据（请用表格输出）
请计算并展示以下信息，使用 Markdown 表格格式：

| 时间参数 | 具体数值 | 说明 |
|---------|---------|------|
| 日出时间 | ? | HH:MM 格式 |
| 正午时间 | ? | 太阳最高点 |
| 日落时间 | ? | HH:MM 格式 |
| 总日照时长 | ? | 小时数 |
| 有效采光时段 | ? | 考虑遮挡后的实际可用时间 |

同时提供按小时的太阳高度角变化表：
| 时刻 | 太阳高度角 | 是否可晒太阳 |
|------|----------|-------------|
| 06:00 | ? | 是/否 |
| ... | ... | ... |
| 18:00 | ? | 是/否 |

## 任务 2：全年日照统计预测（请用表格输出）

请提供月度对比表：
| 月份 | 平均日照时长 | 最佳利用天数 | 建议活动 |
|-----|------------|------------|---------|
| 1 月 | ? | ?天 | ? |
| 2 月 | ? | ?天 | ? |
| ... | ... | ... | ... |
| 12 月 | ? | ?天 | ? |

并提供季度总结：
| 季节 | 优势 | 劣势 | 最佳用途 |
|------|-----|------|---------|
| 春季 | ? | ? | ? |
| 夏季 | ? | ? | ? |
| 秋季 | ? | ? | ? |
| 冬季 | ? | ? | ? |

## 任务 3：阳台功能适配建议（请按分类回答）

### 🌱 植物种植推荐
- **强烈推荐的植物**（列出 5-8 种，标注所需日照时长）
- **不推荐的植物**（原因说明）
- **各季节种植时间表**

### 🧺 晾晒衣物分析
| 季节 | 晾衣适宜度 | 最佳时段 | 注意事项 |
|------|-----------|---------|---------|
| 春季 | 高/中/低 | ? | ? |
| 夏季 | 高/中/低 | ? | ? |
| 秋季 | 高/中/低 | ? | ? |
| 冬季 | 高/中/低 | ? | ? |
- 全年可晒被褥天数估算：?天

### ☕ 休闲使用建议
- 最佳休息时段（工作日/周末）
- 舒适度评分（1-10 分）
- 需要避开的时段及原因

### 🔧 改造优化建议
- 低成本改善方案（预算<500 元）
- 中等投入方案（预算 500-3000 元）
- 专业改造方案（预算>3000 元）

## 任务 4：综合评分与结论

请以星级评分形式总结：
| 评估维度 | 评分 | 理由 |
|---------|-----|------|
| 日照充足度 | ⭐⭐⭐⭐⭐ | ? |
| 四季均衡性 | ⭐⭐⭐⭐⭐ | ? |
| 晾晒实用性 | ⭐⭐⭐⭐⭐ | ? |
| 种植适宜度 | ⭐⭐⭐⭐⭐ | ? |
| 休闲舒适度 | ⭐⭐⭐⭐⭐ | ? |
| **综合推荐指数** | ⭐⭐⭐⭐⭐ | ? |

=== 输出要求 ===
- 所有数据和对比必须用表格呈现
- 文字解释要简洁实用
- 结合中国气候特点给出具体建议
- 避免空泛理论，多给可操作性强的建议`;

        return prompt;
    }
    
    /**
     * 获取方位描述
     */
    function getCompassDirection(angle) {
        if (angle === null || angle === undefined) return '未知';
        angle = parseFloat(angle);
        if (isNaN(angle)) return '无效';
        
        const directions = [
            { name: '北', range: [337.5, 22.5] },
            { name: '东北', range: [22.5, 67.5] },
            { name: '东', range: [67.5, 112.5] },
            { name: '东南', range: [112.5, 157.5] },
            { name: '南', range: [157.5, 202.5] },
            { name: '西南', range: [202.5, 247.5] },
            { name: '西', range: [247.5, 292.5] },
            { name: '西北', range: [292.5, 337.5] }
        ];
        
        for (const dir of directions) {
            const [min, max] = dir.range;
            if ((angle >= min && angle <= max) || 
                (min > max && (angle >= min || angle <= max))) {
                return dir.name;
            }
        }
        return '北';
    }
    
    /**
     * 复制提示词到剪贴板
     */
    async function copyPromptToClipboard() {
        const prompt = generateSunlightPrompt();
        try {
            await navigator.clipboard.writeText(prompt);
            showToast('✅ 提示词已复制到剪贴板！');
            return true;
        } catch (err) {
            console.error('复制失败:', err);
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = prompt;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast('✅ 提示词已复制到剪贴板！');
                return true;
            } catch (e) {
                showToast('❌ 复制失败，请手动复制');
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }
    
    /**
     * 打开 AI 平台（根据设备类型选择网页或 APP）
     */
    window.openAIPlatform = async function(platform) {
        // 先复制提示词
        const success = await copyPromptToClipboard();
        if (!success) {
            setTimeout(() => openPlatformLink(platform), 1000);
            return;
        }
        
        // 延迟打开链接，让用户看到复制成功的提示
        setTimeout(() => openPlatformLink(platform), 800);
    };
    
    /**
     * 根据平台打开对应链接
     */
    function openPlatformLink(platform) {
        const ua = navigator.userAgent.toLowerCase();
        const isMobile = /android|iphone|ipad|mobile/.test(ua);
        
        let url = '';
        let appScheme = '';
        
        switch(platform) {
            case 'deepseek':
                url = 'https://chat.deepseek.com/';
                appScheme = 'deepseek://';
                break;
            case 'qwen':
                url = 'https://tongyi.aliyun.com/qianwen/';
                appScheme = 'tongyi://';
                break;
            case 'doubao':
                url = 'https://www.doubao.com/chat/';
                appScheme = 'doubao://';
                break;
        }
        
        if (isMobile) {
            // 尝试打开 APP，失败则打开网页
            window.location.href = appScheme;
            setTimeout(() => {
                // 如果没打开 APP，跳转到网页
                if (document.hidden) {
                    window.location.href = url;
                }
            }, 500);
        } else {
            // 电脑版直接打开网页
            window.open(url, '_blank');
        }
    }
    
    /**
     * 初始化 AI 助手模块
     */
    function setupMoreInfoModule() {
        const copyBtn = document.getElementById('copyPromptBtn');
        
        if (copyBtn) {
            copyBtn.onclick = copyPromptToClipboard;
        }
    }

})(); 
