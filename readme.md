## Running with Docker

To run this project using Docker, use the following command:

```sh
docker build -t node-storage .
docker run -p 3000:3000 --name node-storage node-storage
```

## Run local

```sh
RUN npm install
RUN npx tsc
```

## Uploading an Image

To upload an image, send a `POST` request to the `/upload` endpoint with the image file attached as form data. 

To download an image, send a `GET` request to the `/upload/:filename` endpoint, replacing `:filename` with the actual filename you want to download.

If you want the file to be downloaded as an attachment, add the query parameter `download=true`.







