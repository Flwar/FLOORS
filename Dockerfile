# Floors game server + client in one container.
#   docker build -t floors .
#   docker run -p 2567:2567 -v floors-data:/data floors
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=2567 FLOORS_DB=/data/floors.db
VOLUME /data
EXPOSE 2567
CMD ["npm", "start"]
