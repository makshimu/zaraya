FROM node:22-alpine AS admin
WORKDIR /src/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY shared/ /src/shared/
COPY admin/ ./
RUN npm run build

FROM node:22-alpine AS guest
WORKDIR /src/guest
COPY guest/package.json guest/package-lock.json ./
RUN npm ci
COPY shared/ /src/shared/
COPY guest/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=guest /src/guest/dist /usr/share/nginx/html
COPY --from=admin /src/admin/dist /usr/share/nginx/html/admin
