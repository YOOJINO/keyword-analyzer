# -*- coding: utf-8 -*-
"""
상위노출 추적 — 크롤링 워커

이 PC에서 백그라운드로 실행되며, GitHub 저장소(= 웹앱의 DB)를 주기적으로 확인한다.
웹앱에서 '순위 갱신' 버튼이 눌리면 해당 사용자 파일의 job.status 가 'pending' 이 되고,
이 워커가 그것을 발견해 네이버 통합검색 크롤링을 실행한 뒤 결과를 다시 저장한다.

  웹앱(Vercel)  ──트리거──>  GitHub 저장소  <──확인/기록──  이 워커(PC)

필요 환경변수 (.env 파일 또는 시스템 환경변수):
  GITHUB_TOKEN  - 저장소 읽기/쓰기 권한이 있는 GitHub 토큰
  GITHUB_REPO   - "소유자/저장소이름" (예: yujino/viral-marketing-lab)
선택:
  POLL_SECONDS  - 확인 주기(초), 기본 30
"""
import base64
import io
import json
import os
import sys
import time
import traceback
from datetime import datetime, timezone

# 한글 윈도우 콘솔(cp949)에서도 UTF-8 출력
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import requests
from playwright.sync_api import sync_playwright

from naver_rank import crawl_integrated, post_key, IPHONE_UA

GH_API = "https://api.github.com"
RANK_DIR = "data/rank-tracker"


# ---- .env 로더 (간단 파서) -------------------------------------------------
def load_dotenv():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


load_dotenv()

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GITHUB_REPO = os.environ.get("GITHUB_REPO", "").strip()
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "30") or "30")

if not GITHUB_TOKEN or not GITHUB_REPO or "/" not in GITHUB_REPO:
    print("[오류] GITHUB_TOKEN / GITHUB_REPO 환경변수를 설정해주세요. (.env 파일 참고)")
    sys.exit(1)

OWNER, REPO = GITHUB_REPO.split("/", 1)


# ---- GitHub API (웹앱의 _lib/github.js 와 동일한 패턴) --------------------
def gh_headers():
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def gh_list_dir(path):
    url = f"{GH_API}/repos/{OWNER}/{REPO}/contents/{path}"
    r = requests.get(url, headers=gh_headers(), timeout=20)
    if r.status_code == 404:
        return []
    r.raise_for_status()
    return r.json()


def gh_read_json(path):
    """(데이터, sha) 반환. 파일 없으면 (None, None)."""
    url = f"{GH_API}/repos/{OWNER}/{REPO}/contents/{path}"
    r = requests.get(url, headers=gh_headers(), timeout=20)
    if r.status_code == 404:
        return None, None
    r.raise_for_status()
    data = r.json()
    content = base64.b64decode(data["content"]).decode("utf-8")
    return json.loads(content), data["sha"]


def gh_write_json(path, obj, message, sha):
    """저장. [skip ci] 를 붙여 Vercel 재배포를 일으키지 않음. 새 sha 반환."""
    url = f"{GH_API}/repos/{OWNER}/{REPO}/contents/{path}"
    text = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    body = {
        "message": f"{message} [skip ci]",
        "content": base64.b64encode(text.encode("utf-8")).decode("ascii"),
    }
    if sha:
        body["sha"] = sha
    r = requests.put(url, headers=gh_headers(), json=body, timeout=20)
    r.raise_for_status()
    return r.json()["content"]["sha"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---- 작업 처리 -------------------------------------------------------------
def process_file(path, browser):
    """pending 상태의 사용자 파일 하나를 크롤링 처리한다."""
    state, sha = gh_read_json(path)
    if not state or (state.get("job") or {}).get("status") != "pending":
        return  # 그 사이 상태가 바뀜

    rows = state.get("rows", [])
    print(f"  작업 발견: {path}  (행 {len(rows)}개)")

    # running 으로 표시
    state["job"]["status"] = "running"
    state["job"]["startedAt"] = now_iso()
    state["job"]["message"] = "크롤링 중…"
    sha = gh_write_json(path, state, "Rank crawl: running", sha)

    # 같은 키워드는 한 번만 크롤링
    keywords = sorted({(r.get("keyword") or "").strip()
                       for r in rows if (r.get("keyword") or "").strip()})
    results_by_kw = {}

    ctx = browser.new_context(
        user_agent=IPHONE_UA, locale="ko-KR",
        viewport={"width": 390, "height": 844},
    )
    page = ctx.new_page()
    try:
        for kw in keywords:
            try:
                results_by_kw[kw] = crawl_integrated(page, kw, max_results=30)
                print(f"    '{kw}' -> {len(results_by_kw[kw])}건")
            except Exception as e:
                print(f"    '{kw}' 크롤링 실패: {e}")
                results_by_kw[kw] = []
            time.sleep(2)  # 키워드 간 간격 (차단 방지)
    finally:
        ctx.close()

    # 각 행을 결과와 대조해 순위 채우기
    checked = now_iso()
    for r in rows:
        kw = (r.get("keyword") or "").strip()
        url = (r.get("url") or "").strip()
        r["rank"], r["kind"], r["title"] = None, "", ""
        r["checkedAt"] = checked
        if not kw or not url:
            continue
        _, tkey = post_key(url)
        if not tkey:
            continue
        for res in results_by_kw.get(kw, []):
            if res.key == tkey:
                r["rank"], r["kind"], r["title"] = res.rank, res.kind, res.title
                break

    state["rows"] = rows
    state["job"] = {
        "status": "done",
        "requestedAt": state["job"].get("requestedAt"),
        "startedAt": state["job"].get("startedAt"),
        "finishedAt": now_iso(),
        "message": f"{len(keywords)}개 키워드 확인 완료",
    }

    # 저장 (그 사이 사용자가 편집해 sha 충돌나면 최신 sha로 재시도)
    for attempt in range(3):
        try:
            gh_write_json(path, state, "Rank crawl: done", sha)
            break
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 409 and attempt < 2:
                _, sha = gh_read_json(path)
                continue
            raise
    print(f"  완료: {path}")


def scan_once(browser):
    entries = gh_list_dir(RANK_DIR)
    pending = []
    for e in entries:
        if e.get("type") == "file" and str(e.get("name", "")).endswith(".json"):
            st, _ = gh_read_json(e["path"])
            if st and (st.get("job") or {}).get("status") == "pending":
                pending.append(e["path"])

    stamp = datetime.now().strftime("%H:%M:%S")
    if pending:
        print(f"[{stamp}] 대기 작업 {len(pending)}건")
        for path in pending:
            try:
                process_file(path, browser)
            except Exception as e:
                print(f"  처리 실패 ({path}): {e}")
                traceback.print_exc()
    else:
        print(f"[{stamp}] 대기 작업 없음")


def main():
    print("=" * 56)
    print(" 상위노출 추적 워커")
    print(f"  저장소   : {GITHUB_REPO}")
    print(f"  확인주기 : {POLL_SECONDS}초")
    print("  종료하려면 Ctrl + C")
    print("=" * 56)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            while True:
                try:
                    scan_once(browser)
                except Exception as e:
                    print(f"[오류] {e}")
                    traceback.print_exc()
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            print("\n워커를 종료합니다.")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
