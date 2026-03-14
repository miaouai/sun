// ==================== 日照计算核心模块 - Sun Calculations v5.0 (Strict Formula) ====================
// 严格按建筑日照模拟软件（Ecotect）公式集编写
// 无外部依赖，纯原生 Math 对象

window.SunCalculations = (function() {
    'use strict';

    const BUILDING_PARAMS = {
        floorHeight: 2.9,        // 标准层高 (米)
        windowSillHeight: 0.9,   // 窗台高度 (米)
        overhangDepth: 1.2,      // 雨蓬出挑深度 (米)
        glassTransmittance: {
            open: 0.9,
            'semi-closed': 0.7,
            closed: 0.5
        }
    };

    // ===== 单位转换工具 =====
    function toRad(deg) { return deg * Math.PI / 180; }
    function toDeg(rad) { return rad * 180 / Math.PI; }

    // ===== Step 1: 基础天文参数计算 =====
    
    // 1. 积日 N (一年中的第几天，1 月 1 日为 1)
    function getDayOfYear(dateStr) {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        // 简单计算：前几个月天数累加
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let sum = day;
        for (let i = 0; i < month - 1; i++) {
            sum += daysInMonth[i];
        }
        // 闰年处理
        if (month > 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
            sum += 1;
        }
        return sum;
    }
    
    // 2. 太阳赤纬角 delta (弧度)
    // 公式：delta = 23.45 * PI/180 * sin(2*PI/365 * (284 + N))
    function calculateDeclination(dayOfYear) {
        const N = dayOfYear;
        const deltaDeg = 23.45 * Math.sin(2 * Math.PI / 365 * (284 + N));
        return toRad(deltaDeg);
    }
    
    // 3. 日落时角 Hs (弧度)
    // 公式：cos(Hs) = -tan(latRad) * tan(delta)
    function calculateSunsetHourAngle(lat, delta) {
        const latRad = toRad(lat);
        
        let cosHs = -Math.tan(latRad) * Math.tan(delta);
        
        // 限制在 [-1, 1] 之间，防止极昼极夜导致 acos 错误
        if (cosHs < -1) cosHs = -1;
        if (cosHs > 1) cosHs = 1;
        
        const Hs = Math.acos(cosHs);
        
        return {
            Hs: Hs,                          // 日落时角 (弧度)
            polarNight: cosHs < -1,          // 极夜
            polarDay: cosHs > 1              // 极昼
        };
    }

    // ===== Step 2: 时间循环与太阳位置计算 =====
    
    function formatTimeFromHourAngle(hourAngleRad) {
        // 时角 t (度) 转时间：Time = 12 + t / 15
        const hourAngleDeg = toDeg(hourAngleRad);
        const localSolarTime = 12 + hourAngleDeg / 15;
        
        let h = Math.floor(localSolarTime);
        let m = Math.round((localSolarTime - h) * 60);
        
        if (m >= 60) { m = 0; h++; }
        if (h >= 24) h -= 24;
        if (h < 0) h += 24;
        
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function calculateSunlight(params) {
        const {
            lat, 
            lon, 
            dateStr, 
            azimuth, 
            hasLeftWall,
            hasRightWall,
            hasRoof,
            roofDepth,
            windowHeight,
            timeStep
        } = params;
        
        console.log('[SunCalc Strict] 开始计算:', { lat, lon, dateStr, azimuth });
        
        // ===== Step 1: 基础天文参数 =====
        const N = getDayOfYear(dateStr);
        const delta = calculateDeclination(N);
        const latRad = toRad(lat);
        const sunAngle = calculateSunsetHourAngle(lat, delta);
        
        if (sunAngle.polarNight) {
            return {
                durationHours: 0,
                sunrise: 'N/A',
                sunset: 'N/A',
                periods: [],
                note: '极夜'
            };
        }
        
        const Hs = sunAngle.Hs;
        const theoreticalDuration = 2 * Hs / toRad(15) * 60;  // 理论白昼时长 (分钟)
        
        // 经度修正：中国标准时间基于 120°E
        const lngCorrection = (lon - 120) / 15 * 60;  // 分钟
        
        // 日出日落时间 (本地时间)
        // 正午时刻：真太阳时 12 点
        // 日出时角 = -Hs, 日落时角 = +Hs
        const sunriseLocalTime = 12 - toDeg(Hs) / 15 - lngCorrection / 60;
        const sunsetLocalTime = 12 + toDeg(Hs) / 15 - lngCorrection / 60;
        
        const sunriseStr = formatTime(sunriseLocalTime);
        const sunsetStr = formatTime(sunsetLocalTime);
        
        console.log(`[SunCalc Strict] 赤纬 δ=${toDeg(delta).toFixed(2)}°, 日落时角 H_s=${toDeg(Hs).toFixed(2)}°`);
        console.log(`[SunCalc Strict] 理论白昼: ${theoreticalDuration.toFixed(1)} 分钟`);
        console.log(`[SunCalc Strict] 日出: ${sunriseStr}, 日落: ${sunsetStr}`);
        
        // ===== Step 2: 时间循环 =====
        let totalSunlightMinutes = 0;
        const effectivePeriods = [];
        
        // 从 -Hs 到 +Hs 循环
        const stepRad = toRad(timeStep / 60 * 15);  // 步长对应的时角弧度
        let t = -Hs;
        
        let currentPeriodStart = null;
        let periodPoints = [];
        
        while (t <= Hs) {
            // A. 计算太阳高度角 hs (弧度)
            const sinHs = Math.sin(latRad) * Math.sin(delta) + 
                         Math.cos(latRad) * Math.cos(delta) * Math.cos(t);
            
            // 防止超出范围
            let clampedSinHs = Math.max(-1, Math.min(1, sinHs));
            const hs = Math.asin(clampedSinHs);
            
            // 判断：如果 hs <= 0，跳过 (夜晚)
            if (hs <= 0) {
                t += stepRad;
                continue;
            }
            
            // B. 计算太阳方位角 As (角度 0-360, 北=0)
            const cosAs = (Math.sin(hs) * Math.sin(latRad) - Math.sin(delta)) / 
                         (Math.cos(hs) * Math.cos(latRad));
            
            // 限制在 [-1, 1]
            let clampedCosAs = Math.max(-1, Math.min(1, cosAs));
            const angleTemp = Math.acos(clampedCosAs) * 180 / Math.PI;
            
            let As;
            if (t < 0) {
                // 上午：太阳在东半部
                As = 360 - angleTemp;
            } else {
                // 下午：太阳在西半部
                As = angleTemp;
            }
            
            // C. 几何遮挡判定
            
            // 1. 相对方位角 diff (归一化到 -180 ~ 180)
            let diff = As - azimuth;
            while (diff <= -180) diff += 360;
            while (diff > 180) diff -= 360;
            
            // 2. 水平遮挡检查
            let passHoriz = true;
            if (hasLeftWall && diff < -85) passHoriz = false;
            if (hasRightWall && diff > 85) passHoriz = false;
            
            // 3. 垂直遮挡检查
            let passVert = true;
            if (hasRoof) {
                if (Math.abs(diff) >= 90) {
                    // 侧面完全挡死
                    passVert = false;
                } else {
                    // 动态临界角：当太阳从侧面斜射时 (|diff|大)，cos(diff) 变小，有效宽度变大
                    // limitAngle = arctan(roofDepth / (windowHeight * |cos(diff)|))
                    const cosDiff = Math.cos(toRad(diff));
                    if (Math.abs(cosDiff) < 0.01) {
                        // 接近 90°侧射，挡死
                        passVert = false;
                    } else {
                        const effectiveWidth = roofDepth / Math.abs(cosDiff);
                        const limitAngleRad = Math.atan(effectiveWidth / windowHeight);
                        const limitAngleDeg = toDeg(limitAngleRad);
                        
                        // 太阳高度角 < 临界角才能照进来
                        const hsDeg = toDeg(hs);
                        passVert = hsDeg < limitAngleDeg;
                    }
                }
            }
            
            // 4. 最终判定
            if (passHoriz && passVert) {
                totalSunlightMinutes += timeStep;
                
                const currentTimeStr = formatTimeFromHourAngle(t);
                periodPoints.push({
                    time: currentTimeStr,
                    altitude: toDeg(hs),
                    azimuth: Math.round(As),
                    diff: Math.round(diff * 10) / 10,
                    timestamp: Date.now()
                });
            }
            
            t += stepRad;
        }
        
        // 合并连续时间段
        mergePeriods(periodPoints);
        
        console.log(`[SunCalc Strict] 有效日照: ${totalSunlightMinutes} 分钟 (${(totalSunlightMinutes/60).toFixed(2)} 小时)`);
        console.log(`[SunCalc Strict] 日照率: ${(totalSunlightMinutes/theoreticalDuration*100).toFixed(1)}%`);
        console.log(`[SunCalc Strict] 采样点数量：${periodPoints.length}`);
        
        return {
            durationHours: parseFloat((totalSunlightMinutes / 60).toFixed(2)),
            sunrise: sunriseStr,
            sunset: sunsetStr,
            periods: effectivePeriods,
            samplePoints: periodPoints.slice(0, 5),
            note: null
        };
    }
    
    // 合并连续时间段
    function mergePeriods(points) {
        if (points.length === 0) return;
        
        // 按时间排序
        points.sort((a, b) => a.timestamp - b.timestamp);
        
        let currentStart = points[0].time;
        let currentEnd = points[0].time;
        
        for (let i = 1; i < points.length; i++) {
            // 检查是否连续 (5 分钟步长)
            const prev = points[i-1];
            const curr = points[i];
            
            const prevHour = parseInt(prev.time.split(':')[0]);
            const prevMin = parseInt(prev.time.split(':')[1]);
            const currHour = parseInt(curr.time.split(':')[0]);
            const currMin = parseInt(curr.time.split(':')[1]);
            
            const prevTotalMin = prevHour * 60 + prevMin;
            const currTotalMin = currHour * 60 + currMin;
            
            if (currTotalMin - prevTotalMin <= 10) {
                // 连续或间隔很小，扩展当前段
                currentEnd = curr.time;
            } else {
                // 不连续，保存当前段并开启新段
                if (currentStart === currentEnd) {
                    window.SunCalculations.effectivePeriods.push(currentStart);
                } else {
                    window.SunCalculations.effectivePeriods.push(`${currentStart}-${currentEnd}`);
                }
                currentStart = curr.time;
                currentEnd = curr.time;
            }
        }
        
        // 添加最后一段
        if (currentStart === currentEnd) {
            window.SunCalculations.effectivePeriods.push(currentStart);
        } else {
            window.SunCalculations.effectivePeriods.push(`${currentStart}-${currentEnd}`);
        }
    }
    
    // 辅助函数
    function formatTime(hours) {
        let h = Math.floor(hours);
        let m = Math.round((hours - h) * 60);
        
        if (m >= 60) { m = 0; h++; }
        if (h >= 24) h -= 24;
        if (h < 0) h += 24;
        
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // ===== Step 3: 输出结果 =====
    // 已整合到 calculateSunlight 函数
    
    // 导出公共 API
    return {
        calculate: calculateSunlight,
        getBuildingParams: () => BUILDING_PARAMS,
        // 用于调试的工具变量
        effectivePeriods: []
    };
})();

console.log('[SunCalculations v5.0 Strict] 公式严格版已加载');
