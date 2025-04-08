/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-07 23:13:27
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-04-08 11:31:46
 * @FilePath: /meeting_record/src/app/api/participants_sync/route.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */

import { NextRequest } from "next/server";
import { getMeetingParticipants } from "@/utils/meeting";
import { searchRecords, batchUpdateRecords } from "@/utils/bitable";

// 定义接口响应类型
interface SyncResponse {
    success: boolean;
    total_processed: number;
    updated_records: number;
    error?: string;
    details?: any;
}

/**
 * POST请求处理 - 同步会议参会者
 */
export async function POST(request: NextRequest) {
    try {
        // 从请求体中获取参数
        const requestBody = await request.json();
        const tableId = requestBody.tableId || 'tbl4EkvHwDU3olD7'; // 默认表格ID
        const limit = requestBody.limit || 500; // 限制处理的记录数，默认50条

        console.log(`开始处理会议参会者同步请求，表格ID: ${tableId}, 限制处理: ${limit}条`);

        // 1. 查询多维表格中符合条件的记录（meeting_id不为空且sub_meeting_id不为空）
        const filter = `NOT(CurrentValue.[meeting_id]="") && CurrentValue.[participants]=""`;
        const existingRecords = await searchRecords(tableId, {
            filter: filter,
            page_size: limit
        });

        console.log(`从多维表格中查询到 ${existingRecords?.total || 0} 条符合条件的记录`);

        if (!existingRecords?.items || existingRecords.items.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                total_processed: 0,
                updated_records: 0,
                details: "没有找到符合条件的记录"
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 2. 循环处理每条记录
        const updateRecordsData = [];
        let processedCount = 0;

        for (const record of existingRecords.items) {
            try {
                const recordId = record.record_id || "";
                const meetingId = record.fields.meeting_id;
                const subMeetingId = record.fields.sub_meeting_id;
                const userId = record.fields.userid || record.fields.user_id;

                if (!meetingId || !subMeetingId || !userId) {
                    console.log(`记录 ${recordId} 缺少必要参数，跳过处理`);
                    continue;
                }

                console.log(`处理记录ID: ${recordId}, 会议ID: ${meetingId}, 子会议ID: ${subMeetingId}, 用户ID: ${userId}`);

                // 获取会议参会者列表
                const participantsData = await getMeetingParticipants(String(meetingId), String(userId), String(subMeetingId));

                if (!participantsData || !participantsData.participants || participantsData.participants.length === 0) {
                    console.log(`会议ID ${meetingId} 没有参会者信息`);
                    continue;
                }

                // 解码参会者名称并提取为数组
                const participantNames = [...new Set(participantsData.participants.map(participant => {
                    try {
                        // Base64解码
                        const decodedName = Buffer.from(participant.user_name, 'base64').toString('utf-8');
                        return decodedName;
                    } catch (error) {
                        console.error(`解码参会者名称失败: ${participant.user_name}`, error);
                        return participant.user_name; // 如果解码失败，返回原始值
                    }
                }))];

                console.log(`会议ID ${meetingId} 有 ${participantNames.length} 名参会者`);

                console.log(`会议ID ${meetingId} 有 ${participantNames.length} 名参会者`);

                // 准备更新数据
                updateRecordsData.push({
                    record_id: recordId,
                    fields: {
                        participants: String(participantNames)
                    }
                });

                processedCount++;
            } catch (error) {
                console.error(`处理记录时出错:`, error);
                // 继续处理下一条记录
            }
        }

        // 3. 批量更新记录
        let updateResult = null;
        if (updateRecordsData.length > 0) {
            updateResult = await batchUpdateRecords(tableId, updateRecordsData);
            console.log(`成功更新 ${updateRecordsData.length} 条记录`);
        } else {
            console.log('没有需要更新的记录');
        }

        // 4. 返回处理结果
        const response: SyncResponse = {
            success: true,
            total_processed: processedCount,
            updated_records: updateRecordsData.length,
            details: {
                updated_record_ids: updateRecordsData.map(item => item.record_id)
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error('同步会议参会者失败:', error);

        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}