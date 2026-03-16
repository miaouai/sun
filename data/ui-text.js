/**
 * UI 文本管理模块
 * 统一管理所有界面显示文字，支持动态更新
 */

class UITextManager {
    constructor() {
        this.textElements = new Map(); // 缓存已绑定的 DOM 元素
    }

    /**
     * 设置元素的文本内容
     */
    setText(elementId, configPath, params = {}) {
        const element = document.getElementById(elementId);
        if (!element) return;

        let text = window.Config.get(configPath, '');
        
        // 参数替换
        Object.keys(params).forEach(key => {
            text = text.replace(`{${key}}`, params[key]);
        });

        element.textContent = text;
    }

    /**
     * 批量设置多个元素的文本
     */
    setBatch(batches) {
        batches.forEach(({ id, path, params }) => {
            this.setText(id, path, params);
        });
    }

    /**
     * 根据配置动态生成 HTML 结构
     */
    createSection(titleConfigPath, contentHtml) {
        const titleText = window.Config.get(titleConfigPath, '未定义');
        const section = document.createElement('section');
        section.className = 'module';
        section.innerHTML = `
            <div class="module-header">
                <h2>${titleText}</h2>
            </div>
            <div class="module-content">
                ${contentHtml}
            </div>
        `;
        return section;
    }

    /**
     * 创建带图标的按钮
     */
    createButtonWithIcon(icon, text, className, onclick) {
        const btn = document.createElement('button');
        btn.className = className || 'btn btn-primary';
        btn.innerHTML = `<span class="icon">${icon}</span><span class="text">${text}</span>`;
        if (onclick) btn.onclick = onclick;
        return btn;
    }

    /**
     * 获取阳台类型描述
     */
    getBalconyTypeText(type) {
        return window.Config.get(`ui.balconyType.${type}`, type);
    }

    /**
     * 获取封闭类型描述
     */
    getEnclosedTypeText(type) {
        return window.Config.get(`ui.enclosedType.${type}`, type);
    }

    /**
     * 获取遮挡项描述
     */
    getObstructionText(obstruction) {
        return window.Config.get(`ui.obstructionLabels.${obstruction}`, obstruction);
    }

    /**
     * 获取季节名称和图标
     */
    getSeasonText(month, day) {
        if (month >= 3 && month <= 5) {
            return window.Config.get('seasons.spring', '春季 🌸');
        } else if (month >= 6 && month <= 8) {
            return window.Config.get('seasons.summer', '夏季 ☀️');
        } else if (month >= 9 && month <= 11) {
            return window.Config.get('seasons.autumn', '秋季 🍂');
        } else {
            return window.Config.get('seasons.winter', '冬季 ❄️');
        }
    }
}

// 导出到全局
window.UI = new UITextManager();
