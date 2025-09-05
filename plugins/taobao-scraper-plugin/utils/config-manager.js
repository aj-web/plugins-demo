"use strict";
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class ConfigManager {
    constructor(configFileName = 'taobao-crawler-config.json') {
        this.configPath = path.join(os.homedir(), '.taobao-crawler', configFileName);
        this.config = {};
        this.ensureConfigDirectory();
        this.loadConfig();
    }
    ensureConfigDirectory() {
        const configDir = path.dirname(this.configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
    }
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                this.config = JSON.parse(data);
                console.log(`[ConfigManager] 已加载配置文件: ${this.configPath}`);
            }
            else {
                console.log(`[ConfigManager] 配置文件不存在，使用默认配置: ${this.configPath}`);
                this.saveConfig();
            }
        }
        catch (error) {
            console.error(`[ConfigManager] 加载配置文件失败: ${error.message}`);
            this.config = {};
        }
    }
    saveConfig() {
        try {
            const data = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(this.configPath, data, 'utf8');
            console.log(`[ConfigManager] 配置文件已保存: ${this.configPath}`);
        }
        catch (error) {
            console.error(`[ConfigManager] 保存配置文件失败: ${error.message}`);
        }
    }
    get(key, defaultValue) {
        const keys = key.split('.');
        let value = this.config;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            }
            else {
                return defaultValue;
            }
        }
        return value;
    }
    set(key, value) {
        const keys = key.split('.');
        let current = this.config;
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }
        current[keys[keys.length - 1]] = value;
        this.saveConfig();
    }
    delete(key) {
        const keys = key.split('.');
        let current = this.config;
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== 'object') {
                return false;
            }
            current = current[k];
        }
        const lastKey = keys[keys.length - 1];
        if (lastKey in current) {
            delete current[lastKey];
            this.saveConfig();
            return true;
        }
        return false;
    }
    getAll() {
        return { ...this.config };
    }
    reset() {
        this.config = {};
        this.saveConfig();
    }
    has(key) {
        const keys = key.split('.');
        let current = this.config;
        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            }
            else {
                return false;
            }
        }
        return true;
    }
}
exports.ConfigManager = ConfigManager;
