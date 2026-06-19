import feedparser
import time
import requests
import re
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

news_router = APIRouter()

# In-memory cache: avoid hammering RSS feeds on every request
_news_cache: dict = {}
_news_cache_time: dict = {}
CACHE_TTL = 300   # 5 minutes

RSS_SOURCES = {
    "autosport":   "https://www.autosport.com/rss/f1/news/",
    "motorsport":  "https://www.motorsport.com/rss/f1/news/",
    "bbc":         "https://feeds.bbci.co.uk/sport/formula1/rss.xml",
    "formula1":    "https://www.formula1.com/en/latest/all.xml",
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

_scraped_thumbnails_cache = {}

def _scrape_single_link(link: str) -> tuple[str, Optional[str]]:
    if not link or not link.startswith("http"):
        return link, None
    if link in _scraped_thumbnails_cache:
        return link, _scraped_thumbnails_cache[link]
    try:
        r = requests.get(link, headers=headers, timeout=1.5)
        if r.status_code == 200:
            match = re.search(r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', r.text)
            if match:
                img_url = match.group(1)
                _scraped_thumbnails_cache[link] = img_url
                return link, img_url
            match = re.search(r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', r.text)
            if match:
                img_url = match.group(1)
                _scraped_thumbnails_cache[link] = img_url
                return link, img_url
            match = re.search(r'<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']', r.text)
            if match:
                img_url = match.group(1)
                _scraped_thumbnails_cache[link] = img_url
                return link, img_url
    except Exception as e:
        print(f"[News] Scrape failed for {link}: {e}")
    _scraped_thumbnails_cache[link] = None
    return link, None

def _parse_feed(source: str, url: str) -> list[dict]:
    now = time.time()
    if source in _news_cache and (now - _news_cache_time.get(source, 0)) < CACHE_TTL:
        return _news_cache[source]

    try:
        r = requests.get(url, headers=headers, timeout=10)
        feed = feedparser.parse(r.content)
        articles = []
        
        links_to_scrape = []
        for entry in feed.entries[:30]:   # cap at 30 per source
            thumb = None
            if entry.get("media_thumbnail"):
                thumb = entry["media_thumbnail"][0].get("url")
            elif entry.get("media_content"):
                thumb = entry["media_content"][0].get("url")
            elif entry.get("enclosures"):
                for enc in entry["enclosures"]:
                    if enc.get("href"):
                        thumb = enc.get("href")
                        break
            elif entry.get("links"):
                for l in entry["links"]:
                    if l.get("rel") == "enclosure" and l.get("href"):
                        thumb = l.get("href")
                        break

            link = entry.get("link", "")
            if not thumb and link:
                links_to_scrape.append(link)

            articles.append({
                "source":    source,
                "title":     entry.get("title", ""),
                "summary":   entry.get("summary", "")[:300],
                "link":      link,
                "published": entry.get("published", ""),
                "thumbnail": thumb,
            })

        if links_to_scrape:
            with ThreadPoolExecutor(max_workers=10) as executor:
                results = executor.map(_scrape_single_link, links_to_scrape)
                scraped_map = dict(results)
            for art in articles:
                if not art["thumbnail"] and art["link"] in scraped_map:
                    art["thumbnail"] = scraped_map[art["link"]]

        _news_cache[source] = articles
        _news_cache_time[source] = now
        return articles
    except Exception as e:
        print(f"[News] RSS fetch failed for {source}: {e}")
        return []


@news_router.get("/api/news")
def get_news(
    source: Optional[str] = Query(None),   # None = all sources
    limit:  int           = Query(50, ge=1, le=200),
):
    """
    Fetch and return merged RSS articles from F1 news sources.
    Cached for 5 minutes per source.
    source param: autosport | motorsport | bbc | planetf1 | None (all)
    """
    sources_to_fetch = (
        {source: RSS_SOURCES[source]}
        if source and source in RSS_SOURCES
        else RSS_SOURCES
    )

    all_articles = []
    for src, url in sources_to_fetch.items():
        all_articles.extend(_parse_feed(src, url))

    # Sort by published descending (best-effort string sort — RFC 822 sorts lexically)
    all_articles.sort(key=lambda a: a.get("published", ""), reverse=True)

    return {
        "articles":     all_articles[:limit],
        "total":        len(all_articles),
        "sources":      list(sources_to_fetch.keys()),
        "cachedUntil":  int(time.time()) + CACHE_TTL,
    }


@news_router.get("/api/news/sources")
def get_sources():
    return {"sources": list(RSS_SOURCES.keys())}
