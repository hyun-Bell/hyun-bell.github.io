#!/bin/bash
# 워크트리 생성 시 실행되는 셋업 스크립트
# Superset의 .superset/config.json setup 훅에서 호출됨

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

echo -e "${BOLD}[워크트리 셋업] hyunbell-blog${RESET}"

# ── 1. .env 파일 처리 ───────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  # 메인 워크트리(원본 저장소) 경로 찾기
  MAIN_WORKTREE=$(git worktree list --porcelain | grep "^worktree" | head -1 | awk '{print $2}')

  if [ -f "$MAIN_WORKTREE/.env" ]; then
    cp "$MAIN_WORKTREE/.env" .env
    echo -e "${GREEN}✓ .env 복사 완료 (from: $MAIN_WORKTREE)${RESET}"
  else
    echo -e "${YELLOW}⚠  .env 파일이 없습니다.${RESET}"
    echo "   다음 환경변수를 .env에 설정해주세요:"
    echo "   NOTION_API_KEY=..."
    echo "   NOTION_DATABASE_ID=..."
  fi
else
  echo -e "${GREEN}✓ .env 확인됨${RESET}"
fi

# ── 2. 의존성 설치 ──────────────────────────────────────────────────────────
echo "→ pnpm install..."
pnpm install --frozen-lockfile
echo -e "${GREEN}✓ 의존성 설치 완료${RESET}"

echo -e "\n${BOLD}셋업 완료!${RESET} 개발 서버: pnpm dev"
