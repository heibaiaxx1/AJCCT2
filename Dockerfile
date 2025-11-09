FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装依赖
RUN npm install --only=production

# 复制应用源代码
COPY . .

# 暴露端口 80
EXPOSE 80

# 定义健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').request({host:'localhost',port:80,path:'/health'},(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1)).end()"

# 启动应用
CMD ["npm", "start"]