/*
 * Copyright 2022-2023 Chaos Meta Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package jvm

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/spf13/cobra"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/injector"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/log"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/utils"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/utils/cmdexec"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/utils/filesys"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/utils/namespace"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/utils/process"
)

func init() {
	injector.Register(TargetJVM, FaultMethodReplace, func() injector.IInjector { return &MethodReplaceInjector{} })
}

type MethodReplaceInjector struct {
	injector.BaseInjector
	Args    MethodReplaceArgs
	Runtime MethodReplaceRuntime
}

type MethodReplaceArgs struct {
	Pid    int    `json:"pid,omitempty"`
	Key    string `json:"key,omitempty"`
	Method string `json:"method"`
	Code   string `json:"code"`
}

type MethodReplaceRuntime struct {
	AttackPids []int `json:"attack_pids"`
}

func (i *MethodReplaceInjector) GetArgs() interface{} {
	return &i.Args
}

func (i *MethodReplaceInjector) GetRuntime() interface{} {
	return &i.Runtime
}

func (i *MethodReplaceInjector) SetOption(cmd *cobra.Command) {
	cmd.Flags().IntVarP(&i.Args.Pid, "pid", "p", 0, "target process's pid")
	cmd.Flags().StringVarP(&i.Args.Key, "key", "k", "", "the key used to grep to get target process, the effect is equivalent to \"ps -ef | grep [key]\". if \"pid\" provided, \"key\" will be ignored")
	cmd.Flags().StringVarP(&i.Args.Method, "method", "m", "", "target method of the process, format: org.example.Handler.getResponse(int), must in base64 format")
	cmd.Flags().StringVarP(&i.Args.Code, "code", "c", "", "method's code to replace, must in base64 format")
}

func (i *MethodReplaceInjector) Validator(ctx context.Context) error {
	if err := i.BaseInjector.Validator(ctx); err != nil {
		return err
	}

	_, err := process.GetPidListByPidOrKeyInContainer(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, i.Args.Pid, i.Args.Key)
	if err != nil {
		return fmt.Errorf("get target process's pid error: %s", err.Error())
	}

	if i.Args.Method == "" {
		return fmt.Errorf("\"method\" is empty")
	}

	_, err = base64.StdEncoding.DecodeString(i.Args.Method)
	if err != nil {
		return fmt.Errorf("\"method must in base64 format\"")
	}

	if i.Args.Code == "" {
		return fmt.Errorf("\"code\" is empty")
	}

	return nil
}

func (i *MethodReplaceInjector) getJVMPackagePath() string {
	if i.Info.ContainerRuntime == "" {
		return utils.GetToolPath(JVMPackage)
	} else {
		return fmt.Sprintf("%s/%s", ContainerJVMDir, JVMPackage)
	}
}

func (i *MethodReplaceInjector) Inject(ctx context.Context) error {
	var (
		pidList []int
		err     error
		logger  = log.GetLogger(ctx)
	)

	pidList, _ = process.GetPidListByPidOrKeyInContainer(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, i.Args.Pid, i.Args.Key)
	logger.Debugf("target pid list: %v", pidList)
	// save target
	i.Runtime.AttackPids = pidList

	dstDir := i.getJVMPackagePath()
	isExist, err := filesys.CheckDir(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, dstDir)
	if err != nil {
		return fmt.Errorf("check dir error: %s", err.Error())
	}

	if !isExist {
		if i.Info.ContainerRuntime != "" {
			src := fmt.Sprintf("%s.tar.gz", utils.GetToolPath(JVMPackage))
			dst := fmt.Sprintf("%s.tar.gz", dstDir)
			if err := cmdexec.CpContainerFile(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, src, dst); err != nil {
				return fmt.Errorf("cp jvm tool file[%s] to container[%s] [%s] error: %s", src, i.Info.ContainerId, dst, err.Error())
			}
		}

		tarCmd := fmt.Sprintf("tar vzxf %s.tar.gz -C %s", dstDir, filesys.GetDirName(dstDir))
		_, err := cmdexec.ExecCommonWithNS(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, tarCmd, []string{namespace.MNT})
		if err != nil {
			return fmt.Errorf("tar JVM tool error: %s", err.Error())
		}
	}

	methodByte, _ := base64.StdEncoding.DecodeString(i.Args.Method)
	faultParam := &MethodReplaceFaultParam{
		Method: string(methodByte),
		Code:   i.Args.Code,
	}

	paramByte, err := json.Marshal(faultParam)
	if err != nil {
		return fmt.Errorf("fault param is not a json: %s", err.Error())
	}

	var timeout int64
	if i.Info.Timeout != "" {
		timeout, _ = utils.GetTimeSecond(i.Info.Timeout)
	}

	for _, unitPid := range pidList {
		execCmd := fmt.Sprintf("%s/%s inject %d %s %s %s '%s' %d", dstDir, JVMExecutor, unitPid, i.Info.Uid, FaultTypeMethod, FaultActionMethodReplace, string(paramByte), timeout)
		_, err := cmdexec.ExecCommonWithNS(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, execCmd, []string{namespace.MNT, namespace.ENV, namespace.PID, namespace.IPC, namespace.UTS})
		if err != nil {
			i.Recover(ctx)
			return fmt.Errorf("exec for %d error: %s", unitPid, err.Error())
		}
	}

	return err
}

func (i *MethodReplaceInjector) Recover(ctx context.Context) error {
	if i.BaseInjector.Recover(ctx) == nil {
		return nil
	}

	logger := log.GetLogger(ctx)
	dstDir := i.getJVMPackagePath()
	pidList := i.Runtime.AttackPids
	// recover [pid] [injectId]
	for _, unitPid := range pidList {
		execCmd := fmt.Sprintf("%s/%s recover %d %s", dstDir, JVMExecutor, unitPid, i.Info.Uid)
		_, err := cmdexec.ExecCommonWithNS(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, execCmd, []string{namespace.MNT, namespace.ENV, namespace.PID, namespace.IPC, namespace.UTS})
		if err != nil {
			logger.Errorf("exec for %d error: %s", unitPid, err.Error())
		}
	}

	return nil
}
