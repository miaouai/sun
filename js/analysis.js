// ==================== analysis.js - 日照分析模块 ====================

import { getCardinalDirection, formatDuration, formatEndTime, showToast } from './utils.js';

export function setupAnalysisButton() {
    const btn = document.getElementById('analyzeBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        performSunlightAnalysis();
    });
}

function performSunlightAnalysis() {
    // 验证必要数据
    if (window.AppState.currentAzimuth === null || window.AppState.currentAzimuth === undefined) {
        showToast('请先设置阳台朝向');
        return;
    }

    showLoading(true);

    // 计算日照数据
    const lat = window.AppState.latitude || 39.9;
    const lng = window.AppState.longitude || 116.4;
    const sunData = calculateSunTimes(lat, lng, new Date());

    // 获取阳台类型显示文本
    const balconyRadio = document.querySelector('input[name="balconyType"]:checked');
    const balconyTypeName = balconyRadio?.closest('label')?.querySelector('strong')?.textContent || '凸出式阳台';
    
    // 获取封闭式状态显示文本
    const enclosedRadio = document.querySelector('input[name="enclosedType"]:checked');
    const enclosedTypeName = enclosedRadio?.closest('label')?.querySelector('strong')?.textContent || '开放式';
    
    // 获取遮挡信息
    let obstructionText = '无';
    if (window.AppState.balconyType === 'protruding' && window.AppState.obstructions.length > 0) {
        const obsLabels = window.AppState.obstructions.map(obs => {
            return obs === 'left' ? '左' : obs === 'right' ? '右' : '上';
        });
        obstructionText = `${obsLabels.join(',')}侧`;
    }

    // 更新结果显示
    updateAnalysisResults({
        direction: `${getCardinalDirection(window.AppState.currentAzimuth)} (${Math.round(window.AppState.currentAzimuth)}°)`,
        duration: formatDuration(sunData.dayLength),
        sunrise: sunData.sunrise,
        sunset: sunData.sunset,
        balconyType: balconyTypeName,
        enclosedType: enclosedTypeName,
        obstructions: obstructionText,
        location: `${window.AppState.cityName || '未定位'}`,
        dayLengthMinutes: sunData.dayLength
    });

    setTimeout(() => showLoading(false), 800);
}

function updateAnalysisResults(data) {
    const resultsContainer = document.getElementById('analysisResults');
    if (!resultsContainer) return;

    document.getElementById('resultDirection').textContent = data.direction;
    document.getElementById('resultDuration').textContent = data.duration;
    document.getElementById('resultSunrise').textContent = data.sunrise;
    document.getElementById('resultSunset').textContent = data.sunset;
    document.getElementById('detailBalconyType').textContent = data.balconyType;
    document.getElementById('detailEnclosedType').textContent = data.enclosedType;
    document.getElementById('detailObstructions').textContent = data.obstructions;
    document.getElementById('detailLocation').textContent = data.location;
    
    // 计算有效采光时段
    const effectiveHours = Math.max(0, data.dayLengthMinutes * getEffectiveFactor()) / 60;
    const effectiveStart = parseFloat(data.sunrise);
    const effectiveEnd = effectiveStart + effectiveHours;
    document.getElementById('detailEffectiveTime').textContent = 
        `${data.sunrise} - ${formatEndTime(effectiveEnd)}`;
    
    // 光照评分
    let score = '⭐⭐⭐';
    let desc = '采光良好';
    if (data.dayLengthMinutes > 540) { score = '⭐⭐⭐⭐⭐'; desc = '采光极佳！'; }
    else if (data.dayLengthMinutes > 420) { score = '⭐⭐⭐⭐'; desc = '采光优秀'; }
    else if (data.dayLengthMinutes < 240) { score = '⭐'; desc = '采光不足'; }
    
    document.getElementById('lightScore').innerHTML = `<span style="color:${score.includes('★★★★')?'#FF9500':'inherit'}">${score}</span>`;
    document.getElementById('summaryRating').innerHTML = `<span class="rating-stars">${score}</span><span class="rating-text">${desc}</span>`;
    document.getElementById('summaryDesc').textContent = desc;

    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getEffectiveFactor() {
    const azimuth = window.AppState.currentAzimuth || 0;
    
    // 1. 朝向系数（南向最优，北向最差）
    let orientationFactor = 1;
    if (azimuth >= 315 || azimuth < 45) orientationFactor = 0.7;      // 北
    else if (azimuth >= 45 && azimuth < 135) orientationFactor = 0.9;  // 东
    else if (azimuth >= 135 && azimuth < 225) orientationFactor = 1.1; // 南
    else orientationFactor = 0.95;                                      // 西
    
    // 2. 阳台类型系数
    let typeFactor = window.AppState.balconyType === 'protruding' ? 1.35 : 1.0;
    
    // 3. 封闭性系数
    let enclosedFactor = 1.0;
    switch(window.AppState.enclosedType) {
        case 'open': enclosedFactor = 1.0; break;
        case 'semi-closed': enclosedFactor = 0.92; break;
        case 'closed': enclosedFactor = 0.85; break;
        default: enclosedFactor = 1.0;
    }
    
    // 4. 遮挡系数
    let obstructionFactor = 1.0;
    if (window.AppState.balconyType === 'protruding' && window.AppState.obstructions.length > 0) {
        const obstructionPenalty = 0.12;
        obstructionFactor = Math.max(0.6, 1.0 - (window.AppState.obstructions.length * obstructionPenalty));
        
        if (azimuth >= 45 && azimuth < 135) {
            if (window.AppState.obstructions.includes('left')) obstructionFactor -= 0.08;
        } else if (azimuth >= 225 && azimuth < 315) {
            if (window.AppState.obstructions.includes('right')) obstructionFactor -= 0.08;
        }
    }
    
    const finalFactor = orientationFactor * typeFactor * enclosedFactor * obstructionFactor / 1.1;
    return Math.min(1.2, Math.max(0.5, finalFactor));
}

// 日出日落时间计算
function calculateSunTimes(lat, lng, date) {
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const Dn = Date.UTC(year, month - 1, day, 12, 0, 0) / 86400000 - Date.UTC(1970, 0, 1, 0, 0, 0) / 86400000 - 1;
    
    const delta = -23.44 * Math.sin(rad * (360 / 365 * (Dn - 81)));
    
    const b = rad * 360 / 409 * (Dn - 242);
    const EqTime = -1.25 - 32.19 * Math.cos(b) + 6.23 * Math.sin(b);
    
    const solarNoon = 720 - 4 * lng - EqTime;
    
    const sunRiseSetHourOffset = (2 / 15) * Math.acos(-Math.tan(rad * lat) * Math.tan(delta));
    
    const sunriseMin = solarNoon - sunRiseSetHourOffset * 60;
    const sunsetMin = solarNoon + sunRiseSetHourOffset * 60;
    
    const dayLength = (sunsetMin - sunriseMin);
    
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

function showLoading(show) {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}
