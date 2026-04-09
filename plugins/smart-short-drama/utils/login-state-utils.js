'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.LoginStateUtils = void 0;
const LOGIN_SELECTORS = {
  LOGIN_LIMIT_DIALOG: '.ae21c3f5-confirm-modal-content',
  LOGIN_LIMIT_BODY: '.ae21c3f5-confirm-modal-body',
  LOGIN_LIMIT_HEADER_TITLE: '.ae21c3f5-confirm-modal-header-title',
  LOGIN_SUCCESS_TEXT: 'text=我的素材库',
  LOGIN_SUCCESS_XPATH: "xpath=//*[contains(normalize-space(.),'我的素材库')]",
  LOGIN_LIMIT_KEYWORDS: ['超过登录限制', '登录限制', '提示', '如有需要，请联系商务/客服升级']
};
class LoginStateUtils {
  static async checkLoginStatus(page) {
    try {
      if (!page) return { success: false };
      const dialog = await page.$(LOGIN_SELECTORS.LOGIN_LIMIT_DIALOG);
      if (dialog) {
        const isVisible = await dialog
          .evaluate((el) => {
            const s = getComputedStyle(el);
            return s && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
          })
          .catch(() => false);
        if (isVisible) {
          let titleText = '';
          try {
            const title = await dialog.$(LOGIN_SELECTORS.LOGIN_LIMIT_HEADER_TITLE);
            if (title) titleText = (await title.evaluate((el) => el.textContent || '')).trim();
          } catch {}
          if (titleText === '提示') {
            let bodyText = '';
            try {
              const body = await dialog.$(LOGIN_SELECTORS.LOGIN_LIMIT_BODY);
              if (body) bodyText = (await body.evaluate((el) => el.textContent || '')).trim();
            } catch {}
            const hasLoginLimit = LOGIN_SELECTORS.LOGIN_LIMIT_KEYWORDS.some((keyword) => bodyText.includes(keyword));
            if (hasLoginLimit) {
              return { success: false, message: 'login_limit' };
            }
          }
        }
      }
      const el = await page.$(LOGIN_SELECTORS.LOGIN_SUCCESS_TEXT);
      if (el) return { success: true };
      const el2 = await page.$(LOGIN_SELECTORS.LOGIN_SUCCESS_XPATH);
      return { success: !!el2 };
    } catch (e) {
      return { success: false };
    }
  }
  static async waitForLogin(page, maxAttempts = 60, interval = 2000) {
    console.log('开始轮询检查登录状态...');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`第 ${attempt} 次检查登录状态...`);
      try {
        if (page && page.isClosed()) {
          console.log('检测到页面已关闭，用户取消了登录');
          return { success: false, message: '登录取消' };
        }
      } catch (error) {
        console.log('页面状态检查异常，可能已关闭:', error.message);
        return { success: false, message: '登录取消' };
      }
      try {
        const result = await this.checkLoginStatus(page);
        if (result.success) {
          console.log(`登录成功！共检查了 ${attempt} 次`);
          return result;
        }
        if (result.message === 'login_limit') {
          console.log('检测到超过登录限制弹窗，提前结束');
          return { success: false, message: '超过登录限制' };
        }
      } catch (error) {
        console.log(`第 ${attempt} 次检查出错（忽略错误继续检查）: ${error.message}`);
      }
      if (attempt < maxAttempts) {
        console.log(`等待 ${interval}ms 后进行下一次检查...`);
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }
    console.log(`登录检查超时，共检查了 ${maxAttempts} 次`);
    return { success: false, message: '登录检查超时' };
  }
  static getSelectors() {
    return LOGIN_SELECTORS;
  }
}
exports.LoginStateUtils = LoginStateUtils;
module.exports = { LoginStateUtils };
