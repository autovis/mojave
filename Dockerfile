FROM node:6

EXPOSE 80
EXPOSE 443

RUN mkdir -p /app
WORKDIR /app

ADD ./package.json /app/package.json
RUN npm install
ADD . /app

CMD ["npm", "start"]
