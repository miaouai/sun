// ==================== 向日窥 - Sun Peek v1.0.0 ====================
// 阳台光照智能分析应用核心逻辑

(function() {
    'use strict';

    // ===== 全局状态管理 =====
    const AppState = {
        currentAzimuth: null,        // 当前朝向角度 (0-360)
        isAutoDetecting: false,      // 是否正在自动检测
        balconyType: 'protruding',   // 阳台类型：protruding|recessed
        latitude: null,              // 纬度
        longitude: null,             // 经度
        province: '',                // 省份
        city: '',                    // 城市
    };

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
        
        // 昼长（小时）
        const sunRiseSetHourOffset = (2 / 15) * Math.acos(-Math.tan(rad * lat) * Math.tan(delta));
        
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

    // ===== 权限管理模块 =====
    function checkAndRequestPermissions() {
        const statusEl = document.getElementById('permissionStatus');
        if (!statusEl) return;

        statusEl.innerHTML = '<span class="status-icon">📡</span><span class="status-text">正在检测设备能力...</span>';

        // 检查设备方向传感器支持
        let hasOrientation = false;
        if (typeof DeviceOrientationEvent !== 'undefined') {
            hasOrientation = true;
            
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

        // 获取 GPS 位置
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    AppState.latitude = pos.coords.latitude;
                    AppState.longitude = pos.coords.longitude;
                    
                    document.getElementById('latitudeValue').textContent = 
                        pos.coords.latitude.toFixed(6);
                    document.getElementById('longitudeValue').textContent = 
                        pos.coords.longitude.toFixed(6);
                    
                    updateLocationUI(true);
                },
                err => {
                    console.log('定位失败:', err.message);
                    updateLocationUI(false);
                    showToast('GPS 定位失败，请手动选择地区', 3000);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    }

    function updateLocationUI(success) {
        const gpsIndicator = document.getElementById('gpsIndicator');
        const addrDisplay = document.getElementById('currentAddress');
        
        if (success) {
            if (gpsIndicator) {
                gpsIndicator.querySelector('.indicator-dot').className = 'indicator-dot active';
                gpsIndicator.querySelector('.indicator-text').textContent = 'GPS: 定位成功';
            }
            if (addrDisplay) {
                addrDisplay.textContent = '正在解析地址...';
                // 可以尝试反向地理编码
                tryReverseGeocode();
            }
        } else {
            if (gpsIndicator) {
                gpsIndicator.querySelector('.indicator-dot').className = 'indicator-dot inactive';
                gpsIndicator.querySelector('.indicator-text').textContent = 'GPS: 定位失败';
            }
            if (addrDisplay) {
                addrDisplay.textContent = '定位失败，请手动选择';
            }
        }
    }

    async function tryReverseGeocode() {
        try {
            const resp = await fetch('https://api.ip.sb/geocoding');
            const data = await resp.json();
            const addrText = data.city ? `${data.city}${data.region ? ', ' + data.region : ''}` : 'IP 定位中...';
            document.getElementById('currentAddress').textContent = addrText;
        } catch (e) {
            console.log('地址解析失败', e);
            document.getElementById('currentAddress').textContent = `${AppState.latitude?.toFixed(4)}, ${AppState.longitude?.toFixed(4)}`;
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
            
            // 禁用手动输入框
            document.getElementById('manualAngleInput').disabled = true;
            document.getElementById('manualSetBtn').disabled = true;
            document.getElementById('manualAngleInput').placeholder = '自动检测中...';
            
            startOrientationListener();
        } else {
            btn.classList.remove('active');
            btn.querySelector('.btn-icon').textContent = '▶️';
            btn.querySelector('.btn-text').textContent = '自动检测';
            const lastAngle = AppState.currentAzimuth !== null ? AppState.currentAzimuth : '--';
            document.getElementById('modeDisplay').textContent = `已停止 (${lastAngle}°)`;
            document.getElementById('modeDisplay').style.color = '#FF9500';
            
            stopOrientationListener();
            
            // 启用手动输入框并重置状态
            document.getElementById('manualAngleInput').disabled = false;
            document.getElementById('manualSetBtn').disabled = false;
            document.getElementById('manualAngleInput').placeholder = '输入角度 (0-360)';
            document.getElementById('manualAngleInput').value = '';
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

        // 尝试请求权限（仅 iOS 13+）
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            console.log('📱 检测到 iOS 13+，请求方向权限...');
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        console.log('✅ 权限已授予，开始监听...');
                        registerListeners();
                    } else {
                        console.warn('⚠️ 用户拒绝方向权限');
                        showToast('请授权方向传感器权限');
                        const btn = document.getElementById('autoDetectBtn');
                        if (btn && AppState.isAutoDetecting) toggleAutoDetection(btn);
                    }
                })
                .catch(err => {
                    console.error('❌ 权限请求失败:', err);
                    showToast('权限请求失败，请重试');
                    const btn = document.getElementById('autoDetectBtn');
                    if (btn && AppState.isAutoDetecting) toggleAutoDetection(btn);
                });
        } else {
            // 非 iOS 设备直接开始监听
            console.log('🤖 非 iOS 设备，直接开始监听...');
            registerListeners();
        }

        function registerListeners() {
            try {
                window.addEventListener('deviceorientation', orientationHandler);
                console.log('✅ deviceorientation 监听器已注册');
            } catch (err) {
                console.error('❌ 无法注册监听器:', err.message);
                throw err;
            }

            console.log('📡 方向检测已就绪，请移动设备测试');
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
            // transform 顺序：先 translate(-50%, -50%) 居中，再 rotate 旋转
            needle.style.transform = `translate(-50%, -50%) rotate(${azimuth}deg)`;
        }
    }

    // ===== 阳台配置模块 =====
    function setupBalconyConfig() {
        const radios = document.querySelectorAll('input[name="balconyType"]');
        radios.forEach(radio => {
            radio.addEventListener('change', e => {
                AppState.balconyType = e.target.value;
                showToast(`已选择：${e.target.closest('label').querySelector('strong').textContent}`);
            });
        });
    }

    // ===== 地区选择模块 =====
    function setupProvinceCitySelectors() {
        const provinceSelect = document.getElementById('provinceSelect');
        const citySelect = document.getElementById('citySelect');
        
        if (!provinceSelect || !citySelect) return;

        const citiesData = {
            "北京市": ["东城", "西城", "朝阳", "海淀", "丰台"],
            "上海市": ["浦东", "黄浦", "徐汇", "静安", "长宁"],
            "重庆市": ["渝中", "江北", "南岸", "渝北", "巴南"],
            "广东省": ["广州", "深圳", "珠海", "佛山", "东莞"],
            "浙江省": ["杭州", "宁波", "温州", "嘉兴", "湖州"],
            "江苏省": ["南京", "苏州", "无锡", "常州", "镇江"],
            "四川省": ["成都", "绵阳", "德阳", "乐山", "宜宾"],
            "河北省": ["石家庄", "唐山", "秦皇岛", "保定", "张家口"],
            "湖南省": ["长沙", "株洲", "湘潭", "衡阳", "岳阳"],
            "湖北省": ["武汉", "黄石", "宜昌", "襄阳", "荆州"],
            "河南省": ["郑州", "开封", "洛阳", "新乡", "焦作"],
            "山东省": ["济南", "青岛", "淄博", "烟台", "潍坊"],
            "陕西省": ["西安", "咸阳", "宝鸡", "渭南", "铜川"],
            "福建省": ["福州", "厦门", "泉州", "漳州", "莆田"],
            "台湾省": ["台北", "新北", "台中", "台南", "高雄"],
            "辽宁省": ["沈阳", "大连", "鞍山", "抚顺", "本溪"],
            "黑龙江省": ["哈尔滨", "大庆", "齐齐哈尔", "牡丹江", "佳木斯"],
            "吉林省": ["长春", "吉林", "四平", "辽源", "通化"],
            "安徽省": ["合肥", "芜湖", "马鞍山", "蚌埠", "淮南"],
            "江西省": ["南昌", "九江", "景德镇", "赣州", "宜春"],
            "山西省": ["太原", "大同", "阳泉", "长治", "晋城"],
            "甘肃省": ["兰州", "天水", "武威", "张掖", "平凉"],
            "青海省": ["西宁", "海东", "海北", "海南", "黄南"],
            "新疆维吾尔自治区": ["乌鲁木齐", "克拉玛依", "吐鲁番", "哈密", "阿克苏"],
            "内蒙古自治区": ["呼和浩特", "包头", "赤峰", "呼伦贝尔", "通辽"],
            "广西壮族自治区": ["南宁", "柳州", "桂林", "北海", "防城港"],
            "海南省": ["海口", "三亚", "三沙", "儋州"],
            "云南省": ["昆明", "大理", "丽江", "曲靖", "玉溪"],
            "贵州省": ["贵阳", "遵义", "六盘水", "安顺", "毕节"],
            "西藏自治区": ["拉萨", "日喀则", "昌都", "林芝", "山南"],
            "宁夏回族自治区": ["银川", "石嘴山", "吴忠", "固原", "中卫"],
            "香港特别行政区": ["香港岛", "九龙", "新界东", "新界西"],
            "澳门特别行政区": ["澳门半岛", "氹仔", "路环"]
        };

        provinceSelect.addEventListener('change', () => {
            const prov = provinceSelect.value;
            if (prov) {
                citySelect.innerHTML = '<option value="">请选择城市</option>';
                (citiesData[prov] || ["市区"]).forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    citySelect.appendChild(opt);
                });
                citySelect.disabled = false;
                AppState.province = prov;
            } else {
                citySelect.innerHTML = '<option value="">请先选择省份</option>';
                citySelect.disabled = true;
            }
        });

        citySelect.addEventListener('change', () => {
            AppState.city = citySelect.value;
        });
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

        // 计算日照数据
        const lat = AppState.latitude || 39.9;
        const lng = AppState.longitude || 116.4;
        const sunData = calculateSunTimes(lat, lng, new Date());

        // 获取阳台类型显示文本
        const balconyRadio = document.querySelector('input[name="balconyType"]:checked');
        const balconyTypeName = balconyRadio?.closest('label')?.querySelector('strong')?.textContent || '凸出式阳台';

        // 更新结果显示
        updateAnalysisResults({
            direction: `${getCardinalDirection(AppState.currentAzimuth)} (${Math.round(AppState.currentAzimuth)}°)`,
            duration: formatDuration(sunData.dayLength),
            sunrise: sunData.sunrise,
            sunset: sunData.sunset,
            balconyType: balconyTypeName,
            location: `${AppState.province || '未定位'}${AppState.city ? ',' + AppState.city : ''}`,
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
        document.getElementById('detailLocation').textContent = data.location;
        
        // 计算有效采光时段（简化算法）
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
        // 根据阳台类型和朝向估算有效采光比例
        const azimuth = AppState.currentAzimuth || 0;
        let orientationFactor = 1;
        
        // 南向最优，北向最差
        if (azimuth >= 315 || azimuth < 45) orientationFactor = 0.7;  // 北
        else if (azimuth >= 45 && azimuth < 135) orientationFactor = 0.9;  // 东
        else if (azimuth >= 135 && azimuth < 225) orientationFactor = 1.1;  // 南
        else orientationFactor = 0.95;  // 西
        
        let typeFactor = AppState.balconyType === 'protruding' ? 1.35 : 1.0;
        return Math.min(1.2, orientationFactor * typeFactor / 1.1);
    }

    function formatEndTime(decimalHour) {
        decimalHour = decimalHour % 24;
        const h = Math.floor(decimalHour);
        const m = Math.round((decimalHour - h) * 60);
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
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
        setupProvinceCitySelectors();
        setupAnalysisButton();
    });

})();
