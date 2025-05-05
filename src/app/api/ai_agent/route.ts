/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-25 10:00:00
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-05 18:56:22
 * @FilePath: /meeting_record/src/app/api/ai_agent/route.ts
 * @Description: AI代理接口，用于根据时间范围查询会议记录并生成会议总结
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchRecordsWithIterator } from '@/utils/lark/bitable/lark';
import { chatCompletion } from '@/utils/ai/openai/openai_chat';
import { extractAllText } from '@/utils/lark/bitable/fieldExtractors';
import { extractParticipants } from '@/utils/lark/bitable/extractParticipants';
import { batchCreateRecords } from "@/utils/lark/bitable/bitable";

// 定义接口请求参数类型
interface RequestParams {
    filter?: {
        conjunction?: "and" | "or";
        conditions?: Array<{
            field_name: string;
            operator: "is" | "isNot" | "contains" | "doesNotContain" | "isEmpty" | "isNotEmpty" | "isGreater" | "isGreaterEqual" | "isLess" | "isLessEqual" | "like" | "in";
            value?: Array<string>;
        }>;
        children?: Array<{
            conjunction: "and" | "or";
            conditions?: Array<{
                field_name: string;
                operator: "is" | "isNot" | "contains" | "doesNotContain" | "isEmpty" | "isNotEmpty" | "isGreater" | "isGreaterEqual" | "isLess" | "isLessEqual" | "like" | "in";
                value?: Array<string>;
            }>;
        }>;
    }; // 查询过滤条件
    appToken?: string; // 可选的多维表格应用Token
    tableId?: string;  // 可选的表格ID
    model?: string;    // 可选的OpenAI模型名称
}

/**
 * 处理POST请求
 * @param request NextRequest对象
 * @returns NextResponse对象
 */
export async function POST(request: NextRequest) {
    try {
        // 解析请求体
        const body = await request.json() as RequestParams;
        const { filter, appToken, tableId, model } = body;

        if (!appToken || !tableId) {
            return NextResponse.json(
                { error: '缺少必要的多维表格配置：appToken 或 tableId' },
                { status: 400 }
            );
        }

        // 查询符合条件的会议记录
        const records = await searchRecordsWithIterator(
            appToken,
            tableId,
            500, // 每页记录数
            undefined, // 不指定字段名，获取所有字段
            filter
        );

        if (!records || records.length === 0) {
            return NextResponse.json(
                { message: '未找到符合条件的会议记录' },
                { status: 404 }
            );
        }

        for (const record of records) {
            // 提取会议相关信息，根据实际表格字段调整
            const meeting_summary = extractAllText(record.fields.meeting_summary);
            const participants = extractAllText(record.fields.participants).split(',');;

            // 为每个参会人员生成单独的总结
            const attendeeSummaries: Array<{
                participant: string;
                关联例会: string[];
                项目进度总结: string;
            }> = [];

            for (const attendee of participants) {
                const participants_meet = extractParticipants(meeting_summary);

                // 如果从会议记录中提取的参会人员列表不包含当前参会者，则跳过
                if (!participants_meet.includes(attendee)) {
                    continue;
                }

                // 调用OpenAI生成会议总结
                const summary = await chatCompletion({
                    messages: [
                        { role: "system", content: "你是一个会议记录分析助手，专注于为每位参会者总结其在会议中的项目进度。" },
                        { role: "user", content: `请根据以下会议内容，针对参会者"${attendee}"在本次会议中的项目进度进行简要总结。\n会议内容：${meeting_summary}` }
                    ],
                    model: model || "deepseek-v3-250324"
                });

                // 将参会者总结添加到结果中
                attendeeSummaries.push({
                    participant: attendee,
                    关联例会: [record.record_id || ''],
                    项目进度总结: summary
                });
            }

            await batchCreateRecords("tblx2YkTD5kn4MAL", attendeeSummaries);
        }

        // 返回结果
        return NextResponse.json({
            success: true,
        });

    } catch (error: unknown) {
        console.error('AI代理处理失败:', error);

        if (error instanceof Error) {
            return NextResponse.json(
                { error: `处理失败: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: '处理失败: 未知错误' },
            { status: 500 }
        );
    }
}