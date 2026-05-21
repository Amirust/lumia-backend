FROM node:20.16.0 AS deps
WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm i

FROM deps AS builder
COPY . .
RUN npm run build

FROM builder AS runner
CMD ["node", "./dist/apps/core/main.js"]
