#!/usr/bin/env python3
"""Refresh the public publication and video snapshots for GitHub Pages."""

from datetime import datetime
from email.utils import parsedate_to_datetime
import json
import os
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SHANGHAI = ZoneInfo("Asia/Shanghai")
MAX_RESPONSE_BYTES = 4 * 1024 * 1024


class SourceError(Exception):
    pass


def read(url, *, accept="application/json", headers=None):
    request = Request(url, headers={
        "User-Agent": "HanzhongZhangHomepage/1.0",
        "Accept": accept,
        **(headers or {}),
    })
    try:
        with urlopen(request, timeout=20) as result:
            response = result.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as error:
        raise SourceError(f"HTTP {error.code}") from None
    except (OSError, URLError):
        raise SourceError("connection failed") from None
    if len(response) > MAX_RESPONSE_BYTES:
        raise SourceError("response too large")
    return response


def https_url(value):
    if not isinstance(value, str):
        return ""
    url = value.strip()
    if url.startswith("//"):
        url = "https:" + url
    if url.startswith("http://"):
        url = "https://" + url[len("http://"):]
    if not url.startswith("https://"):
        return ""
    try:
        parts = urlsplit(url)
    except ValueError:
        return ""
    return url if parts.hostname and not (parts.username or parts.password) else ""


def year(value):
    return int(value) if str(value).isdigit() and len(str(value)) == 4 else None


def scholar_works(account, key):
    query = urlencode({
        "engine": "google_scholar_author", "author_id": account,
        "api_key": key, "sort": "pubdate", "num": 50, "hl": "en",
    })
    data = json.loads(read(f"https://serpapi.com/search.json?{query}"))
    if data.get("error") or not isinstance(data.get("articles"), list):
        raise SourceError("SerpApi returned no article list. Check the author ID, key and quota.")
    return [
        {
            "title": row["title"],
            "authors": row.get("authors") or "",
            "year": year(row.get("year")),
            "venue": row.get("publication") or "",
            "url": https_url(row.get("link")),
        }
        for row in data["articles"] if row.get("title")
    ]


def orcid_works(account):
    token = os.environ.get("ORCID_ACCESS_TOKEN")
    data = json.loads(read(
        f"https://pub.orcid.org/v3.0/{account}/works", accept="application/vnd.orcid+json",
        headers={"Authorization": f"Bearer {token}"} if token else None,
    ))
    if not isinstance(data.get("group"), list):
        raise SourceError("ORCID returned no work list.")
    items = []
    paper_types = {"journal-article", "conference-paper", "preprint", "working-paper", "book-chapter"}
    for group in data["group"]:
        for work in group.get("work-summary", []):
            title = ((work.get("title") or {}).get("title") or {}).get("value")
            kind = work.get("type")
            if not title or kind not in paper_types:
                continue
            identifiers = (work.get("external-ids") or {}).get("external-id", [])
            doi = next((record["external-id-value"] for record in identifiers
                        if record.get("external-id-type") == "doi"
                        and record.get("external-id-value", "").startswith("10.")), "")
            date = work.get("publication-date") or {}
            items.append({
                "title": title,
                "year": year((date.get("year") or {}).get("value")),
                "status": {"preprint": "preprint", "journal-article": "published",
                           "conference-paper": "published", "book-chapter": "published"}.get(kind, "other"),
                "venue": (work.get("journal-title") or {}).get("value") or "",
                "url": f"https://doi.org/{doi}" if doi else https_url((work.get("url") or {}).get("value")),
            })
            break
    return sorted(items, key=lambda item: item["year"] or 0, reverse=True)[:50]


def video_url(value):
    url = https_url(value)
    if not url:
        return ""
    parts = urlsplit(url)
    video = re.match(r"^/video/(BV[A-Za-z0-9]+|av\d+)(?:/|$)", parts.path)
    if parts.hostname in {"www.bilibili.com", "m.bilibili.com", "bilibili.com"} and video:
        return f"https://www.bilibili.com/video/{video[1]}/"
    return ""


