import request from '@/utils/request';

/**
 * 查询集群列表
 * @param params
 * @param options
 * @returns
 */
export async function queryClusterList(
  params?: Partial<{
    name: string;
    page: number;
    page_size: number;
  }>,
  options?: { [key: string]: any },
) {
  return request<any>(
    `/chaosmeta/api/v1/kubernetes/cluster/list`,
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

/**
 * 添加集群
 * @param name
 * @param config
 * @returns
 */
export async function addCluster(
  data?: {
    name: string;
    kubeconfig: string;
  },
  options?: { [key: string]: any },
) {
  return request<any>(
    `/chaosmeta/api/v1/kubernetes/cluster`,
    {
      method: 'POST',
      data: data || {},
      ...(options || {}),
    },
  );
}

/**
 * 修改集群
 * @param name
 * @param config
 * @returns
 */
export async function updateCluster(
  data?: {
    id: string;
    name: string;
    kubeconfig: string;
  },
  options?: { [key: string]: any },
) {
  return request<any>(
    `/chaosmeta/api/v1/kubernetes/cluster/${data?.id}`,
    {
      method: 'POST',
      data: { ...data, id: undefined } || {},
      ...(options || {}),
    },
  );
}

/**
 * 查询集群详情
 * @param params
 * @param options
 * @returns
 */
export async function queryCluster(
  params?: { id: string },
  options?: { [key: string]: any },
) {
  return request<any>(
    `/chaosmeta/api/v1/kubernetes/cluster/${params?.id}`,
    {
      method: 'DELETE',
      ...(options || {}),
    },
  );
}


/**
 * 删除集群
 * @param params
 * @param options
 * @returns
 */
export async function deleteCluster(
  params?: { id: string },
  options?: { [key: string]: any },
) {
  return request<any>(
    `/chaosmeta/api/v1/kubernetes/cluster/${params?.id}`,
    {
      method: 'DELETE',
      ...(options || {}),
    },
  );
}
