// scripts/quick-check.ts
import * as lark from '@larksuiteoapi/node-sdk';
import 'dotenv/config';

const appId = process.env.FEISHU_APP_ID!;
const appSecret = process.env.FEISHU_APP_SECRET!;
const appToken = process.env.FEISHU_BASE_APP_TOKEN!;

const client = new lark.Client({
  appId,
  appSecret,
  disableTokenCache: false,
});

async function testRead() {
  try {
    const res = await client.bitable.appTable.list({
      path: { app_token: appToken },
    });
    console.log('✅ Bitable 表格列表：', res.data);
  } catch (e: any) {
    console.error('❌ 读取失败：', e);
    process.exit(1);
  }
}

testRead();
