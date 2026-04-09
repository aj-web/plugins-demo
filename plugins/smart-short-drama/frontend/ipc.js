// 统一的前端 IPC/事件调用封装：提供 triggerEvent 与 invokeIpc

let seq = 0; // 全局自增 id，用于匹配请求与响应

// 前端 postMessage 方式调用后端事件（插件宿主处理 action: 'trigger-event'）
export const triggerEvent = async (eventType, params = {}) => {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 6000000);

    const messageHandler = (event) => {
      const data = event.data || {};
      if (data.source === 'host' && data.id === id) {
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);

        if (data.success) {
          resolve(data.result);
        } else {
          reject(new Error(data.error || '未知错误'));
        }
      }
    };

    window.addEventListener('message', messageHandler);

    const payload = {
      source: 'plugin-frontend',
      action: 'trigger-event',
      id,
      payload: { eventType, params }
    };
    console.log('[triggerEvent:send]', payload);
    window.parent.postMessage(payload, '*');
  });
};

// 通过 postMessage 调用 IPC（插件宿主处理 action: 'ipc-invoke'）
export const invokeIpc = async (channel, args = []) => {
  // 只在非 read-json-file 调用时打印日志，避免轮询日志过多
  if (channel !== 'read-json-file') {
    console.log('[invokeIpc] Calling channel:', channel, 'with args:', args);
  }
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 6000000);

    const messageHandler = (event) => {
      const data = event.data || {};
      if (data.source === 'host' && data.id === id) {
        // 只在出错或非 read-json-file 时打印响应日志
        if (!data.success || channel !== 'read-json-file') {
          console.log('[invokeIpc] Received response for id:', id, 'channel:', channel, 'success:', data.success);
        }
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);

        if (data.success) {
          resolve(data.result);
        } else {
          reject(new Error(data.error || '未知错误'));
        }
      }
    };

    window.addEventListener('message', messageHandler);

    window.parent.postMessage(
      {
        source: 'plugin-frontend',
        action: 'ipc-invoke',
        id,
        payload: { channel, args }
      },
      '*'
    );
  });
};

/**
 * IPC 响应规范化工具
 *
 * 预期的 IPC 响应格式：
 *  - 成功: { success: true, result: <业务结果> }
 *  - 失败: { success: false, error: '错误信息' }
 *
 * unwrapIpcResponse(res) 会：
 *  - 当 res 为空时抛出错误
 *  - 当 success === false 时抛出错误（包含 error 信息）
 *  - 否则返回 res.result（业务结果）
 *
 * @param {Object} ipcRes - IPC 响应对象
 * @returns {any} 业务结果
 * @throws {Error} 当响应为空或失败时
 */
export function unwrapIpcResponse(ipcRes) {
  if (ipcRes == null) {
    throw new Error('No IPC response received');
  }

  // 顶层 IPC 失败（plugin_host 捕获到异常）
  if (ipcRes.success === false) {
    const errMsg = ipcRes.error || 'IPC error';
    throw new Error(errMsg);
  }

  // IPC 层成功 — 返回插件业务结果（业务结果本身可能表示失败）
  return ipcRes.result;
}
