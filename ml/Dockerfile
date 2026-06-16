# ---------- builder ----------
# Build on Ubuntu 24.04 (glibc 2.39 / GCC 13 libstdc++). The prebuilt ONNX
FROM ubuntu:24.04 AS builder
WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl ca-certificates build-essential pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust (edition 2024 needs a recent stable toolchain).
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

# Cache Cargo.toml and Cargo.lock to speed up builds, then build dummy src to cache dependencies.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
    && echo 'fn main() {}' > src/main.rs \
    && cargo build --release || true \
    && rm -rf src

# touch the real sources so their mtime is newer than the dummy build's
COPY src ./src
RUN find src -name '*.rs' -exec touch {} + \
    && cargo build --release

# ---------- runtime ----------
FROM ubuntu:24.04 AS runtime
WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libstdc++6 libgcc-s1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/ml /app/ml

ENTRYPOINT ["/app/ml"]
