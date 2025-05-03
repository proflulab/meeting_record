/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-27 09:43:12
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-03 21:36:04
 * @FilePath: /meeting_record/src/app/api/webhook/lark_event/route.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { NextRequest } from 'next/server';
import { createFeishuAdapter } from '@/utils/lark/event/adapter';


// Next.js API 路由处理
export async function POST(request: NextRequest) {
    // 创建适配器处理函数
    const handleFeishuEvent = createFeishuAdapter(eventDispatcher, {
        autoChallenge: true,  // 自动处理飞书的URL验证
        needCheck: true      // 是否启用事件安全验证，生产环境建议设为true
    });

    return handleFeishuEvent(request);
}


// 事件分发器配置（请根据实际填写加密密钥和校验Token）
const eventDispatcher = new lark.EventDispatcher({
    encryptKey: process.env.EVENT_ENCRYPT_KEY || '',
    verificationToken: process.env.EVENT_VERIFICATION_TOKEN || '',
}).register({
    'drive.file.bitable_record_changed_v1': async (data: Record<string, unknown>) => {
        console.log('收到飞书多维表格变更事件:', data);
        return 'success';
    },
    // 添加通用事件处理
    '*': async (data: Record<string, unknown>) => {
        console.log('收到未注册的飞书事件:', data);
        return 'success';
    }
});