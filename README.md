# 豪情在天 · 任务与计时

一个支持多设备实时同步的任务计时应用。

## 应用特点

- 多设备实时同步：使用腾讯云CloudBase实现数据同步
- 版本控制：通过版本号机制解决数据冲突
- 心跳机制：实时同步计时器状态
- 断线重连：网络断开后自动重连并同步数据
- 事务保存：使用事务确保数据完整性

## 访问地址

应用已部署到腾讯云CloudBase，可通过以下地址访问：

[https://cloud1-4g8gnb2uda2a2c54-1367392929.tcloudbaseapp.com/](https://cloud1-4g8gnb2uda2a2c54-1367392929.tcloudbaseapp.com/)

## 使用说明

1. 首次使用需要注册账号并登录
2. 确保所有设备使用相同的账号登录
3. 应用会自动处理数据冲突，无需手动干预
4. 如果同步出现问题，可以尝试刷新页面重新连接

## 技术栈

- 前端：HTML、CSS、JavaScript
- 后端/存储：腾讯云CloudBase
- 数据库：CloudBase数据库（NoSQL）

## 部署信息

- 环境 ID：cloud1-4g8gnb2uda2a2c54
- 静态网站域名：cloud1-4g8gnb2uda2a2c54-1367392929.tcloudbaseapp.com
- 数据库集合：users（权限：仅文档所有者可读写）

## 管理控制台

- [CloudBase控制台](https://console.cloud.tencent.com/tcb/env/detail?envId=cloud1-4g8gnb2uda2a2c54)
- [静态网站托管](https://console.cloud.tencent.com/tcb/hosting/index?env=cloud1-4g8gnb2uda2a2c54)
- [数据库管理](https://console.cloud.tencent.com/tcb/database/index?env=cloud1-4g8gnb2uda2a2c54)