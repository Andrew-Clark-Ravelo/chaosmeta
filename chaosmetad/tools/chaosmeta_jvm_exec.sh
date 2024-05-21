#!/bin/bash

usage() {
  cat <<EOF
Usage:
    $0 inject  [pid] [injectId] [faultType] [faultAction] [faultParam] [duration_second]
    $0 recover [pid] [injectId]
    $0 query   [pid] [injectId]
EOF
  exit 1
}

BASE_DIR=`cd $(dirname $0); pwd`
#echo "BASE_DIR: ${BASE_DIR}"
SHELL_FILE=$0
RANGER_CLIENT="${BASE_DIR}"/ranger.sh
MODULE_DIR="${BASE_DIR}"/module
MODULE_NAME="chaosmeta-jvm"
INTERVAL=1
TIMEOUT=5

# 日志文件
LOG_DIR="/tmp/logs/chaosmeta-jvm"
DEFAULT_LOG="${LOG_DIR}/chaosmeta-jvm-default.log"
ERROR_LOG="${LOG_DIR}/common-error.log"
PROCESS_KEY="$(date +%s)""${RANDOM}"
#echo "request key: ${PROCESS_KEY}"
LOG_RESULT=""

mkdir -p ${LOG_DIR}
chmod 777 /tmp/logs
chmod 777 ${LOG_DIR}
touch ${DEFAULT_LOG}
touch ${ERROR_LOG}
chmod 666 ${DEFAULT_LOG}
chmod 666 ${ERROR_LOG}

inject_jvm() {
  pid=$1
  inject_id=$2
  fault_type=$3
  fault_action=$4
  fault_param=$5
  duration_second=$6

  if [ -z "${duration_second}" ]; then
    duration_second=0
  fi

  if [ "$duration_second" -eq "$duration_second" ] 2>/dev/null; then
      echo "duration: ${duration_second}s"
  else
      echo "duration_second is not a number: ${duration_second}"
      exit 1
  fi

  if [ -z "${pid}" ]; then
    echo "pid is empty"
    exit 1
  fi

  sh "${RANGER_CLIENT}" healthy -p "${pid}"
  exec_status=$?
  if [ $exec_status -ne 0 ]; then
    target_user=$(ps -o user= -p "${pid}")
    echo "attach ranger in user: ${target_user}"
    su "${target_user}" sh -c "${RANGER_CLIENT} attach -p ${pid}"
    exec_status=$?
    if [ $exec_status -ne 0 ]; then
      echo "attach ranger failed"
      exit 1
    fi
  fi

  if [ $(sh "${RANGER_CLIENT}" module -p "${pid}" | grep "${MODULE_NAME}" | wc -l) -eq 0 ]; then
    module_jar_name=$(ls "${MODULE_DIR}" | grep "${MODULE_NAME}" | head -n 1)
    echo "load module: ${module_jar_name}"
    if [ -z "${module_jar_name}" ]; then
      echo "target module jar is not found"
      common_undo "${pid}"
      exit 1
    fi

    module_jar_name="${MODULE_DIR}/${module_jar_name}"
    if [ $(sh "${RANGER_CLIENT}" getConfig -p "${pid}" ranger:global | grep 'unsafe=true' | wc -l) -eq 0 ]; then
      echo "open unsafe mode"
      sh "${RANGER_CLIENT}" setConfig -p "${pid}" '{"configId":"ranger:global","content":"unsafe=true"}'
      exec_status=$?
      if [ $exec_status -ne 0 ]; then
        echo "open unsafe mode failed"
        common_undo "${pid}"
        exit 1
      fi
    fi

    sh "${RANGER_CLIENT}" load -p "${pid}" "${module_jar_name}"
    exec_status=$?
    if [ $exec_status -ne 0 ]; then
      echo "load module error"
      common_undo "${pid}"
      exit 1
    fi
  fi

  fault_param="${fault_param//\"/\\\"}"
  sh "${RANGER_CLIENT}" setConfig -p "${pid}" '{"configId":"chaosmeta-jvm:cmd","content":"{\"injectId\":\"'"${inject_id}"'\",\"requestKey\":\"'"${PROCESS_KEY}"'\",\"operator\":\"inject\",\"task\":{\"faultInfo\":{\"faultType\":\"'"${fault_type}"'\",\"faultAction\":\"'"${fault_action}"'\",\"faultParam\":'"${fault_param}"'},\"condition\":{\"duration\":'"${duration_second}"'}}}"}'
  exec_status=$?
  if [ $exec_status -ne 0 ]; then
    echo "set inject config error"
    common_undo "${pid}"
    exit 1
  fi

  get_log
  exec_status=$?
  if [ $exec_status -ne 0 ]; then
    echo "inject error"
    common_undo "${pid}"
    exit 1
  fi
  exit $exec_status
}

