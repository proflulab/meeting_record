import { NextRequest } from "next/server";
import { getCorpRecords } from "@/utils/tencent_meeting/meeting";
import { batchCreateRecords } from "@/utils/lark/bitable/bitable";
import { searchRecordsWithIterator } from "@/utils/lark/bitable/lark";

// 配置信息，实际应用中应从环境变量获取
const LARK_BASE_APP_TOKEN = process.env.LARK_BASE_APP_TOKEN || "";

// 定义接口响应类型
interface SyncResponse {
    success: boolean;
    total_found: number;
    new_records: number;
    error?: string;
    details?: Record<string, unknown>;
}

/**
 * POST请求处理 - 同步会议录制记录
 */
export async function POST(request: NextRequest) {
    try {
        // 从请求体中获取参数
        const requestBody = await request.json();
        const startTime = requestBody.startTime; // 开始时间戳（秒）
        const endTime = requestBody.endTime;     // 结束时间戳（秒）
        const tableId = requestBody.tableId || 'tbl4EkvHwDU3olD7'; // 默认表格ID

        // 验证参数
        if (!startTime || !endTime) {
            return new Response(JSON.stringify({
                success: false,
                error: "缺少必要参数：startTime 和 endTime"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 计算时间区间
        const totalDays = Math.ceil((endTime - startTime) / (24 * 60 * 60));
        console.log(`请求时间区间: ${new Date(startTime * 1000).toLocaleString()} 至 ${new Date(endTime * 1000).toLocaleString()}, 共 ${totalDays} 天`);

        // 存储所有会议录制记录
        const allRecordings: Array<{
            record_file_id: string;
            record_start_time: number;
            record_end_time: number;
            meeting_id: string;
            userid: string;
            subject: string;
            meeting_code: string;
        }> = [];

        // 分批请求数据（每批31天）
        let currentStartTime = startTime;
        while (currentStartTime < endTime) {
            // 计算当前批次的结束时间（不超过总结束时间）
            const batchEndTime = Math.min(currentStartTime + 31 * 24 * 60 * 60, endTime);

            console.log(`请求批次: ${new Date(currentStartTime * 1000).toLocaleString()} 至 ${new Date(batchEndTime * 1000).toLocaleString()}`);

            // 获取当前页数据
            let page = 1;
            let hasMoreData = true;

            while (hasMoreData) {
                const response = await getCorpRecords(currentStartTime, batchEndTime, 20, page);

                // 处理返回的会议录制数据
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
                                    subject: meeting.subject,
                                    meeting_code: meeting.meeting_code,
                                });
                            }
                        }
                    }
                }

                // 判断是否还有更多数据
                hasMoreData = response.current_page < response.total_page;
                page++;
            }

            // 更新下一批次的开始时间
            currentStartTime = batchEndTime;
        }

        console.log(`共找到 ${allRecordings.length} 条会议录制记录`);

        // 查询飞书多维表格中已有的记录
        // const existingRecords = await searchRecords(tableId, {
        //     page_size: 500, // 假设不会超过1000条记录，实际应用中可能需要分页处理
        // });

        const existingRecords = await searchRecordsWithIterator(LARK_BASE_APP_TOKEN, tableId, 500);

        // 提取已有记录的 record_file_id
        const existingFileIds = new Set<string>();
        if (existingRecords.length > 0) {
            for (const item of existingRecords) {
                const recordFileId = item.fields.record_file_id;
                if (Array.isArray(recordFileId)) {
                    // 假设 record_file_id 是对象数组，提取其中的 text 属性
                    const fileIds = (recordFileId as { text: string }[]).map((file) => file.text);
                    fileIds.forEach((id: string) => existingFileIds.add(id));
                } else if (typeof recordFileId === 'string') {
                    // 如果 record_file_id 是字符串，直接添加
                    existingFileIds.add(recordFileId);
                }
            }
        }

        console.log(`飞书多维表格中已有 ${existingFileIds.size} 条记录`);

        console.log(`第一个会议录制记录例子:`, JSON.stringify(allRecordings[0], null, 2));
        console.log(`已有记录的文件ID集合:`, JSON.stringify(Array.from(existingFileIds), null, 2));

        // 过滤出未记录的会议录制
        const newRecordings = allRecordings.filter(recording =>
            !existingFileIds.has(recording.record_file_id)
        );

        console.log(`需要新增 ${newRecordings.length} 条记录`);

        // 将新记录添加到飞书多维表格 - 使用批量创建接口
        let createdRecords = [];
        if (newRecordings.length > 0) {
            try {
                // 准备批量创建的记录数据
                const recordsList = newRecordings.map(recording => ({
                    meeting_id: recording.meeting_id,
                    start_time: recording.record_start_time,
                    end_time: recording.record_end_time,
                    meeting_name: recording.subject,
                    userid: recording.userid,
                    record_file_id: recording.record_file_id,
                    meeting_code: recording.meeting_code,
                }));

                // 批量创建记录
                const batchResult = await batchCreateRecords(tableId, recordsList);
                createdRecords = batchResult?.records || [];
                console.log(`成功批量创建 ${createdRecords.length} 条记录`);
            } catch (error) {
                console.error(`批量创建记录失败:`, error);
            }
        }

        // 返回处理结果
        const response: SyncResponse = {
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

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("同步会议录制记录失败:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "未知错误"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}