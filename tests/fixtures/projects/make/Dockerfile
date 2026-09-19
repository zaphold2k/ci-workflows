FROM alpine:3.20
RUN apk add --no-cache bash
WORKDIR /app
COPY src ./src
CMD ["bash", "src/app.sh"]
