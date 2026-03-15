#!/bin/bash
# 워크트리 삭제 시 실행되는 정리 스크립트
# Superset의 .superset/config.json teardown 훅에서 호출됨

BOLD='\033[1m'
GREEN='\033[0;32m'
RESET='\033[0m'

echo -e "${BOLD}[워크트리 정리] hyunbell-blog${RESET}"

# ── 무거운 아티팩트 삭제 (총 ~375MB) ────────────────────────────────────────
targets=("node_modules" "dist" ".astro")

for target in "${targets[@]}"; do
  if [ -d "$target" ]; then
    size=$(du -sh "$target" 2>/dev/null | awk '{print $1}')
    rm -rf "$target"
    echo -e "${GREEN}✓ $target 삭제 ($size)${RESET}"
  fi
done

echo -e "\n${BOLD}정리 완료!${RESET}"
