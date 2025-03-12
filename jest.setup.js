/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-03-11 13:54:01
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-03-11 14:00:06
 * @FilePath: /meeting_record/jest.setup.js
 * @Description:
 *
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved.
 */
 
const { loadEnvConfig } = require("@next/env");

// 加载测试环境的环境变量
loadEnvConfig(process.cwd(), true, { path: ".env.test" });
