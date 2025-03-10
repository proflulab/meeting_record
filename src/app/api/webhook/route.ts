import { NextRequest } from "next/server";
import { verifySignature, aesDecrypt } from "@/utils/crypto";
import { createRecords } from '@/utils/bitable';

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
                console.log("Recording completed event received:", {
                    traceId: eventData.trace_id,
                    operateTime: new Date(payload.operate_time).toISOString(),
                    recordingFiles: payload.recording_files,
                    meetingInfo: payload.meeting_info
                });

                const testTableId = 'tbl4EkvHwDU3olD7';
                // 创建测试记录数据
                const testRecord = {
                    meeting_id: payload.meeting_info.meeting_id,
                    start_time: payload.meeting_info.start_time * 1000,
                    end_time: payload.meeting_info.end_time * 1000,
                    meeting_name: payload.meeting_info.subject,
                    user_name: payload.meeting_info.creator.user_name,
                    userid: payload.meeting_info.creator.userid
                };

                await createRecords(testTableId, testRecord);

                // 获取录制详情
                // try {
                //     const recordFileId = payload.recording_files[0].record_file_id;
                //     const userId = payload.meeting_info.host_user_id;
                //     const recordingDetail = await getRecordingDetail(recordFileId, userId);
                //     console.log("Recording detail fetched:", recordingDetail);
                // } catch (error) {
                //     console.error("Error fetching recording detail:", error);
                // }
                // TODO: 这里可以添加将录制信息保存到数据库的逻辑
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