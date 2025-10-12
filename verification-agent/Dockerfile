FROM s390x/node:20-alpine

WORKDIR /usr/src/app

# Copy shared library from the project root
COPY shared /usr/src/shared

# Copy package files
COPY verification-agent/package*.json ./

# Install dependencies
RUN npm install

# Copy agent code
COPY verification-agent/. .

EXPOSE 3001

CMD [ "node", "index.js" ]
