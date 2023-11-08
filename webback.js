require("dotenv").config();
const OpenAI = require("openai");
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const secretKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: secretKey,
});

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('chat message', async (msg) => {
    console.log('message: ' + msg);
    try {
      const assistant = await openai.beta.assistants.retrieve('asst_nXJAsO268jQ5p6GjJdwnk0Tn');
      console.log(assistant);

      // Create a thread
      const thread = await openai.beta.threads.create();

      // Pass in the user question into the existing thread
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: msg,
      });

      // Use runs to wait for the assistant response and then retrieve it
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

      // Polling mechanism to see if runStatus is completed
      while (runStatus.status !== "completed") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      }

      // Get the last assistant message from the messages array
      const messages = await openai.beta.threads.messages.list(thread.id);

      // Find the last message for the current run
      const lastMessageForRun = messages.data
        .filter(
          (message) => message.run_id === run.id && message.role === "assistant"
        )
        .pop();

      // If an assistant message is found, send it to the client
      if (lastMessageForRun) {
        socket.emit('chat message', lastMessageForRun.content[0].text.value);
      }
    } catch (error) {
      console.error(error);
      socket.emit('chat message', 'Error: Could not compute the answer.');
    }
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