def bilibili_videos(account):
    offset = ""
    videos = []
    for _ in range(3):
        query = urlencode({"host_mid": account, "offset": offset})
        data = json.loads(read(
            f"https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?{query}",
            headers={"Referer": f"https://space.bilibili.com/{account}/"},
        ))
        if data.get("code") != 0 or not isinstance(data.get("data"), dict):
            raise SourceError(f"Bilibili rejected the public request (code {data.get('code')}).")
        page = data["data"]
        for row in page.get("items") or []:
            modules = row.get("modules") or {}
            author = modules.get("module_author") or {}
            if str(author.get("mid")) != account:
                continue
            major = (modules.get("module_dynamic") or {}).get("major") or {}
            archive = major.get("archive") or {}
            url = video_url(archive.get("jump_url"))
            if not url and re.fullmatch(r"BV[A-Za-z0-9]+", archive.get("bvid") or ""):
                url = f"https://www.bilibili.com/video/{archive['bvid']}/"
            if not url or not archive.get("title"):
                continue
            timestamp = author.get("pub_ts")
            date = datetime.fromtimestamp(timestamp, SHANGHAI).date().isoformat() if isinstance(timestamp, int) else ""
            videos.append({
                "title": archive["title"],
                "url": url,
                "image": https_url(archive.get("cover")),
                "summary": (archive.get("desc") or "").strip()[:240],
                "category": "Bilibili",
                "date": date,
            })
        next_offset = page.get("offset")
        if len(videos) >= 12 or not page.get("has_more") or not next_offset or next_offset == offset:
            break
        offset = next_offset
    return sorted({item["url"]: item for item in videos}.values(), key=lambda item: item["date"], reverse=True)[:12]


def rss_videos(account, base):
    url = https_url(base)
    if not url:
        raise SourceError("BILIBILI_RSS_BASE must be an HTTPS RSSHub URL.")
    rss = ElementTree.fromstring(read(f"{url.rstrip('/')}/bilibili/user/video/{account}", accept="application/xml"))
    channel = rss.find("channel")
    if channel is None:
        raise SourceError("RSSHub returned no RSS channel.")
    videos = []
    for item in channel.findall("item"):
        title = item.findtext("title")
        url = video_url(item.findtext("link"))
        if not title or not url:
            continue
        date = item.findtext("pubDate")
        videos.append({
            "title": title,
            "url": url,
            "category": "Bilibili",
            "date": parsedate_to_datetime(date).astimezone(SHANGHAI).date().isoformat() if date else "",
        })
    return sorted(videos, key=lambda item: item["date"], reverse=True)[:12]


def video_source(account):
    fallback = os.environ.get("BILIBILI_RSS_BASE")
    try:
        items = bilibili_videos(account)
        if items or not fallback:
            return items
    except SourceError:
        if not fallback:
            raise
    return rss_videos(account, fallback)


def refresh(snapshots, name, provider, account, pattern, load):
    if not account:
        snapshots[name] = None
        return
    if not re.fullmatch(pattern, account):
        raise SourceError("invalid account ID in api/content.json")
    items = load()
    previous = snapshots.get(name) or {}
    if not items and previous.get("account") == account and previous.get("items"):
        raise SourceError("source returned zero items. Kept the previous snapshot.")
    snapshots[name] = {"source": provider, "account": account, "items": items}
    print(f"{provider}: {len(items)} items")


def main():
    sources = json.loads((ROOT / "api/content.json").read_text(encoding="utf-8"))["sources"]
    file = ROOT / "api/imports.json"
    original = json.loads(file.read_text(encoding="utf-8"))
    snapshots = dict(original)
    key = os.environ.get("SERPAPI_KEY")
    scholar = sources.get("scholarId")
    orcid = sources.get("orcid")
    bilibili = sources.get("bilibiliUid")
    if key and scholar:
        papers = ("scholar", scholar, r"[\w-]+", lambda: scholar_works(scholar, key))
    else:
        papers = ("orcid", orcid, r"\d{4}-\d{4}-\d{4}-\d{3}[\dX]", lambda: orcid_works(orcid))
    if scholar and not key:
        print("SERPAPI_KEY is unset. Using public ORCID works when configured.")
    if not bilibili:
        print("Bilibili sync is waiting for a space UID in the site editor.")

    failed = False
    for name, settings in (
        ("publications", papers),
        ("videos", ("bilibili", bilibili, r"\d+", lambda: video_source(bilibili))),
    ):
        try:
            refresh(snapshots, name, *settings)
        except SourceError as error:
            print(f"{settings[0]}: {error}")
            failed = True
        except (ValueError, TypeError, AttributeError, ElementTree.ParseError):
            print(f"{settings[0]}: unexpected response format. Kept the previous snapshot.")
            failed = True

    if snapshots != original:
        temporary = file.with_suffix(".tmp")
        temporary.write_text(json.dumps(snapshots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(file)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
