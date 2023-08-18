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

package experiment

import (
	"chaosmeta-platform/pkg/gateway/apiserver/v1alpha1"
	"chaosmeta-platform/pkg/service/experiment"
	"chaosmeta-platform/pkg/service/user"
	"encoding/json"
	"errors"
	beego "github.com/beego/beego/v2/server/web"
	"time"
)

type ExperimentController struct {
	v1alpha1.BeegoOutputController
	beego.Controller
}

func (c *ExperimentController) GetExperimentList() {
	lastInstanceStatus := c.GetString("last_instance_status")
	scheduleType := c.GetString("schedule_type")
	namespaceID, _ := c.GetInt("namespace_id")
	name := c.GetString("name")
	creator, _ := c.GetInt("creator", 0)
	timeType := c.GetString("time_type")
	recentDays, _ := c.GetInt("recent_days", 0)
	startTime, _ := time.Parse(experiment.TimeLayout, c.GetString("start_time"))
	endTime, _ := time.Parse(experiment.TimeLayout, c.GetString("end_time"))
	orderBy := c.GetString("sort")
	page, _ := c.GetInt("page", 1)
	pageSize, _ := c.GetInt("page_size", 10)
	experimentService := experiment.ExperimentService{}

	total, experimentList, err := experimentService.SearchExperiments(lastInstanceStatus, namespaceID, creator, name, scheduleType, timeType, recentDays, startTime, endTime, orderBy, page, pageSize)
	if err != nil {
		c.Error(&c.Controller, err)
		return
	}
	experimentListResponse := ExperimentListResponse{
		Page:        page,
		PageSize:    pageSize,
		Total:       total,
		Experiments: experimentList,
	}

	c.Success(&c.Controller, experimentListResponse)
}

func (c *ExperimentController) GetExperimentDetail() {
	uuid := c.Ctx.Input.Param(":uuid")
	experimentService := experiment.ExperimentService{}

	experimentGet, err := experimentService.GetExperimentByUUID(uuid)
	if err != nil {
		c.Error(&c.Controller, err)
		return
	}
	c.Success(&c.Controller, GetExperimentResponse{
		Experiment: *experimentGet,
	})
}

func (c *ExperimentController) CreateExperiment() {
	username := c.Ctx.Input.GetData("userName").(string)
	experimentService := experiment.ExperimentService{}
	creatorId, err := user.GetIdByName(username)

	if err != nil {
		c.Error(&c.Controller, err)
		return
	}

	var createExperimentRequest experiment.Experiment
	if err := json.Unmarshal(c.Ctx.Input.RequestBody, &createExperimentRequest); err != nil {
		c.Error(&c.Controller, err)
		return
	}
	createExperimentRequest.Creator = creatorId

	uuid, err := experimentService.CreateExperiment(&createExperimentRequest)
	if err != nil {
		c.Error(&c.Controller, err)
		return
	}
	c.Success(&c.Controller, CreateExperimentResponse{
		UUID: uuid,
	})
}

func (c *ExperimentController) UpdateExperiment() {
	uuid := c.Ctx.Input.Param(":uuid")
	experimentService := experiment.ExperimentService{}

	var updateExperimentRequest experiment.Experiment
	if err := json.Unmarshal(c.Ctx.Input.RequestBody, &updateExperimentRequest); err != nil {
		c.Error(&c.Controller, err)
		return
	}

	if err := experimentService.UpdateExperiment(uuid, &updateExperimentRequest); err != nil {
		c.Error(&c.Controller, err)
		return
	}
	c.Success(&c.Controller, "ok")
}

func (c *ExperimentController) DeleteExperiment() {
	uuid := c.Ctx.Input.Param(":uuid")
	if uuid == "" {
		c.Error(&c.Controller, errors.New("uuid is empty"))
		return
	}

	experimentService := experiment.ExperimentService{}
	if err := experimentService.DeleteExperimentByUUID(uuid); err != nil {
		c.Error(&c.Controller, err)
		return
	}
	c.Success(&c.Controller, "ok")
}
