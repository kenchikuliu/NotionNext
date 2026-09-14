import { useRouter } from 'next/router'

const copy = {
  'zh-CN': {
    eyebrow: 'About CharliiAI',
    title: '关于 CharliiAI',
    intro:
      'CharliiAI 关注 AI 工具、自动化工作流、内容系统和出海增长。这里更重视真实可用的判断，而不是单纯追逐热点。',
    note: '我会把工具、模型、产品和运营场景放在一起看：它是否稳定，是否节省时间，是否能进入真实业务流程，是否值得长期使用。',
    principlesTitle: '内容原则',
    principles: [
      {
        title: '先判断是否值得做',
        text: '流行不等于有价值。每一篇内容都会尽量回答它适合谁、解决什么问题、有没有替代方案。'
      },
      {
        title: '把复杂问题讲成可执行步骤',
        text: '少停留在概念，多拆成工具选择、工作流设计、页面结构和具体操作。'
      },
      {
        title: '保持内容密度和阅读体验',
        text: 'CharliiAI 不是关键词堆叠站，文章需要能帮助读者形成判断。'
      }
    ],
    topicsTitle: '主要方向',
    topics: [
      'AI 工具评测与选型',
      'Agent、LLM 和自动化工作流',
      '内容生产、SEO 与独立站增长',
      'AI 产品案例和出海创业观察'
    ],
    contactTitle: '联系',
    contactText:
      '合作、咨询、媒体和产品交流，优先通过邮箱联系。中文沟通也可以使用微信。',
    emailLabel: 'Email',
    socialLabel: 'X',
    wechatLabel: 'WeChat',
    linksTitle: '推荐入口',
    links: [
      {
        href: '/tools',
        title: '工具导航',
        text: '查看站内整理的 AI 工具和相关资源。'
      },
      {
        href: '/archive',
        title: '文章归档',
        text: '按时间浏览完整内容。'
      },
      {
        href: '/contact',
        title: '联系页面',
        text: '查看更完整的合作和联系信息。'
      }
    ]
  },
  'en-US': {
    eyebrow: 'About CharliiAI',
    title: 'About CharliiAI',
    intro:
      'CharliiAI covers AI tools, automation workflows, content systems, and global growth with a practical operator perspective.',
    note: 'The goal is to judge whether a model, tool, product, or workflow is stable, useful, time-saving, and realistic enough to enter daily work.',
    principlesTitle: 'Editorial Principles',
    principles: [
      {
        title: 'Start with whether it is worth doing',
        text: 'Popularity is not enough. Each piece should clarify who it helps, what problem it solves, and what alternatives exist.'
      },
      {
        title: 'Turn complexity into usable steps',
        text: 'The site focuses on tool choices, workflow design, page structure, and concrete execution rather than abstract claims.'
      },
      {
        title: 'Keep density and readability together',
        text: 'CharliiAI is not a keyword farm. The writing should help readers build judgment.'
      }
    ],
    topicsTitle: 'Main Topics',
    topics: [
      'AI tool reviews and selection',
      'Agents, LLMs, and automation workflows',
      'Content production, SEO, and indie site growth',
      'AI product cases and global business notes'
    ],
    contactTitle: 'Contact',
    contactText:
      'For partnerships, consulting, media, and product discussions, email is the primary channel.',
    emailLabel: 'Email',
    socialLabel: 'X',
    wechatLabel: 'WeChat',
    linksTitle: 'Start Here',
    links: [
      {
        href: '/en-US/tools',
        title: 'Tools',
        text: 'Browse AI tools and practical resources covered on the site.'
      },
      {
        href: '/en-US',
        title: 'Home',
        text: 'Read the latest English articles and site updates.'
      },
      {
        href: '/en-US/contact',
        title: 'Contact',
        text: 'See contact and collaboration details.'
      }
    ]
  }
}

function inferLocale(router, pageLocale) {
  if (pageLocale) return pageLocale
  if (router.asPath?.startsWith('/en-US')) return 'en-US'
  return 'zh-CN'
}

