// react
import { useEffect, useState } from 'react';
// UI 资产
import { Button, Form, Modal, Space, Spin, message } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { EditOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import ExperimentInfoEditDrawer from './components/ExperimentInfoEditDrawer';
import ShowText from '@/components/ShowText';
import ArrangeContent from './ArrangeContent';
// 辅助函数
import { history, useIntl, useModel, useRequest } from '@umijs/max';
import NiceModal from '@ebay/nice-modal-react';
import {
  arrangeDataOriginTranstion,
  arrangeDataResultTranstion,
} from '@/utils/format';
import { renderScheduleType, renderTags } from '@/utils/renderItem';
// 网络请求
import {
  createExperiment,
  deleteExperiment,
  queryExperimentDetail,
  updateExperiment,
} from '@/services/chaosmeta/ExperimentController';
import { querySpaceUserPermission } from '@/services/chaosmeta/SpaceController';
// 常量
import { currentConfig } from '@/constants';
// 样式文件
import { Container } from './style';

export default () => {
  // 表单实例
  const [form] = Form.useForm();
  // 用户权限
  const { setSpacePermission, spacePermission } = useModel('global');
  // 编排的数据
  const [arrangeList, setArrangeList] = useState<any>([]);
  // 实验基本信息
  const [baseInfo, setBaseInfo] = useState<any>({});
  /** 国际化 */
  const intl = useIntl();
  /** 当前页面对应实验 id */
  const experimentId = history?.location?.query?.experimentId;

  /** 获取实验详情 */
  const getExperimentDetail = useRequest(queryExperimentDetail, {
    manual: true,
    formatResult: (res) => res,
    onSuccess: (res) => {
      if (res?.code === 200) {
        const experiments = res?.data?.experiments;
        // 已经保存过的信息，完善度设为 true，已完善
        const newList = experiments?.workflow_nodes?.map((item: any) => {
          // 将动态表单 args_value 的值处理为 form 可以使用的
          const newArgs: any = {};
          item?.args_value?.forEach((arg: any) => {
            newArgs[arg?.args_id] = arg?.value;
          });
          return { ...item, nodeInfoState: true, args_value: newArgs };
        });
        // 保存实验基本信息
        form.setFieldsValue(experiments);
        setBaseInfo(experiments);
        setArrangeList(arrangeDataOriginTranstion(newList || []));
        // 更新当前集群信息
        {
          currentConfig.clusterId = experiments.cluster_id;
        }
      }
    },
  });

  /** 编辑更新实验 */
  const editExperiment = useRequest(updateExperiment, {
    manual: true,
    formatResult: (res) => res,
    onSuccess: (res) => {
      if (res?.code === 200) {
        message.success(intl.formatMessage({ id: 'updateText' }));
      }
    },
  });

  /** 创建实验 */
  const handleCreateExperiment = useRequest(createExperiment, {
    manual: true,
    formatResult: (res) => res,
    onSuccess: (res) => {
      if (res?.code === 200) {
        message.success(intl.formatMessage({ id: 'createText' }));
        history?.push('/space/experiment');
      }
    },
  });

  /** 根据成员名称和空间 id 获取成员空间内权限信息 */
  const getUserSpaceAuth = useRequest(querySpaceUserPermission, {
    manual: true,
    formatResult: (res) => res,
    onSuccess: (res) => {
      if (res.code === 200) {
        // 存储用户空间权限
        setSpacePermission(res?.data);
      }
    },
  });

  /** 处理当前实验信息以供编辑或新增 */
  const handleFormatOriginData = async () => {
    try {
      const values = await form.validateFields();

      const arrangeResult = arrangeDataResultTranstion(arrangeList);
      if (!baseInfo?.name || !baseInfo?.schedule_type) {
        message.info(intl.formatMessage({ id: 'addExperiment.basic.tip' }));
        return;
      }
      if (
        !arrangeResult?.length ||
        arrangeResult?.some((item) => !item?.nodeInfoState)
      ) {
        message.info(intl.formatMessage({ id: 'addExperiment.node.tip' }));
        return;
      }
      const newLabels = baseInfo?.labels?.map(
        (item: { id: number }) => item?.id,
      );
      const newList = arrangeResult?.map((item) => {
        const {
          args_value,
          exec_range,
          exec_id,
          row,
          column,
          uuid,
          duration,
          scope_id,
          target_id,
          exec_type,
          name,
          exec_name,
          measure_range,
          flow_range,
        } = item;
        let target_name = exec_range?.target_name;
        if (Array.isArray(target_name)) {
          target_name = exec_range?.target_name?.join(',');
        }
        let newExecRange = {
          ...exec_range,
          target_name: target_name || undefined,
        };
        let newExecName = exec_name;
        if (exec_type === 'flow' || exec_type === 'measure') {
          newExecRange = undefined;
          newExecName = undefined;
        }
        if (measure_range) {
          measure_range.duration = duration;
        }
        if (flow_range) {
          flow_range.duration = duration;
        }
        return {
          name,
          exec_name: newExecName,
          args_value,
          exec_range: newExecRange,
          exec_id,
          row,
          column,
          uuid,
          duration,
          scope_id: scope_id ?? 0,
          target_id: target_id ?? 0,
          exec_type,
          measure_range,
          flow_range,
        };
      });

      return {
        ...values,
        labels: newLabels,
        schedule_rule: baseInfo?.schedule_rule,
        namespace_id: Number(history?.location?.query?.spaceId),
        workflow_nodes: newList,
      };
    }
    catch {
      return undefined;
    }
  }

  /** 提交实验信息 */
  const handleSubmit = () => {
    handleFormatOriginData().then((params) => {
      // 根据新增还是编辑调用不同的接口
      if (experimentId) {
        editExperiment?.run({ ...params, uuid: experimentId }).then(() => {
          history.push('/space/experiment');
        });
      } else {
        handleCreateExperiment?.run(params);
      }
    });
  };

  /** 删除实验接口 */
  const handleDeleteExperiment = useRequest(deleteExperiment, {
    manual: true,
    formatResult: (res) => res,
    onSuccess: (res) => {
      if (res?.code === 200) {
        message.success(intl.formatMessage({ id: 'deleteText' }));
        history.push('/space/experiment');
      }
    },
  });

  /** 确认删除实验 */
  const handleDeleteConfirm = () => {
    const uuid = history?.location?.query?.experimentId as string;
    if (uuid) {
      Modal.confirm({
        title: intl.formatMessage({ id: 'experiment.delete.title' }),
        icon: <ExclamationCircleFilled />,
        content: intl.formatMessage({ id: 'experiment.delete.content' }),
        onOk() {
          handleDeleteExperiment?.run({ uuid });
        },
      });
    }
  };

  useEffect(() => {
    const { experimentId, spaceId } = history?.location?.query || {};
    const sessionSpaceId = sessionStorage.getItem('spaceId');
    // 地址栏中存在空间 id，需要将空间列表选项更新，并保存当前id
    if (spaceId || sessionSpaceId) {
      if (!spaceId) {
        history.push({
          pathname: '/space/experiment/add',
          query: {
            spaceId: sessionSpaceId,
          },
        });
      }
      const curId = spaceId || sessionSpaceId;
      getUserSpaceAuth?.run({
        id: curId as string,
      });
    }
    if (experimentId) {
      getExperimentDetail?.run({ uuid: experimentId as string });
    } else {
      setArrangeList(arrangeDataOriginTranstion([]));
      form.setFieldValue('name', intl.formatMessage({ id: 'experimentName' }));
    }
  }, [history.location.query]);

  return (
    <Container>
      <Spin spinning={getExperimentDetail.loading}>
        <NiceModal.Provider>
          <PageContainer
            header={{
              title: (
                <Form form={form}>
                  {/* 用于保存内部弹窗中所填写的集群信息 */}
                  <Form.Item name='cluster_id' noStyle hidden />
                  <Space>
                    <Form.Item name={'name'}>
                      <ShowText ellipsis />
                    </Form.Item>
                    <EditOutlined
                      hidden={spacePermission !== 1}
                      className="edit"
                      style={{ color: '#1890FF' }}
                      onClick={async () => {
                        const formData: any = await NiceModal.show(ExperimentInfoEditDrawer, { baseInfo, spacePermission });

                        // 更新当前集群信息
                        {
                          currentConfig.clusterId = formData.cluster_id;
                        }

                        if (formData instanceof Object) {
                          // 编辑时直接调用接口更新并刷新当前页面
                          if (experimentId) {
                            try {
                              const data = await handleFormatOriginData();

                              await editExperiment?.run({ ...data, ...formData, uuid: experimentId });
                              window.location.reload();
                            }
                            catch {
                              // 接口报错则暂时记录当前信息
                              setBaseInfo({ ...baseInfo, ...formData });
                              form.setFieldsValue(formData);
                            }
                          } else {
                            setBaseInfo({ ...baseInfo, ...formData });
                            form.setFieldsValue(formData);
                          }
                        }
                      }}
                    />
                    <a
                      hidden={spacePermission === 1}
                      onClick={() => {
                        NiceModal.show(ExperimentInfoEditDrawer, { baseInfo, spacePermission });
                      }}
                    >
                      {intl.formatMessage({ id: 'check' })}
                    </a>
                  </Space>
                  <Form.Item>{renderTags(baseInfo?.labels)}</Form.Item>
                </Form>
              ),
              onBack: () => {
                history.push('/space/experiment');
              },
              extra: (
                <Form form={form}>
                  <div className="header-extra">
                    <div>
                      <Form.Item
                        name={'schedule_type'}
                        label={intl.formatMessage({ id: 'triggerMode' })}
                      >
                        {renderScheduleType(baseInfo)}
                      </Form.Item>
                      <Form.Item
                        name={'description'}
                        label={intl.formatMessage({ id: 'description' })}
                      >
                        <ShowText />
                      </Form.Item>
                    </div>
                    {spacePermission === 1 && (
                      <Space>
                        <Button
                          ghost
                          danger
                          onClick={() => {
                            handleDeleteConfirm();
                          }}
                        >
                          {intl.formatMessage({ id: 'delete' })}
                        </Button>
                        <Button
                          ghost
                          type="primary"
                          loading={handleCreateExperiment?.loading}
                          onClick={() => {
                            handleSubmit();
                          }}
                        >
                          {intl.formatMessage({ id: 'finish' })}
                        </Button>
                      </Space>
                    )}
                  </div>
                </Form>
              ),
            }}
          >
            <ArrangeContent
              arrangeList={arrangeList}
              setArrangeList={setArrangeList}
              disabled={spacePermission !== 1}
            />
          </PageContainer>
        </NiceModal.Provider>
      </Spin>
    </Container>
  );
};
