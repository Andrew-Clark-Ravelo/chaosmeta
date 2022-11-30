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

package main

import (
	"fmt"
	"github.com/ChaosMetaverse/chaosmetad/cmd/inject"
	"github.com/ChaosMetaverse/chaosmetad/cmd/query"
	"github.com/ChaosMetaverse/chaosmetad/cmd/recover"
	"github.com/ChaosMetaverse/chaosmetad/cmd/server"
	"github.com/ChaosMetaverse/chaosmetad/cmd/version"
	"github.com/ChaosMetaverse/chaosmetad/pkg/log"
	"github.com/ChaosMetaverse/chaosmetad/pkg/utils"
	"github.com/spf13/cobra"
	"os"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   utils.RootName,
	Short: fmt.Sprintf("a command line client to create %s experiment", utils.RootName),
}

func initRootCmd() {
	rootCmd.PersistentFlags().StringVar(&log.Level, "log-level", "info", "value support: debug, info, warn, error")
	rootCmd.PersistentFlags().StringVar(&log.Path, "log-path", "", "log file's path, its dir mush exist, eg: /tmp/chaosmetad.log, /tmp")

	rootCmd.AddCommand(inject.NewInjectCommand())
	rootCmd.AddCommand(query.NewQueryCommand())
	rootCmd.AddCommand(recover.NewRecoverCommand())
	rootCmd.AddCommand(server.NewServerCommand())
	rootCmd.AddCommand(version.NewVersionCommand())
}

func main() {
	initRootCmd()

	err := rootCmd.Execute()
	if err != nil {
		os.Exit(utils.InternalErr)
	}
}
