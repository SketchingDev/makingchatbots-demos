# ChatGPT interacting with a self-serve chatbot

This is a demonstration of how ChatGPT can test a self-serve chatbot. In this example I'm connecting it to a
Genesys Web Messenger Deployment.

## Getting started

Create file `.env` alongside this README with following environment variables populated:

```bash
GENESYS_DEPLOYMENT_ID=xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
GENESYS_REGION=xx.pure.cloud

OPENAI_API_KEY=xx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Rate Limits

OpenAI restricts how many times we can access the server within a specified period of time. To handle this the script
uses the [exponential-backoff](https://www.npmjs.com/package/exponential-backoff) package.

Read me about the rate limits:
* [OpenAI Guides - Rate limits](https://platform.openai.com/docs/guides/rate-limits)
* [OpenAI API Guide - How can I solve 429: 'Too Many Requests' errors?](https://help.openai.com/en/articles/5955604-how-can-i-solve-429-too-many-requests-errors)
