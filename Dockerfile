FROM node:6-alpine

WORKDIR /mojave

RUN npm install

ENTRYPOINT ["npm", "start"]
