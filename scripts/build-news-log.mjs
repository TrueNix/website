import { execSync } from 'node:child_process';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = 'https://al-ice.ai';
const SITE_DIR = 'website';
const OUT_DIR = join(SITE_DIR, 'news', 'log');

function sh(cmd){
  return execSync(cmd, { stdio: ['ignore','pipe','ignore']}).toString('utf8');
}

function pageShell({title, canonical, description, body}){
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="google-adsense-account" content="ca-pub-9044791241492233">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  ${description ? `<meta name="description" content="${description.replaceAll('"','&quot;')}" />` : ''}
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index,follow" />

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZX0TZSMV99"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-ZX0TZSMV99');
  </script>

  <link rel="stylesheet" href="/assets/css/site.css" />
</head>
<body>
  <div class="wrap">
    <header class="site">
      <div class="brand"><a href="/">al-ice.ai</a></div>
      <nav class="small">
        <a href="/workflows/">Workflows</a>
        <a href="/posts/">Posts</a>
        <a href="/categories/">Categories</a>
        <a href="/news/">News</a>
        <a href="/services/">Services</a>
      </nav>
    </header>
    ${body}
    <footer class="small muted">
      <div>© ${new Date().getFullYear()} al-ice.ai • <a href="/sitemap.xml">Sitemap</a></div>
    </footer>
  </div>
</body>
</html>`;
}

function extractPostTitle(html){
  const m = html.match(/<meta\s+name=["']post:title["']\s+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : null;
}

async function main(){
  await mkdir(OUT_DIR, { recursive: true });

  // recent commits touching website/posts
  const log = sh("git log -n 60 --date=iso-strict --pretty=format:%cI%x09%s -- website/posts website/news");
  const lines = log.split(/\n/).filter(Boolean);

  const entries = [];
  for (const line of lines){
    const [iso, subject] = line.split('\t');
    if (!iso || !subject) continue;
    // keep only news-ish commits
    if (!/news/i.test(subject) && !/hourly/i.test(subject) && !/digest/i.test(subject) && !/CVE/i.test(subject)) continue;
    entries.push({ iso, subject });
  }

  // also list latest news posts by scanning /posts for category=news meta
  const files = sh("ls -1 website/posts/2026/01/*/index.html 2>/dev/null || true").split(/\n/).filter(Boolean);
  const newsPosts = [];
  for (const f of files){
    const html = await readFile(f, 'utf8');
    if (!html.includes('name="post:category" content="news"')) continue;
    const title = extractPostTitle(html) || f;
    const urlPath = '/' + f.replace(/^website\//,'').replace(/index\.html$/,'');
    const lastmod = (sh(`git log -1 --format=%cI -- ${f}`).trim() || '').slice(0,10);
    newsPosts.push({ title, urlPath, lastmod });
  }
  newsPosts.sort((a,b)=> (b.lastmod||'').localeCompare(a.lastmod||''));

  const commitItems = entries.slice(0,30).map(e => `<li><span class="muted">${e.iso.replace('T',' ').replace('Z',' UTC')}</span> — ${e.subject}</li>`).join('');
  const postItems = newsPosts.slice(0,30).map(p => `<li><a href="${p.urlPath}">${p.title}</a> <span class="muted">— ${p.lastmod || ''}</span></li>`).join('');

  const html = pageShell({
    title: 'News Log — al-ice.ai',
    canonical: `${BASE}/news/log/`,
    description: 'Operational log of recent news publishing and latest news posts.',
    body: `<main>
<h1>News log</h1>
<p class="muted">A simple audit page showing recent publishing activity.</p>

<h2>Latest news posts</h2>
<div class="card"><ul>${postItems || '<li class="muted">No news posts found.</li>'}</ul></div>

<h2>Recent publishing commits</h2>
<div class="card"><ul>${commitItems || '<li class="muted">No matching commits found.</li>'}</ul></div>

<p class="muted small">Note: this is derived from repository history and may lag by a minute during deployments.</p>
</main>`
  });

  await writeFile(join(OUT_DIR, 'index.html'), html);
  console.log('Built /news/log/');
}

await main();
