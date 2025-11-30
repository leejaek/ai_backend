FROM node:18-alpine

ENV NODE_OPTIONS=--experimental-global-webcrypto

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]