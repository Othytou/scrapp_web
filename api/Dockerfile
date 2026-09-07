FROM python:3.13-slim

WORKDIR /app

COPY ./api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

RUN apt-get update && apt-get install -y \
	libpango-1.0-0 \
	libpangoft2-1.0-0 \
	libgdk-pixbuf-xlib-2.0-0 \
	libffi-dev \
	&& rm -rf /var/lib/apt/lists/*

COPY api/ .
# COPY template/ ./template/

CMD ["bash", "-c", "./init_db.sh && uvicorn main:app --host 0.0.0.0 --port 9000 --reload"]