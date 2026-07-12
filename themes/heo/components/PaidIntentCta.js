import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'

const copy = {
  'zh-CN': {
    eyebrow: '充值咨询',
    title: '需要处理 ClaudeCode 或 GPT 充值需求？',
    description:
      'ClaudeCode、GPT 充值/代充、团队采购和长期需求，进入对应咨询页提交信息。',
    note: '当前不配置自动支付，价格、地区和到账安排统一人工确认。',
    primaryLabel: 'ClaudeCode 充值咨询',
    secondaryLabel: 'GPT 充值咨询'
  },
  'en-US': {
    eyebrow: 'MANUAL INQUIRY',
    title: 'Need ClaudeCode or GPT recharge help?',
    description:
      'Use the inquiry pages for ClaudeCode, GPT recharge, assisted purchase, and team sourcing.',
    note: 'Automatic payment is not configured. Pricing, region support, and timing are confirmed manually.',
    primaryLabel: 'ClaudeCode inquiry',
    secondaryLabel: 'GPT inquiry'
  }
}

function getText(locale) {
  return locale === 'en-US' ? copy['en-US'] : copy['zh-CN']
}

function trackingProps(product, surface, position) {
  return {
    'data-analytics-event': 'plan_selected',
    'data-analytics-intent': 'pricing',
    'data-analytics-product': product,
    'data-analytics-surface': surface,
    'data-analytics-cta-position': position
  }
}

export default function PaidIntentCta({
  surface = 'content',
  position = 'inline',
  compact = false,
  className = ''
}) {
  const { locale } = useRouter()
  const text = getText(locale)

  if (compact) {
    return (
      <section
        id={`paid-intent-cta-${surface}`}
        className={`overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-[#1e1e1e] dark:text-white ${className}`}
      >
        <div className='text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400'>
          {text.eyebrow}
        </div>
        <h2 className='mt-2 text-base font-bold leading-6 text-slate-950 dark:text-white'>
          {text.title}
        </h2>
        <p className='mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300'>
          {text.description}
        </p>
        <div className='mt-4 grid gap-2'>
          <SmartLink
            href='/chongzhi'
            {...trackingProps('claudecode_recharge', surface, position)}
            className='inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-yellow-500 dark:text-slate-950 dark:hover:bg-yellow-400'
          >
            {text.primaryLabel}
          </SmartLink>
          <SmartLink
            href='/gptchongzhi'
            {...trackingProps('gpt_recharge', surface, position)}
            className='inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:text-slate-950 dark:border-gray-600 dark:bg-[#18171d] dark:text-gray-100 dark:hover:border-yellow-500'
          >
            {text.secondaryLabel}
          </SmartLink>
        </div>
      </section>
    )
  }

  return (
    <section
      id={`paid-intent-cta-${surface}`}
      className={`my-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] dark:border-gray-700 dark:bg-[#1f2128] ${className}`}
    >
      <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
        <div className='max-w-2xl'>
          <div className='text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400'>
            {text.eyebrow}
          </div>
          <h2 className='mt-2 text-xl font-bold leading-7 text-slate-950 dark:text-white'>
            {text.title}
          </h2>
          <p className='mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300'>
            {text.description}
          </p>
          <p className='mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400'>
            {text.note}
          </p>
        </div>

        <div className='flex flex-col gap-3 sm:flex-row lg:flex-col'>
          <SmartLink
            href='/chongzhi'
            {...trackingProps('claudecode_recharge', surface, position)}
            className='inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-yellow-500 dark:text-slate-950 dark:hover:bg-yellow-400'
          >
            {text.primaryLabel}
          </SmartLink>
          <SmartLink
            href='/gptchongzhi'
            {...trackingProps('gpt_recharge', surface, position)}
            className='inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:text-slate-950 dark:border-gray-600 dark:bg-[#18171d] dark:text-gray-100 dark:hover:border-yellow-500'
          >
            {text.secondaryLabel}
          </SmartLink>
        </div>
      </div>
    </section>
  )
}
