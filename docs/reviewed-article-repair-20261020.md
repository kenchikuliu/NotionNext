Two published workflow articles repeated the same paragraph across five sections and exposed an internal content-planning note. This change replaces their website bodies with complete, reviewed Chinese guides: a traceable research-summary method and an input-to-delivery workflow for a sourced weekly brief.

Each guide now has a concrete opening problem, distinct steps, two attributed interface images, usable downloadable material, related-topic links and Charlii authorship. The research guide includes a CSV evidence table; the workflow guide includes a Markdown task card. These are practical editorial recommendations and examples, with no invented first-person tests or efficiency claims.

The website resolves these two exact Notion page IDs to versioned content in `content/reviewed/`. Title and summary metadata use the same source. Other page IDs retain their existing data path; source Notion pages are unchanged. `getPage()` applies reviewed bodies before its cache read, covering article, preview and RSS callers. The root page record is first so react-notion-x renders the complete document.

Validation:

- The focused block graph, ID scope, duplicate-paragraph, image attribution, resource and metadata checks pass; a dedicated CI job repeats them.
- Both full documents rendered through the installed react-notion-x renderer. Desktop and 390px browser checks cover text, code blocks, image loading and horizontal overflow.
- ESLint passes for the four changed application JavaScript files.
- Production compilation and type validation passed locally. The subsequent build returned success but could not retrieve the live Notion database (HTTP 403 in this environment), producing only fallback routes; this is not claimed as complete live-data validation.
- Repository-wide ESLint currently reports 34 errors and 283 warnings in existing files. Existing SEO-regression checks have two stale expectations in unrelated Dify/FastGPT titles; analytics regression checks pass (6/6). Those pre-existing files are unchanged.

Before merging, require the focused CI job and the existing Vercel preview check to pass. After deployment, verify the two original public URLs, canonical/title consistency, four images and both downloads. Daily social publishing remains paused; the independent local growth monitor does not publish or alter posts.

Image provenance:

- Zotero `collections_tree.png` and `tag_selector.png`: https://www.zotero.org/support/collections_and_tags (official documentation interface screenshots, downloaded 2026-10-20).
- Jev action-space and quickstart: https://github.com/browser-use/jev-ultrafast (official project interface screenshots retained 2026-10-17; captions state the capture date and that they are not our workflow benchmark).

Rollback: revert this commit to return these exact pages to their original Notion content path. No source page, account, publishing ledger or subscriber data is modified.
