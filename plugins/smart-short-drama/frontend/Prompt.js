// Reusable Prompt modal and toast helpers for smart-short-drama frontend
// Usage:
// import { showPrompt, showToast } from './Prompt.js'
// await showPrompt({ title: '确认', message: '确定要执行吗？' })
// showToast({ message: '保存成功', type: 'success', duration: 3000 })

const { createApp, h, ref } = Vue;

function createModalApp(options, resolve) {
  const title = options.title || '';
  const message = options.message || '';
  const confirmText = options.confirmText || '确定';
  const cancelText = options.cancelText || '取消';
  const showCancel = options.showCancel !== false;
  const type = options.type || 'info'; // info | success | warning | danger

  return {
    setup() {
      const visible = ref(true);

      const doClose = (result) => {
        visible.value = false;
        setTimeout(() => {
          resolve(result);
        }, 50);
      };

      const onConfirm = () => doClose({ action: 'confirm' });
      const onCancel = () => doClose({ action: 'cancel' });

      const icon = () => {
        switch (type) {
          case 'success':
            return h('div', { class: 'w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center' }, '✓');
          case 'warning':
            return h('div', { class: 'w-8 h-8 rounded-full bg-warning/10 text-warning flex items-center justify-center' }, '!');
          case 'danger':
            return h('div', { class: 'w-8 h-8 rounded-full bg-danger/10 text-danger flex items-center justify-center' }, '✕');
          default:
            return h('div', { class: 'w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center' }, 'i');
        }
      };

      return () =>
        h(
          'div',
          { class: 'fixed inset-0 z-50 flex items-center justify-center' },
          [
            h('div', {
              class: 'absolute inset-0 bg-black/40',
              onClick: showCancel ? onCancel : undefined
            }),
            h('div', { class: 'relative bg-white rounded-lg shadow-xl w-[min(720px,90vw)] mx-4' }, [
              h('div', { class: 'p-6 flex gap-4' }, [
                h('div', { class: 'flex-shrink-0' }, [icon()]),
                h('div', { class: 'flex-1' }, [
                  title ? h('h3', { class: 'text-lg font-semibold text-textMain mb-2' }, title) : null,
                  message ? h('div', { class: 'text-sm text-textSecondary' }, message) : null
                ])
              ]),
              h('div', { class: 'px-6 pb-6 flex justify-end gap-3' }, [
                showCancel
                  ? h('button', { class: 'px-4 py-2 bg-white border border-secondary rounded text-sm text-textSecondary hover:border-primary hover:text-primary', onClick: onCancel }, cancelText)
                  : null,
                h('button', { class: 'px-4 py-2 bg-primary text-white rounded text-sm hover:bg-blue-600', onClick: onConfirm }, confirmText)
              ])
            ])
          ]
        );
    }
  };
}

function createToastApp(options, resolve) {
  const message = options.message || '';
  const duration = typeof options.duration === 'number' ? options.duration : 3000;
  const type = options.type || 'info'; // info | success | warning | danger

  return {
    setup() {
      const visible = ref(true);

      const bgClass = () => {
        switch (type) {
          case 'success':
            return 'bg-success/10 text-success border border-success/20';
          case 'warning':
            return 'bg-warning/10 text-warning border border-warning/20';
          case 'danger':
            return 'bg-danger/10 text-danger border border-danger/20';
          default:
            return 'bg-primary/10 text-primary border border-primary/20';
        }
      };

      // auto close
      setTimeout(() => {
        visible.value = false;
        setTimeout(() => resolve({ action: 'closed' }), 200);
      }, duration);

      return () =>
        h('div', { class: ['max-w-sm w-full rounded-md shadow-md p-3 mb-3 flex items-start gap-3', bgClass()] }, [
          h('div', { class: 'flex-1' }, [
            h('div', { class: 'text-sm' }, message)
          ])
        ]);
    }
  };
}

export function showToast(options = {}) {
  return new Promise((resolve) => {
    // ensure container
    let container = document.getElementById('ssdr-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ssdr-toast-container';
      container.style.position = 'fixed';
      container.style.top = '20px';
      container.style.right = '20px';
      container.style.zIndex = '60';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'flex-end';
      document.body.appendChild(container);
    }

    const wrapper = document.createElement('div');
    container.appendChild(wrapper);

    const appDef = createToastApp(options, (result) => {
      try {
        app.unmount();
      } catch (e) { }
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      resolve(result);
    });
    const app = createApp(appDef);
    app.mount(wrapper);
  });
}

export function showPrompt(options = {}) {
  // mode: 'modal' (default) or 'toast'
  if (options.mode === 'toast') {
    return showToast(options);
  }
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const appDef = createModalApp(options, (result) => {
      try {
        app.unmount();
      } catch (e) { }
      if (container.parentNode) container.parentNode.removeChild(container);
      resolve(result);
    });
    const app = createApp(appDef);
    app.mount(container);
  });
}

export default { showPrompt, showToast };


