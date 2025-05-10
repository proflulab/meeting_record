/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-06 02:30:00
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-11 00:13:53
 * @FilePath: /meeting_record/src/app/api/webhook/tencent/wecom/route.ts
 * @Description: 企业微信回调接口处理
 */

import { NextRequest } from "next/server";
import { verifyURL, decryptMsg, encryptMsg } from "@/utils/tencent/wecom/crypto";
import * as xml2js from 'xml2js';

// 配置信息，从环境变量获取
const TOKEN = process.env.WECOM_TOKEN || "";
const ENCODING_AES_KEY = process.env.WECOM_ENCODING_AES_KEY || "";
const CORP_ID = process.env.WECOM_CORP_ID || ""; // 企业微信的企业ID，用作接收者ID

/**
 * 解析XML消息
 * @param xmlString XML字符串
 * @returns 解析后的对象
 */
async function parseXML(xmlString: string) {
    return new Promise((resolve, reject) => {
        xml2js.parseString(xmlString, { explicitArray: false }, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * GET请求处理 - 用于URL有效性验证
 */
export async function GET(request: NextRequest) {
    try {
        // 1. 获取URL参数
        const searchParams = request.nextUrl.searchParams;
        const msgSignature = searchParams.get("msg_signature");
        const timestamp = searchParams.get("timestamp");
        const nonce = searchParams.get("nonce");
        const echostr = searchParams.get("echostr");

        // 2. 参数校验
        if (!msgSignature || !timestamp || !nonce || !echostr) {
            return new Response("Missing required parameters", { status: 400 });
        }

        // 3. 验证URL有效性
        const result = verifyURL(TOKEN, ENCODING_AES_KEY, CORP_ID, msgSignature, timestamp, nonce, echostr);

        if (result.code !== 0) {
            console.error(`验证URL失败，错误码: ${result.code}`);
            return new Response(`验证失败，错误码: ${result.code}`, { status: 403 });
        }

        // 4. 返回解密后的明文，不能加引号和换行符
        return new Response(result.msg, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    } catch (error) {
        console.error("Error processing GET request:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

/**
 * POST请求处理 - 用于接收事件消息
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 获取Header参数或URL参数
        const searchParams = request.nextUrl.searchParams;
        const msgSignature = searchParams.get("msg_signature");
        const timestamp = searchParams.get("timestamp");
        const nonce = searchParams.get("nonce");

        // 2. 参数校验
        if (!msgSignature || !timestamp || !nonce) {
            return new Response("Missing required parameters", { status: 400 });
        }

        // 3. 获取请求体
        const body = await request.text(); // 企业微信发送的是XML格式数据
        if (!body) {
            return new Response("Missing request body", { status: 400 });
        }

        // 4. 解密数据
        const result = await decryptMsg(TOKEN, ENCODING_AES_KEY, CORP_ID, msgSignature, timestamp, nonce, body);

        if (result.code !== 0) {
            console.error(`解密消息失败，错误码: ${result.code}`);
            return new Response(`解密失败，错误码: ${result.code}`, { status: 403 });
        }

        // 5. 处理解密后的数据
        const decryptedMsg = result.msg;
        console.log("Received encrypted message:", body);
        console.log("Decrypted message:", decryptedMsg);

        try {
            // 解析XML数据
            const parsedXML: any = await parseXML(decryptedMsg);
            console.log("Parsed XML:", JSON.stringify(parsedXML));

            // 获取消息类型
            const xml = parsedXML.xml;
            const msgType = xml.MsgType;

            // 根据不同的消息类型进行处理
            if (msgType === 'event') {
                // 处理事件消息
                const event = xml.Event;
                console.log(`收到事件: ${event}`);

                switch (event) {
                    case 'change_contact':
                        // 通讯录变更事件
                        const changeType = xml.ChangeType;
                        console.log(`通讯录变更类型: ${changeType}`);
                        // 根据changeType处理不同类型的通讯录变更
                        break;
                    case 'click':
                        // 菜单点击事件
                        const eventKey = xml.EventKey;
                        console.log(`菜单点击事件KEY: ${eventKey}`);
                        // 处理菜单点击
                        break;
                    // 可以添加更多事件类型的处理
                    default:
                        console.log(`未处理的事件类型: ${event}`);
                }
            } else if (msgType === 'text') {
                // 处理文本消息
                const content = xml.Content;
                const fromUserName = xml.FromUserName;
                console.log(`收到来自 ${fromUserName} 的文本消息: ${content}`);

                // 这里可以添加文本消息的处理逻辑
                // 例如关键词回复等
            } else {
                // 处理其他类型的消息
                console.log(`收到其他类型消息: ${msgType}`);
            }

            // 6. 返回成功响应（可以返回空字符串或者回复消息）
            // 如果需要回复消息，需要使用EncryptMsg加密
            // 示例：回复文本消息
            if (msgType === 'text') {
                const replyXml = `<xml>
                    <ToUserName><![CDATA[${xml.FromUserName}]]></ToUserName>
                    <FromUserName><![CDATA[${xml.ToUserName}]]></FromUserName>
                    <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
                    <MsgType><![CDATA[text]]></MsgType>
                    <Content><![CDATA[你好，我已收到你的消息]]></Content>
                </xml>`;

                const encryptResult = encryptMsg(TOKEN, ENCODING_AES_KEY, CORP_ID, replyXml, timestamp, nonce);
                if (encryptResult.code !== 0) {
                    console.error(`加密回复消息失败，错误码: ${encryptResult.code}`);
                    return new Response("", { status: 200 });
                }

                return new Response(encryptResult.msg, {
                    status: 200,
                    headers: { "Content-Type": "text/xml" },
                });
            } else {
                // 不需要回复消息，返回空字符串
                return new Response("", { status: 200 });
            }
        } catch (parseError) {
            console.error("Error parsing XML:", parseError);
            return new Response("", { status: 200 }); // 即使解析失败，也返回200状态码
        }
    } catch (error) {
        console.error("Error processing POST request:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}