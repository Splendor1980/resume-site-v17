#!/usr/bin/env bash
# Выгрузка статической сборки dist/ в Yandex Cloud Object Storage (S3-совместимый API).
#
# Зависимости: один из S3-клиентов — aws (AWS CLI v2) или s3cmd.
# Настройка — через переменные окружения (см. .env.example):
#   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, YC_BUCKET
# Загрузить .env:  set -a; source .env; set +a
set -euo pipefail

ENDPOINT="${S3_ENDPOINT:-https://storage.yandexcloud.net}"
DIST="${DIST_DIR:-../dist}"
BUCKET="${YC_BUCKET:?Задай YC_BUCKET (имя бакета)}"

if [ ! -d "$DIST" ]; then
  echo "Не найден каталог сборки: $DIST. Сначала выполни: npm run build" >&2
  exit 1
fi

# ключи файлов, которые НЕ должны попадать в CDN-кэш надолго
CACHE_NO_CACHE=( index.html sitemap-index.xml sitemap-0.xml robots.txt )

if command -v aws >/dev/null 2>&1; then
  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="ru-central1"
  aws --endpoint-url "$ENDPOINT" s3 sync "$DIST" "s3://$BUCKET/" --delete --exclude ".git/*"
  for f in "${CACHE_NO_CACHE[@]}"; do
    aws --endpoint-url "$ENDPOINT" s3 cp "$DIST/$f" "s3://$BUCKET/$f" \
      --cache-control "no-cache" || true
  done
elif command -v s3cmd >/dev/null 2>&1; then
  export S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY
  s3cmd --host="$ENDPOINT" --host-bucket="%(bucket)s.storage.yandexcloud.net" \
    sync --delete-excluded --no-mime-magic "$DIST"/ "s3://$BUCKET/"
else
  echo "Не найден aws CLI или s3cmd.
  Windows:  winget install Amazon.S3   (или https://aws.amazon.com/cli/)
  Linux:    sudo apt install awscli
  После установки: aws configure set aws_access_key_id \$S3_ACCESS_KEY_ID и т.д., либо выполни скрипт ещё раз.
  Документация Yandex: https://cloud.yandex.ru/docs/storage/tools/aws-cli" >&2
  exit 2
fi

echo "Готово: dist/ выгружена в бакет $BUCKET"