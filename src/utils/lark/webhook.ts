import * as Lark from '@larksuiteoapi/node-sdk';
import { EventEmitter } from 'events';

// 配置信息，实际应用中应从环境变量获取
const baseConfig = {
    appId: process.env.LARK_APP_ID || 'cli_a67786b726795013',
    appSecret: process.env.LARK_APP_SECRET || 'jmMJaQ4koTsl0kpJ5Lk3MgGqN0MlZhY5'
};

class BitableWebhookHandler extends EventEmitter {
    public on(event: 'recordChanged', listener: (data: any) => void): this {
        return super.on(event, listener);
    }
    private wsClient: Lark.WSClient;

    constructor() {
        super();
        this.wsClient = new Lark.WSClient(baseConfig);
        this.initializeWebSocket();
    }

    private initializeWebSocket() {
        this.wsClient.start({
            eventDispatcher: new Lark.EventDispatcher({}).register({
                'drive.file.bitable_record_changed_v1': async (data: any) => {
                    // 触发事件，让外部监听者处理数据变更
                    this.emit('recordChanged', data);
                },
            })
        });
    }

    // 提供方法用于外部停止WebSocket连接
}

// 创建单例实例
const webhookHandler = new BitableWebhookHandler();

export default webhookHandler;