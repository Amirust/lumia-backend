FROM rust:1-bookworm AS builder
WORKDIR /app

# Cache Cargo.toml and Cargo.lock to speed up builds, then build dummy src to cache dependencies.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
    && echo 'fn main() {}' > src/main.rs \
    && cargo build --release || true \
    && rm -rf src

COPY src ./src
RUN cargo build --release

RUN mkdir -p /libs \
    && (find / -name 'libonnxruntime*.so*' -exec cp -v {} /libs/ \; 2>/dev/null || true) \
    && touch /libs/.keep

# ---------- runtime ----------
FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libstdc++6 libgcc-s1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /libs/ /usr/local/lib/
RUN ldconfig
ENV LD_LIBRARY_PATH=/usr/local/lib

COPY --from=builder /app/target/release/ml /app/ml

ENTRYPOINT ["/app/ml"]
