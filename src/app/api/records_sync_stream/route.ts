/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-07 07:12:24
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-04-07 07:27:31
 * @FilePath: /meeting_record/src/app/api/records_sync_stream/route.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */

import { NextRequest } from "next/server";
import { getCorpRecords } from "@/utils/meeting";
import { searchRecords, batchCreateRecords } from "@/utils/bitable";

// 定义接口响应类型
interface SyncResponse {
    success: boolean;
    total_found: number;
    new_records: number;
    error?: string;
    details?: any;
}

/**
 * POST请求处理 - 同步会议录制记录（流式响应）
 */
export async function POST(request: NextRequest) {
    // 创建一个流式响应
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // 发送进度消息的辅助函数
    // 发送进度消息的辅助函数
    const sendProgress = async (message: string, data?: any) => {
        const payload = JSON.stringify({
            message,
            timestamp: new Date().toISOString(),
            data
        }) + '\n';
        await writer.write(encoder.encode(payload));

        // 添加这一行，确保数据立即发送到客户端
        await writer.ready;
    };

    // 异步处理主逻辑
    (async () => {
        try {
            // 从请求体中获取参数
            const requestBody = await request.json();
            const startTime = requestBody.startTime; // 开始时间戳（秒）
            const endTime = requestBody.endTime;     // 结束时间戳（秒）
            const tableId = requestBody.tableId || 'tbl4EkvHwDU3olD7'; // 默认表格ID

            // 验证参数
            if (!startTime || !endTime) {
                await sendProgress("错误", { error: "缺少必要参数：startTime 和 endTime" });
                await writer.close();
                return;
            }

            // 计算时间区间
            const totalDays = Math.ceil((endTime - startTime) / (24 * 60 * 60));
            await sendProgress(`开始同步`, {
                timeRange: {
                    start: new Date(startTime * 1000).toLocaleString(),
                    end: new Date(endTime * 1000).toLocaleString()
                },
                totalDays
            });

            // 存储所有会议录制记录
            const allRecordings: Array<{
                record_file_id: string;
                record_start_time: number;
                record_end_time: number;
                meeting_id: string;
                userid: string;
                subject: string;
            }> = [];

            // 分批请求数据（每批31天）
            let currentStartTime = startTime;
            let batchCount = 0;

            while (currentStartTime < endTime) {
                batchCount++;
                // 计算当前批次的结束时间（不超过总结束时间）
                const batchEndTime = Math.min(currentStartTime + 31 * 24 * 60 * 60, endTime);

                await sendProgress(`处理批次 ${batchCount}`, {
                    batchStart: new Date(currentStartTime * 1000).toLocaleString(),
                    batchEnd: new Date(batchEndTime * 1000).toLocaleString()
                });

                // 获取当前页数据
                let page = 1;
                let hasMoreData = true;

                while (hasMoreData) {
                    await sendProgress(`获取第 ${page} 页数据`);
                    const response = await getCorpRecords(currentStartTime, batchEndTime, 20, page);

                    // 处理返回的会议录制数据
                    let batchRecordCount = 0;
                    if (response.record_meetings && response.record_meetings.length > 0) {
                        for (const meeting of response.record_meetings) {
                            if (meeting.record_files && meeting.record_files.length > 0) {
                                for (const file of meeting.record_files) {
                                    allRecordings.push({
                                        record_file_id: file.record_file_id,
                                        record_start_time: file.record_start_time,
                                        record_end_time: file.record_end_time,
                                        meeting_id: meeting.meeting_id,
                                        userid: meeting.userid,
                                        subject: meeting.subject
                                    });
                                    batchRecordCount++;
                                }
                            }
                        }
                    }

                    await sendProgress(`第 ${page} 页获取了 ${batchRecordCount} 条记录`, {
                        totalSoFar: allRecordings.length
                    });

                    // 判断是否还有更多数据
                    hasMoreData = response.current_page < response.total_page;
                    page++;
                }

                // 更新下一批次的开始时间
                currentStartTime = batchEndTime;
            }

            await sendProgress(`共找到 ${allRecordings.length} 条会议录制记录`);

            // 查询飞书多维表格中已有的记录
            await sendProgress(`正在查询飞书多维表格中已有记录`);
            const existingRecords = await searchRecords(tableId, {
                page_size: 500, // 假设不会超过500条记录，实际应用中可能需要分页处理
            });

            // 提取已有记录的 record_file_id
            const existingFileIds = new Set<string>();
            if (existingRecords?.items && existingRecords.items.length > 0) {
                for (const item of existingRecords.items) {
                    if (item.fields.record_file_id) {
                        existingFileIds.add(item.fields.record_file_id as string);
                    }
                }
            }

            await sendProgress(`飞书多维表格中已有 ${existingFileIds.size} 条记录`);

            // 过滤出未记录的会议录制
            const newRecordings = allRecordings.filter(recording =>
                !existingFileIds.has(recording.record_file_id)
            );

            await sendProgress(`需要新增 ${newRecordings.length} 条记录`);

            // 将新记录添加到飞书多维表格 - 使用批量创建接口
            let createdRecords: Array<Record<string, any>> = [];
            if (newRecordings.length > 0) {
                try {
                    // 准备批量创建的记录数据
                    const recordsList = newRecordings.map(recording => ({
                        meeting_id: recording.meeting_id,
                        start_time: recording.record_start_time,
                        end_time: recording.record_end_time,
                        meeting_name: recording.subject,
                        userid: recording.userid,
                        record_file_id: recording.record_file_id
                    }));

                    // 如果记录过多，分批创建
                    const BATCH_SIZE = 100; // 每批最多创建100条记录
                    for (let i = 0; i < recordsList.length; i += BATCH_SIZE) {
                        const batch = recordsList.slice(i, i + BATCH_SIZE);
                        await sendProgress(`正在创建第 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recordsList.length / BATCH_SIZE)} 批记录 (${batch.length}条)`);

                        // 批量创建记录
                        const batchResult = await batchCreateRecords(tableId, batch);
                        if (batchResult?.records) {
                            createdRecords = [...createdRecords, ...batchResult.records];
                        }
                    }

                    await sendProgress(`成功批量创建 ${createdRecords.length} 条记录`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "未知错误";
                    await sendProgress(`批量创建记录失败: ${errorMessage}`, { error: errorMessage });
                }
            }

            // 返回最终处理结果
            const finalResponse: SyncResponse = {
                success: true,
                total_found: allRecordings.length,
                new_records: createdRecords.length,
                details: {
                    time_range: {
                        start: new Date(startTime * 1000).toISOString(),
                        end: new Date(endTime * 1000).toISOString()
                    }
                }
            };

            await sendProgress(`同步完成`, finalResponse);
            await writer.close();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "未知错误";
            console.error("同步会议录制记录失败:", error);
            await sendProgress(`同步失败`, { error: errorMessage });
            await writer.close();
        }
    })();

    // 立即返回流式响应
    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // 禁用Nginx缓冲
        }
    });
}
