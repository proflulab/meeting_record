import { createHmac } from 'crypto';
import { MeetingDetailResponse } from '../types/meeting';

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
}


// 新增录制文件对象接口
interface RecordFile {
    record_file_id: string;
    record_start_time: number;
    record_end_time: number;
    record_size: number;
    sharing_state: number;
    sharing_url?: string;
    required_same_corp?: boolean;
    required_participant?: boolean;
    password?: string;
    sharing_expire?: number;
    view_address?: string;
    allow_download?: boolean;
    download_address?: string;
}

// 新增会议录制对象接口
interface RecordMeeting {
    meeting_record_id: string;
    meeting_id: string;
    meeting_code: string;
    userid: string;
    media_start_time: number;
    subject: string;
    state: number;
    record_files?: RecordFile[];
}

// 新增会议录制列表响应接口
interface RecordMeetingsResponse {
    total_count: number;
    current_size: number;
    current_page: number;
    total_page: number;
    record_meetings?: RecordMeeting[];
    error_info?: {
        error_code: number;
        new_error_code?: number;
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

        const responseData = await response.json();

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

            if (errorInfo.error_code === 108004051) {
                throw new Error(`录制文件已经被删除: ${errorInfo.message}\n`);
            }

            throw new Error(`API请求失败: ${errorInfo.message} (错误码: ${errorInfo.error_code})`);
        }

        return responseData as RecordingDetail;
    } catch (error) {
        console.error('获取录制文件详情失败:', error);
        throw error;
    }
}


/**
 * 获取账户级会议录制列表
 * @param startTime 查询起始时间戳（单位秒）
 * @param endTime 查询结束时间戳（单位秒）
 * @param pageSize 分页大小，默认10，最大20
 * @param page 页码，从1开始，默认1
 * @returns 会议录制列表响应
 */
export async function getCorpRecords(
    startTime: number,
    endTime: number,
    pageSize: number = 10,
    page: number = 1,
    operator_id: string = process.env.USER_ID || '',
    operator_id_type: number = 1
): Promise<RecordMeetingsResponse> {
    try {
        // 验证时间区间不超过31天
        if (endTime - startTime > 31 * 24 * 60 * 60) {
            throw new Error('时间区间不允许超过31天');
        }

        // 验证分页参数
        if (pageSize > 20) {
            pageSize = 20; // 限制最大分页大小为20
        }

        const requestUri = `/v1/corp/records?start_time=${startTime}&end_time=${endTime}&page_size=${pageSize}&page=${page}&operator_id=${operator_id}&operator_id_type=${operator_id_type}`;
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

        const responseData = await response.json();

        // 4. 检查错误信息
        if (responseData.error_info) {
            const errorInfo = responseData.error_info;
            console.error('获取会议录制列表失败:', {
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

        return responseData as RecordMeetingsResponse;
    } catch (error) {
        console.error('获取会议录制列表失败:', error);
        throw error;
    }
}


/**
 * 获取会议详情
 * @param meetingId 会议ID
 * @param userId 用户ID
 * @param instanceId 实例ID，默认为1
 * @returns 会议详情响应
 */
export async function getMeetingDetail(
    meetingId: string,
    userId: string,
    instanceId: string = "1"
): Promise<MeetingDetailResponse> {
    try {
        const requestUri = `/v1/meetings/${meetingId}?userid=${userId}&instanceid=${instanceId}`;
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

        const responseData = await response.json();

        // 4. 检查错误信息
        if (responseData.error_info) {
            const errorInfo = responseData.error_info;
            console.error('获取会议详情失败:', {
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

        return responseData as MeetingDetailResponse;
    } catch (error) {
        console.error('获取会议详情失败:', error);
        throw error;
    }
}


// 参会成员接口
interface MeetingParticipantDetail {
    userid: string;
    uuid: string;
    user_name: string;
    phone: string;
    join_time: string;
    left_time: string;
    instanceid: number;
    user_role: number;
    ip: string;
    location: string;
    link_type: string;
    join_type: number;
    net: string;
    app_version: string;
    audio_state: boolean;
    video_state: boolean;
    screen_shared_state: boolean;
    webinar_member_role: number;
    ms_open_id: string;
    open_id: string;
    customer_data: string;
    is_enterprise_user: boolean;
    tm_corpid: string;
    avatar_url: string;
}

// 参会成员列表响应接口
interface MeetingParticipantsResponse {
    meeting_id: string;
    meeting_code: string;
    subject: string;
    schedule_start_time: string;
    schedule_end_time: string;
    participants: MeetingParticipantDetail[];
    has_remaining: boolean;
    next_pos: number;
    total_count: number;
    error_info?: {
        error_code: number;
        new_error_code?: number;
        message: string;
    };
}

/**
 * 获取会议参会成员列表
 * @param meetingId 会议ID
 * @param userId 用户ID
 * @param subMeetingId 子会议ID
 * @returns 参会成员列表响应
 */
export async function getMeetingParticipants(
    meetingId: string,
    userId: string,
    subMeetingId?: string | null
): Promise<MeetingParticipantsResponse> {
    try {

        console.log('subMeetingId:', subMeetingId);
        // 构建 requestUri
        const requestUri = `/v1/meetings/${meetingId}/participants?userid=${userId}`
            + (subMeetingId ? `&sub_meeting_id=${subMeetingId}` : '');
        const apiUrl = `https://api.meeting.qq.com${requestUri}`;

        console.log('apiUrl:', apiUrl);

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

        const responseData = await response.json();

        // 4. 检查错误信息
        if (responseData.error_info) {
            const errorInfo = responseData.error_info;
            console.error('获取会议参会成员列表失败:', {
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

        return responseData as MeetingParticipantsResponse;
    } catch (error) {
        console.error('获取会议参会成员列表失败:', error);
        throw error;
    }
}