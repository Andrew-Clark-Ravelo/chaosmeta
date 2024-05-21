package middlewareexecutor

import (
	"context"
	"fmt"
	"github.com/traas-stack/chaosmeta/chaosmeta-inject-operator/api/v1alpha1"
	"github.com/traas-stack/chaosmeta/chaosmeta-inject-operator/pkg/executor/remoteexecutor/middlewareexecutor/common"
	"github.com/traas-stack/chaosmeta/chaosmeta-inject-operator/pkg/model"
	"os"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"strings"
)

const (
	Os                = "linux"
	Arch              = "amd64"
	ChaosmetadVersion = "0.5.1"
)

type Middleware interface {
	// 脚本执行： host: 集群ip,  cmd：下发的shell指令， userKey: 用户id, sync： 同步或者异步
	ExecCmdTask(ctx context.Context, host string, cmd string) common.TaskResult
	// 任务状态查询：taskId 任务id, userKey: 用户id
	QueryTaskStatus(ctx context.Context, taskId string, userKey string) common.TaskResult
}

type MiddleWareExecutor struct {
	Middleware  Middleware
	userKey     string
	InstallPath string
}

func (r *MiddleWareExecutor) CheckExecutorWay(ctx context.Context) error {
	// 对本机执行一次查询
	logger := log.FromContext(ctx)
	checkCmd := "ls"
	host := os.Getenv("LOCAL_IP")
	logger.Info("hostip", "ip: ", host)
	res := r.Middleware.ExecCmdTask(ctx, host, checkCmd)
	logger.Info("CheckExecutorWay", "res", res)
	if !res.Success {
		return fmt.Errorf(res.Message)
	}
	return nil
}

func (r *MiddleWareExecutor) CheckAlive(ctx context.Context, injectObject string) error {
	checkCmd := "todo"
	res := r.Middleware.ExecCmdTask(ctx, "", checkCmd)
	if !res.Success {
		return fmt.Errorf(res.Message)
	}
	return nil
}

func (r *MiddleWareExecutor) Init(ctx context.Context, target string) error {
	localIp := os.Getenv("LOCAL_IP")
	installCmd := fmt.Sprintf("curl -o /tmp/chaosmetad-%s.tar.gz http://%s:8090/download/chaosmetad && tar -xvf /tmp/chaosmetad-%s.tar.gz -C /tmp", ChaosmetadVersion, localIp, ChaosmetadVersion)
	r.Middleware.ExecCmdTask(ctx, target, installCmd)
	return nil
}

func (r *MiddleWareExecutor) Inject(ctx context.Context, injectObject string, target, fault, uid, timeout, cID, cRuntime string, args []v1alpha1.ArgsUnit) error {
	// download chaosmetad to target object
	err := r.Init(ctx, injectObject)
	if err != nil {
		return err
	}
	// start inject
	injectCmd := fmt.Sprintf("/tmp/chaosmetad-%s/chaosmetad inject %s %s", ChaosmetadVersion, target, fault)
	for _, unitArgs := range args {
		if unitArgs.Key == v1alpha1.ContainerKey {
			continue
		}
		unitArgs.Key = strings.ReplaceAll(unitArgs.Key, "_", "-")
		injectCmd = fmt.Sprintf("%s --%s=%s", injectCmd, unitArgs.Key, unitArgs.Value)
	}

	r.Middleware.ExecCmdTask(ctx, injectObject, injectCmd)
	return nil
}

func (r *MiddleWareExecutor) Recover(ctx context.Context, injectObject string, uid string) error {
	recoverCmd := fmt.Sprintf("")
	r.Middleware.ExecCmdTask(ctx, injectObject, recoverCmd)
	return nil
}

func (r *MiddleWareExecutor) Query(ctx context.Context, injectObject string, uid string, phase v1alpha1.PhaseType) (*model.SubExpInfo, error) {
	r.Middleware.QueryTaskStatus(ctx, "", r.userKey)
	return nil, nil
}
