/**
 * =============================================================================
 * 阳台日照分析核心引擎 - solar_worker.js
 * =============================================================================
 * 
 * 功能: 基于严格天文公式的太阳位置计算与几何遮挡分析
 * 运行环境: Web Worker (浏览器端)
 * 依赖: 原生 Math 和 Date 对象，零外部依赖
 * 
 * 算法标准: 建筑日照模拟标准公式集 (Ecotect 算法)
 * 精度: 时间计算精确到分钟，角度计算精确到弧度
 * 
 * @author 喵有爱 (miaouai)
 * @version 3.0 - 严格公式版
 * =============================================================================
 */

// 调试日志开关 (生产环境可设为 false)
const DEBUG = true;

/**
 * 日志输出函数
 * @param {...any} args - 要输出的内容
 */
function log(...args) {
    if (DEBUG) {
        console.log('[SolarWorker]', ...args);
    }
}

/**
 * 错误日志输出
 * @param {...any} args - 要输出的错误内容
 */
function errorLog(...args) {
    console.error('[SolarWorker]', ...args);
}

log('初始化中...');

// =============================================================================
// 常量定义
// =============================================================================

/** 角度转弧度系数: π/180 */
const DEG_TO_RAD = Math.PI / 180;

/** 弧度转角度系数: 180/π */
const RAD_TO_DEG = 180 / Math.PI;

/** 地球自转角速度: 15°/小时 = π/12 弧度/小时 */
const EARTH_ROTATION_RATE = 15 * DEG_TO_RAD; // 0.261799... rad/hour

/** 标准子午线经度 (中国使用东经120°) */
const STANDARD_MERIDIAN = 120;

/** 最小太阳高度角阈值 (弧度)，低于此值视为夜晚 */
const MIN_SUN_ALTITUDE = 0;

/** 水平遮挡判定余量 (度)，防止浮点误差 */
const HORIZONTAL_MARGIN = 85;

/** 垂直完全遮挡阈值 (度)，当相对方位角超过此值时视为完全遮挡 */
const VERTICAL_FULL_BLOCK = 90;

// =============================================================================
// NOAA 高精度日出日落计算函数 (内联版本)
// =============================================================================

/**
 * NOAA 算法计算日出日落时间 (v3.0 Universal - 绝对通用版)
 * @param {number} lat - 纬度 (-90 到 90)
 * @param {number} lon - 经度 (-180 到 180)
 * @param {string} dateStr - 日期 (YYYY-MM-DD)
 * @param {number} timezone - 时区偏移 (小时，默认 8 为中国标准时间)
 * @returns {object} {sunrise, sunset, solarNoon, dayLengthMinutes, polarDay, polarNight}
 */
