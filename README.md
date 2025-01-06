# cline-dify
cline使用dify平台的api进行创建文件以及ai问答，降低成本
使用：
修改.env.example，修改里面的配置
DIFY_API_URL为dify的api地址，默认为https://dify.lininn.cn/v1，修改为自己的dify地址
配置后运行 pnpm i &&  pnpm run start
之后在cline 中api Provider中选择OpenAi Compatible
baseurl为http://127.0.0.1:3005/v1
API key设置dify中的api Key即可
配置完成后，在cline中问答即可