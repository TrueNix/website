import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const BASE = 'https://al-ice.ai';
const SITE_DIR = 'website';

// Confirmed duplicate briefings. Keep the stronger/newer URL and redirect the overlap.
const DUPLICATE_REDIRECTS = new Map([
  ['/posts/2026/07/zscaler-ipi-crypto-payment-ai-agents/', '/posts/2026/07/zscaler-indirect-prompt-injection-crypto-payment-ai-agents/'],
  ['/posts/2026/07/trendai-mcp-server-security-audit-4982-flaws-2259-servers/', '/posts/2026/07/trendai-mcp-server-security-audit-4982-flaws/']
]);

const CATEGORY_META = {
  'ai-cves': {
    label: 'AI Vulnerabilities & CVEs',
    description: 'Actionable vulnerability disclosures affecting AI frameworks, agents, model infrastructure, and developer tooling.',
    accent: 'critical'
  },
  research: {
    label: 'AI Security Research',
    description: 'New papers, attack techniques, evaluations, and defensive research for AI and agentic systems.',
    accent: 'research'
  },
  security: {
    label: 'Agent & Supply Chain Security',
    description: 'Incidents, threat intelligence, prompt injection, identity, cloud, and software supply-chain risk.',
    accent: 'security'
  },
  comparisons: {
    label: 'Tools & Comparisons',
    description: 'Practical evaluations of security tools, AI platforms, and engineering workflows.',
    accent: 'tools'
  }
};

function categoryMeta(slug, fallback='Security'){
  return CATEGORY_META[slug] || { label: fallback, description: `Latest ${fallback} coverage.`, accent: 'default' };
}

function getGitLastMod(filePath){
  try{
    const out = execSync(`git log -1 --format=%cI -- ${filePath}`, { stdio: ['ignore','pipe','ignore']}).toString().trim();
    return out ? out.slice(0,10) : null;
  } catch { return null; }
}

