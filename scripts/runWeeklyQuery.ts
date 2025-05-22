import 'dotenv/config';
import { weeklyRecordQuery } from '../src/utils/lark/bitable/scheduledTasks';

async function main() {
    try {
        await weeklyRecordQuery();
        console.log('Weekly query script executed successfully.');
    } catch (error) {
        console.error('Error executing weekly query script:', error);
        process.exit(1); // Exit with a non-zero code to indicate failure
    }
}

main();
//你需要在你的 Vercel 项目中配置 Cron Jobs，以确保脚本按照你的需求定期运行。你可以在 Vercel 的 Cron Jobs 配置界面中设置 Cron 表达式，以指定脚本的运行时间和频率。
//本地运行测试node /Users/fuzhenkai/Desktop/meeting_record/scripts/runWeeklyQuery.ts