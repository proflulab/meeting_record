import { createHmac } from 'crypto';
// import { HttpsProxyAgent } from 'https-proxy-agent';
// import fetch from 'node-fetch';
const axios = require('axios');
const url = require('url');
const fixieUrl = url.parse(process.env.FIXIE_URL || '');
const fixieAuth = fixieUrl.auth.split(':');

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
    // AI会议转写记录
    ai_meeting_transcripts?: MeetingSummary[];
    // AI会议纪要
    ai_minutes?: MeetingSummary[];
    // 录制文件名称
    record_name?: string;
    // 录制开始时间戳
    start_time?: string;
    // 录制结束时间戳
    end_time?: string;
    // 会议名称
    meeting_record_name?: string;
    error_info?: {
        error_code: number;
        new_error_code: number;
        message: string;
    };
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
    const headerString = `X-TC-Key=${secretId}&X-TC-Nonce=${headerNonce}&X-TC-Timestamp=${headerTimestamp}`;
    const stringToSign = `${httpMethod}\n${headerString}\n${requestUri}\n${requestBody}`;

    // 2. 使用HMAC-SHA256计算签名
    const hmac = createHmac('sha256', secretKey);
    const hash = hmac.update(stringToSign).digest('hex'); // 先获取十六进制字符串
    return Buffer.from(hash).toString('base64'); // 再进行base64编码
}

/**
 * 获取录制文件详情
 * @param fileId 录制文件ID
 * @param userId 用户ID
 * @returns 录制详情信息
 */
export async function getmeetFile(fileId: string, userId: string): Promise<RecordingDetail> {
    try {
        const requestUri = `/v1/addresses/${fileId}?userid=${userId}`;
        const apiUrl = `https://api.meeting.qq.com${requestUri}`;

        // 1. 准备请求头参数
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.floor(Math.random() * 100000).toString();
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

        // const proxy = process.env.FIXIE_URL;
        // let agent;
        // if (proxy) {
        //     agent = new HttpsProxyAgent(proxy);
        // }


        // 3. 发送请求
        // const response = await fetch(apiUrl, {
        //     method: 'GET',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'X-TC-Key': secretId,
        //         'X-TC-Timestamp': timestamp,
        //         'X-TC-Nonce': nonce,
        //         'X-TC-Signature': signature,
        //         'AppId': process.env.TENCENT_MEETING_APP_ID || '',
        //         'SdkId': process.env.TENCENT_MEETING_SDK_ID || '',
        //         'X-TC-Registered': '1'
        //     },
        //     agent: agent,
        // });

        const response = await axios.get(apiUrl, {
            proxy: {
                protocol: 'http',
                host: fixieUrl.hostname,
                port: fixieUrl.port,
                auth: { username: fixieAuth[0], password: fixieAuth[1] }
            },
            headers: {
                'Content-Type': 'application/json',
                'X-TC-Key': secretId,
                'X-TC-Timestamp': timestamp,
                'X-TC-Nonce': nonce,
                'X-TC-Signature': signature,
                'AppId': process.env.TENCENT_MEETING_APP_ID || '',
                'SdkId': process.env.TENCENT_MEETING_SDK_ID || '',
                'X-TC-Registered': '1'
            },
        })


        const responseData = await response.data as RecordingDetail;

        // 4. 检查错误信息
        if (responseData.error_info) {
            const errorInfo = responseData.error_info;
            console.error('API请求失败:', {
                错误码: errorInfo.error_code,
                新错误码: errorInfo.new_error_code,
                错误信息: errorInfo.message,
                请求URI: requestUri,
                时间戳: timestamp
            });

            // 特殊处理IP白名单错误
            if (errorInfo.error_code === 500125) {
                throw new Error(`IP白名单错误: ${errorInfo.message}\n请确保已在腾讯会议应用配置中添加当前服务器IP到白名单。`);
            }

            throw new Error(`API请求失败: ${errorInfo.message} (错误码: ${errorInfo.error_code})`);
        }

        return responseData;
    } catch (error) {
        console.error('获取录制文件详情失败:', error);
        throw error;
    }
}