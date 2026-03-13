// ==================== main.js - 应用入口 ====================

import { setupCompassControls } from './compass.js';
import { setupBalconyConfig } from './balcony.js';
import { setupLocationModule, triggerGPSLocation } from './location.js';
import { setupAnalysisButton } from './analysis.js';
import { AppState } from './state.js';

// 将 AppState 挂载到 window，方便其他模块访问
window.AppState = AppState;

// 权限检查函数
function checkAndRequestPermissions() {
    const statusEl = document.getElementById('permissionStatus');
    if (!statusEl) return;

    statusEl.innerHTML = '<span class="status-icon">📡</span><span class="status-text">正在检测设备能力...</span>';

    if (typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        statusEl.innerHTML = '<span class="status-icon">✅</span><span class="status-text">已获得全部权限 🧭</span>';
                    } else {
                        statusEl.innerHTML = '<span class="status-icon">⚠️</span><span class="status-text">方向检测权限被拒绝，请使用手动模式</span>';
                    }
                })
                .catch(err => console.log('权限请求错误:', err));
        } else {
            statusEl.innerHTML = '<span class="status-icon">✅</span><span class="status-text">已获得定位和方向权限 🧭</span>';
        }
    } else {
        statusEl.innerHTML = '<span class="status-icon">ℹ️</span><span class="status-text">设备不支持方向传感器，请使用手动输入</span>';
    }

    // 自动定位模式下触发 GPS 定位
    if (window.AppState.locationMode === 'auto') {
        setTimeout(() => triggerGPSLocation(), 500);
    }
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌅 向日窥 App 启动...');
    
    // 初始化各模块
    setupCompassControls();
    setupBalconyConfig();
    setupLocationModule();
    setupAnalysisButton();
    
    // 检查权限
    checkAndRequestPermissions();
    
    console.log('✅ 初始化完成');
});
