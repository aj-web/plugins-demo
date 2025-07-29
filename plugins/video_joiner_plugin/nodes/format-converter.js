"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormatConverterNode = void 0;
/**
 * 格式转换节点
 * 负责将视频文件转换为指定格式
 */
class FormatConverterNode {
    constructor(config) {
        this.config = config || {};
    }
    setContext(ctx) {
        this.context = ctx;
    }
    async execute(input) {
        this.context?.logger?.info('FormatConverterNode---MOCK格式转换通过');
        return {};
    }
}
exports.FormatConverterNode = FormatConverterNode;
