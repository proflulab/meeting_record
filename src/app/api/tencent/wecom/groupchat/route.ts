/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-10 02:40:02
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-10 21:08:08
 * @FilePath: /meeting_record/src/app/api/tencent/wecom/groupchat/route.ts
 * @Description: 获取客户群列表API
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */
import { NextResponse } from 'next/server';
import { weixinClient, SecretType } from '@/utils/tencent/wecom/weixin';

interface GroupChat {
    chat_id: string;
    status: number;
}

interface ListResponse {
    errcode: number;
    errmsg: string;
    group_chat_list: GroupChat[];
    next_cursor: string;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status_filter = Number(searchParams.get('status_filter')) || 0;
        const userid_list = searchParams.get('userid_list')?.split(',') || [];
        const limit = Number(searchParams.get('limit')) || 1000;
        let cursor = searchParams.get('cursor') || '';

        const access_token = await weixinClient.getAccessToken(SecretType.APP);
        const allGroups: GroupChat[] = [];

        // 循环获取所有数据
        do {
            const response = await fetch(
                `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/list?access_token=${access_token}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        status_filter,
                        owner_filter: userid_list.length > 0 ? { userid_list } : undefined,
                        cursor,
                        limit,
                    }),
                }
            );

            const data: ListResponse = await response.json();

            if (data.errcode !== 0) {
                // 如果是token失效，清除缓存
                if (data.errcode === 40014 || data.errcode === 42001) {
                    weixinClient.clearTokenCache(SecretType.APP);
                }
                throw new Error(`获取客户群列表失败: ${data.errmsg} (错误码: ${data.errcode})`);
            }

            // 添加本次获取的群组数据
            allGroups.push(...data.group_chat_list);

            // 更新游标
            cursor = data.next_cursor;
        } while (cursor); // 当next_cursor为空时表示没有更多数据

        return NextResponse.json({
            code: 0,
            message: 'success',
            data: allGroups
        });
    } catch (error) {
        console.error('获取客户群列表失败:', error);
        return NextResponse.json(
            {
                code: 500,
                message: error instanceof Error ? error.message : '获取客户群列表失败',
                data: null
            },
            { status: 500 }
        );
    }
}