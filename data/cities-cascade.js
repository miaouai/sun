// ===== 城市联级选择器模块 =====
(function() {
    'use strict';
    
    let provinceMapCache = null;
    
    function initCityCascadeMenu() {
        console.log('🏙️ [城市联级] initCityCascadeMenu 被调用');
        console.log('🏙️ [城市联级] 当前页面 URL:', window.location.href);
        
        // 相对路径：从 index.html 的视角，cities-full.json 在 data/ 目录下
        const url = 'data/cities-full.json';
        console.log('🏙️ [城市联级] 尝试加载:', url);
        console.log('🏙️ [城市联级] 工作目录应该是:/app/working/mydata/sun');
        
        fetch(url)
            .then(response => {
                console.log('🏙️ [城市联级] fetch response status:', response.status, 'ok:', response.ok);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                console.log('🏙️ [城市联级] JSON 解析成功，数据条数:', data.length);
                buildCityCascadeMenu(data);
            })
            .catch(err => {
                console.error('🏙️ [城市联级] 加载失败:', err);
                console.error('🏙️ [城市联级] 错误详情:', err.message);
                if (typeof showToast === 'function') {
                    showToast('城市数据加载失败：' + err.message);
                } else {
                    alert('城市数据加载失败\n\nURL:' + url + '\n\n错误:' + err.message + '\n\n请确保：\n1. 使用 HTTP 服务器运行（python3 -m http.server 8080）\n2. 访问 http://localhost:8080/index.html');
                }
            });
    }
    
    function buildCityCascadeMenu(rawData) {
        const provinceMap = new Map();
        
        rawData.forEach(item => {
            const province = item.province;
            const city = item.city || '市辖区';
            const area = item.area || '';
            // ✅ 修复：统一使用 "lat,lng" 顺序（纬度在前，经度在后）
            const coords = `${item.lat},${item.lng}`;
            
            if (!provinceMap.has(province)) {
                provinceMap.set(province, new Map());
            }
            
            const cityMap = provinceMap.get(province);
            if (!cityMap.has(city)) {
                cityMap.set(city, { coords: coords, areas: [] });
            }
            
            if (area && area !== '') {
                cityMap.get(city).areas.push({ name: area, coords: coords });
            } else {
                cityMap.get(city).hasSelfCoords = true;
            }
        });
        
        provinceMapCache = provinceMap;
        renderCascadeMenu(provinceMap);
    }
    
    function renderCascadeMenu(provinceMap) {
        const container = document.getElementById('cityCascadeContainer');
        if (!container) return;
        
        container.innerHTML = '';
        const provinceSelect = createLevelSelect(0, Array.from(provinceMap.keys()));
        provinceSelect.addEventListener('change', () => onProvinceChange(provinceMap, provinceSelect));
        container.appendChild(provinceSelect);
        
        console.log(`✅ 已构建城市联级菜单，共 ${provinceMap.size} 个省份`);
    }
    
    function createLevelSelect(levelIndex, optionsList) {
        const select = document.createElement('select');
        select.id = `level${levelIndex}Select`;
        select.className = 'cascade-select';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = getLevelPlaceholder(levelIndex);
        select.appendChild(defaultOption);
        
        optionsList.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            select.appendChild(opt);
        });
        
        return select;
    }
    
    function getLevelPlaceholder(level) {
        const labels = ['请选择省份/直辖市', '请选择城市', '请选择区县'];
        return labels[level] || '请选择';
    }
    
    function onProvinceChange(provinceMap, provinceSelect) {
        const selectedProvince = provinceSelect.value;
        if (!selectedProvince) return;
        
        const container = document.getElementById('cityCascadeContainer');
        const cityMap = provinceMap.get(selectedProvince);
        
        // 移除所有旧的下级菜单
        removeOldCascadeSelects(container, 1);
        
        const cities = Array.from(cityMap.keys());
        const hasMultipleCities = cities.length > 1;
        
        if (hasMultipleCities) {
            // 标准情况：有多个不同城市名（如广东：广州、深圳、珠海...）
            const citySelect = createLevelSelect(1, cities);
            citySelect.addEventListener('change', () => onCityChange(provinceMap, selectedProvince, citySelect));
            container.appendChild(citySelect);
        } else {
            // 特殊情况：只有一个城市名（通常是"市辖区"），直接显示区县下拉框（跳过城市级别）
            const cityData = cityMap.get(cities[0]);
            if (cityData && cityData.areas && cityData.areas.length > 0) {
                const areaOptions = cityData.areas.map(a => a.name);
                const areaSelect = createLevelSelect(1, areaOptions); // 使用 level 1
                areaSelect.addEventListener('change', () => {
                    const selectedArea = areaSelect.value;
                    if (selectedArea) {
                        const areaItem = cityData.areas.find(a => a.name === selectedArea);
                        if (areaItem) {
                            saveSelectedLocation(`${selectedProvince} ${selectedArea}`, areaItem.coords);
                        }
                    }
                });
                container.appendChild(areaSelect);
            }
        }
    }
    
    function onCityChange(provinceMap, selectedProvince, citySelect) {
        const selectedCity = citySelect.value;
        if (!selectedCity) return;
        
        const container = document.getElementById('cityCascadeContainer');
        const cityData = provinceMap.get(selectedProvince).get(selectedCity);
        const hasAreas = cityData && cityData.areas.length > 0;
        
        if (hasAreas) {
            removeOldCascadeSelects(container, 2);
            const areaOptions = cityData.areas.map(a => a.name);
            const areaSelect = createLevelSelect(2, areaOptions);
            areaSelect.addEventListener('change', () => onAreaChange(provinceMap, selectedProvince, selectedCity, areaSelect, cityData));
            container.appendChild(areaSelect);
        } else {
            const coords = cityData.coords;
            saveSelectedLocation(`${selectedProvince} ${selectedCity}`, coords);
        }
    }
    
    function onAreaChange(provinceMap, province, city, areaSelect, cityData) {
        const selectedArea = areaSelect.value;
        if (!selectedArea) return;
        
        const areaItem = cityData.areas.find(a => a.name === selectedArea);
        if (areaItem) {
            saveSelectedLocation(`${province} ${city} ${selectedArea}`, areaItem.coords);
        }
    }
    
    function removeOldCascadeSelects(container, fromLevel) {
        // 移除所有级别大于等于 fromLevel 的 select 元素
        const selects = container.querySelectorAll('select.cascade-select');
        selects.forEach(select => {
            const level = parseInt(select.id.replace('level', '').replace('Select', ''), 10);
            if (level >= fromLevel) {
                container.removeChild(select);
            }
        });
    }
    
    function saveSelectedLocation(name, coords) {
        const footerCoords = document.getElementById('footerCoordinates');
        const footerCity = document.getElementById('footerCityName');
        
        if (footerCoords) footerCoords.textContent = coords;
        if (footerCity) footerCity.textContent = name;
        
        // ✅ 修复：coords 格式是 "lat,lng"（纬度在前，经度在后）
        const lat = parseFloat(coords.split(',')[0]);  // 第一个是纬度
        const lng = parseFloat(coords.split(',')[1]);  // 第二个是经度
        
        console.log(`🔍 [坐标解析] 原始字符串："${coords}" → lat=${lat}, lng=${lng}`);
        
        // ✅ 关键修复：使用 window.AppState 确保与 app.js 共享同一个对象
        if (!window.AppState) {
            console.error('❌ window.AppState 不存在！app.js 可能未正确加载');
            return;
        }
        
        // 保存到 AppState - 同时更新主坐标和备用坐标
        window.AppState.manualLat = lat;
        window.AppState.manualLng = lng;
        window.AppState.lastSelectedCity = name;
        
        // ⚠️ 关键：同步到主定位状态（这样"开始分析"能读取到正确的坐标）
        window.AppState.latitude = lat;
        window.AppState.longitude = lng;
        window.AppState.cityName = name;
        
        console.log(`💾 [AppState 保存] latitude=${window.AppState.latitude}, longitude=${window.AppState.longitude}`);
        
        // ✅ 同步更新手动模式的坐标输入框显示
        const manualLatInput = document.getElementById('manualLat');
        const manualLngInput = document.getElementById('manualLng');
        if (manualLatInput) manualLatInput.value = lat.toFixed(6);
        if (manualLngInput) manualLngInput.value = lng.toFixed(6);
        
        // ✅ 同步更新自动定位面板的经纬度显示
        const autoLatitudeEl = document.getElementById('latitudeValue');
        const autoLongitudeEl = document.getElementById('longitudeValue');
        const currentAddressEl = document.getElementById('currentAddress');
        if (autoLatitudeEl) autoLatitudeEl.textContent = lat.toFixed(6);
        if (autoLongitudeEl) autoLongitudeEl.textContent = lng.toFixed(6);
        if (currentAddressEl) currentAddressEl.textContent = name;
        
        console.log(`📍 已选择位置：${name}, 最终坐标：lat=${lat}, lng=${lng}`);
        showToast(`已选择：${name} [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
    }
    
    // 初始化钩子
    window.initCityCascadeMenu = initCityCascadeMenu;
})();
