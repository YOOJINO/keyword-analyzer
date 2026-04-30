# 바이럴 마케팅 연구소

네이버 검색광고 API 기반 키워드 검색량 분석 도구

## 파일 구조
```
keyword-analyzer/
├── api/
│   └── keywords.js     ← 서버 API (네이버 API 호출)
├── public/
│   └── index.html      ← 프론트엔드 UI
├── vercel.json         ← Vercel 설정
└── package.json
```

## Vercel 배포 방법

1. GitHub에 이 폴더 전체 업로드
2. vercel.com → New Project → GitHub 연결
3. Environment Variables 에 아래 3개 추가:
   - NAVER_ACCESS_LICENSE = (액세스 라이선스)
   - NAVER_SECRET_KEY = (비밀키)
   - NAVER_CUSTOMER_ID = (고객ID)
4. Deploy 클릭
