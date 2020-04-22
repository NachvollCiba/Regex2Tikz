FROM richarvey/nginx-php-fpm:1.9.0

WORKDIR /var/www

RUN apk add --update yarn

COPY . /var/www/
RUN yarn install && yarn build

