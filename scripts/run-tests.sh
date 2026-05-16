#!/bin/sh
set -e

export USE_MOCK_DB=1

set -f
for var in $(printenv | cut -d= -f1); do
  case "$var" in
    npm_*)
      unset "$var"
      ;;
  esac
done
set +f

node --test --test-concurrency=1 test/account-input.test.mjs
node --test --test-concurrency=1 test/accounts.test.mjs
node --test --test-concurrency=1 test/api-client.test.mjs
node --test --test-concurrency=1 test/api-handler.test.mjs
node --test --test-concurrency=1 test/app-shell-source.test.mjs
node --test --test-concurrency=1 test/cashflow.test.mjs
node --test --test-concurrency=1 test/dashboard-query.test.mjs
node --test --test-concurrency=1 test/date-range.test.mjs
node --test --test-concurrency=1 test/db-utils.test.mjs
node --test --test-concurrency=1 test/dev-all.test.mjs
node --test --test-concurrency=1 test/greeting.test.mjs
node --test --test-concurrency=1 test/merchant-history.test.mjs
node --test --test-concurrency=1 test/net-worth.test.mjs
node --test --test-concurrency=1 test/repo-policy.test.mjs
node --test --test-concurrency=1 test/transaction-date.test.mjs
