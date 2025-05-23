import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createTableRecord } from '@/utils/lark/bitable/lark'; // 导入创建记录函数

export const config = {
  api: {
    bodyParser: false,
  },
};

let stripe: Stripe | undefined;
let webhookSecret: string | undefined;

if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-04-30.basil' as const,
  });
  webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event;

  if (!stripe || !webhookSecret) {
    console.error('❌ Stripe secret key or webhook secret not configured.');
    return new Response('Stripe secret key or webhook secret not configured.', {
      status: 500,
    });
  }

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log('✅ Received webhook event:');
    console.dir(event, { depth: null });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const paymentIntentId = session.payment_intent;
      if (typeof paymentIntentId === 'string') {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        console.log('💳 PaymentIntent data:');
        console.dir(paymentIntent, { depth: null });

        // 可选：保存到数据库，或其他后续逻辑
        
        // 调用飞书接口创建记录
        try {
          // TODO: 替换为你的飞书多维表格 App Token 和 Table ID
          const appToken = process.env.FEISHU_APP_TOKEN!;
          const tableId = process.env.FEISHU_TABLE_ID!;
          // TODO: 根据你的飞书多维表格字段，映射 Stripe session 或 paymentIntent 中的数据
          // TODO: 根据你的飞书多维表格字段，映射 Stripe session 或 paymentIntent 中的数据
          // 确保 "编号" 字段接收的是字符串类型
          const chargeId = typeof paymentIntent.latest_charge === 'string'
            ? paymentIntent.latest_charge
            : (paymentIntent.latest_charge as Stripe.Charge)?.id || '';
            console.log('🚀 编号:', chargeId);
          const fields = {
            "channel_order_id": chargeId,
            "product_title":"人工智能AI课",
            "email": session.customer_details?.email || '',
            "phone": session.customer_details?.phone || '',
            "product_category":"训练营",
            "collecting_company":"硅谷公司（Lulab）",
            "from":"傅贞凯",
            "docking_group":"陆向谦实验室+人工智能AI课&昵称/"+chargeId.slice(-8)+"/"+new Date(session.created * 1000).toLocaleDateString('zh-CN'),
            "real_price": session.amount_total !== null ? session.amount_total / 100 : 0,
            "currency_unit": session.currency?.toUpperCase() ?? '',
            "pay_time":session.created!*1000,
            "settlement_time":session.created!*1000,
          };

          const recordResult = await createTableRecord(appToken, tableId, fields);
          console.log('✅ Successfully created Bitable record:', recordResult);

        } catch (larkError) {
          console.error('❌ Failed to create Bitable record:', larkError instanceof Error ? larkError.message : 'Unknown error');
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
    });
  } catch (err: unknown) {
    console.error('❌ Webhook Error:', err instanceof Error ? err.message : 'Unknown error');
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
      status: 400,
    });
  }
}