function calculateNOAASunTimes(lat, lon, dateStr, timezone = 8) {
    // ===== 验证输入 =====
    if (lat < -90 || lat > 90) {
        console.error(`纬度无效：${lat}`);
        return { sunrise: null, sunset: null, solarNoon: null, dayLengthMinutes: 0, polarDay: false, polarNight: true };
    }
    if (lon < -180 || lon > 180) {
        console.error(`经度无效：${lon}`);
        return { sunrise: null, sunset: null, solarNoon: null, dayLengthMinutes: 0, polarDay: false, polarNight: true };
    }
    
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Step 1: 儒略日
    let jy = year;
    let jm = month;
    if (jm <= 2) { jy -= 1; jm += 12; }
    const A = Math.floor(jy / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (jy + 4716)) + Math.floor(30.6001 * (jm + 1)) + day + B - 1524.5;
    
    // Step 2: 儒略世纪数
    const T = (JD - 2451545.0) / 36525.0;
    
    // Step 3: 地球轨道偏心率 e
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    
    // Step 4: 太阳平近点角 M (度)
    const M_deg = ((357.52911 + T * (35999.05029 - 0.0001537 * T)) % 360 + 360) % 360;
    const M_rad = M_deg * DEG_TO_RAD;
    
    // Step 5: 方程中心 C (度)
    const C_deg = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(M_rad) +
                  (0.019993 - 0.000101 * T) * Math.sin(2 * M_rad) +
                  0.000289 * Math.sin(3 * M_rad);
    
    // Step 6: 太阳真黄经 L_sun (度)
    const L0_deg = 280.46646 + T * (36000.76983 + 0.0003032 * T);
    const L_sun_deg = ((L0_deg + C_deg) % 360 + 360) % 360;
    const L_sun_rad = L_sun_deg * DEG_TO_RAD;
    
    // Step 7: 视黄道倾角 epsilon (更精确)
    const omega_deg = ((125.04 - 1934.136 * T) % 360 + 360) % 360;
    const epsilon_0_deg = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const epsilon_deg = epsilon_0_deg - 0.00256 * Math.cos(omega_deg * DEG_TO_RAD);
    const epsilon_rad = epsilon_deg * DEG_TO_RAD;
    
    // Step 8: 太阳赤纬 delta (弧度)
    const declinationRad = Math.asin(Math.sin(epsilon_rad) * Math.sin(L_sun_rad));
    
    // Step 9: 时差修正 Eq_time (分钟)
    const y = Math.tan(epsilon_rad / 2) * Math.tan(epsilon_rad / 2);
    const EqTime_minutes = RAD_TO_DEG * (
        y * Math.sin(2 * L_sun_rad) -
        2 * e * Math.sin(M_rad) +
        4 * e * y * Math.sin(M_rad) * Math.cos(2 * L_sun_rad) -
        0.5 * y * y * Math.sin(4 * L_sun_rad) -
        1.25 * e * e * Math.sin(2 * M_rad)
    ) * 4;
    
    // Step 10: 时角 H (使用 90.833° 标准天顶角)
    const latRad = lat * DEG_TO_RAD;
    const zenithRad = 90.833 * DEG_TO_RAD;
    const cosH = (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(declinationRad)) / 
                 (Math.cos(latRad) * Math.cos(declinationRad));
    
    if (cosH < -1) return { sunrise: null, sunset: null, solarNoon: null, dayLengthMinutes: 1440, polarDay: true, polarNight: false, note: '极昼' };
    if (cosH > 1) return { sunrise: null, sunset: null, solarNoon: null, dayLengthMinutes: 0, polarDay: false, polarNight: true, note: '极夜' };
    
    const H_rad = Math.acos(cosH);
    const H_deg = H_rad * RAD_TO_DEG;
    
    // Step 11: 太阳时正午 → 本地时间 (完全参数化!)
    // 公式：UTC 分钟 = 720 - 4*经度 - EqTime
    //      本地时间 = UTC + 时区偏移
    const solarNoon_UTC_min = 720 - 4 * lon - EqTime_minutes;
    const localSolarNoon_hours = solarNoon_UTC_min / 60 + timezone;
    
    const sunrise_UTC_min = solarNoon_UTC_min - 4 * H_deg;
    const sunset_UTC_min = solarNoon_UTC_min + 4 * H_deg;
    
    const sunrise_hours = sunrise_UTC_min / 60 + timezone;
    const sunset_hours = sunset_UTC_min / 60 + timezone;
    
    function formatTime(decimalHour) {
        decimalHour = ((decimalHour % 24) + 24) % 24;
        const h = Math.floor(decimalHour);
        const m = Math.round((decimalHour - h) * 60);
        if (m >= 60) return `${String((h + 1) % 24).padStart(2, '0')}:00`;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    
    return {
        sunrise: formatTime(sunrise_hours),
        sunset: formatTime(sunset_hours),
        solarNoon: formatTime(localSolarNoon_hours),
        dayLengthMinutes: Math.round((sunset_hours - sunrise_hours) * 60),
        polarDay: false,
        polarNight: false,
        eq_time: EqTime_minutes,
        declination_deg: declinationRad * RAD_TO_DEG
    };
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 将角度归一化到 [0, 360) 范围
 * @param {number} angle - 输入角度 (度)
 * @returns {number} 归一化后的角度 [0, 360)
 */
function normalizeAngle360(angle) {
    let result = angle % 360;
    if (result < 0) result += 360;
    return result;
}

/**
 * 将角度差归一化到 (-180, 180] 范围
 * @param {number} diff - 角度差 (度)
 * @returns {number} 归一化后的角度差 (-180, 180]
 */
function normalizeAngleDiff(diff) {
    let result = diff;
    while (result <= -180) result += 360;
    while (result > 180) result -= 360;
    return result;
}

/**
 * 将小时数格式化为 "HH:MM" 字符串
 * @param {number} hours - 小时数 (可包含小数，可超过24或负数)
 * @returns {string} 格式化后的时间字符串 "HH:MM"
 */
function formatTime(hours) {
    // 处理跨日情况
    let h = hours;
    while (h >= 24) h -= 24;
    while (h < 0) h += 24;
    
    const hour = Math.floor(h);
    const minute = Math.round((h - hour) * 60);
    
    // 处理分钟进位
    if (minute >= 60) {
        return String(hour + 1).padStart(2, '0') + ':00';
    }
    
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

/**
 * 计算积日 N (当日是一年中的第几天)
 * @param {number} year - 年份
 * @param {number} month - 月份 (1-12)
 * @param {number} day - 日期 (1-31)
 * @returns {number} 积日 N (1-366)
 */
function calculateDayOfYear(year, month, day) {
    // 每月天数，非闰年
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    // 判断闰年
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (isLeapYear) {
        daysInMonth[1] = 29;
    }
    
    // 计算积日
    let N = day;
    for (let i = 0; i < month - 1; i++) {
        N += daysInMonth[i];
    }
    
    return N;
}

/**
 * 计算太阳赤纬角 δ (Cooper 方程)
 * 公式: δ = 23.45° × sin(360°/365 × (284 + N))
 * @param {number} N - 积日
 * @returns {number} 赤纬角 δ (弧度)
 */
function calculateSolarDeclination(N) {
    // Cooper 方程计算赤纬角 (度)
    const declinationDeg = 23.45 * Math.sin((360 / 365) * (284 + N) * DEG_TO_RAD);
    
    // 转换为弧度
    const declinationRad = declinationDeg * DEG_TO_RAD;
    
    log('Step A2: 赤纬角 δ =', declinationDeg.toFixed(4), '° =', declinationRad.toFixed(6), 'rad');
    
    return declinationRad;
}

/**
 * 计算日落时角 Hs
 * 公式: cos(Hs) = -tan(φ) × tan(δ)
 * @param {number} latRad - 纬度 (弧度)
 * @param {number} declinationRad - 赤纬角 δ (弧度)
 * @returns {number|null} 日落时角 Hs (弧度)，极昼返回 null，极夜返回 0
 */
function calculateSunsetHourAngle(latRad, declinationRad) {
    // 计算 cos(Hs)
    const cosHs = -Math.tan(latRad) * Math.tan(declinationRad);
    
    log('Step A3: cos(Hs) =', cosHs.toFixed(6));
    
    // 边界情况处理
    if (cosHs >= 1) {
        // cos(Hs) >= 1 表示极夜 (太阳始终在地平线以下)
        log('极夜情况: 当日无日照');
        return 0;
    }
    if (cosHs <= -1) {
        // cos(Hs) <= -1 表示极昼 (太阳始终在地平线以上)
        log('极昼情况: 24小时日照');
        return null; // 使用 null 表示极昼
    }
    
    // 计算日落时角 Hs (弧度)
    const Hs = Math.acos(cosHs);
    
    log('Step A3: 日落时角 Hs =', (Hs * RAD_TO_DEG).toFixed(4), '° =', Hs.toFixed(6), 'rad');
    
    return Hs;
}

/**
 * 计算真太阳时修正 (经度修正 + 方程时差)
 * 简化版: 仅考虑经度修正 = (当地经度 - 标准子午线) / 15° × 1小时
 * @param {number} longitude - 当地经度
 * @returns {number} 时间修正值 (小时)
 */
function calculateTimeCorrection(longitude) {
    // 经度修正: 每度经度差对应 4 分钟 = 1/15 小时
    const longitudeCorrection = (longitude - STANDARD_MERIDIAN) / 15;
    
    log('Step A4: 经度时间修正 =', longitudeCorrection.toFixed(4), '小时');
    
    return longitudeCorrection;
}

/**
 * 计算太阳高度角 hs
 * 公式: sin(hs) = sin(φ)sin(δ) + cos(φ)cos(δ)cos(t)
 * @param {number} latRad - 纬度 (弧度)
 * @param {number} declinationRad - 赤纬角 δ (弧度)
 * @param {number} hourAngleRad - 时角 t (弧度)
 * @returns {number} 太阳高度角 hs (弧度)
 */
function calculateSolarAltitude(latRad, declinationRad, hourAngleRad) {
    const sinHs = Math.sin(latRad) * Math.sin(declinationRad) + 
                  Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
    
    // 限制在 [-1, 1] 范围内防止浮点误差
    const clampedSinHs = Math.max(-1, Math.min(1, sinHs));
    
    return Math.asin(clampedSinHs);
}

/**
 * 计算太阳方位角 As (0-360°，正北为0，顺时针)
 * 
 * 标准测量学方位角定义:
 * - 0° = 正北
 * - 90° = 正东  
 * - 180° = 正南
 * - 270° = 正西
 * 
 * 使用球面三角学 + atan2 正确处理象限:
 * sin(A) = -cos(δ) × sin(t) / cos(hs)
 * cos(A) = [sin(δ)cos(φ) - cos(δ)sin(φ)cos(t)] / cos(hs)
 * 
 * atan2(sinA, cosA) 直接返回正确的方位角 (0-360°)
 * 
 * @param {number} latRad - 纬度 (弧度)
 * @param {number} declinationRad - 赤纬角 δ (弧度)
 * @param {number} hourAngleRad - 时角 t (弧度)，正午为0，上午为负，下午为正
 * @param {number} altitudeRad - 太阳高度角 hs (弧度)
 * @returns {number} 太阳方位角 As (度，0-360，正北为0顺时针)
 */
function calculateSolarAzimuth(latRad, declinationRad, hourAngleRad, altitudeRad) {
    const cosHs = Math.cos(altitudeRad);
    
    // 防止除以零 (太阳在头顶时)
    if (Math.abs(cosHs) < 1e-10) {
        return hourAngleRad < 0 ? 90 : 270;
    }
    
    // 使用 atan2 方法，精确计算方位角
    // sin(A) = -cos(δ) × sin(t) / cos(hs)
    const sinA = -Math.cos(declinationRad) * Math.sin(hourAngleRad) / cosHs;
    
    // cos(A) = [sin(δ)cos(φ) - cos(δ)sin(φ)cos(t)] / cos(hs)
    const cosA = (Math.sin(declinationRad) * Math.cos(latRad) - 
                  Math.cos(declinationRad) * Math.sin(latRad) * Math.cos(hourAngleRad)) / cosHs;
    
    // atan2 返回 -180° 到 180°，需要转换为 0-360°
    // 当 sinA > 0 且 cosA < 0 时 (第二象限)，角度在 90-180
    // 当 sinA < 0 且 cosA < 0 时 (第三象限)，角度在 -180 到 -90
    let azimuth = Math.atan2(sinA, cosA) * RAD_TO_DEG;
    
    // 转换到 0-360 范围
    if (azimuth < 0) azimuth += 360;
    
    return azimuth;
}

/**
 * 判定水平遮挡 (左右墙 + 屋子背面)
 * 
 * 关键概念:
 * - 阳台朝向 = 开放面朝外的方向 (如南向阳台朝向180°，开放面朝南)
 * - 屋子在阳台朝向的反方向 (南向阳台屋子在北面)
 * - 太阳必须在阳台前方 (朝向 ±90° 范围内) 才能照进阳台
 * 
 * @param {number} relativeAzimuth - 相对方位角 ΔA (度，已归一化到 -180~180)
 *                                 表示太阳相对于阳台朝向的偏移
 *                                 ΔA = 0: 太阳正对阳台
 *                                 ΔA = +90: 太阳在阳台右侧
 *                                 ΔA = -90: 太阳在阳台左侧
 *                                 |ΔA| > 90: 太阳在屋子背面，被挡住
 * @param {boolean} hasLeftWall - 是否有左墙
 * @param {boolean} hasRightWall - 是否有右墙
 * @returns {boolean} true = 无遮挡，false = 被遮挡
 */
function checkHorizontalShading(relativeAzimuth, hasLeftWall, hasRightWall) {
    // ========== 关键修复: 屋子背面遮挡 ==========
    // 当 |相对方位角| > 90° 时，太阳在阳台朝向的反方向
    // 这意味着阳光从屋子背面射来，被屋子完全挡住
    // 例如: 南向阳台(180°)，太阳在北方(0°)，ΔA = 0 - 180 = -180°，被挡住
    if (Math.abs(relativeAzimuth) > 90) {
        log('  屋子背面遮挡: |ΔA| =', Math.abs(relativeAzimuth).toFixed(2), '> 90°');
        return false; // 被屋子背面挡住
    }
    
    // 左侧遮挡判定: 太阳在阳台左侧 (ΔA < -85°)
    // 注意: 由于上面的 |ΔA| > 90 已经过滤，这里 ΔA 范围是 (-90, 90)
    // -85° 余量用于防止浮点误差
    if (hasLeftWall && relativeAzimuth < -HORIZONTAL_MARGIN) {
        log('  左侧墙遮挡: ΔA =', relativeAzimuth.toFixed(2), '< -85°');
        return false; // 被左墙遮挡
    }
    
    // 右侧遮挡判定: 太阳在阳台右侧 (ΔA > 85°)
    if (hasRightWall && relativeAzimuth > HORIZONTAL_MARGIN) {
        log('  右侧墙遮挡: ΔA =', relativeAzimuth.toFixed(2), '> 85°');
        return false; // 被右墙遮挡
    }
    
    return true; // 无遮挡
}

/**
 * 判定垂直遮挡 (雨蓬)
 * @param {number} altitudeDeg - 太阳高度角 (度)
 * @param {number} relativeAzimuthDeg - 相对方位角 ΔA (度)
 * @param {boolean} hasRoof - 是否有雨蓬
 * @param {number} roofDepth - 雨蓬出挑深度 (米)
 * @param {number} windowHeight - 计算点距雨蓬下沿垂直距离 (米)
 * @returns {boolean} true = 无遮挡，false = 被遮挡
 */
function checkVerticalShading(altitudeDeg, relativeAzimuthDeg, hasRoof, roofDepth, windowHeight) {
    if (!hasRoof) {
        return true; // 无雨蓬，不遮挡
    }
    
    // 当相对方位角 >= 90° 时，视为完全遮挡 (雨蓬在侧面无限延伸)
    if (Math.abs(relativeAzimuthDeg) >= VERTICAL_FULL_BLOCK) {
        return false; // 完全遮挡
    }
    
    // 计算有效出挑深度 (考虑斜射效应)
    // W_eff = roofDepth / cos(ΔA)
    const cosDiff = Math.cos(relativeAzimuthDeg * DEG_TO_RAD);
    
    // 防止除以零
    if (Math.abs(cosDiff) < 0.001) {
        return false; // 接近90°，视为遮挡
    }
    
    const effectiveWidth = roofDepth / Math.abs(cosDiff);
    
    // 计算临界高度角
    // h_limit = arctan(W_eff / windowHeight)
    const limitAngleRad = Math.atan(effectiveWidth / windowHeight);
    const limitAngleDeg = limitAngleRad * RAD_TO_DEG;
    
    log('垂直遮挡: 临界高度角 =', limitAngleDeg.toFixed(2), '°, 当前高度角 =', altitudeDeg.toFixed(2), '°');
    
    // 判定: 若太阳高度角 < 临界高度角，则被遮挡
    if (altitudeDeg < limitAngleDeg) {
        return false; // 被遮挡
    }
    
    return true; // 无遮挡
}

// =============================================================================
// 主计算函数
// =============================================================================

/**
 * 执行日照计算
 * @param {Object} params - 计算参数
 * @returns {Object} 计算结果
 */
function calculateSunlight(params) {
    log('========== 开始日照计算 ==========');
    log('输入参数:', JSON.stringify(params, null, 2));
    
    // -------------------------------------------------------------------------
    // Step 1: 参数解析与验证
    // -------------------------------------------------------------------------
    const lat = parseFloat(params.lat);
    const lon = parseFloat(params.lon);
    const dateStr = params.dateStr;
    const azimuth = parseFloat(params.azimuth); // 阳台朝向 (0-360)
    const hasLeftWall = params.hasLeftWall === true;
    const hasRightWall = params.hasRightWall === true;
    const hasRoof = params.hasRoof === true;
    const roofDepth = parseFloat(params.roofDepth) || 1.2;
    const windowHeight = parseFloat(params.windowHeight) || 2.0;
    const timeStep = parseInt(params.timeStep) || 5;
    
    // 参数验证
    if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error('纬度参数无效，应在 -90 到 90 之间');
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
        throw new Error('经度参数无效，应在 -180 到 180 之间');
    }
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error('日期格式无效，应为 YYYY-MM-DD');
    }
    
    log('Step 1: 参数验证通过');
    log('  纬度:', lat, '°, 经度:', lon, '°');
    log('  日期:', dateStr);
    log('  阳台朝向:', azimuth, '°');
    log('  遮挡情况:', {左墙: hasLeftWall, 右墙: hasRightWall, 雨蓬: hasRoof});
    
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // Step A: 天文参数计算 (使用 NOAA 高精度算法)
    // -------------------------------------------------------------------------
    log('\n========== Step A: 天文参数计算 (NOAA 算法) ==========');
    
    // 使用 NOAA 算法计算日出日落时间
    const noaaResult = calculateNOAASunTimes(lat, lon, dateStr, params.timezone || 8);
    
    // 处理极昼极夜
    if (noaaResult.polarNight) {
        log('Step A: 检测到极夜 - 当日无日照');
        return {
            durationHours: 0,
            sunrise: '--:--',
            sunset: '--:--',
            solarNoon: '--:--',
            dayLengthMinutes: 0,
            periods: [],
            note: '极夜：当日无日照',
            polarNight: true,
            polarDay: false
        };
    }
    
    if (noaaResult.polarDay) {
        log('Step A: 检测到极昼 - 全天 24 小时日照');
        return {
            durationHours: 24,
            sunrise: '--:--',
            sunset: '--:--',
            solarNoon: '--:--',
            dayLengthMinutes: 1440,
            periods: [],
            note: '极昼：全天 24 小时日照',
            polarNight: false,
            polarDay: true
        };
    }
    
    const sunriseStr = noaaResult.sunrise;
    const sunsetStr = noaaResult.sunset;
    const solarNoonStr = noaaResult.solarNoon;
    const dayLengthMinutes = noaaResult.dayLengthMinutes;
    
    log('Step A: NOAA 高精度日出日落时间');
    log('  日出:', sunriseStr);
    log('  日落:', sunsetStr);
    log('  正午:', solarNoonStr);
    log('  白昼时长:', dayLengthMinutes, '分钟');
    
    // 从白昼时长计算时角 Hs (弧度)
    // H_deg = 白昼时长 (小时) × 15°/2 = (dayLengthMinutes / 60) × 15 / 2
    const HsDeg = (dayLengthMinutes / 60) * 7.5;
    const Hs = HsDeg * DEG_TO_RAD;
    log('Step A: 日落时角 Hs =', HsDeg.toFixed(4), '° =', Hs.toFixed(6), 'rad');
    
    // ⚠️ 重要：恢复 Step B & C 遮挡判断需要的参数
    // 日出日落时间用 NOAA 高精度算法，但遮挡计算仍需要标准天文参数
    
    // 计算积日 N (用于太阳赤纬计算)
    const dateObj = new Date(dateStr + 'T00:00:00');
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dayOfYear = calculateDayOfYear(year, month, day);
    
    // 纬度转弧度
    const latRad = lat * DEG_TO_RAD;
    
    // 太阳赤纬角 δ (弧度)
    const declinationRad = calculateSolarDeclination(dayOfYear);
    
    // 时间修正 (经度修正 + 时差修正的简化版，仅用经度修正)
    const timeCorrection = calculateTimeCorrection(lon);
    
    log('Step A: 计算遮挡判断辅助参数');
    log('  积日 N:', dayOfYear);
    log('  纬度弧度:', latRad.toFixed(6), 'rad');
    log('  太阳赤纬:', (declinationRad * RAD_TO_DEG).toFixed(4), '°');
    log('  时间修正:', timeCorrection.toFixed(4), '小时');
    
    // Step B & C: 时间循环与遮挡判定
    // -------------------------------------------------------------------------
    log('\n========== Step B & C: 时间循环与遮挡判定 ==========');
    
    // 计算步长对应的时角增量 (弧度)
    // 每 timeStep 分钟对应的时角变化 = (timeStep / 60) 小时 × 15°/小时
    const stepRad = (timeStep / 60) * 15 * DEG_TO_RAD;
    log('步长设置: 每', timeStep, '分钟 =', (stepRad * RAD_TO_DEG).toFixed(4), '°时角');
    
    // 初始化统计变量
    let totalSunlightMinutes = 0;
    let currentPeriodStart = null;
    const periods = [];
    
    // 安全计数器，防止无限循环
    let iterations = 0;
    const MAX_ITERATIONS = 10000;
    
    // 时间循环: 从日出 (-Hs) 到日落 (+Hs)
    // 时角 t: 正午为0，上午为负，下午为正
    let t = -Hs;
    
    log('开始时间循环...');
    
    while (t <= Hs && iterations < MAX_ITERATIONS) {
        iterations++;
        
        // B1: 计算太阳高度角 hs
        const hsRad = calculateSolarAltitude(latRad, declinationRad, t);
        const hsDeg = hsRad * RAD_TO_DEG;
        
        // 跳过夜晚 (太阳在地平线以下)
        if (hsRad <= MIN_SUN_ALTITUDE) {
            t += stepRad;
            continue;
        }
        
        // B2: 计算太阳方位角 As (0-360°)
        const AsDeg = calculateSolarAzimuth(latRad, declinationRad, t, hsRad);
        
        // B3: 计算相对方位角 ΔA (阳台朝向与太阳方位角之差)
        const relativeAzimuth = normalizeAngleDiff(AsDeg - azimuth);
        
        // 计算当前时间 (用于记录时段)
        const currentHourAngleDeg = t * RAD_TO_DEG;
        const currentTrueSolarTime = 12 + currentHourAngleDeg / 15;
        const currentLocalTime = currentTrueSolarTime - timeCorrection;
        const currentTimeStr = formatTime(currentLocalTime);
        
        // C1: 水平遮挡判定
        const passHorizontal = checkHorizontalShading(relativeAzimuth, hasLeftWall, hasRightWall);
        
        // C2: 垂直遮挡判定
        const passVertical = checkVerticalShading(hsDeg, relativeAzimuth, hasRoof, roofDepth, windowHeight);
        
        // 综合判定
        const isSunlit = passHorizontal && passVertical;
        
        if (iterations <= 5 || iterations % 50 === 0) {
            log('  t=', t.toFixed(4), 'rad, 时间=', currentTimeStr, 
                ', hs=', hsDeg.toFixed(2), '°, As=', AsDeg.toFixed(2), '°, ΔA=', relativeAzimuth.toFixed(2), '°',
                ', 水平=', passHorizontal, ', 垂直=', passVertical, ', 结果=', isSunlit ? '☀️' : '⛅');
        }
        
        // 统计有效日照
        if (isSunlit) {
            totalSunlightMinutes += timeStep;
            
            // 记录时段开始
            if (currentPeriodStart === null) {
                currentPeriodStart = currentTimeStr;
            }
        } else {
            // 记录时段结束
            if (currentPeriodStart !== null) {
                // 当前时间减去一个步长作为结束时间
                const endTimeHour = currentLocalTime - timeStep / 60;
                const endTimeStr = formatTime(endTimeHour);
                periods.push({
                    start: currentPeriodStart,
                    end: endTimeStr
                });
                currentPeriodStart = null;
            }
        }
        
        // 步进
        t += stepRad;
    }
    
    log('时间循环结束，共', iterations, '次迭代');
    
    // 处理最后一个未结束的时段
    if (currentPeriodStart !== null) {
        periods.push({
            start: currentPeriodStart,
            end: sunsetStr
        });
    }
    
    // -------------------------------------------------------------------------
    // Step D: 结果输出
    // -------------------------------------------------------------------------
    log('\n========== Step D: 结果输出 ==========');
    
    const durationHours = parseFloat((totalSunlightMinutes / 60).toFixed(2));
    
    log('总日照时长:', durationHours, '小时');
    log('日出时间:', sunriseStr);
    log('日落时间:', sunsetStr);
    log('有效时段:', periods);
    
    // 极昼标记
    const note = Hs === null ? '极昼: 24小时理论日照' : null;
    
    return {
        durationHours: durationHours,
        sunrise: sunriseStr,
        sunset: sunsetStr,
        solarNoon: solarNoonStr,
        dayLengthMinutes: dayLengthMinutes,
        periods: periods,
        note: note
    };
}

// =============================================================================
// Web Worker 消息处理
// =============================================================================

self.onmessage = function(event) {
    log('收到主线程消息');
    
    try {
        const data = event.data;
        
        if (!data) {
            throw new Error('收到空数据');
        }
        
        // 执行计算
        const result = calculateSunlight(data);
        
        // 发送结果
        self.postMessage({
            success: true,
            data: result
        });
        
        log('计算完成，结果已发送');
        
    } catch (error) {
        errorLog('计算异常:', error.message);
        errorLog('错误堆栈:', error.stack);
        
        // 发送错误信息
        self.postMessage({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
};

// 错误处理
self.onerror = function(error) {
    errorLog('Worker 全局错误:', error);
    self.postMessage({
        success: false,
        error: 'Worker 内部错误: ' + error.message
    });
};

log('Worker 初始化完成，等待消息...');
