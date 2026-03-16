/**
 * AI 智能分析助手模块
 * 生成提示词并处理 AI 平台跳转
 */

class AIAssistant {
    constructor() {
        this.platforms = {
            deepseek: {
                url: 'https://chat.deepseek.com/',
                scheme: 'deepseek://'
            },
            qwen: {
                url: 'https://tongyi.aliyun.com/qianwen/',
                scheme: 'tongyi://'
            },
            doubao: {
                url: 'https://www.doubao.com/chat/',
                scheme: 'doubao://'
            }
        };
    }

    /**
     * 生成完整的阳台分析提示词（带表格模板）
     */
    generatePrompt(appState) {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        // 获取基础数据
        const lat = appState?.latitude || '未设置';
        const lng = appState?.longitude || '未设置';
        const azimuth = appState?.currentAzimuth ?? '未检测';
        const balconyType = appState?.balconyType || '未知';
        const obstructions = appState?.obstructions || [];
        
        // 获取描述文本
        const balconyDesc = window.UI.getBalconyTypeText(balconyType);
        const obstructionText = obstructions.length > 0 
            ? obstructions.map(o => window.UI.getObstructionText(o)).join('、')
            : '无明显遮挡';
        
        return `【阳台日照智能分析报告请求】

=== 基础位置信息 ===
📍 经纬度：${lat}°N, ${lng}°E
📅 当前日期：${dateStr}
🧭 阳台朝向：${azimuth}°（${this.getCompassDirection(azimuth)}）
🏠 阳台类型：${balconyDesc}
🚧 遮挡情况：${obstructionText}

=== 分析任务清单 ===

## 任务 1：今日太阳运动数据（请用表格输出）
请计算并展示以下信息，使用 Markdown 表格格式：

| 时间参数 | 具体数值 | 说明 |
|---------|---------|------|
| 日出时间 | ? | HH:MM 格式 |
| 正午时间 | ? | 太阳最高点 |
| 日落时间 | ? | HH:MM 格式 |
| 总日照时长 | ? | 小时数 |
| 有效采光时段 | ? | 考虑遮挡后的实际可用时间 |

同时提供按小时的太阳高度角变化表：
| 时刻 | 太阳高度角 | 是否可晒太阳 |
|------|----------|-------------|
| 06:00 | ? | 是/否 |
| ... | ... | ... |
| 18:00 | ? | 是/否 |

## 任务 2：全年日照统计预测（请用表格输出）

请提供月度对比表：
| 月份 | 平均日照时长 | 最佳利用天数 | 建议活动 |
|-----|------------|------------|---------|
| 1 月 | ? | ?天 | ? |
| 2 月 | ? | ?天 | ? |
| ... | ... | ... | ... |
| 12 月 | ? | ?天 | ? |

并提供季度总结：
| 季节 | 优势 | 劣势 | 最佳用途 |
|------|-----|------|---------|
| 春季 | ? | ? | ? |
| 夏季 | ? | ? | ? |
| 秋季 | ? | ? | ? |
| 冬季 | ? | ? | ? |

## 任务 3：阳台功能适配建议（请按分类回答）

### 🌱 植物种植推荐
- **强烈推荐的植物**（列出 5-8 种，标注所需日照时长）
- **不推荐的植物**（原因说明）
- **各季节种植时间表**

### 🧺 晾晒衣物分析
| 季节 | 晾衣适宜度 | 最佳时段 | 注意事项 |
|------|-----------|---------|---------|
| 春季 | 高/中/低 | ? | ? |
| 夏季 | 高/中/低 | ? | ? |
| 秋季 | 高/中/低 | ? | ? |
| 冬季 | 高/中/低 | ? | ? |
- 全年可晒被褥天数估算：?天

### ☕ 休闲使用建议
- 最佳休息时段（工作日/周末）
- 舒适度评分（1-10 分）
- 需要避开的时段及原因

### 🔧 改造优化建议
- 低成本改善方案（预算<500 元）
- 中等投入方案（预算 500-3000 元）
- 专业改造方案（预算>3000 元）

## 任务 4：综合评分与结论

请以星级评分形式总结：
| 评估维度 | 评分 | 理由 |
|---------|-----|------|
| 日照充足度 | ⭐⭐⭐⭐⭐ | ? |
| 四季均衡性 | ⭐⭐⭐⭐⭐ | ? |
| 晾晒实用性 | ⭐⭐⭐⭐⭐ | ? |
| 种植适宜度 | ⭐⭐⭐⭐⭐ | ? |
| 休闲舒适度 | ⭐⭐⭐⭐⭐ | ? |
| **综合推荐指数** | ⭐⭐⭐⭐⭐ | ? |

=== 输出要求 ===
- 所有数据和对比必须用表格呈现
- 文字解释要简洁实用
- 结合中国气候特点给出具体建议
- 避免空泛理论，多给可操作性强的建议`;
    }

