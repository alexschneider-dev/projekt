FROM nginx:alpine

RUN rm /etc/nginx/conf.d/*

COPY ./default.conf /etc/nginx/conf.d/
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./fullchain.pem /etc/nginx/fullchain.pem
COPY ./privkey.pem /etc/nginx/privkey.pem

EXPOSE 80

CMD [ "nginx", "-g", "daemon off;" ]