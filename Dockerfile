FROM node:20.16.0
WORKDIR /app
COPY pakcage*.json ./
RUN npm install
COPY . .

EXPOSE 5000
CMD ["node", "bot.js"]
