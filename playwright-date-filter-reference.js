'use strict';

/**
 * Playwright 日期筛选稳定版示例
 *
 * 这个文件专门演示下面几件事：
 * 1. 页面存在遮罩层时，如何等待遮罩消失后再点击
 * 2. 普通 click 不稳定时，如何自动回退到 JS click
 * 3. 日期输入框为什么要先激活再 fill
 * 4. 为什么结束日期输入后要补一个 Enter
 * 5. 如何恢复“先重置筛选器，等待 60 秒，再设置条件”的流程
 *
 * 适用场景：
 * - Arco / React 类页面
 * - 页面有 loading mask / overlay
 * - 日期输入框偶发填不进去
 * - Playwright 报错 “intercepts pointer events” / “element is not stable”
 */

const { chromium } = require('playwright');

class StableFilterExample {
  constructor(page) {
    this.page = page;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 等待页面上的阻塞遮罩消失。
   * 这一步是整个稳定性的基础。
   */
  async waitForBlockingOverlayToDisappear(timeout = 30000, reason = 'interaction') {
    if (!this.page) {
      return;
    }

    try {
      await this.page.waitForFunction(
        () => {
          const selectors = ['#overlay', '#task-overlay', '.overlay-M9HUOF', '.arco-spin-mask'];

          const isBlocking = (element) => {
            if (!element) {
              return false;
            }

            const style = window.getComputedStyle(element);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.pointerEvents === 'none' ||
              Number(style.opacity || '1') === 0
            ) {
              return false;
            }

            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };

          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              if (isBlocking(element)) {
                return false;
              }
            }
          }

          return true;
        },
        null,
        { timeout }
      );
    } catch (error) {
      console.warn(`[StableFilterExample] overlay wait timed out before ${reason}: ${error.message}`);
    }
  }

  /**
   * 稳定点击：
   * 1. 先等遮罩消失
   * 2. 再 scrollIntoView
   * 3. 正常 click 失败时，回退到 JS click
   */
  async safeElementClick(elementOrSelector, label, options = {}) {
    const {
      timeout = 10000,
      postDelay = 500,
      waitForSelectorOptions = { state: 'visible' },
      overlayTimeout = 30000,
      allowJsFallback = true
    } = options;

    let elementHandle = elementOrSelector;
    if (typeof elementOrSelector === 'string') {
      elementHandle = await this.page.waitForSelector(elementOrSelector, {
        timeout,
        ...waitForSelectorOptions
      });
    }

    if (!elementHandle) {
      throw new Error(`${label} not found`);
    }

    await this.waitForBlockingOverlayToDisappear(overlayTimeout, `${label} click`);

    try {
      await elementHandle.scrollIntoViewIfNeeded();
    } catch {}

    try {
      await elementHandle.click({ timeout });
    } catch (error) {
      const message = error?.message || String(error);
      const shouldFallback =
        allowJsFallback &&
        (message.includes('intercepts pointer events') || message.includes('not stable') || message.includes('Timeout'));

      if (!shouldFallback) {
        throw error;
      }

      console.warn(`[StableFilterExample] falling back to JS click for ${label}: ${message}`);
      await this.page.evaluate((element) => {
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.click();
      }, elementHandle);
    }

    if (postDelay > 0) {
      await this.sleep(postDelay);
    }

    await this.waitForBlockingOverlayToDisappear(overlayTimeout, `${label} post-click`);
    return elementHandle;
  }

  /**
   * 重置筛选器。
   * 流程：
   * 筛选器 -> 重置 -> 确定
   */
  async resetFilter() {
    console.log('[StableFilterExample] 开始重置筛选器...');

    await this.safeElementClick('button:has-text("筛选器")', '筛选器按钮', {
      timeout: 10000,
      postDelay: 1000
    });

    try {
      await this.safeElementClick('button:has-text("重置")', '重置按钮', {
        timeout: 5000,
        postDelay: 500
      });
      console.log('[StableFilterExample] 筛选器已重置');
    } catch (error) {
      console.log(`[StableFilterExample] 未找到重置按钮，跳过: ${error.message}`);
    }

    try {
      await this.safeElementClick('button:has-text("确定")', '筛选器确定按钮', {
        timeout: 3000,
        postDelay: 800
      });
      console.log('[StableFilterExample] 筛选器已关闭');
    } catch (error) {
      console.log(`[StableFilterExample] 未找到确定按钮，跳过: ${error.message}`);
    }
  }

  /**
   * 计算日期范围：
   * - 结束日期：昨天
   * - 开始日期：昨天往前推 8 天
   */
  buildDateRange() {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 8);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      startDateStr: formatDate(startDate),
      endDateStr: formatDate(endDate)
    };
  }

  /**
   * 填写日期范围。
   *
   * 关键点：
   * - 不要上来直接 fill
   * - 先 safeElementClick 激活输入框
   * - fill 后稍等一下
   * - 结束日期输入后 press('Enter')，让日期组件真正提交值
   */
  async fillDateRange() {
    const { startDateStr, endDateStr } = this.buildDateRange();
    console.log(`[StableFilterExample] 填写日期: ${startDateStr} 至 ${endDateStr}`);

    const startDateInput = await this.page.waitForSelector('input[placeholder="开始日期"]', {
      timeout: 10000
    });
    if (!startDateInput) {
      throw new Error('未找到开始日期输入框');
    }

    await this.safeElementClick(startDateInput, '开始日期输入框', {
      timeout: 5000,
      postDelay: 100
    });
    await startDateInput.fill(startDateStr);
    await this.sleep(300);

    const endDateInput = await this.page.waitForSelector('input[placeholder="结束日期"]', {
      timeout: 10000
    });
    if (!endDateInput) {
      throw new Error('未找到结束日期输入框');
    }

    await this.safeElementClick(endDateInput, '结束日期输入框', {
      timeout: 5000,
      postDelay: 100
    });
    await endDateInput.fill(endDateStr);
    await endDateInput.press('Enter');
    await this.sleep(300);

    console.log('[StableFilterExample] 日期填写完成');
  }

  /**
   * 添加“创建日期”筛选条件，并填写日期范围。
   */
  async addCreateDateCondition() {
    console.log('[StableFilterExample] 添加创建日期条件...');

    await this.safeElementClick('button:has-text("添加条件")', '添加条件按钮-创建日期', {
      timeout: 10000,
      postDelay: 500
    });

    try {
      await this.safeElementClick('.arco-dropdown-menu-item:has-text("添加条件")', '下拉添加条件-创建日期', {
        timeout: 5000,
        postDelay: 500
      });
    } catch (error) {
      console.log(`[StableFilterExample] 下拉添加条件不存在，继续: ${error.message}`);
    }

    await this.safeElementClick('.arco-select-view:has(input[placeholder="选择筛选项"])', '筛选项下拉框-创建日期', {
      timeout: 10000,
      postDelay: 500
    });
    await this.safeElementClick('li.arco-select-option:has-text("创建日期")', '创建日期选项', {
      timeout: 10000,
      postDelay: 500
    });

    await this.safeElementClick('.arco-select-view:has(input[placeholder="选择操作"])', '操作下拉框-创建日期', {
      timeout: 10000,
      postDelay: 500
    });
    await this.safeElementClick('li.arco-select-option:has-text("介于")', '介于选项', {
      timeout: 5000,
      postDelay: 500
    });

    await this.fillDateRange();
  }

  /**
   * 添加“文件名包含关键字”筛选条件。
   */
  async addFileNameCondition(dramaName) {
    console.log(`[StableFilterExample] 添加文件名条件: ${dramaName}`);

    await this.safeElementClick('button:has-text("添加条件")', '添加条件按钮-文件名', {
      timeout: 10000,
      postDelay: 500
    });

    try {
      await this.safeElementClick('.arco-dropdown-menu-item:has-text("添加条件")', '下拉添加条件-文件名', {
        timeout: 5000,
        postDelay: 500
      });
    } catch (error) {
      console.log(`[StableFilterExample] 第二个下拉添加条件不存在，继续: ${error.message}`);
    }

    await this.safeElementClick('.arco-select-view:has(input[placeholder="选择筛选项"])', '筛选项下拉框-文件名', {
      timeout: 10000,
      postDelay: 500
    });
    await this.safeElementClick('li.arco-select-option:has-text("文件名")', '文件名选项', {
      timeout: 10000,
      postDelay: 500
    });

    await this.safeElementClick('.arco-select-view:has(input[placeholder="选择操作"])', '操作下拉框-文件名', {
      timeout: 10000,
      postDelay: 500
    });
    await this.safeElementClick('li.arco-select-option:has-text("包含")', '包含选项', {
      timeout: 10000,
      postDelay: 500
    });

    const textInput = await this.page.waitForSelector('input[placeholder="请输入"]', { timeout: 5000 });
    if (!textInput) {
      throw new Error('未找到关键词输入框');
    }

    await this.safeElementClick(textInput, '关键词输入框', {
      timeout: 5000,
      postDelay: 100
    });
    await textInput.fill(dramaName);
    await this.sleep(500);
  }

  /**
   * 打开筛选器并设置完整条件。
   */
  async clickFilterButton(dramaName) {
    console.log('[StableFilterExample] 打开筛选器并设置条件...');

    await this.safeElementClick('button:has-text("筛选器")', '筛选器按钮', {
      timeout: 30000,
      postDelay: 1000
    });

    await this.addCreateDateCondition();
    await this.addFileNameCondition(dramaName);

    await this.safeElementClick('button:has-text("确定")', '筛选器确定按钮', {
      timeout: 10000,
      postDelay: 1000
    });

    console.log('[StableFilterExample] 筛选器设置完成');
  }

  /**
   * 完整流程：
   * 1. 先重置
   * 2. 等遮罩消失
   * 3. 等 60 秒
   * 4. 再设置新的筛选条件
   */
  async applyFilterFlow(dramaName) {
    console.log(`[StableFilterExample] 开始应用筛选流程，剧目: ${dramaName}`);

    await this.resetFilter();
    await this.waitForBlockingOverlayToDisappear(30000, 'reset filter');

    console.log('[StableFilterExample] 重置完成，等待60秒后再设置筛选条件...');
    await this.sleep(60000);

    await this.clickFilterButton(dramaName);
    await this.waitForBlockingOverlayToDisappear(30000, 'apply filter');
    await this.sleep(1000);

    console.log('[StableFilterExample] 筛选流程执行完成');
  }
}

/**
 * 运行示例：
 * 1. 先手动登录目标站点
 * 2. 页面进入到带“筛选器”按钮的列表页
 * 3. 再调用 applyFilterFlow("示例剧目")
 */
async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const helper = new StableFilterExample(page);

  try {
    await page.goto('https://usergrowth.com.cn/aigc/manage/creative?selectorId=9171e1f89a164a9d9280268360fcd5f5&q=', {
      waitUntil: 'networkidle',
      timeout: 120000
    });

    console.log('请先确认当前页面已经登录，并且已经进入可操作筛选器的页面。');
    console.log('下面给一个示例调用：');
    console.log('await helper.applyFilterFlow("示例短剧名");');

    // 教学示例：实际使用时，把下面这一行取消注释即可。
    // await helper.applyFilterFlow('示例短剧名');
  } catch (error) {
    console.error('[StableFilterExample] 示例运行失败:', error);
  } finally {
    // 教学示例默认不自动关闭浏览器，方便现场观察页面状态。
    // await browser.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[StableFilterExample] 程序异常退出:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  StableFilterExample
};
