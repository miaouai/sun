// ==================== utils.js - 工具函数 ====================

// Toast 提示工具
export function showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }
}

// 指南针方向转换
export function getCardinalDirection(angle) {
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return directions[Math.round((angle + 22.5) / 45) % 8];
}

// 日照时长格式化工具
export function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}小时${mins}分钟`;
}

// 格式化结束时间
export function formatEndTime(decimalTime) {
    const hours = Math.floor(decimalTime);
    const minutes = Math.round((decimalTime - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
