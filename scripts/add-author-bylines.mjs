#!/usr/bin/env node
/**
 * Add author bylines to all posts.
 * Run from repo root: node scripts/add-author-bylines.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POSTS_DIR = 'website/posts';
const AUTHOR_NAME = 'al-ice.ai Editorial';
const AUTHOR_META = '<meta name="post:author" content="al-ice.ai Editorial" />';

async function walk(dir) {
  const out = [];
  const items = await readdir(dir, { withFileTypes: true });
  for (const it of items) {
    const p = join(dir, it.name);
    if (it.isDirectory()) out.push(...await walk(p));
    else if (it.name === 'index.html') out.push(p);
  }
  return out;
}

async function addAuthorToPost(filePath) {
  let html = await readFile(filePath, 'utf8');
  
  // Skip if already has author
  if (html.includes('post:author') || html.includes('post-author')) {
    console.log(`  [skip] ${filePath} (already has author)`);
    return false;
  }
  
  // Add author meta tag after category meta
  if (html.includes('post:categoryLabel')) {
    html = html.replace(
      /(<meta name="post:categoryLabel"[^>]+>)/,
      `$1\n  ${AUTHOR_META}`
    );
  }
  
  // Add author byline after the badge in post-meta
  // Look for: </a>\n        </div> pattern after badge
  html = html.replace(
    /(<a class="badge"[^>]+>[^<]+<\/a>)\s*\n(\s*<\/div>)/,
    `$1\n          <span class="post-author">by ${AUTHOR_NAME}</span>\n$2`
  );
  
  await writeFile(filePath, html);
  console.log(`  [updated] ${filePath}`);
  return true;
}

async function main() {
  console.log('Adding author bylines to posts...\n');
  
  const posts = await walk(POSTS_DIR);
  let updated = 0;
  
  for (const post of posts) {
    // Skip index pages (pagination)
    if (post.includes('/page/')) continue;
    if (post === 'website/posts/index.html') continue;
    
    try {
      const changed = await addAuthorToPost(post);
      if (changed) updated++;
    } catch (err) {
      console.error(`  [error] ${post}: ${err.message}`);
    }
  }
  
  console.log(`\nDone. Updated ${updated} posts.`);
}

main().catch(console.error);
