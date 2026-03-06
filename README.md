# 부탁해 🙏

> 동네 부탁 마켓 - 누구나 부탁을 올리고, 누구나 해결하고 돈을 번다

## 스택

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (DB + Auth + Realtime)
- **결제**: 토스페이먼츠
- **지도**: 카카오맵 API
- **배포**: Vercel
- **PWA**: 모바일에서 앱처럼 동작

## 프로젝트 구조

```
butakae/
├── app/
│   ├── layout.tsx       # 루트 레이아웃 (PWA 메타)
│   ├── globals.css      # 전역 스타일
│   └── page.tsx         # 홈 (PC+모바일 반응형)
├── components/
│   ├── Sidebar.tsx      # PC 사이드바
│   ├── MobileTabBar.tsx # 모바일 하단 탭바
│   └── TaskCard.tsx     # 부탁 카드 (PC/모바일 variant)
├── lib/
│   └── data.ts          # 목업 데이터 + 유틸
├── types/
│   └── index.ts         # TypeScript 타입 정의
└── public/
    └── manifest.json    # PWA 매니페스트
```

## 시작하기

```bash
npm install
npm run dev
```

## Supabase 테이블 구조

```sql
-- tasks 테이블
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price integer not null,
  category text not null,
  location text not null,
  lat float,
  lng float,
  is_urgent boolean default false,
  status text default 'open',
  requester_id uuid references auth.users,
  helper_id uuid references auth.users,
  created_at timestamptz default now()
);

-- RLS 활성화
alter table tasks enable row level security;

-- 누구나 open 상태 부탁 조회 가능
create policy "open tasks visible" on tasks
  for select using (status = 'open');

-- 본인만 작성 가능
create policy "insert own task" on tasks
  for insert with check (auth.uid() = requester_id);
```

## 다음 단계

- [ ] Supabase Auth (카카오 소셜 로그인)
- [ ] tasks 테이블 연동
- [ ] 실시간 채팅 (Supabase Realtime)
- [ ] 위치 기반 필터 (카카오맵 API)
- [ ] 토스페이먼츠 결제 연동
- [ ] 리뷰/평점 시스템
- [ ] 푸시 알림 (FCM)
