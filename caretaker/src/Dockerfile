FROM amd64/alpine:3.8

WORKDIR /app

RUN addgroup -S databox && adduser -S -g databox databox && \
apk --no-cache add build-base pkgconfig nodejs npm libzmq zeromq-dev libsodium-dev python  && \
npm install zeromq@4.6.0 --zmq-external --verbose && \
apk del build-base pkgconfig libsodium-dev python zeromq-dev

ADD ./package.json package.json

# only if using git...
RUN apk --no-cache add git

RUN npm install --production

USER databox
ADD ./main.js main.js
ADD ./helpers.js helpers.js
ADD ./views views
ADD ./client.crt client.crt

LABEL databox.type="driver"

EXPOSE 8080

CMD ["npm","run","start-prod"]
