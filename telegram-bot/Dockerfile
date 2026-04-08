FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py .

ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_CHAT_ID=""
ENV SOLFOUNDRY_API_URL="https://solfoundry.org/api"
ENV POLL_INTERVAL_SECS=60
ENV LOG_LEVEL=INFO

CMD ["python", "bot.py"]
