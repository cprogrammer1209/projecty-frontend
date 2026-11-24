# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npx ng build

FROM nginx:1.27-alpine
# nginx renders this template at start, filling in the two upstream variables below.
ENV PLATFORM_UPSTREAM=platform-service:8081 \
    WORK_UPSTREAM=work-service:8082
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
