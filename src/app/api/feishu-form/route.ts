import { NextResponse } from 'next/server';

// 缓存数据和最后更新时间
let cachedData: any = null;
let lastUpdateTime = 0;
let lastDataItems: any[] = [];
const CACHE_DURATION = 30 * 1000; // 30秒的缓存时间

// 比较数据变更的函数
function compareDataChanges(oldItems: any[], newItems: any[]) {
    // 创建旧记录的映射，用于快速查找
    const oldItemsMap = new Map(oldItems.map(item => [item.record_id, item]));
    const changes: { type: 'new' | 'modified', record: any, changes?: { field: string, oldValue: any, newValue: any }[] }[] = [];

    // 检查新增和修改的记录
    newItems.forEach(newItem => {
        const oldItem = oldItemsMap.get(newItem.record_id);
        
        if (!oldItem) {
            // 新增的记录
            changes.push({
                type: 'new',
                record: newItem
            });
        } else {
            // 检查字段是否有修改
            const fieldChanges = Object.entries(newItem.fields).reduce((acc: any[], [field, value]) => {
                if (JSON.stringify(oldItem.fields[field]) !== JSON.stringify(value)) {
                    acc.push({
                        field,
                        oldValue: oldItem.fields[field],
                        newValue: value
                    });
                }
                return acc;
            }, []);

            if (fieldChanges.length > 0) {
                changes.push({
                    type: 'modified',
                    record: newItem,
                    changes: fieldChanges
                });
            }
        }
    });

    // 输出变更信息
    const timestamp = new Date().toLocaleString();
    console.log('\n🔄 ==================== 数据比对结果 ====================');
    console.log(`📅 比对时间: ${timestamp}`);
    console.log(`📊 比对数据: 新数据 ${newItems.length} 条 vs 旧数据 ${oldItems.length} 条`);
    
    if (changes.length > 0) {
        console.log('\n✨ 检测到数据变更：');
        changes.forEach((change, index) => {
            console.log('\n📝 ----------------------------------------');
            console.log(`🔍 变更记录 #${index + 1}`);
            console.log(`🆔 记录ID: ${change.record.record_id}`);
            if (change.type === 'new') {
                console.log('📌 类型: ➕ 新增记录');
                console.log('📋 记录内容:\n', JSON.stringify(change.record.fields, null, 2));
            } else {
                console.log('📌 类型: 🔄 记录更新');
                console.log('📋 变更字段:');
                change.changes?.forEach(fieldChange => {
                    console.log(`  📎 ${fieldChange.field}:`);
                    console.log('    ⬇️  原值:', JSON.stringify(fieldChange.oldValue, null, 2));
                    console.log('    ⬆️  新值:', JSON.stringify(fieldChange.newValue, null, 2));
                });
            }
            // --- Notify feishu-fill API for each change --- 
            let notificationPayload: { type: 'new' | 'modified', record_id: string, fields: Record<string, any> };
            if (change.type === 'new') {
                notificationPayload = {
                    type: 'new',
                    record_id: change.record.record_id,
                    fields: change.record.fields
                };
            } else { // modified
                 const changedFields = change.changes?.reduce((acc, curr) => {
                     acc[curr.field] = curr.newValue;
                     return acc;
                 }, {} as Record<string, any>) || {}; // Ensure changedFields is an object

                 // Ensure the unique identifier field is always included for lookup in feishu-fill
                 const uniqueIdFieldName = process.env.LARK_UNIQUE_ID_FIELD_NAME;
                 if (uniqueIdFieldName && change.record.fields[uniqueIdFieldName] !== undefined && changedFields[uniqueIdFieldName] === undefined) {
                    changedFields[uniqueIdFieldName] = change.record.fields[uniqueIdFieldName];
                    console.log(` LARK_UNIQUE_ID_FIELD_NAME: ${uniqueIdFieldName}, value: ${change.record.fields[uniqueIdFieldName]}`);
                    console.log(`📋 [通知] 为确保查找，已将未变更的唯一标识符 '${uniqueIdFieldName}' 添加到更新负载中。`);
                 }

                 notificationPayload = {
                     type: 'modified',
                     record_id: change.record.record_id,
                     fields: changedFields
                 };
            }

            console.log(`
⏳ [通知填充服务] 记录 ${notificationPayload.record_id} (${notificationPayload.type})`);
            const notifyStartTime = Date.now();
            // Pass the new payload structure
            notifyFeishuFill(notificationPayload).then(() => {
                const duration = Date.now() - notifyStartTime;
                console.log(`✅ [通知成功] 记录 ${notificationPayload.record_id} (${notificationPayload.type}) 已发送至 /api/feishu-fill，耗时 ${duration}ms`);
            }).catch(notifyError => {
                const duration = Date.now() - notifyStartTime;
                console.error(`❌ [通知失败] 记录 ${notificationPayload.record_id} (${notificationPayload.type}) 发送至 /api/feishu-fill 失败，耗时 ${duration}ms`);
                console.error('   错误详情:', notifyError.message || notifyError);
            });
            // --------------------------------------------- 
        });
        console.log('\n📊 ----------------------------------------');
        console.log(`✅ 共发现 ${changes.length} 条变更记录`);
    } else {
        console.log('\n✅ 本次比对未检测到数据变更');
    }
    console.log('\n==================== 数据比对结束 ====================\n');
}

