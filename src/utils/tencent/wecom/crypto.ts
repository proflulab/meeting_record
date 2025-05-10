/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-06 02:35:00
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-06 02:35:00
 * @FilePath: /meeting_record/src/utils/tencent/wecom/crypto.ts
 * @Description: 企业微信加解密工具函数
 */

import { getSignature as wxcptGetSignature, decrypt as wxcptDecrypt, encrypt as wxcptEncrypt } from "@wecom/crypto";
import * as xml2js from 'xml2js';

// XML Helper function to parse XML to JS object
async function parseXmlToJs(xml: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // explicitRoot: false to avoid <xml> root in result, directly access tags like result.Encrypt
        xml2js.parseString(xml, { explicitArray: false, explicitRoot: false }, (err, result) => {
            if (err) {
                console.error("XML parsing error:", err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

// XML Helper function to build JS object to XML string
function buildJsToXml(rootName: string, obj: any): string {
    const builder = new xml2js.Builder({ rootName, cdata: true, headless: true });
    return builder.buildObject(obj);
}

/**
 * 验证URL有效性
 * @param token 企业微信配置的Token
 * @param encodingAESKey 企业微信配置的EncodingAESKey
 * @param _corpId 企业微信的企业ID (可能在验证echostr时不需要严格校验id)
 * @param msgSignature 消息签名
 * @param timestamp 时间戳
 * @param nonce 随机数
 * @param echostr 加密的字符串
 * @returns 验证结果，包含code和解密后的消息
 */
export function verifyURL(token: string, encodingAESKey: string, _corpId: string,
    msgSignature: string, timestamp: string, nonce: string, echostr: string) {
    try {
        const calculatedSignature = wxcptGetSignature(token, timestamp, nonce, echostr);
        if (calculatedSignature !== msgSignature) {
            return { code: ERROR_CODES.SIGNATURE_ERROR, msg: "签名验证错误" };
        }
        // decrypt typically returns { message, id }
        const { message /*, id */ } = wxcptDecrypt(encodingAESKey, echostr);
        // Optional: Validate id against _corpId if necessary, though for echostr verification, this might not be standard.
        return { code: 0, msg: message };
    } catch (e: any) {
        console.error("verifyURL error:", e);
        // Attempt to map error if possible, otherwise generic decrypt error
        if (e && e.code === -40004) { // Example: AESKey invalid from the library
            return { code: ERROR_CODES.AESKEY_ERROR, msg: "AESKey 非法" };
        }
        return { code: ERROR_CODES.AES_DECRYPT_ERROR, msg: "AES 解密失败" };
    }
}

/**
 * 解密消息
 * @param token 企业微信配置的Token
 * @param encodingAESKey 企业微信配置的EncodingAESKey
 * @param corpId 企业微信的企业ID，用于校验解密后消息的ReceiveId
 * @param msgSignature 消息签名
 * @param timestamp 时间戳
 * @param nonce 随机数
 * @param postData XML格式的加密消息体
 * @returns 解密结果，包含code和解密后的消息内容 (通常是XML字符串)
 */
export async function decryptMsg(token: string, encodingAESKey: string, corpId: string,
    msgSignature: string, timestamp: string, nonce: string, postData: string) {
    let encryptedPayload;
    try {
        const parsedXml = await parseXmlToJs(postData);
        encryptedPayload = parsedXml.Encrypt;
        if (typeof encryptedPayload !== 'string') {
            throw new Error("Invalid or missing Encrypt field in XML");
        }
    } catch (e: any) {
        console.error("decryptMsg - XML parsing error:", e.message);
        return { code: ERROR_CODES.PARSE_ERROR, msg: `XML解析失败: ${e.message}` };
    }

    try {
        const calculatedSignature = wxcptGetSignature(token, timestamp, nonce, encryptedPayload);
        if (calculatedSignature !== msgSignature) {
            return { code: ERROR_CODES.SIGNATURE_ERROR, msg: "签名验证错误" };
        }

        const { message, id } = wxcptDecrypt(encodingAESKey, encryptedPayload);
        if (id !== corpId) {
            return { code: ERROR_CODES.RECEIVEID_ERROR, msg: `ReceiveId校验错误, 期望 ${corpId}, 得到 ${id}` };
        }
        return { code: 0, msg: message }; // message is the decrypted XML content
    } catch (e: any) {
        console.error("decryptMsg - Decryption or signature error:", e);
        if (e && e.code === -40004) {
            return { code: ERROR_CODES.AESKEY_ERROR, msg: "AESKey 非法" };
        }
        // Add more specific error mapping if the library provides error codes
        return { code: ERROR_CODES.AES_DECRYPT_ERROR, msg: "AES 解密失败" };
    }
}

/**
 * 加密消息
 * @param token 企业微信配置的Token
 * @param encodingAESKey 企业微信配置的EncodingAESKey
 * @param corpId 企业微信的企业ID，作为加密消息的ReceiveId
 * @param replyMsg 需要加密的回复消息内容 (通常是XML字符串)
 * @param timestamp 时间戳
 * @param nonce 随机数
 * @returns 加密结果，包含code和加密后的XML消息体
 */
export function encryptMsg(token: string, encodingAESKey: string, corpId: string,
    replyMsg: string, timestamp: string, nonce: string) {
    try {
        const encryptedReply = wxcptEncrypt(encodingAESKey, replyMsg, corpId);
        const signature = wxcptGetSignature(token, timestamp, nonce, encryptedReply);

        const responseXml = buildJsToXml('xml', {
            Encrypt: encryptedReply,
            MsgSignature: signature,
            TimeStamp: timestamp,
            Nonce: nonce,
        });
        return { code: 0, msg: responseXml };
    } catch (e: any) {
        console.error("encryptMsg error:", e);
        if (e && e.code === -40004) {
            return { code: ERROR_CODES.AESKEY_ERROR, msg: "AESKey 非法" };
        }
        // Add more specific error mapping
        return { code: ERROR_CODES.AES_ENCRYPT_ERROR, msg: "AES 加密失败" };
    }
}

/**
 * 错误码说明
 * -40001: 签名验证错误
 * -40002: xml/json解析失败
 * -40003: sha加密生成签名失败
 * -40004: AESKey 非法
 * -40005: ReceiveId 校验错误
 * -40006: AES 加密失败
 * -40007: AES 解密失败
 * -40008: 解密后得到的buffer非法
 * -40009: base64加密失败
 * -40010: base64解密失败
 * -40011: 生成xml/json失败
 */
export const ERROR_CODES = {
    SIGNATURE_ERROR: -40001,
    PARSE_ERROR: -40002,
    SHA_ERROR: -40003,
    AESKEY_ERROR: -40004,
    RECEIVEID_ERROR: -40005,
    AES_ENCRYPT_ERROR: -40006,
    AES_DECRYPT_ERROR: -40007,
    BUFFER_ERROR: -40008,
    BASE64_ENCRYPT_ERROR: -40009,
    BASE64_DECRYPT_ERROR: -40010,
    GENERATE_ERROR: -40011
};