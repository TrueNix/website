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
  <script>(function(){try{var t=localStorage.getItem('theme');if(t==="retro")document.documentElement.setAttribute('data-theme','retro');}catch(e){}})();</script>
</head>
<body>
  <div class="wrap">
    <header class="site">
      <div class="brand"><a href="/">al-ice.ai</a></div>
      <nav class="small">
        <a href="/posts/">Posts</a>
        <a href="/categories/">Categories</a>
        <a href="/search/">Search</a>
        <a href="/about/">About</a>
        <button id="themeToggle" class="theme-toggle" type="button" aria-label="Toggle CRT mode"></button>
      </nav>
    </header>
    ${body}
    <footer class="small muted">
      <div>© ${new Date().getFullYear()} al-ice.ai • <a href="/sitemap.xml">Sitemap</a></div>
    </footer>
  </div>
  <script>(function(){
      var btn=document.getElementById('themeToggle');
      if(!btn) return;
      function isRetro(){ return document.documentElement.getAttribute('data-theme')==='retro'; }
      function crtIcon(){ return '<img class="theme-ico" src="/assets/img/crt.gif" alt="" aria-hidden="true" />'; }
      function flatIcon(){ return '<svg class="theme-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5l1 2H8l1-2H6a2 2 0 0 1-2-2V6Zm2 0v9h12V6H6Z"/></svg>'; }
      function render(){
        if(isRetro()){
          btn.classList.add('is-retro');
          btn.innerHTML='<span class="theme-screen">'+flatIcon()+'<span class="crt-noise" aria-hidden="true"></span><span class="crt-line" aria-hidden="true"></span></span><span class="theme-label">Modern</span>';
          btn.setAttribute('title','Switch to modern'); btn.setAttribute('aria-label','Switch to modern');
        }else{
          btn.classList.remove('is-retro');
          btn.innerHTML='<span class="theme-screen">'+crtIcon()+'<span class="crt-noise" aria-hidden="true"></span><span class="crt-line" aria-hidden="true"></span></span><span class="theme-label">CRT</span>';
          btn.setAttribute('title','Toggle CRT (80/90s) vibe'); btn.setAttribute('aria-label','Toggle CRT (80/90s) vibe');
        }
      }
      function pulse(anim){try{btn.classList.remove('anim-connect','anim-disconnect');void btn.offsetWidth;btn.classList.add(anim);window.setTimeout(function(){btn.classList.remove(anim);},700);}catch(e){}}
      function setRetro(on){if(on){pulse('anim-connect');document.documentElement.setAttribute('data-theme','retro');try{localStorage.setItem('theme','retro');}catch(e){}}else{pulse('anim-disconnect');document.documentElement.removeAttribute('data-theme');try{localStorage.removeItem('theme');}catch(e){}}render();}
      render(); btn.addEventListener('click',function(){setRetro(!isRetro());});
    })();</script>
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
