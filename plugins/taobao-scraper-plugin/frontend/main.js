/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

(function () {
    // 插件名称
    const pluginName = 'taobao-scraper-plugin';
    
    // 状态管理
    let isLoggedIn = false;
    let selectedImage = null;
    
    // 获取DOM元素
    const loginFrame = document.querySelector('#loginFrame');
    const loginBadge = document.querySelector('#loginBadge');
    const loginBtn = document.querySelector('#loginBtn');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.navbar-status span:last-child');
    const uploadArea = document.querySelector('#uploadArea');
    const searchBtn = document.querySelector('#searchBtn');
    const stepIcons = document.querySelectorAll('.step-icon');
    
    // 登录按钮
    if (loginBtn) {
        loginBtn.onclick = async () => {
            console.log('=== 开始登录流程 ===');
            console.log('当前登录状态:', isLoggedIn);
            
            if (isLoggedIn) {
                console.log('用户已登录，跳过登录流程');
                showNotification('已经登录了', 'info');
                return;
            }
            
            // 显示加载状态
            loginBtn.disabled = true;
            const originalText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<span class="spinner"></span> 登录中...';
            loginFrame.innerHTML = '<div style="text-align: center; color: #737373;">正在启动浏览器...</div>';
            
            try {
                const response = await window.electronAPI.eventBus.trigger('taobao-login', {}, pluginName);
                console.log('登录调用结果:', response);
                
                // 正确解析嵌套的响应结构
                if (response.success && response.result && response.result.success) {
                    console.log('登录成功，更新状态');
                    updateLoginStatus(true);
                    showNotification('登录成功', 'success');
                    loginFrame.innerHTML = '<div style="text-align: center; color: #10b981;">✓ 登录成功</div>';
                } else {
                    const errorMessage = response.result?.message || response.message || '登录失败';
                    console.log('登录失败:', errorMessage);
                    showNotification('登录失败: ' + errorMessage, 'error');
                    resetLoginUI();
                }
            } catch (error) {
                console.error('登录失败:', error);
                showNotification('登录失败', 'error');
                resetLoginUI();
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalText;
            }
        };
    }
    
    // 文件上传区域
    if (uploadArea) {
        uploadArea.onclick = async () => {
            try {
                const filePath = await window.electronAPI.selectFile();
                if (filePath) {
                    handleImageSelected(filePath);
                }
            } catch (error) {
                console.error('选择图片失败:', error);
                showNotification('选择图片失败', 'error');
            }
        };
        
        uploadArea.ondragover = (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#0066ff';
        };
        
        uploadArea.ondragleave = () => {
            uploadArea.style.borderColor = '#e5e5e5';
        };
        
        uploadArea.ondrop = (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#e5e5e5';
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    handleImageSelected(file.path || file.name);
                } else {
                    showNotification('请选择图片文件', 'warning');
                }
            }
        };
    }
    
    // 搜索按钮
    if (searchBtn) {
        searchBtn.onclick = async () => {
            if (!selectedImage) {
                showNotification('请先选择图片', 'warning');
                return;
            }
            if (!isLoggedIn) {
                showNotification('请先登录淘宝', 'warning');
                return;
            }
            
            // 显示加载状态
            searchBtn.disabled = true;
            const originalText = searchBtn.innerHTML;
            searchBtn.innerHTML = '<span class="spinner"></span> 搜索中...';
            
            // 更新步骤指示器
            stepIcons[1].classList.remove('active');
            stepIcons[1].classList.add('completed');
            stepIcons[1].textContent = '✓';
            stepIcons[2].classList.add('active');
            
            try {
                // 开始爬取进度 - 立即切换到进行中状态
                console.log('开始搜索，切换爬取进度为进行中');
                updateCrawlProgress(0, 1, 'processing');
                
                // 执行图片搜索
                const searchResult = await window.electronAPI.eventBus.trigger('image-search', { args: [selectedImage] }, pluginName);
                console.log('搜索结果:', searchResult);
                
                // 解析搜索结果
                let parsedResult = null;
                try {
                    if (searchResult.success && searchResult.result) {
                        // 如果result是JSON字符串，需要解析
                        if (typeof searchResult.result === 'string') {
                            parsedResult = JSON.parse(searchResult.result);
                        } else {
                            parsedResult = searchResult.result;
                        }
                    }
                } catch (parseError) {
                    console.error('解析搜索结果失败:', parseError);
                    throw new Error('搜索结果格式错误');
                }
                
                if (parsedResult && parsedResult.success && parsedResult.data && parsedResult.data.length > 0) {
                    // 搜索成功 - 更新爬取进度为完成
                    console.log('搜索成功，切换爬取进度为已完成');
                    const totalProducts = parsedResult.data.length; // 商品数量
                    const totalImages = parsedResult.data.reduce((sum, product) => sum + (product.img_urls?.length || 0), 0);
                    
                    // 更新爬取进度：显示爬取完成的商品数量
                    updateCrawlProgress(totalProducts, totalProducts, 'completed');
                    
                    // 下载进度保持未开始状态
                    updateDownloadProgress(0, 0, 'not_started');
                    
                    showNotification(`搜索成功，找到 ${totalProducts} 个商品，共 ${totalImages} 张图片`, 'success');
                    
                                    // 显示图片展示
                displayImageGallery(parsedResult);
                } else {
                    // 搜索失败或未找到结果
                    console.log('搜索失败，切换爬取进度为失败');
                    updateCrawlProgress(0, 1, 'error');
                    showNotification('未找到相关商品', 'warning');
                }
            } catch (error) {
                console.error('搜索失败:', error);
                // 搜索失败 - 更新爬取进度为错误状态
                updateCrawlProgress(1, 1, 'error');
                showNotification('搜索失败: ' + error.message, 'error');
            } finally {
                searchBtn.disabled = false;
                searchBtn.innerHTML = originalText;
            }
        };
    }
    
    // 侧边栏导航
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.onclick = (e) => {
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
        };
    });
    
    // 图片选择相关函数
    let selectedImageCount = 0; // 全局选择计数器
    
    window.toggleImageSelection = function(imageCard) {
        const selectedImages = window.selectedImages || new Set();
        const imageUrl = imageCard.dataset.imageUrl;
        const imageTitle = imageCard.dataset.imageTitle;
        const imageIndex = parseInt(imageCard.dataset.imageIndex);
        const productId = imageCard.dataset.productId;
        
        // 创建图片标识符
        const imageKey = `${productId}-${imageIndex}`;
        
        if (selectedImages.has(imageKey)) {
            // 取消选择
            selectedImages.delete(imageKey);
            imageCard.classList.remove('selected');
            selectedImageCount--;
            
            // 移除选择标记
            const selectionBadge = imageCard.querySelector('.selection-badge');
            if (selectionBadge) {
                selectionBadge.remove();
            }
        } else {
            // 选择图片
            selectedImages.add(imageKey);
            imageCard.classList.add('selected');
            selectedImageCount++;
            
            // 添加选择标记（显示选择顺序）
            const selectionBadge = document.createElement('div');
            selectionBadge.className = 'selection-badge';
            selectionBadge.textContent = selectedImageCount;
            imageCard.appendChild(selectionBadge);
        }
        
        updateDownloadButtons();
        updateProductDownloadButtons();
        console.log('图片选择状态更新:', { selectedCount: selectedImageCount, selectedImages: Array.from(selectedImages) });
    };
    

    
    // 更新下载按钮显示
    function updateDownloadButtons() {
        const selectedImages = window.selectedImages || new Set();
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        const clearAllSelectionBtn = document.getElementById('clearAllSelectionBtn');
        const downloadButtons = document.getElementById('downloadButtons');
        
        if (selectedImages.size > 0) {
            // 有选中图片时，显示数量
            downloadAllBtn.textContent = `全部下载(${selectedImages.size})`;
            clearAllSelectionBtn.style.display = 'inline-block';
        } else {
            // 没有选中图片时，显示默认文本
            downloadAllBtn.textContent = '全部下载';
            clearAllSelectionBtn.style.display = 'none';
        }
        
        // 显示下载按钮区域
        downloadButtons.style.display = 'flex';
    }
    
    // 更新商品下载按钮显示
    function updateProductDownloadButtons() {
        const selectedImages = window.selectedImages || new Set();
        const productGroups = window.productGroups || [];
        
        productGroups.forEach(group => {
            const downloadBtn = document.getElementById(`downloadProductBtn_${group.productId}`);
            const clearBtn = document.getElementById(`clearProductSelectionBtn_${group.productId}`);
            
            if (downloadBtn && clearBtn) {
                // 计算当前商品选中的图片数量
                const productSelectedCount = Array.from(selectedImages).filter(imageKey => {
                    const [productId] = imageKey.split('-');
                    return productId == group.productId;
                }).length;
                
                if (productSelectedCount > 0) {
                    downloadBtn.textContent = `下载此商品图片(${productSelectedCount})`;
                    clearBtn.style.display = 'inline-block';
                } else {
                    downloadBtn.textContent = '下载此商品图片';
                    clearBtn.style.display = 'none';
                }
            }
        });
    }
    
    // 获取选中的图片数据（按选择顺序）
    function getSelectedImageData() {
        const selectedImages = window.selectedImages || new Set();
        const productGroups = window.productGroups || [];
        const selectedImageData = [];
        
        // 按照选择顺序（角标数字）排序
        const imageCards = document.querySelectorAll('.image-card.selected');
        const sortedCards = Array.from(imageCards).sort((a, b) => {
            const badgeA = a.querySelector('.selection-badge');
            const badgeB = b.querySelector('.selection-badge');
            if (badgeA && badgeB) {
                return parseInt(badgeA.textContent) - parseInt(badgeB.textContent);
            }
            return 0;
        });
        
        sortedCards.forEach(card => {
            const productId = card.dataset.productId;
            const imageIndex = parseInt(card.dataset.imageIndex);
            const productGroup = productGroups.find(group => group.productId == productId);
            if (productGroup && productGroup.images[imageIndex]) {
                // 只传递必要的字段，不包含productTitle
                const imageData = {
                    url: productGroup.images[imageIndex].url,
                    index: productGroup.images[imageIndex].index
                };
                selectedImageData.push(imageData);
            }
        });
        
        return selectedImageData;
    }
    
    // 获取指定商品的选中图片数据（按选择顺序）
    function getSelectedImageDataByProduct(productId) {
        const selectedImages = window.selectedImages || new Set();
        const productGroups = window.productGroups || [];
        const selectedImageData = [];
        
        // 按照选择顺序（角标数字）排序
        const imageCards = document.querySelectorAll(`[data-product-id="${productId}"].image-card.selected`);
        const sortedCards = Array.from(imageCards).sort((a, b) => {
            const badgeA = a.querySelector('.selection-badge');
            const badgeB = b.querySelector('.selection-badge');
            if (badgeA && badgeB) {
                return parseInt(badgeA.textContent) - parseInt(badgeB.textContent);
            }
            return 0;
        });
        
        sortedCards.forEach(card => {
            const imageIndex = parseInt(card.dataset.imageIndex);
            const productGroup = productGroups.find(group => group.productId == productId);
            if (productGroup && productGroup.images[imageIndex]) {
                // 只传递必要的字段，不包含productTitle
                const imageData = {
                    url: productGroup.images[imageIndex].url,
                    index: productGroup.images[imageIndex].index
                };
                selectedImageData.push(imageData);
            }
        });
        
        return selectedImageData;
    }
    
    // 清除所有选择
    window.clearAllSelection = function() {
        const imageCards = document.querySelectorAll('.image-card');
        imageCards.forEach(card => {
            card.classList.remove('selected');
            const selectionBadge = card.querySelector('.selection-badge');
            if (selectionBadge) {
                selectionBadge.remove();
            }
        });
        window.selectedImages = new Set();
        selectedImageCount = 0;
        updateDownloadButtons();
        updateProductDownloadButtons();
        showNotification('已清除所有选择', 'info');
    };
    
    // 清除指定商品的选择
    window.clearProductSelection = function(productId) {
        const imageCards = document.querySelectorAll(`[data-product-id="${productId}"]`);
        imageCards.forEach(card => {
            card.classList.remove('selected');
            const selectionBadge = card.querySelector('.selection-badge');
            if (selectionBadge) {
                selectionBadge.remove();
            }
        });
        
        // 从选中集合中移除该商品的所有图片
        const selectedImages = window.selectedImages || new Set();
        const keysToRemove = Array.from(selectedImages).filter(imageKey => {
            const [pid] = imageKey.split('-');
            return pid == productId;
        });
        
        keysToRemove.forEach(key => {
            selectedImages.delete(key);
            selectedImageCount--;
        });
        
        updateDownloadButtons();
        updateProductDownloadButtons();
        showNotification('已清除该商品的选择', 'info');
    };
    
        function bindDownloadButtons() {
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        
        // 全部下载按钮
        downloadAllBtn.onclick = () => {
            const selectedImageData = getSelectedImageData();
            const allImages = window.allImages || [];
            
            if (selectedImageData.length > 0) {
                // 如果有选中的图片，下载选中的图片
                console.log('下载选中的图片，切换下载进度为进行中');
                downloadImages(selectedImageData);
            } else if (allImages.length > 0) {
                // 如果没有选中的图片，下载所有图片
                console.log('下载全部图片，切换下载进度为进行中');
                downloadImages(allImages);
            }
        };
        
        // 清除所有选择按钮
        const clearAllSelectionBtn = document.getElementById('clearAllSelectionBtn');
        if (clearAllSelectionBtn) {
            clearAllSelectionBtn.onclick = () => {
                clearAllSelection();
            };
        }
    }
    
    window.handleImageError = function(img) {
        const container = img.parentElement;
        container.innerHTML = `
            <div class="image-error">
                <div class="image-error-icon">⚠️</div>
                <div>图片加载失败</div>
            </div>
        `;
    };
    

    
    // ZIP打包下载方法 - 使用Electron API
    window.downloadImagesAsZip = async function(images) {
        if (!images || images.length === 0) {
            showNotification('没有图片可下载', 'warning');
            return;
        }
        
        console.log('开始ZIP打包下载图片:', images);
        showNotification(`开始打包下载 ${images.length} 张图片`, 'success');
        
        // 更新下载进度为进行中
        updateDownloadProgress(0, images.length, 'processing');
        
        try {
            // 调用Electron的ZIP下载API
            const result = await window.electronAPI.downloadImagesAsZip(images);
            
            if (result.success) {
                // 更新进度为完成
                updateDownloadProgress(images.length, images.length, 'completed');
                showNotification('ZIP文件下载完成！', 'success');
            } else {
                // 更新进度为失败
                updateDownloadProgress(0, images.length, 'error');
                showNotification('ZIP打包下载失败: ' + (result.error || '未知错误'), 'error');
            }
            
        } catch (error) {
            console.error('ZIP打包下载失败:', error);
            updateDownloadProgress(0, images.length, 'error');
            showNotification('ZIP打包下载失败: ' + error.message, 'error');
        }
    };
    
    // 统一的下载方法 - 支持单个或多个图片下载
    window.downloadImages = function(images) {
        if (!images || images.length === 0) {
            showNotification('没有图片可下载', 'warning');
            return;
        }
        
        // 使用ZIP打包下载
        downloadImagesAsZip(images);
    };
    

    
    window.downloadProductImages = function(productLink, productTitle) {
        console.log('下载商品图片:', productLink, productTitle);
        
        // 找到对应商品的图片
        const productGroups = window.productGroups || [];
        const targetGroup = productGroups.find(group => group.productTitle === productTitle);
        
        if (targetGroup && targetGroup.images.length > 0) {
            // 获取该商品选中的图片
            const selectedImageData = getSelectedImageDataByProduct(targetGroup.productId);
            
            if (selectedImageData.length > 0) {
                // 如果有选中的图片，下载选中的图片
                console.log(`下载商品 ${productTitle} 选中的图片，切换下载进度为进行中`);
                downloadImages(selectedImageData);
            } else {
                // 如果没有选中的图片，下载该商品的所有图片
                console.log(`下载商品 ${productTitle} 的所有图片，切换下载进度为进行中`);
                // 处理图片数据，移除productTitle字段
                const processedImages = targetGroup.images.map(image => ({
                    url: image.url,
                    index: image.index
                }));
                downloadImages(processedImages);
            }
        } else {
            showNotification(`未找到 ${productTitle} 的图片`, 'warning');
        }
    };

    // 图片模态框相关函数
    let currentModalImage = null;

    window.openImageModal = function(imageUrl, imageTitle, imageIndex) {
        console.log('打开图片模态框:', imageUrl, imageTitle, imageIndex);
        
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalTitle = document.getElementById('modalTitle');
        
        if (!modal || !modalImage || !modalTitle) {
            console.error('模态框元素未找到');
            return;
        }
        
        currentModalImage = {
            url: imageUrl,
            title: imageTitle,
            index: imageIndex
        };
        
        modalImage.src = imageUrl;
        modalTitle.textContent = `${imageTitle} - 图片${imageIndex + 1}`;
        
        // 先显示模态框
        modal.style.display = 'flex';
        
        // 然后添加显示动画
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
        
        // 阻止背景滚动
        document.body.style.overflow = 'hidden';
        
        console.log('模态框已打开');
    };

    window.openImageModalFromData = function(imageCard) {
        console.log('从data属性打开图片模态框:', imageCard);
        
        if (!imageCard) {
            console.error('图片卡片元素未找到');
            return;
        }
        
        const imageUrl = imageCard.dataset.imageUrl;
        const imageTitle = imageCard.dataset.imageTitle;
        const imageIndex = parseInt(imageCard.dataset.imageIndex);
        
        console.log('从data属性获取的数据:', { 
            imageUrl, 
            imageTitle, 
            imageIndex,
            dataset: imageCard.dataset 
        });
        
        if (!imageUrl || !imageTitle) {
            console.error('图片数据不完整:', { imageUrl, imageTitle, imageIndex });
            return;
        }
        
        console.log('图片数据完整，准备打开模态框');
        
        // 调用原有的打开模态框函数
        openImageModal(imageUrl, imageTitle, imageIndex);
    };

    window.closeImageModal = function() {
        console.log('关闭图片模态框');
        
        const modal = document.getElementById('imageModal');
        if (!modal) return;
        
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
        
        currentModalImage = null;
    };



    // 拖拽排序相关函数
    function initializeDragAndDrop() {
        const imageCards = document.querySelectorAll('.image-card');
        const productGrids = document.querySelectorAll('.product-images-grid');
        
        console.log('初始化拖拽功能，找到图片卡片:', imageCards.length, '个，商品网格:', productGrids.length, '个');
        
        imageCards.forEach(card => {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });
        
        productGrids.forEach(grid => {
            grid.addEventListener('dragover', handleDragOver);
            grid.addEventListener('drop', handleDrop);
            grid.addEventListener('dragenter', handleDragEnter);
            grid.addEventListener('dragleave', handleDragLeave);
        });
    }

    function handleDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        
        // 存储拖拽的图片信息
        const productId = e.target.dataset.productId;
        const imageIndex = e.target.dataset.imageIndex;
        e.dataTransfer.setData('application/json', JSON.stringify({
            productId: productId,
            imageIndex: imageIndex
        }));
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        const draggedData = e.dataTransfer.getData('application/json');
        if (!draggedData) {
            console.log('没有拖拽数据');
            return;
        }
        
        try {
            const { productId: sourceProductId, imageIndex: sourceImageIndex } = JSON.parse(draggedData);
            const targetGrid = e.currentTarget;
            const targetProductId = targetGrid.dataset.productId;
            
            console.log('拖拽数据:', { sourceProductId, sourceImageIndex, targetProductId });
            
            // 获取拖拽的目标位置
            const targetCard = e.target.closest('.image-card');
            if (!targetCard) {
                console.log('没有找到目标卡片');
                return;
            }
            
            const targetImageIndex = targetCard.dataset.imageIndex;
            console.log('目标位置:', targetImageIndex);
            
            // 执行图片重排序
            reorderImage(sourceProductId, parseInt(sourceImageIndex), targetProductId, parseInt(targetImageIndex));
        } catch (error) {
            console.error('处理拖拽失败:', error);
        }
    }

    function reorderImage(sourceProductId, sourceImageIndex, targetProductId, targetImageIndex) {
        console.log('开始重排序图片:', { sourceProductId, sourceImageIndex, targetProductId, targetImageIndex });
        
        const productGroups = window.productGroups;
        if (!productGroups) {
            console.error('没有找到商品组数据');
            return;
        }
        
        // 找到源商品组和目标商品组
        const sourceGroup = productGroups.find(group => group.productId == sourceProductId);
        const targetGroup = productGroups.find(group => group.productId == targetProductId);
        
        if (!sourceGroup || !targetGroup) {
            console.error('没有找到源组或目标组:', { sourceGroup: !!sourceGroup, targetGroup: !!targetGroup });
            return;
        }
        
        // 获取要移动的图片
        const imageToMove = sourceGroup.images[sourceImageIndex];
        if (!imageToMove) {
            console.error('没有找到要移动的图片');
            return;
        }
        
        console.log('移动图片:', imageToMove);
        
        // 从源组中移除图片
        sourceGroup.images.splice(sourceImageIndex, 1);
        
        // 添加到目标组
        if (sourceProductId == targetProductId) {
            // 同一组内移动
            sourceGroup.images.splice(targetImageIndex, 0, imageToMove);
        } else {
            // 跨组移动
            targetGroup.images.splice(targetImageIndex, 0, imageToMove);
            imageToMove.productId = targetProductId;
        }
        
        // 更新图片索引
        updateImageIndices();
        
        // 更新全局数据
        window.productGroups = productGroups;
        window.allImages = productGroups.flatMap(group => group.images);
        
        console.log('重排序完成，重新渲染...');
        
        // 重新渲染图片展示
        const parsedResult = { success: true, data: productGroups };
        displayImageGallery(parsedResult);
        
        showNotification('图片顺序已更新', 'success');
    }

    function updateImageIndices() {
        const productGroups = window.productGroups;
        productGroups.forEach(group => {
            group.images.forEach((image, index) => {
                image.index = index + 1;
            });
        });
    }

    // 点击模态框外部关闭
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('imageModal');
        if (e.target === modal) {
            closeImageModal();
        }
    });

    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeImageModal();
        }
    });
    
    // 初始化
    window.addEventListener('DOMContentLoaded', async () => {
        console.log('淘宝好评图爬取插件已加载');
        
        // 验证全局函数是否正确挂载
        console.log('验证全局函数挂载:');
        console.log('- downloadProductImages:', typeof window.downloadProductImages);
        console.log('- openImageModal:', typeof window.openImageModal);
        console.log('- closeImageModal:', typeof window.closeImageModal);
        console.log('- toggleImageSelection:', typeof window.toggleImageSelection);
        console.log('- showNotification:', typeof window.showNotification);
        console.log('- handleImageError:', typeof window.handleImageError);
        console.log('- downloadImages:', typeof window.downloadImages);
        
        // 初始化进度条 - 每次打开插件时都显示未开始状态
        initializeProgress();
        
        // 检查登录状态
        await checkLoginStatus();
    });
    
    // 检查登录状态
    async function checkLoginStatus() {
        try {
            const response = await window.electronAPI.eventBus.trigger('taobao-login-check', {}, pluginName);
            console.log('登录状态检查结果:', response);
            // 正确解析嵌套的响应结构
            const isLoggedIn = response.success && response.result && response.result.success;
            updateLoginStatus(isLoggedIn);
        } catch (error) {
            console.error('检查登录状态失败:', error);
            updateLoginStatus(false);
        }
    }
    
    // 更新登录状态UI
    function updateLoginStatus(loggedIn) {
        isLoggedIn = loggedIn;
        if (loggedIn) {
            loginBadge.textContent = '已登录';
            loginBadge.classList.add('success');
            statusDot.style.background = '#10b981';
            statusText.textContent = '已登录淘宝';
            // 更新步骤指示器
            stepIcons[0].classList.remove('active');
            stepIcons[0].classList.add('completed');
            stepIcons[0].textContent = '✓';
            stepIcons[1].classList.add('active');
            loginFrame.innerHTML = '<div style="color: #10b981;">✓ 登录成功</div>';
        } else {
            loginBadge.textContent = '未登录';
            loginBadge.classList.remove('success');
            statusDot.style.background = '#ef4444';
            statusText.textContent = '未登录';
            stepIcons[0].classList.add('active');
        }
    }
    
    // 重置登录UI
    function resetLoginUI() {
        if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = '开始登录';
        }
        if (loginFrame) {
        loginFrame.innerHTML = `
            <div style="text-align: center;">
                <div style="margin-bottom: 16px; color: #737373;">点击下方按钮开始登录淘宝</div>
                <button class="button" id="loginBtn">开始登录</button>
            </div>
        `;
        // 重新绑定按钮事件
        const newLoginBtn = document.querySelector('#loginBtn');
        if (newLoginBtn) {
                newLoginBtn.onclick = loginBtn.onclick;
            }
        }
    }
    
    // 处理图片选择
    function handleImageSelected(imagePath) {
        selectedImage = imagePath;
        if (uploadArea) {
        uploadArea.innerHTML = `
            <div class="upload-icon">✓</div>
            <div>已选择图片</div>
            <div style="color: #737373; font-size: 12px; margin-top: 8px;">
                ${imagePath.split('/').pop() || imagePath.split('\\').pop()}
            </div>
        `;
        }
        if (searchBtn) {
            searchBtn.disabled = false;
        }
    }
    
    
    


    // 显示图片画廊
    function displayImageGallery(parsedResult) {
        try {
            console.log('开始显示图片画廊:', parsedResult);
            const imageGallery = document.getElementById('imageGallery');
            const emptyState = document.getElementById('emptyState');
            const imageStats = document.getElementById('imageStats');
            const totalImagesSpan = document.getElementById('totalImages');
            const downloadAllBtn = document.getElementById('downloadAllBtn');
            
            // 检查是否已经有处理好的商品组数据
            let productGroups = [];
            let totalImages = 0;
            
            if (parsedResult.data && parsedResult.data.length > 0 && parsedResult.data[0].images) {
                // 如果数据已经是处理好的商品组格式
                productGroups = parsedResult.data;
                totalImages = productGroups.reduce((sum, group) => sum + group.images.length, 0);
            } else {
                // 按商品分组收集图片（原始数据格式）
                parsedResult.data.forEach((product, productIndex) => {
                    const imgUrls = product.img_urls || [];
                    const productImages = imgUrls.map((imgUrl, imgIndex) => ({
                        url: imgUrl,
                        productTitle: product.title || `商品${productIndex + 1}`,
                        productLink: product.link,
                        index: imgIndex + 1,
                        productId: productIndex
                    }));
                    
                    if (productImages.length > 0) {
                        productGroups.push({
                            productId: productIndex,
                            productTitle: product.title || `商品${productIndex + 1}`,
                            productLink: product.link,
                            images: productImages
                        });
                        totalImages += productImages.length;
                    }
                });
            }
            
            if (productGroups.length > 0) {
                // 隐藏空状态，显示图片画廊
                emptyState.style.display = 'none';
                imageGallery.style.display = 'block';
                imageStats.style.display = 'inline';
                downloadAllBtn.style.display = 'inline-block';
                
                // 更新统计信息
                totalImagesSpan.textContent = totalImages;
                
                // 生成按商品分组的图片展示
                let html = '';
                productGroups.forEach((productGroup, groupIndex) => {
                    html += `
                        <div class="product-group" data-product-id="${productGroup.productId}">
                            <div class="product-group-header">
                                <div class="product-group-title">
                                    <span class="product-number">商品${productGroup.productId + 1}:</span>
                                    <span class="product-name">${productGroup.productTitle}</span>
                                </div>
                                <div class="product-group-meta">
                                    <span class="image-count">${productGroup.images.length}张图片</span>
                                    <div class="product-download-buttons">
                                        <button class="product-action-btn" id="downloadProductBtn_${productGroup.productId}" onclick="downloadProductImages('${productGroup.productLink}', '${productGroup.productTitle}')">
                                            下载此商品图片
                                        </button>
                                        <button class="product-action-btn secondary" id="clearProductSelectionBtn_${productGroup.productId}" style="display: none;" onclick="clearProductSelection('${productGroup.productId}')">
                                            取消选中
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="product-images-grid" data-product-id="${productGroup.productId}">
                    `;
                    
                    productGroup.images.forEach((image, imageIndex) => {
                        // 转义特殊字符，避免JavaScript字符串解析错误
                        const escapedUrl = image.url.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const escapedTitle = image.productTitle.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        
                        html += `
                            <div class="image-card" 
                                 data-product-id="${productGroup.productId}" 
                                 data-image-index="${imageIndex}"
                                 data-image-url="${escapedUrl}"
                                 data-image-title="${escapedTitle}"
                                 draggable="true"
                                 onclick="toggleImageSelection(this)"
                                 style="cursor: pointer;">
                                <div class="image-container loading">
                                    <img src="${image.url}" 
                                         alt="${image.productTitle} - 图片${image.index}" 
                                         onload="this.parentElement.classList.remove('loading')" 
                                         onerror="handleImageError(this)">
                                    <div class="image-loading">
                                        <div class="loading-spinner"></div>
                                    </div>
                                    <div class="image-overlay">
                                        <div class="image-actions">
                                            <button class="image-action-btn" onclick="event.stopPropagation(); openImageModalFromData(this.closest('.image-card'))">
                                                查看
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="image-info">
                                    <div class="image-title">图片${image.index}</div>
                                    <div class="image-meta">
                                        <span class="image-size">预览</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    
                    html += `
                            </div>
                        </div>
                    `;
                });
                
                imageGallery.innerHTML = html;
                
                // 保存数据供后续使用
                window.productGroups = productGroups;
                // 处理所有图片数据，移除productTitle字段
                window.allImages = productGroups.flatMap(group => 
                    group.images.map(image => ({
                        url: image.url,
                        index: image.index
                    }))
                );
                window.selectedImages = new Set();
                selectedImageCount = 0; // 重置选择计数器
                
                console.log('图片画廊渲染完成，商品组数量:', productGroups.length);
                
                // 初始化拖拽排序
                initializeDragAndDrop();
                
                // 绑定下载按钮事件
                bindDownloadButtons();
                
                // 初始化下载按钮显示
                updateDownloadButtons();
                updateProductDownloadButtons();
                
            } else {
                // 显示空状态
                emptyState.style.display = 'block';
                imageGallery.style.display = 'none';
                imageStats.style.display = 'none';
                downloadAllBtn.style.display = 'none';
            }
            
        } catch (error) {
            console.error('显示图片画廊失败:', error);
            showNotification('显示图片画廊失败: ' + error.message, 'error');
        }
    }
    




    function updateCrawlProgress(current, total, status = 'processing') {
        const progressValue = document.getElementById('crawlProgressValue');
        const progressFill = document.getElementById('crawlProgressFill');
        
        if (progressValue && progressFill) {
            // 根据状态设置文字
            let statusText = '未开始';
            if (status === 'not_started') {
                statusText = '未开始';
            } else if (status === 'processing') {
                statusText = '进行中';
            } else if (status === 'completed') {
                statusText = `爬取完成：${current}/${total}`;
            } else if (status === 'error') {
                statusText = '失败';
            }
            
            console.log(`更新爬取进度: ${statusText} (${current}/${total})`);
            progressValue.textContent = statusText;
            
            const percentage = total > 0 ? (current / total * 100) : 0;
            progressFill.style.width = `${percentage}%`;
            
            // 移除所有状态类
            progressFill.classList.remove('processing', 'completed', 'error');
            
            // 添加状态类
            if (status === 'processing') {
                progressFill.classList.add('processing');
            } else if (status === 'completed') {
                progressFill.classList.add('completed');
            } else if (status === 'error') {
                progressFill.classList.add('error');
            }
        }
    }

    function updateDownloadProgress(current, total, status = 'processing') {
        const progressValue = document.getElementById('downloadProgressValue');
        const progressFill = document.getElementById('downloadProgressFill');
        
        if (progressValue && progressFill) {
            // 根据状态设置文字
            let statusText = '未开始';
            if (status === 'not_started') {
                statusText = '未开始';
            } else if (status === 'processing') {
                statusText = '进行中';
            } else if (status === 'completed') {
                statusText = '已完成';
            } else if (status === 'error') {
                statusText = '失败';
            }
            
            console.log(`更新下载进度: ${statusText} (${current}/${total})`);
            progressValue.textContent = statusText;
            
            const percentage = total > 0 ? (current / total * 100) : 0;
            progressFill.style.width = `${percentage}%`;
            
            // 移除所有状态类
            progressFill.classList.remove('processing', 'completed', 'error');
            
            // 添加状态类
            if (status === 'processing') {
                progressFill.classList.add('processing');
            } else if (status === 'completed') {
                progressFill.classList.add('completed');
            } else if (status === 'error') {
                progressFill.classList.add('error');
            }
        }
    }

    // 初始化进度条
    function initializeProgress() {
        console.log('初始化进度条');
        
        // 重置爬取进度为未开始状态
        updateCrawlProgress(0, 0, 'not_started');
        
        // 重置下载进度为未开始状态
        updateDownloadProgress(0, 0, 'not_started');
        
        console.log('进度条初始化完成');
    }
    
    // 显示通知
    window.showNotification = function(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        
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


})();

/******/ })()
;