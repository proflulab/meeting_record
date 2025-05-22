
import { searchRecordsWithIterator } from './lark';

// 这里将存放每周调用飞书查询记录的逻辑

export async function weeklyRecordQuery() {
    // TODO: 从环境变量或配置中获取 appToken 和 tableId
    const appToken = process.env.LARK_APP_TOKEN; // 示例：从环境变量获取
    const tableId = process.env.LARK_TABLE_ID; // 示例：从环境变量获取
    const viewId = process.env.LARK_VIEW_ID; // 从环境变量获取 viewId

    if (!appToken || !tableId || !viewId) {
        console.error('缺少必要的飞书配置：appToken 或 tableId');
        return;
    }

    try {
        // 构建查询过滤条件（示例：查询某个字段值等于特定值的记录）

        console.log(`开始查询飞书记录，appToken: ${appToken}, tableId: ${tableId}, viewId: ${viewId}`);

        const records = await searchRecordsWithIterator(appToken, tableId, 20, undefined, undefined, viewId);

        console.log(records);

        // 收集所有参会人员并去重
        const allParticipants = new Set<string>();
        records.forEach(record => {
            // participant 字段是对象数组，每个对象包含 id, name, avatar_url
            // participant 字段是对象数组，每个对象包含 text, type
            if (record.fields.participant && Array.isArray(record.fields.participant)) {
                record.fields.participant.forEach((p: { text?: string }) => {
                    if (p && typeof p.text === 'string') {
                        allParticipants.add(p.text);
                    }
                });
            }
        });

        // 将去重后的参会人员转换为数组和 JSON 字符串
        const uniqueParticipantsArray = Array.from(allParticipants);
        const uniqueParticipantsJson = JSON.stringify(uniqueParticipantsArray, null, 2);

        console.log('去重后的参会人员 (JSON):');
        console.log(uniqueParticipantsJson);
        console.log(`总计 ${uniqueParticipantsArray.length} 位不重复的参会人员`);

        // TODO: 处理查询到的记录，例如进行数据处理、发送通知等
        // records.forEach(record => {
        //     console.log(record);
        // });
        console.log(`查询到 ${records.length} 条原始记录`);
    } catch (error) {
        console.error('执行每周记录查询失败:', error);
    }
}

// 在实际应用中，你需要结合定时任务工具（如 cron job 或 serverless 函数的定时触发器）来调用 weeklyRecordQuery 函数。
//运行测试代码 npx tsx /Users/fuzhenkai/Desktop/meeting_record/scripts/runWeeklyQuery.ts