import { useRouter } from 'next/router'

function queryValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function getCheckoutStatus(query) {
  const checkout = queryValue(query.checkout)
  const payment = queryValue(query.payment)
  const state = queryValue(query.state)

  if (
    checkout === 'success' ||
    payment === 'success' ||
    state === 'checkout-success'
  ) {
    return 'success'
  }

  if (
    checkout === 'cancel' ||
    checkout === 'cancelled' ||
    payment === 'cancel' ||
    payment === 'cancelled' ||
    state === 'checkout-cancelled'
  ) {
    return 'cancelled'
  }

  return ''
}

const copy = {
  'zh-CN': {
    success: {
      title: '付款状态已返回',
      description:
        '如果 Stripe 已显示付款成功，请保留付款邮箱和订单信息；我们会根据付款记录继续确认交付。',
      action: '邮件补充交付信息'
    },
    cancelled: {
      title: '付款未完成',
      description:
        '如果刚才取消或中断了付款，通常不会产生扣款。你可以重新进入付款链接，或先通过邮件确认地区、数量和交付方式。',
      action: '先邮件确认'
    }
  },
  'en-US': {
    success: {
      title: 'Payment status returned',
      description:
        'If Stripe showed a successful payment, keep the payment email and order details. We will use the payment record to confirm delivery.',
      action: 'Send delivery details'
    },
    cancelled: {
      title: 'Payment was not completed',
      description:
        'If checkout was cancelled or interrupted, it usually means no charge was created. You can retry the payment link or confirm region, quantity, and delivery by email first.',
      action: 'Confirm by email'
    }
  }
}

export default function CheckoutStatusNotice({
  email,
  product,
  service,
  tone = 'indigo'
}) {
  const router = useRouter()
  const status = router.isReady ? getCheckoutStatus(router.query) : ''
  if (!status) return null

  const locale = router.locale === 'en-US' ? 'en-US' : 'zh-CN'
  const text = copy[locale][status]
  const isSuccess = status === 'success'
  const accent =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-indigo-200 bg-indigo-50 text-indigo-950'
  const button =
    tone === 'amber'
      ? 'bg-amber-300 text-slate-950 hover:bg-amber-200'
      : 'bg-indigo-500 text-white hover:bg-indigo-400'

  return (
    <section className={`mt-6 rounded-2xl border p-4 sm:p-5 ${accent}`}>
      <div className='text-sm font-bold'>{text.title}</div>
      <p className='mt-2 text-sm leading-7 opacity-80'>{text.description}</p>
      <a
        href={`mailto:${email}`}
        data-analytics-event='checkout_started'
        data-analytics-intent='checkout'
        data-analytics-product={product}
        data-analytics-service={service}
        data-analytics-surface='checkout_status_notice'
        data-analytics-cta-position={
          isSuccess ? 'success_delivery_email' : 'cancelled_email'
        }
        data-analytics-checkout-type='manual_email'
        data-analytics-provider='email'
        className={`mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${button}`}>
        {text.action}
      </a>
    </section>
  )
}
