/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-10 01:23:02
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-10 02:06:33
 * @FilePath: /meeting_record/src/app/api/tencent/wecom/user/route.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */
import { NextResponse } from 'next/server';
import { weixinClient, SecretType } from '@/utils/tencent/wecom/weixin';

interface DeptUser {
    userid: string;
    department: number;
}

interface ListIdResponse {
    errcode: number;
    errmsg: string;
    next_cursor: string;
    dept_user: DeptUser[];
}

export async function GET() {
    try {
        const access_token = await weixinClient.getAccessToken(SecretType.CONTACT);
        const allUsers: DeptUser[] = [];
        let cursor = '';

        // 循环获取所有数据
        do {
            const response = await fetch(
                `https://qyapi.weixin.qq.com/cgi-bin/user/list_id?access_token=${access_token}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        cursor: cursor,
                        limit: 10000, // 每次请求最大数量
                    }),
                }
            );

            const data: ListIdResponse = await response.json();

            if (data.errcode !== 0) {
                // 如果是token失效，清除缓存
                if (data.errcode === 40014 || data.errcode === 42001) {
                    weixinClient.clearTokenCache(SecretType.CONTACT);
                }
                throw new Error(`获取成员列表失败: ${data.errmsg} (错误码: ${data.errcode})`);
            }

            // 添加本次获取的用户数据
            allUsers.push(...data.dept_user);

            // 更新游标
            cursor = data.next_cursor;
        } while (cursor); // 当next_cursor为空时表示没有更多数据

        return NextResponse.json({
            code: 0,
            message: 'success',
            data: allUsers
        });
    } catch (error) {
        console.error('获取成员列表失败:', error);
        return NextResponse.json(
            {
                code: 500,
                message: error instanceof Error ? error.message : '获取成员列表失败',
                data: null
            },
            { status: 500 }
        );
    }
}