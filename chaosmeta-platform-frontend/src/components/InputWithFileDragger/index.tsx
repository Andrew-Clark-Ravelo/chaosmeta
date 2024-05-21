// react
import { Fragment, FunctionComponent } from 'react';
// UI 资产
import { Input, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
// 辅助函数
import { useIntl } from '@umijs/max';
import { fileNameSafetyValidator } from '@/utils/validator';
// 类型定义
import type { InputProps } from 'antd';

/** 带有文件上传功能的文本输入框 */
const InputWithFileDragger: FunctionComponent<Partial<{
  value: InputProps['value'];
  onChange: any;
  placeholder: InputProps['placeholder'];
}>> = ({ value, onChange, placeholder }) => {
  /** 国际化实例 */
  const intl = useIntl();

  return (
    <Fragment>
      <Input.TextArea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={20}
      />
      <Upload.Dragger
        name='file'
        accept='.txt'
        multiple
        maxCount={1}
        style={{ marginTop: 16 }}
        customRequest={() => { }}
        showUploadList={false}
        beforeUpload={(file: File) => {
          /** 文件特殊命名信息 */
          const fileNameSafety = fileNameSafetyValidator(file.name);

          if (!['text/plain'].includes(file.type)) {
            message.error(intl.formatMessage({ id: 'inputWithFileDragger.fileTypeError' }));
            return Upload.LIST_IGNORE;
          }
          if (!fileNameSafety.passed) {
            message.error(
              <span>
                {intl.formatMessage({ id: 'inputWithFileDragger.fileNameError' })}{' '}
                <span style={{ color: 'red', fontWeight: 'bolder' }}>
                  {fileNameSafety.violationArray.join(' / ')}
                </span>
                {' '}{intl.formatMessage({ id: 'inputWithFileDragger.uploadAgain' })}
              </span>,
            );
            return Upload.LIST_IGNORE;
          }
          // 使用文件内容填充文本输入
          try {
            const fileReader = new FileReader();
            fileReader.readAsText(file);
            fileReader.onload = () => {
              onChange?.(fileReader.result);
            };
          }
          catch { }
        }}
      >
        <p className="ant-upload-drag-icon" style={{ margin: 0 }}>
          <InboxOutlined />
        </p>
        <p className="ant-upload-hint" style={{ margin: 0 }}>{intl.formatMessage({
          id: 'inputWithFileDragger.draggerPlaceholder'
        })}</p>
      </Upload.Dragger>
    </Fragment>
  );
}

export default InputWithFileDragger;
