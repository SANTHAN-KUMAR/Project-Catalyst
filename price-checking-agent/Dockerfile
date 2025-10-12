FROM s390x/node:20-alpine

WORKDIR /usr/src/app

# Copy shared library first
COPY shared /usr/src/shared

# Copy package.json and package-lock.json
COPY price-checking-agent/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY price-checking-agent/. .

# Expose the port the app runs on
EXPOSE 3002

# The command to start the app
CMD [ "node", "index.js" ]
