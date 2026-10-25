// Reviewed English editorial copy. Keep the Notion source ID and published URL.
export const newsletterId = '34700092-b977-81d6-9339-df13da206dd2'
export const newsletterSlug = 'article/best-ai-tools-newsletter-writing'
export const newsletterModified = '2026-10-25T06:10:04.000Z'
export const newsletterEnhancement = {
  seoTitle: 'Best AI Tools for Newsletter Writing: 3 Practical Picks',
  seoDescription:
    'Compare Notion AI and Mailchimp for newsletter writing, plus Kit for sending. Use a source-first prompt, sample issue, and pre-send checklist.',
  heroSummary:
    'Choose a writing and sending setup for your newsletter, then use a source-first prompt and review checklist to produce your next issue.',
  intentTitle: 'Choose tools for your next newsletter issue',
  intentText:
    'Compare two AI writing options and a dedicated sending platform by the job they perform. Follow the worked example to turn verified notes into an issue with one clear reader action.',
  faqItems: [
    {
      question: 'What are the best AI tools for newsletter writing?',
      answer:
        'Notion AI is a useful fit when research and drafts already live in Notion. Mailchimp suits teams that want AI editing inside their email workflow. Kit is a sending and subscriber-management option; this guide does not recommend it as an AI writer. Choose the tool that fixes your current bottleneck.'
    },
    {
      question: 'Can AI write and send a newsletter automatically?',
      answer:
        'Writing assistance and email delivery are separate tasks. AI can organize notes and draft copy, while an email platform manages subscribers and sending. Review facts, permissions, links, audience selection, and the final email before scheduling it.'
    },
    {
      question: 'How do I keep an AI newsletter from sounding generic?',
      answer:
        'Give the model approved sources, a defined reader, a specific point of view, and a short sample of your own writing. Ask it to flag missing evidence. Edit the opening and recommendation yourself, and remove claims you cannot verify.'
    },
    {
      question: 'Do I need a paid AI newsletter tool?',
      answer:
        'Start with the writing and email tools you already use. AI access, subscriber limits, and automation features vary by plan. Check current provider terms and evaluate one complete issue before adding a subscription.'
    }
  ]
}

const link = (label, href) => [label, [['a', href]]]
const text = value => ({ type: 'text', title: [[value]] })
const heading = value => ({ type: 'header', title: [[value]] })
const subheading = value => ({ type: 'sub_header', title: [[value]] })
const image = (name, alt) => ({
  type: 'image',
  source: `https://www.charliiai.com/images/newsletter/${name}.svg`,
  alt
})

