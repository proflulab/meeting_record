import * as Lark from '@larksuiteoapi/node-sdk';
import { EventEmitter } from 'events';


class BitableWebhookHandler extends EventEmitter {
    public on(event: 'recordChanged', listener: (data: any) => void): this {
        return super.on(event, listener);
    }
    private wsClient: Lark.WSClient;

    constructor() {
        super();
        if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
            throw new Error('LARK_APP_ID and LARK_APP_SECRET must be provided in environment variables');
        }
        this.wsClient = new Lark.WSClient({
            appId: process.env.LARK_APP_ID,
            appSecret: process.env.LARK_APP_SECRET
        });
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