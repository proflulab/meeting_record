// 会议相关类型定义

// 会议主持人接口
export interface MeetingHost {
    userid: string;
    operator_id: string;
    operator_id_type: number;
}

// 会议参与者接口
export interface MeetingParticipant {
    userid: string;
    operator_id: string;
    operator_id_type: number;
}

// 会议设置接口
export interface MeetingSettings {
    mute_enable_join: boolean;
    allow_unmute_self: boolean;
    allow_in_before_host: boolean;
    auto_in_waiting_room: boolean;
    allow_screen_shared_watermark: boolean;
    water_mark_type: number;
    only_allow_enterprise_user_join: boolean;
    auto_record_type?: string;
    participant_join_auto_record?: boolean;
    enable_host_pause_auto_record?: boolean;
    only_enterprise_user_allowed?: boolean;
    allow_multi_device?: boolean;
    change_nickname?: number;
    only_user_join_type?: number;
    mute_enable_type_join?: number;
}

// 直播配置接口
export interface LiveConfig {
    live_subject: string;
    live_summary: string;
    live_password: string;
    enable_live_im: boolean;
    enable_live_replay: boolean;
    live_addr: string;
    live_watermark: {
        watermark_opt: number;
    };
    enable_live: boolean;
}

// 周期性会议规则接口
export interface RecurringRule {
    recurring_type: number;
    until_type: number;
    until_count: number;
    customized_recurring_type?: number;
    customized_recurring_step?: number;
    customized_recurring_days?: number;
}

// 子会议接口
export interface SubMeeting {
    sub_meeting_id: string;
    status: number;
    start_time: string;
    end_time: string;
}

// 会议详情接口
export interface MeetingDetail {
    subject: string;
    meeting_id: string;
    meeting_code: string;
    status: string;
    type: number;
    join_url: string;
    hosts: MeetingHost[];
    participants: MeetingParticipant[];
    start_time: string;
    end_time: string;
    settings: MeetingSettings;
    meeting_type: number;
    recurring_rule?: RecurringRule;
    sub_meetings?: SubMeeting[];
    has_more_sub_meeting?: number;
    remain_sub_meetings?: number;
    current_sub_meeting_id?: string;
    enable_live?: boolean;
    live_config?: LiveConfig;
    enable_doc_upload_permission?: boolean;
    has_vote?: boolean;
    current_hosts?: MeetingHost[];
    live_push_addr?: string[];
    location?: string;
    enable_enroll?: boolean;
    enable_host_key?: boolean;
    time_zone?: string;
    sync_to_wework?: boolean;
    disable_invitation?: number;
}

// 会议详情响应接口
export interface MeetingDetailResponse {
    meeting_number: number;
    meeting_info_list: MeetingDetail[];
    error_info?: {
        error_code: number;
        new_error_code?: number;
        message: string;
    };
}