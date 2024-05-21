package auth

import (
	"github.com/traas-stack/chaosmeta/chaosmeta-inject-operator/pkg/config"
)

type MistClient struct {
	Config config.MistConfig
}

func (r *MistClient) MistConfig() (string, string) {
	// internal code
	return "", ""
}
