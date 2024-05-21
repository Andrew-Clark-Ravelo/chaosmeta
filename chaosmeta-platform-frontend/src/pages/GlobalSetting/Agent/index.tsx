// react
import React, { useRef, useState } from 'react';
// UI 资产
import { ExclamationCircleFilled, PlusOutlined } from '@ant-design/icons';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Input, Modal, Space, Tabs, Tag, Tooltip } from 'antd';
import AddColonyModal from './AddColonyModal';
import AppConfigDrawer from './AppConfigDrawer';
import InstallAgentModal from './InstallAgentModal';
import TableList from './TableList';
import UpgradationDrawer from './UpgradationDrawer';
import { Container } from './style';
// 辅助函数
import { useIntl } from '@umijs/max';
// 类型定义
import type { TabsProps } from 'antd';
import type { ActionType } from '@ant-design/pro-components';

type TabType = 'otherHost' | 'defaultHost';

const Agent: React.FunctionComponent = () => {
  /** 国际化实例 */
  const intl = useIntl();
  // 卡片标签页项目
  const [tabItems] = useState<TabsProps['items']>([
    {
      label: '集群外 Host',
      key: 'otherHost',
    },
    {
      label: '默认集群',
      key: 'defaultHost',
    },
  ]);
  /** 当前激活的 tab */
  const [currentTab, setCurrentTab] = useState<TabType>('otherHost')
  /** 列表 actionRef 实例 */
  const actionRef = useRef<ActionType>();
  // 当前选中的表单行
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  return (
    <Container>
      <PageContainer
        title={intl.formatMessage({ id: 'agentManagement.title' })}
        extra={
          <Space>
            <Button>添加集群</Button>
            <Button type="primary">安装 Agent</Button>
          </Space>
        }
      >
        <Tabs
          items={tabItems}
          type="card"
          tabPosition="top"
          activeKey={currentTab}
          onChange={tab => setCurrentTab(tab as TabType)}
        />
        <div
          style={{
            padding: 24,
            background: '#EBF0F6',
            borderBottomLeftRadius: 6,
            borderBottomRightRadius: 6
          }}
        >
          <ProTable
            search={{
              collapsed: false,
              collapseRender: false,
            }}
            toolBarRender={false}
            tableExtraRender={() => {
              return (
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div></div>
                </Space>
              );
            }}
            actionRef={actionRef}
            columns={[
              {
                title: 'Hostname',
                width: 80,
                dataIndex: 'hostname',
              },
              {
                title: 'IP',
                width: 160,
                dataIndex: 'ip',
              },
              {
                title: '应用',
                width: 160,
                dataIndex: 'app',
              },
              {
                title: 'Agent 版本',
                width: 160,
                dataIndex: 'version',
              },
              {
                title: 'Agent 状态',
                width: 160,
                dataIndex: 'state',
                render(dom, { state }) {
                  return (
                    <Tag color="success">正常</Tag>
                  );
                },
              },
              {
                title: '操作',
                width: 160,
                dataIndex: 'id',
                hideInSearch: true,
                render: (dom, { id }) => {
                  return (
                    <Space>
                      <a>
                        升级 Agent
                      </a>
                      <a>卸载</a>
                    </Space>
                  );
                },
              },
            ]}
            
          />
        </div>
      </PageContainer>
    </Container>
  );
};

export default Agent;
