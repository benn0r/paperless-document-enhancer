FROM node:24-alpine

ENV NODE_ENV=production

WORKDIR /usr/src/app

USER root

COPY . .
RUN apk add g++ make py3-pip pkgconfig pixman-dev cairo-dev pango-dev && npm ci && chown -R node:node .
USER node

EXPOSE 3000

# Define the command to run the application
CMD ["node", "index.js"]
