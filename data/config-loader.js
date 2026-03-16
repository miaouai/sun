/**
 * 配置加载模块
 * 负责从 data/config.json 加载应用配置并管理全局访问
 */

class ConfigManager {
    constructor() {
        this.config = null;
        this.loaded = false;
        this.callbacks = [];
    }

    /**
     * 异步加载配置文件
     */
    async load(configPath = 'data/config.json') {
        if (this.loaded) return this.config;

        try {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.config = await response.json();
            this.loaded = true;
            
            // 触发所有等待的回调
            this.callbacks.forEach(cb => cb(this.config));
            console.log('✅ 配置加载完成');
            return this.config;
        } catch (error) {
            console.error('❌ 配置加载失败:', error);
            this.loaded = false;
            throw error;
        }
    }

    /**
     * 获取配置项（支持嵌套路径）
     * @example config.get('ui.sections.balconyConfig.title')
     */
    get(path, defaultValue = undefined) {
        if (!this.loaded || !this.config) {
            console.warn('⚠️ 配置未加载，返回默认值:', defaultValue);
            return defaultValue;
        }

        const keys = path.split('.');
        let result = this.config;
        
        for (const key of keys) {
            if (result && typeof result === 'object' && key in result) {
                result = result[key];
            } else {
                return defaultValue;
            }
        }
        
        return result;
    }

    /**
     * 等待配置加载完成后执行回调
     */
    onReady(callback) {
        if (this.loaded && this.config) {
            callback(this.config);
        } else {
            this.callbacks.push(callback);
        }
    }

    /**
     * 检查是否已加载
     */
    isLoaded() {
        return this.loaded;
    }
}

// 创建单例实例并导出到全局
window.Config = new ConfigManager();
