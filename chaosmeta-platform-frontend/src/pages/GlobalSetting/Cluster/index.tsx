// react
import React, { useEffect, useRef, useState } from 'react';
// UI 资产
import { Button, Card, Drawer, Form, Input, Popconfirm, Space, message } from 'antd';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import InputWithFileDragger from '@/components/InputWithFileDragger';
// 辅助函数
import { useIntl, useRequest, useModel } from '@umijs/max';
import dayjs from 'dayjs';
import NiceModal, { useModal, antdDrawerV5 } from '@ebay/nice-modal-react';
// 网络请求
import { queryClusterList, addCluster, deleteCluster, updateCluster } from '@/services/chaosmeta/ClusterController';
// 类型定义
import type { ActionType } from '@ant-design/pro-components';
// 样式文件
import Less from './index.less';

/** 添加或修改集群侧边抽屉 */
const AddOrUpdateClusterDrawer = NiceModal.create((props: {
  type: '添加' | '更新';
  entity?: Record<string, any>;
}) => {
  const { type, entity } = props;
  /** 国际化实例 */
  const intl = useIntl();
  /** modal 实例 */
  const modal = useModal();
  // form 实例
  const [form] = Form.useForm();
  /** 添加集群的请求实例 */
  const addClusterRequest = useRequest(addCluster, { manual: true, formatResult: res => res });
  /** 更新集群的请求实例 */
  const updateClusterRequest = useRequest(updateCluster, { manual: true, formatResult: res => res });

  // 如果是更新集群信息则需要回填
  useEffect(() => {
    if (type === '更新' && entity) {
      try {
        form.setFieldsValue({
          name: entity.name,
          kubeconfig: atob(entity.kubeconfig),
        });
      }
      catch {}
    }
  }, [type, entity]);

  return (
    <Drawer
      {...antdDrawerV5(modal)}
      title={type === '更新' ? intl.formatMessage({ id: 'clusterManagement.updateCluster' }) : intl.formatMessage({ id: 'clusterManagement.addCluster' })}
      width={500}
      destroyOnClose
      footer={
        <Space style={{ width: '100%', justifyContent: 'right' }}>
          <Button onClick={() => modal.hide()}>{intl.formatMessage({ id: 'cancel' })}</Button>
          <Button
            type="primary"
            hidden={type === '更新'}
            loading={addClusterRequest.loading}
            onClick={async () => {
              try {
                const formData = await form.validateFields();
                const res = await addClusterRequest.run({
                  name: formData.name,
                  kubeconfig: btoa(formData.kubeconfig),
                });

                if (res.data && res.data.id) {
                  message.success(intl.formatMessage({ id: 'clusterManagement.addSuccess' }));
                  modal.resolve(true);
                  modal.hide();
                }
                else message.error(res.message);
              }
              catch { }
            }}
          >
            {intl.formatMessage({ id: 'confirm' })}
          </Button>
          <Button
            type="primary"
            hidden={type === '添加'}
            loading={updateClusterRequest.loading}
            onClick={async () => {
              try {
                const formData = await form.validateFields();
                const res = await updateClusterRequest.run({
                  id: entity?.id,
                  name: formData.name,
                  kubeconfig: btoa(formData.kubeconfig),
                });

                if (res.data && res.data) {
                  message.success(intl.formatMessage({ id: 'clusterManagement.updateSuccess' }));
                  modal.resolve(true);
                  modal.hide();
                }
                else message.error(res.message);
              }
              catch { }
            }}
          >
            {intl.formatMessage({ id: 'confirm' })}
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item name='name' label={intl.formatMessage({ id: 'clusterName' })} rules={[{ required: true }]}>
          <Input placeholder={intl.formatMessage({ id: 'inputPlaceholder' })} />
        </Form.Item>
        <Form.Item
          name='kubeconfig'
          label={intl.formatMessage({ id: 'clusterManagement.clusterConfigFile' })}
          rules={[{ required: true, message: intl.formatMessage({ id: 'clusterManagement.clusterConfigFileEmptyWaring' }) }]}
        >
          <InputWithFileDragger
            placeholder={intl.formatMessage({ id: 'clusterManagement.clusterConfigFilePlaceholder' })}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
})

const Cluster: React.FunctionComponent = () => {
  // 当前登录人信息
  const { userInfo } = useModel('global');
  /** 当前登录人是否拥有管理员权限 */
  const isAdmin = userInfo.role === 'admin';
  /** 国际化实例 */
  const intl = useIntl();
  // 当前选中的表格项
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  /** 表格 actionRef */
  const actionRef = useRef<ActionType>();

  return (
    <NiceModal.Provider>
      <PageContainer
        title={intl.formatMessage({ id: 'clusterManagement.title' })}
        extra={
          <Button
            hidden={!isAdmin}
            onClick={async () => {
              await NiceModal.show(AddOrUpdateClusterDrawer, { type: '添加' });
              actionRef.current?.reload();
            }}
          >
            {intl.formatMessage({ id: 'clusterManagement.addCluster' })}
          </Button>
        }
      >
        <Card style={{ background: '#EBF0F6' }}>
          <ProTable
            bordered
            rowKey="id"
            options={false}
            actionRef={actionRef}
            tableExtraRender={() => {
              return (
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {intl.formatMessage({ id: 'clusterManagement.clusterList' })}
                  </div>
                </Space>
              );
            }}
            className={Less.container}
            columns={[
              {
                title: intl.formatMessage({ id: 'clusterName' }),
                dataIndex: 'name',
                width: 300,
              },
              {
                title: intl.formatMessage({ id: 'createTime' }),
                dataIndex: 'createTime',
                hideInSearch: true,
                width: 250,
                render(dom, { createTime }: any) {
                  if (typeof createTime === 'string' && typeof (Number(createTime)) === 'number') {
                    return dayjs(Number(createTime)).format('YYYY-MM-DD HH:mm:ss');
                  }
                  return '-';
                },
              },
              {
                title: intl.formatMessage({ id: 'actions' }),
                dataIndex: 'id',
                hideInTable: !isAdmin,
                hideInSearch: true,
                width: 200,
                render(dom, entity) {
                  return (
                    <Space>
                      <a
                        onClick={async () => {
                          await NiceModal.show(AddOrUpdateClusterDrawer, { type: '更新', entity });
                          actionRef.current?.reload();
                        }}
                      >
                        {intl.formatMessage({ id: 'update' })}
                      </a>
                      <Popconfirm
                        title={intl.formatMessage({ id: 'clusterManagement.deleteConfirm' })}
                        onConfirm={async () => {
                          try {
                            const res = await deleteCluster({ id: entity.id });

                            if (res.code) {
                              message.success(intl.formatMessage({ id: 'clusterManagement.deleteSuccess' }));
                              actionRef.current?.reload();
                            }
                            else message.error(res.message);
                          }
                          catch { }
                        }}
                      >
                        <a>{intl.formatMessage({ id: 'delete' })}</a>
                      </Popconfirm>
                    </Space>
                  );
                },
              }
            ]}
            pagination={{
              defaultPageSize: 10,
            }}
            request={async ({ pageSize, current, name }) => {
              try {

                const res = await queryClusterList({ name, page: current, page_size: pageSize });

                if (res.data && res.data.clusters instanceof Array) {
                  return {
                    total: res.data.total,
                    data: res.data.clusters,
                  }
                }
                else return {};
              }
              catch {
                return {};
              }
            }}
            rowSelection={{
              selectedRowKeys,
              onChange(selectedRowKeys) {
                setSelectedRowKeys(selectedRowKeys as string[]);
              },
            }}
          />
        </Card>
      </PageContainer>
    </NiceModal.Provider>
  );
}

export default Cluster;
