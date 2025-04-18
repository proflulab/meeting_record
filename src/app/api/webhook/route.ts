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
                const tableId = 'tbl4EkvHwDU3olD7';
                const payload = eventData.payload[0];
                const meetingInfo = payload.meeting_info;
                const {
                    meeting_id,
                    meeting_code,
                    meeting_type,
                    sub_meeting_id,
                    creator: { userid, user_name },
                    start_time,
                    end_time,
                    subject
                } = meetingInfo;

                // 处理所有录制文件
                for (const recordingFile of payload.recording_files) {
                    const { record_file_id } = recordingFile;
                    console.log(`处理录制文件ID: ${record_file_id}`);
                    // 根据fileId查询记录是否存在，如果不存在，则创建记录
                    const params = {
                        filter: `CurrentValue.[record_file_id]="${record_file_id}"`,
                    };
                    const search_result = await searchRecords(tableId, params);
                    if (search_result?.total && search_result.total > 0) {
                        console.log(`记录已存在，无需创建！文件ID: ${record_file_id}`);
                        continue;
                    }

                    // 构建记录数据
                    const recordData = {
                        meeting_id,
                        meeting_code,
                        meeting_type,
                        sub_meeting_id,
                        start_time: start_time * 1000,
                        end_time: end_time * 1000,
                        meeting_name: subject,
                        user_name,
                        userid,
                        record_file_id,
                    };
                    const record_result = await createRecords(tableId, recordData);
                    const meetfile_result = await getmeetFile(record_file_id, userid);
                    const recordId = record_result?.record?.record_id;
                    if (!recordId) {
                        console.error(`无法获取记录ID，文件ID: ${record_file_id}，跳过此文件处理`);
                        continue;
                    }

                    const summaryAddress = meetfile_result.meeting_summary?.find(
                        (item) => item.file_type === "txt"
                    )?.download_address;
                    const transcriptsAddress = meetfile_result.ai_meeting_transcripts?.find(
                        (item) => item.file_type === "txt"
                    )?.download_address;
                    const minutesAddress = meetfile_result.ai_minutes?.find(
                        (item) => item.file_type === "txt"
                    )?.download_address;

                    // 获取会议文件内容
                    const summaryfileContent = await fetchTextFromUrl(summaryAddress || "");
                    const transcriptsfileContent = await fetchTextFromUrl(transcriptsAddress || "");
                    const minutesfileContent = await fetchTextFromUrl(minutesAddress || "");
                    console.log(`文件ID: ${record_file_id} 的内容已获取`);
                    // 更新记录
                    await updateRecords(tableId, recordId, {
                        meeting_summary: summaryfileContent || "",
                        ai_meeting_transcripts: transcriptsfileContent || "",
                        ai_minutes: minutesfileContent || "",
                    });
                    console.log(`文件ID: ${record_file_id} 的记录已更新`);
                }
                console.log('所有录制文件处理完成');
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