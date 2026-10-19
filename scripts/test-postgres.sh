#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${ELECTORAL_TEST_DATABASE_URL:-}" ]]; then
  test_container="municipio-electoral-test-${RANDOM}-$$"
  trap 'docker rm -f "$test_container" >/dev/null 2>&1 || true' EXIT
  docker run --rm -d --name "$test_container" -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1::5432 postgres:17-alpine postgres -c log_statement=none -c log_min_error_statement=panic -c log_parameter_max_length=0 -c log_parameter_max_length_on_error=0 >/dev/null
  ready=false
  for attempt in $(seq 1 60); do
    if docker exec "$test_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
    sleep 0.25
  done
  if [[ "$ready" != true ]]; then echo 'PostgreSQL local no inició.' >&2; exit 1; fi
  docker exec "$test_container" createdb -U postgres municipio_electoral_test
  test_port="$(docker port "$test_container" 5432/tcp | sed 's/.*://')"
  export ELECTORAL_TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:${test_port}/municipio_electoral_test"
fi
node --import tsx --test --test-concurrency=1 tests/postgres/*.test.ts
