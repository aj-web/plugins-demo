window.onload = async () => {
  const pluginContainer = document.getElementById('plugin-container');
  const menuBar = document.getElementById('menu-bar');

  // 获取插件页面路径（支持开发环境和打包环境）
  async function getPluginPaths(pluginName) {
    // 默认路径（开发环境）
    let htmlPath = `./plugins/${pluginName}/frontend/index.html`;
    let jsPath = `./plugins/${pluginName}/frontend/main.js`;
    
    // 打包环境路径 - 通过 IPC 获取正确的路径
    if (window.electronAPI && window.electronAPI.getPluginResourcePath) {
      try {
        const resourcePath = await window.electronAPI.getPluginResourcePath(pluginName);
        if (resourcePath) {
          htmlPath = `${resourcePath}/frontend/index.html`;
          jsPath = `${resourcePath}/frontend/main.js`;
        }
      } catch (error) {
        console.error('Error getting plugin resource path:', error);
      }
    }
    return { htmlPath, jsPath };
  }

  // 渲染插件入口按钮
  async function renderPluginButtons() {
    if (menuBar) menuBar.innerHTML = '';
    const plugins = await window.electronAPI.getPluginsStatus();
    for (const plugin of plugins) {
      const btn = document.createElement('button');
      btn.id = `${plugin.name}-btn`;
      btn.innerText = plugin.name;
      btn.onclick = async () => {
        if (window.electronAPI && window.electronAPI.startPluginProcess) {
          await window.electronAPI.startPluginProcess(plugin.name);
        }
        
        const { htmlPath, jsPath } = await getPluginPaths(plugin.name);
        
        fetch(htmlPath)
          .then(res => {
            if (!res.ok) {
              throw new Error(`Failed to load plugin HTML: ${res.status} ${res.statusText}`);
            }
            return res.text();
          })
          .then(html => {
            pluginContainer.innerHTML = html;
            const script = document.createElement('script');
            script.src = jsPath;
            script.setAttribute('data-plugin', plugin.name);
            pluginContainer.appendChild(script);
          })
          .catch(error => {
            console.error('Error loading plugin:', error);
            pluginContainer.innerHTML = `<div style="padding: 20px; color: red;">
              <h3>插件加载失败</h3>
              <p>错误信息: ${error.message}</p>
              <p>尝试路径: ${htmlPath}</p>
            </div>`;
          });
      };
      if (menuBar) menuBar.appendChild(btn);
    }
  }

  await renderPluginButtons();

  // 监听插件解压完成事件，刷新入口状态
  if (window.electronAPI && window.electronAPI.onPluginUnzipped) {
    window.electronAPI.onPluginUnzipped(async (pluginName) => {
      await renderPluginButtons();
    });
  }
}; 