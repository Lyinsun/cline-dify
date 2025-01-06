# cline-dify
首先vscode中安装cline插件
cline使用dify平台的api进行创建文件以及ai问答，降低成本

使用：
修改.env.example，修改里面的配置
DIFY_API_URL为dify的api地址，默认为https://dify.d-1.top/v1，修改为自己的dify地址

配置后运行 pnpm i &&  pnpm run start

之后在cline 中api Provider中选择OpenAi Compatible
baseurl为http://127.0.0.1:3005/v1
API key设置dify中的api Key即可
配置完成后，在cline中问答即可

![image](https://github.com/user-attachments/assets/d8251b01-f4e1-4ca9-9167-5d7d572b3828)

记得开启文件权限：

![image](https://github.com/user-attachments/assets/552e1bf7-80ff-47b0-bc26-9e60e7163ad2)


<img width="462" alt="image" src="https://github.com/user-attachments/assets/ca3e04ab-cf04-4f31-b4dd-bc64deab3d73" />
