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
  console.log('[invokeIpc] Calling channel:', channel, 'with args:', args);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 6000000);

    const messageHandler = (event) => {
      const data = event.data || {};
      if (data.source === 'host' && data.id === id) {
        console.log('[invokeIpc] Received response for id:', id, 'data:', data);
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
