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
            if (currentDir)
                currentDir.innerText = selectedFolder || '未选择';
        };
    }
    // 分析文件夹按钮
    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.onclick = async () => {
            if (!selectedFolder) {
                alert('请先选择文件夹');
                return;
            }
            const result = await window.electronAPI.eventBus.trigger('analyze-folders', { args: [selectedFolder] }, pluginName);
            renderAnalyzeResult(result.result);
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
                alert('请先选择文件夹');
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
                alert('没有可处理的任务，请先分析文件夹！');
                return;
            }
            window._isStopped = false;
            setProgressLoading();
            startBtn.disabled = true;
            showBtnSpinner(true);
            if (stopBtn) stopBtn.disabled = false;
            const result = await window.electronAPI.eventBus.trigger('process-tasks', { args: [allTasks] }, pluginName);
            console.log('frontend runBusiness finished, _isStopped:', window._isStopped);
            if (!window._isStopped) {
                setProgressDone();
            }
            startBtn.disabled = false;
            showBtnSpinner(false);
            if (stopBtn) stopBtn.disabled = true;
        };
    }
    if (window.electronAPI && window.electronAPI.onBusinessStopped) {
        window.electronAPI.onBusinessStopped(() => {
            window._isStopped = true;
            if (startBtn) startBtn.disabled = false;
            showBtnSpinner(false);
            if (stopBtn) stopBtn.disabled = true;
            alert('停止处理成功');
            console.log('frontend stopped received');
        });
    }
    function setProgressLoading() {
        const progress = document.getElementById('progress-inner');
        if (progress) {
            progress.style.width = '60%';
            progress.style.background = '#52c41a'; // 绿色
            progress.innerHTML = '';
        }
        const statProgress = document.getElementById('stat-progress');
        if (statProgress)
            statProgress.innerText = '总进度: 0/0';
    }
    function setProgressDone() {
        const progress = document.getElementById('progress-inner');
        if (progress) {
            progress.style.width = '100%';
            progress.style.background = '#52c41a'; // 绿色
            progress.innerHTML = '';
        }
        const statProgress = document.getElementById('stat-progress');
        if (statProgress)
            statProgress.innerText = '总进度: 100%';
    }
    function showBtnSpinner(show) {
        let spinner = document.getElementById('start-btn-spinner');
        if (show) {
            if (!spinner) {
                spinner = document.createElement('span');
                spinner.id = 'start-btn-spinner';
                spinner.className = 'btn-spinner';
                spinner.style.display = 'inline-block';
                spinner.style.width = '16px';
                spinner.style.height = '16px';
                spinner.style.marginLeft = '6px';
                spinner.style.border = '2px solid #e6f4ff';
                spinner.style.borderTop = '2px solid #1890ff';
                spinner.style.borderRadius = '50%';
                spinner.style.animation = 'spin 1s linear infinite';
                spinner.style.verticalAlign = 'middle';
                if (startBtn)
                    startBtn.appendChild(spinner);
            }
            else {
                spinner.style.display = 'inline-block';
            }
            // 添加全局spinner样式
            if (!document.getElementById('global-spinner-style')) {
                const style = document.createElement('style');
                style.id = 'global-spinner-style';
                style.innerHTML = `@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}`;
                document.head.appendChild(style);
            }
        }
        else if (spinner) {
            spinner.style.display = 'none';
        }
    }
    // 渲染分析结果到页面
    function renderAnalyzeResult(result) {
        window._lastAnalyzeResult = result;
        // 渲染左侧配对
        const folderList = document.getElementById('folder-list');
        if (folderList) {
            let html = '';
            if (result.matchedPairs && result.matchedPairs.length > 0) {
                html += result.matchedPairs.map((pair, idx) => `<div class="pair-item" data-idx="${idx}" style="cursor:pointer;padding:2px 6px;border-radius:3px;">${idx + 1}: ${pair.intro}  ${pair.main}</div>`).join('');
            }
            if (result.unmatchedIntro && result.unmatchedIntro.length > 0) {
                html += `<br><span style='color:#888;'>未匹配前贴: ${result.unmatchedIntro.join(', ')}</span>`;
            }
            if (result.unmatchedMain && result.unmatchedMain.length > 0) {
                html += `<br><span style='color:#888;'>未匹配正片: ${result.unmatchedMain.join(', ')}</span>`;
            }
            folderList.innerHTML = html;
            // 绑定点击和悬停事件
            Array.from(folderList.getElementsByClassName('pair-item')).forEach(item => {
                const htmlItem = item;
                htmlItem.addEventListener('click', function (event) {
                    const target = event.currentTarget;
                    const idx = target.getAttribute('data-idx');
                    if (idx !== null) {
                        renderTaskList(result.matchedPairs[Number(idx)].tasks || []);
                    }
                });
                htmlItem.addEventListener('mouseenter', function (event) {
                    const target = event.currentTarget;
                    target.style.background = '#e6f7ff';
                });
                htmlItem.addEventListener('mouseleave', function (event) {
                    const target = event.currentTarget;
                    target.style.background = '';
                });
            });
        }
        // 默认不显示任务列表
        renderTaskList([]);
        // 渲染底部统计
        const statMatch = document.getElementById('stat-match');
        if (statMatch)
            statMatch.innerText = `匹配: ${result.matchedPairs.length} 个配对`;
        const statUnmatchedIntro = document.getElementById('stat-unmatched-intro');
        if (statUnmatchedIntro)
            statUnmatchedIntro.innerText = `未匹配前贴: ${result.unmatchedIntro.length}`;
        const statUnmatchedMain = document.getElementById('stat-unmatched-main');
        if (statUnmatchedMain)
            statUnmatchedMain.innerText = `未匹配正片: ${result.unmatchedMain.length}`;
    }
    function renderTaskList(tasks) {
        const taskList = document.getElementById('task-list');
        if (taskList) {
            taskList.innerHTML = tasks.map(t => `<div>${t.taskInfo || JSON.stringify(t)}</div>`).join('');
        }
        const statTask = document.getElementById('stat-task');
        if (statTask)
            statTask.innerText = `任务: ${tasks.length} 个`;
    }
})();

/******/ })()
;