/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

(function () {
    // 获取当前插件名
    const currentScript = document.currentScript || (function () {
        const scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();
    const pluginName = 'video_joiner_plugin';
    let selectedFolder = '';
    let selectedFolderIndex = -1;
    // 选择文件夹
    const selectFolderBtn = document.getElementById('select-folder-btn');
    if (selectFolderBtn) {
        selectFolderBtn.onclick = async () => {
            if (window.electronAPI && window.electronAPI.selectFolder) {
                selectedFolder = await window.electronAPI.selectFolder();
            }
            else if (window.electronAPI.selectFile) {
                selectedFolder = await window.electronAPI.selectFile();
            }
            const currentDir = document.getElementById('current-dir');
            if (currentDir) {
                currentDir.innerText = selectedFolder || '未选择文件夹';
                if (selectedFolder) {
                    currentDir.style.color = '#1a1a1a';
                }
                else {
                    currentDir.style.color = '#666';
                }
            }
        };
    }
    // 分析文件夹按钮
    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.onclick = async () => {
            if (!selectedFolder) {
                showNotification('请先选择文件夹', 'warning');
                return;
            }
            // 显示加载状态
            analyzeBtn.disabled = true;
            const originalText = analyzeBtn.innerHTML;
            analyzeBtn.innerHTML = '<span class="spinner"></span> 分析中...';
            try {
                const result = await window.electronAPI.eventBus.trigger('analyze-folders', { args: [selectedFolder] }, pluginName);
                renderAnalyzeResult(result.result);
                showNotification('文件夹分析完成', 'success');
            }
            catch (error) {
                showNotification('分析失败: ' + error, 'error');
            }
            finally {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = originalText;
            }
        };
    }
    // 停止处理按钮
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
        stopBtn.onclick = async () => {
            stopBtn.disabled = true;
            await window.electronAPI.eventBus.trigger('stop-processing', {}, pluginName);
        };
    }
    // 开始处理按钮
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.onclick = async () => {
            if (!selectedFolder) {
                showNotification('请先选择文件夹', 'warning');
                return;
            }
            let allTasks = [];
            if (window._lastAnalyzeResult && window._lastAnalyzeResult.matchedPairs) {
                window._lastAnalyzeResult.matchedPairs.forEach((pair) => {
                    if (pair.tasks && pair.tasks.length > 0) {
                        allTasks = allTasks.concat(pair.tasks);
                    }
                });
            }
            if (allTasks.length === 0) {
                showNotification('没有可处理的任务，请先分析文件夹！', 'warning');
                return;
            }
            window._isStopped = false;
            setProgressLoading();
            startBtn.disabled = true;
            showBtnSpinner(true);
            if (stopBtn)
                stopBtn.disabled = false;
            try {
                const result = await window.electronAPI.eventBus.trigger('process-tasks', { args: [allTasks] }, pluginName);
                console.log('frontend runBusiness finished, _isStopped:', window._isStopped);
                if (!window._isStopped) {
                    setProgressDone();
                    showNotification('处理完成！', 'success');
                }
            }
            catch (error) {
                showNotification('处理失败: ' + error, 'error');
            }
            finally {
                startBtn.disabled = false;
                showBtnSpinner(false);
                if (stopBtn)
                    stopBtn.disabled = true;
            }
        };
    }
    if (window.electronAPI && window.electronAPI.onBusinessStopped) {
        window.electronAPI.onBusinessStopped(() => {
            window._isStopped = true;
            if (startBtn)
                startBtn.disabled = false;
            showBtnSpinner(false);
            if (stopBtn)
                stopBtn.disabled = true;
            showNotification('停止处理成功', 'info');
            console.log('frontend stopped received');
        });
    }
    function setProgressLoading() {
        const progress = document.getElementById('progress-inner');
        if (progress) {
            progress.style.width = '60%';
            progress.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
        }
        const statProgress = document.getElementById('stat-progress');
        if (statProgress)
            statProgress.innerText = '0/0';
    }
    function setProgressDone() {
        const progress = document.getElementById('progress-inner');
        if (progress) {
            progress.style.width = '100%';
            progress.style.background = 'linear-gradient(90deg, #52c41a 0%, #389e0d 100%)';
        }
        const statProgress = document.getElementById('stat-progress');
        if (statProgress)
            statProgress.innerText = '100%';
    }
    function showBtnSpinner(show) {
        let spinner = document.getElementById('start-btn-spinner');
        let text = document.getElementById('start-btn-text');
        if (show) {
            if (!spinner) {
                spinner = document.createElement('span');
                spinner.id = 'start-btn-spinner';
                spinner.className = 'spinner';
                if (startBtn)
                    startBtn.appendChild(spinner);
            }
            spinner.style.display = 'inline-block';
            if (text)
                text.innerText = '处理中...';
        }
        else {
            if (spinner)
                spinner.style.display = 'none';
            if (text)
                text.innerText = '开始处理';
        }
    }
    // 显示通知
    function showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        // 根据类型设置样式
        const colors = {
            success: '#52c41a',
            error: '#ff4d4f',
            warning: '#faad14',
            info: '#1890ff'
        };
        notification.style.background = colors[type];
        notification.textContent = message;
        document.body.appendChild(notification);
        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        // 自动隐藏
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    // 渲染分析结果到页面
    function renderAnalyzeResult(result) {
        window._lastAnalyzeResult = result;
        // 渲染左侧配对
        const folderList = document.getElementById('folder-list');
        if (folderList) {
            let html = '';
            if (result.matchedPairs && result.matchedPairs.length > 0) {
                html += result.matchedPairs.map((pair, idx) => `
                    <div class="folder-item" data-idx="${idx}">
                        <div class="folder-item-header">
                            <div class="folder-item-title">配对 ${idx + 1}</div>
                            <div class="folder-item-count">${pair.tasks ? pair.tasks.length : 0} 任务</div>
                        </div>
                        <div class="folder-item-details">
                            <div>前贴: ${pair.intro}</div>
                            <div>正片: ${pair.main}</div>
                        </div>
                    </div>
                `).join('');
            }
            else {
                html = `
                    <div class="empty-state">
                        <div class="empty-icon">📁</div>
                        <div class="empty-title">未找到匹配</div>
                        <div class="empty-description">请检查文件夹命名格式</div>
                    </div>
                `;
            }
            // 添加未匹配项
            if (result.unmatchedIntro && result.unmatchedIntro.length > 0 ||
                result.unmatchedMain && result.unmatchedMain.length > 0) {
                html += '<div class="unmatched-section">';
                html += '<div class="unmatched-title">未匹配项</div>';
                if (result.unmatchedIntro && result.unmatchedIntro.length > 0) {
                    result.unmatchedIntro.forEach((item) => {
                        html += `<div class="unmatched-item">前贴: ${item}</div>`;
                    });
                }
                if (result.unmatchedMain && result.unmatchedMain.length > 0) {
                    result.unmatchedMain.forEach((item) => {
                        html += `<div class="unmatched-item">正片: ${item}</div>`;
                    });
                }
                html += '</div>';
            }
            folderList.innerHTML = html;
            // 绑定点击和悬停事件
            Array.from(folderList.getElementsByClassName('folder-item')).forEach(item => {
                const htmlItem = item;
                htmlItem.addEventListener('click', function (event) {
                    const target = event.currentTarget;
                    const idx = target.getAttribute('data-idx');
                    // 移除之前的选中状态
                    Array.from(folderList.getElementsByClassName('folder-item')).forEach(el => {
                        el.classList.remove('selected');
                    });
                    // 添加选中状态
                    target.classList.add('selected');
                    selectedFolderIndex = Number(idx);
                    if (idx !== null) {
                        renderTaskList(result.matchedPairs[Number(idx)].tasks || []);
                    }
                });
            });
        }
        // 默认不显示任务列表
        renderTaskList([]);
        // 渲染底部统计
        const statMatch = document.getElementById('stat-match');
        if (statMatch)
            statMatch.innerText = `${result.matchedPairs.length} 个配对`;
        const statUnmatchedIntro = document.getElementById('stat-unmatched-intro');
        if (statUnmatchedIntro)
            statUnmatchedIntro.innerText = `${result.unmatchedIntro.length}`;
        const statUnmatchedMain = document.getElementById('stat-unmatched-main');
        if (statUnmatchedMain)
            statUnmatchedMain.innerText = `${result.unmatchedMain.length}`;
    }
    function renderTaskList(tasks) {
        const taskList = document.getElementById('task-list');
        if (taskList) {
            if (tasks.length === 0) {
                taskList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🎬</div>
                        <div class="empty-title">暂无任务</div>
                        <div class="empty-description">请选择左侧文件夹查看任务</div>
                    </div>
                `;
            }
            else {
                taskList.innerHTML = tasks.map((task, index) => `
                    <div class="task-item">
                        <div class="task-header">
                            <div class="task-title">任务 ${index + 1}</div>
                            <div class="task-status pending">待处理</div>
                        </div>
                        <div class="task-details">
                            ${task.taskInfo || JSON.stringify(task)}
                        </div>
                    </div>
                `).join('');
            }
        }
        const statTask = document.getElementById('stat-task');
        if (statTask)
            statTask.innerText = `${tasks.length} 个`;
    }
})();

/******/ })()
;