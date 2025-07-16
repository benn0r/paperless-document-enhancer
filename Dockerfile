FROM node:24-alpine

ENV NODE_ENV production

# Create and set the working directory inside the container
WORKDIR /usr/src/app

# Install dependencies by leveraging Docker's caching
# Use bind mounts to package.json and package-lock.json for faster builds
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Switch to a non-root user for running the application
USER node

# Copy all the application source files into the container
COPY . .

# Expose port 3000 for the application
EXPOSE 3000

# Define the command to run the application
CMD ["node", "index.js"]
