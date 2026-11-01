# runs the api (wrangler/workerd) and the web (vite) together, same as `pnpm dev`
# workerd needs glibc, so no alpine
FROM node:22-bookworm-slim

# slim image has no CA certs and workerd refuses to start without them
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.9.1
ENV WRANGLER_SEND_METRICS=false

WORKDIR /app

# install first so code changes don't bust the deps layer.
# wrangler.jsonc is needed here because api's postinstall runs `wrangler types`
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/wrangler.jsonc api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173 8787

# both servers have to listen on 0.0.0.0, otherwise they're unreachable from outside the container
CMD ["pnpm", "exec", "concurrently", "-n", "api,web", "-c", "blue,magenta", \
  "cd api && pnpm exec wrangler d1 migrations apply DB --local && pnpm exec wrangler dev --ip 0.0.0.0 --port 8787", \
  "cd web && pnpm exec vite --host 0.0.0.0 --port 5173 --strictPort"]
