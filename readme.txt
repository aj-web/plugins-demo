插件开发指南 - triggerEvent 参数组装规则
============================================

概述
----
当插件前端使用 triggerEvent() 调用自己的方法时，需要正确组装参数以确保 plugin_host.js 能正确传递参数到目标方法。

参数组装规则
-----------

1. 类方法调用 (推荐方式)
   - 在 manifest.json 中定义事件，指定 class 和 method
   - 参数通过 args 数组传递
   - plugin_host.js 会自动创建类实例并调用指定方法

   示例：
   ```javascript
   // manifest.json
   {
     "id": "image-search",
     "class": "ImageSearchNode", 
     "method": "runSearch",
     "jsFile": "nodes/image-search.js"
   }
   
   // 前端调用
   const searchParams = {
     args: [filePath, skuId]  // 参数按顺序放入数组
   };
   const result = await triggerEvent('image-search', searchParams);
   
   // plugin_host.js 会自动调用：
   // const instance = new ImageSearchNode();
   // const result = await instance.runSearch(filePath, skuId);
   ```

2. 函数调用
   - 在 manifest.json 中定义事件，指定 function
   - 参数通过 args 数组传递
   - plugin_host.js 会直接调用指定函数

   示例：
   ```javascript
   // manifest.json  
   {
     "id": "process-data",
     "function": "processData",
     "jsFile": "utils/processor.js"
   }
   
   // 前端调用
   const params = {
     args: [data, options]
   };
   const result = await triggerEvent('process-data', params);
   
   // plugin_host.js 会自动调用：
   // const result = await processData(data, options);
   ```

3. 参数传递机制
   - plugin_host.js 从 msg.call.args 获取参数数组
   - 参数按顺序传递给目标方法
   - 支持任意数量的参数

   示例：
   ```javascript
   // 目标方法签名
   async runSearch(filePath, skuId, options = {}) { ... }
   
   // 前端调用
   const params = {
     args: ['/path/to/image.jpg', '12345', { limit: 10 }]
   };
   await triggerEvent('image-search', params);
   
   // 实际调用
   // await instance.runSearch('/path/to/image.jpg', '12345', { limit: 10 })
   ```

4. 特殊情况处理
   - 无参数调用：args: []
   - 部分参数为 null：args: [null, 'value']
   - 复杂对象参数：args: [obj1, obj2]

   示例：
   ```javascript
   // 只有SKU ID，没有图片
   const params = {
     args: [null, '866648458353']
   };
   await triggerEvent('image-search', params);
   
   // 实际调用
   // await instance.runSearch(null, '866648458353')
   ```

注意事项
--------

1. 参数顺序必须与目标方法签名一致
2. args 必须是数组，即使只有一个参数
3. 不要使用 data 字段传递方法参数，应该使用 args
4. plugin_host.js 会自动处理参数传递，无需手动解析

最佳实践
--------

1. 优先使用类方法调用，便于管理状态和依赖
2. 参数命名要清晰，便于调试和维护
3. 在方法中添加参数验证和默认值处理
4. 使用 console.log 记录接收到的参数，便于调试

错误排查
--------

如果参数传递失败，检查：
1. manifest.json 中的事件定义是否正确
2. args 数组是否包含正确的参数
3. 目标方法的参数签名是否匹配
4. 浏览器控制台是否有错误信息

示例完整代码
------------

```javascript
// 前端调用示例
const searchImage = async () => {
  try {
    const params = {
      args: [selectedImage.value, skuId.value]
    };
    
    console.log('调用参数:', params);
    const result = await triggerEvent('image-search', params);
    console.log('搜索结果:', result);
    
  } catch (error) {
    console.error('搜索失败:', error);
  }
};

// 后端方法示例
class ImageSearchNode {
  async runSearch(filePath, skuId = null) {
    console.log('接收参数:', { filePath, skuId });
    
    if (filePath) {
      // 执行图片搜索
      return await this.searchByImage(filePath);
    } else if (skuId) {
      // 执行SKU搜索
      return await this.searchBySku(skuId);
    } else {
      throw new Error('请提供图片路径或SKU ID');
    }
  }
}
```

总结
----
使用 triggerEvent 调用插件方法时，关键是正确构建 args 数组，确保参数顺序和类型与目标方法匹配。plugin_host.js 会自动处理参数传递，开发者只需要关注业务逻辑即可。 