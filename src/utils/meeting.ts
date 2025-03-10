import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

interface MeetingSummary {
    download_address: string;
    file_type: string;
}

interface RecordingDetail {
    meeting_id: string;
    meeting_code: string;
    record_file_id: string;
    view_address?: string;
    download_address?: string;
    download_address_file_type?: string;
    audio_address?: string;
    audio_address_file_type?: string;
    meeting_summary?: MeetingSummary[];
}

/**
 * 生成腾讯会议API请求签名
 * @param secretKey 密钥
 * @param httpMethod HTTP方法
 * @param secretId 密钥ID
 * @param headerNonce 随机数
 * @param headerTimestamp 时间戳
 * @param requestUri 请求URI
 * @param requestBody 请求体
 * @returns Base64编码的签名
 */
function generateSignature(
    secretKey: string,
    httpMethod: string,
    secretId: string,
    headerNonce: string,
    headerTimestamp: string,
    requestUri: string,
    requestBody: string
): string {
    // 1. 构造签名字符串
    const headerString = `X-TC-Key=${secretId}&X-TC-Nonce=${headerNonce}&X-TC-Timestamp=${headerTimestamp}`;
    const stringToSign = `${httpMethod}\n${headerString}\n${requestUri}\n${requestBody}`;

    // 2. 使用HMAC-SHA256计算签名
    const hmac = createHmac('sha256', secretKey);
    const signature = hmac.update(stringToSign).digest('hex');

    // 3. Base64编码
    return Buffer.from(signature).toString('base64');
}

/**
 * 获取录制文件详情
 * @param recordFileId 录制文件ID
 * @param userId 用户ID
 * @returns 录制详情信息
 */
export async function getRecordingDetail(recordFileId: string, userId: string): Promise<RecordingDetail> {
    try {
        const requestUri = `/v1/addresses/${recordFileId}?userid=${userId}`;
        const apiUrl = `https://api.meeting.qq.com${requestUri}`;

        // 1. 准备请求头参数
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.random().toString(36).substring(2, 15);
        const secretId = process.env.TENCENT_MEETING_SECRET_ID || '';
        const secretKey = process.env.TENCENT_MEETING_SECRET_KEY || '';

        // 2. 生成签名
        const signature = generateSignature(
            secretKey,
            'GET',
            secretId,
            nonce,
            timestamp,
            requestUri,
            ''
        );

        // 3. 发送请求
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-TC-Key': secretId,
                'X-TC-Timestamp': timestamp,
                'X-TC-Nonce': nonce,
                'X-TC-Signature': signature,
                'AppId': process.env.TENCENT_MEETING_APP_ID || '',
                'SdkId': process.env.TENCENT_MEETING_SDK_ID || '',
                'X-TC-Registered': '1'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        return data as RecordingDetail;
    } catch (error) {
        console.error('Error fetching recording detail:', error);
        throw error;
    }
}