"use strict";
/**
 * 配置管理类
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const path = __importStar(require("path"));
const file_utils_1 = require("./file-utils");
class ConfigManager {
    constructor() {
        this.configPath = path.join(process.cwd(), 'config.json');
        this.config = this.loadDefaultConfig();
        this.loadConfig();
    }
    /**
     * 获取单例实例
     */
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    /**
     * 获取配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
    }
    /**
     * 获取浏览器配置
     */
    getBrowserConfig() {
        return { ...this.config.browser };
    }
    /**
     * 获取搜索配置
     */
    getSearchConfig() {
        return { ...this.config.search };
    }
    /**
     * 获取工作流配置
     */
    getWorkflowConfig() {
        return { ...this.config.workflow };
    }
    /**
     * 加载默认配置
     */
    loadDefaultConfig() {
        return {
            browser: {
                headless: false,
                viewport: {
                    width: 1920,
                    height: 1080
                },
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                args: [
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-web-security",
                    "--disable-dev-shm-usage",
                    "--disable-gpu"
                ],
                timeout: 30000
            },
            search: {
                maxResults: 50,
                delay: 1000,
                retryCount: 3,
                timeout: 30000
            },
            workflow: {
                autoLogin: false,
                saveScreenshots: true,
                saveResults: true,
                outputDir: "./output"
            }
        };
    }
    /**
     * 加载配置文件
     */
    loadConfig() {
        const savedConfig = file_utils_1.FileUtils.loadJsonFromFile(this.configPath);
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig };
        }
    }
    /**
     * 保存配置到文件
     */
    saveConfig() {
        file_utils_1.FileUtils.saveJsonToFile(this.config, this.configPath);
    }
    /**
     * 重置为默认配置
     */
    resetToDefault() {
        this.config = this.loadDefaultConfig();
        this.saveConfig();
    }
    /**
     * 验证配置
     */
    validateConfig() {
        const errors = [];
        // 验证浏览器配置
        if (this.config.browser.viewport.width < 800 || this.config.browser.viewport.height < 600) {
            errors.push("Viewport size too small");
        }
        if (this.config.browser.timeout && this.config.browser.timeout < 5000) {
            errors.push("Browser timeout too short");
        }
        // 验证搜索配置
        if (this.config.search.maxResults < 1 || this.config.search.maxResults > 1000) {
            errors.push("Max results should be between 1 and 1000");
        }
        if (this.config.search.delay < 0) {
            errors.push("Delay cannot be negative");
        }
        if (this.config.search.retryCount < 0 || this.config.search.retryCount > 10) {
            errors.push("Retry count should be between 0 and 10");
        }
        // 验证工作流配置
        if (!this.config.workflow.outputDir) {
            errors.push("Output directory is required");
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * 获取配置摘要
     */
    getConfigSummary() {
        return {
            browser: {
                headless: this.config.browser.headless,
                viewport: this.config.browser.viewport,
                timeout: this.config.browser.timeout
            },
            search: {
                maxResults: this.config.search.maxResults,
                delay: this.config.search.delay,
                retryCount: this.config.search.retryCount
            },
            workflow: {
                autoLogin: this.config.workflow.autoLogin,
                saveScreenshots: this.config.workflow.saveScreenshots,
                saveResults: this.config.workflow.saveResults,
                outputDir: this.config.workflow.outputDir
            }
        };
    }
}
exports.ConfigManager = ConfigManager;
