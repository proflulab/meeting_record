/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-03-11 01:02:22
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-03-13 17:19:34
 * @FilePath: /meeting_record/src/utils/__tests__/meeting.test.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */

import { getmeetFile } from '../meeting_proxy';

describe('getRecordingDetail', () => {

    it('应该成功获取录制文件详情', async () => {
        // 使用真实的录制文件ID和用户ID进行测试
        const fileId = process.env.TEST_RECORD_FILE_ID || '';
        const userId = process.env.TEST_USER_ID || '';

        // 执行测试
        const result = await getmeetFile(fileId, userId);

        console.log('录制文件详情:', result);

        // 验证结果格式
        expect(result).toHaveProperty('meeting_id');
        expect(result).toHaveProperty('meeting_code');
        expect(result).toHaveProperty('record_file_id');
    }, 30000); // 设置更长的超时时间
});