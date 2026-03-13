// ==================== location.js - 位置信息模块（重构版 v2.0）====================

import { showToast } from './utils.js';

export function setupLocationModule() {
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

    if (!modeSwitchBtn || !autoPanel || !manualPanel) {
        console.warn('⚠️ 位置模块部分元素未找到');
        return;
    }

    // 模式切换逻辑
    modeSwitchBtn.addEventListener('click', () => {
        if (window.AppState.locationMode === 'auto') {
            // 切换到手动模式
            window.AppState.locationMode = 'manual';
            modeText.textContent = '手动定位';
            modeSwitchBtn.classList.add('manual-mode');
            autoPanel.style.display = 'none';
            manualPanel.style.display = 'block';
            showToast('已切换至手动定位模式');
        } else {
            // 切换到自动模式
            window.AppState.locationMode = 'auto';
            modeText.textContent = '自动定位';
            modeSwitchBtn.classList.remove('manual-mode');
            manualPanel.style.display = 'none';
            autoPanel.style.display = 'block';
            showToast('已切换至自动定位模式');
            triggerGPSLocation();
        }
    });

    // 手动设置坐标按钮
    if (setCoordsBtn && manualLatInput && manualLngInput) {
        setCoordsBtn.addEventListener('click', () => {
            const lat = parseFloat(manualLatInput.value);
            const lng = parseFloat(manualLngInput.value);

            if (isNaN(lat) || isNaN(lng)) {
                showToast('请输入有效的经纬度');
                return;
            }

            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                showToast('纬度范围：-90~90, 经度范围：-180~180');
                return;
            }

            // 更新状态
            window.AppState.latitude = lat;
            window.AppState.longitude = lng;
            window.AppState.locationMode = 'manual';

            // 更新 UI 显示
            updateLocationDisplay(lat, lng, '手动输入坐标');
            updateFooterInfo(lat, lng, '手动输入');

            // 尝试反向地理编码获取城市名
            reverseGeocode(lat, lng).then(cityName => {
                if (cityName) {
                    window.AppState.cityName = cityName;
                    const footerCity = document.getElementById('footerCityName');
                    if (footerCity) footerCity.textContent = cityName;
                }
            }).catch(() => {});

            showToast('坐标已设置');
        });
    }

    // 应用城市选择
    if (applyCityBtn && citySelectSimple) {
        applyCityBtn.addEventListener('click', () => {
            const selectedValue = citySelectSimple.value;
            
            if (!selectedValue) {
                showToast('请先选择一个城市');
                return;
            }

            // 解析经纬度 (格式：lng,lat)
            const coords = selectedValue.split(',').map(parseFloat);
            const lng = coords[0];
            const lat = coords[1];
            
            if (isNaN(lat) || isNaN(lng)) {
                showToast('城市数据异常');
                return;
            }

            // 更新状态
            window.AppState.latitude = lat;
            window.AppState.longitude = lng;
            window.AppState.locationMode = 'manual';

            // 获取城市名称
            const cityName = citySelectSimple.options[citySelectSimple.selectedIndex].text.trim();
            window.AppState.cityName = cityName;

            // 更新 UI 显示
            updateLocationDisplay(lat, lng, cityName);
            updateFooterInfo(lat, lng, cityName);

            showToast(`已设置为 ${cityName}`);
        });
    }
}

// 触发 GPS 定位
export function triggerGPSLocation() {
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
            
            window.AppState.latitude = lat;
            window.AppState.longitude = lng;
            
            updateLocationDisplay(lat, lng, 'GPS 定位成功');
            
            if (dot) dot.className = 'indicator-dot active';
            if (text) text.textContent = 'GPS: 定位成功';

            // 更新底部信息
            updateFooterInfo(lat, lng, null);
        },
        err => {
            console.log('❌ 定位失败:', err.message);
            
            if (dot) dot.className = 'indicator-dot inactive';
            if (text) text.textContent = 'GPS: 定位失败';
            
            const addressEl = document.getElementById('currentAddress');
            if (addressEl) addressEl.textContent = '定位失败，请手动设置';
            
            const footerCity = document.getElementById('footerCityName');
            if (footerCity) footerCity.textContent = '未确定';
            
            showToast('GPS 定位失败，请手动选择地区', 3000);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// 反向地理编码（使用 IP 查询 API）
async function reverseGeocode(lat, lng) {
    try {
        const resp = await fetch(`https://ipapi.co/${lat},${lng}/json/`);
        if (!resp.ok) throw new Error('API 错误');
        
        const data = await resp.json();
        
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
        console.log('⚠️ 反向地理编码失败:', e);
        
        try {
            const resp = await fetch('https://api.ip.sb/geocoding');
            const data = await resp.json();
            const addrText = data.city ? `${data.city}${data.region ? ', ' + data.region : ''}` : null;
            return addrText || null;
        } catch (e2) {
            console.log('⚠️ 降级 API 也失败了');
            return null;
        }
    }
}

// 更新位置显示（自动模式面板）
function updateLocationDisplay(lat, lng, address) {
    const latEl = document.getElementById('latitudeValue');
    const lngEl = document.getElementById('longitudeValue');
    const addrEl = document.getElementById('currentAddress');
    
    if (latEl) latEl.textContent = lat.toFixed(6);
    if (lngEl) lngEl.textContent = lng.toFixed(6);
    if (addrEl) addrEl.textContent = address;
    
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
        if (window.AppState.locationMode === 'auto' && !cityName) {
            cityEl.textContent = '当前位置';
        } else {
            cityEl.textContent = cityName || window.AppState.cityName || '未确定';
        }
    }
}
