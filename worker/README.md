# 상위노출 추적 워커

웹앱(`viral-marketing-lab`)의 **상위노출 추적** 탭과 연동되는 크롤링 프로그램입니다.
이 PC에서 실행되며, 웹앱에서 "순위 갱신" 버튼이 눌리면 네이버 통합검색을 크롤링해
순위·제목을 채워 넣습니다.

```
웹앱(Vercel)  ──트리거──▶  GitHub 저장소  ◀──확인/기록──  이 워커(내 PC)
```

웹앱과 워커는 **GitHub 저장소를 공동 DB로** 사용해 동기화됩니다.
워커는 GitHub로 *나가서* 확인만 하므로, 이 PC에 고정 IP·포트개방이 필요 없습니다.

## 설치 (최초 1회)

1. **Python 3.10+** 설치 확인
   ```
   python --version
   ```

2. 이 `worker` 폴더에서 의존성 설치
   ```
   pip install -r requirements.txt
   python -m playwright install chromium
   ```

3. `.env.example` 을 복사해 **`.env`** 파일을 만들고 값을 채우기
   - `GITHUB_TOKEN` — 저장소 읽기/쓰기 권한이 있는 GitHub 토큰
     (Vercel 환경변수 `GITHUB_TOKEN` 과 같은 값 사용 가능)
   - `GITHUB_REPO` — `소유자아이디/viral-marketing-lab`

   > GitHub 토큰 발급: GitHub → Settings → Developer settings →
   > Personal access tokens → Fine-grained tokens → 해당 저장소의
   > **Contents: Read and write** 권한으로 생성

## 실행

- `run.bat` 더블클릭  (또는 터미널에서 `python worker.py`)
- 창이 떠 있는 동안 워커가 동작합니다. 창을 닫으면 멈춥니다.
- 워커가 켜져 있을 때만 웹앱의 "순위 갱신" 요청이 처리됩니다.
  꺼져 있으면 요청은 "크롤링 대기 중" 상태로 남아 있다가, 다음에 워커를
  켜면 그때 처리됩니다.

## 크롤러 단독 테스트

워커 없이 크롤러만 바로 확인할 수 있습니다.
```
python naver_rank.py 안티칼알파 https://blog.naver.com/아이디/글번호
```

## 동작 방식

- `worker.py` — GitHub 저장소의 `data/rank-tracker/*.json` 을 `POLL_SECONDS`(기본 30초)
  마다 확인. `job.status == "pending"` 인 파일을 찾으면 크롤링 실행.
- `naver_rank.py` — 네이버 모바일 통합검색을 열어 노출된 블로그/카페 게시물을
  등장 순서대로 수집(= 상위노출 순위). 같은 키워드는 한 번만 크롤링.
- 결과는 다시 GitHub 에 저장(`[skip ci]` 태그 → Vercel 재배포 안 함).

## 주의

- 네이버 크롤링은 요청이 많으면 IP 차단될 수 있습니다. 키워드 간 2초 간격을
  두고 있으며, 하루 수십 개 키워드 수준이면 일반적으로 문제없습니다.
- 크롤링 중에 웹앱에서 같은 사용자의 표를 편집·저장하면, 저장 충돌 시
  워커 결과가 우선 반영됩니다(편집 내용이 덮어써질 수 있음). 크롤링이
  끝난 뒤 편집하는 것을 권장합니다.
