FROM denoland/deno:ubuntu-2.5.3

EXPOSE 8000

WORKDIR /app

COPY deno.json deno.json
COPY deno.lock deno.lock

RUN deno install --allow-import

COPY lib lib
COPY server server
COPY client_dist client_dist
COPY main.ts main.ts

RUN mkdir /app/databases

ENV IS_PRODUCTION=true
ENV ASSETS_DIR_PATH=/app/assets

CMD ["run", "-A", "main.ts"]
