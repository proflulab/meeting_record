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
        });
        console.log('\n📊 ----------------------------------------');
        console.log(`✅ 共发现 ${changes.length} 条变更记录`);
    } else {
        console.log('\n✅ 本次比对未检测到数据变更');
    }
    console.log('\n==================== 数据比对结束 ====================\n');
}

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
            // Trigger update in feishu-fill
            await updateFeishuFill(newData.data.items);
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