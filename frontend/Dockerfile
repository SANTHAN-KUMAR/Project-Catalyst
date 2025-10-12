FROM s390x/node:20-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# Build the production bundle
RUN npm run build

# Install serve to host the static files
RUN npm install -g serve

EXPOSE 3005

# Serve the built app
CMD ["serve", "-s", "build", "-l", "3005"]
