# Bun runs everything; Node is only here for vue-tsc, which cannot resolve .vue files on the Bun runtime.
FROM docker.io/library/node:24
COPY --from=docker.io/oven/bun:1.4.2 /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
