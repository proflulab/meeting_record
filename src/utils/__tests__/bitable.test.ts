/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-03-11 00:58:49
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-03-11 21:26:26
 * @FilePath: /meeting_record/src/utils/__tests__/bitable.test.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */
import { createRecords, uploadFileFromUrl, updateRecords } from '../bitable';


beforeAll(() => {
    // 验证环境变量是否已正确加载
    if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
        console.warn('警告：环境变量未正确加载');
    }
    console.log('环境变量已加载');
});

describe('createRecords', () => {
    it('应该成功创建记录并返回结果', async () => {
        try {
            // 创建测试数据
            const testTableId = 'tbl4EkvHwDU3olD7';
            // 创建测试记录数据
            const testRecord = {
                user_name: "测试标题",
                meeting_id: "测试内容"
            };

            const result = await createRecords(testTableId, testRecord);
            // expect(result).toBeDefined();
            console.log('API 返回结果:', result);
        } catch (error) {
            console.error('测试失败:', error);
            throw error;
        }
    }, 10000);

    it('应该成功更新记录并返回结果', async () => {
        try {
            // 创建测试数据
            const testTableId = 'tbl4EkvHwDU3olD7';
            const recordId = 'recuF80evikTyq';
            // 创建测试记录数据
            const testRecord = {
                meeting_summary: "测试标题",
            };

            const result = await updateRecords(testTableId, recordId, testRecord);
            // expect(result).toBeDefined();
            console.log('API 返回结果:', result);
        } catch (error) {
            console.error('测试失败:', error);
            throw error;
        }
    }, 10000);

    it('应该成功上传文件', async () => {
        try {
            // 创建测试数据
            const fileUrl = 'https://yunluzhi-az-1258344699.file.myqcloud.com/cos/210031765/1898754232503083008/1898754232503083009/TM-20250309231355-543990814-recording-1.mp4?token=eJxskEtzm0AQhP_LXh3EvtlVVQ4JApKy9cKyE3FRoQXBRrwESxCK899TVmRXDjlO99RMf_0LbB4eJ3HT7HqdgClAlCLEMMHckRRBQQn48HdFGV1XYApm9VAVdZy85MY03dS2x74q-kuurfhiIcwEoZRLOTnoIp2U40kVdZ9MVF3aqu5sjCAkyOHMRkIKh1FMMIMECgKh-I8m7c3cwvA6S0wQYcxilEgJBaJWm6q6TXSVWWhSNvQF3cJ2yXEXN82V6P3jzTNjk4IpCD13Gc6-LoI3WZevMnIo4oJyzN9O6QxMQbTHM9fdb91tW5Bvcq6iZXg8HxQ8U_9-Uz_0JlrQlRmkDvzCNt8Tx4vIJdLCP6o7kTjrOTvcP-Lqznsa2Mrl7dxerPVTzb0qwz87GITa_czLQYaz46foeVNtn7OlTUdHl9yMym8rESvl_cj9bHFaYxGsNB6yrR-HCI5fTnsRt_CSdF4eiI-34Om50W26iw8mbW9gDuT4HSzXZpe18fjq_VPbtTPw-08AAAD__xnrnFE';
            // 创建测试记录数据
            const fileName = "test.mp4"

            const result = await uploadFileFromUrl(fileUrl, fileName, false);
            const testTableId = 'tbl4EkvHwDU3olD7';
            // 创建测试记录数据
            const testRecord = {
                ['video_file']: [{
                    "file_token": result // 👆🏻前面接口返回的 fileToken
                }]
            };

            await createRecords(testTableId, testRecord);

            // expect(result).toBeDefined();
            console.log('API 返回结果:', result);
        } catch (error) {
            console.error('测试失败:', error);
            throw error;
        }
    }, 10000);
});

