# Single stage on purpose.
#
# The server is plain ESM JavaScript with no build step, and pnpm links each
# package's dependencies into that package's own node_modules as symlinks into
# the workspace root's .pnpm store. A multi-stage image that copies a subset of
# the tree across stages depends on those links surviving the copy, which is
# what broke before: the runtime stage received /app/node_modules but not
# /app/server/node_modules, so "Cannot find package 'express'".
#
# Installing and running in one stage keeps the workspace tree exactly as pnpm
# laid it out, so there is nothing to invalidate.
FROM node:24-alpine
WORKDIR /app
RUN corepack enable

# Dependency manifest first so the install layer caches independently of source.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY server/package.json server/
COPY packages/contracts/package.json packages/contracts/tsconfig.json packages/contracts/
RUN pnpm install --frozen-lockfile

COPY server server
COPY packages packages

# contracts ships type declarations, so it does need tsc. That is the only
# compile step in the image.
RUN pnpm --filter @training/contracts build

RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
EXPOSE 3000
USER node
CMD ["node", "server/src/index.js"]
