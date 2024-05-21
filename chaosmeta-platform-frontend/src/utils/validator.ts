/** 校验文件名称中是否含有特殊字符 */
export const fileNameSafetyValidator = (fileName: string) => {
  const regExp = /[+/?%#&=]+?/g;
  // 不被允许的特殊字符数组
  // match 的结果可能为 null
  const violationArray: string[] = fileName?.match(regExp) ?? [];
  return {
    /** 文件名中是否含有特殊字符 */
    passed: violationArray.length === 0,
    /** 文件名中的特殊字符列表 */
    violationArray,
  };
};
