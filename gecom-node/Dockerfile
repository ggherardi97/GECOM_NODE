FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the application code
COPY . .

EXPOSE 3100

CMD ["npm", "start"]
