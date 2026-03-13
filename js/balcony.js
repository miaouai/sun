// ==================== balcony.js - 阳台配置模块 ====================

import { showToast } from './utils.js';

export function setupBalconyConfig() {
    const obstructionSection = document.getElementById('obstructionSection');
    
    // 阳台类型切换
    const balconyRadios = document.querySelectorAll('input[name="balconyType"]');
    balconyRadios.forEach(radio => {
        radio.addEventListener('change', e => {
            window.AppState.balconyType = e.target.value;
            const typeName = e.target.closest('label').querySelector('strong').textContent;
            
            if (e.target.value === 'protruding') {
                obstructionSection.style.display = 'block';
                showToast(`已选择：${typeName}`);
            } else {
                obstructionSection.style.display = 'none';
                window.AppState.obstructions = [];
                document.querySelectorAll('input[name="obstruction"]').forEach(cb => cb.checked = false);
                showToast(`已选择：${typeName}（内嵌式默认全遮挡）`);
            }
        });
    });

    // 封闭式选项切换
    const enclosedRadios = document.querySelectorAll('input[name="enclosedType"]');
    enclosedRadios.forEach(radio => {
        radio.addEventListener('change', e => {
            window.AppState.enclosedType = e.target.value;
            const typeName = e.target.closest('label').querySelector('strong').textContent;
            showToast(`已选择：${typeName}`);
        });
    });

    // 遮挡选项（复选框）
    const obstructionCheckboxes = document.querySelectorAll('input[name="obstruction"]');
    obstructionCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', e => {
            updateObstructions();
        });
    });

    // 初始化
    const defaultBalcony = document.querySelector('input[name="balconyType"]:checked');
    if (defaultBalcony) {
        if (defaultBalcony.value === 'protruding') {
            obstructionSection.style.display = 'block';
        } else {
            obstructionSection.style.display = 'none';
        }
    }
}

export function updateObstructions() {
    const checkedBoxes = document.querySelectorAll('input[name="obstruction"]:checked');
    window.AppState.obstructions = Array.from(checkedBoxes).map(cb => cb.value);
    
    const tipElement = document.getElementById('obstructionTip');
    if (tipElement) {
        const tipText = tipElement.querySelector('.tip-text');
        const tipIcon = tipElement.querySelector('.tip-icon');
        
        const count = window.AppState.obstructions.length;
        if (count === 0) {
            tipIcon.textContent = '✨';
            tipText.textContent = '暂无遮挡，视野开阔，日照最佳！';
            tipElement.style.background = '#f0fdf4';
            tipElement.style.borderColor = '#86efac';
        } else if (count === 1) {
            tipIcon.textContent = '🌤️';
            const obs = window.AppState.obstructions[0];
            if (obs === 'left') {
                tipText.textContent = '左侧有遮挡，早晨日照受影响较小';
            } else if (obs === 'right') {
                tipText.textContent = '右侧有遮挡，傍晚日照受影响较小';
            } else if (obs === 'top') {
                tipText.textContent = '顶部有遮挡，正午高角度阳光受阻';
            }
            tipElement.style.background = '#fffbe6';
            tipElement.style.borderColor = '#fde047';
        } else if (count === 2) {
            tipIcon.textContent = '⚠️';
            tipText.textContent = '两方向有遮挡，有效采光时段明显减少';
            tipElement.style.background = '#fef3c7';
            tipElement.style.borderColor = '#fbbf24';
        } else {
            tipIcon.textContent = '❗';
            tipText.textContent = '三向全遮，日照严重不足，建议选择其他朝向';
            tipElement.style.background = '#fef2f2';
            tipElement.style.borderColor = '#fca5a5';
        }
    }
    
    console.log(`🏢 遮挡更新：${window.AppState.obstructions.length}个方向`);
}
