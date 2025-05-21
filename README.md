# cline-dify
First, install the Clime plugin in VSCode. Clime uses the Dify platform's API to create files and perform AI Q&A, reducing costs.

Usage: Modify the .env.example file and change the configuration. Set DIFY_API_URL to the Dify API address. The default is https://dify.d-1.top/v1, but you can change it to your own Dify address.

After configuring, run the following commands:

pnpm i && pnpm run start

Then, in Clime, select "OpenAi Compatible" in the API Provider section. Set the baseurl to http://127.0.0.1:3005/v1. The modelId can be set to any value. For the API key, use the API key from your Dify account.

Once the configuration is complete, you can start using the Q&A feature in Clime.

Let me know if you need further clarifications or modifications!
# 介绍
中文：
首先vscode中安装cline插件
cline使用dify平台的api进行创建文件以及ai问答，降低成本

使用：
修改.env.example，修改里面的配置
DIFY_API_URL为dify的api地址，默认为https://dify.d-1.top/v1，修改为自己的dify地址
```.env
# Dify 平台 API 地址
DIFY_API_URL=

# Dify 平台 API Key（建议在 Cline 插件中单独填写，这里可留空或填写默认值）
# Cline中模型可以随意选择，但是API需要从dify平台上的特定应用中获取apikey
# 会通过这个API去找寻Dify平台中对应的ChatBot
API_KEY=

# 监听端口（如有需要可修改，默认 3005）
PORT=3005

# Body Parser 请求体大小限制。最好和选择的模型上下文进行对应。
BODY_PARSER_LIMIT=1mb

```

## 安装pnpm后运行转发服务器
配置后运行 pnpm i &&  pnpm run start

之后在cline中`api Provider`中选择`OpenAi Compatible`

`Base Url`为`http://127.0.0.1:3005/v1`
之后需要具体参考env文件。
```.env
modelId: 任意填写，不会影响寻找
API key: 设置dify中的api Key即可,需要是对应应用的API。
```

配置完成后，在cline中问答即可。其中可以自写提示词，也可以设置Cline的读写权限。具体请参考Cline的使用方式，这里不再赘述。

![image](https://github.com/user-attachments/assets/d8251b01-f4e1-4ca9-9167-5d7d572b3828)

记得开启文件权限：

![image](https://github.com/user-attachments/assets/552e1bf7-80ff-47b0-bc26-9e60e7163ad2)


<img width="462" alt="image" src="https://github.com/user-attachments/assets/ca3e04ab-cf04-4f31-b4dd-bc64deab3d73" />
