const styles = {
  indigo: {
    accent: 'text-indigo-300',
    email: 'hover:text-indigo-300'
  },
  amber: {
    accent: 'text-amber-300',
    email: 'hover:text-amber-300'
  }
}

function trackingProps({
  product,
  service,
  position,
  provider,
  eventName = 'demo_requested',
  intent = 'demo'
}) {
  return {
    'data-analytics-event': eventName,
    'data-analytics-intent': intent,
    'data-analytics-product': product,
    'data-analytics-service': service,
    'data-analytics-surface': 'paid_intent_page',
    'data-analytics-cta-position': position,
    'data-analytics-provider': provider
  }
}

export default function RechargeContactCard({
  content,
  product,
  service,
  tone = 'indigo'
}) {
  const toneStyle = styles[tone] || styles.indigo

  return (
    <div className='rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white'>
      <div
        className={`text-sm font-semibold uppercase tracking-[0.18em] ${toneStyle.accent}`}
      >
        {content.contactTitle}
      </div>
      <p className='mt-3 text-sm leading-7 text-slate-300'>
        {content.contactText}
      </p>

      <a
        href={`mailto:${content.email}`}
        {...trackingProps({
          product,
          service,
          position: 'recharge_email',
          provider: 'email'
        })}
        className={`mt-4 inline-block max-w-full break-all text-xl font-bold text-white transition sm:text-2xl ${toneStyle.email}`}
      >
        {content.email}
      </a>
    </div>
  )
}
