window.onload = async () => {
  const pluginContainer = document.getElementById('plugin-container');
  const pluginNav = document.getElementById('plugin-nav');
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-btn');
  const welcomePage = document.getElementById('welcome-page');

  // 侧边栏折叠功能
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Toggle button clicked');
    sidebar.classList.toggle('collapsed');
    console.log('Sidebar collapsed:', sidebar.classList.contains('collapsed'));
  });

  // 获取插件页面路径（支持开发环境和打包环境）
  async function getPluginPaths(pluginName) {
    // 默认路径（开发环境）
    let htmlPath = `./plugins/${pluginName}/frontend/index.html`;
    let jsPath = `./plugins/${pluginName}/frontend/main.js`;
    let cssPath = `./plugins/${pluginName}/frontend/style.css`;
    
    // 打包环境路径 - 通过 IPC 获取正确的路径
    if (window.electronAPI && window.electronAPI.getPluginResourcePath) {
      try {
        const resourcePath = await window.electronAPI.getPluginResourcePath(pluginName);
        if (resourcePath) {
          htmlPath = `${resourcePath}/frontend/index.html`;
          jsPath = `${resourcePath}/frontend/main.js`;
          cssPath = `${resourcePath}/frontend/style.css`;
        }
      } catch (error) {
        console.error('Error getting plugin resource path:', error);
      }
    }
    return { htmlPath, jsPath, cssPath };
  }

  // CSS样式隔离工具类
  class StyleIsolator {
    constructor(pluginName) {
      this.pluginName = pluginName;
      this.styleElement = null;
      this.isolatedStyles = new Set();
    }

    // 清理之前的样式
    cleanup() {
      if (this.styleElement) {
        this.styleElement.remove();
        this.styleElement = null;
      }
      this.isolatedStyles.clear();
    }

    // 创建隔离的样式元素
    createStyleElement() {
      this.styleElement = document.createElement('style');
      this.styleElement.setAttribute('data-plugin', this.pluginName);
      this.styleElement.setAttribute('data-isolated', 'true');
      document.head.appendChild(this.styleElement);
      return this.styleElement;
    }

    // 隔离CSS样式
    isolateStyles(cssText) {
      if (!cssText || typeof cssText !== 'string') return '';
      
      try {
        // 创建临时元素来解析CSS
        const tempStyle = document.createElement('style');
        tempStyle.textContent = cssText;
        document.head.appendChild(tempStyle);
        
        // 获取所有样式规则
        const rules = Array.from(tempStyle.sheet.cssRules);
        document.head.removeChild(tempStyle);
        
        // 为每个规则添加插件前缀
        const isolatedRules = rules.map(rule => {
          if (rule instanceof CSSStyleRule) {
            return this.isolateSelector(rule.selectorText, rule.cssText);
          } else if (rule instanceof CSSMediaRule) {
            return this.isolateMediaRule(rule);
          } else {
            return rule.cssText;
          }
        });
        
        const result = isolatedRules.join('\n');
        console.log(`[StyleIsolator] Processed ${rules.length} CSS rules for plugin ${this.pluginName}`);
        return result;
      } catch (error) {
        console.warn(`[StyleIsolator] Failed to isolate styles for plugin ${this.pluginName}:`, error);
        return cssText; // 如果解析失败，返回原始CSS
      }
    }

    // 隔离选择器
    isolateSelector(selector, fullRule) {
      const pluginPrefix = `[data-plugin-container="${this.pluginName}"]`;
      
      // 处理复杂选择器
      const selectors = selector.split(',').map(s => s.trim());
      const isolatedSelectors = selectors.map(sel => {
        // 避免重复添加前缀
        if (sel.includes('[data-plugin-container=')) {
          return sel;
        }
        
        // 处理特殊选择器
        if (sel.startsWith('html') || sel.startsWith('body')) {
          return sel.replace(/^(html|body)/, `${pluginPrefix}`);
        }
        
        // 处理全局选择器
        if (sel === '*' || sel === 'html' || sel === 'body') {
          return `${pluginPrefix} *`;
        }
        
        return `${pluginPrefix} ${sel}`;
      });
      
      return fullRule.replace(selector, isolatedSelectors.join(', '));
    }

    // 隔离媒体查询规则
    isolateMediaRule(mediaRule) {
      const isolatedRules = Array.from(mediaRule.cssRules).map(rule => {
        if (rule instanceof CSSStyleRule) {
          return this.isolateSelector(rule.selectorText, rule.cssText);
        }
        return rule.cssText;
      });
      
      return `@media ${mediaRule.conditionText} {\n${isolatedRules.join('\n')}\n}`;
    }

    // 加载并隔离CSS文件
    async loadIsolatedCSS(cssPath) {
      try {
        const response = await fetch(cssPath);
        if (!response.ok) {
          console.warn(`CSS file not found: ${cssPath}`);
          return;
        }
        
        const cssText = await response.text();
        const isolatedCSS = this.isolateStyles(cssText);
        
        if (isolatedCSS) {
          const styleElement = this.createStyleElement();
          styleElement.textContent = isolatedCSS;
        }
      } catch (error) {
        console.warn(`Failed to load CSS for plugin ${this.pluginName}:`, error);
      }
    }

    // 处理内联样式
    processInlineStyles(container) {
      const elements = container.querySelectorAll('*');
      elements.forEach(element => {
        if (element.style && element.style.cssText) {
          // 为内联样式添加插件前缀
          const originalStyles = element.style.cssText;
          element.setAttribute('data-original-style', originalStyles);
        }
      });
    }

    // 处理HTML中的style标签
    processStyleTags(container) {
      const styleTags = container.querySelectorAll('style');
      styleTags.forEach(styleTag => {
        if (styleTag.textContent) {
          const isolatedCSS = this.isolateStyles(styleTag.textContent);
          if (isolatedCSS) {
            styleTag.textContent = isolatedCSS;
          }
        }
      });
    }
  }

  // 创建插件导航项
  function createPluginNavItem(plugin) {
    const navItem = document.createElement('div');
    navItem.className = 'nav-item';
    navItem.id = `${plugin.name}-nav-item`;
    
    navItem.innerHTML = `
      <div class="nav-item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <span class="nav-item-text">${plugin.name}</span>
    `;
    
    navItem.addEventListener('click', async () => {
      // 移除其他活动状态
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });
      
      // 添加当前活动状态
      navItem.classList.add('active');
      
      // 启动插件进程
      if (window.electronAPI && window.electronAPI.startPluginProcess) {
        await window.electronAPI.startPluginProcess(plugin.name);
      }
      
      // 加载插件页面
      await loadPluginPage(plugin.name);
    });
    
    return navItem;
  }

  // 全局样式隔离器管理
  const styleIsolators = new Map();

  // 加载插件页面
  async function loadPluginPage(pluginName) {
    const { htmlPath, jsPath, cssPath } = await getPluginPaths(pluginName);
    
    try {
      // 清理之前的样式
      if (styleIsolators.has(pluginName)) {
        styleIsolators.get(pluginName).cleanup();
      }
      
      // 创建新的样式隔离器
      const isolator = new StyleIsolator(pluginName);
      styleIsolators.set(pluginName, isolator);
      
      const response = await fetch(htmlPath);
      if (!response.ok) {
        throw new Error(`Failed to load plugin HTML: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // 隐藏欢迎页面，显示插件容器
      welcomePage.style.display = 'none';
      pluginContainer.style.display = 'block';
      
      // 为插件容器添加标识
      pluginContainer.setAttribute('data-plugin-container', pluginName);
      
      // 加载插件HTML
      pluginContainer.innerHTML = html;
      
      // 处理HTML中的style标签
      isolator.processStyleTags(pluginContainer);
      
      // 处理内联样式
      isolator.processInlineStyles(pluginContainer);
      
      // 加载并隔离CSS
      await isolator.loadIsolatedCSS(cssPath);
      
      // 加载插件JavaScript
      const script = document.createElement('script');
      script.src = jsPath;
      script.setAttribute('data-plugin', pluginName);
      script.setAttribute('data-isolated', 'true');
      pluginContainer.appendChild(script);
      
    } catch (error) {
      console.error('Error loading plugin:', error);
      pluginContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ff6b6b;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; margin-bottom: 16px;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h3 style="margin-bottom: 16px; color: #ffffff;">插件加载失败</h3>
          <p style="margin-bottom: 8px; color: #cccccc;">错误信息: ${error.message}</p>
          <p style="color: #888888;">尝试路径: ${htmlPath}</p>
        </div>
      `;
      
      welcomePage.style.display = 'none';
      pluginContainer.style.display = 'block';
    }
  }

  // 渲染插件导航
  async function renderPluginNav() {
    if (pluginNav) pluginNav.innerHTML = '';
    
    const plugins = await window.electronAPI.getPluginsStatus();
    
    if (plugins.length === 0) {
      pluginNav.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #888888;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin-bottom: 8px;">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 12h8"/>
            <path d="M12 8v8"/>
          </svg>
          <p style="font-size: 12px;">暂无可用插件</p>
        </div>
      `;
      return;
    }
    
    // 创建插件分组
    const navSection = document.createElement('div');
    navSection.className = 'nav-section';
    
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'nav-section-title';
    sectionTitle.textContent = 'Available Plugins';
    navSection.appendChild(sectionTitle);
    
    // 添加插件导航项
    for (const plugin of plugins) {
      const navItem = createPluginNavItem(plugin);
      navSection.appendChild(navItem);
    }
    
    pluginNav.appendChild(navSection);
  }

  // 初始化
  await renderPluginNav();

  // 监听插件解压完成事件，刷新导航状态
  if (window.electronAPI && window.electronAPI.onPluginUnzipped) {
    window.electronAPI.onPluginUnzipped(async (pluginName) => {
      await renderPluginNav();
    });
  }

  // 添加返回欢迎页面的功能
  function showWelcomePage() {
    welcomePage.style.display = 'flex';
    pluginContainer.style.display = 'none';
    
    // 清理所有插件的样式
    styleIsolators.forEach(isolator => {
      isolator.cleanup();
    });
    styleIsolators.clear();
    
    // 移除插件容器标识
    pluginContainer.removeAttribute('data-plugin-container');
    
    // 移除所有活动状态
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
  }

  // 在欢迎页面点击时显示欢迎页面
  welcomePage.addEventListener('click', showWelcomePage);
}; 