FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY client/package.json client/tsconfig.json client/vite.config.ts client/
COPY server/package.json server/tsconfig.json server/
COPY packages/contracts/package.json packages/contracts/tsconfig.json packages/contracts/
RUN pnpm install --frozen-lockfile
COPY client client
COPY server server
COPY packages packages
RUN pnpm --filter @training/contracts build && pnpm --filter @training/client build && pnpm --filter @training/server build

FROM nginx:1.27-alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
