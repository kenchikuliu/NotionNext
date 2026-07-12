import { siteConfig } from '@/lib/config'
import BlogPostListPage from '../components/BlogPostListPage'
import BlogPostListScroll from '../components/BlogPostListScroll'
import CategoryBar from '../components/CategoryBar'
import PaidIntentCta from '../components/PaidIntentCta'

const LayoutIndex = props => {
  return (
    <div id='post-outer-wrapper' className='px-5 md:px-0'>
      <CategoryBar {...props} />
      <PaidIntentCta surface='home_post_list' position='home_post_list_top' />
      {siteConfig('POST_LIST_STYLE') === 'page' ? (
        <BlogPostListPage {...props} />
      ) : (
        <BlogPostListScroll {...props} />
      )}
    </div>
  )
}

export default LayoutIndex