// Examples are illustrative editorial exercises, not product performance claims.
export const newsletterContent = [
  text(
    'The best AI tools for newsletter writing solve a specific problem: turning trustworthy source material into an email your readers can use. Choose Notion AI if your notes already live in Notion, or Mailchimp if you want writing assistance inside your email editor. Consider Kit for delivery and subscriber management when you already have a drafting tool.'
  ),
  text(
    'You do not need all three. Start with the part of your weekly process that breaks most often: collecting evidence, drafting a clear issue, or getting the finished email to the right subscribers. The recommendations below reflect documented features, not a hands-on speed or deliverability benchmark.'
  ),
  { type: 'toc' },
  heading('Best AI tools for newsletter writing: compare the jobs'),
  text(
    'A writing assistant and an email service are different purchases. Compare them by what they remove from your workflow, then check the current plan limits before moving your list or buying another subscription.'
  ),
  {
    type: 'table',
    rows: [
      ['Tool', 'Best fit', 'Check before choosing'],
      [
        'Notion AI',
        'Research notes, outlines, and drafts in one workspace',
        'AI access and workspace permissions; use a separate email service for delivery'
      ],
      [
        'Mailchimp',
        'AI copy editing inside an email marketing workflow',
        'Plan eligibility and available AI features in your account'
      ],
      [
        'Kit',
        'Sending newsletters and managing subscriber segments',
        'Treat it as the sending layer here, not as the AI writing recommendation'
      ]
    ]
  },
  image(
    'choose-your-tool',
    'Choose Notion AI for notes and drafts, Mailchimp for AI email editing, or Kit for sending and subscriber management.'
  ),
  subheading('Notion AI: choose it when your evidence already lives there'),
  text(
    'Notion documents AI features for summarizing, drafting, rewriting, and improving tone or grammar. For a recurring newsletter, keep one page per issue with the audience, source links, your observations, and a draft. Ask AI to group the notes into an outline before asking for prose. This makes the editor’s evidence visible alongside the output.'
  ),
  text(
    'Use this setup when moving notes between apps is the main source of friction. Check which pages the assistant can access, and remove confidential client details from material that does not belong in a public issue. Notion is the workspace in this setup; an email platform still handles opt-in subscribers, unsubscribe links, and delivery.'
  ),
  {
    type: 'text',
    title: [
      link(
        'Official Notion AI feature and plan guidance',
        'https://www.notion.com/help/notion-ai-faqs'
      )
    ]
  },
  subheading('Mailchimp: choose it when editing and sending belong together'),
  text(
    'Mailchimp describes AI tools for generating, rewriting, and polishing email content in its marketing workflow. This is a practical option when the draft keeps changing after it reaches the email editor. Work on the headline, preview text, and body together, then review the rendered email instead of approving a document that may look different in an inbox.'
  ),
  text(
    'Check the AI features and eligibility available in your account before subscribing. A generated subject line is a candidate to review, not a promise of higher opens. Confirm that it describes the actual issue and that the preview text adds information rather than repeating the subject.'
  ),
  {
    type: 'text',
    title: [
      link(
        'Official Mailchimp AI tools overview',
        'https://mailchimp.com/solutions/ai-tools/'
      )
    ]
  },
  subheading('Kit: choose it for the sending layer'),
  text(
    'Kit’s email marketing offering includes newsletters, templates, segmentation, automations, and reporting. It belongs in this comparison because an AI draft still needs a delivery system. Use it when you want to keep your writing process separate from subscriber management. This guide does not count Kit as one of the AI writers.'
  ),
  text(
    'Keep the handoff simple: move an approved draft into a reusable template, select the intended audience, and send a test email. If you already have a working email service, compare the cost and migration effort before switching. A new sender will not fix an unclear editorial promise.'
  ),
  {
    type: 'text',
    title: [
      link(
        'Official Kit email marketing features',
        'https://kit.com/features/email-marketing'
      )
    ]
  },
  heading('A source-first weekly newsletter workflow'),
  text(
    'Build each issue around one question your readers need answered. For a small business newsletter, that could be: “What should I check before publishing a booking page?” Collect only the material needed to answer that question. Keep the source URL, date, exact supporting detail, and your interpretation in separate fields.'
  ),
  image(
    'weekly-workflow',
    'Four newsletter stages: collect verified notes, draft one useful answer, review evidence and voice, then test and send.'
  ),
  text(
    'First, choose three to five useful inputs and discard material that repeats the same point. Second, write your own one-sentence recommendation. Third, ask the assistant for an outline and a draft grounded in those inputs. Fourth, edit the recommendation, check every claim against the sources, and move the approved text into your email template.'
  ),
  text(
    'Save last week’s issue beside the current brief. Ask for repeated phrases or overlapping advice to be flagged, rather than asking the model to invent a fresh angle without evidence. A series stays consistent when its reader promise is stable and each issue answers a different concrete question.'
  ),
  heading('Copy this prompt, then review the output'),
  text(
    'Use the following prompt in the writing assistant you already have. Replace each bracketed field and provide the approved notes below it. If a note is uncertain, label it as uncertain before asking for a draft.'
  ),
  {
    type: 'quote',
    title: [
      [
        'Write a newsletter draft for [reader] answering [one question]. Use only the approved notes and source links below. My recommendation is [your point of view]. Follow this short voice sample: [your writing]. Produce a subject under 50 characters, preview text, a 250–350 word body, and one call to action. Preserve source links next to factual claims. Do not invent statistics, quotes, product features, or personal experience. Put missing evidence in an “Editor checks” list outside the draft. Avoid repeating the previous issue: [paste issue or summary].'
      ]
    ]
  },
  text(
    'Run a second pass that asks for unsupported claims, vague sentences, and missing context. Compare that list with the original notes yourself. An assistant can overlook its own errors, so a clean self-review is not evidence that the draft is accurate. Keep the checks separate from the text you paste into the email editor.'
  ),
  heading('Worked example: from notes to one useful issue'),
  text(
    'This is an illustrative issue for a newsletter aimed at independent service businesses. Its approved notes are observations supplied by the editor: a booking page needs a clear service description, an accurate price or quote process, and a working confirmation path. No conversion improvement or customer result is assumed.'
  ),
  {
    type: 'quote',
    title: [
      [
        'Subject: Before you share that booking link\nPreview: Check the promise, price, and next step.\n\nYour next customer should be able to answer three questions before booking: What am I getting? What will it cost? What happens next?\n\nOpen your booking page on your phone. Read the service description without relying on what you already know about the business. If the price is a quote, say how the quote works. Then follow the booking path and check that the confirmation explains the next step.\n\nMy recommendation: fix the first unclear answer before adding another promotional section.\n\nThis week’s action: review one booking page and write down the first question it leaves unanswered.'
      ]
    ]
  },
  text(
    'The editor supplies the recommendation and checks the booking behavior. AI can tighten the wording or propose another subject, but it should not turn this example into a claim that the changes increased revenue. For your own issue, add a real observation and a source where relevant, then choose one action readers can complete.'
  ),
  heading('Pre-send checks and common mistakes'),
  image(
    'pre-send-checks',
    'Three pre-send checks: evidence and voice, inbox and links, audience and permission.'
  ),
  text(
    'Evidence and voice: open every source link, verify names and dates, remove invented experience, and read the opening aloud. Do not publish the assistant’s “Editor checks” section. When repurposing a blog post, check that the issue adds a focused recommendation instead of reproducing the entire article.'
  ),
  text(
    'Inbox and links: send a test to an inbox you control, inspect it on a phone, and click each destination. Check the subject and preview together. Keep the main action visible and remove competing calls to action. A correct draft can still fail through a broken button or an awkward template.'
  ),
  text(
    'Audience and permission: confirm the segment, sender identity, unsubscribe link, and scheduled time. Use your own internal test audience before the subscriber list. Avoid uploading private customer information just to make a prompt more detailed; use anonymized notes where the example does not require identities.'
  ),
  text(
    'After sending, compare link clicks, replies, and unsubscribes across comparable issues. Treat open rates cautiously because inbox privacy features can affect them. Change one meaningful variable at a time, such as the topic or main action, and record the result. No writing tool guarantees newsletter growth.'
  ),
  heading('Related writing guides'),
  {
    type: 'text',
    title: [
      link(
        'Best AI Writing Tools',
        '/en-US/article/best-ai-writing-tools-2026'
      ),
      [
        ': compare a broader drafting setup when newsletters share research with longer articles.'
      ]
    ]
  },
  {
    type: 'text',
    title: [
      link(
        'AI Tools for Writers and Bloggers',
        '/en-US/article/top-ai-tools-for-writers-and-bloggers'
      ),
      [': connect issue planning with your recurring writing process.']
    ]
  },
  text(
    'For your next issue, choose one writing workspace and one sending service, complete the source-first brief, and review a test email. Add another tool only when you can name the step it will improve.'
  ),
  heading('Frequently asked questions'),
  ...newsletterEnhancement.faqItems.flatMap(item => [
    subheading(item.question),
    text(item.answer)
  ])
]

