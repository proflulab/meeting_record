/**
 * @Description: 企业微信API工具类
 */

interface AccessTokenCache {
    token: string;
    expiresAt: number; // 过期时间戳
}

export enum SecretType {
    /** 通讯录同步 */
    CONTACT = 'contact',
    /** 应用消息推送 */
    APP = 'app',
    /** 客户联系 */
    CUSTOMER = 'customer',
    /** 会话存档 */
    CHAT = 'chat'
}

export class WeixinClient {
    private corpId: string;
    private secrets: Map<SecretType, string>;
    private tokenCaches: Map<SecretType, AccessTokenCache>;

    constructor() {
        this.corpId = process.env.WECOM_CORP_ID || '';
        this.secrets = new Map();
        this.tokenCaches = new Map();

        // 初始化各类型的secret
        this.secrets.set(SecretType.CONTACT, process.env.WECOM_CONTACT_SECRET || '');
        this.secrets.set(SecretType.APP, process.env.WECOM_APP_SECRET || '');
        this.secrets.set(SecretType.CUSTOMER, process.env.WECOM_CUSTOMER_SECRET || '');
        this.secrets.set(SecretType.CHAT, process.env.WECOM_CHAT_SECRET || '');

        if (!this.corpId) {
            throw new Error('企业微信配置缺失：请检查环境变量 WECOM_CORP_ID');
        }
    }

    /**
     * 获取指定类型的access_token
     * @param type 密钥类型
     * @returns access_token
     */
    async getAccessToken(type: SecretType): Promise<string> {
        const secret = this.secrets.get(type);
        if (!secret) {
            throw new Error(`企业微信配置缺失：请检查对应的Secret配置 (${type})`);
        }

        // 检查缓存是否有效
        const cache = this.tokenCaches.get(type);
        if (cache && Date.now() < cache.expiresAt) {
            return cache.token;
        }

        // 重新获取token
        try {
            const response = await fetch(
                `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpId}&corpsecret=${secret}`,
                {
                    method: 'GET',
                }
            );

            const data = await response.json();

            if (data.errcode !== 0) {
                throw new Error(`获取access_token失败: ${data.errmsg} (错误码: ${data.errcode})`);
            }

            // 更新缓存
            // 提前5分钟过期，避免临界点问题
            const expiresIn = (data.expires_in - 300) * 1000;
            const tokenCache = {
                token: data.access_token,
                expiresAt: Date.now() + expiresIn,
            };
            this.tokenCaches.set(type, tokenCache);

            return tokenCache.token;
        } catch (error) {
            console.error(`获取access_token失败 (${type}):`, error);
            throw error;
        }
    }

    /**
     * 清除指定类型的token缓存
     * @param type 密钥类型
     */
    clearTokenCache(type: SecretType) {
        this.tokenCaches.delete(type);
    }

    /**
     * 清除所有token缓存
     */
    clearAllTokenCaches() {
        this.tokenCaches.clear();
    }
}

// 导出单例实例
export const weixinClient = new WeixinClient();