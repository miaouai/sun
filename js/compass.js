// ==================== compass.js - 方向检测模块 ====================

import { showToast } from './utils.js';

let orientationHandler = null; // 保存事件处理器引用

export function setupCompassControls() {
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
    const isStarting = !window.AppState.isAutoDetecting;
    window.AppState.isAutoDetecting = isStarting;
    
    if (isStarting) {
        btn.classList.add('active');
        btn.querySelector('.btn-icon').textContent = '⏹️';
        btn.querySelector('.btn-text').textContent = '停止检测';
        document.getElementById('modeDisplay').textContent = '自动检测中...';
        document.getElementById('modeDisplay').style.color = '#34C759';
        
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
        const lastAngle = window.AppState.currentAzimuth !== null ? window.AppState.currentAzimuth : '--';
        document.getElementById('modeDisplay').textContent = `已停止 (${lastAngle}°)`;
        document.getElementById('modeDisplay').style.color = '#FF9500';
        
        stopOrientationListener();
        
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
    
    if (typeof DeviceOrientationEvent === 'undefined') {
        console.warn('⚠️ 浏览器不支持 DeviceOrientationEvent');
        showToast('您的浏览器不支持方向传感器');
        setTimeout(() => {
            const btn = document.getElementById('autoDetectBtn');
            if (btn && window.AppState.isAutoDetecting) toggleAutoDetection(btn);
        }, 2000);
        return;
    }

    orientationHandler = function(event) {
        let azimuth = null;
        
        if (event.webkitCompassHeading !== undefined) {
            azimuth = event.webkitCompassHeading;
            console.log(`[iOS Compass] ${azimuth.toFixed(1)}°`);
        }
        else if (event.alpha !== undefined) {
            azimuth = (360 - event.alpha) % 360;
            if (azimuth < 0) azimuth += 360;
            console.log(`[Android Alpha] ${event.alpha.toFixed(1)}° → ${(azimuth).toFixed(1)}°`);
        }
        
        if (azimuth !== null && typeof azimuth === 'number' && !isNaN(azimuth)) {
            azimuth = Math.round(((azimuth % 360) + 360) % 360);
            
            window.AppState.currentAzimuth = azimuth;
            updateCompassNeedle(azimuth);
            document.getElementById('currentAngle').textContent = `${azimuth}°`;
        }
    };

    requestDevicePermissions().then(granted => {
        if (granted) {
            console.log('✅ 设备权限已授予，开始监听方向数据...');
            registerListeners();
        } else {
            console.warn('⚠️ 用户拒绝设备权限或使用受限模式');
            showToast('需要授权才能使用自动检测');
            console.log('💡 尝试在不请求权限的情况下注册监听器...');
            registerListeners();
        }
    }).catch(err => {
        console.error('❌ 权限处理出错:', err);
        showToast('权限请求失败，请重试');
    });

    async function requestDevicePermissions() {
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
        
        console.log('🤖 检测到 Android 设备，准备申请运动传感器权限...');
        
        if ('permissions' in navigator) {
            try {
                const permissionsStatus = await checkAndroidPermissions();
                if (permissionsStatus) return true;
            } catch (err) {
                console.log('Permissions API 不可用:', err.message);
            }
        }
        
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
            console.log('ℹ️ Android 设备确认，提示用户可能需要授权');
            showAndroidPermissionGuide();
        }
        
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
                    <a href="#" onclick="window.openCompassApp(); return false;" 
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
    
    window.openCompassApp = function() {
        console.log('🧭 尝试打开指南针 App...');
        
        try {
            if (navigator.userAgent.match(/iPhone|iPad/i)) {
                window.location.href = 'x-apple-compass://';
            }
            else if (navigator.userAgent.match(/Android/i)) {
                window.location.href = 'https://play.google.com/store/apps/details?id=com.google.android.apps.maps';
                showToast('如自动跳转失败，请手动打开：设置 > 应用 > 指南针');
            }
        } catch (err) {
            console.warn('自动跳转失败:', err.message);
        }
    };

    function registerListeners() {
        try {
            window.addEventListener('deviceorientation', orientationHandler);
            console.log('✅ deviceorientation 监听器已注册成功');
            
            setTimeout(() => {
                console.log('📡 方向检测已就绪，请在手机上移动设备测试');
                
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

export function stopOrientationListener() {
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

export function setManualDirection(angle) {
    const validAngle = Math.round(parseFloat(angle));
    if (isNaN(validAngle) || validAngle < 0 || validAngle > 360) {
        showToast('无效的角度值');
        return;
    }
    
    window.AppState.currentAzimuth = validAngle;
    updateCompassNeedle(validAngle);
    document.getElementById('currentAngle').textContent = `${validAngle}°`;
    document.getElementById('modeDisplay').textContent = `手动设置：${validAngle}°`;
    document.getElementById('modeDisplay').style.color = '#007AFF';
    showToast(`朝向已设置为 ${validAngle}°`);
}

export function updateCompassNeedle(azimuth) {
    const needle = document.getElementById('compassNeedle');
    if (needle && azimuth !== null && azimuth !== undefined) {
        const pointerAngle = (360 - azimuth) % 360;
        needle.style.transform = `translate(-50%, -50%) rotate(${pointerAngle}deg)`;
    }
}
