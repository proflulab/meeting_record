// scripts/check-bitable.js

// ① 加载 .env
require('dotenv').config();

// ② 引入飞书 SDK
const { Client } = require('@larksuiteoapi/node-sdk');

// ③ 从环境变量读取必要配置
const appId     = process.env.FEISHU_APP_ID;
const appSecret = process.env.FEISHU_APP_SECRET;
const appToken  = process.env.LARK_BASE_APP_TOKEN;

if (!appId || !appSecret || !appToken) {
  console.error('❌ 请先在 .env 中配置 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_BASE_APP_TOKEN');
  process.exit(1);
}

// ④ 初始化客户端
const client = new Client({ appId, appSecret, disableTokenCache: false });

(async () => {
  try {
    // ⑤ 调用「列出应用下所有表格」接口
    const res = await client.bitable.appTable.list({
      path: { app_token: appToken }
    });
    console.log('✅ Bitable 应用下表格列表：', res.data);
  } catch (e) {
    console.error('❌ 读取失败：', e);
    process.exit(1);
  }
})();