// --- Function to notify feishu-fill API --- 
// Updated signature to reflect the new payload structure
async function notifyFeishuFill(payload: { type: 'new' | 'modified', record_id: string, fields: Record<string, any> }) {
    // Construct the full URL for the API route
    // Assumes the API route is running on the same origin
    // Default to the current dev server port 3002 if NEXT_PUBLIC_APP_URL is not set
    const fillApiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/api/feishu-fill`; 
    console.log(`🚀 [通知] 准备向 ${fillApiUrl} 发送 POST 请求`);
    // Log the new payload structure
    console.log('📋 [通知] 发送数据:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(fillApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add any necessary authentication headers if feishu-fill requires them
            },
            // Send the new payload structure
            body: JSON.stringify(payload),
        });

        // Check if the response is JSON before trying to parse
        const contentType = response.headers.get('content-type');
        let responseData: any;
        if (contentType && contentType.includes('application/json')) {
             responseData = await response.json();
        } else {
             responseData = await response.text(); // Handle non-JSON responses
        }


        if (!response.ok) {
            console.error(`❌ [通知] 调用 ${fillApiUrl} 失败:`, {
                status: response.status,
                statusText: response.statusText,
                responseData: responseData
            });
            // Provide a more informative error message
            const errorDetails = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
            throw new Error(`调用填充服务失败: ${response.status} ${response.statusText} - ${errorDetails}`);
        }

        console.log(`✅ [通知] 调用 ${fillApiUrl} 成功:`, {
            status: response.status,
            responseData: responseData
        });
        return responseData;
    } catch (error) {
        console.error(`❌ [通知] 调用 ${fillApiUrl} 时发生网络或处理错误:`, error);
        // Ensure the error is propagated correctly
        if (error instanceof Error) {
             throw error;
        } else {
             throw new Error(String(error));
        }
    }
}
// ----------------------------------------

// --- Function to sync changes to the target table --- 
// Note: This function is no longer called directly by compareDataChanges in the primary flow.
// It's replaced by notifyFeishuFill which triggers the /api/feishu-fill endpoint. 
async function syncChangeToTargetTable(change: { type: 'new' | 'modified', record: any, changes?: { field: string, oldValue: any, newValue: any }[] }) {
    const TARGET_APP_TOKEN = process.env.NEXT_PUBLIC_FEISHU_TARGET_APP_TOKEN || process.env.NEXT_PUBLIC_FEISHU_APP_ID; // Use source if target not set
    const TARGET_TABLE_ID = process.env.NEXT_PUBLIC_FEISHU_TARGET_TABLE_ID; // Needs to be set in .env
    const FEISHU_ACCESS_TOKEN = process.env.NEXT_PUBLIC_FEISHU_APP_SECRET;

    if (!TARGET_TABLE_ID) {
        console.error('❌ 同步错误: 目标表格 ID (NEXT_PUBLIC_FEISHU_TARGET_TABLE_ID) 未在环境变量中设置。');
        throw new Error('Target Table ID is not configured.');
    }

    let url = '';
    let method = '';
    let body: any = {};

    if (change.type === 'new') {
        // Add new record to target table
        url = `https://base-api.larksuite.com/open-apis/bitable/v1/apps/${TARGET_APP_TOKEN}/tables/${TARGET_TABLE_ID}/records`;
        method = 'POST';
        body = { fields: change.record.fields };
        console.log(`🔄 [同步] 准备向目标表添加新记录: ${change.record.record_id}`);
    } else if (change.type === 'modified') {
        // Update existing record in target table
        // Assuming record_id is the same or needs mapping if different structure
        url = `https://base-api.larksuite.com/open-apis/bitable/v1/apps/${TARGET_APP_TOKEN}/tables/${TARGET_TABLE_ID}/records/${change.record.record_id}`;
        method = 'PUT';
        body = { fields: change.record.fields }; // Send all fields for simplicity, Feishu handles partial updates
        console.log(`🔄 [同步] 准备更新目标表记录: ${change.record.record_id}`);
    }

    if (!url || !method) {
        console.warn(`⚠️ [同步] 跳过记录 ${change.record.record_id}，无法确定操作类型。`);
        return { skipped: true, reason: 'Unknown change type' };
    }

    console.log(`🚀 [同步] 发起 API 请求: ${method} ${url}`);
    console.log('📋 [同步] 请求体:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
        method: method,
        headers: {
            'Authorization': `Bearer ${FEISHU_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const responseData = await response.json();

    if (!response.ok || responseData.code !== 0) {
        console.error(`❌ [同步] API 请求失败 (记录 ${change.record.record_id}):`, {
            status: response.status,
            statusText: response.statusText,
            code: responseData.code,
            msg: responseData.msg,
            error: responseData.error
        });
        throw new Error(`同步失败: ${responseData.msg || response.statusText}`);
    }

    console.log(`✅ [同步] API 调用成功 (记录 ${change.record.record_id}):`, {
        status: response.status,
        code: responseData.code,
        msg: responseData.msg,
        data: responseData.data
    });

    return responseData; // Return the result from Feishu API
}
// -----------------------------------------------------
// Note: syncChangeToTargetTable is kept for potential reference or alternative use cases.

// 获取飞书数据的函数
async function fetchFeishuData() {
    const FEISHU_APP_TOKEN = process.env.NEXT_PUBLIC_FEISHU_APP_ID;
    const FEISHU_TABLE_ID = process.env.NEXT_PUBLIC_FEISHU_TABLE_ID;
    const FEISHU_ACCESS_TOKEN = process.env.NEXT_PUBLIC_FEISHU_APP_SECRET;

    console.log('\n🚀 正在从飞书API获取数据...');
    console.log('🔗 请求URL:', `https://base-api.larksuite.com/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`);

    const response = await fetch(
        `https://base-api.larksuite.com/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FEISHU_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        console.error('飞书API请求失败:', {
            status: response.status,
            statusText: response.statusText
        });
        throw new Error(`飞书API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('\n✅ API调用成功！获取到的数据:', {
        status: response.status,
        code: data.code,
        msg: data.msg,
        total: data?.data?.total || 0,
        items: data?.data?.items?.map(item => ({
            record_id: item.record_id,
            fields: item.fields
        })) || []
    });
    return data;
}

// 定时更新缓存的函数
async function updateCache() {
    try {
        console.log('\n🔄 ==================== 飞书数据缓存更新 ====================');
        console.log('⏰ 开始时间:', new Date().toLocaleString());
        console.log('⌛ 距离上次更新:', lastUpdateTime ? `${(Date.now() - lastUpdateTime) / 1000}秒` : '首次更新');
        const newData = await fetchFeishuData();
        
        // 比较数据变更
        if (newData?.data?.items) {
            compareDataChanges(lastDataItems, newData.data.items);
            lastDataItems = newData.data.items;
        }
        
        cachedData = newData;
        lastUpdateTime = Date.now();
        console.log('\n⏰ 更新完成时间:', new Date(lastUpdateTime).toLocaleString());
        console.log('📊 获取到的数据条数:', newData?.data?.items?.length || 0);
        console.log('==================== 更新结束 ====================\n');
    } catch (error) {
        console.error('缓存更新失败:', error);
        throw error; // 向上传递错误以便在API响应中处理
    }
}

// 初始化缓存更新定时器
if (typeof setInterval !== 'undefined') {
    console.log('\n⚡ ==================== 初始化飞书数据缓存定时器 ====================');
    console.log('⏱️  缓存更新间隔:', CACHE_DURATION / 1000, '秒');
    console.log('==================== 初始化完成 ====================\n');
    setInterval(updateCache, CACHE_DURATION);
}

export async function GET() {
    try {
        // 如果缓存不存在或已过期，则更新缓存
        if (!cachedData || Date.now() - lastUpdateTime >= CACHE_DURATION) {
            await updateCache();
        }

        // 使用缓存的数据
        const data = cachedData;

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3003',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new NextResponse(JSON.stringify({ error: `Failed to fetch data: ${errorMessage}` }), {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3003',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Content-Type': 'application/json',
            },
        });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': 'http://localhost:3003',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}