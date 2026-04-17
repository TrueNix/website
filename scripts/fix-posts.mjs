#!/usr/bin/env node
// Repair broken al-ice.ai post HTML to match the correct skeleton

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const THEME_INIT = `<script>(function(){try{var t=localStorage.getItem('theme');if(t==="retro")document.documentElement.setAttribute('data-theme','retro');}catch(e){}})();</script>`;

const THEME_JS = `<script>(function(){
      var btn=document.getElementById('themeToggle');
      if(!btn) return;

      function isRetro(){ return document.documentElement.getAttribute('data-theme')==='retro'; }

      function crtIcon(){
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

const CORRECT_HEADER = `    <header class="site">
      <div class="brand"><a href="/">al-ice.ai</a></div>
      <nav class="small">
        <a href="/posts/">Posts</a>
        <a href="/categories/">Categories</a>
        <a href="/search/">Search</a>
        <button id="themeToggle" class="theme-toggle" type="button" aria-label="Toggle CRT mode"></button>
      </nav>
    </header>`;

const CORRECT_FOOTER = `    <footer class="small muted">
      <div><a href="/posts/">← All posts</a> • <a href="/sitemap.xml">Sitemap</a></div>
    </footer>
  </div>
${THEME_JS}
</body>
</html>`;

const files = await glob('website/posts/2026/04/*/index.html');
let fixed = 0;

for (const file of files) {
  let html = readFileSync(file, 'utf-8');

  // Check if it has the correct structure already
  if (html.includes('<div class="brand">') && html.includes('<nav class="small">') && html.includes('isRetro()')) {
    continue;
  }

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' — al-ice.ai', '') : 'Untitled';

  // Extract description
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
  const desc = descMatch ? descMatch[1] : '';

  // Extract post:date
  const dateMatch = html.match(/<meta name="post:date" content="([^"]+)"/) || html.match(/<time datetime="([^"]+)">/);
  const date = dateMatch ? dateMatch[1] : '2026-04-01';

  // Extract post:category
  const catMatch = html.match(/<meta name="post:category" content="([^"]+)"/);
  const cat = catMatch ? catMatch[1] : 'security';

  // Extract post:categoryLabel
  const catLabelMatch = html.match(/<meta name="post:categoryLabel" content="([^"]+)"/);
  const catLabel = catLabelMatch ? catLabelMatch[1] : cat.charAt(0).toUpperCase() + cat.slice(1);

  // Extract canonical URL
  const canonMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
  const canonical = canonMatch ? canonMatch[1] : '';

  // Extract post content — everything inside article.post between post-meta (or h1) and closing </article>
  const articleMatch = html.match(/<article class="post">([\s\S]*?)<\/article>/);
  if (!articleMatch) {
    console.error('No article found in:', file);
    continue;
  }

  let articleContent = articleMatch[1];

  // Extract just the body content (skip h1 and post-meta, they'll be regenerated)
  // Try to find content after post-meta or after h1
  const postMetaMatch = articleContent.match(/<div class="post-meta">[\s\S]*?<\/div>/);
  const h1Match = articleContent.match(/<h1 class="post-title">[^<]*<\/h1>/);
  
  let bodyContent = articleContent;
  if (postMetaMatch) {
    bodyContent = articleContent.slice(articleContent.indexOf(postMetaMatch[0]) + postMetaMatch[0].length);
  } else if (h1Match) {
    bodyContent = articleContent.slice(articleContent.indexOf(h1Match[0]) + h1Match[0].length);
  }

  bodyContent = bodyContent.trim();

  // Build the corrected HTML
  const corrected = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="google-adsense-account" content="ca-pub-9044791241492233">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} — al-ice.ai</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index,follow" />
  <meta name="post:title" content="${title}" />
  <meta name="post:date" content="${date}" />
  <meta name="post:category" content="${cat}" />
  <meta name="post:categoryLabel" content="${catLabel}" />
  <meta name="post:author" content="al-ice.ai Editorial" />

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZX0TZSMV99"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);} 
    gtag('js', new Date());
    gtag('config', 'G-ZX0TZSMV99');
  </script>

  <link rel="stylesheet" href="/assets/css/site.css" />
  ${THEME_INIT}
</head>
<body>
  <div class="wrap">
${CORRECT_HEADER}
    <main>
      <article class="post">
        <h1 class="post-title">${title}</h1>
        <div class="post-meta">
          <time datetime="${date}">${date}</time>
          <a class="badge" href="/categories/${cat}/">${catLabel}</a>
          <span class="post-author">by al-ice.ai Editorial</span>
        </div>

${bodyContent}

      </article>
    </main>

${CORRECT_FOOTER}`;

  writeFileSync(file, corrected);
  fixed++;
}

console.log(`Fixed ${fixed} of ${files.length} April 2026 posts`);
