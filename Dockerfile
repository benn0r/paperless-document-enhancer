FROM node:24-alpine

ENV NODE_ENV production

# Create and set the working directory inside the container
WORKDIR /usr/src/app

# Switch to a non-root user for running the application
USER node

# Copy all the application source files into the container
COPY . .
RUN npm ci

# Expose port 3000 for the application
EXPOSE 3000

# Define the command to run the application
CMD ["node", "index.js"]
