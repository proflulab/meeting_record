import { NextRequest } from "next/server";
import { updateRecords } from '@/utils/bitable';
import { searchRecordsWithIterator } from "@/utils/lark";
import { getmeetFile, getMeetingParticipants, getMeetingDetail } from '@/utils/meeting';
import { fetchTextFromUrl } from '@/utils/file';  // 添加这行

import { extractText } from '@/utils/fieldExtractors';



// 配置信息，实际应用中应从环境变量获取
const LARK_TABLE_ID = process.env.LARK_TABLE_ID || "";
const LARK_BASE_APP_TOKEN = process.env.LARK_BASE_APP_TOKEN || "";
const USER_ID = process.env.USER_ID || "";



/**
 * POST请求处理 - 用于接收事件消息
 */
export async function POST(request: NextRequest) {
    try {
        // 尝试从请求体中获取过滤条件
        let filter: {
            conjunction: "and" | "or";
            conditions: {
                field_name: string;
                operator:
                | "is" | "isNot" | "contains" | "doesNotContain"
                | "isEmpty" | "isNotEmpty"
                | "isGreater" | "isGreaterEqual"
                | "isLess" | "isLessEqual"
                | "like" | "in";
                value?: string[];
            }[];
        };

        try {
            // 尝试解析请求体
            const requestBody = await request.json();
            // 如果请求体中包含过滤条件，则使用请求体中的过滤条件
            if (requestBody.filter) {
                filter = requestBody.filter;
                console.log('使用请求提供的过滤条件:', JSON.stringify(filter));
            } else {
                // 否则使用默认过滤条件
                filter = {
                    conjunction: "and",
                    conditions: [
                        {
                            field_name: "record_file_id",
                            operator: "isNotEmpty",
                            value: []
                        }
                    ]
                };
                console.log('使用默认过滤条件');
            }
        } catch (error) {
            // 如果解析请求体失败，则使用默认过滤条件
            console.log('解析请求体失败，使用默认过滤条件:', error);
            filter = {
                conjunction: "and",
                conditions: [
                    {
                        field_name: "record_file_id",
                        operator: "isNotEmpty",
                        value: []
                    }
                ]
            };
        }

        // 在 B 表中查找对应记录
        const search_record = await searchRecordsWithIterator(LARK_BASE_APP_TOKEN, LARK_TABLE_ID, 500, undefined, filter);
        console.log(`共查找到 ${search_record.length} 条记录`);

        for (const record of search_record) {

            console.log(`----------------------------------`);

            const record_id = record.record_id ?? "";

            const record_file_id = extractText(record.fields.record_file_id);
            const meeting_summary = extractText(record.fields.meeting_summary);
            const ai_meeting_transcripts = extractText(record.fields.ai_meeting_transcripts);
            const ai_minutes = extractText(record.fields.ai_minutes);
            const meeting_id = extractText(record.fields.meeting_id);
            const participants = extractText(record.fields.participants); // 获取参会者字段的文本值
            const meeting_code = extractText(record.fields.meeting_code);
            const sub_meeting_id = extractText(record.fields.sub_meeting_id);
            const meeting_type = record.fields.meeting_type;
            const start_time = record.fields.start_time;

            if (!record_file_id) {
                console.log(`记录 ${record_id} 没有关联的文件ID，跳过处理`);
                continue;
            }


            let meetfile_result;



            console.log(`查找记录 ${record_id} 是否有meeting_id:${meeting_id ? 'full' : 'null'}`);
            if (!meeting_id) {

                // 获取会议录制文件详情
                try {
                    meetfile_result = await getmeetFile(record_file_id, USER_ID);
                } catch (error) {
                    console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                    await updateRecords(LARK_TABLE_ID, record_id, {
                        meeting_id: error instanceof Error ? error.message : 'Unknown error occurred',
                    });

                    continue;  // 跳过当前循环
                }

                await updateRecords(LARK_TABLE_ID, record_id, {
                    meeting_id: meetfile_result.meeting_id,
                });
                console.log(`更新完成记录 ${record_id} -meeting_id`);
            }


            console.log(`查找记录 ${record_id} 是否有meeting_code:${meeting_code ? 'full' : 'null'}`);
            if (!meeting_code) {

                // 获取会议录制文件详情
                if (!meetfile_result) {
                    // 获取会议录制文件详情
                    try {
                        meetfile_result = await getmeetFile(record_file_id, USER_ID);
                    } catch (error) {
                        console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                        await updateRecords(LARK_TABLE_ID, record_id, {
                            meeting_code: error instanceof Error ? error.message : 'Unknown error occurred',
                        });

                        continue;  // 跳过当前循环
                    }
                }

                await updateRecords(LARK_TABLE_ID, record_id, {
                    meeting_code: meetfile_result.meeting_code,
                });
                console.log(`更新完成记录 ${record_id} -meeting_code`);
            }

            // 检查是否有会议纪要、会议纪要AI、会议纪要AI总结
            console.log(`查找记录 ${record_id} 是否有meeting_summary:${meeting_summary ? 'full' : 'null'}`);
            if (!meeting_summary) {

                if (!meetfile_result) {
                    // 获取会议录制文件详情
                    try {
                        meetfile_result = await getmeetFile(record_file_id, USER_ID);
                    } catch (error) {
                        console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                        await updateRecords(LARK_TABLE_ID, record_id, {
                            meeting_summary: error instanceof Error ? error.message : 'Unknown error occurred',
                        });

                        continue;  // 跳过当前循环
                    }
                }

                const summaryAddress = meetfile_result.meeting_summary?.find(
                    (item) => item.file_type === "txt"
                )?.download_address;

                const summaryfileContent = await fetchTextFromUrl(summaryAddress || "");

                await updateRecords(LARK_TABLE_ID, record_id, {
                    meeting_summary: summaryfileContent || "无内容",
                });
                console.log(`更新完成记录 ${record_id} -meeting_summary`);
            }

            console.log(`查找记录 ${record_id} 是否有ai_meeting_transcripts:${ai_meeting_transcripts ? 'full' : 'null'}`);
            if (!ai_meeting_transcripts) {

                if (!meetfile_result) {
                    // 获取会议录制文件详情
                    try {
                        meetfile_result = await getmeetFile(record_file_id, USER_ID);
                    } catch (error) {
                        console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                        await updateRecords(LARK_TABLE_ID, record_id, {
                            ai_meeting_transcripts: error instanceof Error ? error.message : 'Unknown error occurred',
                        });

                        continue;  // 跳过当前循环
                    }
                }


                const transcriptsAddress = meetfile_result.ai_meeting_transcripts?.find(
                    (item) => item.file_type === "txt"
                )?.download_address;

                const transcriptsfileContent = await fetchTextFromUrl(transcriptsAddress || "");

                await updateRecords(LARK_TABLE_ID, record_id, {
                    ai_meeting_transcripts: transcriptsfileContent || "无内容",
                });
                console.log(`更新完成记录 ${record_id} -ai_meeting_transcripts`);
            }

            console.log(`查找记录 ${record_id} 是否有ai_minutes:${ai_minutes ? 'full' : 'null'}`);
            if (!ai_minutes) {

                if (!meetfile_result) {
                    // 获取会议录制文件详情
                    try {
                        meetfile_result = await getmeetFile(record_file_id, USER_ID);
                    } catch (error) {
                        console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                        await updateRecords(LARK_TABLE_ID, record_id, {
                            meetfile_result: error instanceof Error ? error.message : 'Unknown error occurred',
                        });

                        continue;  // 跳过当前循环
                    }
                }


                const minutesAddress = meetfile_result.ai_minutes?.find(
                    (item) => item.file_type === "txt"
                )?.download_address;

                const minutesfileContent = await fetchTextFromUrl(minutesAddress || "");

                await updateRecords(LARK_TABLE_ID, record_id, {
                    ai_minutes: minutesfileContent || "无内容",
                });
                console.log(`更新完成记录 ${record_id} -ai_minutes`);
            }

            let meetingDetail;

            console.log(`查找记录 ${record_id} 是否有meeting_type:${meeting_type ? 'full' : 'null'}`);
            if (!meeting_type) {

                // 获取会议详情
                try {
                    meetingDetail = await getMeetingDetail(meeting_id || '', USER_ID);
                } catch (error) {
                    console.log(`查找记录 ${record_id} 会议详情错误，跳过处理`);

                    await updateRecords(LARK_TABLE_ID, record_id, {
                        备注: error instanceof Error ? error.message : 'Unknown error occurred',
                    });
                    continue;  // 跳过当前循环
                }

                await updateRecords(LARK_TABLE_ID, record_id, {
                    meeting_type: meetingDetail.meeting_info_list[0].meeting_type,
                });
                console.log(`更新完成记录 ${record_id} -meeting_type`);
            }


            console.log(`查找记录 ${record_id} 是否有sub_meeting_id:${sub_meeting_id ? 'full' : 'null'}`);
            if (!sub_meeting_id) {

                if (!meetingDetail) {
                    // 获取会议详情
                    try {
                        meetingDetail = await getMeetingDetail(meeting_id || '', USER_ID);
                    } catch (error) {
                        console.log(`查找记录 ${record_id} 会议详情错误，跳过处理`);

                        await updateRecords(LARK_TABLE_ID, record_id, {
                            备注: error instanceof Error ? error.message : 'Unknown error occurred',
                        });
                        continue;  // 跳过当前循环
                    }
                }

                const meetingInfo = meetingDetail.meeting_info_list[0];

                // 只有当会议类型为1时才更新sub_meeting_id
                if (meetingInfo.meeting_type === 1) {
                    console.log(`meeting_type为 ${meetingInfo.meeting_type} -周期会议`);
                    if (meetingInfo.start_time) {
                        // 从会议开始时间提取时分秒
                        let timeFromMeeting = "";
                        if (meetingInfo.start_time) {
                            // 将时间戳转换为日期对象
                            const meetingDate = new Date(parseInt(meetingInfo.start_time) * 1000);
                            // 提取时分秒
                            const hours = meetingDate.getHours();
                            const minutes = meetingDate.getMinutes();
                            const seconds = meetingDate.getSeconds();
                            timeFromMeeting = `${hours}:${minutes}:${seconds}`;
                            console.log(`从会议中提取的时间: ${timeFromMeeting}`);
                        }

                        // 从记录中获取日期部分
                        let newTimestamp = "";
                        if (start_time && timeFromMeeting) {
                            // 将记录中的时间戳转换为日期对象
                            // 判断时间戳长度，如果已经是毫秒级（13位）就不需要乘以1000
                            const startTimeStr = start_time.toString();
                            const startTime = parseInt(startTimeStr);
                            const recordDate = new Date(startTimeStr.length >= 13 ? startTime : startTime * 1000);
                            // 提取年月日
                            const year = recordDate.getFullYear();
                            const month = recordDate.getMonth();
                            const day = recordDate.getDate();

                            // 从会议时间中提取时分秒
                            const [hours, minutes, seconds] = timeFromMeeting.split(':').map(Number);

                            // 创建新的日期对象，结合记录的日期和会议的时间
                            const combinedDate = new Date(year, month, day, hours, minutes, seconds);
                            // 转换为时间戳
                            newTimestamp = Math.floor(combinedDate.getTime() / 1000).toString();
                            console.log(`组合后的新时间戳: ${newTimestamp}`);
                        }

                        // 更新sub_meeting_id
                        await updateRecords(LARK_TABLE_ID, record_id, {
                            sub_meeting_id: newTimestamp,
                        });
                        console.log(`更新完成记录 ${record_id} -sub_meeting_id`);
                    }
                }
            }


            console.log(`查找记录 ${record_id} 是否有participants:${participants ? 'full' : 'null'}`);
            if (!participants) {
                // 获取会议参会者列表
                let participantsData;
                try {
                    participantsData = await getMeetingParticipants(String(meeting_id), String(USER_ID), sub_meeting_id);
                } catch (error) {
                    console.log(`查找记录 ${record_id} 会议参会者错误，跳过处理`);
                    continue;  // 跳过当前循环
                }

                if (!participantsData || !participantsData.participants || participantsData.participants.length === 0) {
                    console.log(`会议ID ${meeting_id} 没有参会者信息`);
                    continue;
                }

                // 解码参会者名称并提取为数组
                const participantNames = [...new Set(participantsData.participants.map(participant => {
                    try {
                        // Base64解码
                        const decodedName = Buffer.from(participant.user_name, 'base64').toString('utf-8');
                        return decodedName;
                    } catch (error) {
                        console.error(`解码参会者名称失败: ${participant.user_name}`, error);
                        return participant.user_name; // 如果解码失败，返回原始值
                    }
                }))];

                // 更新记录-参会者
                await updateRecords(LARK_TABLE_ID, record_id, {
                    participants: String(participantNames),
                });
                console.log(`更新完成记录 ${record_id} -participants`);
            }
        }

        console.log('所有录制文件处理完成');

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

