package global

import (
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"os"
	"runtime"
)

var (
	GlobalClient *kubernetes.Clientset
)

func InitKubernetesClient() error {
	var config *rest.Config
	var err error
	if runtime.GOOS == "darwin" {
		config, err = clientcmd.BuildConfigFromFlags("", os.Getenv("KUBECONFIG"))
		if err != nil {
			return err
		}
	} else {
		// 初始化配置
		config, err = rest.InClusterConfig()
		if err != nil {
			return err
		}
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return err
	}
	GlobalClient = clientset
	return nil
}
