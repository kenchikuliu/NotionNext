Two public workflow articles repeated one paragraph across five sections and exposed an internal planning note. Replace their bodies with complete, attributed Chinese guides, then connect both guides to a topic resource page so readers can continue the task and use its material.

The research guide explains how to retain claims, source locations and conditions, with a downloadable CSV evidence table. The weekly-brief guide covers input, handoffs, checks and delivery, with a Markdown task card. Each has distinct steps, two attributed images and a link back to /resources/workflows.html. Reviewed metadata comes from the same source as the body.

The resource page links both guides and adds an original, runnable local case: a Python standard-library script exports a saved 24-item AI News Radar snapshot into CSV, JSON and a blank editorial task card. The ZIP includes the script, public sample, generated outputs, README and two different screenshots of the actual local output. Replaying the bundle produces 24 unique source URLs, all still unverified and zero marked ready for publication. This demonstrates local data processing; it does not claim verification of the upstream stories or product performance. The snapshot retains its original collection time and is not presented as current news.

The article override applies to two exact Notion page IDs. Source Notion records remain unchanged. The topic page and downloads are static public resources and do not require a new subscription or account flow. Existing social publishing remains paused.

Validation:

- Focused regression passes for the two-page scope, block graph, unique paragraphs, metadata date, attributed images, resources, article-to-topic links, topic-to-article links and two different case screenshots.
- Both articles render through the installed react-notion-x renderer. The resource page and both full documents pass desktop and 390px browser checks; images load and there is no document overflow.
- The downloadable ZIP was extracted to a fresh temporary directory, rerun and checked independently: 24 CSV/JSON records, 24 unique URLs, zero ready for publication and the same task card.
- Thirteen local Python tests pass for the worksheet exporter, radar integrity and existing editorial evidence handling. ESLint passes for the changed article-metadata module.
- The earlier patch passed GitHub build, CodeQL and the focused article job. The updated commit requires a fresh CI result. Vercel currently reports an account deployment block, so this PR is not considered deployed.
- Earlier local production compilation/type validation passed, but live Notion retrieval returned HTTP 403 and only fallback routes were generated. This is not full live-data validation. Existing unrelated repository lint/SEO issues remain documented in the previous checks.

Before merging, require the focused CI job and a successful Vercel preview. After deployment, open both original article URLs and the topic URL; check title/canonical consistency, six images, both article templates, the case ZIP and reciprocal links. Subscription delivery, unsubscribe and attribution remain separate unverified work; no new subscription or analytics claim is made.

Image provenance:

- Zotero collections_tree.png and tag_selector.png: https://www.zotero.org/support/collections_and_tags (official documentation images saved 2026-10-20).
- Jev action-space and quickstart: https://github.com/browser-use/jev-ultrafast (official screenshots saved 2026-10-17; captions identify their scope).
- workflow-radar-20261021 images: two regions of Charlii's actual local worksheet output after the saved 24-item snapshot was processed. The case ZIP retains hashes and relative source references.

Rollback: revert the repair commits to restore the original Notion content path and remove the topic resources. No account, subscriber records or publication ledger is changed.
