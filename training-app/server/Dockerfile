FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY server/package.json server/tsconfig.json server/
COPY packages/contracts/package.json packages/contracts/tsconfig.json packages/contracts/
RUN pnpm install --frozen-lockfile
COPY server server
COPY packages packages
RUN pnpm --filter @training/contracts build && pnpm --filter @training/server build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/server/package.json ./package.json
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
