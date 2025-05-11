import { initLarkServices } from '@/utils/lark/init';

/**
 * 应用初始化函数
 * 在应用启动时调用此函数来初始化所有必要的服务
 */
export function initializeApp() {
    // 初始化飞书服务
    initLarkServices();
    console.log('应用初始化完成');
}

// 在应用启动时立即执行初始化
initializeApp();