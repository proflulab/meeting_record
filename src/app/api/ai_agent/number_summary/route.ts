import { NextRequest, NextResponse } from 'next/server';
import { searchRecordsWithIterator } from '@/utils/lark/bitable/lark';
import { extractAllText } from '@/utils/lark/bitable/fieldExtractors';
import { createRecords } from "@/utils/lark/bitable/bitable";
import { recursiveSummarize, openAISummarize } from '@/utils/ai/summarize';

// 定义接口请求参数类型
interface RequestParams {
    filter?: {
        conjunction?: "and" | "or";
        conditions?: Array<{
            field_name: string;
            operator: "is" | "isNot" | "contains" | "doesNotContain" | "isEmpty" | "isNotEmpty" | "isGreater" | "isGreaterEqual" | "isLess" | "isLessEqual" | "like" | "in";
            value?: Array<string>;
        }>;
        children?: Array<{
            conjunction: "and" | "or";
            conditions?: Array<{
                field_name: string;
                operator: "is" | "isNot" | "contains" | "doesNotContain" | "isEmpty" | "isNotEmpty" | "isGreater" | "isGreaterEqual" | "isLess" | "isLessEqual" | "like" | "in";
                value?: Array<string>;
            }>;
        }>;
    }; // 查询过滤条件
    appToken?: string; // 多维表格应用Token
    numbers?: string[]; // 需要处理的人员名单
    tableId?: { // 表格ID配置
        number_record: string; // 会议记录表ID
        order_followup: string; // 跟进表ID
    };
    model?: string; // 可选的OpenAI模型名称
}

/**
 * 处理POST请求
 * @param request NextRequest对象
 * @returns NextResponse对象
 */
export async function POST(request: NextRequest) {
    try {
        // 第一步：检查所有参数
        const body = await request.json() as RequestParams;
        const { filter, appToken, numbers, tableId } = body;

        if (!appToken) {
            return NextResponse.json(
                { error: '缺少必要的多维表格配置：appToken' },
                { status: 400 }
            );
        }

        if (!tableId || !tableId.number_record || !tableId.order_followup) {
            return NextResponse.json(
                { error: '缺少必要的表格ID配置' },
                { status: 400 }
            );
        }

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return NextResponse.json(
                { error: '缺少必要的人员名单' },
                { status: 400 }
            );
        }

        if (!filter) {
            return NextResponse.json(
                { error: '缺少必要的查询过滤条件' },
                { status: 400 }
            );
        }

        // 第二步：根据filter查询number_record所有满足要求的数据
        const records = await searchRecordsWithIterator(
            appToken,
            tableId.number_record,
            500, // 每页记录数
            undefined, // 不指定字段名，获取所有字段
            filter
        );

        if (!records || records.length === 0) {
            return NextResponse.json(
                { message: '未找到符合条件的会议记录' },
                { status: 404 }
            );
        }

        const results = [];

        // 第三步：逐个获取numbers的成员并循环处理
        for (const participant of numbers) {
            console.log(`处理参会者: ${participant}`);

            // 第四步：从已获取的记录中筛选出满足participant=当前循环名字的记录
            const participantRecords = records.filter(record => {
                // 检查记录中的participant字段是否包含当前参与者
                const participants = extractAllText(record.fields.participant);
                if (!participants) return false;
                const participantList = participants.split(',').map(p => p.trim());
                return participantList.includes(participant);
            });


            if (participantRecords.length === 0) {
                console.log(`未找到${participant}的相关记录，跳过处理`);
                continue;
            }

            // 第五步：合并记录并进行AI总结
            const summaries = []

            for (const record of participantRecords) {
                const summary = extractAllText(record.fields.项目进度总结) || "";
                let meetTime = "未知时间";
                if (record.fields.meet_start_time) {
                    try {
                        // 提取时间戳值
                        const timeObj = record.fields.meet_start_time;
                        if (typeof timeObj === 'object' && 'type' in timeObj && timeObj.type === 5 && 'value' in timeObj && Array.isArray(timeObj.value) && timeObj.value.length > 0) {
                            const timestamp = timeObj.value[0];
                            // 转换为可读的日期时间格式
                            const date = new Date(timestamp);
                            meetTime = date.toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            });
                        }
                    } catch (e) {
                        console.error('时间格式转换失败:', e);
                    }
                }

                // 将会议时间和总结合并，并添加到数组中
                const meetingSummary = `${meetTime}: ${summary}`;
                summaries.push(meetingSummary);
            }


            const finalReport = await recursiveSummarize(summaries, openAISummarize);


            // 第六步：将最终总结上传到order_followup表
            const currentDate = Date.now(); // 获取当前时间戳（毫秒）

            await createRecords(tableId.order_followup, {
                "学员姓名": participant,
                "AI总结概况": finalReport,
                "登记时间": currentDate
            });

            results.push({
                participant,
                success: true
            });
        }

        // 返回结果
        return NextResponse.json({
            success: true,
            results
        });

    } catch (error: unknown) {
        console.error('AI代理处理失败:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { error: `处理失败: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: '处理失败: 未知错误' },
            { status: 500 }
        );
    }
}