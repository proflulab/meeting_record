import { NextResponse } from 'next/server';
import { weixinClient, SecretType } from '@/utils/tencent/wecom/weixin';

interface UserInfo {
    userid: string;
    name?: string;
    department?: number[];
    order?: number[];
    position?: string;
    mobile?: string;
    gender?: string;
    email?: string;
    biz_mail?: string;
    is_leader_in_dept?: number[];
    direct_leader?: string[];
    avatar?: string;
    thumb_avatar?: string;
    telephone?: string;
    alias?: string;
    address?: string;
    open_userid?: string;
    main_department?: number;
    status?: number;
    qr_code?: string;
    external_position?: string;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userid = searchParams.get('userid');

        if (!userid) {
            return NextResponse.json(
                {
                    code: 400,
                    message: '缺少必要参数：userid',
                    data: null
                },
                { status: 400 }
            );
        }

        const access_token = await weixinClient.getAccessToken(SecretType.APP);

        const response = await fetch(
            `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${access_token}&userid=${userid}`,
            {
                method: 'GET',
            }
        );

        const data = await response.json();

        if (data.errcode !== 0) {
            // 如果是token失效，清除缓存
            if (data.errcode === 40014 || data.errcode === 42001) {
                weixinClient.clearTokenCache(SecretType.CONTACT);
            }
            throw new Error(`获取成员信息失败: ${data.errmsg} (错误码: ${data.errcode})`);
        }

        const userInfo: UserInfo = {
            userid: data.userid,
            name: data.name,
            department: data.department,
            order: data.order,
            position: data.position,
            mobile: data.mobile,
            gender: data.gender,
            email: data.email,
            biz_mail: data.biz_mail,
            is_leader_in_dept: data.is_leader_in_dept,
            direct_leader: data.direct_leader,
            avatar: data.avatar,
            thumb_avatar: data.thumb_avatar,
            telephone: data.telephone,
            alias: data.alias,
            address: data.address,
            open_userid: data.open_userid,
            main_department: data.main_department,
            status: data.status,
            qr_code: data.qr_code,
            external_position: data.external_position
        };

        return NextResponse.json({
            code: 0,
            message: 'success',
            data: userInfo
        });
    } catch (error) {
        console.error('获取成员信息失败:', error);
        return NextResponse.json(
            {
                code: 500,
                message: error instanceof Error ? error.message : '获取成员信息失败',
                data: null
            },
            { status: 500 }
        );
    }
}