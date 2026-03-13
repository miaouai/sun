// ===== 城市联级选择器模块 =====
(function() {
    'use strict';
    
    let provinceMapCache = null;
    
    function initCityCascadeMenu() {
        // 添加时间戳防止缓存
        fetch('data/cities-full.json?t=' + Date.now())
            .then(response => response.json())
            .then(data => buildCityCascadeMenu(data))
            .catch(err => {
                console.error('加载城市数据失败:', err);
                showToast('城市数据加载失败');
            });
    }
    
    function buildCityCascadeMenu(rawData) {
        const provinceMap = new Map();
        
        rawData.forEach(item => {
            const province = item.province;
            const city = item.city || '市辖区';
            const area = item.area || '';
            const coords = `${item.lng},${item.lat}`;
            
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
        
        // 解析坐标：JSON 中是 lng,lat 顺序，所以 split(',')[0]是经度，[1]是纬度
        const lng = parseFloat(coords.split(',')[0]);
        const lat = parseFloat(coords.split(',')[1]);
        
        // 保存到 AppState - 同时更新主坐标和备用坐标
        AppState.manualLat = lat;
        AppState.manualLng = lng;
        AppState.lastSelectedCity = name;
        
        // 同步到主定位状态（这样"使用此位置"按钮也能读取到）
        AppState.latitude = lat;
        AppState.longitude = lng;
        AppState.cityName = name;
        
        console.log(`📍 已选择位置：${name}, 坐标：lng=${lng}, lat=${lat}`);
        showToast(`已选择：${name}`);
    }
    
    // 初始化钩子
    window.initCityCascadeMenu = initCityCascadeMenu;
})();
