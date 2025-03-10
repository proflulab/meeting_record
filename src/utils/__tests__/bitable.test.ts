import { createRecords } from '../bitable';


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
});

