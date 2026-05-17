# -*- coding: utf-8 -*-
"""
네이버 키워드 상위노출 순위 크롤러 (통합검색 기준)

기능:
  - 키워드로 네이버 모바일 '통합검색'을 조회
  - 본문에 노출된 블로그/카페 게시물을 등장 순서대로 수집 (= 상위노출 순위)

설계 메모:
  - 네이버 class 이름은 해시값이라 자주 바뀜 -> 의존하지 않는다.
  - '게시물 URL 패턴'으로 게시물을 식별한다 (안정적).
  - 통합검색은 블로그/카페가 한 블록에 섞여 노출되므로 통합 순위로 매긴다.
"""
import io
import re
import sys
import time
from dataclasses import dataclass
from playwright.sync_api import sync_playwright

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

IPHONE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/16.6 Mobile/15E148 Safari/604.1"
)

# ---- URL 정규화 -----------------------------------------------------------
_BLOG_PATH = re.compile(r"blog\.naver\.com/([A-Za-z0-9_-]+)/(\d+)")
_BLOG_QUERY = re.compile(r"blogId=([A-Za-z0-9_-]+).*?logNo=(\d+)", re.I)
_CAFE_PATH = re.compile(r"cafe\.naver\.com/([A-Za-z0-9_-]+)/(\d+)")
_CAFE_FE = re.compile(r"cafe\.naver\.com/f-e/cafes/(\d+)/articles/(\d+)")


def post_key(url):
    """게시물 URL -> (종류, 비교용 key). 게시물이 아니면 (None, None)."""
    if not url:
        return None, None
    u = url.strip()
    m = _BLOG_PATH.search(u) or _BLOG_QUERY.search(u)
    if m:
        return "블로그", f"blog:{m.group(1).lower()}/{m.group(2)}"
    m = _CAFE_PATH.search(u)
    if m:
        return "카페", f"cafe:{m.group(1).lower()}/{m.group(2)}"
    m = _CAFE_FE.search(u)
    if m:
        return "카페", f"cafe-id:{m.group(1)}/{m.group(2)}"
    return None, None


_BAD_TITLE = re.compile(r"^(더보기|RE|\d+)$")


def _pick_title(texts):
    """한 게시물의 여러 <a> 텍스트 중 제목으로 가장 그럴듯한 것을 고른다."""
    for t in texts:
        t = (t or "").strip()
        if len(t) >= 4 and not _BAD_TITLE.match(t) and not t.startswith("RE"):
            return t
    return texts[0].strip() if texts else ""


@dataclass
class Result:
    rank: int
    kind: str          # 블로그 / 카페
    url: str
    key: str
    title: str


# ---- 크롤링 ---------------------------------------------------------------
def crawl_integrated(page, keyword, max_results=30):
    """통합검색을 열고 블로그/카페 게시물을 등장 순서대로 수집한다."""
    url = f"https://m.search.naver.com/search.naver?query={keyword}"
    page.goto(url, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)

    for _ in range(6):
        page.mouse.wheel(0, 3000)
        page.wait_for_timeout(700)

    raw = page.eval_on_selector_all(
        'a[href*="blog.naver.com"], a[href*="cafe.naver.com"]',
        "els => els.map(e => [e.href, (e.innerText || '').trim()])",
    )

    order = []
    texts_by_key = {}
    for href, text in raw:
        kind, key = post_key(href)
        if not key:
            continue
        if key not in texts_by_key:
            texts_by_key[key] = []
            order.append((kind, key, href))
        texts_by_key[key].append(text)

    results = []
    for kind, key, href in order[:max_results]:
        results.append(Result(
            rank=len(results) + 1, kind=kind, url=href, key=key,
            title=_pick_title(texts_by_key[key]),
        ))
    return results


def check_keyword(keyword, target_url, max_results=30):
    """키워드 1건 검사 -> (matched Result 또는 None, target_key, 전체 results)."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent=IPHONE_UA, locale="ko-KR",
            viewport={"width": 390, "height": 844},
        )
        page = ctx.new_page()
        try:
            results = crawl_integrated(page, keyword, max_results)
        finally:
            browser.close()

    _, target_key = post_key(target_url)
    matched = next((r for r in results if r.key == target_key), None)
    return matched, target_key, results


# ---- 단독 실행 테스트 -----------------------------------------------------
if __name__ == "__main__":
    keyword = sys.argv[1] if len(sys.argv) > 1 else "안티칼알파"
    target = sys.argv[2] if len(sys.argv) > 2 else ""

    print(f"검색어='{keyword}'  (통합검색 기준)")
    t0 = time.time()
    matched, tkey, results = check_keyword(keyword, target)
    print(f"수집 {len(results)}건 / {time.time() - t0:.1f}초\n")
    for r in results:
        mark = "  <-- 내 URL" if matched and r.rank == matched.rank else ""
        print(f"  {r.rank:2d}. [{r.kind}] {r.title[:42]}{mark}")
    print()
    if matched:
        print(f"[결과] 내 URL = {matched.rank}위 ({matched.kind})")
    elif tkey:
        print("[결과] 통합검색에 없음 -> 순위 없음")
    else:
        print("(내 URL 미입력 또는 게시물 식별 실패)")
