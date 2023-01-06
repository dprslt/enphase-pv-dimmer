FROM node:alpine

WORKDIR /APP

COPY package.json .
RUN yarn

COPY . /app
RUN yarn build

FROM node:alpine  
WORKDIR /app/
COPY --from=0 /app/build /app/
COPY --from=0 /app/package.json /app/
COPY --from=0 /app/node_modules /app/
CMD ["node", "build/index.js"]
