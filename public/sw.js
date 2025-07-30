import * as webllm from '@mlc-ai/web-llm'

const handler = new webllm.ServiceWorkerMLCEngineHandler()

console.log("WebLLM service worker starting up...")

self.onmessage = (msg) => {
  console.log("WebLLM service worker received message:", msg)
  handler.onmessage(msg)
}
