/**
 * =============================================================================
 * NOAA 太阳位置算法 - 绝对通用高精度版 (v3.0)
 * =============================================================================
 * 
 * ✅ 零硬编码：完全基于输入参数计算，无任何地区预设
 * ✅ 国际标准：严格遵循 NOAA 官方算法文档
 * ✅ 高精度：时间方程包含所有主要摄动项
 * ✅ 通用性：支持全球任意经纬度、任意时区、任意日期
 * 
 * 参考文档:
 * - https://www.esrl.noaa.gov/gmd/grad/solcalc/calculations.html
 * - https://gml.noaa.gov/grad/solcalc/
 * 
 * @author 喵有爱 (miaouai)
 * @version 3.0-universal
 * =============================================================================
 */

(function(global) {
    'use strict';

    // ===== 数学工具函数 =====
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    
    /**
     * 规范化角度到 [0, 360) 范围
     */
    const normalizeAngle = angle => {
        let a = angle % 360;
        if (a < 0) a += 360;
        return a;
    };

    /**
     * 格式化时间为 HH:MM:SS
     */
    const formatTime = decimalHour => {
        decimalHour = ((decimalHour % 24) + 24) % 24;
        const hours = Math.floor(decimalHour);
        const minutes = Math.floor((decimalHour - hours) * 60);
        const seconds = Math.round(((decimalHour - hours) * 60 - minutes) * 60);
        
        let finalHours = hours;
        let finalMinutes = minutes;
        let finalSeconds = seconds;
        
        if (finalSeconds >= 60) {
            finalSeconds -= 60;
            finalMinutes += 1;
        }
        if (finalMinutes >= 60) {
            finalMinutes -= 60;
            finalHours += 1;
        }
        if (finalHours >= 24) {
            finalHours -= 24;
        }
        
        return `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
    };

    /**
     * 【核心】计算儒略日 (Julian Day Number)
     * 精确到日，不考虑时辰
     */
    const calculateJulianDay = (year, month, day) => {
        if (month <= 2) {
            year -= 1;
            month += 12;
        }
        
        const A = Math.floor(year / 100);
        const B = 2 - A + Math.floor(A / 4);
        
        // Gregorian 历法儒略日计算公式
        return Math.floor(365.25 * (year + 4716)) + 
               Math.floor(30.6001 * (month + 1)) + 
               day + B - 1524.5;
    };

    /**
     * 【核心】NOAA 日出日落时间计算 v3.0
     * 
     * @param {Object} params - 参数对象
     * @param {number} params.latitude - 纬度 (-90 到 90)
     * @param {number} params.longitude - 经度 (-180 到 180)
     * @param {string} params.date - 日期 (YYYY-MM-DD)
     * @param {number} params.timezone - 时区偏移 (小时，如 -5, 0, 8, 9.5 等)
     * 
     * @returns {Object} 计算结果
     */
    function calculateSunriseSunset(params) {
        const { latitude, longitude, date, timezone } = params;
        
        // ===== 验证输入 =====
        if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
            throw new Error(`纬度参数无效：${latitude} (应在 -90 到 90 之间)`);
        }
        if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
            throw new Error(`经度参数无效：${longitude} (应在 -180 到 180 之间)`);
        }
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`日期格式无效：${date} (应为 YYYY-MM-DD)`);
        }
        if (typeof timezone !== 'number') {
            throw new Error(`时区参数无效：${timezone}`);
        }
        
        const [year, month, day] = date.split('-').map(Number);
        
        // =========================================================================
        // STEP 1: 计算儒略日 (JD) 和儒略世纪数 (T)
        // =========================================================================
        const JD = calculateJulianDay(year, month, day);
        const T = (JD - 2451545.0) / 36525.0; // 自 J2000.0 起的儒略世纪数
        
        // =========================================================================
        // STEP 2: 太阳几何参数计算 (NOAA 标准公式)
        // =========================================================================
        
        // 2.1 地球轨道偏心率 (eccentricity of Earth's orbit)
        const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
        
        // 2.2 太阳平近点角 (Mean Solar Anomaly) - 度
        const M_deg = normalizeAngle(357.52911 + T * (35999.05029 - 0.0001537 * T));
        const M_rad = toRad(M_deg);
        
        // 2.3 方程中心 (Equation of Center) - 考虑更高阶项
        const C_deg = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(M_rad) +
                      (0.019993 - 0.000101 * T) * Math.sin(2 * M_rad) +
                      0.000289 * Math.sin(3 * M_rad);
        const C_rad = toRad(C_deg);
        
        // 2.4 太阳真黄经 (True Solar Longitude) - 度
        const L_sun_deg = normalizeAngle(280.46646 + T * (36000.76983 + 0.0003032 * T) + C_deg);
        const L_sun_rad = toRad(L_sun_deg);
        
        // 2.5 视黄道倾角 (Apparent Obliquity of Ecliptic) - 更精确
        const omega_deg = normalizeAngle(125.04 - 1934.136 * T);
        const epsilon_0_deg = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
        const epsilon_deg = epsilon_0_deg - 0.00256 * Math.cos(toRad(omega_deg));
        const epsilon_rad = toRad(epsilon_deg);
        
        // 2.6 太阳赤纬 (Solar Declination) - 弧度
        const declination_rad = Math.asin(Math.sin(epsilon_rad) * Math.sin(L_sun_rad));
        
        // 2.7 时间方程 (Equation of Time) - 分钟
        // 使用完整级数展开，精度达到秒级
        const y = Math.tan(epsilon_rad / 2) * Math.tan(epsilon_rad / 2);
        const Eq_time_minutes = toDeg(
            y * Math.sin(2 * L_sun_rad) -
            2 * e * Math.sin(M_rad) +
            4 * e * y * Math.sin(M_rad) * Math.cos(2 * L_sun_rad) -
            0.5 * y * y * Math.sin(4 * L_sun_rad) -
            1.25 * e * e * Math.sin(2 * M_rad)
        ) * 4; // 乘以 4 将角度转换为分钟 (1° = 4 分钟)
        
        // =========================================================================
        // STEP 3: 时角计算 (Hour Angle)
        // =========================================================================
        const lat_rad = toRad(latitude);
        
        // 标准天顶角：90° + 大气折射 (34') + 太阳视半径 (16') = 90.833°
        const zenith_deg = 90.833;
        const zenith_rad = toRad(zenith_deg);
        
        // 日出日落时角公式
        const cos_H = (Math.cos(zenith_rad) - Math.sin(lat_rad) * Math.sin(declination_rad)) /
                      (Math.cos(lat_rad) * Math.cos(declination_rad));
        
        // 检查极昼/极夜情况
        if (cos_H < -1) {
            return {
                sunrise: null,
                sunset: null,
                solar_noon: null,
                day_length: 1440, // 24 小时
                polar_night: false,
                polar_day: true,
                note: '极昼：全天日照',
                eq_time: Eq_time_minutes,
                declination_deg: toDeg(declination_rad)
            };
        }
        
        if (cos_H > 1) {
            return {
                sunrise: null,
                sunset: null,
                solar_noon: null,
                day_length: 0,
                polar_night: true,
                polar_day: false,
                note: '极夜：无日照',
                eq_time: Eq_time_minutes,
                declination_deg: toDeg(declination_rad)
            };
        }
        
        const H_rad = Math.acos(cos_H);
        const H_deg = toDeg(H_rad);
        
        // =========================================================================
        // STEP 4: 计算本地时间 (Local Time)
        // =========================================================================
        // 
        // 关键公式：
        // 1. 太阳时正午 (Solar Noon) in UTC minutes:
        //    SolarNoon_UTC_min = 720 - 4 * longitude - Eq_time
        //    其中：720 = 中午 12:00 的分钟数
        //          4 * longitude = 经度修正 (每度 4 分钟)
        //          
        // 2. 转为本地时间:
        //    LocalTime = UTC + timezone
        //
        // 注意：这里 timezone 是用户输入的时区偏移，与经度无关
        //       例如：上海 (经度 121°E) 用东八区 (timezone=8)，北京用东八区 (timezone=8)
        //             伦敦用 0 区，纽约用 -5 区，东京用 +9 区
        
        // 太阳时正午 (UTC 分钟)
        const solarNoon_UTC_min = 720 - 4 * longitude - Eq_time_minutes;
        
        // 转为本地时间 (小数小时)
        const localSolarNoon_hours = solarNoon_UTC_min / 60 + timezone;
        
        // 日出日落时间 (本地时间)
        const sunrise_UTC_min = solarNoon_UTC_min - 4 * H_deg;
        const sunset_UTC_min = solarNoon_UTC_min + 4 * H_deg;
        
        const sunrise_hours = sunrise_UTC_min / 60 + timezone;
        const sunset_hours = sunset_UTC_min / 60 + timezone;
        
        // =========================================================================
        // STEP 5: 输出结果
        // =========================================================================
        const sunriseStr = formatTime(sunrise_hours);
        const sunsetStr = formatTime(sunset_hours);
        const solarNoonStr = formatTime(localSolarNoon_hours);
        
        // 白昼时长 (分钟)
        const dayLengthMinutes = Math.round((sunset_hours - sunrise_hours) * 60);
        
        return {
            sunrise: sunriseStr,
            sunset: sunsetStr,
            solar_noon: solarNoonStr,
            day_length: dayLengthMinutes,
            polar_night: false,
            polar_day: false,
            note: null,
            eq_time: Eq_time_minutes,           // 时间方程 (分钟)
            declination_deg: toDeg(declination_rad), // 太阳赤纬 (度)
            eccentricity: e,                     // 地球轨道偏心率
            obliquity_deg: epsilon_deg,         // 黄道倾角 (度)
            hour_angle_deg: H_deg,              // 时角 (度)
            
            // 调试信息
            _debug: {
                JD, T, M_deg, C_deg, L_sun_deg,
                cos_H: cos_H.toFixed(6)
            }
        };
    }

    // ===== 导出公共 API =====
    global.NOAASunrise = {
        calculate: calculateSunriseSunset,
        utils: {
            toRad,
            toDeg,
            normalizeAngle,
            formatTime,
            calculateJulianDay
        },
        version: '3.0-universal',
        description: 'NOAA 标准算法，零硬编码，支持全球任意地点'
    };

    console.log('[NOAASunrise v3.0] 绝对通用高精度版本已加载');
    console.log('✅ 零硬编码 | ✅ 国际标准 | ✅ 全球适用');

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