function meta(html, name){
  const re = new RegExp(`<meta\\s+name=["']${name.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}["']\\s+content=["']([^"']+)["']\\s*/?>`, 'i');
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

async function walk(dir){
  const out = [];
  const items = await readdir(dir, { withFileTypes:true });
  for (const it of items){
    const p = join(dir, it.name);
    if (it.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

function pageShell({title, canonical, description, body, schema=''}){
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
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="al-ice.ai" />
  <meta property="og:title" content="${title.replaceAll('"','&quot;')}" />
  <meta property="og:description" content="${(description || '').replaceAll('"','&quot;')}" />
  <meta property="og:url" content="${canonical}" />
  <meta name="twitter:card" content="summary" />
  <link rel="alternate" type="application/atom+xml" title="al-ice.ai — AI security intelligence" href="/feed.xml" />
  ${schema}

  <!-- Favicons -->
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.ico" sizes="32x32 16x16" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZX0TZSMV99"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-ZX0TZSMV99');
  </script>

  <link rel="stylesheet" href="/assets/css/site.css" />
  <script>
    (function(){
      // Default theme: retro (80/90s). Visitors can switch to Modern and we'll remember it.
      try{
        var t = localStorage.getItem('theme');
        if (t !== 'modern') document.documentElement.setAttribute('data-theme','retro');
      }catch(e){
        document.documentElement.setAttribute('data-theme','retro');
      }
    })();
  </script>
</head>
<body>
  <div class="wrap">
    <header class="site">
      <div class="brand"><a href="/"><span class="brand-mark" aria-hidden="true">A</span><span>al-ice.ai</span></a></div>
      <nav class="small">
        <a href="/posts/">Posts</a>
        <a href="/categories/">Categories</a>
        <a href="/search/">Search</a>
        <a href="/about/">About</a>
        <button id="themeToggle" class="theme-toggle" type="button" aria-label="Switch site style">Style: 80/90s</button>
      </nav>
    </header>
    ${body}
    <footer class="site-footer small muted">
      <div class="footer-brand"><strong>al-ice.ai</strong><span>Independent AI security intelligence for practitioners.</span></div>
      <nav aria-label="Footer"><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/disclosure/">Editorial policy</a><a href="/privacy/">Privacy</a><a href="/feed.xml">RSS</a><a href="/sitemap.xml">Sitemap</a></nav>
      <div>© ${new Date().getFullYear()} al-ice.ai</div>
    </footer>
  </div>

  <script>
    (function(){
      var btn = document.getElementById('themeToggle');
      if(!btn) return;
      function isRetro(){ return document.documentElement.getAttribute('data-theme') === 'retro'; }
      function render(){
        btn.textContent = isRetro() ? 'Style: 80/90s' : 'Style: Modern';
      }
      function setRetro(on){
        if(on){
          document.documentElement.setAttribute('data-theme','retro');
          try{ localStorage.removeItem('theme'); }catch(e){}
        }else{
          document.documentElement.removeAttribute('data-theme');
          try{ localStorage.setItem('theme','modern'); }catch(e){}
        }
        render();
      }
      render();
      btn.addEventListener('click', function(){ setRetro(!isRetro()); });
    })();
  </script>
</body>
</html>`.replace(/[ \t]+\n/g, '\n');
}

async function main(){
  const postRoot = join(SITE_DIR, 'posts');
  const files = (await walk(postRoot)).filter(f => f.endsWith('index.html'));

  const posts = [];
  for (const file of files){
    const html = await readFile(file, 'utf8');
    const title = meta(html,'post:title');
    const date = meta(html,'post:date');
    const category = meta(html,'post:category') || 'security';
    const categoryLabel = categoryMeta(category, meta(html,'post:categoryLabel') || (category[0].toUpperCase()+category.slice(1))).label;
    const description = meta(html, 'description') || '';

    if (!title || !date) continue;

    // Convert file path to URL path: website/posts/.../index.html -> /posts/.../
    const rel = file.replace(/^website\//,'').replace(/index\.html$/,'');
    const urlPath = '/' + rel.replace(/\\/g,'/');

    const lastmod = getGitLastMod(file) || date;

    if (DUPLICATE_REDIRECTS.has(urlPath)) continue;
    posts.push({ title, date, category, categoryLabel, description, urlPath, lastmod });
  }

  posts.sort((a,b) => (b.date).localeCompare(a.date));

  // categories (for filters + category pages)
  const byCat = new Map();
  for (const p of posts){
    if (!byCat.has(p.category)) byCat.set(p.category, { ...categoryMeta(p.category, p.categoryLabel), posts: [] });
    byCat.get(p.category).posts.push(p);
  }

  const PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil(posts.length / PER_PAGE));

  function pageUrl(n){
    return n <= 1 ? '/posts/' : `/posts/page/${n}/`;
  }

  function renderPagination(current){
    if (totalPages <= 1) return '';

    const parts = [];
    const mkLink = (n, label=n) => `<a class="page" href="${pageUrl(n)}">${label}</a>`;

    if (current > 1) parts.push(mkLink(current - 1, 'Prev'));

    // windowed page numbers
    const window = 2;
    const pages = new Set([1, totalPages]);
    for (let i = current - window; i <= current + window; i++){
      if (i >= 1 && i <= totalPages) pages.add(i);
    }
    const sorted = [...pages].sort((a,b)=>a-b);

    let last = 0;
    for (const n of sorted){
      if (last && n - last > 1) parts.push('<span class="dots">…</span>');
      parts.push(n === current ? `<span class="page current">${n}</span>` : mkLink(n));
      last = n;
    }

    if (current < totalPages) parts.push(mkLink(current + 1, 'Next'));

    return `<nav class="pagination" aria-label="Posts pagination">${parts.join('')}</nav>`;
  }

  function filterPills(activeAllHref){
    const cats = [...byCat.entries()]
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([slug, v]) => `<a class="pill" href="/categories/${slug}/">${v.label} <span class="muted">(${v.posts.length})</span></a>`)
      .join('');
    return `<div class="pills"><span class="muted small">Filter:</span> <a class="pill active" href="${activeAllHref}">All</a>${cats ? ' ' + cats : ''}</div>`;
  }


  function renderPostsPage(pageNum){
    const start = (pageNum - 1) * PER_PAGE;
    const slice = posts.slice(start, start + PER_PAGE);

    const cards = slice.map(p => `
<article class="post-card card">
  <span class="signal-line" aria-hidden="true"></span>
  <h2 class="post-title"><a href="${p.urlPath}">${p.title}</a></h2>
  ${p.description ? `<p class="post-deck">${p.description}</p>` : ''}
  <div class="post-meta">
    <time datetime="${p.date}">${p.date}</time>
    <a class="badge" href="/categories/${p.category}/">${p.categoryLabel}</a>
  </div>
</article>`).join('');

    const grid = `<div class="posts-grid">${cards || '<div class="card muted">No posts yet.</div>'}</div>`;

    return pageShell({
      title: pageNum > 1 ? `Posts (Page ${pageNum}) — al-ice.ai` : 'Posts — al-ice.ai',
      canonical: `${BASE}${pageUrl(pageNum)}`,
      description: 'High-signal AI/security/automation notes and links.',
      body: `<main>
<h1>Posts</h1>
<p class="muted">High-signal AI/security/automation notes.</p>
${filterPills('/posts/')}
${grid}
${renderPagination(pageNum)}
</main>`
    });
  }

  function renderHomePage(){
    // Homepage default: newest posts first (already sorted by date desc).
    const latest = posts.slice(0, PER_PAGE);
    const featured = latest[0];
    const remaining = latest.slice(1);

    const latestCards = remaining.map(p => `
<article class="post-card card">
  <span class="signal-line" aria-hidden="true"></span>
  <h3 class="post-title"><a href="${p.urlPath}">${p.title}</a></h3>
  ${p.description ? `<p class="post-deck">${p.description}</p>` : ''}
  <div class="post-meta">
    <time datetime="${p.date}">${p.date}</time>
    <a class="badge" href="/categories/${p.category}/">${p.categoryLabel}</a>
  </div>
</article>`).join('');

    const topGrid = `<div class="posts-grid latest-grid">${latestCards || '<div class="card muted">No posts yet.</div>'}</div>`;
    const featuredCard = featured ? `<article class="featured-story card">
      <div class="eyebrow"><span class="live-dot"></span> Lead intelligence</div>
      <h2><a href="${featured.urlPath}">${featured.title}</a></h2>
      ${featured.description ? `<p>${featured.description}</p>` : ''}
      <div class="post-meta"><time datetime="${featured.date}">${featured.date}</time><a class="badge" href="/categories/${featured.category}/">${featured.categoryLabel}</a></div>
      <a class="text-link" href="${featured.urlPath}">Read the briefing <span aria-hidden="true">→</span></a>
    </article>` : '';

    return pageShell({
      title: 'al-ice.ai — latest AI signal',
      canonical: `${BASE}/`,
      description: 'Latest high-signal AI security, infrastructure, and research updates—short summaries with primary sources.',
      body: `<main>
<section class="hero">
  <div class="eyebrow"><span class="live-dot"></span> Continuously monitored • Primary-source led</div>
  <h1>Intelligence for the<br><span>agentic attack surface.</span></h1>
  <p class="hero-copy">Independent reporting on AI vulnerabilities, agent security, prompt injection, and the software supply chain — distilled for defenders and engineering teams.</p>
  <div class="hero-cta">
    <a class="btn" href="/posts/">Browse all posts</a>
    <a class="btn secondary" href="/about/">How we report</a>
  </div>
</section>

<div class="trust-strip" aria-label="Editorial principles"><span>Primary sources</span><span>Actionable analysis</span><span>No pay-to-play coverage</span></div>
${featuredCard}
${filterPills('/')}

<div class="section-heading"><div><span class="eyebrow">Latest coverage</span><h2 class="section-title">The security signal</h2></div><a href="/posts/">View all intelligence →</a></div>
${topGrid}
<p class="muted small"><a href="/posts/">See full feed →</a></p>
</main>`
    });
  }

  // Ensure theme toggle + persistence on *all* pages (including individual post pages created by the publisher).
  function themeInitScript(){
    // Default: Modern. If visitor opted into CRT/retro, remember it.
    return `<script>(function(){try{var t=localStorage.getItem('theme');if(t==="retro")document.documentElement.setAttribute('data-theme','retro');}catch(e){}})();</script>`;
  }

  function themeToggleButton(){
    // Button content is populated by themeHandlerScript (so it can swap icon+label).
    return `<button id="themeToggle" class="theme-toggle" type="button" aria-label="Toggle CRT mode"></button>`;
  }

  function themeHandlerScript(){
    return `<script>(function(){
      var btn=document.getElementById('themeToggle');
      if(!btn) return;

      function isRetro(){ return document.documentElement.getAttribute('data-theme')==='retro'; }

      function crtIcon(){
        // Animated CRT icon (gif)
        return '<img class="theme-ico" src="/assets/img/crt.gif" alt="" aria-hidden="true" />';
      }

      function flatIcon(){
        return '<svg class="theme-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5l1 2H8l1-2H6a2 2 0 0 1-2-2V6Zm2 0v9h12V6H6Z"/></svg>';
      }

      function render(){
        if(isRetro()){
          btn.classList.add('is-retro');
          btn.innerHTML = '<span class="theme-screen">' + flatIcon() + '<span class="crt-noise" aria-hidden="true"></span><span class="crt-line" aria-hidden="true"></span></span><span class="theme-label">Modern</span>';
          btn.setAttribute('title','Switch to modern');
          btn.setAttribute('aria-label','Switch to modern');
        }else{
          btn.classList.remove('is-retro');
          btn.innerHTML = '<span class="theme-screen">' + crtIcon() + '<span class="crt-noise" aria-hidden="true"></span><span class="crt-line" aria-hidden="true"></span></span><span class="theme-label">CRT</span>';
          btn.setAttribute('title','Toggle CRT (80/90s) vibe');
          btn.setAttribute('aria-label','Toggle CRT (80/90s) vibe');
        }
      }

      function pulse(anim){
        try{
          btn.classList.remove('anim-connect','anim-disconnect');
          // force reflow so the animation re-triggers
          void btn.offsetWidth;
          btn.classList.add(anim);
          window.setTimeout(function(){ btn.classList.remove(anim); }, 700);
        }catch(e){}
      }

      function setRetro(on){
        if(on){
          pulse('anim-connect');
          document.documentElement.setAttribute('data-theme','retro');
          try{ localStorage.setItem('theme','retro'); }catch(e){}
        }else{
          pulse('anim-disconnect');
          document.documentElement.removeAttribute('data-theme');
          try{ localStorage.removeItem('theme'); }catch(e){}
        }
        render();
      }

      render();
      btn.addEventListener('click', function(){ setRetro(!isRetro()); });
    })();</script>`;
  }

  function stripWorkflows(html){
    // Normalize legacy internal routes left by earlier publishers.
    const routeMap = new Map([
      ['/categories/SECURITY/', '/categories/security/'],
      ['/categories/AI-CVES/', '/categories/ai-cves/'],
      ['/categories/RESEARCH/', '/categories/research/'],
      ['/category/security/', '/categories/security/'],
      ['/category/security', '/categories/security/'],
      ['/category/research', '/categories/research/'],
      ['/workflows/', '/posts/'],
      ['/news/', '/news/log/'],
      ['/services/', '/about/']
    ]);
    for (const [from, to] of routeMap) html = html.replaceAll(`href="${from}"`, `href="${to}"`);
    return html;
  }

  function addUtmToExternalLinks(html){
    const UTM = {
      utm_source: 'al-ice.ai',
      utm_medium: 'referral',
      utm_campaign: 'posts'
    };

    function rewrite(urlStr){
      try{
        const u = new URL(urlStr);
        // Only rewrite true external links
        if (u.hostname === 'al-ice.ai' || u.hostname.endsWith('.al-ice.ai')) return urlStr;
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return urlStr;
        if (u.searchParams.has('utm_source')) return urlStr;
        for (const [k,v] of Object.entries(UTM)) u.searchParams.set(k, v);
        return u.toString();
      }catch{
        return urlStr;
      }
    }

    // href="..."
    html = html.replace(/href="(https?:\/\/[^\"#]+)(#[^\"]*)?"/g, (m, url, hash='') => {
      return `href="${rewrite(url)}${hash}"`;
    });
    // href='...'
    html = html.replace(/href='(https?:\/\/[^\'#]+)(#[^']*)?'/g, (m, url, hash='') => {
      return `href='${rewrite(url)}${hash}'`;
    });

    return html;
  }

  async function ensureThemeOnHtmlFile(file){
    let html = await readFile(file, 'utf8');
    const original = html;
    html = stripWorkflows(html);
    html = addUtmToExternalLinks(html);

    // --- Theme init script (in <head>, after CSS link) ---
    if (html.includes('/assets/css/site.css')){
      // Strip ALL theme-init scripts (read theme + set data-theme)
      html = html.replace(/\s*<script>([\s\S]*?)<\/script>/g, (m, body) => {
        const b = String(body || '');
        const readsTheme = b.includes("localStorage.getItem('theme')") || b.includes('localStorage.getItem("theme")');
        const touchesRootTheme = b.includes("document.documentElement.setAttribute('data-theme'") || b.includes("document.documentElement.removeAttribute('data-theme'");
        if (readsTheme && touchesRootTheme) return '';
        return m;
      });

      // Insert once after CSS link
      const cssTag = '<link rel="stylesheet" href="/assets/css/site.css" />';
      const initTag = themeInitScript();
      if (!html.includes(initTag)) {
        html = html.replace(cssTag, `${cssTag}\n  ${initTag}`);
      }
    }

    // --- Theme toggle button ---
    if (html.includes('class="small"')){
      html = html.replace(/\s*<button\s+id="themeToggle"[^>]*>[\s\S]*?<\/button>\s*/g, `\n        ${themeToggleButton()}\n`);

      if (!html.includes('id="themeToggle"') && html.includes('<nav')){
        html = html.replace(/<nav\s+class="small">([\s\S]*?)<\/nav>/m, (m, inner) => {
          return `<nav class="small">${inner}\n        ${themeToggleButton()}\n      </nav>`;
        });
      }
    }

    // --- Theme handler script (before </body>) ---
    if (html.includes('</body>')){
      // Strip old/legacy handler scripts
      html = html.replace(/\s*<script>([\s\S]*?)<\/script>/g, (m, body) => {
        const b = String(body || '');
        const mentionsToggle = b.includes('themeToggle') || b.includes("getElementById('themeToggle'") || b.includes('getElementById("themeToggle"');
        if (!mentionsToggle) return m;

        const isLegacy = b.includes('Style: 80/90s') || b.includes("localStorage.setItem('theme','modern')") || b.includes("localStorage.removeItem('theme')");
        const isIconHandler = b.includes('crtIcon') || b.includes('flatIcon') || b.includes('theme-ico') || b.includes('Toggle CRT');

        if (isLegacy || isIconHandler) return '';
        return m;
      });

      // Inject once
      const handler = themeHandlerScript();
      if (!html.includes('themeToggle') || !html.includes("getElementById('themeToggle')")) {
        html = html.replace('</body>', `  ${handler}\n</body>`);
      }
    }

    // Collapse runs of blank lines (prevents whitespace drift)
    html = html.replace(/\n{3,}/g, '\n\n');

    if (html !== original) await writeFile(file, html);
  }

  // posts index + paginated pages
  await mkdir(join(SITE_DIR,'posts'), { recursive:true });
  await writeFile(join(SITE_DIR,'posts','index.html'), renderPostsPage(1));

  // homepage: render posts natively at /
  await writeFile(join(SITE_DIR,'index.html'), renderHomePage());
  for (let pageNum = 2; pageNum <= totalPages; pageNum++){
    const dir = join(SITE_DIR, 'posts', 'page', String(pageNum));
    await mkdir(dir, { recursive:true });
    await writeFile(join(dir, 'index.html'), renderPostsPage(pageNum));
  }

  // patch theme toggle into generated pages
  await ensureThemeOnHtmlFile(join(SITE_DIR,'index.html'));
  await ensureThemeOnHtmlFile(join(SITE_DIR,'posts','index.html'));
  for (let pageNum = 2; pageNum <= totalPages; pageNum++){
    await ensureThemeOnHtmlFile(join(SITE_DIR, 'posts', 'page', String(pageNum), 'index.html'));
  }

  // patch theme toggle into ALL post detail pages
  for (const f of files){
    await ensureThemeOnHtmlFile(f);
  }

  // Replace confirmed duplicate pages with client redirects (GitHub Pages has no redirect rules).
  for (const [from, to] of DUPLICATE_REDIRECTS){
    const out = join(SITE_DIR, from, 'index.html');
    const target = `${BASE}${to}`;
    await writeFile(out, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0;url=${to}"><title>Briefing moved — al-ice.ai</title></head><body><p>This briefing was consolidated. <a href="${to}">Read the canonical report</a>.</p></body></html>`);
  }

  // patch theme toggle into other static pages (search/about/legal/etc)
  const extraPages = [
    join(SITE_DIR,'search','index.html'),
    join(SITE_DIR,'about','index.html'),
    join(SITE_DIR,'contact','index.html'),
    join(SITE_DIR,'privacy','index.html'),
    join(SITE_DIR,'terms','index.html'),
    join(SITE_DIR,'disclosure','index.html'),
    join(SITE_DIR,'news','log','index.html'),
    join(SITE_DIR,'404.html'),
  ];
  for (const p of extraPages){
    try{ await ensureThemeOnHtmlFile(p); }catch{ /* ignore missing */ }
  }

  // categories index
  const catList = [...byCat.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([slug,v]) => `
<article class="category-card card category-${v.accent}">
  <div class="category-top"><span class="eyebrow">${String(v.posts.length).padStart(2,'0')} briefings</span><span aria-hidden="true">↗</span></div>
  <h2><a href="/categories/${slug}/">${v.label}</a></h2>
  <p>${v.description}</p>
  <a class="text-link" href="/categories/${slug}/">Explore coverage →</a>
</article>`).join('');
  const categoriesIndex = pageShell({
    title: 'Categories — al-ice.ai',
    canonical: `${BASE}/categories/`,
    description: 'Browse posts by category.',
    body: `<main>
<div class="page-intro"><span class="eyebrow">Coverage map</span><h1>Explore the attack surface.</h1><p class="muted">Focused intelligence organized around the risks security and engineering teams need to track.</p></div>
<div class="category-grid">${catList || '<div class="card muted">No categories yet.</div>'}</div>
</main>`
  });
  await mkdir(join(SITE_DIR,'categories'), { recursive:true });
  await writeFile(join(SITE_DIR,'categories','index.html'), categoriesIndex);
  await ensureThemeOnHtmlFile(join(SITE_DIR,'categories','index.html'));

  // category pages
  for (const [slug, v] of byCat.entries()){
    const items = v.posts.map(p => `
<li><a href="${p.urlPath}">${p.title}</a> <span class="muted">— ${p.date}</span></li>`).join('');
    const html = pageShell({
      title: `${v.label} — al-ice.ai`,
      canonical: `${BASE}/categories/${slug}/`,
      description: `Posts tagged ${v.label}.`,
      body: `<main>
<div class="page-intro"><span class="eyebrow">Intelligence category</span><h1>${v.label}</h1><p class="muted">${v.description}</p></div>
<div class="card feed-list"><ul>${items}</ul></div>
</main>`
    });
    await mkdir(join(SITE_DIR,'categories',slug), { recursive:true });
    const out = join(SITE_DIR,'categories',slug,'index.html');
    await writeFile(out, html);
    await ensureThemeOnHtmlFile(out);
  }

  // search index (client-side)
  const searchIndex = posts.map(p => ({
    title: p.title,
    date: p.date,
    category: p.category,
    categoryLabel: p.categoryLabel,
    description: p.description,
    urlPath: p.urlPath,
  }));
  await mkdir(join(SITE_DIR,'assets'), { recursive:true });
  await writeFile(join(SITE_DIR,'assets','search-index.json'), JSON.stringify(searchIndex, null, 0));

  // sitemap
  const urls = new Map();
  function add(path, lastmod){ urls.set(`${BASE}${path}`, lastmod || null); }
  add('/', getGitLastMod(join(SITE_DIR,'index.html')));
  add('/posts/', getGitLastMod(join(SITE_DIR,'posts','index.html')));
  add('/search/', getGitLastMod(join(SITE_DIR,'search','index.html')));
  if (totalPages > 1){
    for (let pageNum = 2; pageNum <= totalPages; pageNum++){
      add(`/posts/page/${pageNum}/`, getGitLastMod(join(SITE_DIR,'posts','page',String(pageNum),'index.html')));
    }
  }
  add('/categories/', getGitLastMod(join(SITE_DIR,'categories','index.html')));
  for (const [slug] of byCat.entries()) add(`/categories/${slug}/`, getGitLastMod(join(SITE_DIR,'categories',slug,'index.html')));
  for (const p of posts) add(p.urlPath, p.lastmod);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...urls.entries()].map(([loc,lastmod]) =>
      `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`
    ).join('\n') +
    `\n</urlset>\n`;
  await writeFile(join(SITE_DIR,'sitemap.xml'), sitemap);

  // Atom feed for readers, SOC tooling, and aggregators.
  const feedEntries = posts.slice(0, 50).map(p => `  <entry>\n    <title>${p.title.replaceAll('&','&amp;').replaceAll('<','&lt;')}</title>\n    <link href="${BASE}${p.urlPath}"/>\n    <id>${BASE}${p.urlPath}</id>\n    <updated>${p.date}T00:00:00Z</updated>\n    <category term="${p.categoryLabel.replaceAll('&','&amp;')}"/>\n    <summary>${(p.description || p.title).replaceAll('&','&amp;').replaceAll('<','&lt;')}</summary>\n  </entry>`).join('\n');
  const feed = `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <title>al-ice.ai — AI security intelligence</title>\n  <link href="${BASE}/feed.xml" rel="self"/>\n  <link href="${BASE}/"/>\n  <id>${BASE}/</id>\n  <updated>${posts[0]?.date || new Date().toISOString().slice(0,10)}T00:00:00Z</updated>\n  <subtitle>Primary-source-led intelligence on AI vulnerabilities, agents, and the software supply chain.</subtitle>\n${feedEntries}\n</feed>\n`;
  await writeFile(join(SITE_DIR,'feed.xml'), feed);

  console.log(`Built indexes: ${posts.length} posts, ${byCat.size} categories`);
}

await main();
