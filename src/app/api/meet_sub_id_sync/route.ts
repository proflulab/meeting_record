/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-08 10:00:00
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-04-08 17:23:19
 * @FilePath: /meeting_record/src/app/api/meet_sub_id_sync/route.ts
 * @Description: 会议详情同步接口
 */

import { NextRequest } from "next/server";
import { getMeetingDetail } from "@/utils/meeting";
import { searchRecords, batchUpdateRecords } from "@/utils/bitable";

// 定义接口响应类型
interface SyncResponse {
    success: boolean;
    total_processed: number;
    updated_records: number;
    error?: string;
    details?: Record<string, unknown>;
}

/**
 * POST请求处理 - 同步会议详情
 */
export async function POST(request: NextRequest) {
    try {
        // 从请求体中获取参数
        const requestBody = await request.json();
        const userId = requestBody.userId;
        const meetingIds = requestBody.meeting_id;
        const tableId = requestBody.tableId || 'tbl4EkvHwDU3olD7'; // 默认表格ID

        // 验证参数
        if (!userId || !meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: "缺少必要参数：userId 和 meeting_id 数组"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        console.log(`开始处理会议同步请求，用户ID: ${userId}, 会议ID数量: ${meetingIds.length}`);

        // 1. 先查询多维表格中符合条件的记录（meeting_id不为空且sub_meeting_id为空）
        const filter = `NOT(CurrentValue.[meeting_id]="") && CurrentValue.[sub_meeting_id]=""`;
        const existingRecords = await searchRecords(tableId, {
            filter: filter,
            page_size: 500 // 设置一个合理的页面大小
        });

        console.log(`从多维表格中查询到 ${existingRecords?.total || 0} 条符合条件的记录`);

        // 存储所有记录的映射，以record_id为键
        const recordsMap = new Map();
        // 存储meeting_id到record_id列表的映射
        const meetingIdToRecordIdsMap = new Map();

        if (existingRecords?.items && existingRecords.items.length > 0) {
            for (const item of existingRecords.items) {
                const id = item.record_id;
                const meetingId = item.fields.meeting_id;

                if (id && meetingId) {
                    // 以record_id为键存储记录信息
                    recordsMap.set(id, {
                        record_id: id,
                        fields: item.fields,
                        meetingId: meetingId
                    });

                    // 建立meeting_id到record_id列表的映射
                    if (!meetingIdToRecordIdsMap.has(meetingId)) {
                        meetingIdToRecordIdsMap.set(meetingId, []);
                    }
                    meetingIdToRecordIdsMap.get(meetingId).push(id);
                }
            }
        }

        console.log(`成功建立 ${recordsMap.size} 条记录映射，共 ${meetingIdToRecordIdsMap.size} 个不同的会议ID`);

        // 2. 循环处理每个会议ID
        const updateRecordsData = [];
        let processedCount = 0;

        for (const meetingId of meetingIds) {
            try {
                console.log(`处理会议ID: ${meetingId}`);

                // 检查该会议ID是否在表格中存在
                if (!meetingIdToRecordIdsMap.has(meetingId)) {
                    console.log(`会议ID ${meetingId} 在表格中不存在，跳过处理`);
                    continue;
                }

                // 获取会议详情
                const meetingDetail = await getMeetingDetail(meetingId, userId);

                if (!meetingDetail || !meetingDetail.meeting_info_list || meetingDetail.meeting_info_list.length === 0) {
                    console.log(`未找到会议ID ${meetingId} 的详情信息`);
                    continue;
                }

                const meetingInfo = meetingDetail.meeting_info_list[0];
                const recordIds = meetingIdToRecordIdsMap.get(meetingId);

                console.log(`会议ID ${meetingId} 对应 ${recordIds.length} 条记录，会议类型: ${meetingInfo.meeting_type}`);

                // 处理该会议ID对应的所有记录
                for (const recordId of recordIds) {
                    const recordInfo = recordsMap.get(recordId);


                    interface UpdateFields {
                        meeting_code: string;
                        meeting_type: number;
                        sub_meeting_id: string;
                        [key: string]: string | number;
                    }

                    const updateFields: UpdateFields = {
                        meeting_code: meetingInfo.meeting_code || "",
                        meeting_type: meetingInfo.meeting_type || 0,
                        sub_meeting_id: ""
                    };


                    // 只有当会议类型为1时才更新sub_meeting_id
                    if (meetingInfo.meeting_type === 1) {
                        if (meetingInfo.start_time) {
                            // 从会议开始时间提取时分秒
                            let timeFromMeeting = "";
                            if (meetingInfo.start_time) {
                                // 将时间戳转换为日期对象
                                const meetingDate = new Date(parseInt(meetingInfo.start_time) * 1000);
                                // 提取时分秒
                                const hours = meetingDate.getHours();
                                const minutes = meetingDate.getMinutes();
                                const seconds = meetingDate.getSeconds();
                                timeFromMeeting = `${hours}:${minutes}:${seconds}`;
                                console.log(`从会议中提取的时间: ${timeFromMeeting}`);
                            }

                            // 从记录中获取日期部分
                            let newTimestamp = "";
                            if (recordInfo.fields.start_time && timeFromMeeting) {
                                // 将记录中的时间戳转换为日期对象
                                // 判断时间戳长度，如果已经是毫秒级（13位）就不需要乘以1000
                                const startTimeStr = recordInfo.fields.start_time.toString();
                                const startTime = parseInt(startTimeStr);
                                const recordDate = new Date(startTimeStr.length >= 13 ? startTime : startTime * 1000);
                                // 提取年月日
                                const year = recordDate.getFullYear();
                                const month = recordDate.getMonth();
                                const day = recordDate.getDate();

                                // 从会议时间中提取时分秒
                                const [hours, minutes, seconds] = timeFromMeeting.split(':').map(Number);

                                // 创建新的日期对象，结合记录的日期和会议的时间
                                const combinedDate = new Date(year, month, day, hours, minutes, seconds);
                                // 转换为时间戳
                                newTimestamp = Math.floor(combinedDate.getTime() / 1000).toString();
                                console.log(`组合后的新时间戳: ${newTimestamp}`);
                            }

                            // 更新sub_meeting_id
                            updateFields.sub_meeting_id = newTimestamp;
                        }
                    }


                    // 准备更新数据
                    updateRecordsData.push({
                        record_id: recordInfo.record_id,
                        fields: updateFields
                    });

                    processedCount++;
                }

                console.log(`会议ID ${meetingId} 处理完成，已提取 current_sub_meeting_id: ${meetingInfo.current_sub_meeting_id}, meeting_code: ${meetingInfo.meeting_code}`);
            } catch (error) {
                console.error(`处理会议ID ${meetingId} 时出错:`, error);
                // 继续处理下一个会议ID
            }
        }

        // 3. 批量更新记录
        if (updateRecordsData.length > 0) {
            await batchUpdateRecords(tableId, updateRecordsData);
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
                updated_meeting_ids: updateRecordsData.map(item => {
                    const recordInfo = recordsMap.get(item.record_id);
                    return recordInfo ? recordInfo.meetingId : null;
                })
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error('同步会议详情失败:', error);

        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}