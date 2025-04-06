/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-07 00:56:32
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-04-07 01:53:35
 * @FilePath: /meeting_record/src/app/api/feishu_base/route.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */
import { NextRequest } from "next/server";
import { updateRecords, searchRecords } from '@/utils/bitable';
import { getmeetFile } from '@/utils/meeting';
import { fetchTextFromUrl } from '@/utils/file';  // 添加这行


/**
 * POST请求处理 - 用于接收事件消息
 */
export async function POST(request: NextRequest) {
    try {
        // 从请求体中获取参数
        const requestBody = await request.json();
        const userId = requestBody.userId;
        const fileIds = requestBody.fileId;

        // 验证参数
        if (!userId || !fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return new Response("Missing or invalid parameters", { status: 400 });
        }

        const tableId = 'tbl4EkvHwDU3olD7';
        // 处理所有文件ID
        const processedResults = [];

        for (const fileId of fileIds) {
            console.log(`处理文件ID: ${fileId}`);

            // 根据record_file_id查询记录是否存在
            const params = {
                filter: `CurrentValue.[record_file_id]="${fileId}"`,
            };
            const search_result = await searchRecords(tableId, params);

            if (search_result?.total === 0) {
                console.log(`文件ID ${fileId} 没有该记录已存在,跳过此文件ID`);
                processedResults.push({
                    fileId,
                    status: 'skipped',
                    message: '记录不存在'
                });
                continue; // 跳过此文件ID，处理下一个
            }

            try {
                const meetfile_result = await getmeetFile(fileId, userId);
                // console.log(`文件ID ${fileId} 的meetfile_result:`, JSON.stringify(meetfile_result, null, 2));

                // 从返回结果中获取record_id
                const recordId = search_result?.items?.[0]?.record_id;
                if (!recordId) {
                    throw new Error('无法获取记录ID，record_result可能未包含预期的数据结构');
                }

                const fileAddress = meetfile_result.meeting_summary?.find(
                    (item) => item.file_type === "txt"
                )?.download_address;

                // 尝试获取会议文件内容
                const fileContent = await fetchTextFromUrl(fileAddress || "")
                console.log(`文件ID ${fileId} 的会议内容获取成功`);

                // 使用record_id更新记录
                await updateRecords(tableId, recordId, {
                    // 这里添加需要更新的字段
                    meeting_summary: fileContent || ""
                });

                processedResults.push({
                    fileId,
                    status: 'success',
                    message: '处理成功'
                });
            } catch (error) {
                console.error(`处理文件ID ${fileId} 时出错:`, error);
                processedResults.push({
                    fileId,
                    status: 'error',
                    message: error instanceof Error ? error.message : '未知错误'
                });
            }
        }
        // 7. 返回成功响应
        return new Response("successfully received callback", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    } catch (error) {
        console.error("Error processing POST request:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}