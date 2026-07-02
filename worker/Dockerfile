FROM node:22-alpine

WORKDIR /app

COPY worker/package.json worker/
RUN cd worker && npm install

COPY prisma/ prisma/
COPY worker/ worker/
COPY lib-ai/ lib-ai/
COPY liveness-core.mjs liveness-browser.mjs check-liveness.mjs ./
COPY scan.mjs scan-ats-full.mjs ./
COPY generate-pdf.mjs generate-latex.mjs ./

RUN npx prisma generate

CMD ["node", "worker/index.mjs"]
