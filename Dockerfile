FROM node:alpine

WORKDIR /app

COPY package.json .
RUN yarn

COPY . .
RUN yarn build

FROM node:alpine  
WORKDIR /app/
COPY --from=0 /app/build /app/
COPY --from=0 /app/package.json /app/
COPY --from=0 /app/node_modules /app/
CMD ["node", "build/index.js"]
