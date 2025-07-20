import OpenAI from "openai";
import {createServer} from "node:http";
import { Readable } from 'stream';
import fetch from 'node-fetch';
import {pdf} from "pdf-to-img";
import fs from 'node:fs/promises';

const hostname = '0.0.0.0';
const port = 3000;
const paperlessUrl = process.env.PAPERLESS_URL;
const paperlessToken = process.env.PAPERLESS_API_KEY;
const instructions = await fs.readFile('instructions.txt', { encoding: 'utf8' });

const openai = new OpenAI();

async function retrieveBody(req) {
  return new Promise((resolve, reject) => {
    let body = [];
    req.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = resolve(JSON.parse(Buffer.concat(body).toString()));
    });
  });
}

function getDocId(docUrl) {
  const parts = docUrl.split('/');

  return parts[parts.length - 2];
}

async function getDocDetails(docId) {
  const details = await fetch(paperlessUrl + '/api/documents/' + docId + '/', {
    headers: {
      'Authorization': 'Token ' + paperlessToken,
    }
  });

  return JSON.parse(await details.text());
}

async function getDocFile(docId) {
  const document = await fetch(paperlessUrl + '/api/documents/' + docId + '/download/', {
    headers: {
      'Authorization': 'Token ' + paperlessToken,
    }
  });

  return Readable.from(Buffer.from(await document.arrayBuffer()));
}

async function queryAi(document) {
  const pdfPages = await pdf(document, {
    height: 1998,
  });

  let imagePrompts = [];
  for (let i = 1; i <= pdfPages.length; i++) {
    imagePrompts.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${(await pdfPages.getPage(i)).toString('base64')}`,
        detail: 'high',
      },
    });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: instructions,
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze"
          },
          ...imagePrompts
        ]
      }
    ],
    response_format: {
      type: 'json_object',
      /*json_schema: {
        name: 'Document',
        strict: false,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: {
              type: 'string',
              required: true
            },
            amount: {
              type: 'number',
              required: false
            },
            store: {
              type: 'string',
              required: false
            }
          },
        }
      }*/
    }
  });

  return JSON.parse(completion.choices[0].message.content);
}

const server = createServer(async (req, res) => {
  const body = await retrieveBody(req);
  const id = getDocId(body.doc_url);

  console.log('Processing document ' + id);
  const details = await getDocDetails(id);
  const file = await getDocFile(id);

  const aiAnswer = await queryAi(file);
  console.log(aiAnswer);

  const fields = details.custom_fields ?? [];
  if (aiAnswer.amount) {
    fields.push({
      value: aiAnswer.amount,
      field: 6,
    });
  }
  if (aiAnswer.store) {
    fields.push({
      value: aiAnswer.store,
      field: 7,
    });
  }
  if (aiAnswer.warranty) {
    fields.push({
      value: aiAnswer.warranty,
      field: 8,
    });
  }

  const response = await fetch(paperlessUrl + '/api/documents/' + id + '/', {
    method: 'PATCH',
    headers: {
      'Authorization': 'Token ' + paperlessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: aiAnswer.title,
      tags: [...details.tags, 24],
      custom_fields: fields,
      remove_inbox_tags: false,
    })
  });

  const text = await response.text();

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end(text);

  console.log('Finished document ' + id);
  console.log(text);
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
