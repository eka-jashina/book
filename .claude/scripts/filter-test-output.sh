#!/bin/bash
# filter-test-output.sh — фильтрация вывода тестов для экономии контекста Claude Code
# Оставляет только summary и упавшие тесты

INPUT=$(cat)

# Определяем тип вывода
if echo "$INPUT" | grep -q "FAIL\|PASS\|Test Files\|Tests.*passed"; then
  # Vitest output — показываем только failed тесты и summary
  echo "$INPUT" | awk '
    /FAIL/ { print; show=1; next }
    /^ *(✓|√|PASS)/ { show=0; next }
    /^ *(✗|×|FAIL|AssertionError|Error:|expected|received)/ { print; show=1; next }
    /^(Test Files|Tests |Duration|Snapshots)/ { print; next }
    /^ *❯/ { if (show) print; next }
    /^$/ { if (show) { print; show=0 }; next }
    { if (show) print }
  '
elif echo "$INPUT" | grep -q "passed\|failed\|Running"; then
  # Playwright output
  echo "$INPUT" | awk '
    /failed/ { print; next }
    /passed/ { print; next }
    /Error:/ { print; show=1; next }
    /─────/ { show=0; next }
    { if (show) print }
  '
else
  # Неизвестный формат — последние 25 строк
  echo "$INPUT" | tail -25
fi
