import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const BASE = 'https://al-ice.ai';
const SITE_DIR = 'website';

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

function pageShell({title, canonical, description, body}){
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
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
      <div class="brand"><a href="/">al-ice.ai</a></div>
      <nav class="small">
        <a href="/posts/">Posts</a>
        <a href="/categories/">Categories</a>
        <a href="/search/">Search</a>
        <button id="themeToggle" class="theme-toggle" type="button" aria-label="Switch site style">Style: 80/90s</button>
      </nav>
    </header>
    ${body}
    <footer class="small muted">
      <div>© ${new Date().getFullYear()} al-ice.ai • <a href="/sitemap.xml">Sitemap</a></div>
      <div class="muted">Affiliate disclosure: some links may be affiliate links. If you buy, we may earn a commission at no extra cost to you.</div>
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
</html>`;
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
    const categoryLabel = meta(html,'post:categoryLabel') || (category[0].toUpperCase()+category.slice(1));

    if (!title || !date) continue;

    // Convert file path to URL path: website/posts/.../index.html -> /posts/.../
    const rel = file.replace(/^website\//,'').replace(/index\.html$/,'');
    const urlPath = '/' + rel.replace(/\\/g,'/');

    const lastmod = getGitLastMod(file) || date;

    posts.push({ title, date, category, categoryLabel, urlPath, lastmod });
  }

  posts.sort((a,b) => (b.date).localeCompare(a.date));

  // categories (for filters + category pages)
  const byCat = new Map();
  for (const p of posts){
    if (!byCat.has(p.category)) byCat.set(p.category, { label: p.categoryLabel, posts: [] });
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
  <h2 class="post-title"><a href="${p.urlPath}">${p.title}</a></h2>
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
    const top = posts.slice(0, 3);
    const latest = posts.slice(3, 3 + PER_PAGE);

    const topCards = top.map(p => `
<article class="post-card card">
  <h3 class="post-title"><a href="${p.urlPath}">${p.title}</a></h3>
  <div class="post-meta">
    <time datetime="${p.date}">${p.date}</time>
    <a class="badge" href="/categories/${p.category}/">${p.categoryLabel}</a>
  </div>
</article>`).join('');

    const latestCards = latest.map(p => `
<article class="post-card card">
  <h3 class="post-title"><a href="${p.urlPath}">${p.title}</a></h3>
  <div class="post-meta">
    <time datetime="${p.date}">${p.date}</time>
    <a class="badge" href="/categories/${p.category}/">${p.categoryLabel}</a>
  </div>
</article>`).join('');

    const topGrid = `<div class="posts-grid">${topCards || '<div class="card muted">No posts yet.</div>'}</div>`;
    const latestGrid = `<div class="posts-grid">${latestCards || '<div class="card muted">No posts yet.</div>'}</div>`;

    return pageShell({
      title: 'al-ice.ai — latest AI signal',
      canonical: `${BASE}/`,
      description: 'Latest high-signal AI security, infrastructure, and research updates—short summaries with primary sources.',
      body: `<main>
<section class="hero">
  <h1>Latest AI signal</h1>
  <p class="muted">High-signal AI security, infrastructure, and research — short notes with primary sources.</p>
  <div class="hero-cta">
    <a class="btn" href="/posts/">Browse all posts</a>
    <a class="btn secondary" href="/categories/">Browse categories</a>
  </div>
</section>

${filterPills('/')}

<h2 class="section-title">Top 3</h2>
${topGrid}

<h2 class="section-title">Latest</h2>
${latestGrid}
<p class="muted small"><a href="/posts/">See full feed →</a></p>
</main>`
    });
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

  // categories index
  const catList = [...byCat.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([slug,v]) => `
<li><a href="/categories/${slug}/">${v.label}</a> <span class="muted">(${v.posts.length})</span></li>`).join('');
  const categoriesIndex = pageShell({
    title: 'Categories — al-ice.ai',
    canonical: `${BASE}/categories/`,
    description: 'Browse posts by category.',
    body: `<main>
<h1>Categories</h1>
<div class="card"><ul>${catList || '<li class="muted">No categories yet.</li>'}</ul></div>
</main>`
  });
  await mkdir(join(SITE_DIR,'categories'), { recursive:true });
  await writeFile(join(SITE_DIR,'categories','index.html'), categoriesIndex);

  // category pages
  for (const [slug, v] of byCat.entries()){
    const items = v.posts.map(p => `
<li><a href="${p.urlPath}">${p.title}</a> <span class="muted">— ${p.date}</span></li>`).join('');
    const html = pageShell({
      title: `${v.label} — al-ice.ai`,
      canonical: `${BASE}/categories/${slug}/`,
      description: `Posts tagged ${v.label}.`,
      body: `<main>
<h1>${v.label}</h1>
<div class="card"><ul>${items}</ul></div>
</main>`
    });
    await mkdir(join(SITE_DIR,'categories',slug), { recursive:true });
    await writeFile(join(SITE_DIR,'categories',slug,'index.html'), html);
  }

  // search index (client-side)
  const searchIndex = posts.map(p => ({
    title: p.title,
    date: p.date,
    category: p.category,
    categoryLabel: p.categoryLabel,
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

  console.log(`Built indexes: ${posts.length} posts, ${byCat.size} categories`);
}

await main();
