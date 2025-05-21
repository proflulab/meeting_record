/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-11 10:00:00
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-13 15:22:51
 * @FilePath: /meeting_record/src/app/api/tencent/wecom/route.ts
 * @Description: 获取企业微信群聊列表和详情并保存到飞书多维表格
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */
import { NextResponse } from 'next/server';
import { createTableRecord, searchTableRecords, updateTableRecord } from '@/utils/lark/bitable/lark';

// 群聊列表接口返回的群聊信息
interface GroupChat {
    chat_id: string;
    status: number;
}

// 群聊详情接口返回的群成员信息
interface GroupMember {
    userid: string;
    type: number;
    join_time: number;
    join_scene: number;
    invitor?: {
        userid: string;
    };
    group_nickname?: string;
    name?: string;
    unionid?: string;
}

// 群聊详情接口返回的群管理员信息
interface GroupAdmin {
    userid: string;
}

// 群聊详情接口返回的群聊详细信息
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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const appToken = searchParams.get('app_token');
        const tableId = searchParams.get('table_id');

        // 获取请求中的Authorization头部
        const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');

        // 验证必要参数
        if (!appToken || !tableId) {
            return NextResponse.json(
                {
                    code: 400,
                    message: '缺少必要参数：app_token 或 table_id',
                    data: null
                },
                { status: 400 }
            );
        }

        // 获取群聊列表
        const baseUrl = new URL(request.url).origin;
        const groupListResponse = await fetch(
            `${baseUrl}/api/tencent/wecom/groupchat`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader || "" // 使用请求中的Authorization头部
                }
            },
        );

        const groupListData = await groupListResponse.json();

        if (groupListData.code !== 0) {
            throw new Error(`获取群聊列表失败: ${groupListData.message}`);
        }

        const groupList: GroupChat[] = groupListData.data;
        const results = [];

        // 遍历群聊列表，获取每个群的详情并保存到飞书多维表格
        for (const group of groupList) {
            // 获取群聊详情
            const groupDetailResponse = await fetch(
                `${baseUrl}/api/tencent/wecom/groupchat/get?chat_id=${group.chat_id}&need_name=1`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader || "" // 使用请求中的Authorization头部
                    },
                }
            );

            const groupDetailData = await groupDetailResponse.json();

            if (groupDetailData.code !== 0) {
                console.error(`获取群聊 ${group.chat_id} 详情失败: ${groupDetailData.message}`);
                continue;
            }

            const groupDetail: GroupChatDetail = groupDetailData.data;

            // 准备保存到飞书多维表格的数据
            const fields = {
                'chatId': groupDetail.chat_id,
                'name': groupDetail.name,
                'owner': groupDetail.owner,
                'createTime': groupDetail.create_time * 1000,
                'notice': groupDetail.notice,
                'memberCount': groupDetail.member_list.length,
                'adminCount': groupDetail.admin_list.length,
                'memberVersion': groupDetail.member_version,
                'status': group.status === 0 ? 'normal' : 'dismissed'
            };

            // 检查群聊记录是否已存在
            const existingRecord = await searchTableRecords(appToken, tableId, {
                conjunction: 'and',
                conditions: [
                    {
                        field_name: 'chatId',
                        operator: 'is',
                        value: [groupDetail.chat_id]
                    }
                ]
            });

            let result;
            if (existingRecord) {
                // 更新现有记录
                result = await updateTableRecord(appToken, tableId, existingRecord.record_id!, fields);
                results.push({
                    chat_id: groupDetail.chat_id,
                    name: groupDetail.name,
                    action: 'updated',
                    record_id: existingRecord.record_id
                });
            } else {
                // 创建新记录
                result = await createTableRecord(appToken, tableId, fields);
                results.push({
                    chat_id: groupDetail.chat_id,
                    name: groupDetail.name,
                    action: 'created',
                    record_id: result?.record?.record_id
                });
            }
        }

        return NextResponse.json({
            code: 0,
            message: 'success',
            data: {
                total: groupList.length,
                processed: results.length,
                results
            }
        });
    } catch (error) {
        console.error('同步群聊数据到飞书多维表格失败:', error);
        return NextResponse.json(
            {
                code: 500,
                message: error instanceof Error ? error.message : '同步群聊数据到飞书多维表格失败',
                data: null
            },
            { status: 500 }
        );
    }
}