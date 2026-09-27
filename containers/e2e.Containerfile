# Playwright's test runner needs Node (it does not support Bun as its runtime); everything else uses Bun.
FROM mcr.microsoft.com/playwright:v1.63.0-noble
COPY --from=docker.io/oven/bun:1.4.2 /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
