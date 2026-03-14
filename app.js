// ==================== 向日窥 - Sun Peek v1.0.0 ====================
// 阳台光照智能分析应用核心逻辑

(function() {
    'use strict';

    // ===== 全局状态管理 =====
    const AppState = {
        currentAzimuth: null,        // 当前朝向角度 (0-360)
        isAutoDetecting: false,      // 是否正在自动检测
        balconyType: 'protruding',   // 阳台类型：protruding|recessed
        enclosedType: 'open',         // 封闭类型：open|semi-closed|closed
        obstructions: [],            // 遮挡列表：['left', 'right', 'top']
        latitude: null,              // 纬度
        longitude: null,             // 经度
        locationMode: 'auto',        // 位置模式：'auto'|'manual'
        cityName: '',                // 城市名称（显示用）
        manualLat: null,             // 手动选择的纬度
        manualLng: null,             // 手动选择的经度
        lastSelectedCity: '',        // 最后选择的城市
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
            if (AppState.locationMode === 'auto') {
                // 切换到手动模式
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
        // 验证必要数据
        if (AppState.currentAzimuth === null || AppState.currentAzimuth === undefined) {
            showToast('请先设置阳台朝向');
            return;
        }

        showLoading(true);

        // ✅ 调试日志：输出当前使用的坐标
        console.log(`📍 [分析开始] 当前 AppState: lat=${AppState.latitude}, lng=${AppState.longitude}`);
        
        // 使用 Web Worker 进行精确计算
        const lat = AppState.latitude || 39.9;
        const lng = AppState.longitude || 116.4;
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

        document.getElementById('resultDirection').textContent = data.direction;
        document.getElementById('resultDuration').textContent = data.duration;
        document.getElementById('resultSunrise').textContent = data.sunrise;
        document.getElementById('resultSunset').textContent = data.sunset;
        document.getElementById('resultSolarNoon').textContent = data.solarNoon || '--:--';
        document.getElementById('detailBalconyType').textContent = data.balconyType;
        document.getElementById('detailEnclosedType').textContent = data.enclosedType;
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
    });

})();
