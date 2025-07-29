const https = require('https');
const os = require('os');

class InvalidRegistryKeyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidRegistryKeyError';
    }
}

class TrackerUtil {
    constructor(isDev = false) {
        this.baseUrl = isDev ? 'https://scriptv2-dev.qfei.cn' : 'https://scriptv2.qfei.cn';
        this.clientType = 'VideoConverter';
        this.clientId = 2;
        this.openId = null;
    }

    // 发送 POST 请求的通用方法
    async sendRequest(path, data) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl);
            const options = {
                hostname: url.hostname,
                path: `/api${path}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            
            // 如果有 openId，添加到 Cookie 中
            if (this.openId) {
                options.headers['Cookie'] = `open_id=${this.openId}`;
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        console.log('服务器响应内容:', responseData);
                        reject(new Error(`HTTP Error: ${res.statusCode}`));
                        return;
                    }
                    try {
                        const parsedData = JSON.parse(responseData);
                        resolve(parsedData);
                    } catch (error) {
                        console.log('响应内容:', responseData);
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(JSON.stringify(data));
            req.end();
        });
    }

    // 客户端登录
    async login(key) {
        const data = {
            key: key,
            client_id: this.clientId
        };
        
        try {
            const response = await this.sendRequest('/client/login', data);
            if (response.code === 0 && response.data) {
                this.openId = response.data;
                return response;
            } else if (response.code === 10001) {
                throw new InvalidRegistryKeyError(response.message);
            } else {
                throw new Error(response.message || '登录失败');
            }
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    // 事件追踪
    async trackEvent({
        event_type,
        event_name,
        event_time = 0,
        page_name = '',
        customized_id = '',
        customized_type = '',
    }) {
        if (!this.openId) {
            throw new Error('请先登录系统');
        }

        const data = {
            uuid: require('crypto').randomUUID(),
            os: `${os.platform()} ${os.release()}`,
            client_type: this.clientType,
            customized_id,
            customized_type,
            event_type,
            event_time,
            event_name,
            page_name,
            client_time: Date.now() // 毫秒级时间戳
        };

        try {
            return await this.sendRequest('/client/event_tracking', data);
        } catch (error) {
            console.error('Track event failed:', error);
            throw error;
        }
    }
}

module.exports = TrackerUtil; 