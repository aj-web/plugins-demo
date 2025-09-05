// 淘宝好评图爬取插件 - Vue 3 版本
const { createApp, ref, computed, onMounted, nextTick } = Vue;

// 插件名称
const pluginName = 'taobao-scraper-plugin';
    
// 创建 Vue 应用
const app = createApp({
    setup() {
        // 平台数据隔离 - 每个平台维护独立的数据状态
        const platformData = ref({
            taobao: {
                isLoggedIn: false,
                isLoggingIn: false,
                selectedImage: null,
                skuId: '',
                selectedImages: new Set(),
                selectedImageCount: 0,
                productGroups: [],
                totalImages: 0,
                currentSearchMode: 'sku'
            },
            1688: {
                isLoggedIn: false,
                isLoggingIn: false,
                selectedImage: null,
                skuId: '',
                selectedImages: new Set(),
                selectedImageCount: 0,
                productGroups: [],
                totalImages: 0,
                currentSearchMode: 'sku'
            }
            // 未来可以轻松添加新平台，如：
            // jd: { ... },
            // pdd: { ... }
        });

        const currentPlatform = ref('taobao');
        
        // 平台数据访问器 - 通过计算属性访问当前平台的数据
        const currentPlatformData = computed(() => platformData.value[currentPlatform.value]);

        // 为每个数据项创建计算属性，实现平台数据隔离
        const isLoggedIn = computed({
            get: () => currentPlatformData.value.isLoggedIn,
            set: (value) => { currentPlatformData.value.isLoggedIn = value; }
        });

        const isLoggingIn = computed({
            get: () => currentPlatformData.value.isLoggingIn,
            set: (value) => { currentPlatformData.value.isLoggingIn = value; }
        });

        const selectedImage = computed({
            get: () => currentPlatformData.value.selectedImage,
            set: (value) => { currentPlatformData.value.selectedImage = value; }
        });

        const skuId = computed({
            get: () => currentPlatformData.value.skuId,
            set: (value) => { currentPlatformData.value.skuId = value; }
        });

        const selectedImages = computed({
            get: () => currentPlatformData.value.selectedImages,
            set: (value) => { currentPlatformData.value.selectedImages = value; }
        });

        const selectedImageCount = computed({
            get: () => currentPlatformData.value.selectedImageCount,
            set: (value) => { currentPlatformData.value.selectedImageCount = value; }
        });

        const productGroups = computed({
            get: () => currentPlatformData.value.productGroups,
            set: (value) => { currentPlatformData.value.productGroups = value; }
        });

        const totalImages = computed({
            get: () => currentPlatformData.value.totalImages,
            set: (value) => { currentPlatformData.value.totalImages = value; }
        });

        const currentSearchMode = computed({
            get: () => currentPlatformData.value.currentSearchMode,
            set: (value) => { currentPlatformData.value.currentSearchMode = value; }
        });
        
        // 搜索状态管理（全局状态，不需要平台隔离）
        const isSearching = ref(false);
        
        // 模态框状态（全局状态，不需要平台隔离）
        const showImageModal = ref(false);
        const modalImageUrl = ref('');
        const modalTitle = ref('');
        
        // 进度状态（全局状态，不需要平台隔离）
        const crawlProgress = ref({ current: 0, total: 0, status: 'not_started' });
        const downloadProgress = ref({ current: 0, total: 0, status: 'not_started' });
        
        // 序列号计数器
        let seq = 0;
        
        // 平台管理工具函数
        const getPlatformName = (platform) => {
            const names = {
                taobao: '淘宝',
                1688: '1688',
                jd: '京东',
                pdd: '拼多多'
            };
            return names[platform] || platform;
        };

        const getAllPlatforms = () => {
            return Object.keys(platformData.value);
        };

        const getPlatformStatus = (platform) => {
            return {
                isLoggedIn: platformData.value[platform].isLoggedIn,
                hasData: platformData.value[platform].productGroups.length > 0,
                totalImages: platformData.value[platform].totalImages
            };
        };
        
        // 计算属性
        const step1Class = computed(() => {
            if (isLoggedIn.value) return 'completed';
            return 'active';
        });
        
        const step1Text = computed(() => {
            if (isLoggedIn.value) return '✓';
            return '1';
        });
        
        const step2Class = computed(() => {
            if (selectedImage.value && isLoggedIn.value) return 'active';
            if (selectedImage.value) return 'completed';
            return 'pending';
        });
        
        const step2Text = computed(() => {
            if (selectedImage.value && isLoggedIn.value) return '2';
            if (selectedImage.value) return '✓';
            return '2';
        });
        
        const step3Class = computed(() => {
            if (crawlProgress.value.status === 'completed') return 'completed';
            if (crawlProgress.value.status === 'processing') return 'active';
            return 'pending';
        });
        
        const step3Text = computed(() => {
            if (crawlProgress.value.status === 'completed') return '✓';
            if (crawlProgress.value.status === 'processing') return '3';
            return '3';
        });
        
        const crawlProgressText = computed(() => {
            const { current, total, status } = crawlProgress.value;
            if (status === 'not_started') return '未开始';
            if (status === 'processing') return '进行中';
            if (status === 'completed') return `爬取完成：${current}/${total}`;
            if (status === 'error') return '失败';
            return '未开始';
        });
        
        const crawlProgressWidth = computed(() => {
            const { current, total } = crawlProgress.value;
            return total > 0 ? `${(current / total * 100)}%` : '0%';
        });
        
        const crawlProgressClass = computed(() => {
            return crawlProgress.value.status;
        });
        
        const downloadProgressText = computed(() => {
            const { current, total, status } = downloadProgress.value;
            if (status === 'not_started') return '未开始';
            if (status === 'processing') return '进行中';
            if (status === 'completed') return '已完成';
            if (status === 'error') return '失败';
            return '未开始';
        });
        
        const downloadProgressWidth = computed(() => {
            const { current, total } = downloadProgress.value;
            return total > 0 ? `${(current / total * 100)}%` : '0%';
        });
        
        const downloadProgressClass = computed(() => {
            return downloadProgress.value.status;
        });
        
        const downloadAllText = computed(() => {
            return selectedImageCount.value > 0 ? `全部下载(${selectedImageCount.value})` : '全部下载';
        });
        
        // 通知函数
        const showNotification = (message, type = 'info') => {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }, 3000);
        };
        
        // 更新爬取进度
        const updateCrawlProgress = (current, total, status) => {
            crawlProgress.value = { current, total, status };
        };
        
        // 更新下载进度
        const updateDownloadProgress = (current, total, status) => {
            downloadProgress.value = { current, total, status };
        };
        
        // 通过 postMessage 调用事件
        const triggerEvent = async (eventType, params = {}) => {
            return new Promise((resolve, reject) => {
                const id = ++seq;
                const timeout = setTimeout(() => {
                    reject(new Error('请求超时'));
                }, 600000);
                
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
                
                window.parent.postMessage({
                    source: 'plugin-frontend',
                    action: 'trigger-event',
                    id,
                    payload: { eventType, params }
                }, '*');
            });
        };
        
        // 通过 postMessage 调用 IPC
        const invokeIpc = async (channel, args = []) => {
            console.log('[invokeIpc] Calling channel:', channel, 'with args:', args);
            return new Promise((resolve, reject) => {
                const id = ++seq;
                const timeout = setTimeout(() => {
                    reject(new Error('请求超时'));
                }, 600000);
                
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
                
                window.parent.postMessage({
                    source: 'plugin-frontend',
                    action: 'ipc-invoke',
                    id,
                    payload: { channel, args }
                }, '*');
            });
        };
        
        // 检查登录状态
        const checkLoginStatus = async () => {
            try {
                const eventType = currentPlatform.value === 'taobao' ? 'taobao-login-check' : '1688-login-check';
                const response = await triggerEvent(eventType, {});
                console.log('登录状态检查结果:', response);
                const loggedIn = response.success && response.result && response.result.success;
                isLoggedIn.value = loggedIn;
                
                if (loggedIn) {
                    const platformName = getPlatformName(currentPlatform.value);
                    showNotification(`已登录${platformName}`, 'success');
                }
            } catch (error) {
                console.error('检查登录状态失败:', error);
                isLoggedIn.value = false;
            }
        };
        
        // 开始登录
        const startLogin = async () => {
            if (isLoggingIn.value) return;
            
            isLoggingIn.value = true;
            showNotification('正在启动淘宝登录流程...', 'info');
            
            try {
                const response = await triggerEvent('taobao-login', {});
                console.log('淘宝登录响应:', response);
                
                if (response.success && response.result && response.result.success) {
                    isLoggedIn.value = true;
                    currentPlatform.value = 'taobao';
                    showNotification('淘宝登录成功！', 'success');
                } else {
                    const errorMsg = response.result?.message || response.error || '登录失败';
                    showNotification(errorMsg, 'error');
                }
            } catch (error) {
                console.error('淘宝登录失败:', error);
                showNotification('淘宝登录失败: ' + error.message, 'error');
            } finally {
                isLoggingIn.value = false;
            }
        };

        // 开始1688登录
        const start1688Login = async () => {
            if (isLoggingIn.value) return;
            
            isLoggingIn.value = true;
            showNotification('正在启动1688登录流程...', 'info');
            
            try {
                const loginResponse = await triggerEvent('1688-login', {});
                console.log('1688登录响应:', loginResponse);
                
                if (loginResponse.success && loginResponse.result && loginResponse.result.success) {
                    isLoggedIn.value = true;
                    currentPlatform.value = '1688';
                    showNotification('1688登录成功！', 'success');
                } else {
                    const errorMsg = loginResponse.result?.message || loginResponse.error || '登录失败';
                    showNotification(errorMsg, 'error');
                }
            } catch (error) {
                console.error('1688登录失败:', error);
                showNotification('1688登录失败: ' + error.message, 'error');
            } finally {
                isLoggingIn.value = false;
            }
        };

        // 切换平台 - 现在只是切换，不清空数据
        const switchPlatform = (platform) => {
            console.log(`从 ${currentPlatform.value} 切换到 ${platform}`);
            currentPlatform.value = platform;
            
            // 显示切换通知
            const platformName = getPlatformName(platform);
            showNotification(`已切换到${platformName}平台`, 'info');
        };
    
        // 选择图片
        const selectImage = async () => {
            try {
                const filePath = await invokeIpc('select-file');
                if (filePath) {
                    selectedImage.value = filePath;
                    showNotification('图片选择成功', 'success');
                }
            } catch (error) {
                console.error('选择图片失败:', error);
                showNotification('选择图片失败', 'error');
            }
        };
        
        // 开始搜索
        const startSearch = async () => {
            console.log('=== startSearch 开始 ===');
            console.log('selectedImage.value:', selectedImage.value);
            console.log('skuId.value:', skuId.value);
            
            if (!selectedImage.value && !skuId.value) {
                showNotification('请选择图片或输入SKU ID', 'warning');
                return;
            }
            
            // 验证SKU ID格式
            if (skuId.value && !/^\d+$/.test(skuId.value.trim())) {
                showNotification('SKU ID必须是纯数字，如：866648458353', 'warning');
                return;
            }
            
            // 检查当前平台的登录状态
            if (!isLoggedIn.value) {
                const platformName = getPlatformName(currentPlatform.value);
                showNotification(`请先登录${platformName}`, 'warning');
                return;
            }
            
            // 设置搜索状态为进行中
            isSearching.value = true;
            
            // 更新爬取进度为进行中
            updateCrawlProgress(0, 1, 'processing');
                
            try {
                const eventType = currentPlatform.value === 'taobao' ? 'image-search' : '1688-image-search';
                
                // 构建搜索参数
                let searchParams = {};
                if (selectedImage.value) {
                    // 如果有图片，第一个参数是图片路径，第二个参数是skuId（如果有的话）
                    searchParams.args = [selectedImage.value];
                    if (skuId.value && skuId.value.trim()) {
                        searchParams.args.push(skuId.value.trim());
                    }
                } else if (skuId.value && skuId.value.trim()) {
                    // 如果只有SKU ID，第一个参数是null（表示没有图片），第二个参数是skuId
                    searchParams.args = [null, skuId.value.trim()];
                }
                
                console.log('searchParams', searchParams);
                
                const searchResult = await triggerEvent(eventType, searchParams);
                console.log(`${currentPlatform.value}搜索结果:`, searchResult);
                
                let parsedResult = null;
                try {
                    if (searchResult.success && searchResult.result) {
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
                    // 过滤掉没有图片的商品
                    const productsWithImages = parsedResult.data.filter(product => 
                        product.img_urls && product.img_urls.length > 0
                    );
                    
                    if (productsWithImages.length === 0) {
                        updateCrawlProgress(0, 1, 'error');
                        showNotification('搜索成功，但没有找到包含图片的商品', 'warning');
                        return;
                    }
                    
                    const totalProducts = productsWithImages.length;
                    const totalImages = productsWithImages.reduce((sum, product) => sum + (product.img_urls?.length || 0), 0);
                    
                    updateCrawlProgress(totalProducts, totalProducts, 'completed');
                    updateDownloadProgress(0, 0, 'not_started');
                    
                    showNotification(`搜索成功，找到 ${totalProducts} 个有图片的商品，共 ${totalImages} 张图片`, 'success');
                    displayImageGallery(parsedResult);
                } else {
                    updateCrawlProgress(0, 1, 'error');
                    showNotification('未找到相关商品', 'warning');
                }
                
            } catch (error) {
                console.error('搜索失败:', error);
                updateCrawlProgress(1, 1, 'error');
                showNotification('搜索失败: ' + error.message, 'error');
            } finally {
                // 搜索完成，恢复搜索按钮状态
                isSearching.value = false;
            }
        };
        
        // 显示图片画廊
        const displayImageGallery = (parsedResult) => {
            const products = parsedResult.data || [];
            
            // 过滤掉没有图片的商品，只显示有图片的商品
            const productsWithImages = products.filter(product => 
                product.img_urls && product.img_urls.length > 0
            );
            
            if (productsWithImages.length === 0) {
                showNotification('没有找到包含图片的商品', 'warning');
                return;
            }
            
            productGroups.value = productsWithImages.map((product, index) => ({
                productId: index,
                productTitle: product.title || `商品${index + 1}`,
                productLink: product.url || '',
                images: (product.img_urls || []).map((url, imgIndex) => ({
                    url,
                    index: imgIndex
                }))
            }));
            
            totalImages.value = productGroups.value.reduce((sum, group) => sum + group.images.length, 0);
            selectedImages.value.clear();
            selectedImageCount.value = 0;
            
            showNotification(`已加载 ${productGroups.value.length} 个商品的图片，共 ${totalImages.value} 张图片`, 'success');
        };
        
        // 切换图片选择状态
        const toggleImageSelection = (productId, imageIndex) => {
            const key = `${productId}-${imageIndex}`;
            if (selectedImages.value.has(key)) {
                selectedImages.value.delete(key);
            } else {
                selectedImages.value.add(key);
            }
            selectedImageCount.value = selectedImages.value.size;
        };
        
        // 检查图片是否被选中
        const isImageSelected = (productId, imageIndex) => {
            return selectedImages.value.has(`${productId}-${imageIndex}`);
        };
        
        // 全选/取消全选
        const toggleSelectAll = () => {
            if (selectedImages.value.size === totalImages.value) {
                selectedImages.value.clear();
            } else {
                productGroups.value.forEach(group => {
                    group.images.forEach((_, index) => {
                        selectedImages.value.add(`${group.productId}-${index}`);
                    });
                });
            }
            selectedImageCount.value = selectedImages.value.size;
        };
        
        // 下载图片
        const downloadImages = async (images) => {
            if (!images || images.length === 0) {
                showNotification('没有图片可下载', 'warning');
                return;
            }
            
            console.log('开始ZIP打包下载图片:', images);
            showNotification(`开始打包下载 ${images.length} 张图片`, 'success');
            
            updateDownloadProgress(0, images.length, 'processing');
            
            try {
                const result = await invokeIpc('download-images-as-zip', images);
            
                if (result.success) {
                    updateDownloadProgress(images.length, images.length, 'completed');
                    showNotification('ZIP文件下载完成！', 'success');
                } else {
                    updateDownloadProgress(0, images.length, 'error');
                    showNotification('ZIP打包下载失败: ' + (result.error || '未知错误'), 'error');
                }
                
            } catch (error) {
                console.error('ZIP打包下载失败:', error);
                updateDownloadProgress(0, images.length, 'error');
                showNotification('ZIP打包下载失败: ' + error.message, 'error');
            }
        };
    
        // 下载商品图片
        const downloadProductImages = (productLink, productTitle) => {
            console.log('下载商品图片:', productLink, productTitle);
            
            const targetGroup = productGroups.value.find(group => group.productTitle === productTitle);
        
            if (targetGroup && targetGroup.images.length > 0) {
                const selectedImageData = getSelectedImageDataByProduct(targetGroup.productId);
                
                if (selectedImageData.length > 0) {
                    downloadImages(selectedImageData);
                } else {
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

        // 获取选中图片数据
        const getSelectedImageDataByProduct = (productId) => {
            const selectedArray = Array.from(selectedImages.value);
            const selectedImageData = [];
            
            // 筛选出指定商品的图片，并按索引排序
            const productImages = selectedArray
                .filter(imageKey => {
                    const [pid] = imageKey.split('-');
                    return pid == productId;
                })
                .sort((a, b) => {
                    const [, imgIdxA] = a.split('-');
                    const [, imgIdxB] = b.split('-');
                    return parseInt(imgIdxA) - parseInt(imgIdxB);
                });
            
            productImages.forEach(imageKey => {
                const [, imageIndex] = imageKey.split('-');
                const productGroup = productGroups.value.find(group => group.productId == productId);
                if (productGroup && productGroup.images[imageIndex]) {
                    selectedImageData.push({
                        url: productGroup.images[imageIndex].url,
                        index: selectedImageData.length  // 使用数组长度作为索引
                    });
                }
            });
            
            return selectedImageData;
        };
        
        // 打开图片模态框
        const openImageModal = (imageUrl, imageTitle, imageIndex) => {
            modalImageUrl.value = imageUrl;
            modalTitle.value = `${imageTitle} - 图片${imageIndex + 1}`;
            showImageModal.value = true;
            document.body.style.overflow = 'hidden';
        };
        
        // 关闭图片模态框
        const closeImageModal = () => {
            showImageModal.value = false;
            document.body.style.overflow = 'auto';
        };
        
        // 图片加载失败处理
        const handleImageError = () => {
            // 图片加载失败处理
        };
        
        // 获取文件名
        const getFileName = (path) => {
            return path.split('/').pop() || path.split('\\').pop();
        };
        
        // 获取图片选择顺序
        const getImageSelectionOrder = (productId, imageIndex) => {
            const imageKey = `${productId}-${imageIndex}`;
            const selectedArray = Array.from(selectedImages.value);
            const index = selectedArray.indexOf(imageKey);
            return index + 1;
        };
        
        // 获取商品选中数量
        const getProductSelectedCount = (productId) => {
            return Array.from(selectedImages.value).filter(imageKey => {
                const [pid] = imageKey.split('-');
                return pid == productId;
            }).length;
        };
        
        // 获取商品下载文本
        const getProductDownloadText = (productId) => {
            const count = getProductSelectedCount(productId);
            return count > 0 ? `下载此商品图片(${count})` : '下载此商品图片';
        };
        
        // 清除所有选择
        const clearAllSelection = () => {
            selectedImages.value.clear();
            selectedImageCount.value = 0;
            showNotification('已清除所有选择', 'info');
        };
        
        // 清除商品选择
        const clearProductSelection = (productId) => {
            const keysToRemove = Array.from(selectedImages.value).filter(imageKey => {
                const [pid] = imageKey.split('-');
                return pid == productId;
            });
            
            keysToRemove.forEach(key => {
                selectedImages.value.delete(key);
            });
            selectedImageCount.value = selectedImages.value.size;
            
            showNotification('已清除该商品的选择', 'info');
        };
        
        // 下载所有图片
        const downloadAllImages = () => {
            if (selectedImageCount.value > 0) {
                const selectedImageData = getSelectedImageData();
                downloadImages(selectedImageData);
            } else if (totalImages.value > 0) {
                const allImages = getAllImages();
                downloadImages(allImages);
            }
        };
        
        // 获取选中图片数据
        const getSelectedImageData = () => {
            const selectedArray = Array.from(selectedImages.value);
            const selectedImageData = [];
            
            // 先按商品ID和图片索引排序，确保顺序一致
            const sortedArray = selectedArray.sort((a, b) => {
                const [pidA, imgIdxA] = a.split('-');
                const [pidB, imgIdxB] = b.split('-');
                if (pidA !== pidB) {
                    return parseInt(pidA) - parseInt(pidB);
                }
                return parseInt(imgIdxA) - parseInt(imgIdxB);
            });
            
            let globalIndex = 0;
            sortedArray.forEach(imageKey => {
                const [productId, imageIndex] = imageKey.split('-');
                const productGroup = productGroups.value.find(group => group.productId == productId);
                if (productGroup && productGroup.images[imageIndex]) {
                    selectedImageData.push({
                        url: productGroup.images[imageIndex].url,
                        index: globalIndex++
                    });
                }
            });
            
            return selectedImageData;
        };
        
        // 获取所有图片
        const getAllImages = () => {
            let globalIndex = 0;
            return productGroups.value.flatMap(group => 
                group.images.map(image => ({
                    url: image.url,
                    index: globalIndex++
                }))
            );
        };
        
        // 拖拽处理函数
        const handleDragLeave = () => {
            // 拖拽离开处理
        };
        
        const handleDrop = (e) => {
            e.preventDefault();
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    selectedImage.value = file.path || file.name;
                } else {
                    showNotification('请选择图片文件', 'warning');
                }
            }
        };
        
        return {
            // 状态
            isLoggedIn,
            isLoggingIn,
            currentPlatform,
            selectedImage,
            skuId,
            selectedImages,
            selectedImageCount,
            productGroups,
            totalImages,
            showImageModal,
            modalImageUrl,
            modalTitle,
            crawlProgress,
            downloadProgress,
            currentSearchMode,
            isSearching, // 新增：搜索状态
            
            // 平台管理工具
            getPlatformName,
            getAllPlatforms,
            getPlatformStatus,
            
            // 计算属性
            step1Class,
            step1Text,
            step2Class,
            step2Text,
            step3Class,
            step3Text,
            crawlProgressText,
            crawlProgressWidth,
            crawlProgressClass,
            downloadProgressText,
            downloadProgressWidth,
            downloadProgressClass,
            downloadAllText,
            
            // 方法
            startLogin,
            start1688Login,
            switchPlatform,
            selectImage,
            startSearch,
            toggleImageSelection,
            isImageSelected,
            toggleSelectAll,
            downloadProductImages,
            openImageModal,
            closeImageModal,
            handleImageError,
            getFileName,
            getImageSelectionOrder,
            getProductSelectedCount,
            getProductDownloadText,
            clearAllSelection,
            clearProductSelection,
            downloadAllImages,
            handleDragLeave,
            handleDrop
        };
    }
});

// 挂载应用
app.mount('#app');