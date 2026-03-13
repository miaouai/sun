// ==================== state.js - 全局状态管理 ====================

export const AppState = {
    // 方向检测
    currentAzimuth: null,        // 当前朝向角度 (0-360)
    isAutoDetecting: false,      // 是否正在自动检测
    
    // 阳台配置
    balconyType: 'protruding',   // 阳台类型：protruding|recessed
    enclosedType: 'open',         // 封闭类型：open|semi-closed|closed
    obstructions: [],            // 遮挡列表：['left', 'right', 'top']
    
    // 位置信息
    latitude: null,              // 纬度
    longitude: null,             // 经度
    locationMode: 'auto',        // 位置模式：'auto'|'manual'
    cityName: '',                // 城市名称（显示用）
};
