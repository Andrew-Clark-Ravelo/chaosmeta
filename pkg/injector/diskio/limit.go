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

package diskio

import (
	"fmt"
	"github.com/ChaosMetaverse/chaosmetad/pkg/injector"
	"github.com/ChaosMetaverse/chaosmetad/pkg/log"
	"github.com/ChaosMetaverse/chaosmetad/pkg/utils"
	"github.com/spf13/cobra"
	"strings"
)

// TODO: It needs to be stated in the document that if the target process generates a child process, it will also be restricted, but it is impossible to determine which cgroup the child process should be put back when restoring, so put it back to "/user.slice"

func init() {
	injector.Register(TargetDiskIO, FaultDiskIOLimit, func() injector.IInjector { return &LimitInjector{} })
}

type LimitInjector struct {
	injector.BaseInjector
	Args    LimitArgs
	Runtime LimitRuntime
}

type LimitArgs struct {
	PidList    string `json:"pid_list"` // 需要校验是否存在
	Key        string `json:"key"`
	DevList    string `json:"dev_list"` // 需要校验是否存在
	ReadBytes  string `json:"read_bytes,omitempty"`
	WriteBytes string `json:"write_bytes,omitempty"`
	ReadIO     int64  `json:"read_io,omitempty"`
	WriteIO    int64  `json:"write_io,omitempty"`
}

type LimitRuntime struct {
	OldCgroupMap map[int]string
}

func (i *LimitInjector) GetArgs() interface{} {
	return &i.Args
}

func (i *LimitInjector) GetRuntime() interface{} {
	return &i.Runtime
}

func (i *LimitInjector) SetOption(cmd *cobra.Command) {
	// i.BaseInjector.SetOption(cmd)

	cmd.Flags().StringVarP(&i.Args.PidList, "pid-list", "p", "", "target process's pid, list split by \",\", eg: 9595,9696")
	cmd.Flags().StringVarP(&i.Args.Key, "key", "k", "", "the key used to grep to get target process, the effect is equivalent to \"ps -ef | grep [key]\". if \"pid-list\" provided, \"key\" will be ignored")
	cmd.Flags().StringVarP(&i.Args.DevList, "dev-list", "d", "", "target dev list, dev represent format: \"major-dev-num:minor-dev-num\",  use \"lsblk -a | grep disk\" to get dev num, eg:\"8:0,9:1\"\"")
	cmd.Flags().StringVar(&i.Args.ReadBytes, "read-bytes", "", "limit read bytes per second, must larger than 0, support unit: B/KB/MB/GB/TB（default B）")
	cmd.Flags().Int64Var(&i.Args.ReadIO, "read-io", 0, "limit read times per second, must larger than 0")
	cmd.Flags().StringVar(&i.Args.WriteBytes, "write-bytes", "", "limit write bytes per second, must larger than 0, support unit: B/KB/MB/GB/TB（default B）")
	cmd.Flags().Int64Var(&i.Args.WriteIO, "write-io", 0, "limit write times per second, must larger than 0")
}

func (i *LimitInjector) Validator() error {
	pidList, err := utils.GetPidListByListStrAndKey(i.Args.PidList, i.Args.Key)
	if err != nil {
		return fmt.Errorf("\"pid-list\" or \"key\" is invalid: %s", err.Error())
	}

	if err := utils.CheckPidListCgroup(pidList); err != nil {
		return fmt.Errorf("check cgroup of %v error: %s", pidList, err.Error())
	}

	i.Args.DevList = strings.TrimSpace(i.Args.DevList)
	if _, err := utils.GetDevList(i.Args.DevList); err != nil {
		return fmt.Errorf("\"dev-list\"[%s] is invalid: %s", i.Args.DevList, err.Error())
	}

	if i.Args.ReadBytes == "" && i.Args.WriteBytes == "" && i.Args.ReadIO <= 0 && i.Args.WriteIO <= 0 {
		return fmt.Errorf("must provide at least one valid args of: read-bytes、write-bytes、read-io、write-io")
	}

	if i.Args.ReadBytes != "" {
		if _, err := utils.GetBytes(i.Args.ReadBytes); err != nil {
			return fmt.Errorf("\"read-bytes\"[%s] is invalid: %s", i.Args.ReadBytes, err.Error())
		}
	}

	if i.Args.WriteBytes != "" {
		if _, err := utils.GetBytes(i.Args.WriteBytes); err != nil {
			return fmt.Errorf("\"write-bytes\"[%s] is invalid: %s", i.Args.WriteBytes, err.Error())
		}
	}

	return i.BaseInjector.Validator()
}

func (i *LimitInjector) Inject() error {
	logger := log.GetLogger()
	pidList, err := utils.GetPidListByListStrAndKey(i.Args.PidList, i.Args.Key)
	if err != nil {
		return err
	}

	i.Runtime.OldCgroupMap, err = utils.GetPidListCurCgroup(pidList)
	if err != nil {
		return fmt.Errorf("get old path error: %s", err.Error())
	}
	logger.Debugf("old cgroup path: %v", i.Runtime.OldCgroupMap)

	devList, _ := utils.GetDevList(i.Args.DevList)
	// 先new cgroup
	blkioPath := utils.GetBlkioCPath(i.Info.Uid)
	if err := utils.NewCgroup(blkioPath, utils.GetBlkioConfig(devList, i.Args.ReadBytes, i.Args.WriteBytes, i.Args.ReadIO, i.Args.WriteIO, blkioPath)); err != nil {
		return fmt.Errorf("create cgroup[%s] error: %s", utils.BlkioCgroupName, err.Error())
	}

	// 然后加进程
	if err := utils.MovePidListToCgroup(pidList, blkioPath); err != nil {
		// need to undo, use recover?
		if err := i.Recover(); err != nil {
			logger.Warnf("undo error: %s", err.Error())
		}

		return err
	}

	return nil
}

func (i *LimitInjector) Recover() error {
	if i.BaseInjector.Recover() == nil {
		return nil
	}
	logger := log.GetLogger()

	cgroupPath := utils.GetBlkioCPath(i.Info.Uid)
	isCgroupExist, err := utils.ExistPath(cgroupPath)
	if err != nil {
		return fmt.Errorf("check cgroup[%s] exist error: %s", cgroupPath, err.Error())
	}

	if !isCgroupExist {
		return nil
	}

	pidList, err := utils.GetPidStrListByCgroup(cgroupPath)
	if err != nil {
		return fmt.Errorf("fail to get pid from cgroup[%s]: %s", cgroupPath, err.Error())
	}

	for _, pid := range pidList {
		oldPath, ok := i.Runtime.OldCgroupMap[pid]
		// 目标进程产生的子进程可能会遇到这种情况
		if !ok {
			logger.Warnf("fail to get pid[%d]'s old cgroup path, move to \"%s\" instead", pid, TmpCgroup)
			oldPath = TmpCgroup
		}

		if err := utils.MoveToCgroup(pid, fmt.Sprintf("%s%s", utils.BlkioPath, oldPath)); err != nil {
			return fmt.Errorf("recover pid[%d] error: %s", pid, err.Error())
		}
	}

	if err := utils.RemoveCgroup(cgroupPath); err != nil {
		return fmt.Errorf("remove cgroup[%s] error: %s", cgroupPath, err.Error())
	}

	return nil
}
