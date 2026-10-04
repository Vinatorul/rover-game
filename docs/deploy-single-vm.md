# Запуск на виртуалке

Для демо рядом с другим сайтом запусти игру по IP на отдельном порту. Приложение работает в одном Docker-контейнере: раздаёт сайт, принимает нажатия и сохраняет комнаты. Docker Compose и отдельный хостинг фронтенда не нужны.

IP и домены передаются скрипту при запуске. В файлы репозитория их записывать не нужно.

## Первый запуск по IP

Выполни команды на виртуалке с Ubuntu. Нужны Docker, Git и `curl`. Если Docker уже работает, оставь текущую установку. Если его нет, установи Docker Engine по [официальной инструкции для Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

Установи Git и `curl`, если их ещё нет:

```bash
sudo apt-get update
sudo apt-get install -y git curl
```

Клонируй проект и проверь Docker:

```bash
git clone https://github.com/Vinatorul/rover-game.git ~/rover-game
cd ~/rover-game
sudo docker info
```

Если проверка Docker завершилась с ошибкой, проверь причину:

```bash
sudo docker info --format '{{.ServerVersion}}'
sudo systemctl status docker --no-pager
```

Если установленная служба Docker остановлена (`inactive`), запусти её и повтори проверку:

```bash
sudo systemctl start docker
sudo docker info --format '{{.ServerVersion}}'
```

Если службы нет или она завершилась с ошибкой, сначала разберись с установкой или её журналом:

```bash
sudo journalctl -u docker -n 50 --no-pager
```

Если `docker info` работает без `sudo`, а с `sudo` — нет, проверь `docker context show` и `sudo docker context show`. Docker может быть настроен для твоего пользователя или другого адреса подключения. Этот скрипт запускается от `root`; для него нужен доступ к тому Docker, в котором будет работать игра. Подробнее о причинах — в [документации Docker](https://docs.docker.com/engine/daemon/troubleshoot/).

Если Docker сообщает `client version ... is too new. Maximum supported API version is ...`, клиент обращается к серверу с неподдерживаемой версией API. Для проверки передай поддерживаемую версию через `DOCKER_API_VERSION`. Например, для максимальной версии `1.43`:

```bash
sudo env DOCKER_API_VERSION=1.43 docker info --format '{{.ServerVersion}}'
```

Если проверка прошла, передай этот параметр и при деплое:

```bash
read -r -p 'Публичный IPv4 виртуалки: ' SERVER_IP
sudo env DOCKER_API_VERSION=1.43 ./scripts/update-vm.sh "$SERVER_IP" --port 8788
```

Подставь версию из ошибки своего сервера. Параметр действует только для запущенной команды и не меняет настройки службы Docker. Подробнее о согласовании версий — в [документации API Docker](https://docs.docker.com/reference/api/engine/).

Выбери свободный TCP-порт, например `8788`. Проверить, занят ли он:

```bash
sudo ss -ltnp 'sport = :8788'
```

Открой этот порт для участников в правилах облака: в группе безопасности или сетевом firewall добавь входящий TCP `8788`. Если на самой виртуалке настроен firewall, проверь, что он пропускает подключения к этому порту. Docker публикует порты через свои правила, поэтому при UFW учитывай [особенности Docker и firewall](https://docs.docker.com/engine/network/packet-filtering-firewalls/).

Введи публичный IPv4 виртуалки и запусти игру:

```bash
read -r -p 'Публичный IPv4 виртуалки: ' SERVER_IP
sudo ./scripts/update-vm.sh "$SERVER_IP" --port 8788
```

Скрипт собирает образ, сохраняет копию существующей базы, заменяет контейнер игры и проверяет `/health`. При первом запуске базы ещё нет, поэтому копировать нечего. Игра слушает `0.0.0.0:8788`; порты `80` и `443`, другие контейнеры и действующий reverse proxy остаются как были. Скрипт сам не обновляет исходники.

После запуска проверь доступ с другого компьютера. В его терминале снова введи адрес виртуалки:

```bash
read -r -p 'Публичный IPv4 виртуалки: ' SERVER_IP
curl -fsS "http://${SERVER_IP}:8788/health"
printf 'Экран ведущего: http://%s:8788/?view=host\n' "$SERVER_IP"
```

Открой адрес экрана ведущего из вывода. Создай комнату и открой экран трансляции на телевизоре. Участники сканируют QR на экране; ссылка будет содержать IP и порт, по которым ты открыл игру.

Если `8788` занят, выбери другой свободный порт от `1024` до `65535`. Подставь его в `--port`, правила firewall и адреса проверки. Режим `--port` работает по HTTP, в том числе если вместо IP передать домен. Для HTTPS используй вариант с поддоменом ниже.

## Обновление

В следующий раз обнови исходники и повтори запуск с тем же портом:

```bash
cd ~/rover-game
git pull --ff-only
read -r -p 'Публичный IPv4 виртуалки: ' SERVER_IP
sudo ./scripts/update-vm.sh "$SERVER_IP" --port 8788
```

Обновление ненадолго прерывает соединения; проводи его между гонками. После завершения снова проверь внешний `/health`.

Комнаты и результаты лежат в постоянном Docker-томе `rover-rally-data`. Скрипт сохраняет том при обновлении и перед заменой контейнера делает резервную копию базы в `/var/backups/rover-rally`. Доступ к копиям есть только у `root`. Если копирование завершится ошибкой, текущий контейнер останется запущен. Не удаляй том с базой и не запускай несколько экземпляров игры с одной базой.

Контейнер автоматически запускается после перезагрузки виртуалки. Для диагностики:

```bash
sudo docker logs --tail 100 rover-rally-app
curl -fsS http://127.0.0.1:8788/health
sudo docker ps --filter name=rover-rally
```

Успешная проверка на `127.0.0.1` подтверждает, что приложение работает на сервере. Доступность с телефонов проверяй по внешнему адресу.

## Поддомен и существующий Caddy

Если нужен HTTPS, направь A-запись выбранного поддомена на виртуалку. Запусти игру без `--port`:

```bash
cd ~/rover-game
read -r -p 'Домен игры без схемы и пути: ' DOMAIN
sudo ./scripts/update-vm.sh "$DOMAIN"
```

В этом режиме приложение доступно только самой виртуалке на `127.0.0.1:8788` и контейнерам в сети `rover-rally` на `rover-rally-app:8787`. Порт `8788` открывать в облаке не нужно. Порты `80` и `443` обслуживает твой действующий прокси.

Для Caddy, установленного прямо на виртуалке, добавь в существующий Caddyfile отдельный блок. Замени `rover.example.com` на введённый домен и сохрани блоки других сайтов:

```caddyfile
rover.example.com {
    reverse_proxy 127.0.0.1:8788
}
```

Если Caddy работает в Docker, узнай имя его контейнера через `sudo docker ps` и один раз подключи его к сети игры:

```bash
read -r -p 'Имя контейнера Caddy: ' PROXY_CONTAINER
sudo docker network connect rover-rally "$PROXY_CONTAINER"
```

В постоянный Caddyfile этого прокси добавь блок:

```caddyfile
rover.example.com {
    reverse_proxy rover-rally-app:8787
}
```

Замени домен, проверь конфигурацию и перезагрузи её обычным способом. Если внутри контейнера Caddyfile находится в `/etc/caddy/Caddyfile`:

```bash
sudo docker exec "$PROXY_CONTAINER" caddy validate --config /etc/caddy/Caddyfile
sudo docker exec "$PROXY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile
curl -fsS "https://${DOMAIN}/health"
```

Открой `https://<твой-домен>/?view=host`. Для последующих обновлений выполни `git pull --ff-only`, затем снова `sudo ./scripts/update-vm.sh "$DOMAIN"`.

Если скрипт другого сайта пересоздаёт Caddy или заново записывает его конфигурацию, сохрани оба сайта в его постоянной конфигурации и добавь подключение к сети `rover-rally` в процесс запуска. После пересоздания контейнера сеть нужно подключить снова. Скрипт этой игры существующий прокси не меняет.

## Игра по пути `/rover/` на существующем сайте

Игру можно открыть по адресу `https://example.com/rover/`, а основной сайт оставить на том же домене. Запусти или обнови контейнер игры, как в предыдущем разделе. Скрипту передай только домен, без `https://` и `/rover/`. Caddy должен быть подключён к сети `rover-rally`.

Добавь маршруты игры **в существующий блок этого домена**. Пример для сайта, который уже работает в контейнере `existing-site` на порту `80`:

```caddyfile
example.com {
    redir /rover /rover/?{query} 308

    handle_path /rover/* {
        reverse_proxy rover-rally-app:8787
    }

    handle {
        reverse_proxy existing-site:80
    }
}
```

Замени `example.com` на свой домен, а `existing-site:80` — на прежний адрес основного сайта. Его текущий `reverse_proxy` перенеси в `handle`, как в примере. Сохрани остальные настройки и блоки сайтов; второй блок с тем же доменом добавлять не нужно.

Переход с `/rover` на `/rover/` сохраняет параметры комнаты и экрана. Caddy убирает `/rover` перед передачей запроса игре, поэтому она продолжает работать и по отдельному домену. Ссылки и QR содержат тот адрес, по которому ты открыл игру. Подробнее о маршрутах — в [документации Caddy](https://caddyserver.com/docs/caddyfile/directives/handle_path).

Сначала сохрани резервную копию Caddyfile. Если он смонтирован в контейнер отдельным файлом, записывай изменения на месте: замена через `mv`, `sed -i` или редактор с атомарным сохранением может оставить контейнер со старым файлом. Например, подготовь полную новую конфигурацию в `/tmp/Caddyfile.updated`, затем запиши её в существующий файл:

```bash
read -r -p 'Путь к Caddyfile на виртуалке: ' CADDY_FILE
sudo cp -p "$CADDY_FILE" "${CADDY_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
sudo tee "$CADDY_FILE" < /tmp/Caddyfile.updated >/dev/null
```

Проверь и примени конфигурацию без перезапуска контейнера. Используй имя Caddy-контейнера из предыдущего раздела:

```bash
sudo docker exec "$PROXY_CONTAINER" caddy validate --config /etc/caddy/Caddyfile
sudo docker exec "$PROXY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile
curl -fsS "https://${DOMAIN}/rover/health"
```

После успешной проверки открой `https://<твой-домен>/rover/?view=host`. Если проверка конфигурации завершилась с ошибкой, сначала исправь её и только потом запускай `reload`. Сохрани эти маршруты и в скрипте деплоя основного сайта, если он перезаписывает Caddyfile.

## Отдельный Caddy на свободной виртуалке

Режим `--standalone` предназначен для виртуалки, где порты `80` и `443` свободны. Он запускает отдельный Caddy и занимает оба порта. Для виртуалки с уже работающим сайтом используй один из вариантов выше.

Направь A-запись домена на сервер и открой TCP `80` и `443` в правилах облака и firewall виртуалки. Запусти:

```bash
read -r -p 'Домен игры без схемы и пути: ' DOMAIN
sudo ./scripts/update-vm.sh "$DOMAIN" --standalone
sudo docker logs --tail 100 rover-rally-proxy
curl -fsS "https://${DOMAIN}/health"
```

Caddy получает и обновляет HTTPS-сертификат. Сертификаты сохраняются в Docker-томе `rover-rally-caddy-data`, конфигурация — в `/etc/rover-rally/Caddyfile`. Для обновления сначала выполни `git pull --ff-only`, затем повтори команду с `--standalone`.
