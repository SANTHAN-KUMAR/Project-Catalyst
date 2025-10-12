# Use an official Node.js image for the s390x architecture
FROM s390x/node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# The command to start the app
CMD [ "node", "index.js" ]
