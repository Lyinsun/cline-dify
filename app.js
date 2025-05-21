import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
dotenv.config();



if (!process.env.DIFY_API_URL) throw new Error("DIFY API URL is required.");
function generateId() {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 29; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
const app = express();
const bodyParserLimit = process.env.BODY_PARSER_LIMIT || '1mb'; // 如果未设置，则默认为 10mb
app.use(bodyParser.json({ limit: bodyParserLimit }));
app.use(bodyParser.urlencoded({ limit: bodyParserLimit, extended: true }));
const botType = process.env.BOT_TYPE || 'Chat';
const inputVariable = process.env.INPUT_VARIABLE || '';
const outputVariable = process.env.OUTPUT_VARIABLE || '';

let apiPath;
switch (botType) {
  case 'Chat':
    apiPath = '/chat-messages';
    break;
  case 'Completion':
    apiPath = '/completion-messages';
    break;
  case 'Workflow':
    apiPath = '/workflows/run';
    break;
  default:
    throw new Error('Invalid bot type in the environment variable.');
}
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization",
  "Access-Control-Max-Age": "86400",
};

app.use((req, res, next) => {
  res.set(corsHeaders);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  console.log('Request Method:', req.method); 
  console.log('Request Path:', req.path);
  next();
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>DIFY2OPENAI</title>
      </head>
      <body>
        <h1>Dify2OpenAI</h1>
        <p>Congratulations! Your project has been successfully deployed.</p>
      </body>
    </html>
  `);
});

app.get('/v1/models', (req, res) => {
  const models = {
    "object": "list",
    "data": [
      {
        "id": process.env.MODELS_NAME || "dify",
        "object": "model",
        "owned_by": "dify",
        "permission": null,
      }
    ]
  };
  res.json(models);
});

app.post("/v1/chat/completions", async (req, res) => {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader) {
    return res.status(401).json({
      code: 401,
      errmsg: "Unauthorized.",
    });
  } else {
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        code: 401,
        errmsg: "Unauthorized.",
      });
    }
  }
  try {
    const data = req.body;
    const messages = data.messages;


    let queryString;
    if (botType === 'Chat') {
      const lastMessage = messages[messages.length - 1];
      queryString = `here is our talk history:\n'''\n${messages
        .slice(0, -1) 
        .map((message) => `${message.role}: ${message.content}`)
        .join('\n')}\n'''\n\nhere is my question:\n${JSON.stringify(lastMessage.content)}`;
    } else if (botType === 'Completion' || botType === 'Workflow') {
      queryString = messages[messages.length - 1].content;
    }
      // return res.status(200).json({ message: "Success" });
    const stream = data.stream !== undefined ? data.stream : false;
    let requestBody;
    if (inputVariable) {
      requestBody = {
        inputs: { [inputVariable]: queryString },
        response_mode: "streaming",
        conversation_id: "",
        user: "apiuser",
        auto_generate_name: false
      };
    } else {
      requestBody = {
        "inputs": {},
        query: queryString,
        response_mode: "streaming",
        conversation_id: "",
        user: "apiuser",
        auto_generate_name: false
      };
    }
    // console.log(queryString);
    const resp = await fetch(process.env.DIFY_API_URL + apiPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authHeader.split(" ")[1]}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      const difyStream = resp.body; // Renamed to avoid conflict with outer scope stream variable
      let buffer = "";
      let isFirstChunk = true;
      let isResponseEnded = false;

      // Ensure log directory exists
      const logDir = 'log';
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const difyLogStream = fs.createWriteStream(path.join(logDir, 'dify_sse.log'), { flags: 'a' });
      const openaiLogStream = fs.createWriteStream(path.join(logDir, 'openai_sse.log'), { flags: 'a' });

      const closeLogStreams = () => {
        if (difyLogStream && !difyLogStream.closed) {
          difyLogStream.end();
        }
        if (openaiLogStream && !openaiLogStream.closed) {
          openaiLogStream.end();
        }
      };

      res.on('close', () => {
        isResponseEnded = true;
        if (difyStream && typeof difyStream.destroy === 'function') {
          difyStream.destroy();
        }
        closeLogStreams();
      });

      difyStream.on("data", (chunk) => {
        if (isResponseEnded) return;

        const chunkString = chunk.toString();
        difyLogStream.write(`[${new Date().toISOString()}] Dify RAW Chunk: ${chunkString}\n`);
        buffer += chunkString;
        let lines = buffer.split("\n");

        for (let i = 0; i < lines.length - 1; i++) {
          let line = lines[i].trim();

          if (!line.startsWith("data:")) continue;
          line = line.slice(5).trim();
          let chunkObj;
          try {
            if (line.startsWith("{")) {
              chunkObj = JSON.parse(line);
            } else {
              continue;
            }
          } catch (error) {
            console.error("Error parsing chunk:", error);
            continue;
          }

          if (chunkObj.event === "message" || chunkObj.event === "agent_message" || chunkObj.event === "text_chunk") {
            let chunkContent;
            if (chunkObj.event === "text_chunk") {
              chunkContent = chunkObj.data.text;
            } else {
              chunkContent = chunkObj.answer;
            }
    
            if (isFirstChunk) {
              chunkContent = chunkContent.trimStart();
              isFirstChunk = false;
            }
            if (chunkContent !== "") {
              const chunkId = `chatcmpl-${Date.now()}`;
              const chunkCreated = chunkObj.created_at;
              
              if (!isResponseEnded) {
              const openaiChunkString = "data: " +
                  JSON.stringify({
                    id: chunkId,
                    object: "chat.completion.chunk",
                    created: chunkCreated,
                    model: data.model,
                    choices: [
                      {
                        index: 0,
                        delta: {
                          content: chunkContent,
                        },
                        finish_reason: null,
                      },
                    ],
                  }) +
                  "\n\n";
              openaiLogStream.write(`[${new Date().toISOString()}] OpenAI Formatted Chunk: ${openaiChunkString}`);
              res.write(openaiChunkString);
            }
          } } else if (chunkObj.event === "workflow_finished" || chunkObj.event === "message_end") {
            if (!isResponseEnded) {
              const chunkId = `chatcmpl-${Date.now()}`;
              const finishChunkString = "data: " +
                  JSON.stringify({
                    id: chunkId,
                    object: "chat.completion.chunk",
                    created: chunkObj.created_at,
                    model: data.model,
                    choices: [
                      {
                        index: 0,
                        delta: {},
                        finish_reason: "stop",
                      },
                    ],
                  }) +
                  "\n\n";
              const doneSignalString = "data: [DONE]\n\n";

              openaiLogStream.write(`[${new Date().toISOString()}] OpenAI Finish Chunk: ${finishChunkString}`);
              openaiLogStream.write(`[${new Date().toISOString()}] OpenAI DONE Signal: ${doneSignalString}`);

              res.write(finishChunkString);
              res.write(doneSignalString);
              res.end();
              isResponseEnded = true;
              if (difyStream && typeof difyStream.destroy === 'function') { // Ensure difyStream is used
                difyStream.destroy();
              }
              closeLogStreams();
            }
          } else if (chunkObj.event === "agent_thought") {
          } else if (chunkObj.event === "ping") {
          } else if (chunkObj.event === "error") {
            if (!isResponseEnded) {
              console.error(`Error: ${chunkObj.code}, ${chunkObj.message}`);
              const errorChunkString = `data: ${JSON.stringify({ error: chunkObj.message })}\n\n`;
              const doneSignalString = "data: [DONE]\n\n";

              openaiLogStream.write(`[${new Date().toISOString()}] OpenAI Error Chunk: ${errorChunkString}`);
              openaiLogStream.write(`[${new Date().toISOString()}] OpenAI DONE Signal (Error): ${doneSignalString}`);

              res.write(errorChunkString);
              res.write(doneSignalString);
              res.end();
              isResponseEnded = true;
              if (difyStream && typeof difyStream.destroy === 'function') { // Ensure difyStream is used
                difyStream.destroy();
              }
              closeLogStreams();
            }
          }
        }

        buffer = lines[lines.length - 1];
      });

      difyStream.on('error', (error) => { // Changed stream to difyStream
        if (!isResponseEnded) {
          console.error('Stream error:', error);
          const errorString = `data: ${JSON.stringify({ error: "Stream error occurred" })}\n\n`;
          const doneSignalString = "data: [DONE]\n\n";
          openaiLogStream.write(`[${new Date().toISOString()}] OpenAI Stream Error: ${errorString}`);
          openaiLogStream.write(`[${new Date().toISOString()}] OpenAI DONE Signal (Stream Error): ${doneSignalString}`);
          res.write(errorString);
          res.write(doneSignalString);
          res.end();
          isResponseEnded = true;
          closeLogStreams();
        }
      });
    } else {
      let result = "";
      let usageData = "";
      let hasError = false;
      let messageEnded = false;
      let buffer = "";
      let skipWorkflowFinished = false;


      const stream = resp.body;
      stream.on("data", (chunk) => {
        buffer += chunk.toString();
        let lines = buffer.split("\n");

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line === "") continue;
          let chunkObj;
          try {
            const cleanedLine = line.replace(/^data: /, "").trim();
            if (cleanedLine.startsWith("{") && cleanedLine.endsWith("}")) {
              chunkObj = JSON.parse(cleanedLine);
            } else {
              continue;
            }
          } catch (error) {
            console.error("Error parsing JSON:", error);
            continue;
          }

          if (
            chunkObj.event === "message" ||
            chunkObj.event === "agent_message"
          ) {
            result += chunkObj.answer;
            skipWorkflowFinished = true;
          } else if (chunkObj.event === "message_end") {
            messageEnded = true;
            usageData = {
              prompt_tokens: chunkObj.metadata.usage.prompt_tokens || 100,
              completion_tokens:
                chunkObj.metadata.usage.completion_tokens || 10,
              total_tokens: chunkObj.metadata.usage.total_tokens || 110,
            };
          } else if (chunkObj.event === "workflow_finished" && !skipWorkflowFinished) {
            messageEnded = true;
            const outputs = chunkObj.data.outputs;
            if (outputVariable) {
              result = outputs[outputVariable];
            } else {
              result = outputs;
            }
            result = String(result);
            usageData = {
              prompt_tokens: chunkObj.metadata?.usage?.prompt_tokens || 100,
              completion_tokens: chunkObj.metadata?.usage?.completion_tokens || 10,
              total_tokens: chunkObj.data.total_tokens || 110,
            };
          } else if (chunkObj.event === "agent_thought") {
          } else if (chunkObj.event === "ping") {
          } else if (chunkObj.event === "error") {
            console.error(`Error: ${chunkObj.code}, ${chunkObj.message}`);
            hasError = true;
            break;
          } 
        }

        buffer = lines[lines.length - 1];
      });

      stream.on("end", () => {
        if (hasError) {
          res
            .status(500)
            .json({ error: "An error occurred while processing the request." });
        } else if (messageEnded) {
          const formattedResponse = {
            id: `chatcmpl-${generateId()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: data.model,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: result.trim(),
                },
                logprobs: null,
                finish_reason: "stop",
              },
            ],
            usage: usageData,
            system_fingerprint: "fp_2f57f81c11",
          };
          const jsonResponse = JSON.stringify(formattedResponse, null, 2);
          res.set("Content-Type", "application/json");
          res.send(jsonResponse);
        } else {
          res.status(500).json({ error: "Unexpected end of stream." });
        }
      });
    }
  } catch (error) {
    console.error("Error:", error);
  }
});

app.listen(process.env.PORT || 3005);
