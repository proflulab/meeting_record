/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-03-11 00:58:49
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-03-11 15:22:33
 * @FilePath: /meeting_record/jest.config.js
 * @Description:
 *
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved.
 */

/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  // 添加 setupFiles 配置
  setupFiles: ["<rootDir>/jest.setup.js"],
};

module.exports = config;