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

package file

import (
	"context"
	"fmt"
	"github.com/spf13/cobra"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/injector"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/log"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/utils/filesys"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/utils/process"
)

func init() {
	injector.Register(TargetFile, FaultFileAppend, func() injector.IInjector { return &AppendInjector{} })
}

type AppendInjector struct {
	injector.BaseInjector
	Args    AppendArgs
	Runtime AppendRuntime
}

type AppendArgs struct {
	Path    string `json:"path"`
	Content string `json:"content,omitempty"`
	//Raw      bool   `json:"raw,omitempty"`
	Count    int `json:"count,omitempty"`
	Interval int `json:"interval,omitempty"`
}

type AppendRuntime struct {
}

func (i *AppendInjector) GetArgs() interface{} {
	return &i.Args
}

func (i *AppendInjector) GetRuntime() interface{} {
	return &i.Runtime
}

func (i *AppendInjector) SetDefault() {
	i.BaseInjector.SetDefault()

	if i.Args.Count == 0 {
		i.Args.Count = 1
	}
}

func (i *AppendInjector) SetOption(cmd *cobra.Command) {
	cmd.Flags().StringVarP(&i.Args.Path, "path", "p", "", "file path, include dir and file name")
	cmd.Flags().StringVarP(&i.Args.Content, "content", "c", "", "append content to the existed file")
	//cmd.Flags().BoolVarP(&i.Args.Raw, "raw", "r", false, "if raw content, raw content can not recover")
	cmd.Flags().IntVarP(&i.Args.Count, "count", "C", 1, "repeat times")
	cmd.Flags().IntVarP(&i.Args.Interval, "interval", "i", 0, "repeat interval, unit is second")
}

func (i *AppendInjector) Validator(ctx context.Context) error {
	if err := i.BaseInjector.Validator(ctx); err != nil {
		return err
	}

	if i.Args.Count <= 0 {
		return fmt.Errorf("\"count\" must larger than 0")
	}

	if i.Args.Interval < 0 {
		return fmt.Errorf("\"interval\" can not less than 0")
	}

	if i.Args.Path == "" {
		return fmt.Errorf("\"path\" can not be empty")
	}

	if !filesys.IfPathAbs(ctx, i.Args.Path) {
		return fmt.Errorf("\"path\" must provide absolute path")
	}

	if i.Args.Content == "" {
		return fmt.Errorf("\"content\" can not be empty")
	}

	fileExist, err := filesys.CheckFile(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, i.Args.Path)
	if err != nil {
		return fmt.Errorf("check exist file[%s] error: %s", i.Args.Path, err.Error())
	}

	if !fileExist {
		return fmt.Errorf("file[%s] is not exist", i.Args.Path)
	}

	if _, err := decodeBase64(i.Args.Content); err != nil {
		return fmt.Errorf("\"content is not a valid base64 format\"")
	}

	return nil
}

func (i *AppendInjector) Inject(ctx context.Context) error {
	logger := log.GetLogger(ctx)
	//flag := getAppendFlag(i.Info.Uid)

	//if !i.Args.Raw {
	//	//i.Args.Content = strings.ReplaceAll(i.Args.Content, "\\n", "\n")
	//	i.Args.Content = fmt.Sprintf("\n%s%s\n", strings.ReplaceAll(i.Args.Content, "\n", fmt.Sprintf("%s\n", flag)), flag)
	//}

	//i.Args.Content = fmt.Sprintf("\n%s", i.Args.Content)
	i.Args.Content, _ = decodeBase64(i.Args.Content)
	logger.Debugf("content is: %s", i.Args.Content)

	if err := filesys.AppendFile(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, i.Args.Path, i.Args.Content, getAppendFlag(i.Info.Uid), i.Args.Count, i.Args.Interval); err != nil {
		return fmt.Errorf("append content to %s error: %s", i.Args.Path, err.Error())
	}

	return nil
}

func (i *AppendInjector) Recover(ctx context.Context) error {
	if i.BaseInjector.Recover(ctx) == nil {
		return nil
	}

	if err := process.CheckExistAndSignalByKey(ctx, getAppendFlag(i.Info.Uid), process.SIGTERM); err != nil {
		return fmt.Errorf("kill append process with key[%s] error: %s", getAppendFlag(i.Info.Uid), err.Error())
	}

	//if i.Args.Raw {
	//	return nil
	//}
	//
	//exist, err := filesys.CheckFile(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, i.Args.Path)
	//if err != nil {
	//	return fmt.Errorf("check exist file[%s] error: %s", i.Args.Path, err.Error())
	//}
	//
	//if exist {
	//	return filesys.DeleteLineByKey(ctx, i.Info.ContainerRuntime, i.Info.ContainerId, i.Args.Path, getAppendFlag(i.Info.Uid))
	//}

	return nil
}
