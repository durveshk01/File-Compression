FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 SMARTCOMPRESS_DATA_DIR=/var/lib/smartcompress
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/* && useradd --create-home --uid 10001 app
WORKDIR /app
COPY requirements.lock .
RUN pip install --require-hashes --no-cache-dir -r requirements.lock
COPY apps ./apps
COPY services ./services
RUN mkdir -p /var/lib/smartcompress && chown -R app:app /var/lib/smartcompress
USER app
EXPOSE 8000
CMD ["sh", "-c", "exec python -m uvicorn services.compressor.api:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
