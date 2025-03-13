import { NextRequest } from "next/server";
import { verifySignature, aesDecrypt } from "@/utils/crypto";
import { createRecords, updateRecords, searchRecords } from '@/utils/bitable';
import { getmeetFile } from '@/utils/meeting';
import { fetchTextFromUrl } from '@/utils/file';  // 添加这行


// 配置信息，实际应用中应从环境变量获取
const TOKEN = process.env.TENCENT_MEETING_TOKEN || "";
const ENCODING_AES_KEY = process.env.TENCENT_MEETING_ENCODING_AES_KEY || "";

/**
 * GET请求处理 - 用于URL有效性验证
 */
export async function GET(request: NextRequest) {

    try {
        // 1. 获取URL参数
        const searchParams = request.nextUrl.searchParams;
        const checkStr = searchParams.get("check_str");

        // 2. 获取Header参数
        const timestamp = request.headers.get("timestamp");
        const nonce = request.headers.get("nonce");
        const signature = request.headers.get("signature");

        // 3. 参数校验
        if (!checkStr || !timestamp || !nonce || !signature) {
            return new Response("Missing required parameters", { status: 400 });
        }

        // 4. 签名验证
        const isValid = verifySignature(
            TOKEN,
            timestamp,
            nonce,
            decodeURIComponent(checkStr),
            signature
        );

        if (!isValid) {
            return new Response("Invalid signature", { status: 403 });
        }

        // 5. 解密check_str
        console.log('ENCODING_AES_KEY:', ENCODING_AES_KEY);
        console.log('check_str:', decodeURIComponent(checkStr));
        const decryptedStr = await aesDecrypt(decodeURIComponent(checkStr), ENCODING_AES_KEY);
        console.log('decryptedStr:', decryptedStr);

        // 6. 返回解密后的明文，不能加引号和换行符
        return new Response(decryptedStr, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    } catch (error) {
        console.error("Error processing GET request:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

/**
 * POST请求处理 - 用于接收事件消息
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 获取Header参数
        const timestamp = request.headers.get("timestamp");
        const nonce = request.headers.get("nonce");
        const signature = request.headers.get("signature");

        // 2. 参数校验
        if (!timestamp || !nonce || !signature) {
            return new Response("Missing required parameters", { status: 400 });
        }

        // 3. 获取请求体
        const body = await request.json();
        if (!body.data) {
            return new Response("Missing data in request body", { status: 400 });
        }

        // 4. 签名验证
        const isValid = verifySignature(
            TOKEN,
            timestamp,
            nonce,
            body.data,
            signature
        );

        if (!isValid) {
            return new Response("Invalid signature", { status: 403 });
        }

        // 5. 解密数据
        const decryptedData = await aesDecrypt(body.data, ENCODING_AES_KEY);

        // 6. 处理解密后的数据
        const eventData = JSON.parse(decryptedData);
        console.log("Received event:", eventData);

        // 处理不同类型的事件
        switch (eventData.event) {
            case "recording.completed":
                // 处理云录制完成事件
                const payload = eventData.payload[0];

                const tableId = 'tbl4EkvHwDU3olD7';
                const meetingId = payload.meeting_info.meeting_id;
                const fileId = payload.recording_files[0].record_file_id;
                const userId = payload.meeting_info.creator.userid;
                const userName = payload.meeting_info.creator.user_name;

                // 根据meetingI查询记录是否存在，如果不存在，则创建记录
                const params = {
                    filter: `CurrentValue.[meeting_id]="${meetingId}"`,
                };
                const search_result = await searchRecords(tableId, params);
                if (search_result?.total && search_result.total > 0) {
                    console.log('记录已存在，无需创建！');
                    return;
                }

                // 创建记录数据字段数据
                const testRecord = {
                    meeting_id: meetingId,
                    start_time: payload.meeting_info.start_time * 1000,
                    end_time: payload.meeting_info.end_time * 1000,
                    meeting_name: payload.meeting_info.subject,
                    user_name: userName,
                    userid: userId,
                    record_file_id: fileId,
                };

                const record_result = await createRecords(tableId, testRecord);
                const meetfile_result = await getmeetFile(fileId, userId);

                // 从返回结果中获取record_id
                // 使用可选链操作符来安全访问属性
                const recordId = record_result?.record?.record_id;
                if (!recordId) {
                    throw new Error('无法获取记录ID，record_result可能未包含预期的数据结构');
                }

                const fileAddress = meetfile_result.meeting_summary?.find(
                    (item) => item.file_type === "txt"
                )?.download_address;

                // 尝试获取会议文件内容
                const fileContent = await fetchTextFromUrl(fileAddress || "")
                console.log('Meeting file content:', fileContent);

                // 使用record_id更新记录
                await updateRecords(tableId, recordId, {
                    // 这里添加需要更新的字段
                    meeting_summary: fileContent || ""
                });
                break;
            default:
                console.log(`Unhandled event type: ${eventData.event}`);
                break;
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