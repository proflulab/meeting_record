import webhookHandler from './webhook';

/**
 * 初始化飞书服务
 * 此函数会在应用启动时被调用，用于初始化所有飞书相关的服务
 */
export function initLarkServices() {
    // webhookHandler 在导入时会自动初始化并建立WebSocket连接
    console.log('飞书服务初始化完成');
}