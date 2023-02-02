FROM node:alpine

WORKDIR /app

COPY package.json .
RUN yarn ci

COPY . .
RUN yarn build

FROM node:alpine  
WORKDIR /app/
COPY --from=0 /app/build /app/build
COPY --from=0 /app/package.json /app/
COPY --from=0 /app/node_modules /app/node_modules
CMD ["node", "build/index.js"]
