import {
  Conversation,
  Transcriber,
  WebMessengerGuestSession,
} from '@ovotech/genesys-web-messaging-tester';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import chalk from 'chalk';
import { backOff } from 'exponential-backoff';
import { shouldEndConversation } from './should-end-conversation';

interface AxiosError {
  response: {
    status: number;
    statusText: string;
  };
}

(async () => {
  /**
   * This value can be between 0 and 1 and controls the randomness of ChatGPT's completions.
   * 0 = Responses will be deterministic and repetitive
   *     ChatGPT will favour words (tokens) that have the highest probability of coming next in the text it is constructing
   * 1 = Responses will include more variety and creativity
   *     ChatGPT will consider using words (tokens) that are less likely to come next in the text it is constructing
   *
   * @see https://platform.openai.com/docs/quickstart/adjust-your-settings
   */
  const temperature = 0.6;
  const chatGptPrompt = `
I want you to act as a customer looking to rent a car for a holiday, and I will act as the company's chatbot that will
try and serve you. You want to rent a car in London for next Saturday and will drop it off in Liverpool 3 days later.
If I make a mistake you must include the word "WRONG" in your response. Now start our conversation by saying hello to me`;

  if (
    !process.env.GENESYS_DEPLOYMENT_ID ||
    !process.env.GENESYS_REGION ||
    !process.env.OPENAI_API_KEY
  ) {
    throw new Error(
      'Missing environment vars: GENESYS_DEPLOYMENT_ID, GENESYS_REGION, OPENAI_API_KEY',
    );
  }

  const openai = new OpenAIApi(
    new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  );

  const session = new WebMessengerGuestSession({
    deploymentId: process.env.GENESYS_DEPLOYMENT_ID,
    region: process.env.GENESYS_REGION,
  });

  new Transcriber(session).on('messageTranscribed', (i) => {
    if (i.who === 'You') {
      console.log(chalk.bold.green(`ChatGPT: ${i.message}`));
    } else {
      console.log(`Chatbot: ${i.message}`);
    }
  });

  const convo = new Conversation(session);

  const messages: ChatCompletionRequestMessage[] = [
    {
      role: 'system',
      content: chatGptPrompt,
    },
  ];

  let endConversation: { hasEnded: false } | { hasEnded: true; reason: string } = {
    hasEnded: false,
  };
  do {
    const { data } = await backOff(
      () =>
        openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          n: 1, // Number of choices. This demo only supports 1
          temperature,
          messages,
        }),
      {
        startingDelay: 2000,
        retry: (error: AxiosError, attemptNumber) => {
          const retry = error.response.status === 429 && attemptNumber <= 10;
          if (retry) {
            console.log(
              `${chalk.yellow.bold(`${error.response.statusText}:`)} ${chalk.yellow(
                `Retrying (${attemptNumber} of 10)`,
              )}`,
            );
          }
          return retry;
        },
      },
    );

    if (data.choices[0].message) {
      messages.push({ role: 'assistant', content: data.choices[0].message.content });
      convo.sendText(data.choices[0].message.content);
    } else {
      messages.push({ role: 'assistant', content: '' });
    }

    endConversation = shouldEndConversation(messages);

    if (!endConversation.hasEnded) {
      const chatBotResponses = await convo.waitForResponses(3000);
      messages.push({ role: 'user', content: chatBotResponses.join('\n') });
    }

    endConversation = shouldEndConversation(messages);
  } while (!endConversation.hasEnded);

  console.log(chalk.bold(`\n---------`));
  console.log(chalk.bold(`${endConversation.reason}`));

  session.close();
})().catch((e) => {
  throw e;
});
