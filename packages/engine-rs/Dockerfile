FROM rust:1-slim-bookworm AS builder
WORKDIR /build
COPY . .
RUN cargo build --release -p mk-server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /build/target/release/mk-server /usr/local/bin/mk-server
ENV PORT=3030
EXPOSE 3030
CMD ["mk-server"]