recover_jvm() {
  pid=$1
  inject_id=$2
  common_check $pid $inject_id

  sh "${RANGER_CLIENT}" setConfig -p "${pid}" '{"configId":"chaosmeta-jvm:cmd","content":"{\"injectId\":\"'"${inject_id}"'\",\"requestKey\":\"'"${PROCESS_KEY}"'\",\"operator\":\"recover\"}"}'
  exec_status=$?
  if [ $exec_status -ne 0 ]; then
    echo "set recover config error"
    exit 1
  fi

  get_log
  exec_status=$?
  if [ $exec_status -ne 0 ]; then
    echo "get log error"
    exit 1
  fi

  common_undo "${pid}"
}

#sh ranger.sh setConfig '{"configId":"chaosmeta-jvm:cmd","content":"{\"injectId\":\"awatch-framework_20240126171956_rtdhps9s\",\"operator\":\"query\"}"}'
#sh ranger.sh setConfig '{"configId":"chaosmeta-jvm:cmd","content":"{\"injectId\":\"all\",\"operator\":\"query\"}"}'
query_jvm() {
  pid=$1
  inject_id=$2
  common_check $pid $inject_id
  sh "${RANGER_CLIENT}" setConfig -p "${pid}" '{"configId":"chaosmeta-jvm:cmd","content":"{\"injectId\":\"'"${inject_id}"'\",\"requestKey\":\"'"${PROCESS_KEY}"'\",\"operator\":\"query\"}"}'
  exec_status=$?
  if [ $exec_status -ne 0 ]; then
    echo "set query config error"
    exit 1
  fi

  get_log
  exit $?
}

get_log() {
  log_key="RESULT-${PROCESS_KEY}"
  start_time=$(date +%s)
  while true; do
    result=$(tac ${DEFAULT_LOG} | grep "${log_key}" | head -n 1)
    if [ "${result}" ]; then
        LOG_RESULT="${result}"
        break
    else
        echo "result is empty"
    fi

    sleep "${INTERVAL}s"
    current_time=$(date +%s)
    duration=$((current_time - start_time))
    if [ "$duration" -ge "${TIMEOUT}" ]; then
      echo "exec timeout"
      return 1
    fi
  done
#  echo "LOG_RESULT: @${LOG_RESULT}@"
  IFS="]" read -r -a array <<< "${LOG_RESULT}"
  msg="${array[1]}"

  if [[ "$LOG_RESULT" == *"ERROR"* ]]; then
      echo "[error]${msg}"
      return 1
  else
      echo "[success]${msg}"
      return 0
  fi
}

common_undo() {
  pid=$1
  if [ $(sh "${RANGER_CLIENT}" module -p "${pid}" | grep "${MODULE_NAME}" | wc -l) -gt 0 ]; then
    task=$(sh ${SHELL_FILE} query ${pid} all | grep '[success]')
    if [ -z "${task}" ]; then
      echo "task is empty"
      return
    fi
    echo "task: ${task}"

    if [ $(echo "$task" | grep CREATED | wc -l) -gt 0 ]; then
      echo "has CREATED task"
      return
    fi

    if [ $(echo "$task" | grep SUCCESS | wc -l) -gt 0 ]; then
      echo "has SUCCESS task"
      return
    fi

    echo "start to unload module"
    sh "${RANGER_CLIENT}" unload -p "${pid}" ${MODULE_NAME}
    exec_status=$?
    if [ $exec_status -ne 0 ]; then
      echo "unload module error"
      exit 1
    fi
  fi

  if [ $(sh "${RANGER_CLIENT}" module -p "${pid}" | grep UP | grep -v ranger | wc -l) -gt 0 ]; then
    echo "has other running module"
    return
  fi

  sleep 1s
  target_user=$(ps -o user= -p "${pid}")
  echo "start to unattach ranger in user: ${target_user}"
  su "${target_user}" sh -c "${RANGER_CLIENT} unattach -p ${pid}"
  exec_status=$?
  if [ $exec_status -ne 0 ]; then
    echo "unattach ranger error"
    exit 1
  fi
}

common_check() {
  pid=$1
  inject_id=$2
  if [ -z "${pid}" ]; then
    echo "pid is empty"
    exit 1
  fi
  if [ -z "${inject_id}" ]; then
    echo "inject_id is empty"
    exit 1
  fi

  sh "${RANGER_CLIENT}" healthy -p "${pid}"
  exec_status=$?
  if [ $exec_status -ne 0 ]; then
    echo "no ranger"
    exit 0
  fi
  if [ $(sh "${RANGER_CLIENT}" module -p "${pid}" | grep "${MODULE_NAME}" | wc -l) -eq 0 ]; then
    echo "no target module"
    exit 0
  fi
}

############
# main begin
############

case $1 in
inject)
  inject_jvm $2 $3 $4 $5 $6 $7
  ;;
recover)
  recover_jvm $2 $3
  ;;
query)
  query_jvm $2 $3
  ;;
*)
  usage
  ;;
esac