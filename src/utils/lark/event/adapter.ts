/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-02 19:30:00
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-03 21:30:16
 * @FilePath: /meeting_record/src/utils/lark/event/adapter.ts
 * @Description: 飞书事件适配器
 * 
 * Copyright (c) 2025 by 杨仕明, All Rights Reserved. 
 */

import { NextRequest, NextResponse } from 'next/server';
import * as lark from '@larksuiteoapi/node-sdk';
import { pickRequestData } from './pick-request-data'

/**
 * 创建飞书事件适配器
 * @param dispatcher 事件分发器
 * @param options 配置选项
 * @returns 处理函数
 */
export const createFeishuAdapter = (
    dispatcher: lark.EventDispatcher,
    options?: {
        autoChallenge?: boolean;
        needCheck?: boolean;
    }
) => {
    return async (request: NextRequest) => {
        // 1. 把 Headers 转成普通对象
        const headers = Object.fromEntries(request.headers.entries())

        // 2. 根据 Content-Type 解析出 body
        const bodyData = await pickRequestData(request)

        // 3. 合并成 Feishu SDK 要求的数据结构
        const data = Object.assign(
            Object.create({ headers }),
            bodyData
        )

        // 2. 处理飞书的URL验证（challenge）
        const autoChallenge = options?.autoChallenge ?? true;
        if (autoChallenge) {
            const { isChallenge, challenge } = lark.generateChallenge(data, {
                encryptKey: dispatcher.encryptKey,
            });

            if (isChallenge) {
                return new NextResponse(JSON.stringify(challenge), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // 3. 处理事件分发
        try {
            const needCheck = options?.needCheck ?? false;
            // console.log('data:', JSON.stringify(data));
            const result = await dispatcher.invoke(data, { needCheck });

            // 4. 返回结果
            return new NextResponse(JSON.stringify(result || 'success'), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (err) {
            console.error('飞书事件分发出错：', err);
            console.error('错误详情：', JSON.stringify(err));
            console.error('请求数据：', JSON.stringify(data));

            return new NextResponse(
                JSON.stringify({
                    error: '飞书事件分发失败',
                    message: err instanceof Error ? err.message : 'Unknown error'
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
    };
};