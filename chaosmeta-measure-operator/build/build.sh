#!/bin/bash

set -e

BASE_DIR=`cd $(dirname $0); pwd`
ROOT_PATH=${BASE_DIR}/..
echo "${ROOT_PATH}"
ns="chaosmeta-measure"

kubectl create configmap chaosmeta-measure-config --from-file="${ROOT_PATH}"/config/chaosmeta-measure.json -n ${ns}

BUILD_DIR="/tmp/chaosmeta_build"
mkdir -p ${BUILD_DIR}/data
mkdir -p ${BUILD_DIR}/ssl && cd ${BUILD_DIR}/ssl
docker run --mount type=bind,source=$(pwd),destination=${BUILD_DIR}/data registry.cn-hangzhou.aliyuncs.com/chaosmeta/chaosmeta-openssl:v1.0.0 openssl req -x509 -newkey rsa:4096 -keyout ${BUILD_DIR}/data/tls.key -out ${BUILD_DIR}/data/tls.crt -days 3650 -nodes -subj "/CN=chaosmeta-measure-webhook-service.${ns}.svc" -addext "subjectAltName=DNS:chaosmeta-measure-webhook-service.${ns}.svc"
caBundle=""
if [ "$(uname -s)" = "Linux" ]; then
    caBundle=$(cat tls.crt | base64 -w 0)
elif [ "$(uname -s)" = "Darwin" ]; then
    caBundle=$(base64 -i tls.crt -o - | tr -d '\n')
else
    echo "Unknown environment"
    exit 1
fi

kubectl create secret tls webhook-server-cert --cert=tls.crt --key=tls.key -n ${ns}
kubectl patch MutatingWebhookConfiguration chaosmeta-measure-mutating-webhook-configuration --type='json' -p='[{"op": "add", "path": "/webhooks/0/clientConfig/caBundle", "value": "'"${caBundle}"'"}]'
kubectl patch ValidatingWebhookConfiguration chaosmeta-measure-validating-webhook-configuration --type='json' -p='[{"op": "add", "path": "/webhooks/0/clientConfig/caBundle", "value": "'"${caBundle}"'"}]'
