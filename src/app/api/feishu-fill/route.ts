import { createRecords, updateRecords, findRecordByUniqueKey } from '../../../utils/bitable';
import { NextResponse } from 'next/server';

interface ChangePayload {
    type: 'new' | 'modified';
    record_id: string;
    fields: Record<string, any>;
}

const RATE_LIMIT_DELAY = 2000;
let lastRequestTime = 0;
let queue: (() => Promise<void>)[] = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;
    const task = queue.shift();
    if (task) {
        try {
            await task();
        } catch (error) {
            console.error('队列任务处理失败:', error);
        }

        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
        }
        lastRequestTime = Date.now();
    }
    isProcessing = false;
    process.nextTick(processQueue);
}

function fieldsChanged(original: Record<string, any>, incoming: Record<string, any>): boolean {
    for (const key of Object.keys(incoming)) {
        const newValue = incoming[key];
        const oldValue = original[key];
        if (typeof newValue === 'object' || typeof oldValue === 'object') continue;
        if (String(newValue || '').trim() !== String(oldValue || '').trim()) {
            return true;
        }
    }
    return false;
}

async function handleRecordChange(change: ChangePayload) {
    const { type, fields: fieldsPayload } = change;
    const TARGET_TABLE_ID = process.env.LARK_TABLE_ID!;
    const UNIQUE_ID_FIELD_NAME = process.env.LARK_UNIQUE_ID_FIELD_NAME || '序号';

    const uniqueIdValue = String(fieldsPayload[UNIQUE_ID_FIELD_NAME] || '').trim();
    if (!uniqueIdValue) {
        return { success: false, message: `缺少唯一字段：${UNIQUE_ID_FIELD_NAME}` };
    }

    return new Promise((resolve) => {
        queue.push(async () => {
            try {
                const existingRecordId = await findRecordByUniqueKey(
                    TARGET_TABLE_ID,
                    UNIQUE_ID_FIELD_NAME,
                    uniqueIdValue
                );

                if (existingRecordId) {
                    const existingRecordData = await findRecordByUniqueKey(
                        TARGET_TABLE_ID,
                        UNIQUE_ID_FIELD_NAME,
                        uniqueIdValue,
                        true // 加载完整字段
                    );

                    if (fieldsChanged(existingRecordData?.fields || {}, fieldsPayload)) {
                        const result = await updateRecords(TARGET_TABLE_ID, existingRecordId, fieldsPayload);
                        resolve({ success: true, operation: 'update', recordId: existingRecordId, result });
                    } else {
                        resolve({ success: true, operation: 'skip', message: '字段无变化，跳过更新' });
                    }
                } else {
                    const result = await createRecords(TARGET_TABLE_ID, fieldsPayload);
                    resolve({ success: true, operation: 'create', recordId: result?.record?.record_id || 'unknown', result });
                }
            } catch (error: any) {
                resolve({ success: false, message: error.message });
            }
        });

        processQueue();
    });
}

export async function POST(request: Request) {
    console.log('📩 [Fill Service] 收到POST请求');
    try {
        const changePayload = await request.json();

        if (!changePayload?.type || !changePayload?.record_id || !changePayload?.fields) {
            throw new Error('无效的请求体，需要包含 type, record_id 和 fields');
        }

        const result = await handleRecordChange(changePayload);

        return NextResponse.json(result, {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            message: error.message,
            errorDetails: process.env.NODE_ENV === 'development' ? {
                type: error.name,
                stack: error.stack
            } : undefined
        }, {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Feishu Fill 服务运行中',
        environment: {
            tableId: process.env.LARK_TABLE_ID ? '已配置' : '未配置',
            uniqueIdField: process.env.LARK_UNIQUE_ID_FIELD_NAME || '未配置(默认使用"序号")',
            rateLimit: '2000ms'
        }
    }, { status: 200 });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
