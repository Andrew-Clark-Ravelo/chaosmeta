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

const (
	TargetJVM       = "jvm"
	JVMExecutor     = "chaosmeta_jvm_exec.sh"
	JVMPackage      = "chaosmeta-jvm-1.1.0"
	ContainerJVMDir = "/tmp"

	FaultMethodException = "methodexception"
	FaultMethodDelay     = "methoddelay"
	FaultMethodReplace   = "methodreplace"
	FaultHeapBurn        = "heapburn"
	FaultCpuBurn         = "cpuburn"

	PositionBefore = "before"
	PositionReturn = "return"
	PositionThrow  = "throw"

	FaultTypeMethod         = "method"
	FaultTypeSystemResource = "system_resource"

	FaultActionMethodReplace   = "method_replace"
	FaultActionMethodException = "method_exception"
	FaultActionMethodDelay     = "method_delay"
	FaultActionHeapBurn        = "heap_burn"
	FaultActionCpuBurn         = "cpu_burn"
)

type MethodExceptionFaultParam struct {
	Method    string `json:"method"`
	Message   string `json:"message"`
	Exception string `json:"exception"`
	Position  string `json:"position"`
}

type MethodDelayFaultParam struct {
	Method   string `json:"method"`
	Latency  int    `json:"latency"`
	Position string `json:"position"`
}

type MethodReplaceFaultParam struct {
	Method string `json:"method"`
	Code   string `json:"code"`
}
