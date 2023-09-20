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

package filesys

import (
	"context"
	"fmt"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/utils/cmdexec"
	"github.com/traas-stack/chaosmeta/chaosmetad/pkg/utils/namespace"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func MkdirP(ctx context.Context, path string) error {
	return cmdexec.RunBashCmdWithoutOutput(ctx, fmt.Sprintf("mkdir -p %s", path))
}

func MkdirPInContainer(ctx context.Context, cr, cId, path string) error {
	_, err := cmdexec.ExecContainerRaw(ctx, cr, cId, fmt.Sprintf("mkdir -p %s", path))
	return err
}

func RemoveFileInContainer(ctx context.Context, cr, cId, file string) error {
	if file == "" || file == "/" || strings.Index(file, "*") >= 0 {
		return fmt.Errorf("delete file[%s] not allowed", file)
	}

	_, err := cmdexec.ExecContainerRaw(ctx, cr, cId, fmt.Sprintf("rm %s", file))
	return err
}

func Chmod(ctx context.Context, path, perm string) error {
	return cmdexec.RunBashCmdWithoutOutput(ctx, fmt.Sprintf("chmod %s %s", perm, path))
}

func GetPerm(ctx context.Context, cr, cId string, path string) (perm string, err error) {
	cmd := "stat -c '%a' " + path
	if cr == "" {
		perm, err = cmdexec.RunBashCmdWithOutput(ctx, cmd)
	} else {
		perm, err = cmdexec.ExecContainer(ctx, cr, cId, []string{namespace.MNT}, cmd, cmdexec.ExecRun)
	}
	return strings.TrimSpace(perm), err
}

func GetPermission(path string) (string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("get stat of path[%s] error: %s", path, err.Error())
	}

	return fmt.Sprintf("%o", info.Mode().Perm()), nil
}

func CheckDir(dir string) error {
	f, err := os.Stat(dir)
	if err != nil {
		return fmt.Errorf("get file error: %s", err.Error())
	}

	if !f.IsDir() {
		return fmt.Errorf("is not a dir")
	}

	return nil
}

// ExistPath Whether it is a file or a directory, as long as it exists
func ExistPath(file string) (bool, error) {
	_, err := os.Stat(file)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}

		return false, err
	}

	return true, nil
}

// ExistFile Must be a file
func ExistFile(path string) (bool, error) {
	f, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}

		return false, err
	}

	if f.IsDir() {
		return false, nil
	}

	return true, nil
}

func GetAbsPath(path string) (string, error) {
	return filepath.Abs(path)
}

func CheckPermission(permission string) error {
	if len(permission) != 3 {
		return fmt.Errorf("len is not equal 3")
	}

	for _, unit := range permission {
		if unit < '0' || unit > '7' {
			return fmt.Errorf("num is not all in [0,7]")
		}
	}

	return nil
}

func HasFileLineByKey(ctx context.Context, key string, file string) (bool, error) {
	re, err := cmdexec.RunBashCmdWithOutput(ctx, fmt.Sprintf("grep \"%s\" %s | wc -l", key, file))
	if err != nil {
		return false, err
	}

	return strings.TrimSpace(re) != "0", nil
}

func GetProMaxFd(ctx context.Context) (int, error) {
	re, err := cmdexec.RunBashCmdWithOutput(ctx, "ulimit -n")
	if err != nil {
		return -1, fmt.Errorf("cmd exec error: %s", err.Error())
	}

	reStr := strings.TrimSpace(re)
	unitMax, err := strconv.Atoi(reStr)
	if err != nil {
		return -1, fmt.Errorf("%s is not a num: %s", reStr, err.Error())
	}

	return unitMax, nil
}

func GetKernelFdStatus(ctx context.Context) (int, int, error) {
	re, err := cmdexec.RunBashCmdWithOutput(ctx, "cat /proc/sys/fs/file-nr | awk '{print $1,$3}'")
	if err != nil {
		return -1, -1, fmt.Errorf("cmd exec error: %s", err.Error())
	}

	reStr := strings.TrimSpace(re)
	reArr := strings.Split(reStr, " ")
	if len(reArr) != 2 {
		return -1, -1, fmt.Errorf("unexpected output: %s", reStr)
	}

	nowFd, err := strconv.Atoi(reArr[0])
	if err != nil {
		return -1, -1, fmt.Errorf("%s is not a num: %s", reArr[0], err.Error())
	}

	maxFd, err := strconv.Atoi(reArr[1])
	if err != nil {
		return -1, -1, fmt.Errorf("%s is not a num: %s", reArr[1], err.Error())
	}

	return nowFd, maxFd, nil
}

func CreateFdFile(ctx context.Context, dir, filePrefix string, count int) error {
	if err := MkdirP(ctx, dir); err != nil {
		return fmt.Errorf("create dir error: %s", err.Error())
	}

	step := 5000
	if step > count {
		step = count
	}

	start, end := 0, step
	for end <= count {
		if err := cmdexec.RunBashCmdWithoutOutput(ctx, fmt.Sprintf("cd %s && touch %s{%d..%d}", dir, filePrefix, start, end-1)); err != nil {
			return fmt.Errorf("touch file from[%d] to[%d] error: %s", start, end, err.Error())
		}
		start += step
		end += step
	}

	return nil
}
