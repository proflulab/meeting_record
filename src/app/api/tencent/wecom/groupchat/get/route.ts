/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-10 21:10:02
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-10 21:10:02
 * @FilePath: /meeting_record/src/app/api/tencent/wecom/groupchat/get/route.ts
 * @Description: 获取客户群详情API
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */
import { NextResponse } from 'next/server';
import { weixinClient, SecretType } from '@/utils/tencent/wecom/weixin';

interface GroupMemberInvitor {
    userid: string;
}

interface GroupMember {
    userid: string;
    type: number;
    join_time: number;
    join_scene: number;
    invitor?: GroupMemberInvitor;
    group_nickname?: string;
    name?: string;
    unionid?: string;
}

interface GroupAdmin {
    userid: string;
}

interface GroupChatDetail {
    chat_id: string;
    name: string;
    owner: string;
    create_time: number;
    notice: string;
    member_list: GroupMember[];
    admin_list: GroupAdmin[];
    member_version: string;
}

interface GroupChatResponse {
    errcode: number;
    errmsg: string;
    group_chat: GroupChatDetail;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const chat_id = searchParams.get('chat_id');
        const need_name = Number(searchParams.get('need_name')) || 0;

        if (!chat_id) {
            return NextResponse.json(
                {
                    code: 400,
                    message: '缺少必要参数：chat_id',
                    data: null
                },
                { status: 400 }
            );
        }

        const access_token = await weixinClient.getAccessToken(SecretType.APP);

        const response = await fetch(
            `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/get?access_token=${access_token}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id,
                    need_name
                }),
            }
        );

        const data: GroupChatResponse = await response.json();

        if (data.errcode !== 0) {
            // 如果是token失效，清除缓存
            if (data.errcode === 40014 || data.errcode === 42001) {
                weixinClient.clearTokenCache(SecretType.APP);
            }
            throw new Error(`获取客户群详情失败: ${data.errmsg} (错误码: ${data.errcode})`);
        }

        return NextResponse.json({
            code: 0,
            message: 'success',
            data: data.group_chat
        });
    } catch (error) {
        console.error('获取客户群详情失败:', error);
        return NextResponse.json(
            {
                code: 500,
                message: error instanceof Error ? error.message : '获取客户群详情失败',
                data: null
            },
            { status: 500 }
        );
    }
}