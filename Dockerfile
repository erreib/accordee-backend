# Use an official Node runtime as the build image
FROM node:16 AS build-stage

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the current directory contents into the container
COPY . .

# Expose the web server port
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
