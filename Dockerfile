FROM node
WORKDIR /app
ARG CACHEBUST=1222332
RUN git clone https://github.com/potchara-msu/node-storage.git .
COPY . .
RUN npm install
RUN npx tsc
EXPOSE 3000
CMD ["node", "dist/server.js"]