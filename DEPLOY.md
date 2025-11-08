# 部署说明

## 腾讯云 CloudBase 配置

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/tcb)
2. 创建新的 CloudBase 环境或使用现有环境
3. 在环境设置中获取环境 ID，更新到 `index.js` 第 28 行的 `cloudbaseConfig.env` 中

## 本地部署

1. 使用任何 HTTP 服务器（如 Python 的 `http.server` 或 Node.js 的 `serve`）启动应用
2. 访问 `http://localhost:端口号` 即可使用

## 云端部署（推荐）

### 方法一：使用 CloudBase 静态网站托管

1. 安装 CloudBase CLI：
   ```bash
   npm install -g @cloudbase/cli
   ```

2. 登录 CloudBase：
   ```bash
   tcb login
   ```

3. 初始化项目：
   ```bash
   tcb hosting init <环境ID>
   ```

4. 部署：
   ```bash
   tcb hosting deploy
   ```

### 方法二：使用 CloudStudio（一键部署）

1. 访问 [CloudStudio](https://cloudstudio.net/)
2. 创建新工作空间，上传项目文件
3. 使用内置的部署功能一键部署

## 数据同步说明

本应用已优化为支持多设备实时同步，主要特性：

1. **版本控制**：使用版本号机制解决数据冲突
2. **智能合并**：自动选择最新数据，避免数据丢失
3. **心跳机制**：实时同步计时器状态
4. **断线重连**：网络断开后自动重连并同步数据
5. **事务保存**：使用事务确保数据完整性

## 注意事项

1. 首次使用需要注册账号并登录
2. 确保所有设备使用相同的账号登录
3. 应用会自动处理数据冲突，无需手动干预
4. 如果同步出现问题，可以尝试刷新页面重新连接

## 常见问题

**Q: 数据同步失败怎么办？**
A: 检查网络连接，确保 CloudBase 环境配置正确，尝试刷新页面。

**Q: 多设备同时使用会有问题吗？**
A: 应用已经过优化，使用版本控制和心跳机制确保数据一致性，多设备同时使用是安全的。

**Q: 数据会丢失吗？**
A: 应用使用了事务保存和版本控制机制，最大程度防止数据丢失。同时本地也会保存数据副本。