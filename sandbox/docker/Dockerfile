FROM python:3.12-slim

RUN pip install --no-cache-dir pytest==8.3.4 \
    && useradd --create-home --uid 10001 sandbox

WORKDIR /work
USER sandbox