    /**
     * 获取方位描述
     */
    getCompassDirection(angle) {
        if (angle === null || angle === undefined) return '未知';
        angle = parseFloat(angle);
        if (isNaN(angle)) return '无效';
        
        const directions = [
            { name: '北', range: [337.5, 22.5] },
            { name: '东北', range: [22.5, 67.5] },
            { name: '东', range: [67.5, 112.5] },
            { name: '东南', range: [112.5, 157.5] },
            { name: '南', range: [157.5, 202.5] },
            { name: '西南', range: [202.5, 247.5] },
            { name: '西', range: [247.5, 292.5] },
            { name: '西北', range: [292.5, 337.5] }
        ];
        
        for (const dir of directions) {
            const [min, max] = dir.range;
            if ((angle >= min && angle <= max) || 
                (min > max && (angle >= min || angle <= max))) {
                return dir.name;
            }
        }
        return '北';
    }

    /**
     * 复制提示词到剪贴板
     */
    async copyPromptToClipboard(appState) {
        const prompt = this.generatePrompt(appState);
        try {
            await navigator.clipboard.writeText(prompt);
            window.showToast(window.Config.get('toast.copied', '✅ 已复制'));
            return true;
        } catch (err) {
            console.error('复制失败:', err);
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = prompt;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                window.showToast(window.Config.get('toast.copied', '✅ 已复制'));
                return true;
            } catch (e) {
                window.showToast('❌ 复制失败');
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }

    /**
     * 打开 AI 平台
     */
    async openPlatform(platform, appState) {
        await this.copyPromptToClipboard(appState);
        setTimeout(() => this.openPlatformLink(platform), 800);
    }

    /**
     * 根据设备类型打开链接
     */
    openPlatformLink(platform) {
        const platformConfig = this.platforms[platform];
        if (!platformConfig) {
            console.error('未知的 AI 平台:', platform);
            return;
        }

        const ua = navigator.userAgent.toLowerCase();
        const isMobile = /android|iphone|ipad|mobile/.test(ua);

        if (isMobile) {
            window.location.href = platformConfig.scheme;
            setTimeout(() => {
                if (document.hidden) {
                    window.location.href = platformConfig.url;
                }
            }, 500);
        } else {
            window.open(platformConfig.url, '_blank');
        }
    }

    /**
     * 初始化 AI 助手按钮事件
     */
    init() {
        const copyBtn = document.getElementById('copyPromptBtn');
        if (copyBtn) {
            copyBtn.onclick = () => this.copyPromptToClipboard(window.AppState);
        }

        // 为每个平台按钮绑定事件
        document.querySelectorAll('.btn-ai-platform').forEach(btn => {
            btn.onclick = () => {
                const platform = btn.dataset.platform;
                this.openPlatform(platform, window.AppState);
            };
        });
    }
}

// 导出到全局
window.AIAssistant = new AIAssistant();