export function isNewsletterPost(post) {
  return (
    post?.id === newsletterId &&
    [newsletterSlug, `en-US/${newsletterSlug}`].includes(post?.slug)
  )
}

export function createNewsletterRecordMap(original = {}) {
  const root = structuredClone(
    original.block?.[newsletterId] || {
      value: {
        id: newsletterId,
        type: 'page',
        space_id: 'c752906a-628f-4e18-b232-6039094f831a'
      }
    }
  )
  root.value.content = []
  const block = { [newsletterId]: root }
  let sequence = 0
  const add = (type, properties, parent = newsletterId, extra = {}) => {
    const id = `ed251025-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
    block[id] = {
      value: {
        id,
        type,
        parent_id: parent,
        parent_table: 'block',
        properties,
        ...extra
      }
    }
    return id
  }
  for (const item of newsletterContent) {
    let id
    if (item.type === 'table') {
      const columns = ['tool', 'fit', 'check']
      id = add('table', {}, newsletterId, {
        content: [],
        format: {
          table_block_column_order: columns,
          table_block_column_format: {},
          table_block_row_header: false,
          table_block_column_header: true
        }
      })
      for (const row of item.rows) {
        block[id].value.content.push(
          add(
            'table_row',
            Object.fromEntries(columns.map((key, i) => [key, [[row[i]]]])),
            id
          )
        )
      }
    } else if (item.type === 'image') {
      id = add(
        'image',
        {
          source: [[item.source]],
          caption: [[item.alt]],
          alt_text: [[item.alt]]
        },
        newsletterId,
        { format: { block_width: 900, display_source: item.source } }
      )
    } else {
      id = add(item.type === 'toc' ? 'table_of_contents' : item.type, {
        title: item.title || []
      })
    }
    root.value.content.push(id)
  }
  return { ...original, block }
}

export function applyNewsletterEditorial(props, locale = props?.pageLocale) {
  if (locale !== 'en-US' || !isNewsletterPost(props?.post)) return false
  const post = props.post
  post.blockMap = createNewsletterRecordMap(post.blockMap)
  post.title = newsletterEnhancement.seoTitle
  post.summary = newsletterEnhancement.seoDescription
  post.seoEnhancement = newsletterEnhancement
  post.lastEditedDate = newsletterModified
  post.lastEditedDay = '2026-10-25'
  return true
}
