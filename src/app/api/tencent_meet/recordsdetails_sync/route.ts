import { NextRequest } from "next/server";
import { updateRecords } from '@/utils/lark/bitable/bitable';
import { fetchTextFromUrl } from '@/utils/lark/bitable/file';
import { extractAllText } from '@/utils/lark/bitable/fieldExtractors';
import { searchRecordsWithIterator } from "@/utils/lark/bitable/lark";
import { getmeetFile, getMeetingParticipants, getMeetingDetail } from '@/utils/tencent_meeting/meeting';
import { extractParticipants } from "@/utils/lark/bitable/extractParticipants";

// 配置信息，实际应用中应从环境变量获取
const LARK_BASE_APP_TOKEN = process.env.LARK_BASE_APP_TOKEN || "";


/**
 * POST请求处理 - 用于接收事件消息
 */
export async function POST(request: NextRequest) {

    // 尝试解析请求体
    const requestBody = await request.json();

    // 验证所有必要字段
    const requiredFields = ['filter', 'tableid', 'userid'];
    const missingFields = requiredFields.filter(field => !requestBody[field]);

    if (missingFields.length > 0) {
        console.log(`请求中缺少必要的字段: ${missingFields.join(', ')}`);
        return new Response(`请求中缺少必要的字段: ${missingFields.join(', ')}`, {
            status: 400,
            headers: { "Content-Type": "text/plain" }
        });
    }

    // 使用解构赋值提取请求体中的字段
    const { filter, tableid, userid } = requestBody;

    // 验证字段类型
    if (typeof filter !== 'object') {
        return new Response("filter 必须是一个对象", {
            status: 400,
            headers: { "Content-Type": "text/plain" }
        });
    }

    // 在 B 表中查找对应记录
    const search_record = await searchRecordsWithIterator(LARK_BASE_APP_TOKEN, tableid, 500, undefined, filter);
    console.log(`共查找到 ${search_record.length} 条记录`);


    for (let index = 0; index < search_record.length; index++) {
        const record = search_record[index];
        console.log(`----------------------------------`);
        console.log(`处理第 ${index + 1}/${search_record.length} 条记录`);

        const record_id = record.record_id ?? "";

        const record_file_id = extractAllText(record.fields.record_file_id);
        const meeting_summary = extractAllText(record.fields.meeting_summary);
        const ai_meeting_transcripts = extractAllText(record.fields.ai_meeting_transcripts);
        const ai_minutes = extractAllText(record.fields.ai_minutes);
        const meeting_id = extractAllText(record.fields.meeting_id);
        const participants = extractAllText(record.fields.participants); // 获取参会者字段的文本值
        const meeting_code = extractAllText(record.fields.meeting_code);
        let sub_meeting_id = extractAllText(record.fields.sub_meeting_id);
        let meeting_type = record.fields.meeting_type;
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
                meetfile_result = await getmeetFile(record_file_id, userid);

                await updateRecords(tableid, record_id, {
                    meeting_id: meetfile_result.meeting_id,
                });
                console.log(`更新完成记录 ${record_id} -meeting_id`);
            } catch (error) {
                console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                await updateRecords(tableid, record_id, {
                    meeting_id: error instanceof Error ? error.message : 'Unknown error occurred',
                });
            }
        }


        console.log(`查找记录 ${record_id} 是否有meeting_code:${meeting_code ? 'full' : 'null'}`);
        if (!meeting_code) {

            // 获取会议录制文件详情
            if (!meetfile_result) {
                // 获取会议录制文件详情
                try {
                    meetfile_result = await getmeetFile(record_file_id, userid);
                } catch (error) {
                    console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                    await updateRecords(tableid, record_id, {
                        meeting_code: error instanceof Error ? error.message : 'Unknown error occurred',
                    });
                }
            }

            await updateRecords(tableid, record_id, {
                meeting_code: meetfile_result?.meeting_code || 'Unknown',
            });
            console.log(`更新完成记录 ${record_id} -meeting_code`);
        }

        // 检查是否有会议纪要、会议纪要AI、会议纪要AI总结
        console.log(`查找记录 ${record_id} 是否有meeting_summary:${meeting_summary ? 'full' : 'null'}`);
        if (!meeting_summary) {

            if (!meetfile_result) {
                // 获取会议录制文件详情
                try {
                    meetfile_result = await getmeetFile(record_file_id, userid);
                } catch (error) {
                    console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                    await updateRecords(tableid, record_id, {
                        meeting_summary: error instanceof Error ? error.message : 'Unknown error occurred',
                    });
                }
            }

            const summaryAddress = meetfile_result?.meeting_summary?.find(
                (item) => item.file_type === "txt"
            )?.download_address;

            const summaryfileContent = await fetchTextFromUrl(summaryAddress || "");

            await updateRecords(tableid, record_id, {
                meeting_summary: summaryfileContent || "无内容",
            });
            console.log(`更新完成记录 ${record_id} -meeting_summary`);
        }

        console.log(`查找记录 ${record_id} 是否有ai_meeting_transcripts:${ai_meeting_transcripts ? 'full' : 'null'}`);
        if (!ai_meeting_transcripts) {

            if (!meetfile_result) {
                // 获取会议录制文件详情
                try {
                    meetfile_result = await getmeetFile(record_file_id, userid);
                } catch (error) {
                    console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                    await updateRecords(tableid, record_id, {
                        ai_meeting_transcripts: error instanceof Error ? error.message : 'Unknown error occurred',
                    });
                }
            }


            const transcriptsAddress = meetfile_result?.ai_meeting_transcripts?.find(
                (item) => item.file_type === "txt"
            )?.download_address;

            const transcriptsfileContent = await fetchTextFromUrl(transcriptsAddress || "");

            await updateRecords(tableid, record_id, {
                ai_meeting_transcripts: transcriptsfileContent || "无内容",
            });
            console.log(`更新完成记录 ${record_id} -ai_meeting_transcripts`);
        }

        console.log(`查找记录 ${record_id} 是否有ai_minutes:${ai_minutes ? 'full' : 'null'}`);
        if (!ai_minutes) {

            if (!meetfile_result) {
                // 获取会议录制文件详情
                try {
                    meetfile_result = await getmeetFile(record_file_id, userid);
                } catch (error) {
                    console.log(`查找记录 ${record_id} 录制文件详情错误，跳过处理`);

                    await updateRecords(tableid, record_id, {
                        meetfile_result: error instanceof Error ? error.message : 'Unknown error occurred',
                    });
                }
            }


            const minutesAddress = meetfile_result?.ai_minutes?.find(
                (item) => item.file_type === "txt"
            )?.download_address;

            const minutesfileContent = await fetchTextFromUrl(minutesAddress || "");

            await updateRecords(tableid, record_id, {
                ai_minutes: minutesfileContent || "无内容",
            });
            console.log(`更新完成记录 ${record_id} -ai_minutes`);
        }

        let meetingDetail;

        console.log(`查找记录 ${record_id} 是否有meeting_type:${meeting_type ? 'full' : 'null'}`);
        if (meeting_type === undefined || meeting_type === null) {
            try {
                meetingDetail = await getMeetingDetail(meeting_id || '', userid);
                if (
                    meetingDetail &&
                    meetingDetail.meeting_info_list &&
                    meetingDetail.meeting_info_list.length > 0
                ) {
                    meeting_type = meetingDetail.meeting_info_list[0].meeting_type;
                    await updateRecords(tableid, record_id, {
                        meeting_type: meeting_type,
                    });
                    console.log(`更新完成记录 ${record_id} -meeting_type`);
                } else {
                    console.log(`会议详情为空，跳过 meeting_type 更新`);
                }
            } catch (error) {
                console.log(`查找记录 ${record_id} 会议详情错误:`, error);
                await updateRecords(tableid, record_id, {
                    备注: error instanceof Error ? error.message : 'Unknown error occurred',
                });
            }
        }

        console.log(`查找记录 ${record_id} 是否有sub_meeting_id:${sub_meeting_id ? 'full' : 'null'}`);
        if (meeting_type !== 1) {
            console.log(`记录 ${record_id} 的meeting_type不是周期性会议，跳过sub_meeting_id更新`);
        }
        if (!sub_meeting_id && meeting_type === 1) {
            if (!meetingDetail) {
                // 获取会议详情
                try {
                    meetingDetail = await getMeetingDetail(meeting_id || '', userid);
                } catch (error) {
                    console.log(`查找记录 ${record_id} 会议详情错误，跳过处理`);

                    await updateRecords(tableid, record_id, {
                        备注: error instanceof Error ? error.message : 'Unknown error occurred',
                    });
                }
            }

            const meetingInfo = meetingDetail?.meeting_info_list?.[0];

            // 只有当会议类型为1时才更新sub_meeting_id
            if (meetingInfo && meetingInfo.meeting_type === 1) {
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
                    await updateRecords(tableid, record_id, {
                        sub_meeting_id: newTimestamp,
                    });
                    sub_meeting_id = newTimestamp;

                    console.log(`更新完成记录 ${record_id} -sub_meeting_id`);
                }
            }
        }


        console.log(`查找记录 ${record_id} 是否有participants:${participants ? 'full' : 'null'}`);
        if (!participants) {
            // 获取会议参会者列表
            let participantsData;
            try {
                participantsData = await getMeetingParticipants(String(meeting_id), String(userid), sub_meeting_id);
            } catch {
                console.log(`查找记录 ${record_id} 会议参会者错误，跳过处理`);
            }

            if (participantsData && participantsData.participants && participantsData.participants.length !== 0) {
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
                await updateRecords(tableid, record_id, {
                    participants: String(participantNames),
                });
                console.log(`更新完成记录 ${record_id} -participants`);
            } else if (meeting_summary) {
                const participants = extractParticipants(meeting_summary);
                // 更新记录-参会者
                await updateRecords(tableid, record_id, {
                    participants: String(participants.length === 0 ? ["null"] : participants),
                });
            } else {
                await updateRecords(tableid, record_id, {
                    participants: "null",
                });
                console.log(`会议ID ${meeting_id} 无法获取参会者信息`);
            }
        }
    }

    console.log('所有录制文件处理完成');

    // 7. 返回成功响应
    return new Response("successfully received callback", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
    });
}