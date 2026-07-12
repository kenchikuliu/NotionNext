import { trackInteractionEvent } from '@/components/InteractionAnalytics'
import { subscribeToNewsletter } from '@/lib/plugins/mailchimp'
import { useRouter } from 'next/router'
import { useState } from 'react'

const toneStyles = {
  indigo: {
    accent: 'text-indigo-600',
    focus: 'focus:border-indigo-400 focus:ring-indigo-100',
    button:
      'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300',
    link: 'text-indigo-700 hover:text-indigo-500'
  },
  amber: {
    accent: 'text-amber-700',
    focus: 'focus:border-amber-400 focus:ring-amber-100',
    button:
      'bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:bg-amber-200',
    link: 'text-amber-700 hover:text-amber-600'
  }
}

const defaultCopy = {
  'zh-CN': {
    title: '提交充值咨询',
    description: '留下邮箱和具体需求，我会人工确认可用方式、价格与处理时间。',
    emailLabel: '邮箱',
    emailPlaceholder: 'you@example.com',
    contactLabel: '偏好的联系方式',
    contactPlaceholder: '微信 / Telegram / WhatsApp / 邮箱（可选）',
    messageLabel: '需求说明',
    messagePlaceholder: '请写明账号类型、数量、地区、期望处理时间。',
    submitLabel: '提交咨询',
    loadingLabel: '提交中...',
    successLabel: '已提交',
    successMessage: '已收到咨询，会尽快通过邮件联系你。',
    fallbackMessage: '提交失败，请稍后重试或直接发邮件。',
    directEmailLabel: '也可以直接发邮件'
  },
  'en-US': {
    title: 'Submit a recharge inquiry',
    description:
      'Leave your email and request details. Availability, price, and timing are confirmed manually.',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    contactLabel: 'Preferred contact',
    contactPlaceholder: 'Telegram / WhatsApp / WeChat / Email (optional)',
    messageLabel: 'Request details',
    messagePlaceholder:
      'Include account type, quantity, region, and expected turnaround time.',
    submitLabel: 'Submit inquiry',
    loadingLabel: 'Submitting...',
    successLabel: 'Submitted',
    successMessage: 'Inquiry received. I will follow up by email soon.',
    fallbackMessage: 'Submission failed. Try again later or email directly.',
    directEmailLabel: 'Or email directly'
  }
}

function getCopy(locale, content = {}) {
  const localeCopy =
    locale === 'en-US' ? defaultCopy['en-US'] : defaultCopy['zh-CN']
  return {
    ...localeCopy,
    ...(content.inquiryForm || {})
  }
}

export default function RechargeInquiryForm({
  content,
  product,
  service,
  source,
  email,
  tone = 'indigo'
}) {
  const { locale } = useRouter()
  const copy = getCopy(locale, content)
  const toneStyle = toneStyles[tone] || toneStyles.indigo
  const [form, setForm] = useState({
    email: '',
    contactMethod: '',
    message: ''
  })
  const [status, setStatus] = useState('idle')
  const [notice, setNotice] = useState('')

  function updateField(field, value) {
    setForm(current => ({
      ...current,
      [field]: value
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (status === 'loading' || status === 'success') return

    const normalized = {
      email: form.email.trim().toLowerCase(),
      contactMethod: form.contactMethod.trim(),
      message: form.message.trim()
    }

    if (!normalized.email || !normalized.message) {
      setStatus('error')
      setNotice(copy.fallbackMessage)
      return
    }

    setStatus('loading')
    setNotice('')

    try {
      const response = await subscribeToNewsletter({
        email: normalized.email,
        locale: locale || 'zh-CN',
        source,
        product,
        service,
        contact_method: normalized.contactMethod,
        message: normalized.message,
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        referrer: typeof document !== 'undefined' ? document.referrer : ''
      })

      if (response?.status !== 'success') {
        throw new Error(response?.message || copy.fallbackMessage)
      }

      setStatus('success')
      setNotice(copy.successMessage)
      trackInteractionEvent('lead_submitted', {
        form_name: source,
        source,
        product,
        service,
        contact_method: normalized.contactMethod || undefined,
        has_message: true,
        stored_in_notion: response?.stored_in_notion,
        owner_notified: response?.owner_notified,
        user_notified: response?.user_notified,
        page_path:
          typeof window !== 'undefined' ? window.location.pathname : undefined
      })
      setForm({
        email: '',
        contactMethod: '',
        message: ''
      })
    } catch (error) {
      setStatus('error')
      setNotice(error?.message || copy.fallbackMessage)
    }
  }

  function handleFormSubmit(event) {
    void handleSubmit(event)
  }

  return (
    <form
      aria-label={copy.title}
      name={source}
      onSubmit={handleFormSubmit}
      className='rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm'
    >
      <div className={`text-base font-bold leading-6 ${toneStyle.accent}`}>
        {copy.title}
      </div>
      <p className='mt-3 text-sm leading-7 text-slate-600'>
        {copy.description}
      </p>

      <div className='mt-5 space-y-4'>
        <label className='block'>
          <span className='text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'>
            {copy.emailLabel}
          </span>
          <input
            type='email'
            value={form.email}
            onChange={event => updateField('email', event.target.value)}
            placeholder={copy.emailPlaceholder}
            disabled={status === 'loading' || status === 'success'}
            required
            className={`mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70 ${toneStyle.focus}`}
          />
        </label>

        <label className='block'>
          <span className='text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'>
            {copy.contactLabel}
          </span>
          <input
            type='text'
            value={form.contactMethod}
            onChange={event => updateField('contactMethod', event.target.value)}
            placeholder={copy.contactPlaceholder}
            disabled={status === 'loading' || status === 'success'}
            className={`mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70 ${toneStyle.focus}`}
          />
        </label>

        <label className='block'>
          <span className='text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'>
            {copy.messageLabel}
          </span>
          <textarea
            value={form.message}
            onChange={event => updateField('message', event.target.value)}
            placeholder={copy.messagePlaceholder}
            disabled={status === 'loading' || status === 'success'}
            required
            rows={5}
            className={`mt-2 min-h-[132px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70 ${toneStyle.focus}`}
          />
        </label>
      </div>

      <button
        type='submit'
        disabled={status === 'loading' || status === 'success'}
        className={`mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed ${toneStyle.button}`}
      >
        {status === 'loading'
          ? copy.loadingLabel
          : status === 'success'
            ? copy.successLabel
            : copy.submitLabel}
      </button>

      <div className='mt-3 flex flex-col gap-2 text-xs leading-6 sm:flex-row sm:items-center sm:justify-between'>
        <p
          className={
            status === 'error'
              ? 'text-rose-600'
              : status === 'success'
                ? 'text-emerald-700'
                : 'text-slate-500'
          }
        >
          {notice || copy.directEmailLabel}
        </p>
        <a
          href={`mailto:${email}`}
          data-analytics-event='demo_requested'
          data-analytics-intent='demo'
          data-analytics-product={product}
          data-analytics-service={service}
          data-analytics-surface='recharge_inquiry_form'
          data-analytics-cta-position='direct_email'
          data-analytics-provider='email'
          className={`break-all font-semibold transition ${toneStyle.link}`}
        >
          {email}
        </a>
      </div>
    </form>
  )
}
