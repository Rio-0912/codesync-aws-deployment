# Backend instructions to run Next.js and Serve
FROM node:18-bullseye

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD npx prisma db push && pnpm start