export default function AboutPageContent({ pageLocale }) {
  const router = useRouter()
  const locale = inferLocale(router, pageLocale)
  const t = copy[locale] || copy['zh-CN']
  const avatarSrc = '/charliiai-favicon.svg'

  return (
    <main className='bg-white pb-16 text-slate-900 dark:bg-[#18171d] dark:text-gray-100'>
      <section className='mx-auto grid max-w-6xl gap-8 px-5 pt-10 md:grid-cols-[1fr_280px] md:pt-14'>
        <div>
          <div className='text-sm font-semibold text-slate-500 dark:text-gray-400'>
            {t.eyebrow}
          </div>
          <h1 className='mt-4 text-3xl font-bold leading-tight md:text-5xl'>
            {t.title}
          </h1>
          <p className='mt-6 max-w-3xl text-lg leading-8 text-slate-700 dark:text-gray-300'>
            {t.intro}
          </p>
          <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-gray-400'>
            {t.note}
          </p>
        </div>

        <aside className='md:justify-self-end'>
          {/* This local copy keeps the profile visible when Notion images fail. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt='Dr. Charlii'
            className='h-40 w-40 rounded-lg border border-slate-200 bg-slate-50 p-8 object-contain dark:border-gray-700 dark:bg-gray-900 md:h-56 md:w-56'
          />
          <div className='mt-4 text-sm leading-7 text-slate-600 dark:text-gray-400'>
            Dr. Charlii
            <br />
            AI researcher and content operator
          </div>
        </aside>
      </section>

      <section className='mx-auto mt-12 max-w-6xl px-5'>
        <div className='border-t border-slate-200 pt-8 dark:border-gray-800'>
          <h2 className='text-2xl font-bold'>{t.principlesTitle}</h2>
          <div className='mt-6 grid gap-6 md:grid-cols-3'>
            {t.principles.map(item => (
              <article
                key={item.title}
                className='border-t border-slate-200 pt-5 dark:border-gray-800'
              >
                <h3 className='text-lg font-semibold'>{item.title}</h3>
                <p className='mt-3 text-sm leading-7 text-slate-600 dark:text-gray-400'>
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className='mx-auto mt-12 grid max-w-6xl gap-10 px-5 md:grid-cols-[0.9fr_1.1fr]'>
        <div className='border-t border-slate-200 pt-8 dark:border-gray-800'>
          <h2 className='text-2xl font-bold'>{t.topicsTitle}</h2>
          <ul className='mt-6 space-y-3 text-base leading-7 text-slate-700 dark:text-gray-300'>
            {t.topics.map(item => (
              <li
                key={item}
                className='border-b border-slate-100 pb-3 dark:border-gray-800'
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className='border-t border-slate-200 pt-8 dark:border-gray-800'>
          <h2 className='text-2xl font-bold'>{t.linksTitle}</h2>
          <div className='mt-6 grid gap-4'>
            {t.links.map(item => (
              <a
                key={item.href}
                href={item.href}
                className='block rounded-lg border border-slate-200 px-5 py-4 transition hover:border-slate-400 dark:border-gray-800 dark:hover:border-gray-600'
              >
                <div className='font-semibold'>{item.title}</div>
                <p className='mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400'>
                  {item.text}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className='mx-auto mt-12 max-w-6xl px-5'>
        <div className='border-t border-slate-200 pt-8 dark:border-gray-800'>
          <h2 className='text-2xl font-bold'>{t.contactTitle}</h2>
          <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-gray-400'>
            {t.contactText}
          </p>
          <dl className='mt-6 grid gap-4 text-sm md:grid-cols-3'>
            <div>
              <dt className='font-semibold text-slate-500 dark:text-gray-400'>
                {t.emailLabel}
              </dt>
              <dd className='mt-2'>
                <a
                  className='font-medium hover:underline'
                  href='mailto:hello@charliiai.com'
                >
                  hello@charliiai.com
                </a>
              </dd>
            </div>
            <div>
              <dt className='font-semibold text-slate-500 dark:text-gray-400'>
                {t.socialLabel}
              </dt>
              <dd className='mt-2'>
                <a
                  className='font-medium hover:underline'
                  href='https://x.com/charliiai'
                  target='_blank'
                  rel='noreferrer'
                >
                  x.com/charliiai
                </a>
              </dd>
            </div>
            <div>
              <dt className='font-semibold text-slate-500 dark:text-gray-400'>
                {t.wechatLabel}
              </dt>
              <dd className='mt-2 font-medium'>Charliiai2024</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  )
}
