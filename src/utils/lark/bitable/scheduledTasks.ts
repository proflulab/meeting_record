
import { searchRecordsWithIterator } from './lark';

// 这里将存放每周调用飞书查询记录的逻辑

// 定义记录类型接口
interface ParticipantRecord {
    fields: {
        participant?: Array<{ text: string, type: string }> | string[];
        participant_summary?: Array<{ text: string, type: string }> | string[] | string;
        [key: string]: any;
    };
}

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

        const records = await searchRecordsWithIterator(appToken, tableId, 20, undefined, undefined, viewId) as ParticipantRecord[];

        // 调试日志：查看第一条记录的结构
       
        // 创建参会人员与其 participant_summary 的映射
        const participantSummaries: Record<string, string[]> = {};

        records.forEach(record => {
            // 获取参会人员列表
            let participants: string[] = [];
            const participantField = record.fields.participant;
            
            // 处理 participant 字段可能的不同形式
            if (participantField) {
                if (Array.isArray(participantField)) {
                    // 如果是数组，可能是 {text: string, type: string}[] 或 string[]
                    participantField.forEach(p => {
                        if (typeof p === 'string') {
                            // 如果是字符串数组
                            participants.push(p);
                        } else if (p && typeof p.text === 'string') {
                            // 如果是对象数组，每个对象有 text 属性
                            participants.push(p.text);
                        }
                    });
                } else if (typeof participantField === 'string') {
                    // 如果直接是字符串
                    participants.push(participantField);
                }
            }
            
            // 根据用户反馈，使用 participant_summary 字段作为摘要内容
            const participantSummary = record.fields.participant_summary;

            // 调试日志：打印第一条记录的完整字段
         
            // 将当前记录的 participantSummary 添加到该记录中每个参会人员的列表中
            if (participants.length > 0 && participantSummary) {
                let summaryText = '';
                if (Array.isArray(participantSummary)) {
                    // 处理 participant_summary 字段可能的数组形式
                    summaryText = participantSummary.map(item => {
                        if (typeof item === 'string') {
                            return item;
                        } else if (item && typeof item.text === 'string') {
                            return item.text;
                        }
                        return ''; // Handle cases where item or item.text is missing
                    }).join('\n'); // Join text from different items with a newline
                } else if (typeof participantSummary === 'string') {
                    // 如果 participant_summary 直接是字符串
                    summaryText = participantSummary;
                }

                if (summaryText) {
                    for (const participant of participants) {
                        if (!participantSummaries[participant]) {
                            participantSummaries[participant] = [];
                        }
                        // 只有当摘要文本不在列表中时才添加，实现去重
                        if (!participantSummaries[participant].includes(summaryText)) {
                            participantSummaries[participant].push(summaryText);
                        }
                    }
                }
            }
        });

        // 输出结果
        console.log('参会人员及其 participant_summary:');
        console.log(JSON.stringify(participantSummaries, null, 2));
        
        // 统计信息
        const participantCount = Object.keys(participantSummaries).length;
        const totalSummaries = Object.values(participantSummaries).reduce((total, summaries) => total + summaries.length, 0);
        
        // 输出每个参会人员的摘要数量
        console.log('每个参会人员的摘要数量:');
        Object.entries(participantSummaries).forEach(([participant, summaries]) => {
            console.log(`${participant}: ${summaries.length} 条摘要`);
        });
        
        console.log(`总计 ${participantCount} 位参会人员，共 ${totalSummaries} 条 participant_summary 记录`);
        console.log(`查询到 ${records.length} 条原始记录`);
        
        return participantSummaries;
    } catch (error) {
        console.error('执行每周记录查询失败:', error);
    }
}

// 在实际应用中，你需要结合定时任务工具（如 cron job 或 serverless 函数的定时触发器）来调用 weeklyRecordQuery 函数。
//运行测试代码 npx tsx /Users/fuzhenkai/Desktop/week/scripts/runWeeklyQuery.ts