"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeStatus = void 0;
// 节点执行状态
var NodeStatus;
(function (NodeStatus) {
    NodeStatus["Pending"] = "pending";
    NodeStatus["Running"] = "running";
    NodeStatus["Success"] = "success";
    NodeStatus["Error"] = "error";
})(NodeStatus || (exports.NodeStatus = NodeStatus = {}));
