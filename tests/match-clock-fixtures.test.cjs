/* The presentation clock on whole matches, second half of CLOCK_FIXTURES (see tests/support/clock-fixtures.cjs
   and match-clock.test.cjs). A separate file so it runs alongside the first half. */
require('./support/clock-fixtures.cjs').clockFixtureTests(1);
