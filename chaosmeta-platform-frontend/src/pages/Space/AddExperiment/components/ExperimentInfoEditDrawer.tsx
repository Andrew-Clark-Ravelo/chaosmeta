// react
import React, { Fragment, useEffect, useState } from 'react';
// UI 资产
import { Alert, Button, DatePicker, Drawer, Form, Input, Radio, Select, Space } from 'antd';
import AsyncRender from '@/components/AsyncRender';
import TagSelect from './TagSelect';
// 辅助函数
import ShowText from '@/components/ShowText';
import { getIntlLabel, timesStampString } from '@/utils/format';
import { renderScheduleType, renderTags } from '@/utils/renderItem';
import { history, useIntl } from '@umijs/max';
import dayjs from 'dayjs';
import NiceModal, { useModal, antdDrawerV5 } from '@ebay/nice-modal-react';
// 网络请求
import { queryClusterList } from '@/services/chaosmeta/ClusterController';
// 常量
import { triggerTypes } from '@/constants';
// 样式文件
import { InfoEditDrawer } from '../style';

/** 编辑实验基本信息抽屉 */
const ExperimentInfoEditDrawer = NiceModal.create((props: {
  /** 登录人的当前实验权限 */
  spacePermission?: number;
  /** 当前实验基本信息 */
  baseInfo: Record<string, any>;
}) => {
  // props 解构
  const { baseInfo, spacePermission = 1 } = props;
  // form 实例
  const [form] = Form.useForm();
  /** modal 实例 */
  const modal = useModal();
  /** 国际化 */
  const intl = useIntl();
  // form 字段监听
  /** cluster_id */
  const cluster_id = Form.useWatch('cluster_id', form);
  // 受控模式下的标签数组
  const [addTagList, setAddTagList] = useState<any>([]);

  // 表单字段回填
  useEffect(() => {
    if (baseInfo instanceof Object && Object.keys(baseInfo).length > 0) {
      const { schedule_rule, schedule_type, labels, description, name, cluster_id } = baseInfo;

      form.setFieldsValue({
        schedule_type,
        labels,
        description,
        name,
        cluster_id: Number(cluster_id),
      });
      if (baseInfo?.schedule_type === 'once') {
        form.setFieldValue('once_time', dayjs(timesStampString(schedule_rule)));
      } else if (baseInfo?.schedule_type === 'cron') {
        form.setFieldValue('schedule_rule', schedule_rule);
      }
      setAddTagList(baseInfo?.labels || []);
    }
  }, [baseInfo]);

  return (
    <Drawer
      {...antdDrawerV5(modal)}
      title={intl.formatMessage({ id: 'basicInfo' })}
      width={520}
      footer={
        <Space>
          <Button onClick={() => modal.hide()}>
            {intl.formatMessage({ id: 'cancel' })}
          </Button>
          <Button
            type="primary"
            onClick={async () => {
              try {
                const formData = await form.validateFields();

                if (formData.schedule_type === 'once') {
                  formData.schedule_rule = formData.once_time.valueOf().toString();
                }
                modal.resolve({ ...formData, labels: addTagList });
                modal.hide();
              }
              
              catch {}
            }}
          >
          {intl.formatMessage({ id: 'confirm' })}
        </Button>
        </Space >
      }
    >
  <InfoEditDrawer>
    <Form form={form} layout="vertical">
      {spacePermission === 1 && (
        <Fragment>
          <Form.Item
            name={'name'}
            label={intl.formatMessage({ id: 'experimentName' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'inputPlaceholder' }),
              },
            ]}
          >
            <Input
              placeholder={intl.formatMessage({ id: 'inputPlaceholder' })}
            />
          </Form.Item>
          <Form.Item
            name={'description'}
            label={intl.formatMessage({ id: 'experimentDescription' })}
          >
            <Input.TextArea
              rows={3}
              placeholder={intl.formatMessage({ id: 'inputPlaceholder' })}
            />
          </Form.Item>
          <TagSelect
            spaceId={history?.location?.query?.spaceId as string}
            setAddTagList={setAddTagList}
            addTagList={addTagList}
          />
          <Form.Item
            name={'schedule_type'}
            label={intl.formatMessage({ id: 'triggerMode' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'selectPlaceholder' }),
              },
            ]}
            initialValue={'manual'}
          >
            <Radio.Group>
              {triggerTypes?.map((item) => {
                return (
                  <Radio value={item?.value} key={item?.value}>
                    {getIntlLabel(item)}
                  </Radio>
                );
              })}
            </Radio.Group>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(pre, cur) =>
              pre?.schedule_type !== cur?.schedule_type
            }
          >
            {({ getFieldValue }) => {
              const triggerType = getFieldValue('schedule_type');
              if (triggerType === 'once') {
                return (
                  <div className="trigger-type">
                    <Form.Item
                      name={'once_time'}
                      rules={[
                        {
                          required: true,
                          message: intl.formatMessage({
                            id: 'selectPlaceholder',
                          }),
                        },
                      ]}
                    >
                      <DatePicker format="YYYY-MM-DD HH:mm:ss" showTime />
                    </Form.Item>
                  </div>
                );
              }
              if (triggerType === 'cron') {
                return (
                  <div className="trigger-type">
                    <Form.Item
                      name={'schedule_rule'}
                      label={`Cron ${intl.formatMessage({
                        id: 'expression',
                      })}`}
                      rules={[
                        {
                          required: true,
                          message: `${intl.formatMessage({
                            id: 'inputPlaceholder',
                          })} Cron ${intl.formatMessage({
                            id: 'expression',
                          })}`,
                        },
                      ]}
                    >
                      <Input
                        placeholder={`${intl.formatMessage({
                          id: 'inputPlaceholder',
                        })} ${intl.formatMessage({ id: 'expression' })}`}
                      />
                    </Form.Item>
                  </div>
                );
              }
              return null;
            }}
          </Form.Item>
          {/* 当集群信息发生更改时需要给出警告 */}
          {(cluster_id !== 0 && cluster_id !== baseInfo?.cluster_id) && (
            <Alert type="warning" message={intl.formatMessage({ id: 'clusterManagement.membershipInfo.modified' })} />
          )}
          <Form.Item
            name='cluster_id'
            label={intl.formatMessage({ id: 'clusterManagement.membershipInfo' })}
            rules={[{ required: true }]}
          >
            <AsyncRender
              data={async () => {
                try {
                  const res = await queryClusterList({ page: 1, page_size: 20 });

                  if (res.data && res.data.clusters instanceof Array) {
                    return res.data.clusters.map((i: any) => {
                      return { label: i.name, value: i.id }
                    });
                  }
                  return [];
                }
                catch {
                  return [];
                }
              }}
              component={(options) => {
                /** 默认集群 */
                const defaultCluster = { label: '默认集群', value: 0 };

                return (
                  <Select
                    options={[defaultCluster, ...options]}
                    placeholder={intl.formatMessage({ id: 'clusterManagement.membershipInfo.placeholder' })}
                  />
                );
              }}
              onDataLoad={() => {
                // 没有配置集群信息的情况下需要设置默认集群
                if (form.getFieldValue('cluster_id') === undefined || baseInfo.cluster_id === undefined) {
                  form.setFieldValue('cluster_id', 0);
                }
              }}
            />
          </Form.Item>
        </Fragment>
      )}
      {spacePermission !== 1 && (
        <Fragment>
          <Form.Item name="name" label="实验名称"><ShowText /></Form.Item>
          <Form.Item name="description" label="实验描述"><ShowText /></Form.Item>
          <Form.Item label="标签">{renderTags(baseInfo?.labels)}</Form.Item>
          <Form.Item label="触发方式">{renderScheduleType(baseInfo)}</Form.Item>
          <Form.Item name="cluster_id" label="所属集群"><ShowText /></Form.Item>
        </Fragment>
      )}
    </Form>
  </InfoEditDrawer>
    </Drawer >
  );
});

export default ExperimentInfoEditDrawer;
