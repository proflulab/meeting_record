/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-11 10:30:00
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-13 04:27:45
 * @FilePath: /meeting_record/src/app/sync-groupchat/page.tsx
 * @Description: 同步企业微信群聊数据到飞书多维表格页面
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */
'use client';

import { useState } from 'react';
import { Button, Form, Input, message, Card, Table, Spin, Typography } from 'antd';
import { SyncOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

interface SyncFormValues {
    appToken: string;
    tableId: string;
    apiToken: string; // 添加API Token字段
}

interface SyncResult {
    chat_id: string;
    name: string;
    action: 'created' | 'updated';
    record_id?: string;
}

interface SyncResponse {
    code: number;
    message: string;
    data: {
        total: number;
        processed: number;
        results: SyncResult[];
    } | null;
}

export default function SyncGroupchatPage() {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SyncResult[]>([]);
    const [stats, setStats] = useState<{ total: number; processed: number } | null>(null);

    const columns = [
        {
            title: '群ID',
            dataIndex: 'chat_id',
            key: 'chat_id',
        },
        {
            title: '群名称',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: '操作',
            dataIndex: 'action',
            key: 'action',
            render: (text: string) => (
                <span style={{ color: text === 'created' ? '#52c41a' : '#1890ff' }}>
                    {text === 'created' ? '新建' : '更新'}
                </span>
            ),
        },
        {
            title: '记录ID',
            dataIndex: 'record_id',
            key: 'record_id',
            ellipsis: true,
        },
    ];

    const handleSync = async (values: SyncFormValues) => {
        try {
            setLoading(true);
            setResults([]);
            setStats(null);

            const response = await fetch(
                `/api/tencent/wecom?app_token=${encodeURIComponent(values.appToken)}&table_id=${encodeURIComponent(values.tableId)}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${values.apiToken}` // 使用用户输入的API Token
                    },
                }
            );

            const data: SyncResponse = await response.json();

            if (data.code === 0 && data.data) {
                message.success('同步成功');
                setResults(data.data.results);
                setStats({
                    total: data.data.total,
                    processed: data.data.processed,
                });
            } else {
                message.error(`同步失败: ${data.message}`);
            }
        } catch (error) {
            console.error('同步失败:', error);
            message.error('同步失败，请查看控制台获取详细错误信息');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <Title level={2}>同步企业微信群聊数据到飞书多维表格</Title>
            <Paragraph>
                此功能将获取企业微信中的所有群聊列表及详情，并将数据同步到指定的飞书多维表格中。
                如果表格中已存在相同群ID的记录，将会更新该记录；否则将创建新记录。
            </Paragraph>

            <Card style={{ marginBottom: '24px' }}>
                <Form
                    name="syncForm"
                    layout="vertical"
                    onFinish={handleSync}
                    autoComplete="off"
                >
                    <Form.Item
                        label="飞书多维表格应用Token"
                        name="appToken"
                        rules={[{ required: true, message: '请输入飞书多维表格应用Token' }]}
                    >
                        <Input placeholder="请输入飞书多维表格应用Token" />
                    </Form.Item>

                    <Form.Item
                        label="表格ID"
                        name="tableId"
                        rules={[{ required: true, message: '请输入表格ID' }]}
                    >
                        <Input placeholder="请输入表格ID" />
                    </Form.Item>

                    <Form.Item
                        label="API Token"
                        name="apiToken"
                        rules={[{ required: true, message: '请输入API Token' }]}
                    >
                        <Input placeholder="请输入API Token" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<SyncOutlined />} loading={loading}>
                            开始同步
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            {loading && (
                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                    <Spin tip="同步中..." />
                </div>
            )}

            {stats && (
                <Card style={{ marginBottom: '24px' }}>
                    <Paragraph>
                        总群聊数量: {stats.total}, 成功处理: {stats.processed}
                    </Paragraph>
                </Card>
            )}

            {results.length > 0 && (
                <Card title="同步结果">
                    <Table
                        columns={columns}
                        dataSource={results.map((item, index) => ({ ...item, key: index }))}
                        pagination={{ pageSize: 10 }}
                    />
                </Card>
            )}
        </div>
    );
}